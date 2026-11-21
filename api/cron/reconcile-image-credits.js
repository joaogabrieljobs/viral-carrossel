import { timingSafeEqual } from 'node:crypto';
import { reconcileAgentImageCredits } from '../lib/agent-image-generation.js';
import { reconcileStaleImageReservations } from '../lib/image-quota.js';

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
  // Os dois reconciliadores são independentes: uma falha num não deve deixar
  // as reservas do outro presas até a próxima execução.
  let agent = null;
  let editor = null;
  let failed = false;
  try {
    agent = await reconcileAgentImageCredits({ limit:100 });
  } catch {
    failed = true;
    console.error('[agent-image] scheduled_reconciliation_failed');
  }
  try {
    // MOO-28: reservas do editor sem job MCP, abandonadas por uma função que
    // morreu entre a reserva e o settle/refund.
    editor = await reconcileStaleImageReservations({ limit:100, olderThanMinutes:15 });
  } catch {
    failed = true;
    console.error('[image-quota] scheduled_editor_reconciliation_failed');
  }
  if (failed) {
    return res.status(503).json({ error: 'Falha na reconciliação dos créditos de imagem.' });
  }
  return res.status(200).json({ ...agent, editor });
}
