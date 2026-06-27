// Gemeinsame Datums-Helfer (UTC, keine Zeitzonen-/DST-Effekte).

export const DAY = 86_400_000;
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
export function isWeekend(d: Date): boolean {
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}
export function within(d: Date, start: Date, end: Date): boolean {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/** Ostersonntag (gregorianisch, Meeus/Jones/Butcher). */
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
