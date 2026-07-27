import { handleLogout } from '../lib/billing-handlers.js';

export default async function handler(req, res) {
  return handleLogout(req, res);
}
