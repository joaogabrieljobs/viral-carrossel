import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/ga4-consent.js', import.meta.url), 'utf8');
const ID = 'G-TESTE12345';

function elemento(tag) {
  return {
    tag, children: [], attrs: {}, style: {}, listeners: {}, removed: false,
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(filho) { this.children.push(filho); return filho; },
    addEventListener(tipo, fn) { this.listeners[tipo] = fn; },
    remove() { this.removed = true; },
  };
}

function montar({
  href = 'https://moont.ai/', id = ID, escolha, storageQuebrado = false, cookies = '', referrer = '',
} = {}) {
  const url = new URL(href);
  const head = elemento('head');
  const body = elemento('body');
  const guardado = new Map(escolha ? [['ga4_consent', escolha]] : []);
  const cookiesGravados = [];
  const document = {
    currentScript: { dataset: id ? { ga4Id: id } : {} },
    createElement: elemento,
    head,
    body,
    referrer,
    title: 'Moont',
    get cookie() { return cookies; },
    set cookie(v) { cookiesGravados.push(v); },
  };
  const recarregar = vi.fn();
  const ouvintes = {};
  const window = {
    addEventListener(tipo, fn) { ouvintes[tipo] = fn; },
    location: {
      href, hostname: url.hostname, pathname: url.pathname, search: url.search, reload: recarregar,
    },
    localStorage: {
      getItem(k) { if (storageQuebrado) throw new Error('bloqueado'); return guardado.get(k) ?? null; },
      setItem(k, v) { if (storageQuebrado) throw new Error('bloqueado'); guardado.set(k, v); },
    },
  };
  vm.runInNewContext(source, { window, document, URL, URLSearchParams });

  const scripts = () => head.children.filter((n) => n.tag === 'script');
  const avisos = () => body.children.filter((n) => !n.removed);
  const botao = (texto) => {
    const procurar = (no) => (no.tag === 'button' && no.textContent === texto
      ? no
      : no.children.map(procurar).find(Boolean));
    return procurar(avisos()[0]);
  };
  const camada = () => (window.dataLayer || []).map((args) => Array.from(args));
  return {
    window, scripts, avisos, botao, camada, guardado, cookiesGravados, recarregar, ouvintes,
  };
}

describe('GA4 só com consentimento', () => {
  it('sem escolha, mostra o aviso e não injeta script do Google', () => {
    const t = montar();
    expect(t.scripts()).toHaveLength(0);
    expect(t.avisos()).toHaveLength(1);
    expect(t.window.dataLayer).toBeUndefined();
  });

  it('recusado, não injeta nem mostra aviso', () => {
    const t = montar({ escolha: 'denied' });
    expect(t.scripts()).toHaveLength(0);
    expect(t.avisos()).toHaveLength(0);
  });

  it('aceitar no aviso injeta o gtag uma única vez', () => {
    const t = montar();
    t.botao('Aceitar').listeners.click();
    expect(t.avisos()).toHaveLength(0);
    expect(t.guardado.get('ga4_consent')).toBe('granted');
    expect(t.scripts()).toHaveLength(1);
    expect(t.scripts()[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
  });

  it('recusar no aviso grava a recusa e não carrega nada', () => {
    const t = montar();
    t.botao('Recusar').listeners.click();
    expect(t.guardado.get('ga4_consent')).toBe('denied');
    expect(t.avisos()).toHaveLength(0);
    expect(t.scripts()).toHaveLength(0);
  });

  it('já aceito, carrega sem aviso, nega anúncios e manda um page_view', () => {
    const t = montar({ escolha: 'granted' });
    expect(t.avisos()).toHaveLength(0);
    expect(t.scripts()).toHaveLength(1);
    const camada = t.camada();
    expect(camada[0]).toEqual(['consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }]);
    const config = camada.find((c) => c[0] === 'config');
    expect(config[1]).toBe(ID);
    expect(config[2].send_page_view).toBe(false);
    expect(camada.filter((c) => c[0] === 'event' && c[1] === 'page_view')).toHaveLength(1);
  });

  it('envia só origem, caminho e utm_*', () => {
    const t = montar({
      escolha: 'granted',
      href: 'https://moont.ai/?app=1&utm_source=x&session_id=segredo#t',
      referrer: 'https://exemplo.com/a?token=segredo',
    });
    const config = t.camada().find((c) => c[0] === 'config')[2];
    expect(config.page_location).toBe('https://moont.ai/?utm_source=x');
    expect(config.page_referrer).toBe('https://exemplo.com/a');
    expect(JSON.stringify(t.camada())).not.toContain('segredo');
  });

  it.each([
    ['com código de equipe', 'https://moont.ai/?share=F5M3CGPB&app=1'],
    ['na redefinição de senha', 'https://moont.ai/redefinir-senha'],
    ['no console admin', 'https://moont.ai/admin/usuarios'],
    ['em localhost', 'http://localhost:4173/'],
    ['em preview', 'https://moont-git-x.vercel.app/'],
  ])('%s não carrega nem mostra aviso, mesmo aceito', (_nome, href) => {
    const aceito = montar({ href, escolha: 'granted' });
    expect(aceito.scripts()).toHaveLength(0);
    const novo = montar({ href });
    expect(novo.avisos()).toHaveLength(0);
    novo.window.moontGA4.abrirPreferencias();
    expect(novo.avisos()).toHaveLength(0);
  });

  it('sem ID de medição fica inerte', () => {
    const t = montar({ id: '', escolha: 'granted' });
    expect(t.scripts()).toHaveLength(0);
    expect(t.avisos()).toHaveLength(0);
  });

  it('localStorage bloqueado não quebra: avisa e não carrega', () => {
    const t = montar({ storageQuebrado: true });
    expect(t.avisos()).toHaveLength(1);
    expect(t.scripts()).toHaveLength(0);
  });

  it('evento só é enviado depois do aceite, sem propriedades', () => {
    const antes = montar();
    antes.window.moontGA4.evento('paywall_open');
    expect(antes.window.dataLayer).toBeUndefined();

    const depois = montar({ escolha: 'granted' });
    depois.window.moontGA4.evento('paywall_open', { email: 'a@b.c' });
    expect(depois.camada().at(-1)).toEqual(['event', 'paywall_open']);
  });

  const DESATIVA = `ga-disable-${ID}`;

  it('revogar desliga o envio antes de apagar os cookies _ga, sem recarregar a página', () => {
    const t = montar({ escolha: 'granted', cookies: '_ga=1; _ga_ABC=2; vc_outro=3' });
    t.window.moontGA4.revogar();
    expect(t.guardado.get('ga4_consent')).toBe('denied');
    expect(t.window[DESATIVA]).toBe(true);
    expect(t.camada().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(t.cookiesGravados.some((c) => c.startsWith('_ga=;') && c.includes('domain=.moont.ai'))).toBe(true);
    expect(t.cookiesGravados.some((c) => c.startsWith('_ga_ABC=;'))).toBe(true);
    expect(t.cookiesGravados.some((c) => c.startsWith('vc_outro'))).toBe(false);
    expect(t.recarregar).not.toHaveBeenCalled();
    t.window.moontGA4.evento('paywall_open');
    expect(t.camada().some((c) => c[1] === 'paywall_open')).toBe(false);
  });

  it('preferências reabrem o aviso: recusar desliga e aceitar de novo religa sem outro script', () => {
    const t = montar({ escolha: 'granted' });
    t.window.moontGA4.abrirPreferencias();
    t.botao('Recusar').listeners.click();
    expect(t.guardado.get('ga4_consent')).toBe('denied');
    t.window.moontGA4.abrirPreferencias();
    t.botao('Aceitar').listeners.click();
    expect(t.window[DESATIVA]).toBe(false);
    expect(t.scripts()).toHaveLength(1);
    t.window.moontGA4.evento('paywall_open');
    expect(t.camada().at(-1)).toEqual(['event', 'paywall_open']);
  });

  it('recusa feita em outra aba desliga esta', () => {
    const t = montar({ escolha: 'granted' });
    t.ouvintes.storage({ key: 'ga4_consent', newValue: 'denied' });
    expect(t.window[DESATIVA]).toBe(true);
    t.window.moontGA4.evento('paywall_open');
    expect(t.camada().some((c) => c[1] === 'paywall_open')).toBe(false);
  });

  it('não manda evento se o endereço passou a ter ?share sem recarregar', () => {
    const t = montar({ escolha: 'granted' });
    t.window.location.search = '?share=F5M3CGPB';
    t.window.moontGA4.evento('paywall_open');
    expect(t.camada().some((c) => c[1] === 'paywall_open')).toBe(false);
  });
});

describe('GA4 na página e na CSP', () => {
  const ler = (caminho) => readFileSync(new URL(`../../${caminho}`, import.meta.url), 'utf8');

  it('index.html carrega o consentimento como script externo', () => {
    expect(ler('index.html')).toMatch(/<script defer src="\/ga4-consent\.js" data-ga4-id="(G-[A-Z0-9]+)?"><\/script>/);
  });

  it('a CSP libera os domínios do GA4 sem liberar script inline', () => {
    const csp = JSON.parse(ler('vercel.json')).headers
      .flatMap((e) => e.headers || [])
      .find((h) => h.key === 'Content-Security-Policy').value;
    const diretiva = (nome) => csp.split('; ').find((d) => d.startsWith(`${nome} `));
    expect(diretiva('script-src')).toContain('https://*.googletagmanager.com');
    expect(diretiva('script-src')).not.toContain("'unsafe-inline'");
    for (const fonte of ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com']) {
      expect(diretiva('connect-src')).toContain(fonte);
    }
  });
});
