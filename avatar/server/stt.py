"""STT-Layer: Silero VAD (End-of-Turn) + faster-whisper (Transkription).

Datenfluss (server/pipeline.py):
  Client → PCM16 mono 16 kHz (binäre WS-Frames)
        → VadSegmenter.feed() erkennt Sprechbeginn (→ Barge-in) und Sprechende
        → abgeschlossene Utterance → SpeechToText.transcribe() → Text + Sprache
        → Session.on_user_text()

Beide Modelle sind gekapselt und lazy: ohne `STT_ENABLED=true` wird nichts
geladen (Mock: der Client schickt Text). Für Tests lässt sich ein Fake-Modell
injizieren (`SpeechToText(model=...)`), damit die Logik ohne Gewichte prüfbar ist.

Silero VAD (~2 MB, ONNX, CPU-schnell) liegt im pip-Paket `silero-vad` bei.
faster-whisper lädt das Modell aus `STT_MODEL` (Name → Hugging-Face-Download,
oder ein lokaler CTranslate2-Ordner für Hosts ohne Internet).
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Iterator, Literal

from .audio import pcm16_bytes_to_float32
from .config import config

log = logging.getLogger("advoos.stt")

VadEventKind = Literal["speech_start", "speech_end"]


@dataclass
class VadEvent:
    kind: VadEventKind
    """Bei speech_end: die komplette Utterance als float32-Samples @16 kHz."""
    samples: object | None = None
    duration_ms: int = 0


@dataclass
class Transcript:
    text: str
    lang: str
    duration_ms: int = 0
    latency_ms: int = 0


# ---------------------------------------------------------------------------
# VAD
# ---------------------------------------------------------------------------

class VadSegmenter:
    """Streaming-VAD: nimmt beliebig grosse PCM16-Chunks, liefert Start/Ende-Ereignisse.

    Intern arbeitet Silero mit 512-Sample-Fenstern (32 ms @16 kHz). Die Utterance
    wird ab Sprechbeginn (inkl. kurzem Vorlauf) bis zum Sprechende gesammelt.
    """

    WINDOW = 512

    def __init__(self, rate: int = config.AUDIO_IN_RATE, threshold: float = config.VAD_THRESHOLD,
                 min_silence_ms: int = config.VAD_MIN_SILENCE_MS, pad_ms: int = config.VAD_SPEECH_PAD_MS,
                 max_utterance_s: float = config.VAD_MAX_UTTERANCE_S, model=None) -> None:
        import numpy as np

        self._np = np
        self.rate = rate
        self._pad = int(rate * pad_ms / 1000)
        self._max_samples = int(rate * max_utterance_s)
        if model is None:
            from silero_vad import VADIterator, load_silero_vad

            model = load_silero_vad(onnx=True)
            self._it = VADIterator(model, threshold=threshold, sampling_rate=rate,
                                   min_silence_duration_ms=min_silence_ms, speech_pad_ms=pad_ms)
        else:
            self._it = model  # Fake für Tests: callable(window) -> {"start"|"end": ...} | None
        self._pending = np.zeros(0, dtype=np.float32)
        self._ring = np.zeros(0, dtype=np.float32)  # Vorlauf vor Sprechbeginn
        self._utt: list = []
        self.in_speech = False

    def reset(self) -> None:
        if hasattr(self._it, "reset_states"):
            self._it.reset_states()
        self._pending = self._np.zeros(0, dtype=self._np.float32)
        self._ring = self._np.zeros(0, dtype=self._np.float32)
        self._utt = []
        self.in_speech = False

    def feed(self, pcm16: bytes) -> Iterator[VadEvent]:
        np = self._np
        samples = pcm16_bytes_to_float32(pcm16)
        self._pending = np.concatenate([self._pending, samples])
        while len(self._pending) >= self.WINDOW:
            win, self._pending = self._pending[: self.WINDOW], self._pending[self.WINDOW:]
            ev = self._it(win)
            if self.in_speech:
                self._utt.append(win)
            else:
                self._ring = np.concatenate([self._ring, win])[-self._pad:]
            if ev and "start" in ev and not self.in_speech:
                self.in_speech = True
                self._utt = [self._ring.copy(), win]
                yield VadEvent("speech_start")
            elif (ev and "end" in ev and self.in_speech) or (self.in_speech and self._utt_len() >= self._max_samples):
                utt = np.concatenate(self._utt) if self._utt else np.zeros(0, dtype=np.float32)
                self.in_speech = False
                self._utt = []
                yield VadEvent("speech_end", samples=utt, duration_ms=int(len(utt) / self.rate * 1000))

    def _utt_len(self) -> int:
        return sum(len(c) for c in self._utt)


# ---------------------------------------------------------------------------
# STT
# ---------------------------------------------------------------------------

class SpeechToText:
    """faster-whisper-Wrapper. `model` injizierbar (Tests); sonst lazy aus der Config."""

    def __init__(self, model=None) -> None:
        self._model = model
        self._lock = threading.Lock()

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            from faster_whisper import WhisperModel

            t0 = time.perf_counter()
            log.info("Lade faster-whisper %s (%s/%s)…", config.STT_MODEL, config.STT_DEVICE, config.STT_COMPUTE_TYPE)
            self._model = WhisperModel(config.STT_MODEL, device=config.STT_DEVICE, compute_type=config.STT_COMPUTE_TYPE)
            log.info("faster-whisper geladen in %.1f s", time.perf_counter() - t0)

    def transcribe(self, samples, lang_hint: str | None = None) -> Transcript:
        """Transkribiert eine VAD-segmentierte Utterance (float32 @16 kHz)."""
        if self._model is None:
            self.load()
        t0 = time.perf_counter()
        language = lang_hint or (config.STT_LANGUAGE or None)
        segments, info = self._model.transcribe(
            samples, language=language, beam_size=config.STT_BEAM_SIZE,
            vad_filter=False,  # VAD läuft bereits im Streaming-Ingest
            condition_on_previous_text=False,
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        lang = getattr(info, "language", None) or language or config.DEFAULT_LANG
        if lang not in config.SUPPORTED_LANGS:
            lang = config.DEFAULT_LANG
        return Transcript(
            text=text, lang=lang,
            duration_ms=int(len(samples) / config.AUDIO_IN_RATE * 1000),
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )
