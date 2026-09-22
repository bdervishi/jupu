"""Avatar-Layer: MuseTalk (audio-getriebener Lip-Sync) über einen GPU-Sidecar.

MuseTalk ist kein pip-Paket, sondern ein Repo mit eigenen Gewichten und einer
schweren Torch/CUDA-Umgebung. Deshalb läuft es als eigener Dienst
(`avatar/musetalk/`, Port 8090) und der Media-Server spricht ihn per HTTP an:

  POST {AVATAR_URL}/animate   (multipart: audio=<wav>)
  → {"fps": 25, "frames": ["<b64 jpeg>", ...], "duration_ms": N}

Der Sidecar hält das Referenz-/Idle-Video und die Latents im Speicher und
rendert nur den Mundbereich passend zum Audio neu. Der Client zeichnet die
JPEG-Frames synchron zum Audio auf ein <canvas>.

MOCK-Modus (AVATAR_ENABLED=false oder kein AVATAR_URL): keine Frames, nur
Timing-Metadaten → der Client spielt Audio ab und zeigt den Idle-Avatar.
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field

from .config import config

log = logging.getLogger("advoos.avatar")


@dataclass
class AvatarChunk:
    audio_wav: bytes
    frames: list[bytes] = field(default_factory=list)  # JPEG-Frames (leer im Mock-Modus)
    fps: int = 25
    duration_ms: int = 0
    mock: bool = True


class Avatar:
    """Wählt je nach Config Mock oder MuseTalk-Sidecar; `transport` ist für Tests injizierbar."""

    def __init__(self, transport=None) -> None:
        self._transport = transport
        self.enabled = bool(config.AVATAR_ENABLED and config.AVATAR_URL)
        if config.AVATAR_ENABLED and not config.AVATAR_URL:
            log.warning("AVATAR_ENABLED=true ohne AVATAR_URL → Mock-Avatar.")
        self.mode = "musetalk" if self.enabled else "mock"

    def animate(self, audio_wav: bytes, duration_ms: int) -> AvatarChunk:
        if not self.enabled:
            return AvatarChunk(audio_wav=audio_wav, duration_ms=duration_ms, mock=True)
        try:
            return self._animate_remote(audio_wav, duration_ms)
        except Exception as exc:
            if not config.AVATAR_FALLBACK_MOCK:
                raise
            log.warning("MuseTalk-Sidecar nicht erreichbar (%s) → Mock-Frames für diesen Satz.", exc)
            return AvatarChunk(audio_wav=audio_wav, duration_ms=duration_ms, mock=True)

    def _animate_remote(self, audio_wav: bytes, duration_ms: int) -> AvatarChunk:
        import httpx

        with httpx.Client(timeout=config.AVATAR_TIMEOUT_S, transport=self._transport) as client:
            resp = client.post(f"{config.AVATAR_URL}/animate", files={"audio": ("sentence.wav", audio_wav, "audio/wav")})
            resp.raise_for_status()
            data = resp.json()
        frames = [base64.b64decode(f) for f in data.get("frames", [])]
        return AvatarChunk(
            audio_wav=audio_wav, frames=frames, fps=int(data.get("fps", 25)),
            duration_ms=int(data.get("duration_ms", duration_ms)), mock=False,
        )
