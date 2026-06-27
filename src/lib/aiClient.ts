// Dünner Client zum Intake-Proxy. Spiegelt das Muster aus SwissBrokerOS
// services/aiService.ts: der Browser ruft NIE den KI-Anbieter direkt, sondern
// immer den eigenen Proxy (/api/chat) — so bleibt der Key serverseitig.

import type { ChatMessage, IntakeResult, Lang } from '../types';

export async function sendIntake(messages: ChatMessage[], lang: Lang): Promise<IntakeResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, lang }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Server Error: ${res.status}`);
  }
  return (await res.json()) as IntakeResult;
}
