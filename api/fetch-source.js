import { assertPublicHttpUrl, serverFetchUrlPlainText } from '../urlSourceFetch.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function setCors(res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setCors(res);

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
