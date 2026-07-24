# AdvoOS — Avatar-Sekretärin (Phase-1-Gerüst)

Echtzeit-Sprach-/Avatar-Frontend für AdvoOS. Pipeline:

```
Mic → STT (Whisper) → Hermes (LLM, Stream) → Satz-Splitter → TTS (Piper) → MuseTalk → Video+Audio
```

Vollständiger Plan: [`../docs/live-avatar-sekretaerin.md`](../docs/live-avatar-sekretaerin.md).

## Status: Phase 1 (Gerüst, Mock-lauffähig)

- ✅ **Orchestrierung** mit Streaming, Satz-Pipelining und **Barge-in** (`server/pipeline.py`)
- ✅ **LLM-Streaming** echt (Hermes/vLLM, OpenAI-kompatibel — Muster wie `../api/_core.ts`), plus Mock
- ✅ **Satz-Splitter** echt (`server/segmenter.py`)
- ✅ **WebSocket-Server** + Browser-Client (`server/main.py`, `client/index.html`)
- 🔲 **STT / TTS / Avatar**: strukturierte Stubs mit klaren `TODO(real)` und Mock-Fallback

> Im Mock-Modus läuft die ganze Kette ohne GPU/Modelle: Text rein → gestreamte Antwort,
> satzweise „gesprochen" (Stille passender Länge) → Avatar-Platzhalter. So testet man die
> Orchestrierung, bevor die Modelle angebunden werden.

## Schnellstart (Mock, ohne GPU)

```bash
cd avatar
pip install -r requirements.txt
python -m server.main            # → http://localhost:8080
```

Im Browser Text eingeben → die Sekretärin antwortet gestreamt; „Unterbrechen" testet Barge-in.

## Reale Modelle anbinden

1. **Hermes (LLM):** vLLM starten und `LLM_BASE_URL` setzen:
   ```bash
   docker compose --profile gpu up vllm
   export LLM_BASE_URL=http://localhost:8000/v1
   ```
2. **STT:** `pip install faster-whisper silero-vad`, `STT_ENABLED=true`, VAD-Ingest in `server/stt.py` / `main.py` implementieren (`TODO(real)`).
3. **TTS (Piper, Standard DE/FR/IT):** `pip install piper-tts`, Stimmen laden, `TTS_ENGINE=piper`.
   ⚠️ **Kokoro kann kein Deutsch** — nur optional für EN.
4. **Avatar (MuseTalk):** MuseTalk-Repo + Gewichte installieren, Referenzvideo unter `assets/`,
   `AVATAR_ENABLED=true`, `server/avatar.py` (`TODO(real)`) füllen.

## Nächste Phasen

- **Phase 2:** echte STT/TTS/Avatar; erster Ton < 1,5 s.
- **Phase 3:** WebRTC (aiortc) statt WebSocket, Voll-Duplex, Barge-in in Echtzeit.
- **Phase 4:** Hermes-Function-Calling füllt Intake-Felder + Frist-Trigger → Anbindung an
  `../src/lib/fristen.ts` und das Kanzlei-Dashboard.

## Hosting

Alle Modelle self-hosted auf **Schweizer GPU** (Infomaniak / Exoscale / Safe Swiss Cloud) →
kein US-CLOUD-Act-Problem für Mandantendaten (siehe Konzept §11).
