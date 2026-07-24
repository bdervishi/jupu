"""Token-Stream → Sätze.

Damit die TTS früh gefüttert wird (niedrige Time-to-first-audio), wird der
LLM-Token-Stream nicht bis zum Ende gepuffert, sondern an Satzgrenzen sofort
ausgegeben.

Zwei Schutzmechanismen gegen falsche Schnitte:
- Ein Satzzeichen gilt nur als Grenze, wenn danach (nach evtl. Leerzeichen) das
  Textende oder ein Grossbuchstabe folgt. So bleiben Zitate wie „Art. 142 ZPO"
  und Zahlen wie „3.5" ungetrennt.
- Zu kurze Fragmente (z. B. „Grüezi.") werden mit dem nächsten Satz verschmolzen,
  statt einen eigenen — und alle folgenden — Schnitte zu blockieren.
"""
from __future__ import annotations

from typing import AsyncIterator, Iterable

_SENTENCE_ENDINGS = ".!?…"
_MIN_CHARS = 12


def _cut_index(text: str, min_chars: int) -> int:
    """Index (inkl.) des ersten Satzzeichens, dessen vorangehendes Segment lang genug ist.

    -1, wenn (noch) kein gültiger Schnitt existiert.
    """
    for i, ch in enumerate(text):
        if ch not in _SENTENCE_ENDINGS:
            continue
        # nächstes Nicht-Leerzeichen bestimmen
        j = i + 1
        while j < len(text) and text[j] in " \n\t":
            j += 1
        at_end = j >= len(text)
        starts_new = at_end or text[j].isupper()
        if not starts_new:
            continue  # z. B. "Art. 142", "3.5" → keine Grenze
        if len(text[: i + 1].strip()) >= min_chars:
            return i
    return -1


async def sentences(tokens: AsyncIterator[str], min_chars: int = _MIN_CHARS) -> AsyncIterator[str]:
    """Konsumiert einen Token-Stream und liefert vollständige Sätze."""
    buf = ""
    async for tok in tokens:
        buf += tok
        idx = _cut_index(buf, min_chars)
        while idx != -1:
            yield buf[: idx + 1].strip()
            buf = buf[idx + 1 :].lstrip()
            idx = _cut_index(buf, min_chars)
    tail = buf.strip()
    if tail:
        yield tail


def split_text(text: str, min_chars: int = _MIN_CHARS) -> Iterable[str]:
    """Synchrone Variante für Tests/Batch."""
    out, buf = [], text
    idx = _cut_index(buf, min_chars)
    while idx != -1:
        out.append(buf[: idx + 1].strip())
        buf = buf[idx + 1 :].lstrip()
        idx = _cut_index(buf, min_chars)
    if buf.strip():
        out.append(buf.strip())
    return out
