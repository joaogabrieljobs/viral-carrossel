// Reteste 24/11 (conta 7): o aviso vermelho de armazenamento cheio voltava em
// toda aba nova e ao recarregar. A marca de "já avisei" ficava em
// sessionStorage, que é de cada aba, e era apagada sempre que uma gravação
// passava. Com assinatura o aviso vale uma vez por dia neste navegador.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;
const MORNING = new Date(2026, 10, 24, 9, 0, 0).getTime();

function memory({ full = false } = {}) {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      values.set(key, String(value));
    },
    removeItem: (key) => { values.delete(key); },
  };
}

/** Uma carga de página: módulo zerado. A aba (sessão) e o navegador (local) vêm de fora. */
async function pageLoad({ local, session }) {
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.resetModules();
  return import('../../src/utils/storage.js');
}

beforeEach(() => { vi.stubGlobal('window', { dispatchEvent: () => {} }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('RT24 conta 7: aviso de armazenamento cheio uma vez por dia neste navegador', () => {
  it('aba nova no mesmo dia não repete o aviso', async () => {
    const local = memory();
    const first = await pageLoad({ local, session: memory() });
    expect(first.shouldShowQuotaNotice({ free: false, now: MORNING })).toBe(true);
    const newTab = await pageLoad({ local, session: memory() });
    expect(newTab.shouldShowQuotaNotice({ free: false, now: MORNING + 60_000 })).toBe(false);
    const anotherTab = await pageLoad({ local, session: memory() });
    expect(anotherTab.shouldShowQuotaNotice({ free: false, now: MORNING + 8 * 60 * 60 * 1000 })).toBe(false);
  });

  it('recarregar não repete, nem quando uma gravação passou e a seguinte falhou de novo', async () => {
    const local = memory();
    const session = memory();
    const failing = new Set(['vc_library']);
    const quota = {
      ...local,
      setItem: (key, value) => {
        if (failing.has(key)) throw new DOMException('full', 'QuotaExceededError');
        local.setItem(key, value);
      },
    };
    let page = await pageLoad({ local: quota, session });
    expect(page.lsSet('vc_library', [{ id: 'p1' }])).toBe(false);
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING })).toBe(true);
    // Uma lista menor coube; a lista inteira volta a não caber.
    failing.clear();
    expect(page.lsSet('vc_library', [{ id: 'p1' }])).toBe(true);
    failing.add('vc_library');
    expect(page.lsSet('vc_library', [{ id: 'p1' }, { id: 'p2' }])).toBe(false);
    page = await pageLoad({ local: quota, session });
    expect(page.lsSet('vc_library', [{ id: 'p1' }, { id: 'p2' }])).toBe(false);
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING + 5 * 60_000 })).toBe(false);
  });

  it('na página que avisou, o aviso fechado por uma gravação que passou volta se a falha voltar', async () => {
    const failing = new Set(['vc_library']);
    const local = memory();
    const quota = { ...local, setItem: (key, value) => {
      if (failing.has(key)) throw new DOMException('full', 'QuotaExceededError');
      local.setItem(key, value);
    } };
    const page = await pageLoad({ local: quota, session: memory() });
    page.lsSet('vc_library', [{ id: 'p1' }]);
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING })).toBe(true);
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING })).toBe(false);
    failing.clear();
    page.lsSet('vc_library', [{ id: 'p1' }]); // o app fecha o aviso aqui
    failing.add('vc_library');
    page.lsSet('vc_library', [{ id: 'p1' }]);
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING + 1_000 })).toBe(true);
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING + 2_000 })).toBe(false);
  });

  it('no dia seguinte avisa de novo, uma vez', async () => {
    const local = memory();
    const first = await pageLoad({ local, session: memory() });
    expect(first.shouldShowQuotaNotice({ free: false, now: MORNING })).toBe(true);
    const nextDay = await pageLoad({ local, session: memory() });
    expect(nextDay.shouldShowQuotaNotice({ free: false, now: MORNING + DAY })).toBe(true);
    const later = await pageLoad({ local, session: memory() });
    expect(later.shouldShowQuotaNotice({ free: false, now: MORNING + DAY + 60_000 })).toBe(false);
    // A mesma aba aberta desde ontem também avisa uma vez no dia novo.
    expect(first.shouldShowQuotaNotice({ free: false, now: MORNING + DAY + 120_000 })).toBe(false);
  });

  it('armazenamento cheio a ponto de recusar a própria marca: não repete na mesma aba e a aba seguinte tenta de novo', async () => {
    const local = memory({ full: true });
    const session = memory();
    let page = await pageLoad({ local, session });
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING })).toBe(true);
    expect(local.values.size).toBe(0); // a marca do dia não coube
    page = await pageLoad({ local, session }); // recarregar a mesma aba
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING + 60_000 })).toBe(false);
    const newTab = await pageLoad({ local, session: memory() });
    expect(newTab.shouldShowQuotaNotice({ free: false, now: MORNING + 120_000 })).toBe(true);
  });

  it('sem armazenamento nenhum, avisa uma vez por carga da página', async () => {
    const blocked = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => {} };
    const page = await pageLoad({ local: blocked, session: blocked });
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING })).toBe(true);
    expect(page.shouldShowQuotaNotice({ free: false, now: MORNING + 1_000 })).toBe(false);
  });

  it('plano grátis: a cópia deste aparelho é a única, o aviso aparece sempre e não gasta a marca do dia', async () => {
    const local = memory();
    const page = await pageLoad({ local, session: memory() });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(page.shouldShowQuotaNotice({ free: true, now: MORNING + attempt })).toBe(true);
    }
    expect(local.values.size).toBe(0);
    const newTab = await pageLoad({ local, session: memory() });
    expect(newTab.shouldShowQuotaNotice({ free: true, now: MORNING + 60_000 })).toBe(true);
  });

  it('a marca do dia não entra no cofre da conta nem é apagada ao sair', async () => {
    const { readFileSync } = await import('node:fs');
    const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    expect(read('src/utils/account-vault.js')).not.toContain('vc_quota_notice');
    expect(read('src/utils/storage.js')).toMatch(/QUOTA_NOTICE_KEY = 'vc_quota_notice_day'/);
  });
});
