// React-Hook um den Kalender-Store: Akten + Termine, persistiert im Browser.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadKalender, naechstesAktenzeichen, saveKalender, type KalenderState } from './kalenderStore';
import { upsertTermine, type Akte, type Termin, type TerminStatus } from './termine';

export interface KalenderApi {
  state: KalenderState;
  offen: number;
  /** Legt Termine an; `akte` ohne id → neue Akte wird erzeugt. Liefert die Akte zurück. */
  termineAnlegen: (termine: Termin[], akte: Akte | { aktenzeichen?: string; bezeichnung: string }) => Akte;
  setStatus: (terminId: string, status: TerminStatus) => void;
  fristLoeschen: (akteId: string, fristId: string) => void;
  akteLoeschen: (akteId: string) => void;
  alleLoeschen: () => void;
}

function newId(): string {
  return `akte-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useKalender(): KalenderApi {
  const [state, setState] = useState<KalenderState>(() => loadKalender());
  useEffect(() => { saveKalender(state); }, [state]);

  const termineAnlegen = useCallback<KalenderApi['termineAnlegen']>((termine, akteIn) => {
    let akte: Akte;
    if ('id' in akteIn && akteIn.id) {
      akte = akteIn as Akte;
    } else {
      akte = {
        id: newId(),
        aktenzeichen: akteIn.aktenzeichen?.trim() || naechstesAktenzeichen(state.akten),
        bezeichnung: akteIn.bezeichnung.trim() || 'Neue Akte',
        angelegt: new Date().toISOString().slice(0, 10),
      };
    }
    const mitAkte = termine.map((t) => ({ ...t, akteId: akte.id, id: t.id.replace(/^[^:]*:/, `${akte.id}:`) }));
    setState((s) => ({
      akten: s.akten.some((a) => a.id === akte.id) ? s.akten : [...s.akten, akte],
      termine: upsertTermine(s.termine, mitAkte),
    }));
    return akte;
  }, [state.akten]);

  const setStatus = useCallback((terminId: string, status: TerminStatus) => {
    setState((s) => ({ ...s, termine: s.termine.map((t) => (t.id === terminId ? { ...t, status } : t)) }));
  }, []);

  const fristLoeschen = useCallback((akteId: string, fristId: string) => {
    setState((s) => ({ ...s, termine: s.termine.filter((t) => !(t.akteId === akteId && t.fristId === fristId)) }));
  }, []);

  const akteLoeschen = useCallback((akteId: string) => {
    setState((s) => ({ akten: s.akten.filter((a) => a.id !== akteId), termine: s.termine.filter((t) => t.akteId !== akteId) }));
  }, []);

  const alleLoeschen = useCallback(() => setState({ akten: [], termine: [] }), []);

  const offen = useMemo(() => state.termine.filter((t) => t.status === 'offen').length, [state.termine]);

  return { state, offen, termineAnlegen, setStatus, fristLoeschen, akteLoeschen, alleLoeschen };
}
