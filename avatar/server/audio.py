"""Kleine Audio-Helfer ohne schwere Abhängigkeiten (WAV-Header, PCM-Konvertierung).

numpy wird nur dort importiert, wo echte Modelle ohnehin numpy brauchen.
"""
from __future__ import annotations

import io
import wave
from dataclasses import dataclass


@dataclass(frozen=True)
class WavInfo:
    rate: int
    channels: int
    sample_width: int
    frames: int

    @property
    def duration_ms(self) -> int:
        return int(self.frames / self.rate * 1000) if self.rate else 0


def wav_info(wav: bytes) -> WavInfo:
    """Liest den WAV-Header (robust: bei Fehler 0-Frames statt Exception)."""
    try:
        with wave.open(io.BytesIO(wav), "rb") as w:
            return WavInfo(w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes())
    except (wave.Error, EOFError):
        return WavInfo(0, 0, 0, 0)


def pcm16_to_wav(pcm: bytes, rate: int, channels: int = 1) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def silent_wav(seconds: float, rate: int) -> bytes:
    return pcm16_to_wav(b"\x00\x00" * int(seconds * rate), rate)


def pcm16_bytes_to_float32(pcm: bytes):
    """PCM16-LE → float32 in [-1, 1] (numpy)."""
    import numpy as np

    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def float32_to_pcm16_bytes(samples) -> bytes:
    import numpy as np

    clipped = np.clip(samples, -1.0, 1.0)
    return (clipped * 32767.0).astype(np.int16).tobytes()


def resample_linear(samples, src_rate: int, dst_rate: int):
    """Einfaches lineares Resampling (für Tests/Fallback; Produktiv: Client liefert 16 kHz)."""
    import numpy as np

    if src_rate == dst_rate or len(samples) == 0:
        return samples
    n_out = int(len(samples) * dst_rate / src_rate)
    x_old = np.arange(len(samples)) / src_rate
    x_new = np.arange(n_out) / dst_rate
    return np.interp(x_new, x_old, samples).astype(np.float32)


def pack_pcm16(samples) -> bytes:  # Alias für Lesbarkeit an Aufrufstellen
    return float32_to_pcm16_bytes(samples)


__all__ = [
    "WavInfo", "wav_info", "pcm16_to_wav", "silent_wav", "pcm16_bytes_to_float32",
    "float32_to_pcm16_bytes", "resample_linear", "pack_pcm16",
]
