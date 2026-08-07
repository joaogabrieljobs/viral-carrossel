/**
 * Proxy server-side para api.anthropic.com — evita CORS no browser em produção.
 * Configure ANTHROPIC_API_KEY em Vercel → Project → Settings → Environment Variables.
 */

import { applyCors } from '../../lib/cors.js';
import { readAccessCookie, billingDisabled } from '../../lib/access.js';

const TARGET = 'https://api.anthropic.com/v1/messages';

export default async function handler(req, res) {
  applyCors(req, res, {
    credentials: true,
    headers: 'Content-Type, anthropic-version, x-api-key, x-anthropic-key, Anthropic-Version',
  });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  const userKey = String(
    req.headers['x-anthropic-key'] || req.headers['X-Anthropic-Key'] || '',
  ).trim();
  const envKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

  // Chave do host (fallback) só para assinante com sessão válida — sem isso,
  // qualquer requisição anônima consumiria a ANTHROPIC_API_KEY da Vercel.
  let key = userKey;
  if (!key && envKey) {
    const hasSession = billingDisabled() || Boolean(readAccessCookie(req)?.customerId);
    if (hasSession) key = envKey;
    else {
      return res.status(401).json({
        error: {
          message:
            'Sem chave própria e sem sessão de assinante. Adicione sua chave Anthropic no ícone de chaves (⚙) ou faça login pela assinatura.',
        },
      });
    }
  }

  if (!key) {
    return res.status(503).json({
      error: {
        message:
          'Chave Anthropic não configurada. Adicione sua chave no ícone de chaves (⚙) no header do app, ou defina ANTHROPIC_API_KEY nas Environment Variables da Vercel.',
      },
    });
  }

  try {
    const anthropicVersion =
      req.headers['anthropic-version'] ||
      req.headers['Anthropic-Version'] ||
      '2023-06-01';

    const body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

    const upstream = await fetch(TARGET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': anthropicVersion,
      },
      body,
    });

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({
      error: { message: e?.message || 'Erro no proxy Anthropic' },
    });
  }
}
