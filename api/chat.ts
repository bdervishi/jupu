// Vercel Serverless Function: POST /api/chat
// Hält den KI-Key serverseitig (gelangt nie in den Browser) und delegiert an den
// framework-agnostischen Kern. Lokal wird derselbe Kern vom Vite-Dev-Middleware genutzt.

import { runIntake, type CoreEnv } from './_core';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const env: CoreEnv = {
      AI_API_KEY: process.env.AI_API_KEY,
      AI_BASE_URL: process.env.AI_BASE_URL,
      AI_MODEL: process.env.AI_MODEL,
    };
    const result = await runIntake(body, env);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err: any) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Bad Request' }));
  }
}
