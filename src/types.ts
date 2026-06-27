// Geteilte Typen für Frontend und API-Proxy (bewusst framework-agnostisch).

export type Lang = 'de' | 'fr' | 'it';

export type Role = 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

/** Strukturierte Mandatsanfrage, die der Intake-Dialog Stück für Stück befüllt. */
export interface IntakeExtracted {
  rechtsgebiet: string;
  parteien: string;
  sachverhalt: string;
  dringlichkeit: string;
  kontakt: string;
  /** Optionaler Frist-Hinweis, sobald ein Datum/fristrelevanter Begriff erkannt wird. */
  fristHinweis: { datum: string; hinweis: string } | null;
}

export interface IntakeResult {
  reply: string;
  extracted: IntakeExtracted;
  complete: boolean;
  /** true, wenn die Antwort aus dem lokalen Mock kam (kein echter KI-Call). */
  mock: boolean;
}

export interface ChatRequest {
  messages: ChatMessage[];
  lang: Lang;
}

export function emptyExtracted(): IntakeExtracted {
  return {
    rechtsgebiet: '',
    parteien: '',
    sachverhalt: '',
    dringlichkeit: '',
    kontakt: '',
    fristHinweis: null,
  };
}
