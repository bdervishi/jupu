# AdvoOS (jupu) — Deploy

Dieses Repo ist die Wurzel des AdvoOS-Projekts. Es enthält zwei getrennt deploybare Teile:

> **Zwei getrennte Deploys:**
> - **React-Intake-MVP** (Repo-Wurzel: `src/`, `api/`, Vite) → **Vercel** (statisch + Serverless-Function).
> - **Avatar-Sekretärin** (`avatar/`, Python + GPU + WebSocket) → **NICHT Vercel**, sondern eine
>   **GPU-VM** (Infomaniak / Exoscale / Safe Swiss Cloud). Siehe `avatar/README.md` und
>   `docs/live-avatar-sekretaerin.md` §6. Der `avatar/`-Ordner ist via `.vercelignore` vom
>   Vercel-Build ausgeschlossen.

---

## Intake-MVP → Vercel

1. vercel.com → **Add New… → Project** → `bdervishi/jupu` importieren.
2. **Root Directory = `.`** (die App liegt im Wurzelverzeichnis).
3. Framework wird als **Vite** erkannt; Build/Output kommen aus `vercel.json`
   (`npm run build` → `dist`, `api/chat.ts` als Function).
4. **Environment Variables** (optional — ohne sie läuft der **Mock-Modus**):
   - `AI_API_KEY` — Key des Schweizer KI-Anbieters (z. B. Infomaniak)
   - `AI_BASE_URL` — OpenAI-kompatibler Endpunkt
   - `AI_MODEL` — Modellname
   > Diese Variablen bleiben **serverseitig** (nur `api/chat.ts` liest sie) und gelangen nie
   > in den Browser. **Nicht** ins Repo committen.
5. **Deploy** → App ist unter der Vercel-URL erreichbar (Tabs „Mandatsannahme" + „Fristenrechner").

### Verifizieren

Nach dem Deploy (oder lokal gegen `npm run dev`) den Smoke-Test laufen lassen:

```bash
npm run smoke -- https://<projekt>.vercel.app
```

Er prüft: Startseite lädt, `GET /api/chat` → 405, `POST /api/chat` ohne Body → 400,
`POST /api/chat` mit Testanfrage → 200 inkl. erkanntem Frist-Hinweis, und zeigt an, ob der
Server im **Mock-Modus** (kein `AI_API_KEY`) oder mit **echter CH-KI** antwortet.

Manuell: Vercel-URL öffnen → Chatbot antwortet; Fristenrechner-Tab liefert Berechnungen
(rein clientseitig, keine Keys nötig).

### Was die Konfiguration abdeckt (Stand 2026-09-22, lokal verifiziert)

| Prüfung | Ergebnis |
|---|---|
| `npm run build` (Vite → `dist/`) | grün |
| `npm run typecheck` / `npm test` (18 Tests, inkl. `api/_core.test.ts`) | grün |
| `api/chat.ts` standalone gebündelt (esbuild, wie Vercels Node-Builder) | grün, keine offenen Imports; `api/_core.ts` wird wegen `_`-Präfix nicht als eigene Function deployt |
| `/api/chat` hinter statischem `dist/` (Vercel-Laufzeit simuliert) | 405 / 400 / 200 wie erwartet |
| Browser-Durchstich (Chromium): Chat → Frist erkannt → Fristenrechner → Ablauf + Vorfristen | grün |
| Node-Runtime | `engines.node = 22.x` in `package.json` (Vercel liest das) |

> Der Vercel-Import selbst (Projekt anlegen, Env-Vars) ist ein manueller Schritt im Vercel-Dashboard;
> aus einer Sandbox ohne Vercel-Zugang lässt sich nur die Konfiguration, nicht die Live-URL prüfen.
> Nach dem Import einmal `npm run smoke -- <URL>` ausführen.

---

## Avatar-Sekretärin → GPU-VM (nicht Vercel)

Der Avatar-Server braucht GPU + dauerhafte WebSockets. Kurz:

```bash
cd avatar
# Mock (ohne GPU) lokal:
pip install -r requirements.txt && python -m server.main   # http://localhost:8080
# Produktiv: GPU-VM + docker-compose (vLLM/Hermes) + Piper/Whisper/MuseTalk
```

Vollständige Anleitung: `avatar/README.md`, Architektur: `docs/live-avatar-sekretaerin.md`.
