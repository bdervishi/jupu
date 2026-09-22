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

- Vercel-URL öffnen → Chatbot antwortet (Mock oder echt, je nach Env-Vars).
- `/api/chat` per POST erreichbar (die App ruft es automatisch auf).
- Fristenrechner-Tab liefert Berechnungen (rein clientseitig, keine Keys nötig).

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
