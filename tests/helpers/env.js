// Setup global dos testes (vitest.config.js → setupFiles).
// Segredos SEMPRE sintéticos — nunca ler .env.local (TDD §10, RNF-02/05).
process.env.ACCESS_COOKIE_SECRET = 'test-secret-suite-confianca-nao-usar-em-producao';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_suite_confianca';
process.env.STRIPE_PRICE_ID = 'price_test_fake';
process.env.APP_URL = 'https://viral-carrossel.vercel.app';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'GOCSPX-test-fake';
delete process.env.BILLING_DISABLED;
