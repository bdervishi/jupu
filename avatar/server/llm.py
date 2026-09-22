"""LLM-Layer: Hermes über vLLM (OpenAI-kompatibel, Streaming).

Spiegelt bewusst das Proxy-Muster aus `api/_core.ts`: OpenAI-kompatibles
`/chat/completions` mit `stream: true`. Damit ist Hermes ein Drop-in — nur andere
`LLM_BASE_URL`/`LLM_MODEL`. Start: `docker compose --profile gpu up vllm`.

Ohne `LLM_BASE_URL` läuft ein Mock-Stream (kanned Antwort, Token für Token), damit
die Pipeline auch ohne laufenden vLLM-Server getestet werden kann.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator

from .config import config

log = logging.getLogger("advoos.llm")

_LANG_NAME = {"de": "Deutsch (Schweizer Höflichkeitsform, «Sie»)", "fr": "français (vouvoiement)", "it": "italiano (forma di cortesia)"}


def system_prompt(lang: str) -> str:
    lang_name = _LANG_NAME.get(lang, _LANG_NAME["de"])
    return (
        "Du bist die freundliche digitale Empfangs-Sekretärin einer Schweizer Anwaltskanzlei. "
        f"Antworte auf {lang_name}. Antworte kurz (1–3 Sätze), natürlich und gesprochen — "
        "keine Listen, kein Markdown, keine Abkürzungen, Zahlen und Daten ausgeschrieben. "
        "Ziel: Anliegen, Gegenpartei, Sachverhalt, Dringlichkeit und Kontakt erfragen — immer nur EINE Frage pro Antwort. "
        "Weise früh darauf hin, keine streng vertraulichen Details preiszugeben, solange kein Mandat besteht. "
        "Nenne erkannte Fristen (Datum, Kündigung, Vorladung, Verfügung, Urteil) ausdrücklich als Hinweis, "
        "berechne aber keine Fristen selbst — das macht die Kanzlei."
    )


# Für Tests injizierbarer httpx-Transport (None = echtes Netzwerk).
_TRANSPORT = None


async def stream_reply(history: list[dict], lang: str | None = None) -> AsyncIterator[str]:
    """Liefert die Antwort-Token als async Generator."""
    lang = lang or config.DEFAULT_LANG
    if not config.LLM_BASE_URL:
        async for tok in _mock_stream(history, lang):
            yield tok
        return
    async for tok in _vllm_stream(history, lang):
        yield tok


def parse_sse_data(line: str) -> str | None:
    """Extrahiert den Delta-Text aus einer SSE-Zeile; None wenn keine Nutzdaten."""
    if not line or not line.startswith("data:"):
        return None
    data = line[len("data:"):].strip()
    if data == "[DONE]":
        return None
    try:
        delta = json.loads(data)["choices"][0]["delta"].get("content")
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return None
    return delta or None


async def _vllm_stream(history: list[dict], lang: str) -> AsyncIterator[str]:
    import httpx  # lokal importiert, damit der Mock-Modus ohne httpx läuft

    messages = [{"role": "system", "content": system_prompt(lang)}, *history]
    payload = {
        "model": config.LLM_MODEL,
        "messages": messages,
        "temperature": config.LLM_TEMPERATURE,
        "max_tokens": config.LLM_MAX_TOKENS,
        "stream": True,
    }
    headers = {"Content-Type": "application/json"}
    if config.LLM_API_KEY:
        headers["Authorization"] = f"Bearer {config.LLM_API_KEY}"

    url = f"{config.LLM_BASE_URL}/chat/completions"
    async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT_S, transport=_TRANSPORT) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.strip() == "data: [DONE]":
                    break
                delta = parse_sse_data(line)
                if delta:
                    yield delta


_MOCK_REPLY = {
    "de": ("Grüezi, ich habe Ihr Anliegen verstanden: „{user}“. "
           "Ich halte die wichtigsten Angaben fest. "
           "Bitte teilen Sie vorerst keine streng vertraulichen Details mit. "
           "Wer ist auf der Gegenseite beteiligt?"),
    "fr": ("Bonjour, j’ai bien compris votre demande : « {user} ». "
           "Je note les informations principales. "
           "Merci de ne pas communiquer de détails strictement confidentiels pour l’instant. "
           "Qui est la partie adverse ?"),
    "it": ("Buongiorno, ho capito la sua richiesta: «{user}». "
           "Prendo nota delle informazioni principali. "
           "La prego di non comunicare dettagli strettamente riservati per ora. "
           "Chi è la controparte?"),
}


async def _mock_stream(history: list[dict], lang: str) -> AsyncIterator[str]:
    """Kanned Antwort, damit die Pipeline ohne echtes LLM demonstrierbar ist."""
    user = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    reply = _MOCK_REPLY.get(lang, _MOCK_REPLY["de"]).format(user=user[:80])
    for word in reply.split(" "):
        await asyncio.sleep(0.03)  # simuliert Token-Latenz
        yield word + " "
