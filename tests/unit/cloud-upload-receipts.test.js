import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const assetId = `original_${'a'.repeat(64)}`;
const owner = 'email:receipt@example.test';
let session;

beforeEach(() => {
  vi.resetModules();
  const values = new Map();
  session = {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => { throw new Error('Quota cheia'); }),
    setItem: vi.fn(() => { throw new Error('Quota cheia'); }),
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('restaura os recibos da aba depois de reload, isolados por conta e hash', async () => {
  let receipts = await import('../../src/utils/cloud-upload-receipts.js');
  receipts.rememberConfirmedOriginalUpload(owner, assetId);
  expect(receipts.hasConfirmedOriginalUpload(owner, assetId)).toBe(true);
  vi.resetModules();
  receipts = await import('../../src/utils/cloud-upload-receipts.js');
  expect(receipts.hasConfirmedOriginalUpload(owner, assetId)).toBe(true);
  expect(receipts.hasConfirmedOriginalUpload('email:outra@example.test', assetId)).toBe(false);
  expect(receipts.hasConfirmedOriginalUpload(owner, `original_${'b'.repeat(64)}`)).toBe(false);
  expect(localStorage.setItem).not.toHaveBeenCalled();
});

it('continua retomando em memória quando sessionStorage também recusa gravações', async () => {
  session.getItem.mockImplementation(() => { throw new Error('Indisponível'); });
  session.setItem.mockImplementation(() => { throw new Error('Indisponível'); });
  const receipts = await import('../../src/utils/cloud-upload-receipts.js');
  receipts.rememberConfirmedOriginalUpload(owner, assetId);
  expect(receipts.hasConfirmedOriginalUpload(owner, assetId)).toBe(true);
  expect(localStorage.setItem).not.toHaveBeenCalled();
});

it('nunca reutiliza recibos para IDs legados mutáveis ou conta ausente', async () => {
  const receipts = await import('../../src/utils/cloud-upload-receipts.js');
  receipts.rememberConfirmedOriginalUpload(owner, 'photo-1');
  receipts.rememberConfirmedOriginalUpload(null, assetId);
  expect(receipts.hasConfirmedOriginalUpload(owner, 'photo-1')).toBe(false);
  expect(receipts.hasConfirmedOriginalUpload(null, assetId)).toBe(false);
  expect(session.setItem).not.toHaveBeenCalled();
});

it('expira recibos antigos sem guardar dados de imagens', async () => {
  vi.useFakeTimers();
  const receipts = await import('../../src/utils/cloud-upload-receipts.js');
  receipts.rememberConfirmedOriginalUpload(owner, assetId);
  const saved = JSON.parse(session.getItem(receipts.CLOUD_UPLOAD_RECEIPTS_KEY));
  expect(saved.receipts).toEqual([{ owner, assetId, at: Date.now() }]);
  vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
  expect(receipts.hasConfirmedOriginalUpload(owner, assetId)).toBe(false);
});
