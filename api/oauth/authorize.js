import { readCurrentAccessCookie, billingDisabled } from '../lib/access.js';
import { findActiveSubscription } from '../lib/stripe.js';
import { resolveLibraryOwnerId } from '../lib/library-sync-store.js';
import { createAuthorizationCode, oauthResource, validateOAuthRequest } from '../lib/oauth-store.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
function page(res, title, body, status = 200) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)} — Moont</title><style>body{margin:0;background:#090a0f;color:#f7f4ed;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.box{width:min(520px,calc(100% - 40px));padding:28px;border:1px solid #343641;border-radius:18px;background:#15161d}h1{font-size:25px}p{color:#b8b8c1;line-height:1.55}.account{margin:20px 0;padding:14px 16px;border:1px solid #343641;border-radius:12px;color:#b8b8c1}.account strong{display:block;margin-top:4px;color:#f7f4ed;overflow-wrap:anywhere}button,a{display:inline-flex;padding:12px 18px;border-radius:999px;border:0;background:#7668f7;color:white;font-weight:700;text-decoration:none;cursor:pointer}.muted{background:#292b34;margin-left:8px}</style><div class="box">${body}</div></html>`);
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
    if (p.response_type !== 'code' || p.code_challenge_method !== 'S256' || p.resource !== oauthResource || !p.state) throw Object.assign(new Error('Solicitação OAuth incompleta.'), { code:'invalid_request' });
    const valid = await validateOAuthRequest({ clientId:p.client_id, redirectUri:p.redirect_uri, resource:p.resource, scope:p.scope });
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
    return res.redirect(302, target.toString());
  } catch (cause) { return page(res, 'Não foi possível conectar', `<h1>Conexão recusada</h1><p>${esc(cause.message || 'Solicitação inválida.')}</p>`, cause.status || 400); }
}
