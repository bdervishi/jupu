import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { runIntake, type CoreEnv } from './api/_core';

// Dev-only Plugin: bedient POST /api/chat lokal mit demselben Kern wie die
// Vercel-Function — so läuft `npm run dev` ohne `vercel dev`.
function intakeApiDev(env: CoreEnv): Plugin {
  return {
    name: 'advoos-intake-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', async () => {
          try {
            const body = JSON.parse(raw || '{}');
            const result = await runIntake(body, env);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Bad Request' }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Liest .env ohne VITE_-Präfix-Zwang, damit der serverseitige Key nicht in den Client gelangt.
  const e = loadEnv(mode, process.cwd(), '');
  const env: CoreEnv = { AI_API_KEY: e.AI_API_KEY, AI_BASE_URL: e.AI_BASE_URL, AI_MODEL: e.AI_MODEL };
  return {
    plugins: [react(), intakeApiDev(env)],
    server: { port: 5180 },
  };
});
