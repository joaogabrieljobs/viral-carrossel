import { assertPublicHttpUrl, serverFetchUrlPlainText } from '../../urlSourceFetch.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Use GET' }),
    };
  }

  try {
    const qs = event.queryStringParameters || {};
    const rawUrl = qs.url || qs.u || '';
    assertPublicHttpUrl(rawUrl);
    const text = await serverFetchUrlPlainText(rawUrl);
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: true, text }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      statusCode: 400,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: msg }),
    };
  }
};
