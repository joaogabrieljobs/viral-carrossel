/**
 * Busca públicas http(s), conversão rudimentar HTML→texto e validação anti-SSRF.
 * Partilhado entre Vite (dev) e Netlify Functions (produção).
 */

/** @param {string} host */
export function hostnameLooksPrivate(host) {
  const h = String(host || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '[::]' || h === '[::1]') return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (h.includes(':') && !h.includes('.')) return true;

  const blocked = new Set([
    'metadata.google.internal',
    'metadata.google.',
  ]);
  for (const b of blocked) {
    if (h === b.replace(/\.$/, '') || h.endsWith(b)) return true;
  }
  return false;
}

/** @param {string} raw */
export function assertPublicHttpUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    throw new Error('URL inválida');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Apenas http(s)');
  }
  if (hostnameLooksPrivate(u.hostname)) {
    throw new Error('Endereços internos não são permitidos');
  }
  const s = u.toString();
  if (s.length > 2048) throw new Error('URL demasiado longa');
  return s;
}

/**
 * @param {string} html
 * @param {number} maxLen
 */
export function htmlToPlainText(html, maxLen = 48000) {
  let t = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|header|footer|br)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return ' ';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return ' ';
      }
    });

  const lines = t
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  let out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (out.length > maxLen) out = `${out.slice(0, maxLen)}\n…`;
  return out;
}

/** @param {string} urlString */
export async function serverFetchUrlPlainText(urlString) {
  const safe = assertPublicHttpUrl(urlString);

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 18500);

  try {
    const res = await fetch(safe, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        'User-Agent':
          'ViralCarrossel/1.0 (+https://github.com) texto para resumo editorial',
        Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
    });

    if (!res.ok) {
      throw new Error(`Servidor devolveu HTTP ${res.status}`);
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());

    let rawText = '';
    if (/\bcharset=utf-16/i.test(ct)) {
      rawText = buf.toString('utf16le');
    } else {
      rawText = buf.toString('utf8');
      if (/ï»¿/.test(rawText.slice(0, 5))) rawText = rawText.replace(/^\ufeff/, '');
      if (/�{3,}|Ã.|Â./.test(rawText.slice(0, 600)) && /charset=iso-8859/i.test(ct)) {
        try {
          rawText = Buffer.from(buf).toString('latin1');
        } catch {
          /* keep utf8 */
        }
      }
    }

    let plain = rawText.trim();
    if (/<html[\s>]/i.test(plain.slice(0, 2000)) || /<body[\s>]/i.test(plain.slice(0, 8000))) {
      plain = htmlToPlainText(plain);
    }

    plain = plain
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    const cap = 14000;
    if (plain.length > cap) plain = `${plain.slice(0, cap)}\n…`;

    if (plain.replace(/\s/g, '').length < 80) {
      throw new Error('Página sem texto suficiente (bloqueada, JS-only ou formato não suportado)');
    }

    return plain;
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error('Tempo limite ao obter a página');
    }
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(to);
  }
}
