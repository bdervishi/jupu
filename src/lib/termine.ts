// Frist ↔ Akte/Kalender: macht aus einem Fristen-Ergebnis (src/lib/fristen.ts)
// konkrete Kalendereinträge — die Hauptfrist plus Vorfristen (T-14/7/3/1) als
// Wiedervorlagen. Bewusst deterministisch und ohne LLM (haftungskritisch).
//
// Regeln:
//  - Die Hauptfrist bleibt exakt auf dem berechneten Fristablauf (Werktagsregel
//    ist dort bereits angewandt).
//  - Eine Vorfrist, die auf Sa/So/Feiertag fällt, wird auf den VORHERIGEN Werktag
//    vorgezogen (nie nach hinten: eine Wiedervorlage darf nie näher an den Ablauf
//    rücken als geplant). Die Verschiebung wird im Termin dokumentiert.
//  - Termin-IDs sind aus Akte + Frist + Typ abgeleitet → wiederholtes Anlegen
//    erzeugt keine Duplikate (upsertTermine), der Status bleibt erhalten.

import { addDays, fmtDe, iso, isWeekend, utc } from './datelib';
import { isFeiertag, type Kanton } from './feiertage';
import type { FristResult, Verfahren } from './fristen';

export type TerminTyp = 'frist' | 'vorfrist';
export type TerminStatus = 'offen' | 'erledigt';

export interface Akte {
  id: string;
  aktenzeichen: string;
  bezeichnung: string;
  /** ISO-Datum der Anlage. */
  angelegt: string;
}

export interface Termin {
  /** Deterministisch: `${akteId}:${fristId}:${typ}:${tageVorher}` */
  id: string;
  akteId: string;
  /** Gruppiert Hauptfrist + Vorfristen derselben Frist. */
  fristId: string;
  typ: TerminTyp;
  titel: string;
  /** ISO-Datum (ganztägig). */
  datum: string;
  /** 0 bei der Hauptfrist, sonst 14/7/3/1. */
  tageVorher: number;
  /** Gesetzt, wenn eine Vorfrist auf den vorherigen Werktag vorgezogen wurde. */
  verschoben?: { von: string; grund: string };
  beschreibung: string;
  status: TerminStatus;
}

export interface FristKontext {
  akteId: string;
  /** z. B. "Berufung" oder "Eigene Frist (20 Tage)". */
  label: string;
  /** z. B. "Art. 311 Abs. 1 ZPO". */
  grundlage: string;
  verfahren: Verfahren;
  kanton: Kanton;
  zustellung: Date;
}

export interface TermineOptions {
  /** Vorfristen auf den vorherigen Werktag vorziehen (Standard: true). */
  vorfristenAufWerktag?: boolean;
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'frist';
}

/** Wandelt ein erkanntes CH-Datum ("30.09.2026", "30/9/26") in ISO um. */
export function deDateToIso(s: string): string | null {
  const m = s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = utc(y, mo, d);
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null; // z. B. 31.02.
  return iso(date);
}

export function parseIso(s: string): Date | null {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return utc(y, m, d);
}

function vorherigerWerktag(d: Date, kanton: Kanton): Date {
  let cur = d;
  while (isWeekend(cur) || isFeiertag(cur, kanton)) cur = addDays(cur, -1);
  return cur;
}

export function fristIdFor(ctx: Pick<FristKontext, 'verfahren' | 'label' | 'zustellung'>): string {
  return `${ctx.verfahren.toLowerCase()}-${slug(ctx.label)}-${iso(ctx.zustellung)}`;
}

// ---------------------------------------------------------------------------
// Kern: Frist → Termine
// ---------------------------------------------------------------------------

export function termineAusFrist(result: FristResult, ctx: FristKontext, opts: TermineOptions = {}): Termin[] {
  const aufWerktag = opts.vorfristenAufWerktag ?? true;
  const fristId = fristIdFor(ctx);
  const kopf = `${ctx.label} (${ctx.verfahren}, ${ctx.grundlage}) · Zustellung ${fmtDe(ctx.zustellung)} · Kanton ${ctx.kanton}`;
  const schritte = result.schritte.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const haupt: Termin = {
    id: `${ctx.akteId}:${fristId}:frist:0`,
    akteId: ctx.akteId,
    fristId,
    typ: 'frist',
    titel: `FRISTABLAUF ${ctx.label}`,
    datum: iso(result.ende),
    tageVorher: 0,
    beschreibung: `${kopf}\nFristablauf: ${fmtDe(result.ende)}\n\nBerechnung:\n${schritte}`,
    status: 'offen',
  };

  const vorfristen: Termin[] = result.vorfristen.map((v) => {
    const geplant = v.datum;
    const effektiv = aufWerktag ? vorherigerWerktag(geplant, ctx.kanton) : geplant;
    const verschoben = effektiv.getTime() !== geplant.getTime()
      ? { von: iso(geplant), grund: `${fmtDe(geplant)} ist Wochenende/Feiertag — Wiedervorlage auf den vorherigen Werktag vorgezogen.` }
      : undefined;
    return {
      id: `${ctx.akteId}:${fristId}:vorfrist:${v.tage}`,
      akteId: ctx.akteId,
      fristId,
      typ: 'vorfrist',
      titel: `Wiedervorlage T-${v.tage}: ${ctx.label}`,
      datum: iso(effektiv),
      tageVorher: v.tage,
      ...(verschoben ? { verschoben } : {}),
      beschreibung: `${kopf}\nVorfrist ${v.tage} Tage vor Fristablauf ${fmtDe(result.ende)}.${verschoben ? `\n${verschoben.grund}` : ''}`,
      status: 'offen',
    };
  });

  return sortTermine([...vorfristen, haupt]);
}

/** Fügt Termine idempotent ein: gleiche ID → Datum/Text aktualisiert, Status bleibt. */
export function upsertTermine(existing: Termin[], neu: Termin[]): Termin[] {
  const byId = new Map(existing.map((t) => [t.id, t] as const));
  for (const t of neu) {
    const alt = byId.get(t.id);
    byId.set(t.id, alt ? { ...t, status: alt.status } : t);
  }
  return sortTermine([...byId.values()]);
}

export function sortTermine(termine: Termin[]): Termin[] {
  return [...termine].sort((a, b) =>
    a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : b.tageVorher - a.tageVorher);
}

/** Wie viele Tage bis zum Termin (negativ = überfällig), bezogen auf `heute` (UTC-Datum). */
export function tageBis(termin: Termin, heute: Date): number {
  const d = parseIso(termin.datum);
  if (!d) return 0;
  const h = utc(heute.getUTCFullYear(), heute.getUTCMonth() + 1, heute.getUTCDate());
  return Math.round((d.getTime() - h.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// ICS-Export (RFC 5545) — Brücke zu Outlook / Google / Kanzleisoftware
// ---------------------------------------------------------------------------

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen auf 75 Oktette falten (RFC 5545 §3.1), vereinfacht auf Zeichen. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

function icsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

export interface IcsOptions {
  /** Feste DTSTAMP für reproduzierbare Ausgaben (Standard: jetzt). */
  dtstamp?: Date;
  akten?: Akte[];
}

export function toIcs(termine: Termin[], opts: IcsOptions = {}): string {
  const stamp = (opts.dtstamp ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const aktenById = new Map((opts.akten ?? []).map((a) => [a.id, a] as const));
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AdvoOS//Fristen-Kalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const t of sortTermine(termine)) {
    const akte = aktenById.get(t.akteId);
    const prefix = akte ? `[${akte.aktenzeichen}] ` : '';
    const ende = addDays(parseIso(t.datum) ?? new Date(0), 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@advoos`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(t.datum)}`,
      `DTEND;VALUE=DATE:${icsDate(iso(ende))}`,
      `SUMMARY:${icsEscape(prefix + t.titel)}`,
      `DESCRIPTION:${icsEscape((akte ? `Akte: ${akte.aktenzeichen} ${akte.bezeichnung}\n` : '') + t.beschreibung)}`,
      `CATEGORIES:${t.typ === 'frist' ? 'Frist' : 'Wiedervorlage'}`,
      `STATUS:${t.status === 'erledigt' ? 'CANCELLED' : 'CONFIRMED'}`,
      ...(t.typ === 'frist' ? ['PRIORITY:1'] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
