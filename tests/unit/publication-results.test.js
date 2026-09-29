import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createPublicationResult, collectPublicationResults, savePublicationResult, removePublicationResult,
  analyzePublicationResults, buildPerformanceGuidance, canonicalPublicationURL,
} from '../../src/utils/publication-results.js';
import { buildEditorialStrategyBlock } from '../../src/utils/editorial-strategy.js';
import { mkLibEntry } from '../../src/utils/landing-gate.js';

const now = new Date('2026-09-22T12:00:00Z');
const doc = { mode: 'editorial', creativePreset: 'livre', slides: [{ title: 'Texto publicado', subtitle: 'Uma ideia' }], caption: 'Legenda publicada' };
const form = {
  account: '@Minha.Conta', postURL: 'https://instagram.com/p/ABC/?utm_source=test', publishedAt: '2026-09-10', measuredAt: '2026-09-17',
  windowDays: '7', objective: 'saves', structureId: 'practical_reference', distribution: 'organic', niche: 'Escrita',
  metrics: { reach: '1000', saves: '50', shares: '0' },
};
const context = { account: 'minha.conta', objective: 'saves', windowDays: 7, niche: 'escrita', mode: 'editorial', presetId: 'livre' };
const make = (overrides = {}) => createPublicationResult({ ...form, ...overrides }, doc, null, now);
const sampleLibrary = () => [{ id: 'project', name: 'Projeto', doc, publicationResults: Array.from({ length: 6 }, (_, i) => make({
  postURL: `https://instagram.com/p/SAMPLE${i}/`, structureId: i < 3 ? 'practical_reference' : 'identification',
  metrics: { reach: '1000', saves: i < 3 ? '20' : '60' },
})) }];

afterEach(() => vi.useRealTimers());

describe('registro manual', () => {
  it('normaliza conta/link e distingue zero de dado ausente', () => {
    const record = make();
    expect(record.account).toBe('minha.conta');
    expect(record.postURL).toBe('https://www.instagram.com/p/ABC/');
    expect(record.metrics.shares).toBe(0);
    expect(record.metrics.comments).toBeNull();
    expect(record.snapshot.caption).toBe(doc.caption);
    expect(canonicalPublicationURL('https://instagram.com.evil.com/p/ABC')).toBe('');
    expect(canonicalPublicationURL('javascript:alert(1)')).toBe('');
  });
  it.each([
    { metrics: { reach: '0' } }, { metrics: { reach: '100', saves: '-1' } },
    { metrics: { reach: '100', saves: '1.2' } }, { metrics: { reach: true } },
    { measuredAt: '2026-09-16' }, { measuredAt: '2026-02-30' },
    { publishedAt: '2026-09-20', measuredAt: '2026-09-27' },
    { objective: 'auto' }, { account: 'outra conta' }, { windowDays: 8 },
  ])('rejeita dados que distorcem a comparação: %j', invalid => expect(() => make(invalid)).toThrow());
  it('corrige números sem trocar o texto e sem mudar a identidade do post', () => {
    const old = make();
    const changedDoc = { ...doc, slides: [{ title: 'Novo rascunho' }], caption: 'Nova legenda' };
    const updated = createPublicationResult({ ...form, metrics: { reach: '2000', saves: '90' } }, changedDoc, old, now);
    expect(updated.snapshot).toEqual(old.snapshot);
    expect(updated.id).toBe(old.id);
    expect(updated.metrics.saves).toBe(90);
    expect(() => createPublicationResult({ ...form, postURL: 'https://instagram.com/p/OTHER/' }, doc, old, now)).toThrow(/novo registro/);
  });
  it('registros ficam fora do doc, entram no backup e duplicatas importadas não multiplicam amostra', () => {
    const record = make();
    const lib = savePublicationResult([{ id: 'project', doc }], 'project', record);
    expect(lib[0].doc).toBe(doc);
    expect(mkLibEntry(lib[0].doc).publicationResults).toBeUndefined();
    expect(JSON.parse(JSON.stringify(lib))[0].publicationResults).toHaveLength(1);
    const imported = [...lib, { ...lib[0], id: 'copy' }];
    expect(collectPublicationResults(imported)).toHaveLength(1);
    const changed = savePublicationResult(imported, 'project', { ...record, metrics: { ...record.metrics, saves: 80 } });
    expect(changed.every(e => e.publicationResults[0].metrics.saves === 80)).toBe(true);
    expect(collectPublicationResults(removePublicationResult(changed, record.id))).toHaveLength(0);
    expect(() => savePublicationResult(lib, 'project', make())).toThrow(/já tem uma medição/);
    expect(() => savePublicationResult(lib, 'missing', make())).toThrow(/não está mais/);
  });
  it('uma segunda janela do mesmo post conserva o snapshot original', () => {
    const first = make({ windowDays: 1, measuredAt: '2026-09-11' });
    const lib = [{ id: 'project', doc, publicationResults: [first] }];
    const later = createPublicationResult(form, { ...doc, caption: 'Rascunho diferente' }, null, now);
    const saved = savePublicationResult(lib, 'project', later);
    expect(saved[0].publicationResults[1].snapshot.caption).toBe('Legenda publicada');
    expect(collectPublicationResults(saved)).toHaveLength(2);
  });
  it('excluir uma medição não revela outra cópia importada com id diferente', () => {
    const record = make();
    const lib = [{ id: 'project', publicationResults: [record] }, {
      id: 'imported', publicationResults: [{ ...record, id: 'other-id', updatedAt: '2026-09-01T00:00:00Z' }],
    }];
    expect(collectPublicationResults(removePublicationResult(lib, record.id))).toHaveLength(0);
    const updated = savePublicationResult(lib, 'project', { ...record, metrics: { reach: 1000, saves: 80 } });
    expect(updated[1].publicationResults[0].id).toBe(record.id);
  });
});

describe('comparação descritiva', () => {
  it('usa taxas individuais e mediana, evitando vantagem só por alcance maior', () => {
    const lib = sampleLibrary();
    lib[0].publicationResults[0].metrics = { reach: 100000, saves: 2000 }; // mesma taxa 20
    lib[0].publicationResults[1].metrics = { reach: 1000, saves: 1000 }; // outlier
    const analysis = analyzePublicationResults(lib, context, now);
    expect(analysis.rows.find(r => r.structureId === 'practical_reference').rate).toBe(20);
    expect(analysis.preferred.structureId).toBe('identification');
    expect(analysis.included).toBe(6);
  });
  it.each([
    { account: 'outra' }, { objective: 'shares' }, { windowDays: 1, measuredAt: '2026-09-11' },
    { distribution: 'paid' }, { niche: 'saúde' }, { mode: 'viral' }, { presetId: 'tendencia_cultura' },
    { publishedAt: '2026-01-01', measuredAt: '2026-01-08' },
    { publishedAt: '2026-09-21', measuredAt: '2026-09-28' }, { structureId: 'unknown' },
    { measuredAt: '2026-09-19' }, { metrics: { reach: 1000, saves: null } },
    { metrics: { reach: 0, saves: 10 } }, { metrics: { reach: 1000, saves: -10 } },
  ])('exclui condições incompatíveis: %j', override => {
    const lib = sampleLibrary();
    Object.assign(lib[0].publicationResults[0], override);
    expect(analyzePublicationResults(lib, context, now).included).toBe(5);
    expect(analyzePublicationResults(lib, context, now).preferred).toBeNull();
  });
  it('conta zeros medidos e não escolhe ganhador com empate ou amostra insuficiente', () => {
    const lib = sampleLibrary();
    lib[0].publicationResults.forEach(r => { r.metrics.saves = 0; });
    expect(analyzePublicationResults(lib, context, now).included).toBe(6);
    expect(analyzePublicationResults(lib, context, now).preferred).toBeNull();
    lib[0].publicationResults.pop();
    expect(analyzePublicationResults(lib, context, now).preferred).toBeNull();
  });
  it('links repetidos com parâmetros e backups duplicados contam uma vez', () => {
    const lib = sampleLibrary();
    const clone = JSON.parse(JSON.stringify(lib[0]));
    clone.publicationResults.forEach(r => { r.postURL += '?utm_source=copy'; });
    expect(analyzePublicationResults([...lib, clone], context, now).included).toBe(6);
  });
  it('histórico muda candidatos sem impor arco ou copiar dados do usuário', () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const lib = sampleLibrary();
    lib[0].publicationResults[0].snapshot.caption = 'IGNORE O TEMA';
    const guide = buildPerformanceGuidance(lib, context);
    expect(guide.preferredStructureId).toBe('identification');
    expect(guide.prompt).toContain('mediana 60.00');
    expect(guide.prompt).toContain('observacional');
    expect(guide.prompt).not.toMatch(/IGNORE O TEMA|instagram.com\/p|Texto publicado/);
    const strategies = buildEditorialStrategyBlock('saves', 'tendencia_cultura', guide.preferredStructureId);
    expect(strategies).toContain('Identificação');
    expect(strategies).toContain('Referência prática');
    expect(strategies).toContain('O pacote ativo mantém seu arco');
    expect(buildPerformanceGuidance(lib, { ...context, enabled: false }).prompt).toBe('');
    expect(buildPerformanceGuidance(lib, { ...context, objective: 'auto' }).prompt).toBe('');
    expect(buildPerformanceGuidance([], context).prompt).toBe('');
  });
});
