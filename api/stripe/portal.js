import { handlePortal } from '../lib/billing-handlers.js';

export default async function handler(req, res) {
  return handlePortal(req, res);
}
