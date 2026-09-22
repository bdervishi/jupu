import asyncio

from server.segmenter import sentences, split_text


def test_split_keeps_norm_citations_and_numbers():
    text = "Gemäss Art. 142 ZPO beginnt die Frist am Folgetag. Der Wert liegt bei 3.5 Prozent. Danke!"
    assert split_text(text) == [
        "Gemäss Art. 142 ZPO beginnt die Frist am Folgetag.",
        "Der Wert liegt bei 3.5 Prozent.",
        "Danke!",
    ]


def test_short_fragments_are_merged():
    assert split_text("Grüezi. Wie kann ich helfen?") == ["Grüezi. Wie kann ich helfen?"]


def test_async_stream_yields_sentences_early():
    async def tokens():
        for t in ["Guten ", "Tag, ", "gerne. ", "Worum ", "geht ", "es?"]:
            yield t

    async def run():
        return [s async for s in sentences(tokens())]

    assert asyncio.run(run()) == ["Guten Tag, gerne.", "Worum geht es?"]


def test_closing_quotes_stay_with_sentence_and_stream_waits_for_next_token():
    text = "Ich habe verstanden: « Mon bail. ». Je note les informations. Qui est la partie adverse ?"
    assert split_text(text) == [
        "Ich habe verstanden: « Mon bail. ».",
        "Je note les informations.",
        "Qui est la partie adverse ?",
    ]

    async def tokens():
        for t in ["Ich habe ", "verstanden: « Mon ", "bail.", " ». ", "Je note ", "les informations."]:
            yield t

    async def run():
        return [s async for s in sentences(tokens())]

    assert asyncio.run(run()) == ["Ich habe verstanden: « Mon bail. ».", "Je note les informations."]


def test_sentence_start_after_opening_quote_is_boundary():
    assert split_text("Sie sagte: Danke schön. «Bis morgen», sagte er.") == ["Sie sagte: Danke schön.", "«Bis morgen», sagte er."]
