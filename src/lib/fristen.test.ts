import { describe, expect, it } from 'vitest';
import { addDays, computeFrist, iso, ostern, utc, type Kanton } from './fristen';

const ZH: Kanton = 'ZH';

describe('ostern (Meeus/Jones/Butcher)', () => {
  it('berechnet bekannte Osterdaten', () => {
    expect(iso(ostern(2025))).toBe('2025-04-20');
    expect(iso(ostern(2026))).toBe('2026-04-05');
    expect(iso(ostern(2027))).toBe('2027-03-28');
  });
});

describe('computeFrist — Art. 142/145/146 ZPO', () => {
  it('A: 30 Tage ohne Stillstand-Fenster, kein Wochenende → Folgetag-Regel', () => {
    const z = utc(2026, 2, 2); // Montag
    const r = computeFrist({ zustellung: z, dauerTage: 30, stillstandAnwendbar: true, kanton: ZH });
    expect(iso(r.start)).toBe('2026-02-03');
    expect(r.stillstandTage).toBe(0);
    expect(r.werktagVerschiebung).toBe(false);
    expect(iso(r.ende)).toBe('2026-03-04');
    // Unabhängige Kontrolle: ohne Pause/Verschiebung gilt Ende = Zustellung + Dauer.
    expect(iso(r.ende)).toBe(iso(addDays(z, 30)));
  });

  it('B: Sommer-Stillstand (15.7–15.8) verlängert um 32 Tage', () => {
    const r = computeFrist({ zustellung: utc(2026, 7, 2), dauerTage: 30, stillstandAnwendbar: true, kanton: ZH });
    expect(r.stillstandTage).toBe(32);
    expect(iso(r.ende)).toBe('2026-09-02');
  });

  it('C: summarisch (kein Stillstand) — Ablauf am 1.8 (Bundesfeier+Sa) → nächster Werktag', () => {
    const r = computeFrist({ zustellung: utc(2026, 7, 2), dauerTage: 30, stillstandAnwendbar: false, kanton: ZH });
    expect(r.stillstandTage).toBe(0);
    expect(r.werktagVerschiebung).toBe(true);
    expect(iso(r.ende)).toBe('2026-08-03');
  });

  it('D: Zustellung während Stillstand → Beginn am 1. Tag nach Stillstand (Art. 146 I)', () => {
    const r = computeFrist({ zustellung: utc(2026, 7, 20), dauerTage: 30, stillstandAnwendbar: true, kanton: ZH });
    expect(iso(r.start)).toBe('2026-08-16');
    expect(iso(r.ende)).toBe('2026-09-14');
    expect(r.schritte.some((s) => s.includes('Art. 146 Abs. 1 ZPO'))).toBe(true);
  });

  it('E: Weihnachts-Stillstand (18.12–2.1) = 16 Tage, Ende auf Werktag verschoben', () => {
    const r = computeFrist({ zustellung: utc(2025, 12, 10), dauerTage: 30, stillstandAnwendbar: true, kanton: ZH });
    expect(r.stillstandTage).toBe(16);
    expect(r.werktagVerschiebung).toBe(true);
    expect(iso(r.ende)).toBe('2026-01-26');
  });

  it('F: Oster-Stillstand (±7 Tage um Ostern) = 15 Tage', () => {
    const r = computeFrist({ zustellung: utc(2026, 3, 20), dauerTage: 30, stillstandAnwendbar: true, kanton: ZH });
    expect(r.stillstandTage).toBe(15);
    expect(iso(r.ende)).toBe('2026-05-04');
  });

  it('G: 10-Tage-Frist, Ablauf am Sonntag → Montag (Art. 142 III)', () => {
    const r = computeFrist({ zustellung: utc(2026, 2, 26), dauerTage: 10, stillstandAnwendbar: false, kanton: ZH });
    expect(r.werktagVerschiebung).toBe(true);
    expect(iso(r.ende)).toBe('2026-03-09');
  });

  it('liefert vier absteigende Vorfristen vor dem Ablauf', () => {
    const r = computeFrist({ zustellung: utc(2026, 2, 2), dauerTage: 30, stillstandAnwendbar: true, kanton: ZH });
    expect(r.vorfristen.map((v) => v.tage)).toEqual([14, 7, 3, 1]);
    expect(iso(r.vorfristen[0].datum)).toBe(iso(addDays(r.ende, -14)));
  });
});
