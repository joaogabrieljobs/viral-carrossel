import { rejectCrossSiteRequest } from '../lib/cors.js';
import { handleCheckout } from '../lib/billing-handlers.js';

export default async function handler(req, res) {
  if (rejectCrossSiteRequest(req, res)) return;
  return handleCheckout(req, res);
}
