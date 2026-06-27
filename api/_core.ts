// Framework-agnostischer Kern des Intake-Proxys.
// Wird von BEIDEN Laufzeiten genutzt: der Vercel-Function (api/chat.ts) und dem
// Vite-Dev-Middleware (vite.config.ts). So läuft `npm run dev` ohne Vercel.
//
// Verhalten:
//  - Ist AI_API_KEY gesetzt  -> echter Call an einen OpenAI-kompatiblen CH-Endpoint
//    (z. B. Infomaniak AI). Muster gespiegelt aus SwissBrokerOS backend/src/openaiCompat.ts.
//  - Sonst                    -> lokaler, regelbasierter Mock (kostenlos, offline).

import type { ChatMessage, ChatRequest, IntakeExtracted, IntakeResult, Lang } from '../src/types';
import { emptyExtracted } from '../src/types';

export interface CoreEnv {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}

// ---------------------------------------------------------------------------
// Lokalisierte Gesprächsbausteine (DE/FR/IT)
// ---------------------------------------------------------------------------

const ASK: Record<Lang, { parteien: string; wann: string; dringlichkeit: string; kontakt: string; fertig: string }> = {
  de: {
    parteien: 'Danke. Wer ist auf der Gegenseite beteiligt (Name der Person oder Firma)?',
    wann: 'Verstanden. Wann ist das passiert bzw. liegt ein Schreiben mit einem Datum oder einer Frist vor?',
    dringlichkeit: 'Wie dringend ist Ihr Anliegen (z. B. sehr dringend / diese Woche / unverbindliche Erstabklärung)?',
    kontakt: 'Zum Schluss: Wie können wir Sie erreichen (E-Mail oder Telefon)?',
    fertig: 'Vielen Dank — Ihre Anfrage ist erfasst. Die Kanzlei meldet sich zeitnah bei Ihnen.',
  },
  fr: {
    parteien: 'Merci. Qui est la partie adverse (nom de la personne ou de l’entreprise) ?',
    wann: 'Compris. Quand cela s’est-il produit, ou disposez-vous d’un courrier avec une date ou un délai ?',
    dringlichkeit: 'Quelle est l’urgence de votre demande (très urgent / cette semaine / première évaluation sans engagement) ?',
    kontakt: 'Pour terminer : comment pouvons-nous vous joindre (e-mail ou téléphone) ?',
    fertig: 'Merci — votre demande est enregistrée. L’étude vous contactera prochainement.',
  },
  it: {
    parteien: 'Grazie. Chi è la controparte (nome della persona o dell’azienda)?',
    wann: 'Capito. Quando è successo, oppure ha una lettera con una data o un termine?',
    dringlichkeit: 'Quanto è urgente la sua richiesta (molto urgente / questa settimana / prima valutazione senza impegno)?',
    kontakt: 'Per finire: come possiamo contattarla (e-mail o telefono)?',
    fertig: 'Grazie — la sua richiesta è stata registrata. Lo studio la contatterà a breve.',
  },
};

type AreaKey = 'mietrecht' | 'arbeitsrecht' | 'familienrecht' | 'strafrecht' | 'erbrecht' | 'haftpflicht' | 'vertragsrecht' | 'allgemein';

const AREA_LABEL: Record<Lang, Record<AreaKey, string>> = {
  de: { mietrecht: 'Mietrecht', arbeitsrecht: 'Arbeitsrecht', familienrecht: 'Familienrecht', strafrecht: 'Strafrecht', erbrecht: 'Erbrecht', haftpflicht: 'Haftpflicht / Versicherung', vertragsrecht: 'Vertragsrecht', allgemein: 'Allgemeine Anfrage' },
  fr: { mietrecht: 'Droit du bail', arbeitsrecht: 'Droit du travail', familienrecht: 'Droit de la famille', strafrecht: 'Droit pénal', erbrecht: 'Droit successoral', haftpflicht: 'Responsabilité civile', vertragsrecht: 'Droit des contrats', allgemein: 'Demande générale' },
  it: { mietrecht: 'Diritto di locazione', arbeitsrecht: 'Diritto del lavoro', familienrecht: 'Diritto di famiglia', strafrecht: 'Diritto penale', erbrecht: 'Diritto successorio', haftpflicht: 'Responsabilità civile', vertragsrecht: 'Diritto contrattuale', allgemein: 'Richiesta generale' },
};

const AREA_KEYWORDS: Array<[AreaKey, string[]]> = [
  ['mietrecht', ['miete', 'mietvertrag', 'vermieter', 'wohnung', 'loyer', 'bail', 'locataire', 'affitto', 'locazione']],
  ['arbeitsrecht', ['arbeit', 'lohn', 'arbeitgeber', 'entlass', 'kündigung arbeit', 'travail', 'licenci', 'employeur', 'emploi', 'salaire', 'lavoro', 'licenzi', 'datore di lavoro']],
  ['familienrecht', ['scheidung', 'ehe', 'trennung', 'unterhalt', 'sorgerecht', 'divorce', 'mariage', 'divorzio', 'matrimonio', 'alimenti']],
  ['strafrecht', ['straf', 'anzeige', 'polizei', 'beschuldig', 'pénal', 'penal', 'plainte', 'denuncia', 'penale']],
  ['erbrecht', ['erb', 'testament', 'nachlass', 'héritage', 'succession', 'eredità', 'successione']],
  ['haftpflicht', ['unfall', 'schaden', 'haftung', 'versicherung', 'accident', 'dommage', 'incidente', 'danno', 'assurance']],
  ['vertragsrecht', ['vertrag', 'rechnung', 'contrat', 'facture', 'contratto', 'fattura']],
];

const FRIST_KEYWORDS = ['frist', 'kündigung', 'vorladung', 'verfügung', 'urteil', 'mahnung', 'délai', 'citation', 'jugement', 'termine', 'scadenza', 'citazione', 'sentenza'];
const DATE_RE = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// Schweizer Telefonformat (+41… / 0…) — verhindert, dass z. B. ein Datum als Nummer gilt.
const PHONE_RE = /(?:\+41|0)\d[\d\s()/.\-]{7,}\d/;

function detectArea(text: string): AreaKey {
  const t = text.toLowerCase();
  for (const [key, words] of AREA_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return key;
  }
  return 'allgemein';
}

function detectFrist(text: string, lang: Lang): IntakeExtracted['fristHinweis'] {
  const t = text.toLowerCase();
  const date = text.match(DATE_RE)?.[0] ?? '';
  const hasKeyword = FRIST_KEYWORDS.some((w) => t.includes(w));
  if (!date && !hasKeyword) return null;
  const hinweis = {
    de: 'Mögliche Frist erkannt — bitte anwaltlich prüfen und Fristenlauf berechnen.',
    fr: 'Délai possible détecté — à vérifier par l’avocat et à calculer.',
    it: 'Possibile termine rilevato — da verificare e calcolare dall’avvocato.',
  }[lang];
  return { datum: date, hinweis };
}

function detectContact(text: string): string {
  return text.match(EMAIL_RE)?.[0] || text.match(PHONE_RE)?.[0] || '';
}

// ---------------------------------------------------------------------------
// Mock-Intake (kostenlos, offline) — gesprächsschrittbasiert
// ---------------------------------------------------------------------------

function mockIntake(req: ChatRequest): IntakeResult {
  const { lang } = req;
  const userMsgs = req.messages.filter((m) => m.role === 'user').map((m) => m.content.trim());
  const n = userMsgs.length;
  const allText = userMsgs.join('  ');

  const extracted = emptyExtracted();
  if (n >= 1) {
    extracted.rechtsgebiet = AREA_LABEL[lang][detectArea(userMsgs[0])];
    extracted.sachverhalt = userMsgs[0];
  }
  if (n >= 2) extracted.parteien = userMsgs[1];
  if (n >= 3) extracted.sachverhalt = `${userMsgs[0]} — ${userMsgs[2]}`;
  if (n >= 4) extracted.dringlichkeit = userMsgs[3];
  extracted.kontakt = n >= 5 ? userMsgs[4] || detectContact(allText) : detectContact(allText);
  extracted.fristHinweis = detectFrist(allText, lang);

  const a = ASK[lang];
  let reply = a.fertig;
  let complete = false;
  if (n === 1) reply = a.parteien;
  else if (n === 2) reply = a.wann;
  else if (n === 3) reply = a.dringlichkeit;
  else if (n === 4) reply = a.kontakt;
  else if (n >= 5) { reply = a.fertig; complete = true; }

  return { reply, extracted, complete, mock: true };
}

// ---------------------------------------------------------------------------
// Echter KI-Pfad (OpenAI-kompatibel, z. B. Infomaniak AI)
// ---------------------------------------------------------------------------

function systemPrompt(lang: Lang): string {
  const langName = { de: 'Deutsch', fr: 'français', it: 'italiano' }[lang];
  return [
    `Du bist die freundliche Empfangs-Assistenz einer Schweizer Anwaltskanzlei. Antworte auf ${langName}.`,
    'Ziel: eine eingehende Mandatsanfrage vorqualifizieren — Rechtsgebiet, Gegenpartei, Sachverhalt, Dringlichkeit, Kontakt.',
    'Stelle immer nur EINE kurze Frage pro Antwort. Sei knapp, höflich, professionell.',
    'WICHTIG (Anwaltsgeheimnis): Weise früh darauf hin, KEINE streng vertraulichen Details preiszugeben, solange kein Mandat besteht.',
    'Erkenne mögliche Fristen (Daten, Kündigung, Vorladung, Verfügung, Urteil) und markiere sie als Hinweis.',
    'Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt in genau dieser Form:',
    '{"reply": string, "extracted": {"rechtsgebiet": string, "parteien": string, "sachverhalt": string, "dringlichkeit": string, "kontakt": string, "fristHinweis": {"datum": string, "hinweis": string} | null}, "complete": boolean}',
    'Setze "complete" auf true, sobald Rechtsgebiet, Parteien, Sachverhalt, Dringlichkeit und Kontakt erfasst sind.',
    'Fülle "extracted" mit allem bisher Bekannten (leere Strings, wenn noch unbekannt).',
  ].join(' ');
}

function parseJsonLoose(text: string): any {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fallthrough */ }
  }
  return null;
}

async function llmIntake(req: ChatRequest, env: CoreEnv): Promise<IntakeResult> {
  const baseUrl = (env.AI_BASE_URL || '').replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: systemPrompt(req.lang) },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
    body: JSON.stringify({
      model: env.AI_MODEL || 'mixtral',
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Upstream ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const parsed = parseJsonLoose(content);
  if (!parsed || typeof parsed.reply !== 'string') {
    throw new Error('Ungültige KI-Antwort (kein JSON).');
  }
  const extracted = { ...emptyExtracted(), ...(parsed.extracted || {}) } as IntakeExtracted;
  return { reply: parsed.reply, extracted, complete: !!parsed.complete, mock: false };
}

// ---------------------------------------------------------------------------
// Öffentlicher Einstieg
// ---------------------------------------------------------------------------

export async function runIntake(req: ChatRequest, env: CoreEnv): Promise<IntakeResult> {
  if (!Array.isArray(req?.messages) || !req.messages.length) {
    throw new Error('messages fehlt oder ist leer.');
  }
  const lang: Lang = (['de', 'fr', 'it'] as Lang[]).includes(req.lang) ? req.lang : 'de';
  const safeReq: ChatRequest = { messages: req.messages, lang };

  if (env.AI_API_KEY && env.AI_BASE_URL) {
    try {
      return await llmIntake(safeReq, env);
    } catch (err) {
      // Demo-Robustheit: bei KI-Fehler nicht abstürzen, sondern Mock liefern.
      const fallback = mockIntake(safeReq);
      return { ...fallback, mock: true };
    }
  }
  return mockIntake(safeReq);
}

export type { ChatMessage };
