// Health-check: em produção não revela se o host tem API keys.
import { applyCors } from './lib/cors.js';

export default function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const isProd = process.env.VERCEL_ENV === 'production'
    || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');

  if (isProd) {
    return res.status(200).json({ ok: true, dev: false });
  }

  return res.status(200).json({
    anthropic: Boolean(String(process.env.ANTHROPIC_API_KEY || '').trim()),
    openai: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
    unsplash: Boolean(String(process.env.UNSPLASH_ACCESS_KEY || '').trim()),
    pexels: Boolean(String(process.env.PEXELS_API_KEY || '').trim()),
    sjinn: Boolean(String(process.env.SJINN_API_KEY || '').trim()),
    upstash: Boolean(
      String(process.env.UPSTASH_REDIS_REST_URL || '').trim()
      && String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim(),
    ),
    dev: false,
  });
}
