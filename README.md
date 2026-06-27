# AdvoOS — MVP-Demo: KI-Intake-Chatbot

Eigenständige, „lift-out-ready" Demo eines **KI-Sekretariats für Schweizer Kanzleien**
(Schweizer Pendant zu Jupus). Sie zeigt den Kern-Use-Case **Mandatsannahme**: Ein
Website-Besucher beschreibt sein Anliegen in Freitext (DE/FR/IT), die KI führt ein
strukturiertes Intake-Gespräch und erzeugt **live eine kategorisierte Mandatsanfrage**.

> Dieses Verzeichnis hängt von **nichts** aus dem umgebenden SwissBrokerOS-Repo ab und kann
> jederzeit per Copy / `git subtree split` in ein eigenes Repo gehoben werden.

## Was die Demo zeigt

- **Split-Screen:** links die Mandanten-Sicht (Chat-Widget), rechts die Kanzlei-Sicht
  (Mandatsanfrage, die sich live mit Rechtsgebiet, Gegenpartei, Sachverhalt, Dringlichkeit,
  Kontakt und einem **Frist-Hinweis** füllt).
- **Mehrsprachig** DE/FR/IT mit einfacher Sprach-Autoerkennung.
- **Anwaltsgeheimnis-Hinweis** im Gespräch + Demo-Banner (keine echten Daten).
- **Konfliktprüfung** und **nächster Schritt (Termin)** als Platzhalter-Signale.

## Schnellstart (kostenlos, ohne KI-Key)

```bash
cd advoos-mvp
npm install
npm run dev      # → http://localhost:5180
```

Ohne konfigurierten Key läuft die Demo im **Mock-Modus** (offline, regelbasiert) — ideal zum
Vorzeigen ohne laufende Kosten.

## Mit echter Schweizer KI (optional)

Datenschutzkonform mit einem **Schweizer, OpenAI-kompatiblen** Anbieter (z. B. **Infomaniak AI**:
CH-gehostet, kein Logging/Training, 1 Mio. Gratis-Tokens zum Test). `.env` anlegen:

```bash
cp .env.example .env
# AI_BASE_URL / AI_API_KEY / AI_MODEL eintragen, dann:
npm run dev
```

Der Key bleibt **serverseitig** (kein `VITE_`-Präfix) und gelangt nie in den Browser — der
Browser spricht nur den eigenen Proxy `/api/chat`.

## Architektur

```
Browser (React/Vite)  →  /api/chat (Proxy, Key serverseitig)  →  CH-KI (OpenAI-kompatibel)
                                         │
                                         └─ kein Key gesetzt → lokaler Mock (gratis, offline)
```

- `src/` — React-UI (App, ChatWidget, IntakeDashboard, i18n, aiClient)
- `api/_core.ts` — framework-agnostischer Intake-Kern (KI-Call **oder** Mock)
- `api/chat.ts` — Vercel Serverless Function (Produktion)
- `vite.config.ts` — Dev-Middleware, die denselben Kern lokal unter `/api/chat` bedient

## Deploy auf Vercel

1. `advoos-mvp/` als eigenes Projekt importieren (oder Root auf dieses Verzeichnis setzen).
2. Build-Command `npm run build`, Output `dist`.
3. Env-Variablen `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` setzen (optional → sonst Mock).
4. `api/chat.ts` wird automatisch als Function unter `/api/chat` deployed.

## Wichtiger Datenschutz-Hinweis

Dies ist eine **Demo mit Dummy-Daten**. Für den Produktivbetrieb mit echten Mandantendaten gilt
die im Konzept (`docs/concept/jupus-ch-konzept.md`, §11) beschriebene CH-souveräne Architektur:
Datenresidenz Schweiz, kein US-CLOUD-Act-Exposure für privilegierte Daten, DPA mit
Berufsgeheimnis-Klausel, kein KI-Training.

## Bewusst nicht enthalten (Folge-Phasen)

Telefonassistent, Dokumenten-KI, **Fristen-Engine** (ZPO/StPO), eSignatur, echte Auth/DB,
Produktions-Compliance.
