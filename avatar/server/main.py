"""FastAPI Media-Server: WebSocket-Signalisierung + statischer Client.

Phase-2-Transport = WebSocket (Text + binäre Audio-Frames). Für Produktion → WebRTC
(aiortc), siehe docs/live-avatar-sekretaerin.md §5.

WS-Protokoll (Client → Server):
  <binär>                                    # PCM16 mono 16 kHz (nur mit STT_ENABLED=true)
  {"type": "text", "text": "..."}            # Nutzereingabe als Text (Mock-STT)
  {"type": "lang", "lang": "de|fr|it"}       # Antwort-/TTS-Sprache setzen
  {"type": "barge_in"}                       # Nutzer unterbricht den Avatar
WS-Protokoll (Server → Client):
  {"type": "hello", "modes": {...}}          # welche Stufen echt/mock sind
  {"type": "state", "state": "idle|listening|transcribing|thinking|interrupted"}
  {"type": "transcript", "text": "...", "lang": "de", "stt_ms": N}
  {"type": "sentence", "text": "..."}
  {"type": "audio", "wav_b64": "...", "sample_rate": N, "duration_ms": N, "fps": N,
                    "frames": ["<b64 jpeg>", ...], "tts": "piper|mock", "avatar_mock": bool}
  {"type": "metrics", "stt_ms": N, "ttft_ms": N, "first_sentence_ms": N, "first_audio_ms": N, "total_ms": N}
  {"type": "error", "message": "..."}
"""
from __future__ import annotations

import json
import logging
import pathlib

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import config
from .pipeline import Session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="AdvoOS Avatar-Sekretärin")

_CLIENT_DIR = pathlib.Path(__file__).resolve().parent.parent / "client"


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(_CLIENT_DIR / "index.html")


@app.get("/health")
async def health() -> dict:
    """Zeigt, welche Stufen echt laufen — hilfreich beim schrittweisen Umstellen."""
    return {
        "status": "ok",
        "llm": {"mode": "vllm" if config.LLM_BASE_URL else "mock", "model": config.LLM_MODEL if config.LLM_BASE_URL else None},
        "tts": {"engine": config.TTS_ENGINE, "voices_dir": config.PIPER_VOICES_DIR if config.TTS_ENGINE == "piper" else None},
        "stt": {"enabled": config.STT_ENABLED, "model": config.STT_MODEL if config.STT_ENABLED else None},
        "avatar": {"enabled": bool(config.AVATAR_ENABLED and config.AVATAR_URL), "url": config.AVATAR_URL or None},
    }


@app.websocket("/ws")
async def ws(sock: WebSocket) -> None:
    await sock.accept()

    async def send(msg: dict) -> None:
        await sock.send_json(msg)

    session = Session(send)
    await send({"type": "hello", "modes": session.modes()})
    await send({"type": "state", "state": "idle"})
    try:
        while True:
            frame = await sock.receive()
            if frame.get("type") == "websocket.disconnect":
                break
            if frame.get("bytes"):
                await session.on_audio(frame["bytes"])
                continue
            text = frame.get("text")
            if not text:
                continue
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                await send({"type": "error", "message": "Ungültiges JSON."})
                continue
            kind = msg.get("type")
            if kind == "text" and msg.get("text"):
                await session.on_user_text(msg["text"].strip())
            elif kind == "lang":
                session.set_lang(str(msg.get("lang", "")))
            elif kind == "barge_in":
                await session.barge_in()
    except WebSocketDisconnect:
        pass
    finally:
        await session.close()


if _CLIENT_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_CLIENT_DIR)), name="static")


def main() -> None:
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)


if __name__ == "__main__":
    main()
