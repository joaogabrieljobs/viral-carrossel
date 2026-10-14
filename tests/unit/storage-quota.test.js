import { it, expect, vi, beforeEach, afterEach } from 'vitest';
let storage;
let lsSet;
beforeEach(async () => {
  vi.resetModules();
  storage = await import('../../src/utils/storage.js');
  lsSet = storage.lsSet;
});
afterEach(() => vi.unstubAllGlobals());
it('quota não remove a única cópia de uma imagem nem o moodboard legado', () => {
  const setItem = vi.fn().mockImplementationOnce(() => { throw new DOMException('full', 'QuotaExceededError'); });
  vi.stubGlobal('localStorage', { setItem });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  const image = 'data:image/png;base64,YQ==';
  lsSet('vc_library', [{ doc: { slides: [{ bgImage: image }, { bgImage: image, bgImageId: 'saved' }], styleKit: { refImages: [{ dataUrl: image }] } } }]);
  const saved = JSON.parse(setItem.mock.calls[1][1])[0].doc;
  expect(saved.slides[0].bgImage).toBe(image);
  expect(saved.slides[1].bgImage).toBeUndefined();
  expect(saved.styleKit.refImages[0].dataUrl).toBe(image);
});

it('quota total informa falha local sem afirmar que os dados chegaram à nuvem', () => {
  const setItem = vi.fn(() => { throw new DOMException('full', 'QuotaExceededError'); });
  const dispatchEvent = vi.fn();
  vi.stubGlobal('localStorage', { setItem });
  vi.stubGlobal('window', { dispatchEvent });
  const image = 'data:image/png;base64,YQ==';
  const value = [{ doc: { slides: [{ bgImage: image, logoImage: image }],
    brand: { logo: image }, styleKit: { logo: { dataUrl: image } } } }];

  expect(lsSet('vc_library', value)).toBe(false);
  expect(JSON.parse(setItem.mock.calls[1][1])).toEqual(value);
  const event = dispatchEvent.mock.calls.find(([item]) => item.type === 'vc:quota-exceeded')?.[0];
  expect(event?.detail).toContain('Não foi possível salvar a cópia local');
  expect(event?.detail).toContain('Mantenha esta aba aberta');
  expect(event?.detail).toContain('clique em Salvar');
  expect(event?.detail).not.toContain('Exporte');
});

function quotaStorage() {
  const failed = new Set();
  const events = [];
  const setItem = vi.fn((key) => {
    if (failed.has(key)) throw new DOMException('full', 'QuotaExceededError');
  });
  vi.stubGlobal('localStorage', { setItem });
  vi.stubGlobal('window', { dispatchEvent: (event) => events.push(event.type) });
  return { failed, events, setItem };
}

it('salvar metadado não encerra o erro da biblioteca; salvar a chave pendente recupera e reabilita avisos', () => {
  const { failed, events } = quotaStorage();
  failed.add('vc_library');
  expect(lsSet('vc_library', [{ id: 'p1' }])).toBe(false);
  expect(lsSet('vc_active_doc_id', 'p1')).toBe(true);
  expect(events).toEqual(['vc:quota-exceeded']);

  failed.clear();
  expect(lsSet('vc_library', [{ id: 'p1' }])).toBe(true);
  expect(events).toEqual(['vc:quota-exceeded', 'vc:quota-recovered']);
  expect(storage.VC_QUOTA_HARD_ALREADY_NOTIFIED).toBe(false);
  expect(storage.VC_QUOTA_SLIM_ALREADY_NOTIFIED).toBe(false);
  lsSet('vc_library', [{ id: 'p1' }]);
  expect(events.filter((name) => name === 'vc:quota-recovered')).toHaveLength(1);

  failed.add('vc_library');
  lsSet('vc_library', [{ id: 'p1' }]);
  expect(events.filter((name) => name === 'vc:quota-exceeded')).toHaveLength(2);
});

it('aguarda todas as chaves que falharam por quota antes de declarar recuperação', () => {
  const { failed, events } = quotaStorage();
  failed.add('vc_library');
  failed.add('vc_brands');
  lsSet('vc_library', []);
  lsSet('vc_brands', []);
  failed.delete('vc_library');
  lsSet('vc_library', []);
  lsSet('vc_active_brand_id', 'b1');
  expect(events).not.toContain('vc:quota-recovered');
  expect(storage.VC_QUOTA_HARD_ALREADY_NOTIFIED).toBe(true);

  failed.delete('vc_brands');
  lsSet('vc_brands', []);
  expect(events.filter((name) => name === 'vc:quota-recovered')).toHaveLength(1);
  expect(storage.VC_QUOTA_HARD_ALREADY_NOTIFIED).toBe(false);
});

it('a compactação que consegue gravar também recupera uma falha anterior da mesma chave', () => {
  const { failed, events, setItem } = quotaStorage();
  failed.add('vc_library');
  const value = [{ doc: { slides: [{ bgImageId: 'saved', bgImage: 'data:image/png;base64,YQ==' }] } }];
  expect(lsSet('vc_library', value)).toBe(false);
  setItem.mockImplementation((key, raw) => {
    if (key === 'vc_library' && JSON.parse(raw)[0].doc.slides[0].bgImage) {
      throw new DOMException('full', 'QuotaExceededError');
    }
  });
  expect(lsSet('vc_library', value)).toBe(true);
  expect(events).toEqual(['vc:quota-exceeded', 'vc:quota-warning', 'vc:quota-recovered']);
  expect(storage.VC_QUOTA_HARD_ALREADY_NOTIFIED).toBe(false);
  expect(storage.VC_QUOTA_SLIM_ALREADY_NOTIFIED).toBe(false);
});

it('o lock de logout não apaga a falha pendente nem anuncia recuperação', () => {
  const { failed, events } = quotaStorage();
  failed.add('vc_library');
  lsSet('vc_library', []);
  failed.clear();
  storage.lockAccountDataWrites();
  expect(lsSet('vc_library', [])).toBe(false);
  expect(events).not.toContain('vc:quota-recovered');
  storage.unlockAccountDataWrites();
  expect(lsSet('vc_library', [])).toBe(true);
  expect(events.filter((name) => name === 'vc:quota-recovered')).toHaveLength(1);
});
