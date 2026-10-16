/**
 * Encaminha domínios alternativos ao endereço principal do Moont.
 * O domínio antigo continua servindo o app durante a migração dos dados locais.
 */
const CANONICAL_ORIGIN = 'https://moont.ai';
const ALTERNATE_HOSTS = new Set(['www.moont.ai', 'moont.com.br', 'www.moont.com.br']);

export const config = { runtime: 'nodejs' };

export default function middleware(request) {
  const host = String(request.headers.get('host') || '')
    .split(':')[0]
    .toLowerCase();

  if (!host.endsWith('.vercel.app') && !ALTERNATE_HOSTS.has(host)) return;

  const incoming = new URL(request.url);
  // O cron da Vercel não segue redirects; a própria rota exige CRON_SECRET.
  if (incoming.pathname === '/api/cron/cleanup-image-references') return;
  const dest = new URL(incoming.pathname + incoming.search, CANONICAL_ORIGIN);
  return Response.redirect(dest, 308);
}
