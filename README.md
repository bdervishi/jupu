# AdvoOS — MVP-Demo: KI-Intake-Chatbot

Eigenständige, „lift-out-ready" Demo eines **KI-Sekretariats für Schweizer Kanzleien**
(Schweizer Pendant zu Jupus). Sie zeigt den Kern-Use-Case **Mandatsannahme**: Ein
Website-Besucher beschreibt sein Anliegen in Freitext (DE/FR/IT), die KI führt ein
strukturiertes Intake-Gespräch und erzeugt **live eine kategorisierte Mandatsanfrage**.

> Dieses Verzeichnis hängt von **nichts** aus dem umgebenden SwissBrokerOS-Repo ab und kann
> jederzeit per Copy / `git subtree split` in ein eigenes Repo gehoben werden.

## Was die Demo zeigt

Zwei Tabs:

**1. Mandatsannahme (KI-Intake-Chatbot)**
- **Split-Screen:** links die Mandanten-Sicht (Chat-Widget), rechts die Kanzlei-Sicht
  (Mandatsanfrage, die sich live mit Rechtsgebiet, Gegenpartei, Sachverhalt, Dringlichkeit,
  Kontakt und einem **Frist-Hinweis** füllt).
- **Mehrsprachig** DE/FR/IT mit einfacher Sprach-Autoerkennung.
- **Anwaltsgeheimnis-Hinweis** im Gespräch + Demo-Banner (keine echten Daten).
- **Konfliktprüfung** und **nächster Schritt (Termin)** als Platzhalter-Signale.

**2. Fristenrechner (deterministische CH-Fristen-Engine)** — der eigentliche Moat
- Berechnet prozessuale Fristen **ohne LLM** (haftungskritisch → exakt & nachvollziehbar) für
  **ZPO · StPO · VwVG · BGG**, **Tages- und Monatsfristen**:
  - Folgetag-Regel (ZPO 142 I / StPO 90 I / VwVG 20 I / BGG 44 I)
  - Gerichtsferien/Stillstand (ZPO 145 / VwVG 22a / BGG 46: Ostern / 15.7–15.8 / 18.12–2.1) —
    im **StPO kein Stillstand**
  - Beginn nach Stillstand (ZPO 146 I) · Werktagsverschiebung (ZPO 142 III) · Monatsende-Regel (142 II)
- **Vollständige kantonale Feiertage** aller 26 Kantone (`src/lib/feiertage.ts`, inkl. beweglicher
  Feiertage wie Näfelser Fahrt, Jeûne genevois, Lundi du Jeûne).
- Zeigt **Schritt-für-Schritt-Begründung mit Normzitaten**, **Vorfristen** (14/7/3/1 Tage).
- **Direkt aus dem Chatbot:** Erkennt der Intake eine Frist, öffnet ein Klick den Rechner mit
  vorbefülltem Zustelldatum.
- Vollständig client-seitig → kostenlos und offline. Engine: `src/lib/fristen.ts` +
  `src/lib/feiertage.ts`, getestet in `src/lib/fristen.test.ts` (`npm test`, 14 Fälle).

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

## Tests

```bash
npm test        # Vitest — Fristen-Engine (9 Fälle)
npm run typecheck
```

## Bewusst nicht enthalten (Folge-Phasen)

Telefonassistent, Dokumenten-KI (PDF/E-Mail-Extraktion), automatische Verknüpfung Frist↔Akte/
Kalender, innerkantonale (regionale) Feiertagsunterschiede, eSignatur, echte Auth/DB,
Produktions-Compliance.
