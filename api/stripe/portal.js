import { rejectCrossSiteRequest } from '../lib/cors.js';
import { handlePortal } from '../lib/billing-handlers.js';

export default async function handler(req, res) {
  if (rejectCrossSiteRequest(req, res, { requireJson: false })) return;
  return handlePortal(req, res);
}
