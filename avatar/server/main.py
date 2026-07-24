"""FastAPI Media-Server: WebSocket-Signalisierung + statischer Client.

Phase-1-Transport = WebSocket (einfach). Für Produktion → WebRTC (aiortc), siehe
docs/live-avatar-sekretaerin.md §5.

WS-Protokoll (Client → Server):
  {"type": "text", "text": "..."}   # Nutzereingabe (Mock-STT: Text direkt)
  {"type": "barge_in"}               # Nutzer unterbricht den Avatar
WS-Protokoll (Server → Client):
  {"type": "state", "state": "thinking|idle|interrupted"}
  {"type": "sentence", "text": "..."}
  {"type": "audio", "wav_b64": "...", "duration_ms": N, "frames": N, "mock": bool}
  {"type": "error", "message": "..."}
"""
from __future__ import annotations

import pathlib

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import config
from .pipeline import Session

app = FastAPI(title="AdvoOS Avatar-Sekretärin")

_CLIENT_DIR = pathlib.Path(__file__).resolve().parent.parent / "client"


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(_CLIENT_DIR / "index.html")


@app.websocket("/ws")
async def ws(sock: WebSocket) -> None:
    await sock.accept()

    async def send(msg: dict) -> None:
        await sock.send_json(msg)

    session = Session(send)
    await send({"type": "state", "state": "idle"})
    try:
        while True:
            msg = await sock.receive_json()
            kind = msg.get("type")
            if kind == "text" and msg.get("text"):
                await session.on_user_text(msg["text"].strip())
            elif kind == "barge_in":
                await session.barge_in()
    except WebSocketDisconnect:
        await session.barge_in()


if _CLIENT_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_CLIENT_DIR)), name="static")


def main() -> None:
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)


if __name__ == "__main__":
    main()
