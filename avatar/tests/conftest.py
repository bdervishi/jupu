import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Piper-Stimmen: PIPER_VOICES_DIR oder ./voices (scripts/download-voices.sh).
import os  # noqa: E402

VOICES = pathlib.Path(os.getenv("PIPER_VOICES_DIR", ROOT / "voices"))


def has_voices() -> bool:
    return VOICES.is_dir() and any(VOICES.glob("de*.onnx"))


def has_module(name: str) -> bool:
    try:
        __import__(name)
        return True
    except ImportError:
        return False


@pytest.fixture
def sent():
    """Sammelt alle an den Client geschickten Nachrichten."""
    msgs: list[dict] = []

    async def send(msg: dict) -> None:
        msgs.append(msg)

    send.msgs = msgs  # type: ignore[attr-defined]
    return send
