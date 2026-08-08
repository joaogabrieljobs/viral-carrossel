/** Fábrica de req/res fake no formato que os handlers de `api/` esperam
 *  (estilo Vercel Node: res.status().json(), res.redirect(), setHeader). */

export function makeReq({ method = 'GET', url = '/', headers = {}, body, cookie } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  if (cookie) h.cookie = cookie;
  return { method, url, headers: h, body };
}

export function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectUrl: null,
    ended: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      res.ended = true;
      return res;
    },
    send(payload) {
      res.body = payload;
      res.ended = true;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return res.headers[name.toLowerCase()];
    },
    redirect(code, url) {
      res.statusCode = code;
      res.redirectUrl = url;
      res.ended = true;
      return res;
    },
  };
  return res;
}

/** Set-Cookie pode ser string ou array — normaliza pra array. */
export function setCookies(res) {
  const raw = res.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Extrai o valor de um cookie específico dos Set-Cookie da resposta. */
export function cookieValue(res, name) {
  const found = setCookies(res).find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return decodeURIComponent(found.split(';')[0].slice(name.length + 1));
}
