"""TTS-Layer (pluggable): Piper (Standard DE/FR/IT) · Kokoro (opt. EN) · Mock.

Wichtig: **Kokoro hat kein Deutsch** → für die Schweiz ist Piper der Default
(multilingual DE/FR/IT, schnell, permissive Lizenz). Kokoro nur optional für EN.

Jeder Aufruf liefert einen WAV-Bytes-Chunk für genau einen Satz (satzweises Streaming).
MOCK-Modus erzeugt eine kurze Stille passender Länge, damit die Pipeline ohne
Modelle läuft.
"""
from __future__ import annotations

import io
import struct
from typing import Protocol

from .config import config

_VOICES = {"de": config.TTS_VOICE_DE, "fr": config.TTS_VOICE_FR, "it": config.TTS_VOICE_IT}


class TTSEngine(Protocol):
    def synthesize(self, text: str, lang: str) -> bytes: ...


class MockTTS:
    """Erzeugt Stille proportional zur Textlänge (nur zum Testen der Pipeline)."""

    def synthesize(self, text: str, lang: str) -> bytes:
        seconds = max(0.4, min(6.0, len(text) / 15.0))
        return _silent_wav(seconds, config.TTS_SAMPLE_RATE)


class PiperTTS:
    def __init__(self) -> None:
        # TODO(real): Piper-Stimmen laden (piper-tts / piper-phonemize).
        #   from piper import PiperVoice
        #   self._voices = {l: PiperVoice.load(path_for(v)) for l, v in _VOICES.items()}
        raise NotImplementedError(
            "TTS_ENGINE=piper erfordert piper-tts + heruntergeladene Stimmen (siehe README)."
        )

    def synthesize(self, text: str, lang: str) -> bytes:
        # TODO(real): voice = self._voices[lang]; return voice.synthesize_wav(text)
        raise NotImplementedError


class KokoroTTS:
    def __init__(self) -> None:
        # TODO(real): Kokoro laden — NUR für EN einsetzen (kein Deutsch!).
        raise NotImplementedError("TTS_ENGINE=kokoro nur für EN; DE/FR/IT über Piper.")

    def synthesize(self, text: str, lang: str) -> bytes:
        raise NotImplementedError


def make_tts() -> TTSEngine:
    engine = (config.TTS_ENGINE or "mock").lower()
    if engine == "piper":
        return PiperTTS()
    if engine == "kokoro":
        return KokoroTTS()
    return MockTTS()


def _silent_wav(seconds: float, rate: int) -> bytes:
    n = int(seconds * rate)
    data = b"\x00\x00" * n  # 16-bit mono Stille
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + len(data)))
    buf.write(b"WAVEfmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", len(data)))
    buf.write(data)
    return buf.getvalue()
