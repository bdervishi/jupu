import pytest

from server.audio import wav_info
from server.tts import MockTTS, PiperTTS, make_tts
from tests.conftest import VOICES, has_module, has_voices


def test_mock_tts_returns_silence_of_plausible_length():
    wav = MockTTS().synthesize("Grüezi, wie kann ich Ihnen helfen?", "de")
    info = wav_info(wav)
    assert info.rate > 0 and info.channels == 1
    assert 400 <= info.duration_ms <= 6000


def test_make_tts_defaults_to_mock():
    assert make_tts().name in {"mock", "piper"}


@pytest.mark.skipif(not has_module("piper"), reason="piper-tts nicht installiert")
def test_piper_falls_back_to_mock_when_voice_missing(tmp_path):
    tts = PiperTTS(voices_dir=str(tmp_path), fallback_mock=True)
    assert tts.available_langs() == []
    wav = tts.synthesize("Test", "de")
    assert wav_info(wav).duration_ms > 0  # Mock-Stille statt Absturz


@pytest.mark.skipif(not has_module("piper"), reason="piper-tts nicht installiert")
def test_piper_raises_without_fallback(tmp_path):
    tts = PiperTTS(voices_dir=str(tmp_path), fallback_mock=False)
    with pytest.raises(RuntimeError):
        tts.synthesize("Test", "de")


@pytest.mark.skipif(not (has_module("piper") and has_voices()), reason="Piper-Stimmen fehlen (scripts/download-voices.sh)")
@pytest.mark.parametrize("lang,text", [
    ("de", "Grüezi, ich bin die digitale Sekretärin der Kanzlei."),
    ("fr", "Bonjour, je suis la secrétaire numérique de l’étude."),
    ("it", "Buongiorno, sono la segretaria digitale dello studio."),
])
def test_piper_synthesizes_real_speech(lang, text):
    import time

    tts = PiperTTS(voices_dir=str(VOICES), fallback_mock=False)
    assert lang in tts.available_langs()
    t0 = time.perf_counter()
    wav = tts.synthesize(text, lang)
    elapsed = time.perf_counter() - t0
    info = wav_info(wav)
    assert info.rate in (16000, 22050)
    assert 1000 < info.duration_ms < 8000
    # kein reines Schweigen: Amplitude vorhanden
    import numpy as np

    pcm = np.frombuffer(wav[44:], dtype=np.int16)
    assert np.abs(pcm).max() > 1000
    assert elapsed < 5.0, f"Piper zu langsam: {elapsed:.2f}s"
