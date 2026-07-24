"""Echtzeit-Orchestrierung einer Gesprächsrunde mit Barge-in.

Pro Session: Hermes-Token-Stream → Satz-Splitter → TTS je Satz → MuseTalk → Client.
Die Stufen laufen gepipelinet: sobald der erste Satz fertig ist, wird er gesprochen,
während das LLM weiterschreibt (niedrige Time-to-first-audio).

Barge-in: Spricht die nutzende Person, während der Avatar spricht, wird die laufende
Runde (`_task`) gecancelt — LLM-Stream, TTS-Queue und Avatar brechen sofort ab.
"""
from __future__ import annotations

import asyncio
import base64
from typing import Awaitable, Callable

from . import llm, segmenter
from .avatar import Avatar
from .config import config
from .tts import make_tts

Send = Callable[[dict], Awaitable[None]]


def _wav_duration_ms(wav: bytes, rate: int) -> int:
    pcm = max(0, len(wav) - 44)  # 44-Byte WAV-Header
    return int(pcm / 2 / rate * 1000)


class Session:
    def __init__(self, send: Send) -> None:
        self._send = send
        self._tts = make_tts()
        self._avatar = Avatar()
        self.history: list[dict] = []
        self._task: asyncio.Task | None = None

    async def on_user_text(self, text: str) -> None:
        """Neue Nutzereingabe → laufende Runde abbrechen (Barge-in), neue Runde starten."""
        await self.barge_in()
        self.history.append({"role": "user", "content": text})
        self._task = asyncio.create_task(self._run_turn())

    async def barge_in(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            await self._send({"type": "state", "state": "interrupted"})

    async def _run_turn(self) -> None:
        try:
            await self._send({"type": "state", "state": "thinking"})
            full = ""
            token_stream = llm.stream_reply(self.history)
            async for sentence in segmenter.sentences(token_stream):
                full += sentence + " "
                await self._send({"type": "sentence", "text": sentence})
                await self._speak(sentence)
            self.history.append({"role": "assistant", "content": full.strip()})
            await self._send({"type": "state", "state": "idle"})
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # Demo-Robustheit
            await self._send({"type": "error", "message": str(exc)})

    async def _speak(self, sentence: str) -> None:
        lang = config.DEFAULT_LANG
        # TTS + Avatar sind CPU/GPU-lastig → im Threadpool, damit der Event-Loop frei bleibt.
        wav = await asyncio.to_thread(self._tts.synthesize, sentence, lang)
        dur = _wav_duration_ms(wav, config.TTS_SAMPLE_RATE)
        chunk = await asyncio.to_thread(self._avatar.animate, wav, dur)
        await self._send({
            "type": "audio",
            "wav_b64": base64.b64encode(chunk.audio_wav).decode("ascii"),
            "duration_ms": chunk.duration_ms,
            "frames": len(chunk.frames),
            "mock": chunk.mock,
        })
        # Warten, bis der Satz „gesprochen" ist (im Mock: simuliert), damit Barge-in
        # sauber greifen kann und die Sätze nicht überlappen.
        await asyncio.sleep(dur / 1000)
