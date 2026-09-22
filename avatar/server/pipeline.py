"""Echtzeit-Orchestrierung einer Gesprächsrunde mit Barge-in.

Pro Session: (Audio → VAD → Whisper) → Hermes-Token-Stream → Satz-Splitter → TTS je Satz
→ MuseTalk → Client. Die Stufen laufen gepipelinet: sobald der erste Satz fertig ist,
wird er gesprochen, während das LLM weiterschreibt (niedrige Time-to-first-audio).

Barge-in: Spricht die nutzende Person (VAD speech_start oder explizites Signal),
während der Avatar spricht, wird die laufende Runde (`_task`) gecancelt — LLM-Stream,
TTS-Queue und Avatar brechen sofort ab.

Latenz-Messung (§10 des Avatar-Docs): pro Runde werden Zeitmarken gesammelt und als
`{"type": "metrics"}` an den Client geschickt (stt_ms, ttft_ms, first_sentence_ms,
first_audio_ms, total_ms).
"""
from __future__ import annotations

import asyncio
import base64
import logging
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from . import llm, segmenter
from .audio import wav_info
from .avatar import Avatar
from .config import config
from .stt import SpeechToText, VadSegmenter
from .tts import make_tts

log = logging.getLogger("advoos.pipeline")

Send = Callable[[dict], Awaitable[None]]


@dataclass
class TurnMetrics:
    t0: float = field(default_factory=time.perf_counter)  # Sprechende / Texteingang
    stt_ms: int | None = None
    ttft_ms: int | None = None
    first_sentence_ms: int | None = None
    first_audio_ms: int | None = None
    total_ms: int | None = None
    sentences: int = 0

    def ms(self) -> int:
        return int((time.perf_counter() - self.t0) * 1000)

    def as_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if k != "t0"}


class Session:
    def __init__(self, send: Send, *, tts=None, avatar: Avatar | None = None,
                 stt: SpeechToText | None = None, vad: VadSegmenter | None = None,
                 simulate_playback: bool = True) -> None:
        self._send = send
        self._tts = tts or make_tts()
        self._avatar = avatar or Avatar()
        self._stt = stt
        self._vad = vad
        if config.STT_ENABLED and self._stt is None:
            self._stt = SpeechToText()
        if config.STT_ENABLED and self._vad is None:
            self._vad = VadSegmenter()
        self._simulate_playback = simulate_playback
        self.lang = config.DEFAULT_LANG
        self.history: list[dict] = []
        self._task: asyncio.Task | None = None
        self.speaking = False

    # -- Status -------------------------------------------------------------

    def modes(self) -> dict:
        return {
            "llm": "vllm" if config.LLM_BASE_URL else "mock",
            "tts": getattr(self._tts, "name", "mock"),
            "stt": "faster-whisper" if self._stt else "mock",
            "avatar": self._avatar.mode,
            "lang": self.lang,
        }

    # -- Eingaben -----------------------------------------------------------

    async def on_user_text(self, text: str, metrics: TurnMetrics | None = None) -> None:
        """Neue Nutzereingabe → laufende Runde abbrechen (Barge-in), neue Runde starten."""
        await self.barge_in()
        self.history.append({"role": "user", "content": text})
        self._task = asyncio.create_task(self._run_turn(metrics or TurnMetrics()))

    async def on_audio(self, pcm16: bytes) -> None:
        """Binärer Audio-Chunk (PCM16 mono 16 kHz) vom Client → VAD → ggf. STT."""
        if self._vad is None or self._stt is None:
            await self._send({"type": "error", "message": "STT ist nicht aktiviert (STT_ENABLED=false) — bitte Text senden."})
            return
        for ev in self._vad.feed(pcm16):
            if ev.kind == "speech_start":
                await self._send({"type": "state", "state": "listening"})
                if self.speaking:
                    await self.barge_in()
            elif ev.kind == "speech_end":
                if ev.duration_ms < 250:
                    continue  # Klicks/Atmer ignorieren
                metrics = TurnMetrics()
                await self._send({"type": "state", "state": "transcribing"})
                tr = await asyncio.to_thread(self._stt.transcribe, ev.samples, None)
                metrics.stt_ms = tr.latency_ms
                if not tr.text:
                    await self._send({"type": "state", "state": "idle"})
                    continue
                self.lang = tr.lang
                await self._send({"type": "transcript", "text": tr.text, "lang": tr.lang, "stt_ms": tr.latency_ms})
                await self.on_user_text(tr.text, metrics)

    def set_lang(self, lang: str) -> None:
        if lang in config.SUPPORTED_LANGS:
            self.lang = lang

    async def close(self) -> None:
        """Session beenden (Verbindung weg): laufende Runde still abbrechen."""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        self.speaking = False

    async def barge_in(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self.speaking = False
            await self._send({"type": "state", "state": "interrupted"})

    # -- Runde --------------------------------------------------------------

    async def _run_turn(self, m: TurnMetrics) -> None:
        try:
            await self._send({"type": "state", "state": "thinking"})
            full = ""
            token_stream = self._timed_tokens(llm.stream_reply(self.history, self.lang), m)
            async for sentence in segmenter.sentences(token_stream):
                if m.first_sentence_ms is None:
                    m.first_sentence_ms = m.ms()
                m.sentences += 1
                full += sentence + " "
                await self._send({"type": "sentence", "text": sentence})
                await self._speak(sentence, m)
            self.history.append({"role": "assistant", "content": full.strip()})
            m.total_ms = m.ms()
            await self._send({"type": "metrics", **m.as_dict()})
            await self._send({"type": "state", "state": "idle"})
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # Demo-Robustheit
            log.exception("Runde fehlgeschlagen")
            await self._send({"type": "error", "message": str(exc)})
            await self._send({"type": "state", "state": "idle"})
        finally:
            self.speaking = False

    @staticmethod
    async def _timed_tokens(tokens, m: TurnMetrics):
        async for tok in tokens:
            if m.ttft_ms is None:
                m.ttft_ms = m.ms()
            yield tok

    async def _speak(self, sentence: str, m: TurnMetrics) -> None:
        # TTS + Avatar sind CPU/GPU-lastig → im Threadpool, damit der Event-Loop frei bleibt.
        wav = await asyncio.to_thread(self._tts.synthesize, sentence, self.lang)
        info = wav_info(wav)
        dur = info.duration_ms
        chunk = await asyncio.to_thread(self._avatar.animate, wav, dur)
        if m.first_audio_ms is None:
            m.first_audio_ms = m.ms()
        self.speaking = True
        await self._send({
            "type": "audio",
            "wav_b64": base64.b64encode(chunk.audio_wav).decode("ascii"),
            "sample_rate": info.rate,
            "duration_ms": chunk.duration_ms,
            "fps": chunk.fps,
            "frames": [base64.b64encode(f).decode("ascii") for f in chunk.frames],
            "tts": getattr(self._tts, "name", "mock"),
            "avatar_mock": chunk.mock,
        })
        # Warten, bis der Satz „gesprochen" ist, damit Barge-in sauber greift und die
        # Sätze nicht überlappen (Phase 3/WebRTC: Playback-Feedback statt Timer).
        if self._simulate_playback:
            await asyncio.sleep(dur / 1000)
