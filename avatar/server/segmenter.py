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
- Mitten im Stream gilt ein Satzzeichen am Pufferende NICHT als Grenze: erst das
  nächste Token zeigt, ob wirklich ein neuer Satz beginnt (kostet ein Token Latenz,
  verhindert aber Schnitte vor schliessenden Anführungszeichen wie „… bail. »").
  Erst wenn der Stream endet, wird der Rest geflusht.
- Schliessende Anführungszeichen/Klammern direkt nach dem Satzzeichen gehören zum Satz.
"""
from __future__ import annotations

from typing import AsyncIterator, Iterable

_SENTENCE_ENDINGS = ".!?…"
_CLOSERS = "»\"'”“)]"
_MIN_CHARS = 12


def _cut_index(text: str, min_chars: int, final: bool = True) -> int:
    """Index (inkl.) des ersten Satzendes, dessen vorangehendes Segment lang genug ist.

    `final=False` (Stream läuft noch): ein Satzzeichen am Pufferende ist noch keine
    Grenze. -1, wenn (noch) kein gültiger Schnitt existiert.
    """
    for i, ch in enumerate(text):
        if ch not in _SENTENCE_ENDINGS:
            continue
        # schliessende Anführungszeichen/Klammern gehören noch zum Satz
        end = i
        while end + 1 < len(text) and text[end + 1] in _CLOSERS:
            end += 1
        # nächstes Nicht-Leerzeichen bestimmen
        j = end + 1
        while j < len(text) and text[j] in " \n\t":
            j += 1
        at_end = j >= len(text)
        if at_end and not final:
            return -1  # erst das nächste Token entscheidet
        starts_new = at_end or text[j].isupper() or text[j] in "«\"„“"
        if not starts_new:
            continue  # z. B. "Art. 142", "3.5" → keine Grenze
        if len(text[: end + 1].strip()) >= min_chars:
            return end
    return -1


async def sentences(tokens: AsyncIterator[str], min_chars: int = _MIN_CHARS) -> AsyncIterator[str]:
    """Konsumiert einen Token-Stream und liefert vollständige Sätze."""
    buf = ""
    async for tok in tokens:
        buf += tok
        idx = _cut_index(buf, min_chars, final=False)
        while idx != -1:
            yield buf[: idx + 1].strip()
            buf = buf[idx + 1 :].lstrip()
            idx = _cut_index(buf, min_chars, final=False)
    # Stream zu Ende: Rest satzweise flushen
    for s in split_text(buf, min_chars):
        yield s


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
