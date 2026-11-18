import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FREE_PROJECT_LIMIT, isFreeSession, freeProjectLimitReached,
  markFreePlanUse, readFreePlanSince, stashFreePlanDrafts, planFreePlanDraftRecovery, clearFreePlanDrafts,
  rememberUpgradeReturn, takeUpgradeReturn,
  setPaidFeatureGate, assertPaidFeature, isPaidFeatureBlocked, isPlanRequiredError,
  FREE_PLAN_DRAFTS_KEY, FREE_PLAN_SINCE_KEY, UPGRADE_RETURN_KEY,
} from '../../src/utils/free-plan.js';

const OWNER = 'email:gratis@teste.exemplo';
const entry = (id, updatedAt, title = id) => ({ id, name: id, updatedAt, doc: { slides: [{ id: `${id}-1`, title }] } });

beforeEach(() => {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => store.clear(),
  });
  setPaidFeatureGate({ blocked: false });
});

describe('sessão grátis', () => {
  it('só conta autenticada sem assinatura é grátis', () => {
    expect(isFreeSession({ active: false, free: true, email: 'a@b.c' })).toBe(true);
    expect(isFreeSession({ active: false, free: true, customerId: 'cus_1' })).toBe(true);
    expect(isFreeSession({ active: true, free: true, email: 'a@b.c' })).toBe(false); // pagou
    expect(isFreeSession({ active: false, free: true })).toBe(false); // anônimo não é grátis
    expect(isFreeSession({ active: false, status: 'anonymous', email: null })).toBe(false);
    expect(isFreeSession({ active: false, email: 'a@b.c' })).toBe(false); // servidor antigo
    expect(isFreeSession(null)).toBe(false);
  });

  it('limite de projetos barra a partir de três', () => {
    expect(FREE_PROJECT_LIMIT).toBe(3);
    expect(freeProjectLimitReached([1, 2])).toBe(false);
    expect(freeProjectLimitReached([1, 2, 3])).toBe(true);
    expect(freeProjectLimitReached(null)).toBe(false);
  });
});

describe('portão de recurso pago', () => {
  it('conta paga passa sem efeito', () => {
    const onBlocked = vi.fn();
    setPaidFeatureGate({ blocked: false, onBlocked });
    expect(() => assertPaidFeature('text')).not.toThrow();
    expect(onBlocked).not.toHaveBeenCalled();
    expect(isPaidFeatureBlocked()).toBe(false);
  });

  it('conta grátis: avisa a interface e recusa com erro identificável', () => {
    const onBlocked = vi.fn();
    setPaidFeatureGate({ blocked: true, onBlocked });
    let error;
    try { assertPaidFeature('image'); } catch (e) { error = e; }
    expect(isPlanRequiredError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'plan_required', feature: 'image' });
    expect(error.message).toMatch(/imagem/i);
    expect(onBlocked).toHaveBeenCalledWith('image');
  });

  it('a recusa não depende da interface: aviso que falha ainda bloqueia', () => {
    setPaidFeatureGate({ blocked: true, onBlocked: () => { throw new Error('interface quebrada'); } });
    expect(() => assertPaidFeature('text')).toThrow(/planos pagos/);
  });
});

describe('rascunhos do grátis ao assinar', () => {
  it('guarda o primeiro uso e não o adianta em visitas seguintes', () => {
    expect(markFreePlanUse(OWNER, 1000)).toBe(1000);
    expect(markFreePlanUse(OWNER, 5000)).toBe(1000);
    expect(readFreePlanSince(OWNER)).toBe(1000);
    expect(readFreePlanSince('email:outra@teste.exemplo')).toBeNull();
  });

  it('outra conta no mesmo navegador recomeça o marcador', () => {
    markFreePlanUse(OWNER, 1000);
    expect(markFreePlanUse('email:outra@teste.exemplo', 9000)).toBe(9000);
    expect(readFreePlanSince(OWNER)).toBeNull();
  });

  it('separa só o que foi mexido desde o início do grátis', () => {
    markFreePlanUse(OWNER, 1000);
    const drafts = stashFreePlanDrafts(OWNER, [entry('antigo', 500), entry('novo', 1500), entry('editado', 1000)]);
    expect(drafts.map((d) => d.id)).toEqual(['novo', 'editado']);
    expect(JSON.parse(localStorage.getItem(FREE_PLAN_DRAFTS_KEY)).entries).toHaveLength(2);
  });

  it('quem nunca usou o grátis não separa nada', () => {
    expect(stashFreePlanDrafts(OWNER, [entry('a', 1500)])).toEqual([]);
    expect(localStorage.getItem(FREE_PLAN_DRAFTS_KEY)).toBeNull();
  });

  it('cópia pendente em disco vence a biblioteca já substituída (recarregou no meio)', () => {
    markFreePlanUse(OWNER, 1000);
    stashFreePlanDrafts(OWNER, [entry('novo', 1500)]);
    // Depois do recarregamento a lista local já é a da nuvem; os rascunhos vêm do disco.
    expect(stashFreePlanDrafts(OWNER, [entry('da-nuvem', 100)]).map((d) => d.id)).toEqual(['novo']);
  });

  it('cópia pendente de outra conta nunca é usada', () => {
    markFreePlanUse(OWNER, 1000);
    stashFreePlanDrafts(OWNER, [entry('novo', 1500)]);
    expect(stashFreePlanDrafts('email:outra@teste.exemplo', [])).toEqual([]);
  });

  it('projeto ausente na conta volta como estava', () => {
    const draft = entry('novo', 1500);
    const plan = planFreePlanDraftRecovery([draft], [entry('da-nuvem', 100)], { newId: () => 'x', sameContent: () => false });
    expect(plan).toEqual([draft]);
  });

  it('projeto igual ao da conta não duplica', () => {
    const draft = entry('p1', 1500);
    expect(planFreePlanDraftRecovery([draft], [entry('p1', 1500)], { newId: () => 'x', sameContent: () => true })).toEqual([]);
  });

  it('edição do grátis mais nova que a da conta volta como cópia, sem vínculo de equipe', () => {
    const draft = { ...entry('p1', 2000, 'título novo'), doc: { slides: [{ id: 's', title: 'título novo' }], shareCode: 'ABCDEFGH', shareProjectId: 'sp_1', shareRevision: 4 } };
    const [copy] = planFreePlanDraftRecovery([draft], [entry('p1', 900, 'título velho')], { newId: () => 'copia-1', sameContent: () => false });
    expect(copy).toMatchObject({ id: 'copia-1', name: 'p1 (feito no grátis)' });
    expect(copy.doc).toMatchObject({ shareCode: '', shareProjectId: '', shareRevision: 0 });
    expect(copy.doc.slides[0].title).toBe('título novo');
  });

  it('versão da conta mais nova prevalece: nada é sobrescrito nem duplicado', () => {
    const draft = entry('p1', 900);
    expect(planFreePlanDraftRecovery([draft], [entry('p1', 2000)], { newId: () => 'x', sameContent: () => false })).toEqual([]);
  });

  it('concluir a recuperação limpa marcador e cópia', () => {
    markFreePlanUse(OWNER, 1000);
    stashFreePlanDrafts(OWNER, [entry('novo', 1500)]);
    clearFreePlanDrafts();
    expect(localStorage.getItem(FREE_PLAN_DRAFTS_KEY)).toBeNull();
    expect(localStorage.getItem(FREE_PLAN_SINCE_KEY)).toBeNull();
  });
});

describe('voltar ao projeto depois de assinar', () => {
  it('lembra projeto e card, e vale uma vez', () => {
    expect(rememberUpgradeReturn({ owner: OWNER, docId: 'p1', slideIndex: 2, feature: 'image' }, 1000)).toBe(true);
    expect(takeUpgradeReturn(OWNER, 2000)).toEqual({ docId: 'p1', slideIndex: 2, feature: 'image' });
    expect(takeUpgradeReturn(OWNER, 2000)).toBeNull();
  });

  it('não abre projeto de outra conta nem retorno vencido', () => {
    rememberUpgradeReturn({ owner: OWNER, docId: 'p1' }, 1000);
    expect(takeUpgradeReturn('email:outra@teste.exemplo', 2000)).toBeNull();
    rememberUpgradeReturn({ owner: OWNER, docId: 'p1' }, 1000);
    expect(takeUpgradeReturn(OWNER, 1000 + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it('sem projeto aberto não guarda retorno', () => {
    rememberUpgradeReturn({ owner: OWNER, docId: 'p1' }, 1000);
    expect(rememberUpgradeReturn({ owner: OWNER, docId: '' }, 2000)).toBe(false);
    expect(localStorage.getItem(UPGRADE_RETURN_KEY)).toBeNull();
  });
});
