// Setup global dos testes (vitest.config.js → setupFiles).
// Segredos SEMPRE sintéticos — nunca ler .env.local (TDD §10, RNF-02/05).
process.env.ACCESS_COOKIE_SECRET = 'test-secret-suite-confianca-nao-usar-em-producao';
