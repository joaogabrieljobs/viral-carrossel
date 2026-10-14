import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: { locked: false, owner: 'email:conta@example.test' },
  vault: vi.fn(), push: vi.fn(), clear: vi.fn(), logout: vi.fn(), track: vi.fn(),
}));
vi.mock('../../src/lib/billing.js', () => ({
  fetchAccessSession: vi.fn(), confirmCheckoutSession: vi.fn(), openBillingPortal: vi.fn(), logoutAccess: mocks.logout,
}));
vi.mock('../../src/utils/storage.js', () => ({
  SK: { landingDismissed: 'vc_landing_dismissed' },
  areAccountDataWritesLocked: () => mocks.state.locked,
  lockAccountDataWrites: () => { mocks.state.locked = true; },
  unlockAccountDataWrites: () => { mocks.state.locked = false; },
}));
vi.mock('../../src/utils/clear-account-data.js', () => ({ clearAccountLocalData: mocks.clear }));
vi.mock('../../src/utils/account-vault.js', () => ({ snapshotAccountVaultForOwners: mocks.vault }));
vi.mock('../../src/utils/library-sync.js', () => ({ pushLibraryToCloudBestEffort: mocks.push }));
vi.mock('../../src/utils/account-data-owner.js', () => ({
  ensureAccountDataOwner: vi.fn(), readDataOwner: () => mocks.state.owner,
  normalizeDataOwnerId: (email, customerId) => email ? `email:${email}` : `id:${customerId}`,
  dataOwnerAliases: (email, customerId) => new Set([email && `email:${email}`, customerId && `id:${customerId}`].filter(Boolean)),
}));
vi.mock('../../src/utils/landing-gate.js', () => ({ shouldShowOnboardingLanding: () => false, dismissOnboardingLanding: vi.fn() }));
vi.mock('../../src/utils/project-share.js', () => ({ captureShareInviteFromLocation: vi.fn() }));
vi.mock('../../src/utils/telemetry.js', () => ({ trackEvent: mocks.track }));

import { logoutWithProtectedLibrary } from '../../src/hooks/useAccess.js';

const access = { email: 'conta@example.test', customerId: 'cus_123' };
const snapshot = {
  library: [{ id: 'p1', doc: { slides: [{ id: 's1', title: 'Última edição em memória' }] } }],
  brandRoster: [{ id: 'b1' }], libraryFolders: [], activeDocId: 'p1', activeBrandId: 'b1',
};
const cloudReceipt = { ok: true, cloudSaved: true, assetsFailed: 0, assetsUploaded: 1 };

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

describe('logout protege a edição atual antes de limpar a conta', () => {
  let assign;
  let toast;
  let inFlightRef;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.locked = false;
    mocks.state.owner = 'email:conta@example.test';
    mocks.vault.mockReset().mockReturnValue(false);
    mocks.push.mockReset().mockResolvedValue({ ok: false, cloudSaved: false, pushError: 'offline' });
    mocks.clear.mockReset().mockResolvedValue(undefined);
    mocks.logout.mockReset().mockResolvedValue(undefined);
    assign = vi.fn();
    toast = vi.fn();
    inFlightRef = { current: false };
    vi.stubGlobal('window', { location: { assign } });
  });
  afterEach(() => vi.unstubAllGlobals());

  const prepare = (localPersisted = true, isCurrent = () => true) => ({ snapshot, localPersisted, isCurrent });
  const run = (opts = {}) => logoutWithProtectedLibrary({
    access, toast, inFlightRef, onBeforeLogout: async () => prepare(), ...opts,
  });
  const expectRetained = () => {
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(mocks.state.locked).toBe(false);
    expect(inFlightRef.current).toBe(false);
  };

  it('aguarda flush assíncrono antes do cofre e envia o snapshot antes da limpeza', async () => {
    const pendingFlush = deferred();
    mocks.vault.mockReturnValue(true);
    const pending = run({ onBeforeLogout: () => pendingFlush.promise });
    expect(mocks.vault).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    pendingFlush.resolve(prepare());
    expect(await pending).toBe(true);
    expect(mocks.vault).toHaveBeenCalledWith(['email:conta@example.test', 'id:cus_123']);
    expect(mocks.push).toHaveBeenCalledWith(5_000, { snapshot });
    expect(mocks.vault.mock.invocationCallOrder[0]).toBeLessThan(mocks.push.mock.invocationCallOrder[0]);
    expect(mocks.push.mock.invocationCallOrder[0]).toBeLessThan(mocks.clear.mock.invocationCallOrder[0]);
    expect(mocks.clear).toHaveBeenCalledWith({ timeoutMs: 1_200, wipeMedia: false });
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/');
    expect(toast).not.toHaveBeenCalled();
    expect(mocks.state.locked).toBe(true);
  });

  it('cache recusado não cria cofre stale; nuvem confirmada com todas as imagens permite sair', async () => {
    mocks.vault.mockReturnValue(true);
    mocks.push.mockResolvedValue(cloudReceipt);
    expect(await run({ onBeforeLogout: async () => prepare(false) })).toBe(true);
    expect(mocks.vault).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(5_000, { snapshot });
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('cache e nuvem falhando mantêm a conta, a aba e o estado editável', async () => {
    expect(await run({ onBeforeLogout: async () => prepare(false) })).toBe(false);
    expectRetained();
    expect(mocks.vault).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('últimas alterações ainda não estão protegidas'), 'warning', 6500);
  });

  it.each([
    { ok: true, cloudSaved: true, assetsFailed: 1 },
    { ok: true, cloudSaved: true },
    { ok: true, skipped: true },
    true,
  ])('não confunde recibo incompleto %j com cópia completa na nuvem', async (receipt) => {
    mocks.push.mockResolvedValue(receipt);
    expect(await run()).toBe(false);
    expectRetained();
    expect(mocks.vault).toHaveBeenCalledTimes(1);
  });

  it('cofre confirmado da edição atual permite sair mesmo se imagem remota falhar', async () => {
    mocks.vault.mockReturnValue(true);
    mocks.push.mockResolvedValue({ ...cloudReceipt, assetsFailed: 1 });
    expect(await run()).toBe(true);
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('novas edições durante a rede bloqueiam limpeza mesmo com cofre e nuvem confirmados', async () => {
    mocks.vault.mockReturnValue(true);
    const network = deferred();
    mocks.push.mockReturnValue(network.promise);
    let current = true;
    const pending = run({ onBeforeLogout: async () => prepare(true, () => current) });
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(mocks.state.locked).toBe(true);
    current = false;
    network.resolve(cloudReceipt);
    expect(await pending).toBe(false);
    expectRetained();
    expect(toast.mock.calls[0][0]).toContain('projeto mudou');
  });

  it('ignora clique de logout concorrente sem duplicar flush, push ou limpeza', async () => {
    const network = deferred();
    mocks.push.mockReturnValue(network.promise);
    const onBeforeLogout = vi.fn(async () => prepare(false));
    const pending = run({ onBeforeLogout });
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(await run({ onBeforeLogout })).toBe(false);
    expect(onBeforeLogout).toHaveBeenCalledTimes(1);
    expect(mocks.state.locked).toBe(true);
    network.resolve(cloudReceipt);
    expect(await pending).toBe(true);
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, () => undefined, () => Promise.reject(new Error('quota'))])('callback ausente/legado/falho não autoriza cofre stale', async (onBeforeLogout) => {
    mocks.vault.mockReturnValue(true);
    mocks.push.mockResolvedValue(cloudReceipt);
    expect(await run({ onBeforeLogout })).toBe(false);
    expectRetained();
    expect(mocks.vault).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(toast.mock.calls[0][0]).toContain('últimas alterações');
  });

  it('mudança de conta durante a rede mantém os dados e não encerra a sessão nova', async () => {
    const network = deferred();
    mocks.push.mockReturnValue(network.promise);
    const pending = run();
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    mocks.state.owner = 'email:outra@example.test';
    network.resolve(cloudReceipt);
    expect(await pending).toBe(false);
    expectRetained();
  });

  it('não libera um lock de outra sincronização nem começa a preparar logout', async () => {
    mocks.state.locked = true;
    const onBeforeLogout = vi.fn();
    expect(await run({ onBeforeLogout })).toBe(false);
    expect(onBeforeLogout).not.toHaveBeenCalled();
    expect(mocks.state.locked).toBe(true);
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(toast.mock.calls[0][0]).toContain('Aguarde a sincronização');
  });
});
