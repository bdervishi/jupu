import { useEffect, useMemo, useState } from 'react';
import {
  computeFrist, fmtDe, KANTONE, PRESETS, utc, wochentag,
  type Einheit, type Kanton, type Verfahren,
} from '../lib/fristen';

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return utc(y, m, d);
}

const VERFAHREN: Verfahren[] = ['ZPO', 'StPO', 'VwVG', 'BGG'];

export function FristenView({ prefillDate }: { prefillDate?: string }) {
  const [dateStr, setDateStr] = useState(prefillDate || '2026-07-02');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [customDauer, setCustomDauer] = useState(20);
  const [customEinheit, setCustomEinheit] = useState<Einheit>('Tage');
  const [customStillstand, setCustomStillstand] = useState(true);
  const [customVerfahren, setCustomVerfahren] = useState<Verfahren>('ZPO');
  const [kanton, setKanton] = useState<Kanton>('ZH');

  // Wird der Frist-Hinweis aus dem Chatbot übergeben, Datum übernehmen.
  useEffect(() => {
    if (prefillDate) setDateStr(prefillDate);
  }, [prefillDate]);

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
          </div>
        )}
      </section>
    </div>
  );
}
