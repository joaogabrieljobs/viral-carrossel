import { timingSafeEqual } from 'node:crypto';
import { cleanupStaleImageReferences } from '../lib/image-references.js';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers?.authorization || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try { return res.status(200).json(await cleanupStaleImageReferences()); }
  catch {
    console.error('[image-references] scheduled_cleanup_failed');
    return res.status(503).json({ error: 'Falha na limpeza das referências temporárias.' });
  }
}
