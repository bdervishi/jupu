import asyncio
import json

import httpx
import pytest

from server import llm
from server.config import config


def test_parse_sse_data():
    line = 'data: ' + json.dumps({"choices": [{"delta": {"content": "Hal"}}]})
    assert llm.parse_sse_data(line) == "Hal"
    assert llm.parse_sse_data("data: [DONE]") is None
    assert llm.parse_sse_data("") is None
    assert llm.parse_sse_data(": keep-alive") is None
    assert llm.parse_sse_data('data: {"choices":[{"delta":{}}]}') is None


def test_mock_stream_is_language_aware():
    async def run(lang):
        return "".join([t async for t in llm.stream_reply([{"role": "user", "content": "Bonjour"}], lang)])

    assert "Grüezi" in asyncio.run(run("de"))
    assert "Bonjour" in asyncio.run(run("fr"))
    assert "Buongiorno" in asyncio.run(run("it"))


def test_vllm_stream_parses_openai_sse(monkeypatch):
    """Simuliert vLLM/Hermes: OpenAI-kompatibler SSE-Stream über httpx.MockTransport."""
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        chunks = ["Grüezi, ", "wie kann ", "ich helfen?"]
        body = "".join(
            "data: " + json.dumps({"choices": [{"delta": {"content": c}}]}) + "\n\n" for c in chunks
        ) + "data: [DONE]\n\n"
        return httpx.Response(200, content=body.encode(), headers={"content-type": "text/event-stream"})

    monkeypatch.setattr(config, "LLM_BASE_URL", "http://vllm.test/v1")
    monkeypatch.setattr(llm, "_TRANSPORT", httpx.MockTransport(handler))

    async def run():
        return [t async for t in llm.stream_reply([{"role": "user", "content": "Hallo"}], "de")]

    tokens = asyncio.run(run())
    assert "".join(tokens) == "Grüezi, wie kann ich helfen?"
    assert captured["url"] == "http://vllm.test/v1/chat/completions"
    assert captured["body"]["stream"] is True
    assert captured["body"]["model"] == config.LLM_MODEL
    assert captured["body"]["messages"][0]["role"] == "system"
    assert "Deutsch" in captured["body"]["messages"][0]["content"]
    assert captured["body"]["messages"][-1] == {"role": "user", "content": "Hallo"}


def test_vllm_stream_raises_on_http_error(monkeypatch):
    monkeypatch.setattr(config, "LLM_BASE_URL", "http://vllm.test/v1")
    monkeypatch.setattr(llm, "_TRANSPORT", httpx.MockTransport(lambda r: httpx.Response(503, text="down")))

    async def run():
        return [t async for t in llm.stream_reply([{"role": "user", "content": "x"}], "de")]

    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(run())
