import { describe, expect, it } from 'vitest';
import { runIntake } from '../../api/_core';
import { computeFrist, PRESETS, utc } from './fristen';
import { naechstesAktenzeichen } from './kalenderStore';
import {
  deDateToIso, fristIdFor, tageBis, termineAusFrist, toIcs, upsertTermine,
  type Akte, type FristKontext,
} from './termine';

const AKTE: Akte = { id: 'akte-1', aktenzeichen: '2026-001', bezeichnung: 'Muster ./. Beispiel AG', angelegt: '2026-09-22' };

function ctx(p: Partial<FristKontext> = {}): FristKontext {
  return {
    akteId: AKTE.id, label: 'Berufung', grundlage: 'Art. 311 Abs. 1 ZPO',
    verfahren: 'ZPO', kanton: 'ZH', zustellung: utc(2026, 2, 2), ...p,
  };
}

describe('termineAusFrist — Frist → Kalender', () => {
  const result = computeFrist({ zustellung: utc(2026, 2, 2), dauer: 30, einheit: 'Tage', stillstandAnwendbar: true, kanton: 'ZH', verfahren: 'ZPO' });
  const termine = termineAusFrist(result, ctx());

  it('erzeugt Hauptfrist + 4 Vorfristen, chronologisch sortiert', () => {
    expect(termine).toHaveLength(5);
    expect(termine.map((t) => t.typ)).toEqual(['vorfrist', 'vorfrist', 'vorfrist', 'vorfrist', 'frist']);
    expect(termine.map((t) => t.tageVorher)).toEqual([14, 7, 3, 1, 0]);
    const haupt = termine.at(-1)!;
    expect(haupt.datum).toBe('2026-03-04'); // Mittwoch, Ablauf laut Fristen-Engine
    expect(haupt.titel).toMatch(/FRISTABLAUF Berufung/);
    expect(haupt.beschreibung).toMatch(/Art. 311 Abs. 1 ZPO/);
    expect(haupt.beschreibung).toMatch(/Art. 142 Abs. 1 ZPO/); // Berechnungsschritte enthalten
  });

  it('zieht Vorfristen auf Wochenende/Feiertag auf den vorherigen Werktag vor', () => {
    const t3 = termine.find((t) => t.tageVorher === 3)!;
    expect(t3.verschoben?.von).toBe('2026-03-01'); // Sonntag
    expect(t3.datum).toBe('2026-02-27');          // Freitag
    const t14 = termine.find((t) => t.tageVorher === 14)!;
    expect(t14.datum).toBe('2026-02-18');          // Mittwoch, unverändert
    expect(t14.verschoben).toBeUndefined();
  });

  it('respektiert kantonale Feiertage bei der Vorverlegung', () => {
    // Ablauf 08.01.2027 (Fr); T-7 = 01.01.2027 (Fr, Neujahr) → 31.12.2026 (Do) in GE Feiertag
    // (Restauration) → 30.12.2026 (Mi). In ZH ist der 31.12. kein Feiertag → 31.12.2026.
    const r = computeFrist({ zustellung: utc(2026, 12, 29), dauer: 10, einheit: 'Tage', stillstandAnwendbar: false, kanton: 'GE', verfahren: 'StPO' });
    expect(r.ende.toISOString().slice(0, 10)).toBe('2027-01-08');
    const ge = termineAusFrist(r, ctx({ kanton: 'GE', verfahren: 'StPO', label: 'Einsprache' })).find((t) => t.tageVorher === 7)!;
    const zh = termineAusFrist(r, ctx({ kanton: 'ZH', verfahren: 'StPO', label: 'Einsprache' })).find((t) => t.tageVorher === 7)!;
    expect(ge.datum).toBe('2026-12-30');
    expect(zh.datum).toBe('2026-12-31');
  });

  it('kann die Vorverlegung abschalten', () => {
    const roh = termineAusFrist(result, ctx(), { vorfristenAufWerktag: false });
    expect(roh.find((t) => t.tageVorher === 3)!.datum).toBe('2026-03-01');
  });

  it('IDs sind deterministisch; erneutes Anlegen erzeugt keine Duplikate und behält den Status', () => {
    expect(fristIdFor(ctx())).toBe('zpo-berufung-2026-02-02');
    const nochmal = termineAusFrist(result, ctx());
    expect(nochmal.map((t) => t.id)).toEqual(termine.map((t) => t.id));

    const store1 = upsertTermine([], termine);
    const erledigt = store1.map((t) => (t.tageVorher === 14 ? { ...t, status: 'erledigt' as const } : t));
    const store2 = upsertTermine(erledigt, nochmal);
    expect(store2).toHaveLength(5);
    expect(store2.find((t) => t.tageVorher === 14)!.status).toBe('erledigt');
  });

  it('tageBis liefert Restlaufzeit bzw. negative Werte bei Überfälligkeit', () => {
    const haupt = termine.at(-1)!;
    expect(tageBis(haupt, utc(2026, 3, 1))).toBe(3);
    expect(tageBis(haupt, utc(2026, 3, 10))).toBe(-6);
  });
});

describe('ICS-Export', () => {
  it('erzeugt gültige ganztägige VEVENTs mit stabilen UIDs', () => {
    const r = computeFrist({ zustellung: utc(2026, 2, 2), dauer: 30, einheit: 'Tage', stillstandAnwendbar: true, kanton: 'ZH', verfahren: 'ZPO' });
    const ics = toIcs(termineAusFrist(r, ctx()), { dtstamp: utc(2026, 9, 22), akten: [AKTE] });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(ics).toContain('UID:akte-1:zpo-berufung-2026-02-02:frist:0@advoos');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260304');
    expect(ics).toContain('DTEND;VALUE=DATE:20260305');
    expect(ics).toContain('SUMMARY:[2026-001] FRISTABLAUF Berufung');
    expect(ics).toContain('DTSTAMP:20260922T000000Z');
    // Kommas/Zeilenumbrüche escaped, Zeilen gefaltet
    expect(ics).toMatch(/DESCRIPTION:Akte: 2026-001 Muster \.\/\. Beispiel AG\\n/);
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
});

describe('Hilfen', () => {
  it('deDateToIso akzeptiert CH-Schreibweisen und lehnt ungültige Tage ab', () => {
    expect(deDateToIso('30.09.2026')).toBe('2026-09-30');
    expect(deDateToIso('am 5/9/26 erhalten')).toBe('2026-09-05');
    expect(deDateToIso('31.02.2026')).toBeNull();
    expect(deDateToIso('kein Datum')).toBeNull();
  });

  it('naechstesAktenzeichen zählt pro Jahr hoch', () => {
    expect(naechstesAktenzeichen([], 2026)).toBe('2026-001');
    expect(naechstesAktenzeichen([AKTE, { ...AKTE, id: 'x', aktenzeichen: '2026-007' }], 2026)).toBe('2026-008');
    expect(naechstesAktenzeichen([AKTE], 2027)).toBe('2027-001');
  });
});

describe('End-to-End: Intake → Frist erkannt → Termine im Kalender', () => {
  it('läuft ohne Netzwerk vom Chat-Text bis zu 5 Kalendereinträgen', async () => {
    // 1) Intake (Mock-Pfad von /api/chat) erkennt den Frist-Hinweis
    const intake = await runIntake({
      lang: 'de',
      messages: [{ role: 'user', content: 'Mein Vermieter hat mir am 15.09.2026 die Wohnung gekündigt.' }],
    }, {});
    expect(intake.extracted.fristHinweis?.datum).toBe('15.09.2026');

    // 2) Datum → Fristen-Engine (Preset Kündigungsanfechtung Miete, 30 Tage, kein Stillstand)
    const isoDatum = deDateToIso(intake.extracted.fristHinweis!.datum)!;
    const preset = PRESETS.find((p) => p.id === 'zpo_kuendigung')!;
    const [y, m, d] = isoDatum.split('-').map(Number);
    const frist = computeFrist({ zustellung: utc(y, m, d), dauer: preset.dauer, einheit: preset.einheit, stillstandAnwendbar: preset.stillstand, kanton: 'ZH', verfahren: preset.verfahren });
    expect(frist.ende.toISOString().slice(0, 10)).toBe('2026-10-15');

    // 3) Frist → Termine in der Akte
    const akte: Akte = { id: 'akte-42', aktenzeichen: '2026-042', bezeichnung: intake.extracted.rechtsgebiet, angelegt: '2026-09-22' };
    const termine = termineAusFrist(frist, { akteId: akte.id, label: preset.label, grundlage: preset.grundlage, verfahren: preset.verfahren, kanton: 'ZH', zustellung: utc(y, m, d) });
    const kalender = upsertTermine([], termine);
    expect(kalender).toHaveLength(5);
    expect(kalender.map((t) => t.datum)).toEqual(['2026-10-01', '2026-10-08', '2026-10-12', '2026-10-14', '2026-10-15']);
    expect(kalender.every((t) => t.akteId === 'akte-42')).toBe(true);

    // 4) Export in den Kanzleikalender
    const ics = toIcs(kalender, { dtstamp: utc(2026, 9, 22), akten: [akte] });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(ics).toContain('SUMMARY:[2026-042] FRISTABLAUF Anfechtung Kündigung Miete');
  });
});
