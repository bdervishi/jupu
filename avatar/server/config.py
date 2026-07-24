"""Zentrale Konfiguration (aus Umgebungsvariablen).

Ohne gesetzte Modelle/Endpunkte läuft alles im MOCK-Modus: die Pipeline
funktioniert end-to-end (Streaming, Segmentierung, Barge-in), ohne dass GPU
oder Modellgewichte vorhanden sein müssen. So lässt sich die Orchestrierung
lokal testen und Stück für Stück durch echte Modelle ersetzen.
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

    # --- STT (faster-whisper) ---
    STT_ENABLED: bool = _flag("STT_ENABLED", False)  # False => Mock (Client schickt Text)
    STT_MODEL: str = os.getenv("STT_MODEL", "medium")
    STT_DEVICE: str = os.getenv("STT_DEVICE", "cuda")

    # --- TTS (pluggable: piper | kokoro | mock) ---
    # Piper ist Standard für DE/FR/IT (Kokoro kann kein Deutsch).
    TTS_ENGINE: str = os.getenv("TTS_ENGINE", "mock")  # "piper" | "kokoro" | "mock"
    TTS_VOICE_DE: str = os.getenv("TTS_VOICE_DE", "de_DE-thorsten-high")
    TTS_VOICE_FR: str = os.getenv("TTS_VOICE_FR", "fr_FR-siwis-medium")
    TTS_VOICE_IT: str = os.getenv("TTS_VOICE_IT", "it_IT-riccardo-x_low")
    TTS_SAMPLE_RATE: int = int(os.getenv("TTS_SAMPLE_RATE", "22050"))

    # --- Avatar (MuseTalk) ---
    AVATAR_ENABLED: bool = _flag("AVATAR_ENABLED", False)  # False => Mock (keine Frames)
    AVATAR_REFERENCE: str = os.getenv("AVATAR_REFERENCE", "assets/sekretaerin_idle.mp4")

    # --- Server ---
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))
    DEFAULT_LANG: str = os.getenv("DEFAULT_LANG", "de")


config = Config()
