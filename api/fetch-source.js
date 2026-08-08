import { assertPublicHttpUrl, serverFetchUrlPlainText } from '../urlSourceFetch.js';
import { applyCors } from './lib/cors.js';

export default async function handler(req, res) {
  // Allowlist (api/lib/cors.js): sem isso o endpoint vira proxy aberto de
  // leitura de URLs para qualquer site.
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const rawUrl = req.query?.url || req.query?.u || '';
    assertPublicHttpUrl(rawUrl);
    const text = await serverFetchUrlPlainText(rawUrl);
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ ok: false, error: msg });
  }
}
