/**
 * Proxy server-side para api.anthropic.com — evita CORS no browser em produção.
 * Configure ANTHROPIC_API_KEY em Vercel → Project → Settings → Environment Variables.
 */

const TARGET = 'https://api.anthropic.com/v1/messages';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type, anthropic-version, x-api-key, x-anthropic-key, Anthropic-Version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function setCors(res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  setCors(res);

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
  const key = userKey || envKey;

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
