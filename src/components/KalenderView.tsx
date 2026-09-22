import { useMemo, useState } from 'react';
import { fmtDe } from '../lib/datelib';
import { parseIso, tageBis, toIcs, type Termin } from '../lib/termine';
import type { KalenderApi } from '../lib/useKalender';

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function faellig(t: Termin, heute: Date): 'ueberfaellig' | 'bald' | 'ok' {
  if (t.status === 'erledigt') return 'ok';
  const d = tageBis(t, heute);
  if (d < 0) return 'ueberfaellig';
  if (d <= 7) return 'bald';
  return 'ok';
}

export function KalenderView({ kalender }: { kalender: KalenderApi }) {
  const { state } = kalender;
  const [filter, setFilter] = useState<'offen' | 'alle'>('offen');
  const heute = useMemo(() => new Date(), []);

  const proAkte = useMemo(() => state.akten.map((akte) => ({
    akte,
    termine: state.termine.filter((t) => t.akteId === akte.id && (filter === 'alle' || t.status === 'offen')),
  })), [state, filter]);

  const naechste = useMemo(() => state.termine
    .filter((t) => t.status === 'offen')
    .slice(0, 8), [state.termine]);

  const leer = state.termine.length === 0;

  return (
    <div className="split">
      <section className="pane">
        <h2 className="pane-title">Nächste Wiedervorlagen</h2>
        {leer ? (
          <p className="hint">Noch keine Termine. Im Fristenrechner eine Frist berechnen und «Termine anlegen» wählen.</p>
        ) : (
          <ul className="agenda">
            {naechste.map((t) => {
              const akte = state.akten.find((a) => a.id === t.akteId);
              const f = faellig(t, heute);
              const rest = tageBis(t, heute);
              return (
                <li key={t.id} className={`agenda-item ${t.typ} ${f}`}>
                  <span className="agenda-date">{fmtDe(parseIso(t.datum)!)}</span>
                  <span className="agenda-body">
                    <strong>{t.titel}</strong>
                    <span className="agenda-meta">{akte ? `${akte.aktenzeichen} · ${akte.bezeichnung}` : ''}</span>
                  </span>
                  <span className={`pill ${f === 'ueberfaellig' ? 'pill-warn' : f === 'bald' ? 'pill-info' : 'pill-pending'}`}>
                    {rest < 0 ? `${-rest} Tage überfällig` : rest === 0 ? 'heute' : `in ${rest} Tagen`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="disclaimer">
          Demo: Termine werden nur in diesem Browser gespeichert (localStorage). Für den Produktivbetrieb
          Export per ICS in den Kanzleikalender oder Anbindung an CH-gehostete Kanzleisoftware.
        </p>
        {!leer && (
          <div className="row-actions">
            <button className="primary" onClick={() => download('advoos-fristen.ics', toIcs(state.termine, { akten: state.akten }))}>
              ⬇ Alle als ICS exportieren
            </button>
            <button className="restart" onClick={() => { if (confirm('Alle Akten und Termine löschen?')) kalender.alleLoeschen(); }}>
              Alles löschen
            </button>
          </div>
        )}
      </section>

      <section className="pane">
        <div className="card-head">
          <h2 className="pane-title">Akten</h2>
          <label className="check small">
            <input type="checkbox" checked={filter === 'alle'} onChange={(e) => setFilter(e.target.checked ? 'alle' : 'offen')} />
            <span>erledigte anzeigen</span>
          </label>
        </div>
        {proAkte.length === 0 && <p className="hint">Keine Akten.</p>}
        {proAkte.map(({ akte, termine }) => {
          const fristen = [...new Set(termine.map((t) => t.fristId))];
          return (
            <div key={akte.id} className="akte">
              <div className="akte-head">
                <div>
                  <strong>{akte.aktenzeichen}</strong> · {akte.bezeichnung}
                  <span className="agenda-meta"> angelegt {fmtDe(parseIso(akte.angelegt) ?? new Date())}</span>
                </div>
                <div className="akte-actions">
                  <button className="link-btn" onClick={() => download(`akte-${akte.aktenzeichen}.ics`, toIcs(state.termine.filter((t) => t.akteId === akte.id), { akten: [akte] }))}>ICS</button>
                  <button className="link-btn danger" onClick={() => { if (confirm(`Akte ${akte.aktenzeichen} samt Terminen löschen?`)) kalender.akteLoeschen(akte.id); }}>löschen</button>
                </div>
              </div>
              {fristen.map((fristId) => {
                const gruppe = termine.filter((t) => t.fristId === fristId);
                const haupt = gruppe.find((t) => t.typ === 'frist') ?? state.termine.find((t) => t.akteId === akte.id && t.fristId === fristId && t.typ === 'frist');
                return (
                  <div key={fristId} className="frist-gruppe">
                    <div className="frist-gruppe-head">
                      <span>{haupt ? haupt.titel.replace(/^FRISTABLAUF /, 'Frist: ') : fristId}</span>
                      <button className="link-btn danger" onClick={() => kalender.fristLoeschen(akte.id, fristId)}>Frist entfernen</button>
                    </div>
                    <ul className="termine">
                      {gruppe.map((t) => (
                        <li key={t.id} className={`termin ${t.typ} ${faellig(t, heute)} ${t.status}`}>
                          <label className="check">
                            <input type="checkbox" checked={t.status === 'erledigt'} onChange={(e) => kalender.setStatus(t.id, e.target.checked ? 'erledigt' : 'offen')} />
                            <span className="termin-date">{fmtDe(parseIso(t.datum)!)}</span>
                            <span className="termin-title" title={t.beschreibung}>
                              {t.typ === 'frist' ? '⚑ ' : ''}{t.titel}
                              {t.verschoben && <span className="agenda-meta"> (vorgezogen von {fmtDe(parseIso(t.verschoben.von)!)})</span>}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>
    </div>
  );
}
