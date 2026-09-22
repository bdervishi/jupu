# AdvoOS — KI-Sekretariat für Schweizer Kanzleien

> Arbeitstitel **„AdvoOS"** (Name TBD). Konzept-/Architekturdokument für ein eigenständiges
> neues Produkt: ein Schweizer Pendant zu **Jupus** (KI für Anwälte).
> SwissBrokerOS/Brokera dient ausschliesslich als **Architektur-Referenz** — kein Code-Eingriff.
>
> Status: Konzept (noch kein Code) · Sprache: Deutsch · Stand: 2026-06

---

## 1. Executive Summary

AdvoOS ist ein **KI-gestütztes digitales Sekretariat für Schweizer Anwaltskanzleien**. Es
automatisiert den gesamten **Front-Office-Prozess der Mandatsannahme — vom Erstkontakt
(Website, Telefon, E-Mail) bis zur strukturiert angelegten Akte** — und nimmt der Kanzlei die
repetitive Sekretariatsarbeit ab, ohne dass ein Softwarewechsel nötig ist.

- **Zielmarkt:** Schweizer Klein- und Mittelkanzleien (1–20 Anwälte), zunächst Deutschschweiz,
  von Beginn an **mehrsprachig (DE/FR/IT)** ausgelegt.
- **Kern-Differenzierung gegenüber Jupus:** (1) **Schweizer Compliance** by design
  (Anwaltsgeheimnis BGFA/StGB, revDSG, **Datenresidenz Schweiz**, kein KI-Training),
  (2) **echte Mehrsprachigkeit DE/FR/IT**, (3) eine innovative Killer-Funktion:
  **automatisiertes Fristenmanagement nach Schweizer Prozessrecht** (siehe §6).
- **Nutzenversprechen:** weniger Aufwand pro Anfrage, keine verpasste Mandatsanfrage, kein
  übersehener Fristenlauf — und damit direkter Haftungs- und Zeitnutzen.

AdvoOS ist bewusst **kein** Rechtsrecherche-/Schriftsatz-Brain wie Harvey, CoCounsel oder
(in der Schweiz) Casus, sondern ein **Prozess- und Front-Office-Automatisierer**. Es ist mit
diesen Tools komplementär.

---

## 2. Was Jupus macht

Jupus (Kölner Startup, gerade €13 Mio. Seed, >2'000 Anwälte) positioniert sich als **„erstes
juristisches KI-Sekretariat"**. Es automatisiert die **Mandatsannahme vom Erstkontakt bis zur
vollständigen Akte**. Bausteine:

| Baustein | Funktion |
|---|---|
| **KI-Chatbot** (Website) | Ständig verfügbarer Kontaktkanal, qualifiziert Besucher vor; lt. Jupus 3× mehr Anfragen. |
| **KI-Telefonassistent** | Nimmt Anrufe an, wenn niemand verfügbar ist, versteht das Anliegen, fragt fehlende Infos ab, vereinbart sofort Termine, filtert vor. |
| **Online-Terminbuchung + Fragebögen** | Digitale Intake-Formulare, Online-Kalender, Vorqualifizierung. |
| **Dokumenten-KI** | Erfasst und analysiert eingehende Dokumente, E-Mails, PDFs; extrahiert Beteiligte und fallrelevante Details; bereitet die Akte vor. |
| **Schriftsatz-/Dokumentengenerierung** | Erstellt juristische Dokumente „in Sekunden". |
| **eSignatur + Aktenanlage** | Elektronische Unterschrift; automatische Aktenanlage in die bestehende Kanzleisoftware (Integration, kein Wechsel). |
| **Compliance** | EU-/DSGVO-Server, kein KI-Training mit Mandantendaten, Berufsrecht nach BRAO/StGB. |

**Eigenangaben Jupus:** −53 % Aufwand pro neuer Mandatsanfrage, ~40 gesparte Arbeitsstunden/Monat.

### Abgrenzung / Marktlandschaft

| Kategorie | Beispiele | Fokus |
|---|---|---|
| **Front-Office-Automatisierung** | **Jupus**, AdvoOS (dieses Konzept) | Mandatsannahme, Intake, Akte, Termine, Fristen |
| Rechtsrecherche / Drafting | Harvey, CoCounsel, **Casus (CH)**, RechtsKI (CH) | Recherche, Analyse, Schriftsatz-Generierung im Tiefen |
| Telefon-/Voice-Assistenz generisch | fonea (CH) | Anrufannahme branchenübergreifend |

AdvoOS spielt in derselben Kategorie wie Jupus, ist aber **CH-nativ** und um das
**Fristenmanagement** erweitert.

---

## 3. Zielmarkt Schweiz & Positionierung

- **Segment:** Klein-/Mittelkanzleien (1–20 Anwälte). Diese haben den höchsten relativen
  Sekretariats-/Fristen-Schmerz und die geringste IT-Kapazität — idealer Einstieg.
- **Mehrsprachigkeit (zentral):** DE/FR/IT durchgängig — UI, Chatbot, Telefonassistent,
  Dokumenten-KI und generierte Dokumente. Dies ist ein struktureller Vorteil gegenüber dem
  DE-only-Jupus und Pflicht für den Schweizer Markt (Romandie, Tessin).
- **Positionierung:** „Das KI-Sekretariat, das die Schweizer Realität versteht — Anwaltsgeheimnis,
  Datenhaltung in der Schweiz, Fristen nach ZPO/StPO, drei Landessprachen."
- **Differenzierungsachsen:** CH-Compliance (§5) + Fristenmanagement (§6) + Mehrsprachigkeit.

---

## 4. v1-Funktionsumfang (die vier Jupus-Bausteine)

Für jeden Baustein: Workflow, KI-Einsatz, UI-Komponenten und die SwissBrokerOS-Referenz, an der
sich Architektur/Implementierung orientieren kann.

### 4.1 KI-Intake-Chatbot (Website-Widget)

- **Workflow:** Besucher landet auf der Kanzlei-Website → einbettbares Chat-Widget begrüsst
  (in der Sprache des Besuchers) → fragt Rechtsgebiet, Anliegen, Dringlichkeit, Beteiligte ab →
  **Konfliktprüfungs-Hinweis** (Abgleich Gegenpartei gegen bestehende Mandate, nur Flag, keine
  automatische Ablehnung) → erstellt eine **Mandatsanfrage** und überführt sie in eine
  (vorläufige) Akte → bietet Terminbuchung oder Rückruf an.
- **KI-Einsatz:** dialogorientierte LLM-Konversation mit strukturiertem Output (Rechtsgebiets-
  Klassifikation, extrahierte Felder); Sprach-Autoerkennung.
- **UI:** einbettbares JS-Widget (ein `<script>`-Tag), Kanzlei-Dashboard mit Anfragen-Inbox.
- **CH-Besonderheit:** Hinweistext, dass über den Chat **keine** dem Anwaltsgeheimnis
  unterliegenden Detailangaben gemacht werden sollen (siehe §5).
- **Referenz:** Provider-flexibler KI-Proxy `services/aiService.ts`, `backend/src/brokerAi.ts`.

### 4.2 KI-Telefonassistent

- **Workflow:** Anruf wird (z. B. ausserhalb der Bürozeiten oder bei Besetzt) vom Assistenten
  angenommen → erfasst Anliegen und Kontaktdaten → vereinbart Termin oder legt Rückrufnotiz an →
  **Transkript + Zusammenfassung landen in der Akte**.
- **KI-Einsatz:** Niedriglatenz-Sprachdialog (Native-Audio-Modell), Transkription,
  Zusammenfassung, Slot-Extraktion.
- **UI:** Call-Log mit Transkript/Aufnahme, Konfigurationspanel (Ansagen, Routing, Sprachen).
- **CH-Besonderheit:** Einwilligungs-/Aufnahmehinweis am Gesprächsbeginn (revDSG).
- **Referenz:** `pages/CallAgent.tsx`, `src/services/voiceAgent.ts` (Gemini Native Audio),
  Telefonie-Provider-Anbindung analog `backend/src/callProviders.ts`.

### 4.3 Dokumenten-KI

- **Workflow:** Eingehende PDFs/E-Mails (Upload, E-Mail-Postfach-Anbindung) → KI liest und
  extrahiert **Beteiligte, Daten, Aktenzeichen/Geschäftsnummer, Dokumenttyp und Fristen-Auslöser**
  → Vorschlag mit **Confidence-Scores** → Anwalt prüft/korrigiert → Ablage in der richtigen Akte.
  Korrekturen fliessen in eine **Lernschleife** (bessere Extraktion über Zeit).
- **KI-Einsatz:** Vision/OCR + strukturierte Extraktion; Feedback-gestütztes Pattern-Learning.
- **UI:** Extraktions-Review-Maske (Feld + Confidence + Quelle), Dokument-Viewer, Akten-Zuordnung.
- **Referenz:** `src/services/policyScan.ts`, `backend/src/policies.ts`, `backend/src/scanLearning.ts`
  (Confidence-Scores + plattformweite, anonymisierte Lernschleife sind dort bereits umgesetzt).

### 4.4 Termin + Schriftsatz

- **Online-Terminbuchung:** öffentlicher Buchungslink + interner Kalender mit Verfügbarkeiten,
  Bestätigungs-/Erinnerungsmails. **Referenz:** `backend/src/calendar.ts`, `pages/Calendar.tsx`.
- **Schriftsatz-/Dokumentengenerierung:** KI füllt Kanzlei-Vorlagen aus Aktendaten (Parteien,
  Daten, Sachverhalt) → Entwurf → Anwalt prüft/finalisiert. Vorlagenverwaltung pro Rechtsgebiet
  und Sprache.
- **eSignatur:** Versand zur Unterschrift, Zeitstempel, Audit-Log. **Referenz:** `backend/src/esign.ts`.
- **CH-Besonderheit:** Generierte Dokumente sind immer **Entwürfe mit Mensch-im-Loop**; eSignatur
  in der Schweiz mit Blick auf ZertES (QES für formbedürftige Dokumente) ausweisen.

---

## 5. CH-Compliance & rechtliche Leitplanken

> Dieser Abschnitt ist **kaufentscheidend**: Anwälte adoptieren nur, was berufsrechtlich sauber ist.

### 5.1 Anwaltsgeheimnis (BGFA Art. 13, StGB Art. 321)

- Daten, die dem Berufsgeheimnis unterliegen, dürfen **nicht** in eine offene/öffentliche KI
  gelangen. AdvoOS betreibt LLMs ausschliesslich über kontrollierte, vertraglich abgesicherte
  Endpunkte (DPA + Zero-Retention).
- Die **Verschwiegenheitspflicht erstreckt sich auf Hilfspersonen** — AdvoOS und seine
  Subprozessoren sind als solche zu behandeln und vertraglich zu binden.
- **Mandantendaten werden unter keinen Umständen für KI-Training verwendet.**
- Architektonische Konsequenz: klare Trennung zwischen „darf an LLM" (Triage/Strukturdaten) und
  „nur lokal/verschlüsselt" (sensible Inhalte); Chatbot- und Telefon-Hinweise, keine Geheimnis-
  Inhalte preiszugeben, bevor das Mandat steht.

### 5.2 revDSG / nDSG

- **Privacy by Design & by Default**, Bearbeitungsverzeichnis, DSFA bei hohem Risiko.
- **Auftragsbearbeitungsvertrag (DPA)** mit allen Subprozessoren, inkl. expliziter
  Berufsgeheimnis-Klausel.
- **Datenresidenz in der Schweiz** (Speicherung + Verarbeitung), **kein** US-Export by default;
  Drittzugriff ausgeschlossen.
- Betroffenenrechte (Auskunft, Berichtigung, Löschung, Portabilität) als Funktionen vorgesehen.

### 5.3 LLM-Provider-Wahl

- Bevorzugt **CH-/EU-gehostete** Modelle bzw. Provider mit **DPA + garantierter
  Null-Retention/keinem Training**. Konkrete Provider-Empfehlung ist in **Phase 0** zu finalisieren
  (Optionen: in CH gehostete Modelle, EU-Regionen grosser Anbieter mit Schweizer Datenklauseln,
  ggf. private/managed Deployment).
- **Provider-Flexibilität** ist Architekturprinzip (austauschbarer KI-Proxy), damit Compliance-
  Anforderungen den Provider bestimmen, nicht umgekehrt. **Referenz:** `backend/src/openaiCompat.ts`
  (OpenAI-kompatibler Adapter) + `backend/src/brokerAi.ts` (per-Tenant-Key/Provider).

### 5.4 Revisionssicherheit / Audit

- Unveränderlicher **Audit-Trail** für alle materiellen Vorgänge (Fristen, Dokumentanlage,
  KI-Aktionen, Versand). Besonders kritisch für Fristen (§6). **Referenz:** `backend/src/audit.ts`.

---

## 6. Innovative Killer-Funktion: KI-gestütztes Fristenmanagement

**Empfehlung — der zentrale Differenzierer für die Schweiz.**

### Problem
Fristen sind der **grösste tägliche Schmerz und der gefährlichste Haftungs-Hotspot** jeder
Kanzlei. Eine verpasste Rechtsmittel- oder Klagefrist ist ein klassischer Haftungsfall.
Die Berechnung ist fehleranfällig: **Gerichtsferien/Stillstand** (ZPO Art. 145), Beginn/Ende und
Fristenstillstand (ZPO Art. 142–146), Besonderheiten in StPO und Verwaltungsverfahren sowie
**kantonale Eigenheiten**. Das wird heute meist manuell gerechnet und in Kalender/Agenda übertragen.

### Lösung
1. **Erkennen:** Die Dokumenten-KI (§4.3) erkennt eingehende **Gerichtspost** (Verfügung,
   Vorladung, Urteil, fristauslösende Mitteilung) und deren Zustelldatum.
2. **Extrahieren:** Auslöse­datum, Fristtyp und massgebliche Rechtsgrundlage.
3. **Berechnen:** Frist **nach Schweizer Prozessrecht inkl. Gerichts-/Betreibungsferien und
   Wochenend-/Feiertagsregel** (ZPO Art. 142–145; analoge Regeln StPO/VwVG; kantonale Feiertage)
   — als **deterministische, testgetriebene Regel-Engine**, nicht als reine LLM-Schätzung.
4. **Eintragen:** Frist + **Vorfristen/Vorwarnstufen** (z. B. T-14/T-7/T-3/T-1) revisionssicher
   im Kalender, **verlinkt mit der Akte**, mit Audit-Trail.
5. **Mensch-im-Loop (zwingend):** Jede berechnete Frist muss vom verantwortlichen Anwalt
   **bestätigt** werden; nichts wird ohne Freigabe scharf gestellt. KI schlägt vor, Mensch verantwortet.

### Warum diese Funktion
- **Innovativ:** Jupus deckt Fristen nicht prominent ab; CH-spezifische Fristenlogik ist ein
  echter Moat.
- **Im Kern einfach:** klar abgegrenzte Regel-Engine + Kalender — gut testbar.
- **Täglich + hochfrequent:** in jeder Kanzlei mehrfach pro Tag relevant.
- **Klarer ROI/Haftungsnutzen:** spart Zeit und verhindert den teuersten Fehler.
- **Synergie:** nutzt Dokumenten-KI (§4.3) und Kalender (§4.4), die ohnehin gebaut werden.

### Abgewogene Alternativen (nachrangig)
- **Automatische Zeiterfassung/Billing** aus Dokumenten, Mails und Kalender: hoher Nutzen, aber
  weniger differenzierend (viele Anbieter) und stärker integrationsabhängig.
- **Posteingangs-Triage** (eingehende Post automatisch der richtigen Akte zuordnen): wertvoll,
  ist aber faktisch eine Teilmenge der Dokumenten-KI und kein eigenständiger Moat.

→ **Fristenmanagement hat Vorrang**, weil es den höchsten und CH-spezifischsten Haftungs-/Zeitnutzen
bei beherrschbarer Komplexität bietet.

---

## 7. Tech-Architektur (Vorschlag, Greenfield)

Eigenständiges Projekt, aber an den **bewährten SwissBrokerOS-Mustern** orientiert.

### Stack-Empfehlung
- **Frontend:** React 18 + TypeScript + Vite; einbettbares Chat-Widget als separates Bundle;
  i18n DE/FR/IT.
- **Backend:** Node/Express (serverless-fähig) mit klaren Service-Modulen.
- **Datenbank:** PostgreSQL (Supabase) mit **Row-Level-Security** + **Multi-Tenant** (Kanzlei =
  Tenant). **Datenresidenz Schweiz.**
- **KI-Proxy:** serverseitiger, **provider-flexibler** Proxy (Key nie im Client); OpenAI-
  kompatibler Adapter für Provider-Austausch (Compliance-getrieben).
- **Objektspeicher:** verschlüsselter Bucket für Dokumente (CH-Region), signierte URLs.
- **Audit-Log:** unveränderliche Tabelle für alle materiellen Vorgänge.

### Architektur (textuell)
```
                 ┌────────────────────────┐
  Website-Widget │  Intake-Chatbot         │
  Telefon        │  Telefonassistent       │
  E-Mail/Upload  │  Dokumenten-Ingest      │
                 └───────────┬─────────────┘
                             ▼
                   ┌───────────────────┐        ┌────────────────────┐
                   │  Intake-/API-Layer│──────▶ │  KI-Proxy (Provider-│
                   │  (Auth, RLS,      │        │  flexibel, DPA/     │
                   │   Multi-Tenant)   │ ◀──────│  Zero-Retention)    │
                   └─────────┬─────────┘        └────────────────────┘
                             ▼
         ┌───────────────────────────────────────────────┐
         │  Domänen-Services                              │
         │  Akte/Fall · Dokumenten-KI · Fristen-Engine ★ │
         │  Kalender/Termin · Schriftsatz · eSignatur     │
         └───────────────────────┬───────────────────────┘
                                 ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │ Postgres+RLS │  │ Objektspeicher│  │ Audit-Log    │
         │ (CH-Region)  │  │ (CH-Region)   │  │ (unveränderl.)│
         └──────────────┘  └──────────────┘  └──────────────┘
   ★ Fristen-Engine = deterministische Regel-Engine (kein reines LLM)
```

### Build-vs-Reuse-Tabelle (SwissBrokerOS als Vorlage)

| AdvoOS-Baustein | Vorlage in SwissBrokerOS | Aufwand |
|---|---|---|
| KI-Proxy (provider-flexibel) | `services/aiService.ts`, `backend/src/brokerAi.ts`, `backend/src/openaiCompat.ts` | **Reuse-Pattern** (adaptieren) |
| Telefonassistent / Voice | `pages/CallAgent.tsx`, `src/services/voiceAgent.ts`, `backend/src/callProviders.ts` | Reuse-Pattern |
| Dokumenten-KI + Lernschleife | `src/services/policyScan.ts`, `backend/src/policies.ts`, `backend/src/scanLearning.ts` | Reuse-Pattern (Domäne anpassen) |
| Kalender / Termin | `backend/src/calendar.ts`, `pages/Calendar.tsx` | Reuse-Pattern |
| eSignatur | `backend/src/esign.ts` | Reuse-Pattern |
| Dokumentenablage | `src/services/documents.ts` | Reuse-Pattern |
| Auth / Multi-Tenant / RLS | `backend/src/auth.ts` | Reuse-Pattern |
| Audit / Compliance | `backend/src/audit.ts`, `backend/src/regulatory.ts` | Reuse-Pattern |
| **Fristen-Engine (CH)** | — (nicht vorhanden) | **Neu bauen** ★ |
| Intake-Chatbot-Widget | — (Lead-Flows als lose Anregung) | **Neu bauen** |
| Schriftsatz-Generierung | — (Tender/Proposal-Logik als Anregung) | **Neu bauen** |

---

## 8. Datenmodell (Kernentitäten)

Mehrsprachigkeit (DE/FR/IT) bei nutzersichtbaren Texten durchgängig berücksichtigt
(z. B. Sprachfeld pro Mandant/Kommunikation, lokalisierte Vorlagen).

| Entität | Wichtige Felder | Beziehungen |
|---|---|---|
| **Kanzlei (Tenant)** | Name, UID, Sprachen, Plan, Branding, Datenregion | 1—n Anwälte, Mandate |
| **Anwalt/Nutzer** | Name, Rolle (RBAC), Sprache, Berechtigungen | gehört zu Kanzlei |
| **Mandant** | Typ (natürlich/juristisch), Kontakt, Sprache, Konfliktprüf-Status | 1—n Mandate |
| **Mandat/Fall** | Rechtsgebiet, Status, Geschäfts-/Aktenzeichen, verantw. Anwalt | n Dokumente, Fristen, Termine |
| **Dokument** | Typ, MIME, Quelle, Extraktion+Confidence, Akten-Zuordnung | gehört zu Mandat |
| **Frist** ★ | Auslösedatum, Fristtyp, Rechtsgrundlage, Ablaufdatum, Vorwarnstufen, **Bestätigt-durch**, Status | gehört zu Mandat; verlinkt Dokument |
| **Termin** | Datum/Zeit, Teilnehmer, Ort/Video, Quelle (Chatbot/Telefon/intern) | gehört zu Mandat/Mandant |
| **Intake-Session** | Kanal (Chat/Telefon), Sprache, erfasste Felder, Transkript, → Mandatsanfrage | wird zu Mandat |
| **Schriftsatz/Vorlage** | Vorlage (pro Rechtsgebiet+Sprache), generierter Entwurf, Status | gehört zu Mandat |
| **Audit-Eintrag** | Akteur (Mensch/KI), Aktion, Zeitstempel, Vorher/Nachher | referenziert beliebige Entität |

---

## 9. Roadmap / Phasen

Priorität: **risikoreichste Annahmen zuerst** validieren (Fristenberechnung-Korrektheit +
Anwaltsgeheimnis-konformer LLM-Betrieb).

- **Phase 0 — Compliance- & Provider-Fundament:** Datenresidenz CH klären, LLM-Provider mit
  DPA/Zero-Retention auswählen, Berufsgeheimnis-Architektur (Trennung sensibel/Strukturdaten)
  festlegen. *Output: Provider-Entscheid + Compliance-Design.*
- **Phase 1 — MVP:** Multi-Tenant-Grundgerüst + Intake-Chatbot (Website-Widget) + Mandatsanfrage/
  Akte + Dokumenten-KI (Extraktion mit Confidence + Review). *Output: nutzbarer Intake-zu-Akte-Flow.*
- **Phase 2 — Fristenmanagement (Differenzierer):** deterministische CH-Fristen-Engine + Kalender/
  Termin + Vorwarnstufen + Mensch-im-Loop-Bestätigung + Audit. *Output: der Moat.*
- **Phase 3 — Telefonassistent:** Anrufannahme, Anliegen-Erfassung, Terminbuchung, Transkript→Akte.
- **Phase 4 — Schriftsatz + eSignatur:** Vorlagengestützte KI-Generierung (Entwurf) + eSign-Versand.

---

## 10. Risiken & offene Fragen

- **Haftung bei falscher Fristberechnung:** Mensch-im-Loop ist **zwingend**; KI/Engine schlägt vor,
  Anwalt bestätigt und verantwortet. Deterministische, **testgetriebene** Fristen-Engine statt
  LLM-Schätzung. AGB-/Haftungsausschluss-Gestaltung früh klären.
- **LLM-Datenresidenz CH:** Welche Provider bieten Schweizer Hosting *und* DPA/Zero-Retention?
  In Phase 0 final zu klären.
- **Integration in CH-Kanzleisoftware** für Aktenanlage/-sync (z. B. WinJur, Toolbox, Dialog,
  AnNoText): Schnittstellenlage prüfen; ggf. Start mit Export/Import statt Tiefenintegration.
- **Mehrsprachigkeit FR/IT:** Qualität von Extraktion und generierten Dokumenten in Französisch/
  Italienisch muss explizit getestet werden.
- **Kantonale Fristen-Eigenheiten & Feiertage:** Datenpflege der kantonalen Regeln/Feiertage als
  laufende Aufgabe einplanen.
- **eSignatur-Formgültigkeit:** ZertES/QES für formbedürftige Dokumente korrekt ausweisen.

---

## 11. Hosting, Datenresidenz, KI-Provider & MVP-Kosten

### 11.1 Grundprinzip: nicht nur *wo*, sondern *wer Zugriff erzwingen kann*

Beim Anwaltsgeheimnis (BGFA Art. 13, StGB Art. 321) ist die physische Datenlage nur die halbe
Miete. Entscheidend ist die **rechtliche Zugriffshoheit**: Jede **US-Firma** (Vercel, Supabase,
AWS, Google/Gemini, OpenAI, Anthropic) unterliegt dem **US CLOUD Act** und kann theoretisch zur
Herausgabe gezwungen werden — **auch wenn der Server in Zürich steht** (Schrems-II-Logik). Für
privilegierte Mandantendaten ist daher ein **Schweizer/EU-eigener Anbieter** die saubere Wahl.

### 11.2 Daten-Ebenen-Trennung (Architekturprinzip)

| Ebene | Inhalt | Hosting |
|---|---|---|
| **Öffentlich** | Marketing-Site, Chat-Widget-Auslieferung, statisches Frontend | US-Anbieter (Vercel) **ok** |
| **Privilegiert** | Akten, Dokumente, Fristen, KI-Verarbeitung von Mandantendaten | **CH-souverän, Pflicht** |

### 11.3 Supabase (neue, separate Instanz)

| Option | Datenort | CLOUD-Act-Risiko | Aufwand | Einsatz |
|---|---|---|---|---|
| Supabase Cloud, Region **Zürich** (`eu-central-2`) | CH | ❌ ja (US-Mutter) | gering | Demo/MVP |
| Supabase **self-hosted** auf CH-Infra (Exoscale/Infomaniak/Safe Swiss Cloud) | CH | ✅ nein | höher | Produktion |

### 11.4 Vercel

Hat eine **Zürich-Region (`zrh1`)** und ist DPF-zertifiziert, bleibt aber US-Firma → CLOUD Act.
→ **Nur für die öffentliche Ebene** nutzen; das privilegierte Backend gehört auf einen CH-Hoster.

### 11.5 CH-KI-Anbieter im Vergleich

| Anbieter | Hosting | Modelle | API | Logging/Training | Preis | Free-Tier | Eignung |
|---|---|---|---|---|---|---|---|
| **Infomaniak AI** | CH | Open Source (Llama, Mixtral, Whisper …) | OpenAI-kompatibel | kein Logging/kein Training | token-basiert, **kein Monatsminimum** | **1 Mio. Gratis-Tokens (1 Mt.)** | ⭐ **beste MVP-Wahl** |
| **Safe Swiss Cloud – Private AI** | CH | kuratierte Open-LLMs (DeepSeek, Llama4, Apertus, Mistral) | OpenAI-kompatibel | kein Training | token-basiert, **min. CHF 95/Mt.** | nein | Produktion/Enterprise |
| **Swisscom Swiss AI Platform** | CH | Apertus + managed endpoints, GenAI Studio | proprietär/managed | enterprise-DPA | intransparent (Enterprise) | nein | später/Enterprise |
| **Apertus** (Swiss-AI/ETH) | CH/self | offene Gewichte 8B/70B, stark DE/FR/IT | je nach Host | je nach Host | offene Gewichte gratis; via Public AI/CSCS teils gratis | (Self-/Public-Hosting) | souverän, aber Eigenbetrieb |

**Empfehlung:** MVP/Demo über **Infomaniak AI** (OpenAI-kompatibel → passt direkt auf das
Proxy-Muster aus `backend/src/openaiCompat.ts`); Produktion je nach Skalierung Safe Swiss Cloud,
Swisscom oder self-hosted Apertus.

### 11.6 MVP-Kostenanalyse („fast kostenlos")

| Baustein | Lösung | Kosten |
|---|---|---|
| Frontend | Vercel Hobby | gratis |
| DB/Auth/Storage | Supabase Free Tier (Zürich) — nur Demo-Daten | gratis |
| KI | Infomaniak 1 Mio. Gratis-Tokens (bzw. lokaler Mock / Apertus) | gratis bis minimal |
| Domain (optional) | z. B. `.ch` | ~CHF 1/Monat |
| **Total für vorzeigbare Demo** | | **≈ CHF 0** |

→ Bestätigt: Eine Demo zum Vorzeigen bei Anwälten ist praktisch gratis machbar.
**Wichtig:** Die Demo läuft **ausschliesslich mit Dummy-Daten** — keine echten Mandantengeheimnisse,
bis die Produktions-Compliance (self-hosted CH) steht.

### 11.7 Gestaffelte Empfehlung

**Demo** (gratis: Vercel + Supabase Free + Infomaniak/Mock) → **MVP-Pilot** (mit echter Kanzlei,
weiterhin Vorsicht bei Daten) → **Produktion** (self-hosted CH-Stack, Safe Swiss Cloud/Swisscom für KI).

---

## 12. Quellen

Jupus (Produkt & Funktionen):
- [JUPUS — Startseite (EN)](https://www.jupus.de/en)
- [JUPUS — Dokumenten-KI](https://www.jupus.de/en/dokumenten-ki)
- [JUPUS — Prozessoptimierung Anwaltskanzlei](https://www.jupus.de/en/prozessoptimierung-anwaltskanzlei-ki-software)
- [JUPUS — Effiziente Mandatsannahme](https://www.jupus.de/en/effiziente-mandatsannahme-kanzlei-optimierung)
- [JUPUS — KI-Sekretariat (Legal Tech Verband Toolfinder)](https://www.legaltechverband.de/toolfinder/jupus-ki-sekretariat-fuer-rechtsanwaelte/)
- [Vollautomatisches KI-Sekretariat für Anwaltskanzleien — connect-professional](https://www.connect-professional.de/office-kommunikation/vollautomatisches-ki-sekretariat-fuer-anwaltskanzleien-334369.html)
- [JUPUS raises €13M — tech.eu](https://tech.eu/2026/06/23/jupus-raises-eur13m-to-power-the-next-generation-of-ai-driven-law-firms/)
- [JUPUS €6.5M Seed — LegalTechTalk](https://www.legaltech-talk.com/jupus-closes-e6-5-million-seed-round/)

Schweizer Legal-Tech, Compliance & Recht:
- [KI in der Kanzlei einführen — Leitfaden (getcasus.com)](https://www.getcasus.com/de/blog/ki-kanzlei-einfuehren-leitfaden)
- [Datenschutz und KI in Schweizer Kanzleien: nDSG-Compliance (RechtsKI)](http://www.rechtski.ch/blog/datenschutz-ki-schweizer-kanzleien-ndsg/)
- [Berufsgeheimnis und KI: Was erlaubt ist (schneeberger.legal)](https://www.schneeberger.legal/post/berufsgeheimnis-ki-anwalt)
- [KI-gestützte Rechtsrecherche im Schweizer Recht (getcasus.com)](https://www.getcasus.com/de/blog/ai-legal-research-swiss-law)
- [KI für Schweizer Anwälte: Leitfaden 2026 (iapmesuisse.ch)](https://iapmesuisse.ch/de/blog/ia-juridique-avocats-suisse-guide-2026)
- [KI-Telefonassistent Anwaltskanzlei Schweiz (fonea)](https://www.fonea.ch/blog/ki-telefonassistent-anwaltskanzlei-schweiz)

Hosting, Datenresidenz & KI-Provider:
- [Supabase — Available regions (Zürich `eu-central-2`)](https://supabase.com/docs/guides/platform/regions)
- [Vercel — Edge Network regions (`zrh1`)](https://vercel.com/docs/edge-network/regions)
- [Vercel — DPF-Zertifizierung](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf)
- [Infomaniak — AI Services (souverän, OpenAI-kompatibel)](https://www.infomaniak.com/en/hosting/ai-services)
- [Infomaniak — AI Tools Preise](https://www.infomaniak.com/en/hosting/ai-services/prices)
- [Safe Swiss Cloud — Private AI API](https://safeswisscloud.com/en/private-ai/private-ai-api/)
- [Safe Swiss Cloud — Private AI Pricing](https://safeswisscloud.com/en/private-ai/private-ai-pricing/)
- [Swisscom — Swiss AI Platform](https://www.swisscom.ch/en/business/enterprise/offer/platforms-applications/data-driven-business/swiss-ai-platform.html)
- [Apertus — offenes Schweizer Sprachmodell (ETH Zürich)](https://ethz.ch/en/news-and-events/eth-news/news/2025/09/press-release-apertus-a-fully-open-transparent-multilingual-language-model.html)
