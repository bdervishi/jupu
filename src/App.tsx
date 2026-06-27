import { useMemo, useState } from 'react';
import { ChatWidget } from './components/ChatWidget';
import { IntakeDashboard } from './components/IntakeDashboard';
import { sendIntake } from './lib/aiClient';
import { detectLang, t } from './lib/i18n';
import { emptyExtracted, type ChatMessage, type IntakeExtracted, type Lang } from './types';

const LANGS: Lang[] = ['de', 'fr', 'it'];

export function App() {
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

      <div className="banner">{ui.demoBanner}</div>

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
          <IntakeDashboard ui={ui} data={extracted} complete={complete} />
          <button className="restart" onClick={handleRestart}>{ui.restart}</button>
        </section>
      </main>
    </div>
  );
}
