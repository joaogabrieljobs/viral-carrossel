/* GA4 com consentimento básico: nada do Google é carregado antes do "Aceitar".
 * Arquivo externo para manter a CSP sem script inline. O ID de medição vem do
 * atributo data-ga4-id da tag em index.html; sem ID, o arquivo fica inerte.
 * Só vale no domínio de produção e nunca em páginas com segredo na URL. */
(function ga4ComConsentimento() {
  var CHAVE = 'ga4_consent';
  var HOSTS = ['moont.ai', 'www.moont.ai'];
  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var id = (document.currentScript && document.currentScript.dataset.ga4Id) || '';
  var carregado = false;
  var ligado = false;
  var aviso = null;

  function podeMedir() {
    var local = window.location;
    if (!id || HOSTS.indexOf(local.hostname) === -1) return false;
    if (local.pathname === '/redefinir-senha' || local.pathname.indexOf('/admin') === 0) return false;
    return !new URLSearchParams(local.search).has('share');
  }

  function urlLimpa(href) {
    try {
      var url = new URL(href);
      var query = new URLSearchParams();
      UTMS.forEach(function (chave) {
        var valor = url.searchParams.get(chave);
        if (valor) query.set(chave, valor);
      });
      var texto = query.toString();
      return url.origin + url.pathname + (texto ? '?' + texto : '');
    } catch (erro) {
      return '';
    }
  }

  function ler() {
    try { return window.localStorage.getItem(CHAVE); } catch (erro) { return null; }
  }

  function gravar(valor) {
    try { window.localStorage.setItem(CHAVE, valor); } catch (erro) { /* vale só nesta página */ }
  }

  // O gtag exige o objeto `arguments`, não um array.
  function gtag() { window.dataLayer.push(arguments); }

  function ligar() {
    if (ligado || !podeMedir()) return;
    ligado = true;
    window['ga-disable-' + id] = false;
    // Aceitou de novo depois de recusar: o gtag já está na página.
    if (carregado) {
      gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    carregado = true;
    window.dataLayer = window.dataLayer || [];
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    // A tag do Google envia um page_view por conta própria, antes de ler o
    // `config`. O `set` precisa vir antes do `js` para esse envio (e todos os
    // eventos) levar o endereço limpo; por isso também não há page_view manual.
    var enderecos = { page_location: urlLimpa(window.location.href) };
    enderecos.page_referrer = document.referrer ? urlLimpa(document.referrer) : '';
    gtag('set', enderecos);
    gtag('js', new Date());
    gtag('config', id, { send_page_view: false });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  // Só o nome: propriedades nunca saem daqui.
  function evento(nome) {
    if (ligado && podeMedir()) gtag('event', nome);
  }

  function apagarCookies() {
    var dominio = window.location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function (par) {
      var nome = par.split('=')[0].trim();
      if (nome.indexOf('_ga') !== 0) return;
      ['', '; domain=.' + dominio].forEach(function (escopo) {
        document.cookie = nome + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + escopo;
      });
    });
  }

  // Sem recarregar a página, para não cortar uma geração ou edição no studio.
  // `ga-disable` é a chave oficial que impede o gtag de enviar e de gravar cookie.
  function desligar() {
    if (carregado) {
      window['ga-disable-' + id] = true;
      if (ligado) gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    ligado = false;
    apagarCookies();
  }

  function revogar() {
    gravar('denied');
    desligar();
  }

  function fechar() {
    if (aviso) aviso.remove();
    aviso = null;
  }

  function criar(tag, estilo, texto) {
    var no = document.createElement(tag);
    no.style.cssText = estilo;
    if (texto) no.textContent = texto;
    return no;
  }

  function abrirPreferencias() {
    if (!podeMedir() || aviso || !document.body) return;
    aviso = criar('div', 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:520px;margin:0 auto;padding:16px;border-radius:14px;background:#14161d;color:#f3f0e7;border:1px solid #3a3e4b;box-shadow:0 12px 40px rgba(0,0,0,.45);font:14px/1.45 system-ui,sans-serif;');
    aviso.setAttribute('role', 'dialog');
    aviso.setAttribute('aria-label', 'Cookies de medição');
    var texto = criar('p', 'margin:0 0 12px;', 'Usamos o Google Analytics para medir o uso do site. Ele só é ligado se você aceitar. ');
    var link = criar('a', 'color:#f3f0e7;text-decoration:underline;', 'Política de privacidade');
    link.href = '/privacidade';
    texto.appendChild(link);
    var botoes = criar('div', 'display:flex;gap:8px;');
    var estiloBotao = 'flex:1;min-height:44px;border-radius:10px;border:1px solid #f3f0e7;background:transparent;color:#f3f0e7;font:600 14px system-ui,sans-serif;cursor:pointer;';
    var recusar = criar('button', estiloBotao, 'Recusar');
    var aceitar = criar('button', estiloBotao, 'Aceitar');
    recusar.type = 'button';
    aceitar.type = 'button';
    recusar.addEventListener('click', function () {
      fechar();
      revogar();
    });
    aceitar.addEventListener('click', function () {
      gravar('granted');
      fechar();
      ligar();
    });
    botoes.appendChild(recusar);
    botoes.appendChild(aceitar);
    aviso.appendChild(texto);
    aviso.appendChild(botoes);
    document.body.appendChild(aviso);
  }

  window.moontGA4 = { evento: evento, abrirPreferencias: abrirPreferencias, revogar: revogar };
  window.addEventListener('storage', function (mudanca) {
    if (mudanca.key === CHAVE && mudanca.newValue === 'denied') desligar();
  });

  if (!podeMedir()) return;
  var escolha = ler();
  if (escolha === 'granted') ligar();
  else if (escolha !== 'denied') abrirPreferencias();
})();
