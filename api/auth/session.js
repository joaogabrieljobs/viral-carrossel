import {
  handleSession,
  handleCheckout,
  handleConfirm,
  handlePortal,
  handleLogout,
} from '../lib/billing-handlers.js';

export default async function handler(req, res) {
  return handleSession(req, res);
}
