import { useMemo, useState } from 'react';
import { ChatWidget } from './components/ChatWidget';
import { IntakeDashboard } from './components/IntakeDashboard';
import { FristenView, type FristenPrefill } from './components/FristenView';
import { KalenderView } from './components/KalenderView';
import { sendIntake } from './lib/aiClient';
import { detectLang, t } from './lib/i18n';
import { useKalender } from './lib/useKalender';
import { deDateToIso } from './lib/termine';
import { emptyExtracted, type ChatMessage, type IntakeExtracted, type Lang } from './types';

const LANGS: Lang[] = ['de', 'fr', 'it'];

type Tab = 'intake' | 'fristen' | 'kalender';

export function App() {
  const [tab, setTab] = useState<Tab>('intake');
  const [fristenPrefill, setFristenPrefill] = useState<FristenPrefill | undefined>(undefined);
  const kalender = useKalender();
  const [lang, setLang] = useState<Lang>('de');
  const [langLocked, setLangLocked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [extracted, setExtracted] = useState<IntakeExtracted>(emptyExtracted());
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mock, setMock] = useState(true);
  const [error, setError] = useState('');

  const ui = useMemo(() => t(lang), [lang]);
  const greeting: ChatMessage = { role: 'assistant', content: ui.greeting };
  const shownMessages = messages.length ? messages : [greeting];

  async function handleSend(text: string) {
    if (!text.trim() || loading || complete) return;
    setError('');

    // Sprache aus der ersten Nachricht ableiten (danach gesperrt).
    let activeLang = lang;
    if (!langLocked) {
      activeLang = detectLang(text);
      setLang(activeLang);
      setLangLocked(true);
    }

    const next: ChatMessage[] = [
      ...(messages.length ? messages : [greeting]),
      { role: 'user', content: text },
    ];
    setMessages(next);
    setLoading(true);
    try {
      const result = await sendIntake(next, activeLang);
      setMessages([...next, { role: 'assistant', content: result.reply }]);
      setExtracted(result.extracted);
      setComplete(result.complete);
      setMock(result.mock);
    } catch (err: any) {
      setError(err?.message || 'Fehler');
      setMessages(next);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenFrist(datumDe: string) {
    const iso = deDateToIso(datumDe);
    // Akten-Vorschlag aus dem Intake (Gegenpartei / Rechtsgebiet), damit der Flow
    // Chat → Frist → Termine ohne Abtippen durchläuft.
    const akteVorschlag = [extracted.parteien, extracted.rechtsgebiet].filter(Boolean).join(' · ');
    setFristenPrefill({ datum: iso ?? undefined, akteVorschlag: akteVorschlag || undefined });
    setTab('fristen');
  }

  function handleRestart() {
    setMessages([]);
    setExtracted(emptyExtracted());
    setComplete(false);
    setLangLocked(false);
    setError('');
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{ui.appTitle}</h1>
          <p className="subtitle">{ui.subtitle}</p>
        </div>
        <div className="topbar-right">
          <span className={`badge ${mock ? 'badge-mock' : 'badge-ai'}`}>
            {mock ? ui.mockBadge : ui.aiBadge}
          </span>
          <div className="langswitch">
            {LANGS.map((l) => (
              <button
                key={l}
                className={l === lang ? 'lang active' : 'lang'}
                onClick={() => { if (!langLocked) setLang(l); }}
                disabled={langLocked}
                title={langLocked ? 'Sprache durch erste Nachricht festgelegt' : ''}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'intake' ? 'tab active' : 'tab'} onClick={() => setTab('intake')}>{ui.tabIntake}</button>
        <button className={tab === 'fristen' ? 'tab active' : 'tab'} onClick={() => setTab('fristen')}>{ui.tabFristen}</button>
        <button className={tab === 'kalender' ? 'tab active' : 'tab'} onClick={() => setTab('kalender')}>
          {ui.tabKalender}{kalender.offen > 0 && <span className="tab-count">{kalender.offen}</span>}
        </button>
      </nav>

      {tab === 'intake' && <div className="banner">{ui.demoBanner}</div>}

      {tab === 'intake' ? (
        <main className="split">
          <section className="pane">
            <h2 className="pane-title">{ui.clientPanel}</h2>
            <ChatWidget
              ui={ui}
              messages={shownMessages}
              loading={loading}
              disabled={complete}
              onSend={handleSend}
            />
            {error && <p className="error">⚠ {error}</p>}
          </section>

          <section className="pane">
            <h2 className="pane-title">{ui.lawyerPanel}</h2>
            <IntakeDashboard ui={ui} data={extracted} complete={complete} onOpenFrist={handleOpenFrist} />
            <button className="restart" onClick={handleRestart}>{ui.restart}</button>
          </section>
        </main>
      ) : tab === 'fristen' ? (
        <main>
          <FristenView
            prefill={fristenPrefill}
            akten={kalender.state.akten}
            onAnlegen={(termine, akte) => kalender.termineAnlegen(termine, akte)}
            onOpenKalender={() => setTab('kalender')}
          />
        </main>
      ) : (
        <main><KalenderView kalender={kalender} /></main>
      )}
    </div>
  );
}
