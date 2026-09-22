# AdvoOS (jupu) — KI-Sekretariat für Schweizer Kanzleien

Schweizer, datensouveränes Pendant zu Jupus: eine KI-Sekretärin, die die **Mandatsannahme**
übernimmt (mehrsprachiges Intake DE/FR/IT), **prozessuale Fristen** haftungssicher berechnet
und – als Ausbaustufe – als **sprechende Avatar-Sekretärin** in Echtzeit interagiert.

Kernprinzip: **CH-Datenresidenz, kein US-CLOUD-Act-Exposure für privilegierte Daten** — passend
zum Anwaltsgeheimnis. Konzept: [`docs/concept/jupus-ch-konzept.md`](docs/concept/jupus-ch-konzept.md).

---

## Zwei Komponenten

| Komponente | Ordner | Hosting | Status |
|---|---|---|---|
| **Intake-MVP** (React) — Chatbot + Fristenrechner | Repo-Wurzel (`src/`, `api/`) | **Vercel** | lauffähig |
| **Avatar-Sekretärin** (Echtzeit-Sprache/Avatar) | [`avatar/`](avatar/) | **GPU-VM** (nicht Vercel) | Phase-1-Gerüst |

---

## 1. Intake-MVP (dieser Repo-Root)

Zwei Tabs:

**Mandatsannahme (KI-Intake-Chatbot)** — Split-Screen: links Mandanten-Chat, rechts die
Kanzlei-Mandatsanfrage, die sich live füllt (Rechtsgebiet, Gegenpartei, Sachverhalt,
Dringlichkeit, Kontakt, Frist-Hinweis). Mehrsprachig DE/FR/IT, Anwaltsgeheimnis-Hinweis.

**Fristenrechner (deterministische CH-Fristen-Engine)** — der Moat: berechnet Fristen **ohne LLM**
(exakt & nachvollziehbar) für **ZPO · StPO · VwVG · BGG** (Tages-/Monatsfristen, Gerichtsferien,
Werktagsverschiebung), inkl. **Feiertage aller 26 Kantone**, mit Normzitaten und Vorfristen.
Engine: `src/lib/fristen.ts` + `src/lib/feiertage.ts`, getestet in `src/lib/fristen.test.ts`.

### Schnellstart (kostenlos, ohne KI-Key)

```bash
npm install
npm run dev      # → http://localhost:5180
```

Ohne Key läuft alles im **Mock-Modus** (offline, regelbasiert).

### Mit echter Schweizer KI (optional)

OpenAI-kompatibler CH-Anbieter (z. B. **Infomaniak AI**). `.env` anlegen:

```bash
cp .env.example .env      # AI_BASE_URL / AI_API_KEY / AI_MODEL eintragen
npm run dev
```

Der Key bleibt **serverseitig** (kein `VITE_`-Präfix) — der Browser spricht nur den eigenen
Proxy `/api/chat`.

### Architektur

```
Browser (React/Vite)  →  /api/chat (Proxy, Key serverseitig)  →  CH-KI (OpenAI-kompatibel)
                                         └─ kein Key → lokaler Mock (gratis, offline)
```

- `src/` — React-UI (App, ChatWidget, IntakeDashboard, i18n, aiClient)
- `api/_core.ts` — framework-agnostischer Intake-Kern · `api/chat.ts` — Vercel Function
- `vite.config.ts` — Dev-Middleware für `/api/chat`

### Deploy → Vercel

Repo importieren, **Root Directory = `.`**, Framework Vite (kommt aus `vercel.json`), optional
`AI_BASE_URL/AI_API_KEY/AI_MODEL` setzen. Vollständiges Runbook: [`DEPLOY.md`](DEPLOY.md).

---

## 2. Avatar-Sekretärin (`avatar/`)

Sprechendes Echtzeit-Frontend: `Mic → Whisper (STT) → Hermes (LLM) → Piper (TTS) → MuseTalk (Lip-Sync)`.
Alle Modelle self-hosted → läuft auf **Schweizer GPU** (Infomaniak/Exoscale). **Nicht auf Vercel**
(GPU + WebSocket nötig). Phase-1-Gerüst ist mock-lauffähig ohne GPU:

```bash
cd avatar && pip install -r requirements.txt && python -m server.main   # http://localhost:8080
```

Details: [`avatar/README.md`](avatar/README.md) · Architektur/Plan:
[`docs/live-avatar-sekretaerin.md`](docs/live-avatar-sekretaerin.md).

---

## Tests

```bash
npm test          # Vitest — Fristen-Engine (14 Fälle)
npm run typecheck
```

## Datenschutz-Hinweis

Aktuell **Demo mit Dummy-Daten**. Für den Produktivbetrieb mit echten Mandantendaten gilt die
CH-souveräne Architektur aus dem Konzept (§11): Datenresidenz Schweiz, DPA mit
Berufsgeheimnis-Klausel, kein KI-Training.

## Herkunft

Dieser Code wurde als eigenständiges Projekt aus dem SwissBrokerOS-Repo herausgelöst
(`git subtree split`, Historie erhalten).
