"""Avatar-Layer: MuseTalk (audio-getriebener Lip-Sync).

MuseTalk hält ein vorbereitetes Idle-/Referenz-Video im Speicher und rendert nur
den Mundbereich passend zum TTS-Audio neu (~30 fps auf GPU). Eingabe: Audio-Chunk
eines Satzes → Ausgabe: Videoframes (die im Produktivbetrieb als WebRTC-Track
kodiert werden).

MOCK-Modus (AVATAR_ENABLED=false): liefert keine echten Frames, sondern nur
Timing-Metadaten, damit der Client Audio abspielen und den Idle-Avatar zeigen kann.
"""
from __future__ import annotations

from dataclasses import dataclass

from .config import config


@dataclass
class AvatarChunk:
    audio_wav: bytes
    frames: list[bytes]      # JPEG-Frames (leer im Mock-Modus)
    duration_ms: int
    mock: bool


class Avatar:
    def __init__(self) -> None:
        self._model = None
        if config.AVATAR_ENABLED:
            self._load()

    def _load(self) -> None:
        # TODO(real): MuseTalk laden + Referenzvideo vorbereiten (Face-Detection,
        # Latent-Cache des Idle-Loops), damit zur Laufzeit nur der Mund inpaintet wird.
        raise NotImplementedError(
            "AVATAR_ENABLED=true erfordert MuseTalk + Referenzvideo (siehe README)."
        )

    def animate(self, audio_wav: bytes, duration_ms: int) -> AvatarChunk:
        if not config.AVATAR_ENABLED:
            # Mock: Client spielt nur das Audio ab, Avatar bleibt im Idle-Loop.
            return AvatarChunk(audio_wav=audio_wav, frames=[], duration_ms=duration_ms, mock=True)
        # TODO(real):
        #   frames = musetalk.infer(audio_wav)  # Liste BGR/JPEG-Frames @ ~30fps
        #   return AvatarChunk(audio_wav, frames, duration_ms, mock=False)
        raise NotImplementedError
