// Health-check de produção: quais provedores têm chave configurada no host.
// Mesmo contrato do endpoint dev em vite.config.js (/api/status).
// Só expõe booleanos de presença — nunca valores.
import { applyCors } from './lib/cors.js';

export default function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({
    anthropic: Boolean(String(process.env.ANTHROPIC_API_KEY || '').trim()),
    openai: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
    unsplash: Boolean(String(process.env.UNSPLASH_ACCESS_KEY || '').trim()),
    pexels: Boolean(String(process.env.PEXELS_API_KEY || '').trim()),
    dev: false,
  });
}
