import { useMemo, useState } from 'react';
import { ChatWidget } from './components/ChatWidget';
import { IntakeDashboard } from './components/IntakeDashboard';
import { FristenView } from './components/FristenView';
import { sendIntake } from './lib/aiClient';
import { detectLang, t } from './lib/i18n';
import { emptyExtracted, type ChatMessage, type IntakeExtracted, type Lang } from './types';

const LANGS: Lang[] = ['de', 'fr', 'it'];

type Tab = 'intake' | 'fristen';

// Wandelt ein erkanntes Frist-Datum (z. B. "30.09.2026" / "30/9/26") in ISO um.
function deDateToIso(s: string): string | null {
  const m = s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${mo}-${d}`;
}

export function App() {
  const [tab, setTab] = useState<Tab>('intake');
  const [fristenPrefill, setFristenPrefill] = useState<string | undefined>(undefined);
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
    if (iso) setFristenPrefill(iso);
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
      ) : (
        <main><FristenView prefillDate={fristenPrefill} /></main>
      )}
    </div>
  );
}
