import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
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
        name: 'dev-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathOnly = req.url?.split('?')[0] || '';
            if (pathOnly === '/api/fetch-source') {
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
              return;
            }
            if (pathOnly === '/api/ai/sjinn-image') {
              // Dev: reutiliza o handler Vercel (BILLING_DISABLED ou cookie via vercel dev).
              try {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const rawBody = Buffer.concat(chunks).toString('utf8');
                req.body = rawBody ? JSON.parse(rawBody) : {};
              } catch {
                req.body = {};
              }
              const fakeRes = {
                statusCode: 200,
                headers: {},
                setHeader(k, v) { this.headers[k] = v; },
                status(code) { this.statusCode = code; return this; },
                json(payload) {
                  res.statusCode = this.statusCode;
                  Object.entries(this.headers).forEach(([k, v]) => res.setHeader(k, v));
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify(payload));
                },
                end(...args) { res.end(...args); },
              };
              process.env.BILLING_DISABLED = process.env.BILLING_DISABLED || 'true';
              const { default: sjinnHandler } = await import('./api/ai/sjinn-image.js');
              await sjinnHandler(req, fakeRes);
              return;
            }
            return next();
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
            proxy.on('proxyReq', (proxyReq, req) => {
              const userKey = req.headers['x-anthropic-key'];
              if (userKey) {
                proxyReq.setHeader('x-api-key', String(userKey));
                proxyReq.setHeader('anthropic-version', '2023-06-01');
                proxyReq.removeHeader('x-anthropic-key');
              } else if (env.ANTHROPIC_API_KEY) {
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
        '/api/zai': {
          target: 'https://api.z.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/zai/, ''),
        },
        '/api/kimi': {
          target: 'https://api.moonshot.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kimi/, ''),
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
    build: {
      // Code-splitting: separa vendor estável (react, lucide) do app code.
      // Quando só ViralCarrossel.jsx muda, vendor fica cacheado entre deploys
      // → user re-baixa só ~150KB em vez de ~640KB. Cache-control immutable
      // (definido em vercel.json) garante 1 ano de cache pros chunks vendor.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'lucide-icons';
            }
            if (id.includes('node_modules/gsap') || id.includes('/hooks/gsapSetup')) {
              return 'gsap-vendor';
            }
            return undefined;
          },
        },
      },
      // Aumenta o warning threshold já que o app é grande por natureza.
      chunkSizeWarningLimit: 700,
    },
  };
});
