// Fristen-Engine (CH) — deterministische Berechnung prozessualer Fristen.
// BEWUSST OHNE LLM: Fristen sind haftungskritisch und müssen exakt & nachvollziehbar sein.
//
// Verfahren: ZPO · StPO · VwVG · BGG. Tages- und Monatsfristen.
// Regeln (je Verfahren mit eigenen Normen):
//  - Fristbeginn am Tag NACH Zustellung (ZPO 142 I / StPO 90 I / VwVG 20 I / BGG 44 I).
//  - Letzter Tag auf Sa/So/Feiertag → nächster Werktag (ZPO 142 III / StPO 90 II / VwVG 20 III / BGG 45 I).
//  - Stillstand/Gerichtsferien Ostern · 15.7–15.8 · 18.12–2.1 (ZPO 145 / VwVG 22a / BGG 46);
//    im StPO gibt es KEINEN Stillstand.
//  - Zustellung während Stillstand → Beginn am 1. Tag nach Stillstand (ZPO 146 I / VwVG 22a / BGG 46).
//  - Monatsfristen: Ablauf am Tag gleicher Zahl wie die Zustellung (ZPO 142 II), sonst Monatsende.
//
// Alle Berechnungen in UTC. Monatsfristen mit Stillstand sind vereinfacht (siehe Hinweise/UI).

import { addDays, ostern, utc, within } from './datelib';
import { isFeiertag, KANTONE, type Kanton } from './feiertage';

export { addDays, fmtDe, iso, ostern, utc, wochentag } from './datelib';
export { isFeiertag } from './feiertage';
export { KANTONE };
export type { Kanton };

export type Verfahren = 'ZPO' | 'StPO' | 'VwVG' | 'BGG';
export type Einheit = 'Tage' | 'Monate';

interface Normen { beginn: string; werktag: string; stillstand: string; nachStillstand: string; monat: string; }

const NORMEN: Record<Verfahren, Normen> = {
  ZPO: { beginn: 'Art. 142 Abs. 1 ZPO', werktag: 'Art. 142 Abs. 3 ZPO', stillstand: 'Art. 145 Abs. 1 ZPO', nachStillstand: 'Art. 146 Abs. 1 ZPO', monat: 'Art. 142 Abs. 2 ZPO' },
  StPO: { beginn: 'Art. 90 Abs. 1 StPO', werktag: 'Art. 90 Abs. 2 StPO', stillstand: '— (kein Stillstand im StPO)', nachStillstand: '—', monat: 'Art. 90 StPO' },
  VwVG: { beginn: 'Art. 20 Abs. 1 VwVG', werktag: 'Art. 20 Abs. 3 VwVG', stillstand: 'Art. 22a Abs. 1 VwVG', nachStillstand: 'Art. 22a Abs. 1 VwVG', monat: 'Art. 20 VwVG' },
  BGG: { beginn: 'Art. 44 Abs. 1 BGG', werktag: 'Art. 45 Abs. 1 BGG', stillstand: 'Art. 46 Abs. 1 BGG', nachStillstand: 'Art. 46 Abs. 1 BGG', monat: 'Art. 44 BGG' },
};

export interface FristPreset {
  id: string;
  label: string;
  dauer: number;
  einheit: Einheit;
  stillstand: boolean;
  verfahren: Verfahren;
  grundlage: string;
}

export const PRESETS: FristPreset[] = [
  // ZPO
  { id: 'zpo_berufung', label: 'Berufung', dauer: 30, einheit: 'Tage', stillstand: true, verfahren: 'ZPO', grundlage: 'Art. 311 Abs. 1 ZPO' },
  { id: 'zpo_beschwerde30', label: 'Beschwerde', dauer: 30, einheit: 'Tage', stillstand: true, verfahren: 'ZPO', grundlage: 'Art. 321 Abs. 1 ZPO' },
  { id: 'zpo_beschwerde10', label: 'Beschwerde (prozessleitend / summarisch)', dauer: 10, einheit: 'Tage', stillstand: false, verfahren: 'ZPO', grundlage: 'Art. 321 Abs. 2 ZPO' },
  { id: 'zpo_kuendigung', label: 'Anfechtung Kündigung Miete (Schlichtung, kein Stillstand)', dauer: 30, einheit: 'Tage', stillstand: false, verfahren: 'ZPO', grundlage: 'Art. 273 OR · Art. 145 Abs. 2 lit. a ZPO' },
  { id: 'zpo_klage', label: 'Klage nach Klagebewilligung', dauer: 3, einheit: 'Monate', stillstand: true, verfahren: 'ZPO', grundlage: 'Art. 209 Abs. 3 ZPO' },
  // StPO (kein Stillstand)
  { id: 'stpo_einsprache', label: 'Einsprache gegen Strafbefehl', dauer: 10, einheit: 'Tage', stillstand: false, verfahren: 'StPO', grundlage: 'Art. 354 Abs. 1 StPO' },
  { id: 'stpo_beschwerde', label: 'Beschwerde', dauer: 10, einheit: 'Tage', stillstand: false, verfahren: 'StPO', grundlage: 'Art. 396 Abs. 1 StPO' },
  { id: 'stpo_berufung_anm', label: 'Berufung anmelden', dauer: 10, einheit: 'Tage', stillstand: false, verfahren: 'StPO', grundlage: 'Art. 399 Abs. 1 StPO' },
  { id: 'stpo_berufung_erkl', label: 'Berufungserklärung', dauer: 20, einheit: 'Tage', stillstand: false, verfahren: 'StPO', grundlage: 'Art. 399 Abs. 3 StPO' },
  // VwVG (Stillstand nach Art. 22a)
  { id: 'vwvg_beschwerde', label: 'Beschwerde (Bundesverwaltung)', dauer: 30, einheit: 'Tage', stillstand: true, verfahren: 'VwVG', grundlage: 'Art. 50 Abs. 1 VwVG' },
  // BGG
  { id: 'bgg_beschwerde', label: 'Beschwerde ans Bundesgericht', dauer: 30, einheit: 'Tage', stillstand: true, verfahren: 'BGG', grundlage: 'Art. 100 Abs. 1 BGG' },
];

export interface FristInput {
  zustellung: Date;
  dauer: number;
  einheit: Einheit;
  stillstandAnwendbar: boolean;
  kanton: Kanton;
  verfahren: Verfahren;
}

export interface FristResult {
  start: Date;
  endeRoh: Date;
  ende: Date;
  stillstandTage: number;
  werktagVerschiebung: boolean;
  monatsregel: boolean;
  schritte: string[];
  vorfristen: { tage: number; datum: Date }[];
}

// --- Stillstand / Gerichtsferien -------------------------------------------

interface Period { start: Date; end: Date; label: string; }

function stillstandPeriods(year: number): Period[] {
  const e = ostern(year);
  return [
    { start: addDays(e, -7), end: addDays(e, 7), label: 'Osterferien' },
    { start: utc(year, 7, 15), end: utc(year, 8, 15), label: 'Sommerferien' },
    { start: utc(year, 12, 18), end: utc(year + 1, 1, 2), label: 'Weihnachtsferien' },
  ];
}

export function inStillstand(d: Date): Period | null {
  const y = d.getUTCFullYear();
  for (const yr of [y - 1, y, y + 1]) {
    for (const p of stillstandPeriods(yr)) {
      if (within(d, p.start, p.end)) return p;
    }
  }
  return null;
}

function countStillstand(a: Date, b: Date): number {
  let n = 0;
  for (let d = a; d.getTime() <= b.getTime(); d = addDays(d, 1)) {
    if (inStillstand(d)) n++;
  }
  return n;
}

function isWeekend(d: Date): boolean {
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}
function nextWerktag(d: Date, kanton: Kanton): Date {
  let cur = d;
  while (isWeekend(cur) || isFeiertag(cur, kanton)) cur = addDays(cur, 1);
  return cur;
}
const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const de = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

// Monatsfrist: Tag gleicher Zahl wie Zustellung, +N Monate; fehlt der Tag → Monatsende.
function plusMonate(base: Date, monate: number): Date {
  const total = base.getUTCMonth() + monate;
  const ty = base.getUTCFullYear() + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const letzterTag = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return utc(ty, tm + 1, Math.min(base.getUTCDate(), letzterTag));
}

// --- Kernberechnung --------------------------------------------------------

export function computeFrist(input: FristInput): FristResult {
  const { zustellung, dauer, einheit, stillstandAnwendbar, kanton, verfahren } = input;
  const N = NORMEN[verfahren];
  const schritte: string[] = [];
  const stillstand = stillstandAnwendbar && verfahren !== 'StPO';

  let start = addDays(zustellung, 1);
  schritte.push(`Zustellung am ${de(zustellung)} (${WT[zustellung.getUTCDay()]}) zählt nicht — Fristbeginn am Folgetag ${de(start)} (${N.beginn}).`);

  if (stillstand) {
    const p = inStillstand(start);
    if (p) {
      const neu = addDays(p.end, 1);
      schritte.push(`Fristbeginn fällt in die ${p.label} (Stillstand ${de(p.start)}–${de(p.end)}); Frist beginnt am ${de(neu)} (${N.nachStillstand}).`);
      start = neu;
    }
  }

  let endeRoh: Date;
  let stillstandTage = 0;
  const monatsregel = einheit === 'Monate';

  if (monatsregel) {
    const nominal = plusMonate(zustellung, dauer);
    schritte.push(`Monatsfrist: Ablauf am Tag gleicher Zahl wie die Zustellung — rechnerisch ${de(nominal)} (${N.monat}).`);
    endeRoh = nominal;
    if (stillstand) {
      for (let guard = 0; guard < 6; guard++) {
        const neu = addDays(nominal, countStillstand(start, endeRoh));
        if (neu.getTime() === endeRoh.getTime()) break;
        endeRoh = neu;
      }
      stillstandTage = countStillstand(start, endeRoh);
      if (stillstandTage > 0) {
        schritte.push(`${stillstandTage} Tag(e) Gerichtsferien werden hinzugerechnet (${N.stillstand}; Monatsfrist + Stillstand vereinfacht) — ${de(endeRoh)}.`);
      }
    }
  } else {
    let d = start;
    let counted = 0;
    for (;;) {
      if (stillstand && inStillstand(d)) {
        stillstandTage++;
      } else {
        counted++;
        if (counted === dauer) break;
      }
      d = addDays(d, 1);
    }
    endeRoh = d;
    if (stillstandTage > 0) {
      schritte.push(`${dauer} Tage Frist; ${stillstandTage} Tag(e) Gerichtsferien nicht mitgezählt (${N.stillstand}) — rechnerischer Ablauf am ${de(endeRoh)}.`);
    } else {
      schritte.push(`${dauer} Tage Frist${verfahren === 'StPO' ? ' (kein Stillstand im StPO)' : ' ohne Stillstand'} — rechnerischer Ablauf am ${de(endeRoh)} (${WT[endeRoh.getUTCDay()]}).`);
    }
  }

  const ende = nextWerktag(endeRoh, kanton);
  const werktagVerschiebung = ende.getTime() !== endeRoh.getTime();
  if (werktagVerschiebung) {
    schritte.push(`Letzter Tag ${de(endeRoh)} ist ${WT[endeRoh.getUTCDay()]}/Feiertag — Ablauf verschoben auf den nächsten Werktag ${de(ende)} (${N.werktag}).`);
  }

  const vorfristen = [14, 7, 3, 1].map((tage) => ({ tage, datum: addDays(ende, -tage) }));

  return { start, endeRoh, ende, stillstandTage, werktagVerschiebung, monatsregel, schritte, vorfristen };
}
