import types

import numpy as np
import pytest

from server.audio import float32_to_pcm16_bytes
from server.stt import SpeechToText, Transcript, VadSegmenter
from tests.conftest import VOICES, has_module, has_voices


class FakeVad:
    """Deterministischer VAD-Ersatz: Sprache = Fenster-RMS über Schwelle."""

    def __init__(self):
        self.speaking = False
        self.silent = 0

    def __call__(self, win):
        loud = float(np.sqrt(np.mean(win ** 2))) > 0.05
        if loud and not self.speaking:
            self.speaking = True
            self.silent = 0
            return {"start": 0}
        if not loud and self.speaking:
            self.silent += 1
            if self.silent >= 10:  # ~320 ms Stille
                self.speaking = False
                return {"end": 0}
        return None

    def reset_states(self):
        self.speaking = False


def _tone(seconds, rate=16000, amp=0.3):
    t = np.arange(int(seconds * rate)) / rate
    return (amp * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def test_vad_segmenter_emits_start_and_end_with_fake_model():
    vad = VadSegmenter(model=FakeVad(), pad_ms=100)
    audio = np.concatenate([np.zeros(16000, np.float32), _tone(1.0), np.zeros(16000, np.float32)])
    events = []
    # in ungleichen Chunks füttern (wie vom Browser)
    for i in range(0, len(audio), 1234):
        events += list(vad.feed(float32_to_pcm16_bytes(audio[i:i + 1234])))
    kinds = [e.kind for e in events]
    assert kinds == ["speech_start", "speech_end"]
    end = events[1]
    assert 1000 <= end.duration_ms <= 1600  # Utterance + Vorlauf + Stille bis End-of-Turn
    assert not vad.in_speech


def test_vad_forces_end_on_max_utterance():
    class AlwaysOn(FakeVad):
        def __call__(self, win):
            if not self.speaking:
                self.speaking = True
                return {"start": 0}
            return None

    vad = VadSegmenter(model=AlwaysOn(), max_utterance_s=1.0, pad_ms=0)
    events = list(vad.feed(float32_to_pcm16_bytes(_tone(3.0))))
    assert [e.kind for e in events][:2] == ["speech_start", "speech_end"]
    assert 950 <= events[1].duration_ms <= 1100


@pytest.mark.skipif(not has_module("silero_vad"), reason="silero-vad nicht installiert")
def test_silero_vad_real_silence_yields_no_events():
    vad = VadSegmenter()
    events = list(vad.feed(float32_to_pcm16_bytes(np.zeros(16000 * 2, np.float32))))
    assert events == []


@pytest.mark.skipif(not (has_module("silero_vad") and has_module("piper") and has_voices()),
                    reason="silero-vad + Piper-Stimmen nötig")
def test_silero_vad_real_detects_piper_speech():
    """Echtes Sprachsignal (Piper) → Silero erkennt Sprechbeginn/-ende."""
    from server.audio import pcm16_bytes_to_float32, resample_linear
    from server.audio import wav_info
    from server.tts import PiperTTS

    wav = PiperTTS(voices_dir=str(VOICES), fallback_mock=False).synthesize("Guten Tag, ich möchte einen Termin vereinbaren.", "de")
    info = wav_info(wav)
    speech = resample_linear(pcm16_bytes_to_float32(wav[44:]), info.rate, 16000)
    audio = np.concatenate([np.zeros(16000, np.float32), speech, np.zeros(16000, np.float32)])
    vad = VadSegmenter(min_silence_ms=600)
    events = list(vad.feed(float32_to_pcm16_bytes(audio)))
    kinds = [e.kind for e in events]
    assert kinds[0] == "speech_start"
    assert "speech_end" in kinds
    end = next(e for e in events if e.kind == "speech_end")
    assert end.duration_ms >= 1500


def test_stt_with_fake_model_joins_segments_and_maps_language():
    class FakeModel:
        def transcribe(self, audio, **kw):
            seg = lambda t: types.SimpleNamespace(text=t)  # noqa: E731
            return iter([seg(" Guten Tag, "), seg("ich brauche Hilfe.")]), types.SimpleNamespace(language="de")

    stt = SpeechToText(model=FakeModel())
    tr = stt.transcribe(np.zeros(16000, np.float32))
    assert isinstance(tr, Transcript)
    assert tr.text == "Guten Tag, ich brauche Hilfe."
    assert tr.lang == "de"
    assert tr.duration_ms == 1000

    class EnglishModel(FakeModel):
        def transcribe(self, audio, **kw):
            return iter([types.SimpleNamespace(text="Hello")]), types.SimpleNamespace(language="en")

    assert SpeechToText(model=EnglishModel()).transcribe(np.zeros(1600, np.float32)).lang == "de"  # Fallback auf DEFAULT_LANG
