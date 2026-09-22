import asyncio
import base64
import types

import numpy as np
import pytest

from server.audio import float32_to_pcm16_bytes, wav_info
from server.avatar import Avatar
from server.pipeline import Session
from server.stt import SpeechToText, VadSegmenter
from server.tts import MockTTS
from tests.test_stt import FakeVad, _tone


def _run(coro):
    return asyncio.run(coro)


def test_text_turn_streams_sentences_audio_and_metrics(sent):
    async def go():
        s = Session(sent, tts=MockTTS(), avatar=Avatar(), simulate_playback=False)
        await s.on_user_text("Ich habe eine Kündigung erhalten.")
        await s._task
        return s

    s = _run(go())
    types_ = [m["type"] for m in sent.msgs]
    assert types_[0] == "state" and sent.msgs[0]["state"] == "thinking"
    assert types_.count("sentence") >= 3
    assert types_.count("audio") == types_.count("sentence")
    # Reihenfolge: jeder Satz wird sofort gesprochen (pipelined), nicht erst am Ende
    first_sentence = types_.index("sentence")
    assert types_[first_sentence + 1] == "audio"
    audio = next(m for m in sent.msgs if m["type"] == "audio")
    assert audio["avatar_mock"] is True and audio["frames"] == [] and audio["tts"] == "mock"
    assert wav_info(base64.b64decode(audio["wav_b64"])).duration_ms == audio["duration_ms"]
    metrics = next(m for m in sent.msgs if m["type"] == "metrics")
    assert metrics["ttft_ms"] is not None and metrics["first_audio_ms"] >= metrics["first_sentence_ms"] >= metrics["ttft_ms"]
    assert sent.msgs[-1] == {"type": "state", "state": "idle"}
    assert s.history[-1]["role"] == "assistant" and "Grüezi" in s.history[-1]["content"]


def test_barge_in_cancels_running_turn(sent):
    async def go():
        s = Session(sent, tts=MockTTS(), avatar=Avatar(), simulate_playback=True)
        await s.on_user_text("Hallo")
        await asyncio.sleep(0.4)  # erster Satz ist unterwegs / wird „gesprochen"
        await s.barge_in()
        return s

    s = _run(go())
    assert sent.msgs[-1] == {"type": "state", "state": "interrupted"}
    assert not any(m["type"] == "metrics" for m in sent.msgs)  # Runde nicht beendet
    assert s._task.cancelled() or s._task.done()


def test_language_follows_transcript_and_lang_message(sent):
    async def go():
        s = Session(sent, tts=MockTTS(), avatar=Avatar(), simulate_playback=False)
        s.set_lang("fr")
        await s.on_user_text("Bonjour")
        await s._task
        return s

    s = _run(go())
    assert s.lang == "fr"
    assert any("Bonjour" in m.get("text", "") for m in sent.msgs if m["type"] == "sentence")


def test_audio_turn_vad_stt_llm_tts_end_to_end(sent):
    """Audio rein (PCM16) → VAD → STT (Fake) → LLM (Mock) → TTS (Mock) → Audio raus."""

    class FakeModel:
        def transcribe(self, audio, **kw):
            return iter([types.SimpleNamespace(text="Ich brauche einen Termin.")]), types.SimpleNamespace(language="de")

    async def go():
        s = Session(sent, tts=MockTTS(), avatar=Avatar(), stt=SpeechToText(model=FakeModel()),
                    vad=VadSegmenter(model=FakeVad(), pad_ms=100), simulate_playback=False)
        audio = np.concatenate([np.zeros(8000, np.float32), _tone(0.8), np.zeros(16000, np.float32)])
        for i in range(0, len(audio), 2048):
            await s.on_audio(float32_to_pcm16_bytes(audio[i:i + 2048]))
        if s._task:
            await s._task
        return s

    s = _run(go())
    kinds = [m["type"] for m in sent.msgs]
    assert kinds[0] == "state" and sent.msgs[0]["state"] == "listening"
    tr = next(m for m in sent.msgs if m["type"] == "transcript")
    assert tr["text"] == "Ich brauche einen Termin." and tr["lang"] == "de"
    assert s.history[0] == {"role": "user", "content": "Ich brauche einen Termin."}
    assert kinds.count("audio") >= 1
    metrics = next(m for m in sent.msgs if m["type"] == "metrics")
    assert metrics["stt_ms"] is not None


def test_audio_without_stt_reports_error(sent):
    async def go():
        s = Session(sent, tts=MockTTS(), avatar=Avatar(), simulate_playback=False)
        await s.on_audio(b"\x00\x00" * 512)

    _run(go())
    assert sent.msgs[-1]["type"] == "error"


def test_speech_start_while_speaking_triggers_barge_in(sent):
    class FakeModel:
        def transcribe(self, audio, **kw):
            return iter([types.SimpleNamespace(text="Hallo")]), types.SimpleNamespace(language="de")

    async def go():
        s = Session(sent, tts=MockTTS(), avatar=Avatar(), stt=SpeechToText(model=FakeModel()),
                    vad=VadSegmenter(model=FakeVad(), pad_ms=0), simulate_playback=True)
        await s.on_user_text("Hallo")
        await asyncio.sleep(0.4)
        assert s.speaking
        await s.on_audio(float32_to_pcm16_bytes(_tone(0.1)))  # Nutzer beginnt zu sprechen
        return s

    s = _run(go())
    assert any(m == {"type": "state", "state": "interrupted"} for m in sent.msgs)
    assert not s.speaking
