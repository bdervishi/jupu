"""MuseTalk-Sidecar: HTTP-Dienst für audio-getriebenen Lip-Sync (GPU).

Kapselt das MuseTalk-Repo (https://github.com/TMElyralab/MuseTalk, v1.5) hinter einer
schmalen API, damit der Media-Server (server/avatar.py) GPU-frei bleibt:

  GET  /health            → {"status": "ok", "ready": bool, "fps": 25}
  POST /animate           multipart `audio` (WAV, ein Satz)
                          → {"fps": 25, "duration_ms": N, "frames": ["<b64 jpeg>", ...]}

Start (auf dem GPU-Host, im MuseTalk-Repo-Verzeichnis mit installierten Gewichten):
  MUSETALK_REPO=/opt/MuseTalk AVATAR_REFERENCE=assets/sekretaerin_idle.mp4 \
    uvicorn server:app --host 0.0.0.0 --port 8090

Ohne GPU/MuseTalk läuft der Sidecar im Mock-Modus (MUSETALK_MOCK=true) und liefert
einfache Platzhalter-Frames — damit lässt sich die Frame-Übertragung bis in den
Browser prüfen, bevor die echte Inferenz steht.

Hinweis: Die MuseTalk-Anbindung unten folgt der Realtime-Inferenz des Repos
(scripts/realtime_inference.py: Avatar-Klasse mit vorbereiteten Latents pro Frame);
sie ist ohne GPU in dieser Umgebung nicht ausführbar und muss auf der Ziel-GPU
verifiziert werden (Phase-0-Spike laut docs/live-avatar-sekretaerin.md §9).
"""
from __future__ import annotations

import base64
import io
import logging
import os
import sys
import tempfile
import wave

from fastapi import FastAPI, File, UploadFile

log = logging.getLogger("advoos.musetalk")
logging.basicConfig(level=logging.INFO)

FPS = int(os.getenv("MUSETALK_FPS", "25"))
MOCK = os.getenv("MUSETALK_MOCK", "false").lower() in {"1", "true", "yes"}
REPO = os.getenv("MUSETALK_REPO", "/opt/MuseTalk")
REFERENCE = os.getenv("AVATAR_REFERENCE", "assets/sekretaerin_idle.mp4")
AVATAR_ID = os.getenv("AVATAR_ID", "sekretaerin")

app = FastAPI(title="AdvoOS MuseTalk-Sidecar")


def _wav_duration_ms(data: bytes) -> int:
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            return int(w.getnframes() / w.getframerate() * 1000)
    except (wave.Error, EOFError):
        return 0


class MockEngine:
    """Platzhalter-Frames (einfarbig, „Mundbewegung" als wechselnder Balken) ohne GPU."""

    ready = True

    def animate(self, wav: bytes) -> list[bytes]:
        try:
            from PIL import Image, ImageDraw
        except ImportError:  # pragma: no cover
            return []
        n = max(1, int(_wav_duration_ms(wav) / 1000 * FPS))
        frames = []
        for i in range(n):
            img = Image.new("RGB", (256, 256), (30, 41, 59))
            d = ImageDraw.Draw(img)
            open_px = 6 + int(10 * abs(((i % 8) - 4) / 4))
            d.ellipse((78, 60, 178, 160), fill=(226, 232, 240))
            d.rectangle((108, 130, 148, 130 + open_px), fill=(15, 23, 42))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=70)
            frames.append(buf.getvalue())
        return frames


class MuseTalkEngine:
    """Echte MuseTalk-Inferenz (GPU). Lädt Modelle + Referenz-Avatar einmalig beim Start."""

    def __init__(self) -> None:
        self.ready = False
        sys.path.insert(0, REPO)
        os.chdir(REPO)
        import torch  # noqa: F401
        from scripts.realtime_inference import Avatar, load_all_model  # MuseTalk v1.5

        # Modelle (VAE, UNet, Whisper-Audio-Encoder) laut MuseTalk-Repo laden.
        self.audio_processor, self.vae, self.unet, self.pe = load_all_model()
        # Avatar mit vorbereiteten Latents (Face-Crop + VAE-Encoding je Frame des Idle-Videos).
        self.avatar = Avatar(avatar_id=AVATAR_ID, video_path=REFERENCE, bbox_shift=0, batch_size=8, preparation=True)
        self.ready = True
        log.info("MuseTalk bereit (Avatar %s aus %s)", AVATAR_ID, REFERENCE)

    def animate(self, wav: bytes) -> list[bytes]:
        import cv2

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav)
            audio_path = f.name
        try:
            # Liefert BGR-Frames (numpy) im Takt von FPS; API-Name je MuseTalk-Version prüfen.
            frames_bgr = self.avatar.inference_frames(audio_path, fps=FPS)  # type: ignore[attr-defined]
        finally:
            os.unlink(audio_path)
        out = []
        for fr in frames_bgr:
            ok, buf = cv2.imencode(".jpg", fr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ok:
                out.append(buf.tobytes())
        return out


engine = MockEngine() if MOCK else None


@app.on_event("startup")
def _startup() -> None:
    global engine
    if engine is None:
        try:
            engine = MuseTalkEngine()
        except Exception as exc:  # pragma: no cover - GPU-Host
            log.error("MuseTalk konnte nicht geladen werden (%s) → Mock-Frames.", exc)
            engine = MockEngine()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "ready": bool(engine and engine.ready), "fps": FPS, "mock": isinstance(engine, MockEngine)}


@app.post("/animate")
async def animate(audio: UploadFile = File(...)) -> dict:
    wav = await audio.read()
    frames = engine.animate(wav) if engine else []
    return {
        "fps": FPS,
        "duration_ms": _wav_duration_ms(wav),
        "frames": [base64.b64encode(f).decode("ascii") for f in frames],
        "mock": isinstance(engine, MockEngine),
    }
