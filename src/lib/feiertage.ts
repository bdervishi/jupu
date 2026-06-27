// Kantonale Feiertage der Schweiz (für Art. 142 Abs. 3 ZPO u. a.).
//
// WICHTIG / ehrlicher Hinweis: Abgebildet sind die KANTONSWEIT anerkannten Feiertage
// (best effort). INNERKANTONALE / regionale Unterschiede (v. a. katholische Feiertage in
// AG, GR, SG, SO) sowie die genaue Gleichstellung mit Sonntagen je Gerichtskreis sind
// vereinfacht und müssen für den konkreten Fall verifiziert werden.

import { addDays, utc } from './datelib';

export type Kanton =
  | 'AG' | 'AI' | 'AR' | 'BE' | 'BL' | 'BS' | 'FR' | 'GE' | 'GL' | 'GR'
  | 'JU' | 'LU' | 'NE' | 'NW' | 'OW' | 'SG' | 'SH' | 'SO' | 'SZ' | 'TG'
  | 'TI' | 'UR' | 'VD' | 'VS' | 'ZG' | 'ZH' | 'CH';

export const KANTONE: Kanton[] = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
  'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH', 'CH',
];

type Spec =
  | { kind: 'fixed'; m: number; d: number }
  | { kind: 'easter'; off: number }
  | { kind: 'special'; fn: (y: number) => Date };

// Bewegliche kantonale Feiertage
function firstWeekdayOfMonth(y: number, m1: number, weekday: number): Date {
  let d = utc(y, m1, 1);
  while (d.getUTCDay() !== weekday) d = addDays(d, 1);
  return d;
}
const naefelserFahrt = (y: number) => firstWeekdayOfMonth(y, 4, 4); // 1. Donnerstag April (GL)
const jeuneGenevois = (y: number) => addDays(firstWeekdayOfMonth(y, 9, 0), 4); // Do nach 1. So Sept (GE)
const lundiDuJeune = (y: number) => addDays(firstWeekdayOfMonth(y, 9, 0), 15); // Mo nach 3. So Sept (VD)

// Wiederverwendbare Definitionen
const NEUJAHR: Spec = { kind: 'fixed', m: 1, d: 1 };
const BERCHTOLD: Spec = { kind: 'fixed', m: 1, d: 2 };
const DREIKOENIGE: Spec = { kind: 'fixed', m: 1, d: 6 };
const REPUBLIK_NE: Spec = { kind: 'fixed', m: 3, d: 1 };
const JOSEF: Spec = { kind: 'fixed', m: 3, d: 19 };
const KARFREITAG: Spec = { kind: 'easter', off: -2 };
const OSTERMONTAG: Spec = { kind: 'easter', off: 1 };
const TAG_DER_ARBEIT: Spec = { kind: 'fixed', m: 5, d: 1 };
const AUFFAHRT: Spec = { kind: 'easter', off: 39 };
const PFINGSTMONTAG: Spec = { kind: 'easter', off: 50 };
const FRONLEICHNAM: Spec = { kind: 'easter', off: 60 };
const UNABH_JU: Spec = { kind: 'fixed', m: 6, d: 23 };
const PETER_PAUL: Spec = { kind: 'fixed', m: 6, d: 29 };
const BUNDESFEIER: Spec = { kind: 'fixed', m: 8, d: 1 };
const MARIA_HIMMELFAHRT: Spec = { kind: 'fixed', m: 8, d: 15 };
const BRUDER_KLAUS: Spec = { kind: 'fixed', m: 9, d: 25 };
const ALLERHEILIGEN: Spec = { kind: 'fixed', m: 11, d: 1 };
const MARIA_EMPFAENGNIS: Spec = { kind: 'fixed', m: 12, d: 8 };
const WEIHNACHTEN: Spec = { kind: 'fixed', m: 12, d: 25 };
const STEPHAN: Spec = { kind: 'fixed', m: 12, d: 26 };
const RESTAURATION_GE: Spec = { kind: 'fixed', m: 12, d: 31 };
const NAEFELSER: Spec = { kind: 'special', fn: naefelserFahrt };
const JEUNE_GE: Spec = { kind: 'special', fn: jeuneGenevois };
const LUNDI_JEUNE: Spec = { kind: 'special', fn: lundiDuJeune };

const CANTON_HOLIDAYS: Record<Kanton, Spec[]> = {
  AG: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  AI: [NEUJAHR, KARFREITAG, OSTERMONTAG, AUFFAHRT, FRONLEICHNAM, PFINGSTMONTAG, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  AR: [NEUJAHR, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  BE: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  BL: [NEUJAHR, KARFREITAG, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  BS: [NEUJAHR, KARFREITAG, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  FR: [NEUJAHR, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  GE: [NEUJAHR, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, JEUNE_GE, WEIHNACHTEN, RESTAURATION_GE],
  GL: [NEUJAHR, BERCHTOLD, NAEFELSER, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, ALLERHEILIGEN, WEIHNACHTEN, STEPHAN],
  GR: [NEUJAHR, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  JU: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, FRONLEICHNAM, UNABH_JU, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, WEIHNACHTEN, STEPHAN],
  LU: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  NE: [NEUJAHR, REPUBLIK_NE, KARFREITAG, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  NW: [NEUJAHR, JOSEF, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  OW: [NEUJAHR, JOSEF, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, BRUDER_KLAUS, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  SG: [NEUJAHR, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, ALLERHEILIGEN, WEIHNACHTEN, STEPHAN],
  SH: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  SO: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, AUFFAHRT, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  SZ: [NEUJAHR, DREIKOENIGE, JOSEF, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  TG: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  TI: [NEUJAHR, DREIKOENIGE, JOSEF, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, PETER_PAUL, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  UR: [NEUJAHR, DREIKOENIGE, JOSEF, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  VD: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, LUNDI_JEUNE, WEIHNACHTEN],
  VS: [NEUJAHR, JOSEF, AUFFAHRT, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN],
  ZG: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, FRONLEICHNAM, BUNDESFEIER, MARIA_HIMMELFAHRT, ALLERHEILIGEN, MARIA_EMPFAENGNIS, WEIHNACHTEN, STEPHAN],
  ZH: [NEUJAHR, BERCHTOLD, KARFREITAG, OSTERMONTAG, TAG_DER_ARBEIT, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
  // 'CH' = breiter, in (nahezu) allen Kantonen geltender Satz (generischer Fallback).
  CH: [NEUJAHR, KARFREITAG, OSTERMONTAG, AUFFAHRT, PFINGSTMONTAG, BUNDESFEIER, WEIHNACHTEN, STEPHAN],
};

function specDate(spec: Spec, year: number, easter: Date): Date {
  if (spec.kind === 'fixed') return utc(year, spec.m, spec.d);
  if (spec.kind === 'easter') return addDays(easter, spec.off);
  return spec.fn(year);
}

const cache = new Map<string, Set<number>>();

export function feiertageSet(year: number, kanton: Kanton): Set<number> {
  const key = `${year}:${kanton}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // Ostern lokal, ohne Zirkularimport
  const easter = (() => {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return utc(year, month, day);
  })();
  const set = new Set<number>();
  for (const spec of CANTON_HOLIDAYS[kanton] || CANTON_HOLIDAYS.CH) {
    set.add(specDate(spec, year, easter).getTime());
  }
  cache.set(key, set);
  return set;
}

export function isFeiertag(d: Date, kanton: Kanton): boolean {
  return feiertageSet(d.getUTCFullYear(), kanton).has(d.getTime());
}
