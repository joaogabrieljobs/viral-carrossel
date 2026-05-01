/**
 * Resolve uma URL de imagem para Web trend (dev proxy).
 * Ordem: Unsplash → Pexels → Wikimedia Commons (sempre disponível).
 */
function pickIdx(len, salt, key) {
  if (!len) return -1;
  const raw = `${salt}:${key}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

async function commonsSearchUrls(searchQ) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: searchQ,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|mime|thumburl',
    iiurlwidth: '1280',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return [];
  const out = [];
  for (const p of Object.values(pages)) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const mime = (ii.mime || '').toLowerCase();
    if (mime.includes('svg') || mime.includes('djvu') || mime.includes('pdf')) continue;
    const u = ii.thumburl || ii.url;
    if (u) out.push(u);
  }
  return out;
}

async function tryUnsplash(query, seed, accessKey) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results || [];
  const idx = pickIdx(results.length, seed, query);
  if (idx < 0) return null;
  const u = results[idx]?.urls?.regular || results[idx]?.urls?.full;
  return u || null;
}

async function tryPexels(query, seed, apiKey) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) return null;
  const data = await res.json();
  const photos = data.photos || [];
  const idx = pickIdx(photos.length, seed, query);
  if (idx < 0) return null;
  const p = photos[idx];
  return p?.src?.large2x || p?.src?.large || p?.src?.original || null;
}

export async function resolveWebTrendImageUrl(query, seed, env) {
  const q = (query || '').trim().slice(0, 280) || 'editorial photography';
  const s = seed || '0';

  if (env.UNSPLASH_ACCESS_KEY) {
    try {
      const u = await tryUnsplash(q, s, env.UNSPLASH_ACCESS_KEY);
      if (u) return { url: u, source: 'unsplash' };
    } catch (_) { /* tenta próximo */ }
  }

  if (env.PEXELS_API_KEY) {
    try {
      const u = await tryPexels(q, s, env.PEXELS_API_KEY);
      if (u) return { url: u, source: 'pexels' };
    } catch (_) { /* tenta próximo */ }
  }

  let urls = await commonsSearchUrls(q);
  let pickKey = q;
  if (!urls.length) {
    pickKey = 'technology infrastructure photography';
    urls = await commonsSearchUrls(pickKey);
  }
  if (!urls.length) {
    pickKey = 'documentary photography';
    urls = await commonsSearchUrls(pickKey);
  }
  const idx = pickIdx(urls.length, s, pickKey);
  if (idx < 0) throw new Error('Nenhuma imagem encontrada para esta busca.');
  return { url: urls[idx], source: 'commons' };
}
