# Projekt-Status & Handoff (AdvoOS / jupu)

Stand: 2026-09-22. Diese Notiz fasst zusammen, wo das Projekt steht — als Einstieg für eine
neue Claude-Code-Session oder Mitarbeit. Einstiegspunkte: `README.md`, `DEPLOY.md`,
`avatar/README.md`, `docs/live-avatar-sekretaerin.md`, `docs/concept/jupus-ch-konzept.md`.

## Herkunft
Aus `bdervishi/swissbrokeros` (Ordner `advoos-mvp/`) per `git subtree split` mit Historie
herausgelöst und als Wurzel dieses Repos gepusht.

## Erledigt ✅
- **Konzept** (`docs/concept/jupus-ch-konzept.md`): Jupus-Analyse, CH-Compliance, Hosting/
  Datenresidenz, CH-KI-Anbieter, MVP-Kosten.
- **Intake-MVP** (Repo-Wurzel, React/Vite): Mehrsprachiger KI-Intake-Chatbot (DE/FR/IT),
  Mock-Modus + serverseitiger CH-KI-Proxy (`api/chat.ts`, Key nie im Browser).
- **Fristen-Engine** (`src/lib/fristen.ts` + `src/lib/feiertage.ts`): deterministisch, ZPO/StPO/
  VwVG/BGG, Tages-/Monatsfristen, 26 Kantone; aus dem Chatbot verlinkt.
- **Frist ↔ Akte/Kalender** (`src/lib/termine.ts`, `kalenderStore.ts`, `KalenderView`): Fristablauf +
  Vorfristen T-14/7/3/1 als Termine/Wiedervorlagen (Werktagsregel, idempotent), ICS-Export, Tab
  «Kalender / Wiedervorlagen». End-to-End Chat → Frist → Termine getestet.
- **Tests Intake-MVP: 28 grün** (`npm test`: Fristen 14, Termine 10, API-Kern 4).
- **Avatar-Sekretärin — Phase 2** (`avatar/`): LLM-Streaming (Hermes/vLLM) ✅, **Piper-TTS DE/FR/IT
  echt** (CPU verifiziert, ~0,1–0,2 s/Satz) ✅, **Silero-VAD + faster-whisper** ✅ (VAD lokal verifiziert,
  Whisper-Modell braucht Download), **MuseTalk-Sidecar** (HTTP, `avatar/musetalk/`) 🟡 GPU-Verifikation
  offen. Browser-Client mit Mikrofon (PCM16/16 kHz), Latenz-Metriken, `/health`. Jede Stufe mit
  Mock-Fallback. **32 pytest-Tests** (25 ohne Modelle).
- **Deploy verifiziert (lokal)**: Build, Function-Bundle, Laufzeit-Simulation `/api/chat`, Browser-
  Durchstich; `npm run smoke -- <URL>` als Post-Deploy-Check; Node 22 gepinnt. `DEPLOY.md`.

## Offen / nächste Schritte 🔜
- **Vercel-Import** des Intake-MVP (manuell im Vercel-Dashboard, 1 Klick), danach
  `npm run smoke -- https://<projekt>.vercel.app` — siehe `DEPLOY.md`. (Aus der Sandbox war
  api.vercel.com nicht erreichbar → Live-URL noch nicht geprüft.)
- **Avatar Phase 2 (Rest, braucht GPU-Host)**: faster-whisper-Modell laden + Latenz messen; MuseTalk-
  Sidecar mit echten Gewichten + Referenzvideo (`assets/sekretaerin_idle.mp4`, Rechte klären) auf der
  Ziel-GPU verifizieren; vLLM/Hermes-TTFT messen. Piper-medium-Stimmen von Hugging Face laden.
- **Avatar Phase 3**: WebRTC (aiortc) statt WebSocket, Voll-Duplex, Playback-Feedback statt Timer.
- **Integration**: Hermes-Function-Calling füllt Intake-Felder + Frist-Trigger → `termine.ts`.
- **Kalender produktiv**: localStorage durch CH-gehosteten Dienst / CalDAV / Kanzleisoftware ersetzen
  (Domänenlogik in `termine.ts` bleibt).

## Schnellstart
```bash
npm install && npm run dev     # Intake-MVP → http://localhost:5180
npm test                       # 28 Tests (Fristen, Termine/Kalender, API-Kern)
cd avatar && pip install -r requirements.txt && python -m server.main   # Avatar (Mock) → :8080
cd avatar && pip install -r requirements-models.txt && ./scripts/download-voices.sh --github \
  && TTS_ENGINE=piper python -m server.main                              # Avatar mit echter Piper-Stimme
```

## Hosting-Prinzip
Alles self-hosted auf **Schweizer Infrastruktur** (Datenresidenz CH, kein US-CLOUD-Act-Exposure
für privilegierte Daten). MVP → Vercel; Avatar → GPU-VM (Infomaniak/Exoscale).
