import { describe, expect, it } from 'vitest';
import { runIntake } from './_core';

// Der Kern von /api/chat wird ohne Netzwerk getestet (Mock-Pfad: kein AI_API_KEY).
const NO_KEY = {};

describe('runIntake (Mock-Pfad, wie /api/chat ohne Key)', () => {
  it('lehnt Requests ohne messages ab', async () => {
    await expect(runIntake({ messages: [], lang: 'de' }, NO_KEY)).rejects.toThrow(/messages/);
    await expect(runIntake({} as any, NO_KEY)).rejects.toThrow(/messages/);
  });

  it('erkennt Rechtsgebiet + Frist-Datum aus der ersten Nachricht', async () => {
    const r = await runIntake({
      lang: 'de',
      messages: [{ role: 'user', content: 'Mein Vermieter hat mir am 15.09.2026 die Wohnung gekündigt.' }],
    }, NO_KEY);
    expect(r.mock).toBe(true);
    expect(r.complete).toBe(false);
    expect(r.extracted.rechtsgebiet).toBe('Mietrecht');
    expect(r.extracted.fristHinweis?.datum).toBe('15.09.2026');
    expect(r.reply).toMatch(/Gegenseite/);
  });

  it('fällt bei unbekannter Sprache auf Deutsch zurück', async () => {
    const r = await runIntake({ lang: 'xx' as any, messages: [{ role: 'user', content: 'Hallo' }] }, NO_KEY);
    expect(r.reply).toMatch(/Gegenseite/);
  });

  it('schliesst den Dialog nach fünf Nutzerantworten ab', async () => {
    const r = await runIntake({
      lang: 'fr',
      messages: [
        { role: 'user', content: 'Mon employeur m’a licencié.' },
        { role: 'assistant', content: '…' },
        { role: 'user', content: 'Société Exemple SA' },
        { role: 'assistant', content: '…' },
        { role: 'user', content: 'Le 1er septembre 2026' },
        { role: 'assistant', content: '…' },
        { role: 'user', content: 'très urgent' },
        { role: 'assistant', content: '…' },
        { role: 'user', content: 'test@example.ch' },
      ],
    }, NO_KEY);
    expect(r.complete).toBe(true);
    expect(r.extracted.rechtsgebiet).toBe('Droit du travail');
    expect(r.extracted.kontakt).toBe('test@example.ch');
    expect(r.reply).toMatch(/enregistrée/);
  });
});
