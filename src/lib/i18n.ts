import type { Lang } from '../types';

export interface UiStrings {
  appTitle: string;
  subtitle: string;
  demoBanner: string;
  clientPanel: string;
  lawyerPanel: string;
  placeholder: string;
  send: string;
  greeting: string;
  restart: string;
  thinking: string;
  // Dashboard
  caseRequest: string;
  fRechtsgebiet: string;
  fParteien: string;
  fSachverhalt: string;
  fDringlichkeit: string;
  fKontakt: string;
  fFrist: string;
  conflictCheck: string;
  conflictPending: string;
  nextStep: string;
  nextStepValue: string;
  notYet: string;
  completeTitle: string;
  mockBadge: string;
  aiBadge: string;
}

const STRINGS: Record<Lang, UiStrings> = {
  de: {
    appTitle: 'AdvoOS — KI-Sekretariat',
    subtitle: 'Demo: KI-Mandatsannahme für Schweizer Kanzleien',
    demoBanner: '⚠️ Demo — bitte KEINE echten oder vertraulichen Daten eingeben. Daten werden nicht dauerhaft gespeichert.',
    clientPanel: 'Mandanten-Sicht (Website-Chat)',
    lawyerPanel: 'Kanzlei-Sicht (Live-Mandatsanfrage)',
    placeholder: 'Beschreiben Sie kurz Ihr Anliegen …',
    send: 'Senden',
    greeting: 'Grüezi! Ich bin die digitale Assistenz der Kanzlei. Worum geht es bei Ihrem Anliegen? Bitte teilen Sie vorerst keine streng vertraulichen Details mit.',
    restart: 'Neu starten',
    thinking: 'schreibt …',
    caseRequest: 'Mandatsanfrage',
    fRechtsgebiet: 'Rechtsgebiet',
    fParteien: 'Gegenpartei',
    fSachverhalt: 'Sachverhalt',
    fDringlichkeit: 'Dringlichkeit',
    fKontakt: 'Kontakt',
    fFrist: 'Frist-Hinweis',
    conflictCheck: 'Konfliktprüfung',
    conflictPending: 'automatisch zu prüfen',
    nextStep: 'Nächster Schritt',
    nextStepValue: 'Termin vorschlagen',
    notYet: '—',
    completeTitle: '✓ Anfrage vollständig erfasst',
    mockBadge: 'Mock-Modus (offline, gratis)',
    aiBadge: 'Schweizer KI aktiv',
  },
  fr: {
    appTitle: 'AdvoOS — secrétariat IA',
    subtitle: 'Démo : prise de mandat par IA pour études d’avocats suisses',
    demoBanner: '⚠️ Démo — merci de NE PAS saisir de données réelles ou confidentielles. Aucune conservation durable.',
    clientPanel: 'Vue client (chat du site web)',
    lawyerPanel: 'Vue étude (demande de mandat en direct)',
    placeholder: 'Décrivez brièvement votre demande …',
    send: 'Envoyer',
    greeting: 'Bonjour ! Je suis l’assistance numérique de l’étude. Quel est l’objet de votre demande ? Merci de ne pas communiquer de détails strictement confidentiels pour l’instant.',
    restart: 'Recommencer',
    thinking: 'écrit …',
    caseRequest: 'Demande de mandat',
    fRechtsgebiet: 'Domaine du droit',
    fParteien: 'Partie adverse',
    fSachverhalt: 'Faits',
    fDringlichkeit: 'Urgence',
    fKontakt: 'Contact',
    fFrist: 'Indice de délai',
    conflictCheck: 'Vérification des conflits',
    conflictPending: 'à vérifier automatiquement',
    nextStep: 'Étape suivante',
    nextStepValue: 'Proposer un rendez-vous',
    notYet: '—',
    completeTitle: '✓ Demande complète',
    mockBadge: 'Mode démo (hors ligne, gratuit)',
    aiBadge: 'IA suisse active',
  },
  it: {
    appTitle: 'AdvoOS — segreteria IA',
    subtitle: 'Demo: acquisizione mandati con IA per studi legali svizzeri',
    demoBanner: '⚠️ Demo — si prega di NON inserire dati reali o riservati. Nessuna conservazione permanente.',
    clientPanel: 'Vista cliente (chat del sito)',
    lawyerPanel: 'Vista studio (richiesta di mandato in tempo reale)',
    placeholder: 'Descriva brevemente la sua richiesta …',
    send: 'Invia',
    greeting: 'Buongiorno! Sono l’assistenza digitale dello studio. Di cosa si tratta? La preghiamo di non comunicare dettagli strettamente riservati per ora.',
    restart: 'Ricomincia',
    thinking: 'sta scrivendo …',
    caseRequest: 'Richiesta di mandato',
    fRechtsgebiet: 'Ambito giuridico',
    fParteien: 'Controparte',
    fSachverhalt: 'Fatti',
    fDringlichkeit: 'Urgenza',
    fKontakt: 'Contatto',
    fFrist: 'Indizio di termine',
    conflictCheck: 'Verifica conflitti',
    conflictPending: 'da verificare automaticamente',
    nextStep: 'Prossimo passo',
    nextStepValue: 'Proporre un appuntamento',
    notYet: '—',
    completeTitle: '✓ Richiesta completa',
    mockBadge: 'Modalità demo (offline, gratis)',
    aiBadge: 'IA svizzera attiva',
  },
};

export function t(lang: Lang): UiStrings {
  return STRINGS[lang];
}

const FR_HINTS = [' le ', ' la ', ' je ', 'bonjour', 'monsieur', 'madame', 'congé', 'bail', 'avocat', 'divorce', 'travail', 'délai', "j'ai", 'mon ', 'ma '];
const IT_HINTS = ['buongiorno', 'sono ', 'ho ', 'il mio', 'la mia', 'avvocato', 'lavoro', 'sfratto', 'divorzio', 'contratto', 'grazie', 'salve'];

/** Sehr einfache Sprach-Heuristik für die Demo (DE als Default). */
export function detectLang(text: string): Lang {
  const t = ` ${text.toLowerCase()} `;
  const it = IT_HINTS.filter((h) => t.includes(h)).length;
  const fr = FR_HINTS.filter((h) => t.includes(h)).length;
  if (it > fr && it > 0) return 'it';
  if (fr > 0) return 'fr';
  return 'de';
}
