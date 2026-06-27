import { describe, expect, it } from 'vitest';
import { addDays, computeFrist, iso, ostern, utc, type FristInput } from './fristen';
import { isFeiertag } from './feiertage';

function inp(p: Partial<FristInput> & { zustellung: Date }): FristInput {
  return {
    dauer: 30, einheit: 'Tage', stillstandAnwendbar: true, kanton: 'ZH', verfahren: 'ZPO',
    ...p,
  };
}

describe('ostern (Meeus/Jones/Butcher)', () => {
  it('berechnet bekannte Osterdaten', () => {
    expect(iso(ostern(2025))).toBe('2025-04-20');
    expect(iso(ostern(2026))).toBe('2026-04-05');
    expect(iso(ostern(2027))).toBe('2027-03-28');
  });
});

describe('ZPO — Tagesfristen (Art. 142/145/146)', () => {
  it('A: 30 Tage ohne Stillstand-Fenster → Folgetag-Regel', () => {
    const z = utc(2026, 2, 2);
    const r = computeFrist(inp({ zustellung: z }));
    expect(iso(r.start)).toBe('2026-02-03');
    expect(r.stillstandTage).toBe(0);
    expect(r.werktagVerschiebung).toBe(false);
    expect(iso(r.ende)).toBe('2026-03-04');
    expect(iso(r.ende)).toBe(iso(addDays(z, 30))); // unabhängige Kontrolle
  });

  it('B: Sommer-Stillstand verlängert um 32 Tage', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 7, 2) }));
    expect(r.stillstandTage).toBe(32);
    expect(iso(r.ende)).toBe('2026-09-02');
  });

  it('C: ohne Stillstand, Ablauf 1.8 (Bundesfeier+Sa) → nächster Werktag', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 7, 2), stillstandAnwendbar: false }));
    expect(r.stillstandTage).toBe(0);
    expect(r.werktagVerschiebung).toBe(true);
    expect(iso(r.ende)).toBe('2026-08-03');
  });

  it('D: Zustellung im Stillstand → Beginn nach Stillstand (Art. 146 I)', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 7, 20) }));
    expect(iso(r.start)).toBe('2026-08-16');
    expect(iso(r.ende)).toBe('2026-09-14');
    expect(r.schritte.some((s) => s.includes('Art. 146 Abs. 1 ZPO'))).toBe(true);
  });

  it('E: Weihnachts-Stillstand = 16 Tage', () => {
    const r = computeFrist(inp({ zustellung: utc(2025, 12, 10) }));
    expect(r.stillstandTage).toBe(16);
    expect(iso(r.ende)).toBe('2026-01-26');
  });

  it('F: Oster-Stillstand = 15 Tage', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 3, 20) }));
    expect(r.stillstandTage).toBe(15);
    expect(iso(r.ende)).toBe('2026-05-04');
  });

  it('G: 10-Tage-Frist, Ablauf Sonntag → Montag', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 2, 26), dauer: 10, stillstandAnwendbar: false }));
    expect(r.werktagVerschiebung).toBe(true);
    expect(iso(r.ende)).toBe('2026-03-09');
  });
});

describe('StPO / VwVG / BGG', () => {
  it('StPO kennt keinen Stillstand (auch wenn aktiviert)', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 7, 2), dauer: 10, verfahren: 'StPO', stillstandAnwendbar: true }));
    expect(r.stillstandTage).toBe(0);
    expect(iso(r.ende)).toBe('2026-07-13');
    expect(r.schritte.some((s) => s.includes('Art. 90 Abs. 1 StPO'))).toBe(true);
  });

  it('VwVG hat Stillstand nach Art. 22a (wie ZPO)', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 7, 2), verfahren: 'VwVG' }));
    expect(r.stillstandTage).toBe(32);
    expect(iso(r.ende)).toBe('2026-09-02');
    expect(r.schritte.some((s) => s.includes('Art. 22a Abs. 1 VwVG'))).toBe(true);
  });
});

describe('Monatsfristen (Art. 142 II)', () => {
  it('3 Monate mit Oster-Stillstand', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 1, 15), dauer: 3, einheit: 'Monate' }));
    expect(r.monatsregel).toBe(true);
    expect(r.stillstandTage).toBe(15);
    expect(iso(r.ende)).toBe('2026-04-30');
  });

  it('1 Monat ab 31.01 → Monatsende 28.02 (Sa) → 02.03', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 1, 31), dauer: 1, einheit: 'Monate', stillstandAnwendbar: false }));
    expect(iso(r.endeRoh)).toBe('2026-02-28');
    expect(iso(r.ende)).toBe('2026-03-02');
  });
});

describe('Kantonale Feiertage', () => {
  it('berücksichtigt kantonale Unterschiede', () => {
    expect(isFeiertag(utc(2026, 1, 6), 'TI')).toBe(true); // Heilige Drei Könige
    expect(isFeiertag(utc(2026, 1, 6), 'ZH')).toBe(false);
    expect(isFeiertag(utc(2026, 4, 3), 'VS')).toBe(false); // VS kein Karfreitag
    expect(isFeiertag(utc(2026, 4, 3), 'ZH')).toBe(true); // ZH Karfreitag
    expect(isFeiertag(utc(2026, 12, 26), 'GE')).toBe(false); // GE kein Stephanstag
    expect(isFeiertag(utc(2026, 12, 31), 'GE')).toBe(true); // Restauration GE
    expect(isFeiertag(utc(2026, 8, 1), 'ZH')).toBe(true); // Bundesfeier überall
  });

  it('Vorfristen sind 14/7/3/1 Tage vor Ablauf', () => {
    const r = computeFrist(inp({ zustellung: utc(2026, 2, 2) }));
    expect(r.vorfristen.map((v) => v.tage)).toEqual([14, 7, 3, 1]);
    expect(iso(r.vorfristen[0].datum)).toBe(iso(addDays(r.ende, -14)));
  });
});
