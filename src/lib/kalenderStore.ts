// Persistenz für Akten + Termine — im MVP bewusst nur im Browser (localStorage).
// Demo mit Dummy-Daten; im Produktivbetrieb ersetzt ein CH-gehosteter Dienst
// (Kanzleisoftware / CalDAV) diese Schicht. Die Domänenlogik (termine.ts) bleibt gleich.

import type { Akte, Termin } from './termine';

export interface KalenderState {
  akten: Akte[];
  termine: Termin[];
}

const KEY = 'advoos.kalender.v1';

export const EMPTY_STATE: KalenderState = { akten: [], termine: [] };

export function loadKalender(storage: Storage | undefined = safeStorage()): KalenderState {
  if (!storage) return EMPTY_STATE;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.akten) || !Array.isArray(parsed?.termine)) return EMPTY_STATE;
    return { akten: parsed.akten, termine: parsed.termine };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveKalender(state: KalenderState, storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Quota / Privatmodus: Demo läuft ohne Persistenz weiter */
  }
}

/** Nächstes freies Aktenzeichen im Schema JJJJ-NNN. */
export function naechstesAktenzeichen(akten: Akte[], jahr = new Date().getUTCFullYear()): string {
  const prefix = `${jahr}-`;
  const max = akten
    .map((a) => a.aktenzeichen)
    .filter((az) => az.startsWith(prefix))
    .map((az) => Number(az.slice(prefix.length)) || 0)
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
