import { readCurrentAccessCookie, billingDisabled } from '../lib/access.js';
import { resolveAccountEntitlement } from '../lib/account-entitlements.js';
import { resolveLibraryOwnerId } from '../lib/library-sync-store.js';
import { createAuthorizationCode, oauthResource, validateOAuthRequest } from '../lib/oauth-store.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const TRUSTED_OAUTH_HOSTS = new Set(['chatgpt.com', 'claude.ai']);
// O registro dinâmico é aberto (MOO-17): client_name é texto livre de quem
// registrou. O que a Moont garante é o host de retorno, então ele vem primeiro
// e dá o título; o nome aparece rotulado como informado pelo aplicativo.
// `hostname` sai do URL já em minúsculas e punycode (sem homógrafos).
function redirectDisclosure(uri) {
  const target = new URL(uri);
  const hostname = target.hostname.toLowerCase();
  const loopback = target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);
  const trusted = loopback || Array.from(TRUSTED_OAUTH_HOSTS).some((allowed) =>
    hostname === allowed || hostname.endsWith(`.${allowed}`));
  return { hostname, loopback, host: loopback ? `${hostname} (aplicativo neste aparelho)` : hostname, trusted };
}
// Campos que só a pessoa decide na tela; vindos no link, não viram ocultos.
const CONSENT_FIELDS = new Set(['decision', 'trust_host']);
function page(res, title, body, status = 200) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)} — Moont</title><style>body{margin:0;background:#090a0f;color:#f7f4ed;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.box{width:min(520px,calc(100% - 40px));padding:28px;border:1px solid #343641;border-radius:18px;background:#15161d}h1{font-size:25px;overflow-wrap:anywhere}p{color:#b8b8c1;line-height:1.55}.account{margin:20px 0;padding:14px 16px;border:1px solid #343641;border-radius:12px;color:#b8b8c1}.account strong{display:block;margin-top:4px;color:#f7f4ed;overflow-wrap:anywhere}.destination{margin-top:-8px}.warning{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:#4a2f13;color:#ffd29a;font-size:12px;font-weight:700}button,a{display:inline-flex;padding:12px 18px;border-radius:999px;border:0;background:#7668f7;color:white;font-weight:700;text-decoration:none;cursor:pointer}.muted{background:#292b34;margin-left:8px}.trust{display:flex;gap:10px;align-items:flex-start;margin:0 0 18px;padding:12px 14px;border:1px solid #6b4a1f;border-radius:12px;background:#2a2116;color:#ffd29a;line-height:1.45;overflow-wrap:anywhere}.trust input{width:20px;height:20px;margin:2px 0 0;flex:none}</style><div class="box">${body}</div></html>`);
}
function finishNativeAuthorization(res, target) {
  const destination = target.toString();
  res.setHeader('Referrer-Policy', 'no-referrer');
  return page(res, 'Conexão autorizada', `<h1>Conexão autorizada</h1><p>Retornando ao Claude Code…</p><a id="oauth-native-return" href="${esc(destination)}">Voltar ao Claude Code</a><script src="/oauth-return.js" defer></script>`);
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
    if (!access) return page(res, 'Entre no Moont', '<h1>Entre primeiro no Moont</h1><p>Abra o Moont, entre na sua conta e volte para esta janela para continuar a conexão.</p><a href="https://moont.ai" target="_blank" rel="noopener">Abrir Moont</a><a class="muted" href="">Tentar novamente</a>', 401);
    if (!billingDisabled()) {
      let subscription;
      try { subscription = (await resolveAccountEntitlement(access.customerId)).active; }
      catch (error) {
        if (error?.code === 'resource_missing') subscription = null;
        else return page(res, 'Verificação temporariamente indisponível', `<h1>Não foi possível verificar sua assinatura</h1><div class="account">Conta Moont<strong>${esc(access.email)}</strong></div><p>Tente novamente em alguns instantes. Sua conta e seus projetos não foram alterados.</p><a href="">Tentar novamente</a>`, 503);
      }
      if (!subscription) return page(res, 'Assinatura necessária', `<h1>Assinatura inativa</h1><div class="account">Conta Moont<strong>${esc(access.email)}</strong></div><p>Esta conta precisa de um plano ativo para conectar o ChatGPT ou outro assistente.</p><a href="https://moont.ai/#planos">Ver planos</a>`, 402);
    }
    const disclosure = redirectDisclosure(valid.redirectUri);
    if (req.method === 'GET') {
      const hidden = Object.entries(p).filter(([k]) => !CONSENT_FIELDS.has(k))
        .map(([k,v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
      const warning = disclosure.trusted ? '' : '<span class="warning">Aplicativo não verificado pela Moont</span>';
      const title = disclosure.loopback ? 'Conectar um aplicativo neste aparelho' : `Conectar ${disclosure.hostname}`;
      // Host não verificado: confirmação explícita, conferida de novo no POST.
      const trustBox = disclosure.trusted ? '' : `<label class="trust"><input type="checkbox" name="trust_host" value="${esc(disclosure.hostname)}" required> Confio em ${esc(disclosure.hostname)} e quero que ele receba acesso aos meus projetos.</label>`;
      return page(res, 'Autorizar', `<h1>${esc(title)}</h1><div class="account destination">Retorno da conexão<strong>${esc(disclosure.host)}</strong>${warning}</div><div class="account">Nome informado pelo aplicativo<strong>${esc(valid.client.client_name)}</strong></div><p>O aplicativo poderá ${valid.scopes.includes('projects:write') ? 'ler e editar' : 'ler'} seus projetos Moont. Alterações usam prévia, controle de versão e podem ser desfeitas.</p><div class="account">Conta Moont<strong>${esc(access.email)}</strong></div><form method="post" action="/oauth/authorize">${hidden}${trustBox}<button name="decision" value="allow">Autorizar conexão</button><button class="muted" name="decision" value="deny" formnovalidate>Cancelar</button></form>`);
    }
    const target = new URL(valid.redirectUri); target.searchParams.set('state', p.state);
    if (p.decision !== 'allow') { target.searchParams.set('error','access_denied'); return res.redirect(302, target.toString()); }
    // O `required` do navegador não protege nada: a confirmação vale no servidor.
    if (!disclosure.trusted && p.trust_host !== disclosure.hostname) {
      return page(res, 'Confirmação necessária', `<h1>Confirmação necessária</h1><p>Esta conexão devolve o acesso para <strong>${esc(disclosure.hostname)}</strong>, que não é verificado pela Moont. Volte à tela anterior, confira o endereço e marque “Confio em ${esc(disclosure.hostname)}” para autorizar.</p>`, 400);
    }
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
