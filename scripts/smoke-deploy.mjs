#!/usr/bin/env node
// Post-Deploy-Smoke-Test für den Intake-MVP (Vercel oder lokal).
//   npm run smoke -- https://<projekt>.vercel.app
//   npm run smoke -- http://localhost:5180        (npm run dev)
// Prüft: Startseite lädt (SPA-Shell), /api/chat lehnt GET ab, /api/chat beantwortet
// einen Intake-Schritt (Mock oder echte KI, je nach Env-Vars auf dem Server).

const base = (process.argv[2] || 'http://localhost:5180').replace(/\/+$/, '');
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

try {
  const home = await fetch(`${base}/`);
  const html = await home.text();
  check('GET / → 200', home.status === 200, `status ${home.status}`);
  check('SPA-Shell vorhanden', html.includes('id="root"'));

  const get = await fetch(`${base}/api/chat`);
  check('GET /api/chat → 405', get.status === 405, `status ${get.status}`);

  const bad = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  check('POST /api/chat ohne messages → 400', bad.status === 400, `status ${bad.status}`);

  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang: 'de',
      messages: [{ role: 'user', content: 'Testanfrage: Kündigung der Wohnung erhalten am 15.09.2026.' }],
    }),
  });
  const data = await res.json().catch(() => null);
  check('POST /api/chat → 200', res.status === 200, `status ${res.status}`);
  check('Antwort enthält reply', typeof data?.reply === 'string' && data.reply.length > 0);
  check('Frist-Hinweis erkannt', data?.extracted?.fristHinweis?.datum === '15.09.2026');
  console.log(`   Modus: ${data?.mock ? 'Mock (kein AI_API_KEY gesetzt)' : 'echte CH-KI'}`);
} catch (err) {
  check('Verbindung', false, err?.message || String(err));
}

console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
process.exit(failed ? 1 : 0);
