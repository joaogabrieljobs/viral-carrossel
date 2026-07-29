const PROVIDERS = {
  zai: {
    chat: 'https://api.z.ai/api/paas/v4/chat/completions',
    images: 'https://api.z.ai/api/paas/v4/images/generations',
  },
  kimi: {
    chat: 'https://api.moonshot.ai/v1/chat/completions',
  },
};

function cors(req, res) {
  const origin = req.headers?.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const { provider, operation = 'chat', apiKey, payload } = readBody(req);
  const target = PROVIDERS[provider]?.[operation];
  if (!target || !['chat', 'images'].includes(operation)) {
    return res.status(400).json({ error: { message: 'Provedor ou operação inválida.' } });
  }
  if (!String(apiKey || '').trim()) {
    return res.status(400).json({ error: { message: `Chave ${provider} ausente.` } });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: { message: 'Payload ausente.' } });
  }

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${String(apiKey).trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = await upstream.text();
    if (operation === 'images' && upstream.ok) {
      const data = JSON.parse(raw);
      const imageUrl = data?.data?.[0]?.url;
      if (imageUrl) {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          return res.status(502).json({ error: { message: 'Não foi possível baixar a imagem gerada.' } });
        }
        const mime = imageResponse.headers.get('content-type') || 'image/png';
        const bytes = Buffer.from(await imageResponse.arrayBuffer());
        return res.status(200).json({
          ...data,
          data: [{ ...data.data[0], url: undefined, b64_json: bytes.toString('base64'), mime }],
        });
      }
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(raw);
  } catch (error) {
    console.error(`[ai/compatible] ${provider}/${operation}`, error?.message || error);
    return res.status(502).json({ error: { message: 'Falha ao conectar ao provedor de IA.' } });
  }
}
