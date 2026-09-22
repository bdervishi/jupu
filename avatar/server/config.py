"""Zentrale Konfiguration (aus Umgebungsvariablen).

Ohne gesetzte Modelle/Endpunkte läuft alles im MOCK-Modus: die Pipeline
funktioniert end-to-end (Streaming, Segmentierung, Barge-in), ohne dass GPU
oder Modellgewichte vorhanden sein müssen. Jede Stufe lässt sich einzeln auf
„echt" schalten — so wird Phase 2 Stück für Stück real:

  LLM    LLM_BASE_URL=http://vllm:8000/v1            (Hermes via vLLM, GPU)
  TTS    TTS_ENGINE=piper PIPER_VOICES_DIR=./voices  (CPU reicht)
  STT    STT_ENABLED=true STT_MODEL=small            (CPU ok, GPU schneller)
  Avatar AVATAR_URL=http://musetalk:8090             (MuseTalk-Sidecar, GPU)
"""
from __future__ import annotations

import os


def _flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    # --- LLM (Hermes über vLLM, OpenAI-kompatibel) ---
    # Leer => Mock-LLM (kanned Stream). Sonst echter /chat/completions-Stream.
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "").rstrip("/")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "NousResearch/Hermes-3-Llama-3.1-8B")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.4"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "300"))
    LLM_TIMEOUT_S: float = float(os.getenv("LLM_TIMEOUT_S", "60"))

    # --- STT (faster-whisper + Silero VAD) ---
    STT_ENABLED: bool = _flag("STT_ENABLED", False)  # False => Mock (Client schickt Text)
    STT_MODEL: str = os.getenv("STT_MODEL", "small")  # Name (HF-Download) oder lokaler Pfad
    STT_DEVICE: str = os.getenv("STT_DEVICE", "auto")  # "cuda" | "cpu" | "auto"
    STT_COMPUTE_TYPE: str = os.getenv("STT_COMPUTE_TYPE", "default")  # z. B. float16 (GPU), int8 (CPU)
    STT_LANGUAGE: str = os.getenv("STT_LANGUAGE", "")  # leer = Autoerkennung (DE/FR/IT)
    STT_BEAM_SIZE: int = int(os.getenv("STT_BEAM_SIZE", "1"))  # 1 = schnellste Dekodierung
    VAD_THRESHOLD: float = float(os.getenv("VAD_THRESHOLD", "0.5"))
    VAD_MIN_SILENCE_MS: int = int(os.getenv("VAD_MIN_SILENCE_MS", "400"))  # End-of-Turn
    VAD_SPEECH_PAD_MS: int = int(os.getenv("VAD_SPEECH_PAD_MS", "200"))
    VAD_MAX_UTTERANCE_S: float = float(os.getenv("VAD_MAX_UTTERANCE_S", "30"))
    AUDIO_IN_RATE: int = 16000  # Client → Server: PCM16 mono 16 kHz (Whisper/Silero-nativ)

    # --- TTS (pluggable: piper | kokoro | mock) ---
    # Piper ist Standard für DE/FR/IT (Kokoro kann kein Deutsch).
    TTS_ENGINE: str = os.getenv("TTS_ENGINE", "mock")  # "piper" | "kokoro" | "mock"
    PIPER_VOICES_DIR: str = os.getenv("PIPER_VOICES_DIR", "voices")
    TTS_VOICE_DE: str = os.getenv("TTS_VOICE_DE", "de_DE-thorsten-medium")
    TTS_VOICE_FR: str = os.getenv("TTS_VOICE_FR", "fr_FR-siwis-medium")
    TTS_VOICE_IT: str = os.getenv("TTS_VOICE_IT", "it_IT-riccardo-x_low")
    TTS_LENGTH_SCALE: float = float(os.getenv("TTS_LENGTH_SCALE", "1.0"))  # <1 schneller, >1 langsamer
    TTS_FALLBACK_MOCK: bool = _flag("TTS_FALLBACK_MOCK", True)  # fehlende Stimme → Mock statt Absturz
    TTS_PRELOAD: bool = _flag("TTS_PRELOAD", True)  # Stimmen beim Start laden (erstes Audio ~1 s früher)
    TTS_SAMPLE_RATE: int = int(os.getenv("TTS_SAMPLE_RATE", "22050"))  # nur für Mock; Piper liefert die eigene Rate

    # --- Avatar (MuseTalk-Sidecar, GPU) ---
    AVATAR_ENABLED: bool = _flag("AVATAR_ENABLED", False)  # False => Mock (keine Frames)
    AVATAR_URL: str = os.getenv("AVATAR_URL", "").rstrip("/")  # z. B. http://musetalk:8090
    AVATAR_TIMEOUT_S: float = float(os.getenv("AVATAR_TIMEOUT_S", "20"))
    AVATAR_FALLBACK_MOCK: bool = _flag("AVATAR_FALLBACK_MOCK", True)

    # --- Server ---
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))
    DEFAULT_LANG: str = os.getenv("DEFAULT_LANG", "de")
    SUPPORTED_LANGS: tuple[str, ...] = ("de", "fr", "it")


config = Config()
