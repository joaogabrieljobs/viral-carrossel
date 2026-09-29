/**
 * Força o domínio oficial: hosts *.vercel.app → viralcarrossel.com.br.
 * URLs de deploy da Vercel não ficam como entrada pública do produto.
 */
const CANONICAL_ORIGIN = 'https://viralcarrossel.com.br';

export const config = { runtime: 'nodejs' };

export default function middleware(request) {
  const host = String(request.headers.get('host') || '')
    .split(':')[0]
    .toLowerCase();

  if (!host.endsWith('.vercel.app')) return;

  const incoming = new URL(request.url);
  // O cron da Vercel não segue redirects; a própria rota exige CRON_SECRET.
  if (incoming.pathname === '/api/cron/cleanup-image-references') return;
  const dest = new URL(incoming.pathname + incoming.search, CANONICAL_ORIGIN);
  return Response.redirect(dest, 308);
}
