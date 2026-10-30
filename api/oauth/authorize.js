import { readCurrentAccessCookie, billingDisabled } from '../lib/access.js';
import { findActiveSubscription } from '../lib/stripe.js';
import { resolveLibraryOwnerId } from '../lib/library-sync-store.js';
import { createAuthorizationCode, oauthResource, validateOAuthRequest } from '../lib/oauth-store.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
function page(res, title, body, status = 200) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)} — Moont</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:76px 24px 56px;color:#f7f5f0;font:14px Inter,ui-sans-serif,system-ui,sans-serif;display:grid;place-items:center;background:linear-gradient(90deg,rgba(5,7,14,.84),rgba(8,10,18,.4) 50%,rgba(7,8,14,.72)),linear-gradient(180deg,rgba(5,7,13,.16),rgba(5,7,13,.72)),url('/landing/moont-v3/source/02-crossing-evening.webp') center/cover fixed}.brand{position:fixed;top:27px;left:31px;width:137px;height:auto}.help{position:fixed;top:30px;right:31px;color:rgba(255,255,255,.76);background:transparent;padding:0;font-weight:500}.legal{position:fixed;bottom:24px;left:31px;color:rgba(255,255,255,.55);font-size:11px}.box{width:min(450px,calc(100vw - 32px));padding:31px 32px 28px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(25,20,38,.96);box-shadow:0 32px 90px rgba(0,0,0,.48);backdrop-filter:blur(16px)}h1{margin:0 0 10px;font-size:29px;line-height:1.08;letter-spacing:-.04em}p{color:rgba(255,255,255,.64);line-height:1.55}.account{margin:20px 0;padding:13px 14px;border:1px solid rgba(255,255,255,.13);border-radius:8px;color:rgba(255,255,255,.58);background:rgba(255,255,255,.04)}.account strong{display:block;margin-top:5px;color:#fff;overflow-wrap:anywhere}form{display:flex;flex-wrap:wrap;gap:8px}button,a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 17px;border-radius:7px;border:0;background:#d7ff5a;color:#10110d;font-weight:750;text-decoration:none;cursor:pointer}.muted{margin:0;background:rgba(255,255,255,.09);color:#fff}@media(max-width:560px){body{align-items:start;padding:82px 16px 38px;background-position:66% center}.brand{top:22px;left:20px;width:122px}.help{top:27px;right:20px}.legal{display:none}.box{padding:26px 22px}}
  </style><img class="brand" src="/moont-wordmark.svg" alt="Moont"><a class="help" href="mailto:contato@moont.ai">Precisa de ajuda?</a><div class="box">${body}</div><span class="legal">© 2026 Moont · Elevessy</span></html>`);
}
function finishNativeAuthorization(res, target) {
  const destination = target.toString();
  const scriptDestination = JSON.stringify(destination).replace(/</g, '\\u003c');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return page(res, 'Conexão autorizada', `<h1>Conexão autorizada</h1><p>Retornando ao Claude Code…</p><a href="${esc(destination)}">Voltar ao Claude Code</a><script>window.location.replace(${scriptDestination})</script>`);
}
function params(req) {
  if (req.method !== 'POST') return req.query || {};
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  return req.body || {};
}
export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return res.status(405).end();
  const p = params(req);
  try {
    if (p.response_type !== 'code' || p.code_challenge_method !== 'S256' || !p.state) throw Object.assign(new Error('Solicitação OAuth incompleta.'), { code:'invalid_request' });
    const valid = await validateOAuthRequest({ clientId:p.client_id, redirectUri:p.redirect_uri, resource:p.resource || oauthResource, scope:p.scope });
    const access = await readCurrentAccessCookie(req);
    if (!access) return page(res, 'Entre no Moont', '<h1>Entre primeiro no Moont</h1><p>Abra o Moont, entre na sua conta e volte para esta janela para continuar a conexão.</p><a href="https://moont.ai" target="_blank" rel="noopener">Abrir Moont</a><a class="muted" href="javascript:location.reload()">Tentar novamente</a>', 401);
    if (!billingDisabled()) {
      let subscription;
      try { subscription = await findActiveSubscription(access.customerId); }
      catch (error) {
        if (error?.code === 'resource_missing') subscription = null;
        else return page(res, 'Verificação temporariamente indisponível', `<h1>Não foi possível verificar sua assinatura</h1><div class="account">Conta Moont<strong>${esc(access.email)}</strong></div><p>Tente novamente em alguns instantes. Sua conta e seus projetos não foram alterados.</p><a href="javascript:location.reload()">Tentar novamente</a>`, 503);
      }
      if (!subscription) return page(res, 'Assinatura necessária', `<h1>Assinatura inativa</h1><div class="account">Conta Moont<strong>${esc(access.email)}</strong></div><p>Esta conta precisa de um plano ativo para conectar o ChatGPT ou outro assistente.</p><a href="https://moont.ai/#planos">Ver planos</a>`, 402);
    }
    if (req.method === 'GET') {
      const hidden = Object.entries(p).map(([k,v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
      return page(res, 'Autorizar', `<h1>Conectar ${esc(valid.client.client_name)}</h1><p>O assistente poderá ${valid.scopes.includes('projects:write') ? 'ler e editar' : 'ler'} seus projetos Moont. Alterações usam prévia, controle de versão e podem ser desfeitas.</p><div class="account">Conta Moont<strong>${esc(access.email)}</strong></div><form method="post" action="/oauth/authorize">${hidden}<button name="decision" value="allow">Autorizar conexão</button><button class="muted" name="decision" value="deny">Cancelar</button></form>`);
    }
    const target = new URL(valid.redirectUri); target.searchParams.set('state', p.state);
    if (p.decision !== 'allow') { target.searchParams.set('error','access_denied'); return res.redirect(302, target.toString()); }
    const ownerId = resolveLibraryOwnerId(access);
    const code = await createAuthorizationCode({ clientId:p.client_id, ownerId, redirectUri:valid.redirectUri, scopes:valid.scopes, codeChallenge:p.code_challenge });
    target.searchParams.set('code', code); target.searchParams.set('iss','https://moont.ai');
    // CSP form-action protects forms from being redirected to HTTP. Native
    // clients legitimately use a loopback callback, so complete that final
    // navigation from a fresh response document instead of the form redirect.
    if (target.protocol === 'http:') return finishNativeAuthorization(res, target);
    return res.redirect(302, target.toString());
  } catch (cause) { return page(res, 'Não foi possível conectar', `<h1>Conexão recusada</h1><p>${esc(cause.message || 'Solicitação inválida.')}</p>`, cause.status || 400); }
}
