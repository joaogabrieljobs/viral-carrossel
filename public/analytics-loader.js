/* Analytics só em páginas sem segredo na URL. Arquivo externo mantém a CSP
 * sem script inline; Plausible continua sem cookies e sem PII. */
(function loadAnalytics() {
  window.plausible = window.plausible || function plausible() {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };
  var query = new URLSearchParams(window.location.search);
  if (window.location.pathname === '/redefinir-senha' || query.has('share')) return;
  var analytics = document.createElement('script');
  analytics.defer = true;
  analytics.dataset.domain = 'viralcarrossel.com.br';
  analytics.src = 'https://plausible.io/js/script.tagged-events.js';
  document.head.appendChild(analytics);
}());
