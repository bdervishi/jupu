"""TTS-Layer (pluggable): Piper (Standard DE/FR/IT) · Kokoro (opt. EN) · Mock.

Wichtig: **Kokoro hat kein Deutsch** → für die Schweiz ist Piper der Default
(multilingual DE/FR/IT, schnell, permissive Lizenz, läuft auch auf CPU:
~0,1–0,2 s pro Satz für „low/medium"-Stimmen). Kokoro nur optional für EN.

Jeder Aufruf liefert einen WAV-Bytes-Chunk für genau einen Satz (satzweises
Streaming). Die Sample-Rate steht im WAV-Header (Piper-Stimmen: 16 kHz low,
22,05 kHz medium/high) — die Pipeline liest sie von dort, nicht aus der Config.

MOCK-Modus erzeugt eine kurze Stille passender Länge, damit die Pipeline ohne
Modelle läuft. Fehlt eine Piper-Stimme, fällt PiperTTS (konfigurierbar) auf den
Mock zurück statt abzustürzen.
"""
from __future__ import annotations

import glob
import io
import logging
import os
import threading
import wave
from typing import Protocol

from .audio import silent_wav
from .config import config

log = logging.getLogger("advoos.tts")

_VOICES = {"de": config.TTS_VOICE_DE, "fr": config.TTS_VOICE_FR, "it": config.TTS_VOICE_IT}


class TTSEngine(Protocol):
    name: str

    def synthesize(self, text: str, lang: str) -> bytes: ...


class MockTTS:
    """Erzeugt Stille proportional zur Textlänge (nur zum Testen der Pipeline)."""

    name = "mock"

    def synthesize(self, text: str, lang: str) -> bytes:
        seconds = max(0.4, min(6.0, len(text) / 15.0))
        return silent_wav(seconds, config.TTS_SAMPLE_RATE)


class PiperTTS:
    """Piper-Stimmen je Sprache, lazy geladen (erster Satz je Sprache ~1 s Ladezeit).

    Auflösung der Stimmdatei in PIPER_VOICES_DIR:
      1. exakt `<TTS_VOICE_xx>.onnx` (z. B. de_DE-thorsten-medium.onnx)
      2. sonst erste Datei, die mit dem Sprachkürzel beginnt (de*.onnx) — deckt auch
         die älteren Namen der GitHub-Releases ab (de-thorsten-low.onnx).
    """

    name = "piper"

    def __init__(self, voices_dir: str | None = None, fallback_mock: bool | None = None,
                 preload: bool | None = None) -> None:
        self._dir = voices_dir or config.PIPER_VOICES_DIR
        self._fallback = config.TTS_FALLBACK_MOCK if fallback_mock is None else fallback_mock
        self._voices: dict[str, object] = {}
        self._lock = threading.Lock()
        self._mock = MockTTS()
        self._unavailable = True
        try:
            import piper  # noqa: F401  (nur Verfügbarkeit prüfen)
        except ImportError as exc:  # pragma: no cover - je nach Umgebung
            if not self._fallback:
                raise RuntimeError("TTS_ENGINE=piper erfordert `pip install piper-tts`.") from exc
            log.warning("piper-tts nicht installiert → Mock-TTS (TTS_FALLBACK_MOCK=true).")
            self._unavailable = True
        else:
            self._unavailable = False
            if (config.TTS_PRELOAD if preload is None else preload):
                self.preload()

    def preload(self) -> list[str]:
        """Lädt alle vorhandenen Stimmen jetzt (statt beim ersten Satz) → erstes Audio ~1 s früher."""
        loaded = []
        for lang in self.available_langs():
            if self._voice(lang) is not None:
                loaded.append(lang)
        if loaded:
            log.info("Piper-Stimmen vorgeladen: %s", ", ".join(loaded))
        else:
            log.warning("Keine Piper-Stimmen in %s gefunden (scripts/download-voices.sh).", self._dir)
        return loaded

    # -- Stimmen ------------------------------------------------------------

    def voice_path(self, lang: str) -> str | None:
        exact = os.path.join(self._dir, f"{_VOICES.get(lang, '')}.onnx")
        if os.path.isfile(exact):
            return exact
        candidates = sorted(glob.glob(os.path.join(self._dir, f"{lang}*.onnx")))
        return candidates[0] if candidates else None

    def available_langs(self) -> list[str]:
        return [l for l in config.SUPPORTED_LANGS if self.voice_path(l)]

    def _voice(self, lang: str):
        with self._lock:
            if lang in self._voices:
                return self._voices[lang]
            path = self.voice_path(lang)
            if not path:
                return None
            from piper import PiperVoice

            log.info("Lade Piper-Stimme %s → %s", lang, path)
            voice = PiperVoice.load(path)
            self._voices[lang] = voice
            return voice

    # -- Synthese -----------------------------------------------------------

    def synthesize(self, text: str, lang: str) -> bytes:
        if self._unavailable:
            return self._mock.synthesize(text, lang)
        lang = lang if lang in _VOICES else config.DEFAULT_LANG
        voice = self._voice(lang)
        if voice is None:
            if not self._fallback:
                raise RuntimeError(f"Keine Piper-Stimme für '{lang}' in {self._dir} (siehe scripts/download-voices.sh).")
            log.warning("Keine Piper-Stimme für '%s' in %s → Mock-Audio.", lang, self._dir)
            return self._mock.synthesize(text, lang)

        from piper import SynthesisConfig

        syn = SynthesisConfig(length_scale=config.TTS_LENGTH_SCALE) if config.TTS_LENGTH_SCALE != 1.0 else None
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            voice.synthesize_wav(text, w, syn_config=syn)
        return buf.getvalue()


class KokoroTTS:
    """Kokoro — NUR für EN einsetzen (kein Deutsch!). Bewusst nicht implementiert:
    DE/FR/IT laufen über Piper; ein EN-Bedarf ist im CH-Kanzleikontext nachrangig."""

    name = "kokoro"

    def __init__(self) -> None:
        raise NotImplementedError("TTS_ENGINE=kokoro nur für EN; DE/FR/IT über Piper.")

    def synthesize(self, text: str, lang: str) -> bytes:  # pragma: no cover
        raise NotImplementedError


def make_tts() -> TTSEngine:
    engine = (config.TTS_ENGINE or "mock").lower()
    if engine == "piper":
        return PiperTTS()
    if engine == "kokoro":
        return KokoroTTS()
    return MockTTS()
