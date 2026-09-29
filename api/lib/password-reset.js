import crypto from 'node:crypto';
import { getStripe } from './stripe.js';
import { getAuthRecord, hashPassword, normalizeEmail } from './password-auth.js';

export const RESET_TTL_MS = 30 * 60_000;
const MAIL_WINDOW_MS = 3 * 60_000;
const INVALID_LINK = 'Este link expirou ou já foi usado. Solicite um novo link.';

function digest(value) {
  const secret = process.env.ACCESS_COOKIE_SECRET;
  if (!secret) throw new Error('reset_not_configured');
  return crypto.createHmac('sha256', secret).update(`password-reset:v1:${value}`).digest('base64url');
}

function equal(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function version(customerId, email, salt, hash) {
  return digest(JSON.stringify([customerId, normalizeEmail(email), salt || '', hash || '']));
}

export function createPasswordResetToken(record, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({
    purpose: 'password-reset', customerId: record.customerId,
    version: version(record.customerId, record.email, record.salt, record.hash),
    exp: now + RESET_TTL_MS, nonce: crypto.randomBytes(32).toString('base64url'),
  })).toString('base64url');
  return `${body}.${digest(body)}`;
}

export function readPasswordResetToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1500) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !equal(parts[1], digest(parts[0]))) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (data.purpose !== 'password-reset' || !/^cus_[a-zA-Z0-9]+$/.test(data.customerId)
      || !Number.isSafeInteger(data.exp) || data.exp <= now || data.exp > now + RESET_TTL_MS
      || !/^[\w-]{43}$/.test(data.nonce) || !/^[\w-]{43}$/.test(data.version)) return null;
    return data;
  } catch { return null; }
}

export function passwordResetConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.ACCESS_COOKIE_SECRET?.trim()
    && process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim());
}

// Nunca construir o link a partir de Host/X-Forwarded-Host fornecidos pelo cliente.
export function passwordResetUrl(token) {
  const origin = new URL(process.env.APP_URL || 'https://viralcarrossel.com.br');
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('reset_origin_invalid');
  const url = new URL('/redefinir-senha', origin.origin);
  // Fragmento não vai para access logs nem para o cabeçalho Referer.
  url.hash = new URLSearchParams({ token }).toString();
  return url.href;
}

async function sendMail({ to, subject, text, idempotencyKey, allowDuplicate = false }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [to], subject, text }),
  });
  // Pedidos repetidos para o mesmo e-mail/janela não disparam novas mensagens.
  if (allowDuplicate && response.status === 409) return 'duplicate';
  if (!response.ok) throw new Error(`email_http_${response.status}`);
  return 'accepted';
}

export async function sendPasswordReset(email) {
  const record = await getAuthRecord(email);
  if (!record) return 'no_account';
  const token = createPasswordResetToken(record);
  return sendMail({
    to: record.email, subject: 'Redefina sua senha — Viral Carrossel',
    text: `Recebemos um pedido para redefinir sua senha no Viral Carrossel.\n\nAbra o link abaixo para criar uma nova senha. Ele vale por 30 minutos e só pode ser usado uma vez:\n\n${passwordResetUrl(token)}\n\nSe você não fez este pedido, ignore este e-mail. Sua senha continua a mesma.`,
    idempotencyKey: `reset-mail-${digest(record.email)}-${Math.floor(Date.now() / MAIL_WINDOW_MS)}`,
    allowDuplicate: true,
  });
}

export async function resetPassword(token, password) {
  const data = readPasswordResetToken(token);
  const invalid = () => Object.assign(new Error(INVALID_LINK), { code: 'invalid_reset_link' });
  if (!data) throw invalid();
  const stripe = getStripe();
  let customer;
  try { customer = await stripe.customers.retrieve(data.customerId); }
  catch (error) { if (error.code === 'resource_missing') throw invalid(); throw error; }
  if (!customer || customer.deleted || !customer.email) throw invalid();
  const metadata = customer.metadata || {};
  const current = version(customer.id, customer.email, metadata.vc_pw_salt, metadata.vc_pw_hash);
  if (!equal(current, data.version)) throw invalid();
  const { salt, hash } = hashPassword(password);
  try {
    await stripe.customers.update(customer.id, { metadata: {
      vc_pw_salt: salt, vc_pw_hash: hash, vc_session_revoked_before: String(Date.now()),
    } }, {
      // Todos os links da mesma versão da senha competem pela mesma operação.
      // Stripe rejeita parâmetros diferentes e conflitos simultâneos da chave.
      idempotencyKey: `password-reset-${digest(`${customer.id}:${current}`)}`,
    });
  } catch (error) {
    if (error.type === 'StripeIdempotencyError' || error.code === 'idempotency_key_in_use') throw invalid();
    throw error;
  }
  return { email: normalizeEmail(customer.email), notificationKey: `password-changed-${digest(token)}` };
}

export function sendPasswordChanged({ email, notificationKey }) {
  return sendMail({ to: email, subject: 'Sua senha foi alterada — Viral Carrossel',
    text: 'Sua senha do Viral Carrossel foi alterada. As sessões anteriores foram encerradas.\n\nSe não foi você, solicite uma nova recuperação de senha em https://viralcarrossel.com.br/redefinir-senha.',
    idempotencyKey: notificationKey,
  });
}
