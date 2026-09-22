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
  VwVG/BGG, Tages-/Monatsfristen, 26 Kantone; aus dem Chatbot verlinkt. **14 Tests grün**
  (`src/lib/fristen.test.ts`).
- **Avatar-Sekretärin — Phase-1-Gerüst** (`avatar/`): asyncio-Pipeline mit Satz-Streaming +
  Barge-in; echter LLM-Streaming-Client (Hermes/vLLM, OpenAI-kompatibel) + Mock; Satz-Splitter;
  FastAPI-WebSocket-Server + Browser-Client. **Mock-lauffähig ohne GPU.** STT/TTS/Avatar als
  strukturierte Stubs (`TODO(real)`).
- **Deploy vorbereitet**: `vercel.json` (Root `.`, Vite→`dist`, `api/chat.ts` Function),
  `.vercelignore` (schließt `avatar/`, `docs/` aus), `DEPLOY.md`.

## Offen / nächste Schritte 🔜
- **Vercel-Import** des Intake-MVP (manuell durch den Nutzer, 1 Klick) — siehe `DEPLOY.md`.
- **Avatar Phase 2**: echte Modelle anbinden. Reihenfolge: Hermes via vLLM → **Piper (DE/FR/IT)**
  → faster-whisper (STT + Silero VAD) → MuseTalk. **Wichtig:** Kokoro kann kein Deutsch → Piper
  ist Standard für DE/FR/IT (siehe `docs/live-avatar-sekretaerin.md` §8.1).
- **Avatar Phase 3**: WebRTC (aiortc) statt WebSocket, Voll-Duplex/Barge-in in Echtzeit.
- **Integration**: Hermes-Function-Calling füllt Intake-Felder + Frist-Trigger → Anbindung an
  `src/lib/fristen.ts`; Verknüpfung Frist ↔ Akte/Kalender.

## Schnellstart
```bash
npm install && npm run dev     # Intake-MVP → http://localhost:5180
npm test                       # 14 Fristen-Tests
cd avatar && pip install -r requirements.txt && python -m server.main   # Avatar (Mock) → :8080
```

## Hosting-Prinzip
Alles self-hosted auf **Schweizer Infrastruktur** (Datenresidenz CH, kein US-CLOUD-Act-Exposure
für privilegierte Daten). MVP → Vercel; Avatar → GPU-VM (Infomaniak/Exoscale).
