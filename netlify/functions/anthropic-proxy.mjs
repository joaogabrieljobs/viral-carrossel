/**
 * Proxy server-side para api.anthropic.com — evita CORS no browser em produção.
 * Configure ANTHROPIC_API_KEY em Netlify → Site configuration → Environment variables.
 */
const TARGET = 'https://api.anthropic.com/v1/messages';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, anthropic-version, x-api-key, Anthropic-Version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Method Not Allowed' } }),
    };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim()) {
    return {
      statusCode: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          message:
            'ANTHROPIC_API_KEY não definida no Netlify. Site → Environment variables → adicione a chave e volte a publicar.',
        },
      }),
    };
  }

  try {
    const anthropicVersion =
      event.headers['anthropic-version'] ||
      event.headers['Anthropic-Version'] ||
      '2023-06-01';

    const res = await fetch(TARGET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key.trim(),
        'anthropic-version': anthropicVersion,
      },
      body: event.body,
    });

    const text = await res.text();
    const ct = res.headers.get('content-type') || 'application/json';

    return {
      statusCode: res.status,
      headers: { ...cors, 'Content-Type': ct },
      body: text,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: e?.message || 'Erro no proxy Anthropic' },
      }),
    };
  }
};
