// Fristen-Engine (CH) — deterministische Berechnung prozessualer Fristen nach ZPO.
// BEWUSST OHNE LLM: Fristen sind haftungskritisch und müssen exakt & nachvollziehbar sein.
//
// Abgebildete Regeln:
//  - Art. 142 Abs. 1 ZPO: Fristbeginn am Tag NACH der Zustellung (Zustelltag zählt nicht).
//  - Art. 142 Abs. 3 ZPO: Fällt der letzte Tag auf Sa/So/anerkannten Feiertag → nächster Werktag.
//  - Art. 145 Abs. 1 ZPO: Stillstand (Gerichtsferien) Ostern / 15.7–15.8 / 18.12–2.1.
//  - Art. 145 Abs. 2 ZPO: kein Stillstand im Schlichtungs-/summarischen Verfahren.
//  - Art. 146 Abs. 1 ZPO: Zustellung während Stillstand → Beginn am 1. Tag nach Stillstand.
//
// Alle Berechnungen in UTC (keine Zeitzonen-/DST-Effekte). Monatsfristen sind bewusst NICHT
// abgebildet (die meisten kritischen Fristen sind Tagesfristen); siehe Hinweis im UI.

export type Kanton = 'CH' | 'ZH' | 'BE' | 'GE' | 'VD' | 'TI';

export interface FristPreset {
  id: string;
  label: string;
  dauerTage: number;
  stillstand: boolean;
  grundlage: string;
}

export const PRESETS: FristPreset[] = [
  { id: 'berufung', label: 'Berufung (ZPO 311)', dauerTage: 30, stillstand: true, grundlage: 'Art. 311 Abs. 1 ZPO' },
  { id: 'beschwerde30', label: 'Beschwerde (ZPO 321 Abs. 1)', dauerTage: 30, stillstand: true, grundlage: 'Art. 321 Abs. 1 ZPO' },
  { id: 'beschwerde10', label: 'Beschwerde prozessleitend / summarisch (ZPO 321 Abs. 2)', dauerTage: 10, stillstand: false, grundlage: 'Art. 321 Abs. 2 ZPO' },
  { id: 'bgg', label: 'Beschwerde ans Bundesgericht (BGG 100)', dauerTage: 30, stillstand: true, grundlage: 'Art. 100 Abs. 1 BGG' },
  { id: 'summarisch10', label: 'Summarisches Verfahren — Frist (kein Stillstand)', dauerTage: 10, stillstand: false, grundlage: 'Art. 145 Abs. 2 lit. b ZPO' },
];

export interface FristInput {
  zustellung: Date;
  dauerTage: number;
  stillstandAnwendbar: boolean;
  kanton: Kanton;
}

export interface FristResult {
  start: Date;
  endeRoh: Date;
  ende: Date;
  stillstandTage: number;
  werktagVerschiebung: boolean;
  schritte: string[];
  vorfristen: { tage: number; datum: Date }[];
}

// --- Datums-Helfer (UTC) ---------------------------------------------------

const DAY = 86_400_000;
const WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function utc(y: number, m1: number, d: number): Date {
  return new Date(Date.UTC(y, m1 - 1, d));
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}
export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function fmtDe(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}
export function wochentag(d: Date): string {
  return WOCHENTAG[d.getUTCDay()];
}
function isWeekend(d: Date): boolean {
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}
function within(d: Date, start: Date, end: Date): boolean {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

// --- Ostern (Meeus/Jones/Butcher, gregorianisch) ---------------------------

export function ostern(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=März, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

// --- Gerichtsferien / Stillstand (Art. 145 Abs. 1) -------------------------

interface Period { start: Date; end: Date; label: string; }

function stillstandPeriods(year: number): Period[] {
  const e = ostern(year);
  return [
    { start: addDays(e, -7), end: addDays(e, 7), label: 'Osterferien' },
    { start: utc(year, 7, 15), end: utc(year, 8, 15), label: 'Sommerferien' },
    { start: utc(year, 12, 18), end: utc(year + 1, 1, 2), label: 'Weihnachtsferien' },
  ];
}

/** Liefert die Stillstand-Periode, in die `d` fällt, sonst null. */
export function inStillstand(d: Date): Period | null {
  const y = d.getUTCFullYear();
  for (const yr of [y - 1, y, y + 1]) {
    for (const p of stillstandPeriods(yr)) {
      if (within(d, p.start, p.end)) return p;
    }
  }
  return null;
}

// --- Feiertage (Art. 142 Abs. 3) -------------------------------------------
// Baseline (deutschsprachige Kantone). Kantonale Feinheiten sind im Prototyp
// vereinfacht und im UI als solche gekennzeichnet.

export function isFeiertag(d: Date, kanton: Kanton): boolean {
  const y = d.getUTCFullYear();
  const e = ostern(y);
  const set = new Set<number>([
    utc(y, 1, 1).getTime(), // Neujahr
    addDays(e, -2).getTime(), // Karfreitag
    addDays(e, 1).getTime(), // Ostermontag
    addDays(e, 39).getTime(), // Auffahrt
    addDays(e, 50).getTime(), // Pfingstmontag
    utc(y, 8, 1).getTime(), // Bundesfeier
    utc(y, 12, 25).getTime(), // Weihnachten
    utc(y, 12, 26).getTime(), // Stephanstag
  ]);
  if (kanton === 'ZH' || kanton === 'BE') set.add(utc(y, 1, 2).getTime()); // Berchtoldstag
  return set.has(d.getTime());
}

function nextWerktag(d: Date, kanton: Kanton): Date {
  let cur = d;
  while (isWeekend(cur) || isFeiertag(cur, kanton)) cur = addDays(cur, 1);
  return cur;
}

// --- Kernberechnung --------------------------------------------------------

export function computeFrist(input: FristInput): FristResult {
  const { zustellung, dauerTage, stillstandAnwendbar, kanton } = input;
  const schritte: string[] = [];

  let start = addDays(zustellung, 1);
  schritte.push(
    `Zustellung am ${fmtDe(zustellung)} (${wochentag(zustellung)}) zählt nicht — Fristbeginn am Folgetag ${fmtDe(start)} (Art. 142 Abs. 1 ZPO).`,
  );

  if (stillstandAnwendbar) {
    const p = inStillstand(start);
    if (p) {
      const neu = addDays(p.end, 1);
      schritte.push(
        `Fristbeginn fällt in die ${p.label} (Stillstand ${fmtDe(p.start)}–${fmtDe(p.end)}); Frist beginnt am ${fmtDe(neu)} (Art. 146 Abs. 1 ZPO).`,
      );
      start = neu;
    }
  }

  let d = start;
  let counted = 0;
  let stillstandTage = 0;
  for (;;) {
    const inS = stillstandAnwendbar ? inStillstand(d) : null;
    if (inS) {
      stillstandTage++;
    } else {
      counted++;
      if (counted === dauerTage) break;
    }
    d = addDays(d, 1);
  }
  const endeRoh = d;

  if (stillstandTage > 0) {
    schritte.push(
      `${dauerTage} Tage Frist; ${stillstandTage} Tag(e) Gerichtsferien werden nicht mitgezählt (Art. 145 Abs. 1 ZPO) — rechnerischer Ablauf am ${fmtDe(endeRoh)}.`,
    );
  } else {
    schritte.push(
      `${dauerTage} Tage Frist ohne Stillstand — rechnerischer Ablauf am ${fmtDe(endeRoh)} (${wochentag(endeRoh)}).`,
    );
  }

  const ende = nextWerktag(endeRoh, kanton);
  const werktagVerschiebung = ende.getTime() !== endeRoh.getTime();
  if (werktagVerschiebung) {
    schritte.push(
      `Letzter Tag ${fmtDe(endeRoh)} ist ${wochentag(endeRoh)}/Feiertag — Ablauf verschoben auf den nächsten Werktag ${fmtDe(ende)} (Art. 142 Abs. 3 ZPO).`,
    );
  }

  const vorfristen = [14, 7, 3, 1].map((tage) => ({ tage, datum: addDays(ende, -tage) }));

  return { start, endeRoh, ende, stillstandTage, werktagVerschiebung, schritte, vorfristen };
}
