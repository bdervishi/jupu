"""LLM-Layer: Hermes über vLLM (OpenAI-kompatibel, Streaming).

Spiegelt bewusst das Proxy-Muster aus `advoos-mvp/api/_core.ts`: OpenAI-kompatibles
`/chat/completions` mit `stream: true`. Damit ist Hermes ein Drop-in — nur andere
`LLM_BASE_URL`/`LLM_MODEL`.

Ohne `LLM_BASE_URL` läuft ein Mock-Stream (kanned Antwort, Token für Token), damit
die Pipeline auch ohne laufenden vLLM-Server getestet werden kann.
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from .config import config

SYSTEM_PROMPT = (
    "Du bist die freundliche digitale Empfangs-Sekretärin einer Schweizer Anwaltskanzlei. "
    "Antworte kurz, natürlich und in der Sprache der nutzenden Person (DE/FR/IT). "
    "Weise früh darauf hin, keine streng vertraulichen Details preiszugeben, solange kein Mandat besteht."
)


async def stream_reply(history: list[dict]) -> AsyncIterator[str]:
    """Liefert die Antwort-Token als async Generator."""
    if not config.LLM_BASE_URL:
        async for tok in _mock_stream(history):
            yield tok
        return
    async for tok in _vllm_stream(history):
        yield tok


async def _vllm_stream(history: list[dict]) -> AsyncIterator[str]:
    import httpx  # lokal importiert, damit der Mock-Modus ohne httpx läuft

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history]
    payload = {
        "model": config.LLM_MODEL,
        "messages": messages,
        "temperature": config.LLM_TEMPERATURE,
        "stream": True,
    }
    headers = {"Content-Type": "application/json"}
    if config.LLM_API_KEY:
        headers["Authorization"] = f"Bearer {config.LLM_API_KEY}"

    url = f"{config.LLM_BASE_URL}/chat/completions"
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (KeyError, IndexError, json.JSONDecodeError):
                    continue
                if delta:
                    yield delta


async def _mock_stream(history: list[dict]) -> AsyncIterator[str]:
    """Kanned Antwort, damit die Pipeline ohne echtes LLM demonstrierbar ist."""
    user = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    reply = (
        f"Grüezi, ich habe Ihr Anliegen verstanden: „{user[:80]}“. "
        "Ich halte die wichtigsten Angaben fest. "
        "Bitte teilen Sie vorerst keine streng vertraulichen Details mit. "
        "Möchten Sie einen Termin vereinbaren?"
    )
    for word in reply.split(" "):
        await asyncio.sleep(0.05)  # simuliert Token-Latenz
        yield word + " "
