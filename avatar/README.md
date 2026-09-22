# AdvoOS — Avatar-Sekretärin (Phase 2: echte Modelle)

Echtzeit-Sprach-/Avatar-Frontend für AdvoOS. Pipeline:

```
Mic → Silero VAD → faster-whisper (STT) → Hermes/vLLM (LLM, Stream) → Satz-Splitter
    → Piper (TTS, DE/FR/IT) → MuseTalk-Sidecar (Lip-Sync, GPU) → Audio + Frames → Browser
```

Vollständiger Plan: [`../docs/live-avatar-sekretaerin.md`](../docs/live-avatar-sekretaerin.md).

## Status

| Stufe | Modul | Stand | Schalter |
|---|---|---|---|
| Orchestrierung, Satz-Streaming, Barge-in, Latenz-Metriken | `server/pipeline.py`, `segmenter.py` | ✅ echt | — |
| **LLM** Hermes via vLLM (OpenAI-kompatibel, SSE-Stream, sprachbewusster System-Prompt) | `server/llm.py` | ✅ echt (Client); vLLM braucht GPU | `LLM_BASE_URL` |
| **TTS** Piper DE/FR/IT (CPU reicht, ~0,1–0,2 s/Satz), Stimmen vorgeladen | `server/tts.py` | ✅ echt, lokal verifiziert | `TTS_ENGINE=piper` |
| **STT** Silero VAD (End-of-Turn, Barge-in) + faster-whisper | `server/stt.py` | ✅ echt (VAD lokal verifiziert; Whisper-Modell braucht Download) | `STT_ENABLED=true` |
| **Avatar** MuseTalk als GPU-Sidecar (HTTP, JPEG-Frames) | `server/avatar.py`, `musetalk/` | 🟡 Client + Sidecar-Gerüst; Inferenz auf Ziel-GPU zu verifizieren | `AVATAR_ENABLED=true AVATAR_URL=…` |
| Transport | `server/main.py`, `client/index.html` | WebSocket (Text + binäre PCM-Frames); WebRTC = Phase 3 | — |

Jede Stufe hat einen **Mock-Fallback**: ohne Modelle läuft die ganze Kette weiter
(`/health` und die `hello`-Nachricht zeigen, was echt ist). Fehlende Piper-Stimmen oder
ein nicht erreichbarer MuseTalk-Sidecar führen zu Mock-Audio/-Frames statt zum Absturz
(`TTS_FALLBACK_MOCK`, `AVATAR_FALLBACK_MOCK`).

**Kokoro kann kein Deutsch** → Piper ist Standard für DE/FR/IT (Entscheid §8.1 im Avatar-Doc).

## Schnellstart

```bash
cd avatar
pip install -r requirements.txt          # Kern (Mock)
python -m server.main                    # → http://localhost:8080  (alles Mock)
```

### Stufe für Stufe echt schalten

```bash
pip install -r requirements-models.txt   # piper-tts, faster-whisper, silero-vad, numpy, onnxruntime

# 1) TTS — Piper (läuft auf CPU)
./scripts/download-voices.sh             # medium-Stimmen von Hugging Face …
./scripts/download-voices.sh --github    # … oder low-Stimmen aus GitHub-Releases (ohne HF-Zugang)
TTS_ENGINE=piper python -m server.main

# 2) STT — Silero VAD + faster-whisper (Modell wird beim ersten Start geladen; CPU: int8)
STT_ENABLED=true STT_MODEL=small STT_DEVICE=cpu STT_COMPUTE_TYPE=int8 TTS_ENGINE=piper python -m server.main
#   → im Browser „🎤 Sprechen": Mikrofon → PCM16/16 kHz → VAD → Whisper → Antwort. Sprechen während
#     der Avatar spricht = Barge-in.

# 3) LLM — Hermes via vLLM (GPU)
docker compose --profile gpu up vllm
LLM_BASE_URL=http://localhost:8000/v1 …

# 4) Avatar — MuseTalk-Sidecar (GPU), siehe musetalk/server.py
docker compose --profile gpu up musetalk
AVATAR_ENABLED=true AVATAR_URL=http://localhost:8090 …
#   Ohne GPU lässt sich die Frame-Übertragung mit dem Mock-Sidecar testen:
#   (cd musetalk && pip install -r requirements-mock.txt && MUSETALK_MOCK=true uvicorn server:app --port 8090)
```

Alles zusammen: `docker compose --profile gpu up` (siehe `docker-compose.yml`).

## Gemessene Latenz (diese Umgebung: CPU, Mock-LLM, Piper low-Stimmen)

| Messpunkt | Wert |
|---|---|
| Piper-Synthese pro Satz (DE/FR/IT) | 90–170 ms |
| Piper-Stimme laden (beim Start, `TTS_PRELOAD`) | ~1,2 s je Sprache |
| Silero VAD | ~10 ms pro Sekunde Audio |
| Erstes Audio nach Texteingang (warm) | ~0,6–0,7 s, davon ~0,5 s Mock-LLM-Tokenbremse |

Der Client zeigt pro Runde `STT · TTFT · 1. Satz · 1. Audio · gesamt`. Ziel laut Avatar-Doc §4:
erster Ton < 1,5 s nach Sprechende — mit vLLM-TTFT (~0,1–0,4 s) und Whisper auf GPU
(~0,2–0,4 s) plausibel; auf der Ziel-GPU messen (Phase-0-Spike).

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest                          # 25 Tests ohne Modelle (7 übersprungen)
pip install -r requirements-models.txt && ./scripts/download-voices.sh --github
python -m pytest                          # 32 Tests inkl. echter Piper-Synthese + Silero-VAD auf Sprache
```

Abgedeckt: Satz-Splitter (Normzitate, Zahlen, Anführungszeichen, Streaming-Grenzen), vLLM-SSE-Parsing
(Fake-Transport), Piper Mock/Fallback/echt, VAD (Fake + echt), Whisper-Wrapper (Fake-Modell),
Pipeline-Runde (Satz→Audio-Pipelining, Metriken, Barge-in, Audio→VAD→STT→LLM→TTS end-to-end),
MuseTalk-Sidecar-Contract, `/health`, WebSocket-Roundtrip.

## Protokoll (WebSocket `/ws`)

Client → Server: binär = PCM16 mono 16 kHz · `{"type":"text","text"}` · `{"type":"lang","lang":"de|fr|it"}` ·
`{"type":"barge_in"}`. Server → Client: `hello{modes}` · `state` · `transcript` · `sentence` ·
`audio{wav_b64,sample_rate,duration_ms,fps,frames[],tts,avatar_mock}` · `metrics` · `error`.
Details im Docstring von `server/main.py`.

## Nächste Phasen

- **Phase 2 (Rest):** Whisper + MuseTalk auf der Ziel-GPU verifizieren, Idle-Video/Referenz-Avatar
  (`assets/sekretaerin_idle.mp4`, Bild-/Stimmrechte klären), Piper-medium-Stimmen.
- **Phase 3:** WebRTC (aiortc) statt WebSocket, Voll-Duplex, Playback-Feedback statt Timer.
- **Phase 4:** Hermes-Function-Calling füllt Intake-Felder + Frist-Trigger → Anbindung an
  `../src/lib/fristen.ts` / `termine.ts` und das Kanzlei-Dashboard.

## Hosting

Alle Modelle self-hosted auf **Schweizer GPU** (Infomaniak / Exoscale / Safe Swiss Cloud) →
kein US-CLOUD-Act-Problem für Mandantendaten (siehe Konzept §11). Kein Audio/Text verlässt den Host.
