"""STT-Layer: faster-whisper + Silero VAD.

- VAD (Silero) segmentiert den Mikrofon-Stream und erkennt das Sprechende (End-of-Turn).
- faster-whisper transkribiert die abgeschlossene Utterance.

MOCK-Modus (STT_ENABLED=false): der Client schickt bereits Text; diese Klasse wird
dann nicht gebraucht. Der reale Pfad ist als klar markiertes TODO skizziert.
"""
from __future__ import annotations

from dataclasses import dataclass

from .config import config


@dataclass
class Transcript:
    text: str
    lang: str


class SpeechToText:
    def __init__(self) -> None:
        self._model = None
        if config.STT_ENABLED:
            self._load()

    def _load(self) -> None:
        # TODO(real): faster-whisper laden.
        #   from faster_whisper import WhisperModel
        #   self._model = WhisperModel(config.STT_MODEL, device=config.STT_DEVICE,
        #                              compute_type="float16")
        raise NotImplementedError(
            "STT_ENABLED=true erfordert faster-whisper + Silero VAD (siehe requirements.txt)."
        )

    def transcribe(self, pcm_utterance: bytes) -> Transcript:
        """Transkribiert eine bereits VAD-segmentierte Utterance (16 kHz mono PCM)."""
        # TODO(real):
        #   segments, info = self._model.transcribe(audio_np, vad_filter=True)
        #   text = " ".join(s.text for s in segments).strip()
        #   return Transcript(text=text, lang=info.language)
        raise NotImplementedError

    # Hinweis: Die VAD/End-of-Turn-Logik (Silero) läuft im Streaming-Ingest
    # (server/main.py bzw. pipeline.py) und ruft transcribe() bei Sprechpause auf.
