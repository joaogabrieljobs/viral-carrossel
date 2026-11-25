// QA 24/11 (conta 3): a cópia local guardava, em cada slide de apresentação,
// o mapa inteiro de tipografia por função (capa, conteúdo, dados...). Num
// deck de 12 slides isso era ~40% do documento e ajudava a estourar a cota do
// navegador. A cópia local passa a guardar cada bloco uma vez por projeto; ao
// abrir, o documento volta byte a byte ao que estava na memória.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';
import { semImagensDeRuntime } from '../../src/utils/image-store.js';
import { projectCacheFingerprint } from '../../src/utils/project-content-snapshot.js';
import { bindAccountDataWriteOwner, lsSet, SK, unlockAccountDataWrites } from '../../src/utils/storage.js';
import { lsGet } from '../../src/utils/telemetry.js';
import {
  compactLibraryForLocalCopy, expandLibraryFromLocalCopy, readLocalLibrary,
} from '../../src/utils/local-library-compact.js';
import { buildUnsentProjectMarker, writeUnsentProjectMarker, readUnsentProjectMarker } from '../../src/utils/unsent-project-marker.js';
import { requeueUnsentProjectsForBoot } from '../../src/hooks/useAccess.js';
import { restoreAccountVault, snapshotAccountVault } from '../../src/utils/account-vault.js';

const FIELD = 'presentationTypographyByComposition';
const bytes = (text) => new TextEncoder().encode(text).byteLength;

function memory() {
  const values = new Map();
  return {
    values,
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
  };
}

/** Apresentação como o app a monta: 12 slides, caminho de relatório, padrão oficial. */
function presentation(id, preset = 'presentation_cinematic', count = 12) {
  const slides = Array.from({ length: count }, (_, index) => ({
    id: `${id}-s${index}`,
    title: index === 0 ? 'Plano de expansão 2027' : `Ponto ${index}: o que muda para a operação`,
    subtitle: 'Uma frase de apoio com o argumento do slide. Outra frase com o dado que sustenta a decisão.',
    bodyAfterImage: index % 3 ? 'Fonte: relatório interno de 2026' : '',
  }));
  const doc = ensureDocShape(applyPresentationVisualPresetToDoc(
    ensureDocShape({ fmt: 'apresentacao', creativePreset: 'apresentacao', presentationPath: 'relatorio_executivo', slides }),
    preset, undefined, { initialize: true },
  ));
  return { id, name: `Deck ${id}`, status: 'draft', createdAt: 1, updatedAt: 2, doc };
}
const carousel = (id) => ({ id, name: 'Carrossel', updatedAt: 3, doc: ensureDocShape({
  fmt: 'carrossel', slides: [{ id: `${id}-s1`, title: 'Capa' }, { id: `${id}-s2`, title: 'Fecho' }],
}) });

let store;
beforeEach(() => {
  store = memory();
  vi.stubGlobal('localStorage', store);
  vi.stubGlobal('sessionStorage', memory());
  bindAccountDataWriteOwner(null, { switchedHere: true });
  unlockAccountDataWrites();
});
afterEach(() => { vi.unstubAllGlobals(); });

/** Grava como o app grava e devolve o texto que ficou no navegador. */
function saveLocalCopy(library) {
  expect(lsSet(SK.library, semImagensDeRuntime(library))).toBe(true);
  return store.getItem(SK.library);
}

describe('QA-2411 conta 3: cópia local menor, sem perder nada ao abrir', () => {
  it('mede: uma apresentação de 12 slides ocupa bem menos na cópia local', () => {
    const library = [presentation('deck')];
    const before = bytes(JSON.stringify(semImagensDeRuntime(library)));
    const after = bytes(saveLocalCopy(library));
    const typography = bytes(JSON.stringify(library[0].doc.slides.map((slide) => slide[FIELD])));
    console.info(`[QA-2411 conta 3] cópia local de 1 apresentação (12 slides): antes ${before} bytes, depois ${after} bytes (${Math.round((1 - after / before) * 100)}% menor); tipografia por função antes: ${typography} bytes`);
    expect(typography / before).toBeGreaterThan(0.3); // o campo era mesmo o maior do documento
    expect(after).toBeLessThan(before * 0.72);
  });

  it('mede: biblioteca com 40 apresentações deixa de passar de 2,5 MB', () => {
    const library = Array.from({ length: 40 }, (_, index) => presentation(`deck-${index}`,
      ['presentation_cinematic', 'presentation_typographic_bold', 'presentation_data'][index % 3]));
    const before = bytes(JSON.stringify(semImagensDeRuntime(library)));
    const after = bytes(saveLocalCopy(library));
    console.info(`[QA-2411 conta 3] 40 apresentações: antes ${before} bytes, depois ${after} bytes`);
    expect(after).toBeLessThan(before * 0.8);
  });

  it('abrir devolve o mesmo documento, byte a byte e com a mesma impressão digital', () => {
    const library = [
      presentation('cine'), presentation('bold', 'presentation_typographic_bold'),
      presentation('data', 'presentation_data'), presentation('um-slide', 'presentation_cinematic', 1), carousel('car'),
    ];
    saveLocalCopy(library);
    const opened = lsGet(SK.library, null);
    expect(JSON.stringify(opened)).toBe(JSON.stringify(semImagensDeRuntime(library)));
    expect(opened).toEqual(JSON.parse(JSON.stringify(library)));
    for (const [index, entry] of library.entries()) {
      expect(projectCacheFingerprint(opened[index])).toBe(projectCacheFingerprint(entry));
      // Depois do caminho normal de abertura (ensureDocShape) também é o mesmo.
      expect(ensureDocShape(opened[index].doc)).toEqual(ensureDocShape(JSON.parse(JSON.stringify(entry.doc))));
    }
  });

  it('conserva ajuste feito à mão, bloco de outro padrão e campo vazio', () => {
    const edited = presentation('editado');
    const slides = edited.doc.slides.map((slide) => ({ ...slide }));
    // Título reajustado depois de editar o texto: bloco diferente do padrão.
    slides[1] = { ...slides[1], [FIELD]: { ...slides[1][FIELD],
      content: { ...slides[1][FIELD].content, title: { ...slides[1][FIELD].content.title, sizePercent: 31.5, fontFamily: '"Minha Fonte", serif' } } } };
    slides[2] = { ...slides[2], [FIELD]: null };
    slides[3] = { ...slides[3], [FIELD]: {} };
    const { [FIELD]: _removed, ...withoutField } = slides[4];
    slides[4] = withoutField;
    slides[5] = { ...slides[5], [FIELD]: { 'social-format': { title: { italic: true, case: 'upper' }, subtitle: { italic: undefined } }, 7: { title: { sizePercent: 10 } } } };
    slides[6] = null;
    const library = [{ ...edited, doc: { ...edited.doc, slides } }, { id: 'sem-doc', name: 'Sem doc' }];
    saveLocalCopy(library);
    const opened = lsGet(SK.library, null);
    expect(JSON.stringify(opened)).toBe(JSON.stringify(library));
    expect(opened[0].doc.slides[1][FIELD].content.title).toMatchObject({ sizePercent: 31.5, fontFamily: '"Minha Fonte", serif' });
    expect(opened[0].doc.slides[2][FIELD]).toBeNull();
    expect(opened[0].doc.slides[3][FIELD]).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(opened[0].doc.slides[4], FIELD)).toBe(false);
  });

  it('o que fica gravado não repete o mapa em cada slide e cada projeto se abre sozinho', () => {
    const library = [presentation('a'), presentation('b', 'presentation_typographic_bold')];
    const raw = saveLocalCopy(library);
    const stored = JSON.parse(raw);
    const fullMaps = JSON.stringify(library).split('"leadingPercent"').length - 1;
    expect(raw.split('"leadingPercent"').length - 1).toBeLessThan(fullMaps / 3);
    // Cofre da conta, fila e recuperação movem projetos um a um: nenhum depende do vizinho.
    for (const [index, entry] of stored.entries()) {
      expect(JSON.stringify(expandLibraryFromLocalCopy([entry])[0])).toBe(JSON.stringify(library[index]));
    }
    // Quem só lê id, nome e fotos (limpeza de imagens, contagem) segue lendo igual.
    expect(stored.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(stored[0].doc.slides.map((slide) => slide.id)).toEqual(library[0].doc.slides.map((slide) => slide.id));
    expect(stored[0].doc.slides[0].title).toBe(library[0].doc.slides[0].title);
  });

  it('lê a cópia no formato antigo sem mudar nada', () => {
    const library = [presentation('antigo'), carousel('car')];
    const old = JSON.stringify(semImagensDeRuntime(library));
    store.setItem(SK.library, old);
    expect(JSON.stringify(lsGet(SK.library, null))).toBe(old);
    expect(JSON.stringify(readLocalLibrary(store))).toBe(old);
    // Ler não regrava: a chave antiga só muda quando o app grava de novo.
    expect(store.getItem(SK.library)).toBe(old);
  });

  it('compactar e abrir são estáveis quando repetidos, e não alteram a biblioteca em memória', () => {
    const library = [presentation('rep')];
    const snapshot = JSON.stringify(library);
    const once = compactLibraryForLocalCopy(library);
    expect(JSON.stringify(library)).toBe(snapshot);
    expect(JSON.stringify(compactLibraryForLocalCopy(once))).toBe(JSON.stringify(once));
    const opened = expandLibraryFromLocalCopy(JSON.parse(JSON.stringify(once)));
    expect(JSON.stringify(expandLibraryFromLocalCopy(opened))).toBe(snapshot);
    expect(expandLibraryFromLocalCopy(library)).toBe(library); // nada a abrir: mesma referência
    // Cada slide recebe o seu bloco: mexer num não mexe no outro.
    opened[0].doc.slides[2][FIELD].data.title.sizePercent = 1;
    expect(opened[0].doc.slides[3][FIELD].data.title.sizePercent).not.toBe(1);
    // Valores que não são lista de projetos passam direto.
    expect(compactLibraryForLocalCopy(null)).toBeNull();
    expect(expandLibraryFromLocalCopy('x')).toBe('x');
  });

  it('documento que chegar compactado por outro caminho é aberto pela normalização do app', () => {
    const library = [presentation('rede')];
    const [stored] = JSON.parse(JSON.stringify(compactLibraryForLocalCopy(library)));
    const shaped = ensureDocShape(stored.doc);
    expect(shaped.slides[0][FIELD]).toEqual(library[0].doc.slides[0][FIELD]);
    expect(shaped).toEqual(ensureDocShape(JSON.parse(JSON.stringify(library[0].doc))));
  });

  it('cofre da conta: sair e entrar de novo devolve os projetos inteiros ao app', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const library = [presentation('cofre'), carousel('car')];
    saveLocalCopy(library);
    expect(await snapshotAccountVault('email:a@x.com')).toBe(true);
    store.removeItem(SK.library);
    const onRestored = vi.fn();
    expect(await restoreAccountVault('email:a@x.com', [], { onRestored })).toBe(true);
    expect(JSON.stringify(onRestored.mock.calls[0][0].library)).toBe(JSON.stringify(library));
    expect(JSON.stringify(lsGet(SK.library, null))).toBe(JSON.stringify(library));
  });

  it('DB-05: a edição ainda não enviada é reconhecida na cópia local depois de recarregar', async () => {
    const owner = 'email:alice@example.test';
    const edited = presentation('janine');
    const library = [edited];
    saveLocalCopy(library);
    writeUnsentProjectMarker(buildUnsentProjectMarker({
      owner, library, baselines: new Map(), versions: new Map([['janine', 4]]), fingerprint: projectCacheFingerprint,
    }), store);
    // Sem IndexedDB neste teste a fila recusa; o que importa é o projeto ter
    // sido reconhecido (falha de fila conserva o marcador) e não ignorado.
    const result = await requeueUnsentProjectsForBoot(owner, { storage: store });
    expect(result).toEqual({ queued: 0, skipped: 0, failed: 1 });
    expect(readUnsentProjectMarker(owner, store).projects.janine.baseVersion).toBe(4);
  });
});

// O aviso vermelho de armazenamento cheio aparecia a cada abertura: cada
// carga da página avisava de novo, mesmo com os projetos guardados na conta.
describe('QA-2411 conta 3: aviso de armazenamento cheio', () => {
  const freshStorageModule = async () => {
    vi.resetModules();
    return import('../../src/utils/storage.js');
  };

  it('conta com assinatura: avisa uma vez por sessão, mesmo recarregando a página', async () => {
    let storage = await freshStorageModule();
    expect(storage.shouldShowQuotaNotice({ free: false })).toBe(true);
    expect(storage.shouldShowQuotaNotice({ free: false })).toBe(false);
    storage = await freshStorageModule(); // recarregar: o módulo zera, a sessão da aba não
    expect(storage.shouldShowQuotaNotice({ free: false })).toBe(false);
  });

  it('depois que a gravação volta a funcionar, uma falha nova avisa de novo', async () => {
    const failed = new Set(['vc_library']);
    const events = [];
    vi.stubGlobal('localStorage', {
      getItem: () => null, removeItem: () => {},
      setItem: (key) => { if (failed.has(key)) throw new DOMException('full', 'QuotaExceededError'); },
    });
    vi.stubGlobal('window', { dispatchEvent: (event) => events.push(event.type) });
    const storage = await freshStorageModule();
    expect(storage.lsSet('vc_library', [{ id: 'p1' }])).toBe(false);
    expect(storage.shouldShowQuotaNotice({ free: false })).toBe(true);
    expect(storage.shouldShowQuotaNotice({ free: false })).toBe(false);
    failed.clear();
    expect(storage.lsSet('vc_library', [{ id: 'p1' }])).toBe(true);
    expect(events).toEqual(['vc:quota-exceeded', 'vc:quota-recovered']);
    expect(storage.shouldShowQuotaNotice({ free: false })).toBe(true);
  });

  it('plano grátis: a cópia deste aparelho é a única, então o aviso nunca é omitido', async () => {
    const storage = await freshStorageModule();
    for (let attempt = 0; attempt < 3; attempt += 1) expect(storage.shouldShowQuotaNotice({ free: true })).toBe(true);
  });

  it('sem armazenamento de sessão, prefere avisar', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => {},
    });
    const storage = await freshStorageModule();
    expect(storage.shouldShowQuotaNotice({ free: false })).toBe(true);
  });

  it('o texto diz o que fazer em cada plano', async () => {
    const storage = await freshStorageModule();
    const paid = storage.quotaExceededMessage({ free: false });
    expect(paid).toContain('Não foi possível salvar a cópia local');
    expect(paid).toContain('Mantenha esta aba aberta');
    expect(paid).toContain('clique em Salvar');
    expect(paid).toContain('O que já está na conta não é afetado');
    expect(paid).not.toMatch(/apague/i); // apagar projeto, com assinatura, apaga da conta
    const free = storage.quotaExceededMessage({ free: true });
    expect(free).toContain('Não foi possível salvar neste aparelho');
    expect(free).toContain('baixe um backup do projeto');
    expect(free).toContain('para liberar espaço');
    expect(free).not.toMatch(/sua conta/);
    for (const text of [paid, free]) expect(text).not.toMatch(/[—–]|localStorage|quota|cache/i);
  });

  it('o app usa a regra e o texto do plano ao receber o aviso', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(app).toMatch(/onQuotaExceeded = \(\) => \{[^}]*shouldShowQuotaNotice\(\{ free \}\)[^}]*quotaExceededMessage\(\{ free \}\)/s);
  });
});
