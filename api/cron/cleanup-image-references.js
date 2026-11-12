import { timingSafeEqual } from 'node:crypto';
import { cleanupStaleImageReferences } from '../lib/image-references.js';
import { cleanupExpiredAgentTokens } from '../lib/agent-token-store.js';

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
  const tokenCleanup = process.env.LIBRARY_SYNC_BACKEND === 'postgres'
    ? cleanupExpiredAgentTokens()
    : Promise.resolve({ deleted: 0, skipped: true });
  const [imagesResult, tokensResult] = await Promise.allSettled([
    cleanupStaleImageReferences(), tokenCleanup,
  ]);
  if (imagesResult.status === 'rejected') {
    console.error('[image-references] scheduled_cleanup_failed');
    return res.status(503).json({ error: 'Falha na limpeza das referências temporárias.' });
  }
  let agentTokens = tokensResult.value;
  if (tokensResult.status === 'rejected') {
    const error = tokensResult.reason;
    console.error('[agent-tokens] scheduled_cleanup_failed', error?.code || error?.message || error);
    agentTokens = { deleted: 0, failed: true };
  }
  return res.status(200).json({ ...imagesResult.value, agentTokens });
}
