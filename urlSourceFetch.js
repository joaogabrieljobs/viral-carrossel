/**
 * Busca públicas http(s), conversão rudimentar HTML→texto e validação anti-SSRF.
 * Partilhado entre Vite (dev) e funções serverless (produção).
 */

import { lookup as nodeDnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 5;
export const MAX_SOURCE_RESPONSE_BYTES = 1024 * 1024;

const responseDisposers = new WeakMap();

function stripIpv6Brackets(value) {
  const text = String(value || '').trim().toLowerCase();
  return text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
}

function ipv4Bytes(value) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(value || ''));
  if (!match) return null;
  const bytes = match.slice(1).map(Number);
  return bytes.every((part) => part >= 0 && part <= 255) ? bytes : null;
}

function ipv6Bytes(value) {
  let input = stripIpv6Brackets(value).split('%')[0];
  if (!input || input.split('::').length > 2) return null;

  const v4Match = input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Match) {
    const bytes = ipv4Bytes(v4Match[1]);
    if (!bytes) return null;
    const replacement = `${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
    input = `${input.slice(0, input.length - v4Match[1].length)}${replacement}`;
  }

  const [leftRaw, rightRaw = ''] = input.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((!input.includes('::') && missing !== 0) || missing < 0) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;

  const out = [];
  for (const part of parts) {
    const number = parseInt(part, 16);
    out.push(number >> 8, number & 0xff);
  }
  return out;
}

function bytesMatchPrefix(address, network, prefix) {
  const wholeBytes = Math.floor(prefix / 8);
  const remainingBits = prefix % 8;
  for (let index = 0; index < wholeBytes; index++) {
    if (address[index] !== network[index]) return false;
  }
  if (!remainingBits) return true;
  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (address[wholeBytes] & mask) === (network[wholeBytes] & mask);
}

function ipv4IsPrivateOrReserved(value) {
  const bytes = ipv4Bytes(value);
  if (!bytes) return true;
  const [a, b, c] = bytes;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

const BLOCKED_IPV6_RANGES = [
  ['::', 128],
  ['::1', 128],
  ['::', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].map(([network, prefix]) => [ipv6Bytes(network), prefix]);
const GLOBAL_UNICAST_IPV6 = ipv6Bytes('2000::');

/** @param {string} address */
export function ipIsPrivateOrReserved(address) {
  const normalized = stripIpv6Brackets(address);
  const family = isIP(normalized);
  if (family === 4) return ipv4IsPrivateOrReserved(normalized);
  if (family !== 6) return true;

  const bytes = ipv6Bytes(normalized);
  if (!bytes) return true;

  // IPv4-mapped IPv6 precisa herdar exatamente as mesmas restrições do IPv4.
  if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return ipv4IsPrivateOrReserved(bytes.slice(12).join('.'));
  }

  // Para fetch externo aceitamos somente IPv6 global unicast (2000::/3).
  if (!bytesMatchPrefix(bytes, GLOBAL_UNICAST_IPV6, 3)) return true;
  return BLOCKED_IPV6_RANGES.some(([network, prefix]) => bytesMatchPrefix(bytes, network, prefix));
}

/** @param {string} host */
export function hostnameLooksPrivate(host) {
  const h = stripIpv6Brackets(host).replace(/\.$/, '');
  if (!h) return true;
  if (isIP(h)) return ipIsPrivateOrReserved(h);
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === 'metadata.google.internal' || h.endsWith('.metadata.google.internal')) return true;
  if (h.endsWith('.internal') || h.endsWith('.local') || h.endsWith('.home.arpa')) return true;
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
  if (u.username || u.password) {
    throw new Error('Credenciais na URL não são permitidas');
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
function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(Number(n)); } catch { return ' '; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ' '; }
    });
}

/**
 * Descrições Open Graph/Twitter carregam a legenda em várias páginas sociais,
 * mesmo quando o corpo é renderizado por JavaScript. Mantemos somente campos
 * editoriais — nunca scripts, tokens ou metadados técnicos.
 */
export function extractHtmlMetadataText(html) {
  const source = String(html || '');
  const values = [];
  const title = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) values.push(decodeHtmlEntities(title).replace(/<[^>]+>/g, ' '));

  for (const tag of source.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    const attrRe = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let match;
    while ((match = attrRe.exec(tag))) {
      attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    const key = String(attrs.property || attrs.name || '').toLowerCase();
    if (!['description', 'og:description', 'twitter:description', 'og:title', 'twitter:title'].includes(key)) continue;
    if (attrs.content) values.push(decodeHtmlEntities(attrs.content));
  }

  const seen = new Set();
  return values
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
}

export function htmlToPlainText(html, maxLen = 48000) {
  const metadata = extractHtmlMetadataText(html);
  let t = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|header|footer|br)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    ;

  t = decodeHtmlEntities(t);

  const lines = t
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  let out = [metadata, lines.join('\n')]
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (out.length > maxLen) out = `${out.slice(0, maxLen)}\n…`;
  return out;
}

function normalizeLookupRecords(records) {
  const values = Array.isArray(records) ? records : [records];
  return values
    .map((record) => {
      const address = stripIpv6Brackets(typeof record === 'string' ? record : record?.address);
      const family = Number(typeof record === 'string' ? isIP(address) : record?.family || isIP(address));
      return { address, family };
    })
    .filter((record) => record.address && (record.family === 4 || record.family === 6));
}

/**
 * Resolve todos os endereços usados pelo host e falha fechado caso qualquer A/AAAA
 * aponte para rede privada ou reservada. O mesmo conjunto é fixado no socket para
 * eliminar a janela de DNS rebinding entre validação e conexão.
 */
export async function resolvePublicHost(hostname, lookupImpl = nodeDnsLookup) {
  const host = stripIpv6Brackets(hostname);
  if (hostnameLooksPrivate(host)) throw new Error('Endereços internos não são permitidos');

  const literalFamily = isIP(host);
  const records = literalFamily
    ? [{ address: host, family: literalFamily }]
    : normalizeLookupRecords(await lookupImpl(host, { all: true, verbatim: true }));

  if (!records.length) throw new Error('O domínio não possui endereço público válido');
  if (records.some((record) => ipIsPrivateOrReserved(record.address))) {
    throw new Error('O domínio resolve para um endereço interno ou reservado');
  }
  return records;
}

function createPinnedLookup(expectedHostname, records) {
  const expected = stripIpv6Brackets(expectedHostname).replace(/\.$/, '');
  let cursor = 0;
  return (requestedHostname, options, callback) => {
    const requested = stripIpv6Brackets(requestedHostname).replace(/\.$/, '');
    if (requested !== expected) {
      const error = new Error('Host alterado durante a conexão');
      error.code = 'EAI_FAIL';
      callback(error);
      return;
    }

    const opts = typeof options === 'number' ? { family: options } : (options || {});
    const eligible = records.filter((record) => !opts.family || record.family === opts.family);
    if (!eligible.length) {
      const error = new Error('Família de endereço indisponível');
      error.code = 'EAI_FAMILY';
      callback(error);
      return;
    }
    if (opts.all) {
      callback(null, eligible.map((record) => ({ ...record })));
      return;
    }
    const record = eligible[cursor++ % eligible.length];
    callback(null, record.address, record.family);
  };
}

async function defaultCreatePinnedDispatcher(hostname, records) {
  const { Agent } = await import('undici');
  return new Agent({ connect: { lookup: createPinnedLookup(hostname, records) } });
}

async function closeDispatcher(dispatcher) {
  if (!dispatcher) return;
  try {
    if (typeof dispatcher.close === 'function') await dispatcher.close();
    else if (typeof dispatcher.destroy === 'function') dispatcher.destroy();
  } catch {
    // Encerrar o transporte é best-effort depois que a resposta já terminou.
  }
}

async function releaseResponse(response) {
  const dispose = response && responseDisposers.get(response);
  if (!dispose) return;
  responseDisposers.delete(response);
  await dispose();
}

async function cancelResponseBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {
    // Redirects não precisam do corpo anterior.
  }
}

/**
 * Fetch GET com redirects manuais — cada hop revalida anti-SSRF.
 * @param {string} urlString
 * @param {RequestInit} init
 * @param {{ fetchImpl?: typeof fetch, lookupImpl?: Function, createDispatcher?: Function }} deps
 */
export async function fetchPublicHttp(urlString, init = {}, deps = {}) {
  let current = assertPublicHttpUrl(urlString);
  const ac = init.signal || new AbortController().signal;
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const lookupImpl = deps.lookupImpl || nodeDnsLookup;
  const createDispatcher = deps.createDispatcher || defaultCreatePinnedDispatcher;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    const records = await resolvePublicHost(parsed.hostname, lookupImpl);
    const dispatcher = await createDispatcher(parsed.hostname, records);
    let res;
    try {
      res = await fetchImpl(current, {
        ...init,
        method: init.method || 'GET',
        redirect: 'manual',
        signal: ac,
        dispatcher,
        headers: {
          'User-Agent':
            'ViralCarrossel/1.0 (+https://github.com) texto para resumo editorial',
          Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,application/json;q=0.7',
          ...(init.headers || {}),
        },
      });
    } catch (error) {
      await closeDispatcher(dispatcher);
      throw error;
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      await cancelResponseBody(res);
      await closeDispatcher(dispatcher);
      if (!loc) throw new Error(`Redirect sem Location (HTTP ${res.status})`);
      let next;
      try {
        next = new URL(loc, current).toString();
      } catch {
        throw new Error('Redirect inválido');
      }
      current = assertPublicHttpUrl(next);
      continue;
    }

    responseDisposers.set(res, () => closeDispatcher(dispatcher));
    return res;
  }

  throw new Error('Demasiados redirects');
}

function assertTextualContentType(response) {
  const raw = String(response.headers?.get?.('content-type') || '').toLowerCase();
  const mime = raw.split(';', 1)[0].trim();
  const accepted = (
    mime.startsWith('text/') ||
    mime === 'application/xhtml+xml' ||
    mime === 'application/xml' ||
    mime === 'application/json' ||
    mime === 'application/ld+json' ||
    mime.endsWith('+json') ||
    mime.endsWith('+xml')
  );
  if (!mime || !accepted) throw new Error('Tipo de conteúdo não suportado; envie uma página ou texto');
  return raw;
}

async function readResponseBufferLimited(response, maxBytes = MAX_SOURCE_RESPONSE_BYTES) {
  const declared = String(response.headers?.get?.('content-length') || '').trim();
  if (declared) {
    if (!/^\d+$/.test(declared)) throw new Error('Content-Length inválido');
    if (Number(declared) > maxBytes) throw new Error('A página excede o limite de 1 MB');
  }

  const body = response.body;
  if (!body) return Buffer.alloc(0);

  const chunks = [];
  let total = 0;
  const append = (chunk) => {
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) throw new Error('A página excede o limite de 1 MB');
    chunks.push(buffer);
  };

  if (typeof body.getReader === 'function') {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        append(value);
      }
    } catch (error) {
      try { await reader.cancel(error); } catch { /* ignore */ }
      throw error;
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    return Buffer.concat(chunks, total);
  }

  if (typeof body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body) append(chunk);
    return Buffer.concat(chunks, total);
  }

  throw new Error('Resposta sem streaming seguro');
}

/**
 * @param {string} urlString
 * @param {{ fetchImpl?: typeof fetch, lookupImpl?: Function, createDispatcher?: Function }} deps
 */
export async function serverFetchUrlPlainText(urlString, deps = {}) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 18500);
  let res;

  try {
    res = await fetchPublicHttp(urlString, { signal: ac.signal }, deps);

    if (!res.ok) {
      throw new Error(`Servidor devolveu HTTP ${res.status}`);
    }

    const ct = assertTextualContentType(res);
    const buf = await readResponseBufferLimited(res);

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
    await cancelResponseBody(res);
    await releaseResponse(res);
  }
}
