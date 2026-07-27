import { handleConfirm } from '../lib/billing-handlers.js';

export default async function handler(req, res) {
  return handleConfirm(req, res);
}
