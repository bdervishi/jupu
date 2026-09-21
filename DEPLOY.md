# AdvoOS — Eigenes Repo + Vercel-Deploy

Runbook, um AdvoOS aus dem SwissBrokerOS-Repo in ein **eigenes GitHub-Repo
`bdervishi/advoos`** zu heben und den **React-Intake-MVP** auf **Vercel** zu deployen.

> **Wichtig — Zwei getrennte Deploys:**
> - **React-Intake-MVP** (dieser Ordner: `src/`, `api/`, Vite) → **Vercel** (statisch + Serverless-Function).
> - **Avatar-Sekretärin** (`avatar/`, Python + GPU + WebSocket) → **NICHT Vercel**, sondern eine
>   **GPU-VM** (Infomaniak / Exoscale / Safe Swiss Cloud). Siehe `avatar/README.md` und
>   `docs/live-avatar-sekretaerin.md` §6. Der `avatar/`-Ordner ist via `.vercelignore` vom
>   Vercel-Build ausgeschlossen.

---

## Schritt 1 — Leeres Repo anlegen

Auf GitHub ein **leeres** Repo `bdervishi/advoos` erstellen (ohne README/gitignore).

## Schritt 2 — Code hineinheben

### Variante B — empfohlen (mit Git-Historie)

Aus einem lokalen SwissBrokerOS-Checkout:

```bash
bash advoos-mvp/scripts/lift-out.sh
# oder mit SSH-Remote:
ADVOOS_REMOTE=git@github.com:bdervishi/advoos.git bash advoos-mvp/scripts/lift-out.sh
```

Das Script macht `git subtree split --prefix=advoos-mvp` und pusht den Inhalt als
**Wurzel** nach `bdervishi/advoos` (Branch `main`).

### Variante A — einfach (frische Historie)

Falls du keine Historie brauchst:

```bash
# advoos-mvp/ irgendwohin kopieren, dann darin:
git init
git add .
git commit -m "first commit: AdvoOS (Intake-MVP + Avatar-Gerüst)"
git branch -M main
git remote add origin https://github.com/bdervishi/advoos.git
git push -u origin main
```

## Schritt 3 — Vercel-Import (nur React-MVP)

1. vercel.com → **Add New… → Project** → `bdervishi/advoos` importieren.
2. **Root Directory = `.`** (nach dem Lift-out liegt die App im Wurzelverzeichnis).
3. Framework wird als **Vite** erkannt; Build/Output kommen aus `vercel.json`
   (`npm run build` → `dist`, `api/chat.ts` als Function).
4. **Environment Variables** (optional — ohne sie läuft der **Mock-Modus**):
   - `AI_API_KEY` — Key des Schweizer KI-Anbieters (z. B. Infomaniak)
   - `AI_BASE_URL` — OpenAI-kompatibler Endpunkt
   - `AI_MODEL` — Modellname
   > Diese Variablen bleiben **serverseitig** (nur `api/chat.ts` liest sie) und gelangen nie
   > in den Browser. **Nicht** ins Repo committen.
5. **Deploy** → App ist unter der Vercel-URL erreichbar (Tabs „Mandatsannahme" + „Fristenrechner").

## Schritt 4 — Verifizieren

- Vercel-URL öffnen → Chatbot antwortet (Mock oder echt, je nach Env-Vars).
- `/api/chat` per POST erreichbar (die App ruft es automatisch auf).
- Fristenrechner-Tab liefert Berechnungen (rein clientseitig, keine Keys nötig).

---

## Später: Avatar deployen (separat)

Der Avatar-Server läuft **nicht** auf Vercel. Kurz:

```bash
cd avatar
# Mock (ohne GPU) lokal:
pip install -r requirements.txt && python -m server.main   # http://localhost:8080
# Produktiv: GPU-VM + docker-compose (vLLM/Hermes) + Piper/Whisper/MuseTalk
```

Vollständige Anleitung: `avatar/README.md`, Architektur: `docs/live-avatar-sekretaerin.md`.
