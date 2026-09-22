# AdvoOS — Live Avatar-Sekretärin (Umsetzungsplan)

Sprechendes Echtzeit-Avatar-Frontend für AdvoOS: der Nutzer spricht, eine animierte
Sekretärin hört zu, denkt (LLM) und antwortet mit lippensynchroner Stimme.

**Pipeline:**
`Mikrofon → STT (Whisper) → LLM (Hermes, Stream) → TTS (Piper; Kokoro nur EN) → Lip-Sync (MuseTalk) → Video+Audio zum Nutzer`

> **Stand 2026-09-22 (Phase 2):** LLM-Streaming, Piper-TTS und Silero-VAD/faster-whisper sind in
> `avatar/server/` echt angebunden (Piper und VAD lokal auf CPU verifiziert), MuseTalk als GPU-Sidecar
> vorbereitet. Details, Schalter und gemessene Latenzen: `avatar/README.md`.

**Warum das strategisch passt:** Alle vier Modelle sind **Open-Source und self-hostbar** →
kein US-Cloud-Zwang, Daten bleiben auf Schweizer GPU-Infrastruktur → deckt sich mit der
Anwaltsgeheimnis-/revDSG-Architektur aus `docs/concept/jupus-ch-konzept.md` §11.

---

## 1. Komponenten

| Rolle | Wahl | Umsetzung / Server | Alternative (falls nötig) | GPU |
|---|---|---|---|---|
| **STT** | **Whisper** | `faster-whisper` (CTranslate2) + **Silero VAD** für Segmentierung/End-of-Turn | `whisper.cpp`, WhisperX | ~1–2 GB |
| **LLM** | **Hermes** (Hermes 3 / 2 Pro) | **vLLM** mit OpenAI-kompatibler **Streaming**-API (`/v1/chat/completions`) | Apertus (CH), Llama-3.1-Instruct | ~16–20 GB (8B) |
| **TTS** | **Piper** (DE/FR/IT) + Kokoro (EN, opt.) | pluggable Engine, satzweises Streaming | XTTS-v2 (Cloning, Lizenz beachten) | <1 GB |
| **Avatar** | **MuseTalk** (v1.5) | Audio-getriebener Lip-Sync auf Portrait/Loop-Video, ~30 fps | LivePortrait, SadTalker (langsamer) | ~4–6 GB |
| **Orchestrierung** | eigener Media-Server | **Python asyncio + FastAPI**, WebRTC (`aiortc`) oder WebSocket | — | — |

**Wichtig:** Die „einfache Logik" ist real der schwierigste Teil — **Echtzeit-Streaming +
Nebenläufigkeit + Barge-in**. Darauf liegt der Fokus (§4).

---

## 2. End-to-End-Architektur

```
 Browser (Client)                         Media-Server (Python, GPU-Host in CH)
 ┌───────────────────┐   audio (WebRTC/WS) ┌──────────────────────────────────────────┐
 │ Mic-Capture        ├────────────────────▶│ 1) VAD (Silero) → Utterance-Segmentierung │
 │ Avatar-<video>     │                      │ 2) STT faster-whisper → Text              │
 │ Audio-Playback     │◀────────────────────┤ 3) Hermes (vLLM) → Token-Stream           │
 └───────────────────┘  video+audio (Stream)│ 4) Satz-Splitter → Piper TTS je Satz      │
        ▲    │ Barge-in (User spricht)       │ 5) MuseTalk: Audio → lippensynchr. Frames │
        │    └──────────────────────────────▶│ 6) Encode → WebRTC video+audio track      │
        └────────────────────────────────────┘  (Cancel-Signal bricht 3–6 sofort ab)
```

**Datenfluss je Runde:**
1. Client streamt Mikrofon-Audio zum Server.
2. **Silero VAD** erkennt Sprechpausen → schliesst eine „Utterance" ab (End-of-Turn).
3. **faster-whisper** transkribiert die Utterance (Sprache DE/FR/IT autoerkannt).
4. Text + Konversationsverlauf → **Hermes** (vLLM) → **Token-Stream**.
5. Ein **Satz-Splitter** schneidet den Token-Stream in Sätze; jeder fertige Satz geht sofort an **Piper**.
6. Piper-Audio je Satz → **MuseTalk** erzeugt lippensynchrone Frames.
7. Frames + Audio werden als WebRTC-Tracks zum Client gestreamt → Avatar spricht, während Hermes noch weiterschreibt.

---

## 3. Schnittstellen (konkret)

- **Hermes = OpenAI-kompatibel** über vLLM → **dasselbe Proxy-Muster wie `advoos-mvp/api/_core.ts`**
  (`/v1/chat/completions`, `stream: true`). Damit ist der LLM-Layer identisch zum bestehenden MVP —
  nur ein anderer `AI_BASE_URL`/`AI_MODEL`. Hermes 2 Pro/3 sind zudem stark im **Function-Calling**
  → ideal, um im Gespräch strukturierte Intake-Felder + Frist-Trigger zu extrahieren (Anbindung an
  die bestehende Intake-/Fristen-Logik).
- **STT-Service:** interner Aufruf `transcribe(audio_utterance) → {text, lang}`.
- **TTS-Service:** `synthesize(satz, voice, lang) → PCM/WAV-Chunk` (streamend).
- **Avatar-Service:** `animate(audio_chunk) → video_frames` (MuseTalk hält ein vorbereitetes
  Referenz-/Idle-Video im Speicher; erzeugt nur den Mundbereich neu).

---

## 4. Streaming, Latenz & Barge-in (der eigentliche Kern)

**Ziel:** „Time-to-first-avatar-speech" **< ~1,5 s** nach Sprechende des Nutzers.

**Pipelining (nicht Batch!):** Nicht auf die ganze LLM-Antwort warten. Sobald der **erste Satz**
fertig ist → TTS → MuseTalk → abspielen, während der Rest generiert wird. Grobes Budget:

| Stufe | Latenz (GPU) |
|---|---|
| VAD End-of-Turn (Stille) | 200–400 ms |
| Whisper Transkription | 150–400 ms |
| Hermes Time-to-first-token | 100–400 ms |
| 1. Satz → Piper | 100–200 ms (gemessen, CPU) |
| MuseTalk erste Frames | 100–300 ms |
| **Summe bis erster Ton** | **~0,8–1,5 s** |

**Satz-Splitter:** Token-Stream puffern und an Satzgrenzen (`. ! ? …` / Länge) flushen — so wird
TTS früh gefüttert.

**Barge-in (Unterbrechen):** Während der Avatar spricht, bleibt VAD aktiv. Spricht der Nutzer,
wird ein **Cancel-Token** gesetzt, das die Stufen 3–6 (Hermes-Stream, TTS-Queue, MuseTalk) sofort
abbricht und der Avatar in den Idle-Loop zurückkehrt. Ohne Barge-in wirkt es nicht „live".

**Nebenläufigkeit:** Jede Session = eigene asyncio-Pipeline mit Queues zwischen den Stufen; Stufen
laufen parallel (Producer/Consumer).

---

## 5. Transport

- **Produktion: WebRTC** (`aiortc` serverseitig) — niedrigste Latenz für Audio+Video, echtes
  Voll-Duplex (Mic-Upstream + Avatar-Downstream gleichzeitig), Barge-in-tauglich.
- **MVP-Abkürzung: WebSocket** — Audio hoch, generierte Frames (JPEG/Opus) runter. Einfacher, aber
  höhere Latenz; für den ersten Durchstich okay.

---

## 6. Hosting & Hardware (CH-souverän)

- **1 GPU-Instanz** trägt eine Einzel-Session gut: Hermes-8B (fp8/AWQ ~16 GB) + MuseTalk (~5 GB) +
  Whisper (~2 GB) + Kokoro (<1 GB) → **≈ 24 GB GPU** (z. B. L4 / A10 / RTX 4090).
- **Mehrere gleichzeitige Sessions** → mehr GPU bzw. LLM auf separater GPU (vLLM skaliert).
- **CH-Anbieter:** Infomaniak, Exoscale, Safe Swiss Cloud (GPU-Instanzen) → Datenresidenz Schweiz,
  kein CLOUD-Act-Problem für Mandantendaten.

---

## 7. Vorgeschlagene Repo-Struktur (`avatar/`)

```
avatar/
├── server/
│   ├── main.py            # FastAPI + WS-Signalisierung (Text + binäre Audio-Frames), /health
│   ├── pipeline.py        # asyncio-Orchestrierung (Satz-Pipelining, Barge-in, Latenz-Metriken)
│   ├── stt.py             # Silero VAD (Streaming, End-of-Turn) + faster-whisper
│   ├── llm.py             # Hermes via vLLM (OpenAI-kompatibel, SSE-Stream)  ← Muster aus api/_core.ts
│   ├── tts.py             # Piper DE/FR/IT (satzweise), Mock-Fallback; Kokoro nur EN
│   ├── avatar.py          # MuseTalk-Sidecar-Client (HTTP → JPEG-Frames), Mock-Fallback
│   ├── audio.py           # WAV/PCM-Helfer
│   └── segmenter.py       # Token-Stream → Sätze
├── musetalk/              # GPU-Sidecar: MuseTalk hinter POST /animate (+ Mock ohne GPU)
├── client/                # Browser: Mic-Capture (PCM16/16 kHz), Audio-Playback, Frame-Canvas
├── scripts/               # download-voices.sh (Piper-Stimmen)
├── tests/                 # pytest (32 Tests; ohne Modelle 25 + 7 übersprungen)
├── voices/                # Piper-Stimmen (nicht im Repo)
├── assets/                # Referenz-Portrait / Idle-Video der Sekretärin (nicht im Repo)
├── docker-compose.yml     # Media-Server + vLLM + MuseTalk (GPU-Profil)
└── README.md
```

---

## 8. Kritische Risiken & Entscheide (vorab klären)

1. **⚠ Kokoro & Deutsch — ENTSCHIEDEN:** Recherche bestätigt: **Kokoro-82M hat KEIN Deutsch**
   (54 Stimmen / 8 Sprachen; DE nicht dabei). Für eine DE-lastige Schweizer Kanzlei ein K.o.-Kriterium.
   Optionen: **Piper** (30+ Sprachen inkl. DE/FR/IT, sehr schnell, permissive Lizenz → kommerziell
   sauber; Stimme etwas flacher) vs. **XTTS-v2** (beste Qualität/Voice-Cloning, aber **CPML-Lizenz
   schränkt kommerzielle Nutzung ein** + langsamer).
   → **Entscheid: TTS ist pluggable; `Piper` ist der Standard für DE/FR/IT** (kommerziell sicher,
   multilingual), `Kokoro` optional für EN (höchste Qualität). XTTS nur, falls Voice-Cloning-Bedarf
   und Lizenz geklärt.
2. **MuseTalk Realtime & Lizenz:** ~30 fps nur mit GPU; Qualität/Latenz auf Zielhardware früh testen.
   Lizenzbedingungen für kommerziellen Einsatz prüfen (ebenso Hermes/Kokoro/Whisper).
3. **Latenz vs. Qualität:** grössere Whisper-/LLM-Modelle = besser, aber langsamer. Ziel-Budget (§4)
   bestimmt die Modellgrössen.
4. **Mehrsprachigkeit durchgängig:** STT-Autoerkennung, LLM-Antwortsprache, passende TTS-Stimme,
   MuseTalk sprachunabhängig (audio-getrieben) — Kette je Sprache testen.
5. **Nebenläufigkeit/Kosten:** GPU-Sessions sind teuer; Anzahl paralleler Gespräche und Auto-Scaling
   früh definieren.
6. **Avatar-Rechtliches:** Aussehen/Stimme der „Sekretärin" — Rechte an Bild/Stimme klären; klar als
   KI kennzeichnen (revDSG-Transparenz).

---

## 9. Umsetzungs-Phasen

- **Phase 0 — Spikes/Machbarkeit:** Jede Komponente einzeln auf der Ziel-GPU messen (Whisper-Latenz,
  Hermes-TTFT, Kokoro/Piper je Sprache, MuseTalk fps). TTS-Entscheid für DE fixieren (§8.1).
- **Phase 1 — Gerüst (WebSocket) ✅:** Pipeline mit Satz-Streaming + Barge-in, Mock-lauffähig.
- **Phase 2 — echte Modelle 🟡 (in Arbeit):** LLM-Streaming ✅, Piper ✅ (CPU verifiziert), Silero-VAD ✅
  + faster-whisper ✅ (Modell-Download auf Ziel-Host), MuseTalk-Sidecar 🟡 (auf GPU zu verifizieren).
  Ziel: erster Ton < 1,5 s — lokal 0,6–0,7 s mit Mock-LLM; GPU-Messung offen.
- **Phase 3 — Realtime (WebRTC) + Barge-in:** Voll-Duplex, Unterbrechen, Idle-Loop des Avatars.
- **Phase 4 — AdvoOS-Integration:** Hermes-Function-Calling füllt die Intake-Felder + Frist-Trigger;
  der Avatar wird das Sprach-Frontend der Mandatsannahme (Anbindung an `fristen.ts`, Dashboard).

---

## 10. Verifikation

- **Latenz-Messung** je Stufe + End-to-End (Time-to-first-audio, Time-to-first-frame) mit Logging.
- **Lip-Sync-Qualität** qualitativ je Sprache (DE/FR/IT) bewerten.
- **Barge-in-Test:** Avatar mitten im Satz unterbrechen → bricht < 300 ms ab.
- **Lasttest:** N parallele Sessions vs. GPU-Auslastung.
- **Compliance-Check:** verifizieren, dass kein Audio/Text die CH-GPU-Instanz verlässt.
```
