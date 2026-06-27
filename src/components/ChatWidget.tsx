import { useEffect, useRef, useState } from 'react';
import type { UiStrings } from '../lib/i18n';
import type { ChatMessage } from '../types';

interface Props {
  ui: UiStrings;
  messages: ChatMessage[];
  loading: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatWidget({ ui, messages, loading, disabled, onSend }: Props) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText('');
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="bubble typing">{ui.thinking}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ui.placeholder}
          disabled={loading || disabled}
          aria-label={ui.placeholder}
        />
        <button type="submit" disabled={loading || disabled || !text.trim()}>
          {ui.send}
        </button>
      </form>
    </div>
  );
}
