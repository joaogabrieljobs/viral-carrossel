import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveWebTrendImageUrl } from './webTrendServer.js';
import { serverFetchUrlPlainText, assertPublicHttpUrl } from './urlSourceFetch.js';

// Proxy de desenvolvimento: contorna CORS de api.anthropic.com e api.openai.com.
// - /api/anthropic/*  → https://api.anthropic.com/* (header x-api-key vem do .env)
// - /api/openai/*     → https://api.openai.com/*    (header Authorization vem do
//                       header `x-openai-key` da request, ou do .env como fallback)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'web-trend-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const path = req.url?.split('?')[0] || '';
            if (path !== '/api/web-trend-search') return next();
            try {
              const urlObj = new URL(req.url || '', 'http://localhost');
              const q = urlObj.searchParams.get('q') || '';
              const seed = urlObj.searchParams.get('seed') || '0';
              const { url, source } = await resolveWebTrendImageUrl(q, seed, env);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ url, source }));
            } catch (e) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ error: e.message || 'web trend failed' }));
            }
          });
          server.middlewares.use(async (req, res, next) => {
            const pathOnly = req.url?.split('?')[0] || '';
            if (pathOnly !== '/api/fetch-source') return next();
            try {
              const urlObj = new URL(req.url || '', 'http://localhost');
              const raw = urlObj.searchParams.get('url') || '';
              assertPublicHttpUrl(raw);
              const text = await serverFetchUrlPlainText(raw);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ ok: true, text }));
            } catch (e) {
              const msg = e?.message || 'fetch-source failed';
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
        },
      },
    ],
    server: {
      host: true,
      port: 5173,
      // Se 5173 estiver ocupada por outro programa, o Vite saltava para 5174, 5175…
      // e quem abria http://localhost:5173 via 404. Com strictPort, falha em voz alta
      // ou tens de libertar a porta — assim o URL do terminal corresponde sempre.
      strictPort: true,
      // Não usar open:true no Cursor: o browser embutido pode falhar com localhost
      // (chrome-error://… vs localhost — “Domains, protocols and ports must match”).
      open: false,
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.ANTHROPIC_API_KEY) {
                proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY);
                proxyReq.setHeader('anthropic-version', '2023-06-01');
              }
            });
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['access-control-allow-origin'] = '*';
            });
          },
        },
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openai/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const userKey = req.headers['x-openai-key'];
              if (userKey) {
                proxyReq.setHeader('Authorization', `Bearer ${userKey}`);
                proxyReq.removeHeader('x-openai-key');
              } else if (env.OPENAI_API_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${env.OPENAI_API_KEY}`);
              }
            });
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['access-control-allow-origin'] = '*';
            });
          },
        },
        // Endpoint de status: cliente descobre quais providers o servidor tem configurados
        '/api/status': {
          bypass: (req, res) => {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({
              anthropic: !!env.ANTHROPIC_API_KEY,
              openai: !!env.OPENAI_API_KEY,
              unsplash: !!env.UNSPLASH_ACCESS_KEY,
              pexels: !!env.PEXELS_API_KEY,
              dev: true,
            }));
            return false;
          },
          target: 'http://localhost', // não usado, bypass retorna direto
        },
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    },
  };
});
