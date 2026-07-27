import { handleCheckout } from '../lib/billing-handlers.js';

export default async function handler(req, res) {
  return handleCheckout(req, res);
}
