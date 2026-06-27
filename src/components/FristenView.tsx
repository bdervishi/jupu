import { useMemo, useState } from 'react';
import { computeFrist, fmtDe, PRESETS, utc, wochentag, type Kanton } from '../lib/fristen';

const KANTONE: Kanton[] = ['ZH', 'BE', 'GE', 'VD', 'TI', 'CH'];

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return utc(y, m, d);
}

export function FristenView() {
  const [dateStr, setDateStr] = useState('2026-07-02');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [customTage, setCustomTage] = useState(20);
  const [customStillstand, setCustomStillstand] = useState(true);
  const [kanton, setKanton] = useState<Kanton>('ZH');

  const isCustom = presetId === 'custom';
  const preset = PRESETS.find((p) => p.id === presetId);

  const result = useMemo(() => {
    const z = parseDate(dateStr);
    if (!z) return null;
    const dauerTage = isCustom ? Math.max(1, customTage) : preset!.dauerTage;
    const stillstandAnwendbar = isCustom ? customStillstand : preset!.stillstand;
    return computeFrist({ zustellung: z, dauerTage, stillstandAnwendbar, kanton });
  }, [dateStr, presetId, customTage, customStillstand, kanton, isCustom, preset]);

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
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label} — {p.dauerTage} Tage</option>
              ))}
              <option value="custom">Eigene Frist …</option>
            </select>
          </label>

          {isCustom && (
            <div className="form-row">
              <label className="grow">
                <span>Dauer (Tage)</span>
                <input type="number" min={1} value={customTage} onChange={(e) => setCustomTage(Number(e.target.value))} />
              </label>
              <label className="check">
                <input type="checkbox" checked={customStillstand} onChange={(e) => setCustomStillstand(e.target.checked)} />
                <span>Gerichtsferien (Art. 145 ZPO) anwendbar</span>
              </label>
            </div>
          )}

          <label>
            <span>Kanton (für Feiertage)</span>
            <select value={kanton} onChange={(e) => setKanton(e.target.value as Kanton)}>
              {KANTONE.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>

          {!isCustom && preset && (
            <p className="hint">Grundlage: {preset.grundlage} · Gerichtsferien {preset.stillstand ? 'anwendbar' : 'nicht anwendbar'}</p>
          )}
        </div>

        <p className="disclaimer">
          ⚠️ Prototyp — Ergebnis stets anwaltlich prüfen. Tagesfristen nach ZPO sind abgebildet;
          Monatsfristen und kantonale Feiertage sind vereinfacht.
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
