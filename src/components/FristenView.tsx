import { useEffect, useMemo, useState } from 'react';
import {
  computeFrist, fmtDe, KANTONE, PRESETS, wochentag,
  type Einheit, type Kanton, type Verfahren,
} from '../lib/fristen';
import { parseIso as parseDate, termineAusFrist, type Akte, type Termin } from '../lib/termine';

const VERFAHREN: Verfahren[] = ['ZPO', 'StPO', 'VwVG', 'BGG'];

export interface FristenPrefill {
  /** ISO-Datum aus dem Intake (Frist-Hinweis). */
  datum?: string;
  /** Vorschlag für die Akten-Bezeichnung (z. B. Gegenpartei · Rechtsgebiet). */
  akteVorschlag?: string;
}

interface Props {
  prefill?: FristenPrefill;
  akten: Akte[];
  /** Legt die Termine an und liefert die (ggf. neu erzeugte) Akte zurück. */
  onAnlegen: (termine: Termin[], akte: Akte | { bezeichnung: string; aktenzeichen?: string }) => Akte;
  onOpenKalender: () => void;
}

export function FristenView({ prefill, akten, onAnlegen, onOpenKalender }: Props) {
  const [dateStr, setDateStr] = useState(prefill?.datum || '2026-07-02');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [customDauer, setCustomDauer] = useState(20);
  const [customEinheit, setCustomEinheit] = useState<Einheit>('Tage');
  const [customStillstand, setCustomStillstand] = useState(true);
  const [customVerfahren, setCustomVerfahren] = useState<Verfahren>('ZPO');
  const [kanton, setKanton] = useState<Kanton>('ZH');

  // Akte/Kalender-Übernahme
  const [akteWahl, setAkteWahl] = useState<string>('neu');
  const [neueAkte, setNeueAkte] = useState(prefill?.akteVorschlag || '');
  const [angelegt, setAngelegt] = useState<{ anzahl: number; akte: string } | null>(null);

  // Wird der Frist-Hinweis aus dem Chatbot übergeben, Datum + Akten-Vorschlag übernehmen.
  useEffect(() => {
    if (prefill?.datum) setDateStr(prefill.datum);
    if (prefill?.akteVorschlag) { setNeueAkte(prefill.akteVorschlag); setAkteWahl('neu'); }
    setAngelegt(null);
  }, [prefill]);

  const isCustom = presetId === 'custom';
  const preset = PRESETS.find((p) => p.id === presetId);

  const result = useMemo(() => {
    const z = parseDate(dateStr);
    if (!z) return null;
    return computeFrist({
      zustellung: z,
      dauer: isCustom ? Math.max(1, customDauer) : preset!.dauer,
      einheit: isCustom ? customEinheit : preset!.einheit,
      stillstandAnwendbar: isCustom ? customStillstand : preset!.stillstand,
      verfahren: isCustom ? customVerfahren : preset!.verfahren,
      kanton,
    });
  }, [dateStr, presetId, customDauer, customEinheit, customStillstand, customVerfahren, kanton, isCustom, preset]);

  const grouped = VERFAHREN.map((v) => ({ v, items: PRESETS.filter((p) => p.verfahren === v) }));

  const label = isCustom ? `Eigene Frist (${Math.max(1, customDauer)} ${customEinheit})` : preset!.label;
  const grundlage = isCustom ? 'eigene Angabe' : preset!.grundlage;
  const verfahren = isCustom ? customVerfahren : preset!.verfahren;

  function anlegen() {
    const z = parseDate(dateStr);
    if (!result || !z) return;
    const akteBestehend = akten.find((a) => a.id === akteWahl);
    // akteId wird im Store gesetzt (neue Akte) — hier Platzhalter für deterministische IDs.
    const termine = termineAusFrist(result, { akteId: akteBestehend?.id ?? 'neu', label, grundlage, verfahren, kanton, zustellung: z });
    const akte = onAnlegen(termine, akteBestehend ?? { bezeichnung: neueAkte || label });
    // Auswahl auf die (neue) Akte umstellen → erneutes Klicken legt keine zweite Akte an.
    setAkteWahl(akte.id);
    setAngelegt({ anzahl: termine.length, akte: `${akte.aktenzeichen} ${akte.bezeichnung}` });
  }

  return (
    <div className="split">
      <section className="pane">
        <h2 className="pane-title">Eingabe</h2>
        <div className="form">
          <label>
            <span>Datum der Zustellung / Mitteilung</span>
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </label>

          <label>
            <span>Verfahren / Fristtyp</span>
            <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
              {grouped.map(({ v, items }) => (
                <optgroup key={v} label={v}>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.dauer} {p.einheit}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">Eigene Frist …</option>
            </select>
          </label>

          {isCustom && (
            <>
              <div className="form-row">
                <label className="grow">
                  <span>Dauer</span>
                  <input type="number" min={1} value={customDauer} onChange={(e) => setCustomDauer(Number(e.target.value))} />
                </label>
                <label className="grow">
                  <span>Einheit</span>
                  <select value={customEinheit} onChange={(e) => setCustomEinheit(e.target.value as Einheit)}>
                    <option value="Tage">Tage</option>
                    <option value="Monate">Monate</option>
                  </select>
                </label>
                <label className="grow">
                  <span>Verfahren</span>
                  <select value={customVerfahren} onChange={(e) => setCustomVerfahren(e.target.value as Verfahren)}>
                    {VERFAHREN.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </div>
              <label className="check">
                <input type="checkbox" checked={customStillstand} onChange={(e) => setCustomStillstand(e.target.checked)} />
                <span>Gerichtsferien / Stillstand anwendbar (im StPO nie)</span>
              </label>
            </>
          )}

          <label>
            <span>Kanton (für Feiertage)</span>
            <select value={kanton} onChange={(e) => setKanton(e.target.value as Kanton)}>
              {KANTONE.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>

          {!isCustom && preset && (
            <p className="hint">
              {preset.verfahren} · Grundlage: {preset.grundlage} · Gerichtsferien {preset.stillstand ? 'anwendbar' : 'nicht anwendbar'}
            </p>
          )}
        </div>

        <p className="disclaimer">
          ⚠️ Prototyp — Ergebnis stets anwaltlich prüfen. Tages- und Monatsfristen sind abgebildet;
          Monatsfristen mit Stillstand und kantonale Feiertage sind vereinfacht.
        </p>
      </section>

      <section className="pane">
        <h2 className="pane-title">Ergebnis</h2>
        {result && (
          <div className="frist-result">
            <div className="frist-big">
              <span className="frist-label">Fristablauf</span>
              <span className="frist-date">{fmtDe(result.ende)}</span>
              <span className="frist-wd">{wochentag(result.ende)}</span>
            </div>

            <div className="frist-tags">
              {result.monatsregel && <span className="pill pill-info">Monatsfrist</span>}
              {result.stillstandTage > 0 && <span className="pill pill-info">+{result.stillstandTage} Tage Gerichtsferien</span>}
              {result.werktagVerschiebung && <span className="pill pill-info">auf Werktag verschoben</span>}
              <span className="pill pill-pending">Beginn {fmtDe(result.start)}</span>
            </div>

            <h4>Berechnungsschritte</h4>
            <ol className="steps">
              {result.schritte.map((s, i) => <li key={i}>{s}</li>)}
            </ol>

            <h4>Vorfristen (Wiedervorlage)</h4>
            <ul className="vorfristen">
              {result.vorfristen.map((v) => (
                <li key={v.tage}><strong>{fmtDe(v.datum)}</strong> — {v.tage} Tage vorher</li>
              ))}
            </ul>

            <div className="akte-box">
              <h4>In Akte / Kalender übernehmen</h4>
              <p className="hint">Legt den Fristablauf als Termin und die Vorfristen T-14/7/3/1 als Wiedervorlagen an
                (Wochenende/Feiertag → vorheriger Werktag). Wiederholtes Anlegen erzeugt keine Duplikate.</p>
              <div className="form">
                <label>
                  <span>Akte</span>
                  <select value={akteWahl} onChange={(e) => { setAkteWahl(e.target.value); setAngelegt(null); }}>
                    <option value="neu">Neue Akte anlegen …</option>
                    {akten.map((a) => <option key={a.id} value={a.id}>{a.aktenzeichen} — {a.bezeichnung}</option>)}
                  </select>
                </label>
                {akteWahl === 'neu' && (
                  <label>
                    <span>Bezeichnung der neuen Akte</span>
                    <input value={neueAkte} onChange={(e) => setNeueAkte(e.target.value)} placeholder="z. B. Muster ./. Beispiel AG" />
                  </label>
                )}
                <button className="primary" onClick={anlegen}>Termine anlegen ({1 + result.vorfristen.length})</button>
              </div>
              {angelegt && (
                <p className="ok-note">
                  ✓ {angelegt.anzahl} Termine in Akte «{angelegt.akte}» angelegt.{' '}
                  <button className="link-btn" onClick={onOpenKalender}>→ Kalender öffnen</button>
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
