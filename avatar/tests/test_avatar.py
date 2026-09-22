import base64
import json

import httpx

from server.avatar import Avatar
from server.config import config


def test_mock_avatar_has_no_frames():
    ch = Avatar().animate(b"RIFF", 500)
    assert ch.mock and ch.frames == [] and ch.duration_ms == 500


def test_musetalk_sidecar_contract(monkeypatch):
    monkeypatch.setattr(config, "AVATAR_ENABLED", True)
    monkeypatch.setattr(config, "AVATAR_URL", "http://musetalk.test")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["multipart"] = b'name="audio"' in request.content
        frames = [base64.b64encode(b"\xff\xd8jpeg%d" % i).decode() for i in range(3)]
        return httpx.Response(200, json={"fps": 25, "duration_ms": 120, "frames": frames})

    av = Avatar(transport=httpx.MockTransport(handler))
    ch = av.animate(b"RIFF....WAVE", 120)
    assert seen["url"] == "http://musetalk.test/animate" and seen["multipart"]
    assert not ch.mock and len(ch.frames) == 3 and ch.frames[0].startswith(b"\xff\xd8") and ch.fps == 25


def test_sidecar_failure_falls_back_to_mock(monkeypatch):
    monkeypatch.setattr(config, "AVATAR_ENABLED", True)
    monkeypatch.setattr(config, "AVATAR_URL", "http://musetalk.test")
    monkeypatch.setattr(config, "AVATAR_FALLBACK_MOCK", True)
    av = Avatar(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    ch = av.animate(b"RIFF", 100)
    assert ch.mock and ch.frames == []


def test_health_endpoint_reports_modes():
    from fastapi.testclient import TestClient

    from server.main import app

    r = TestClient(app).get("/health")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"status", "llm", "tts", "stt", "avatar"}
    assert body["llm"]["mode"] in {"mock", "vllm"}


def test_websocket_text_roundtrip():
    from fastapi.testclient import TestClient

    from server.main import app

    with TestClient(app).websocket_connect("/ws") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "hello" and hello["modes"]["llm"] == "mock"
        assert ws.receive_json() == {"type": "state", "state": "idle"}
        ws.send_text(json.dumps({"type": "text", "text": "Hallo"}))
        seen = []
        for _ in range(40):
            m = ws.receive_json()
            seen.append(m["type"])
            if m["type"] == "metrics":
                break
        assert "sentence" in seen and "audio" in seen and seen[-1] == "metrics"
