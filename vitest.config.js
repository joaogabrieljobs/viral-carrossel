// Config separada do vite.config.js de propósito: o config do Vite carrega
// middlewares de dev (proxies IA, /api/status) que não devem rodar em teste.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/helpers/env.js'],
  },
});
