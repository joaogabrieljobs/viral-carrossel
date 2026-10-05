import { describe, expect, it } from 'vitest';
import {
  calendarDays,
  createLibraryFolder,
  entriesByPublicationDate,
  mergeImportedFolders,
  normalizeLibraryEntry,
  normalizeLibraryFolders,
  normalizePublicationDate,
  removeLibraryFolder,
  setEntryFolder,
  setEntryPublicationDate,
  buildEditorialQueue,
  localDateKey,
} from '../../src/utils/library-organizer.js';

describe('organização da biblioteca', () => {
  it('migra entradas antigas sem pasta ou calendário', () => {
    expect(normalizeLibraryEntry({ id: 'a', status: 'ready' }, [])).toMatchObject({
      id: 'a', status: 'ready', folderId: '', publicationDate: '',
    });
    expect(normalizeLibraryEntry({ id: 'b', status: 'unknown', folderId: 'missing' }, [])).toMatchObject({
      status: 'draft', folderId: '', publicationDate: '',
    });
  });

  it('normaliza performanceSettings de forma declarativa (FE-006)', () => {
    const withPerf = normalizeLibraryEntry({
      id: 'p',
      status: 'draft',
      performanceSettings: { account: ' @marca ', windowDays: 120, enabled: false },
    }, []);
    expect(withPerf.performanceSettings).toEqual({
      account: '@marca',
      windowDays: 90,
      enabled: false,
    });
    const without = normalizeLibraryEntry({ id: 'q', status: 'draft' }, []);
    expect(without.performanceSettings).toBeUndefined();
  });

  it('valida datas reais e agenda o projeto sem alterar publicados', () => {
    expect(normalizePublicationDate('2026-02-29')).toBe('');
    expect(normalizePublicationDate('2028-02-29')).toBe('2028-02-29');
    const scheduled = setEntryPublicationDate([{ id: 'a', status: 'draft' }], 'a', '2026-10-07');
    expect(scheduled[0]).toMatchObject({ publicationDate: '2026-10-07', status: 'scheduled' });
    const published = setEntryPublicationDate([{ id: 'b', status: 'published' }], 'b', '2026-10-08');
    expect(published[0]).toMatchObject({ publicationDate: '2026-10-08', status: 'published' });
  });

  it('mantém pastas únicas e reaproveita nome na importação', () => {
    const folders = createLibraryFolder([], ' Outubro ', () => 'folder-1');
    expect(folders).toMatchObject([{ id: 'folder-1', name: 'Outubro' }]);
    expect(() => createLibraryFolder(folders, 'outubro')).toThrow('Já existe');
    const merged = mergeImportedFolders(folders, [
      { id: 'old-a', name: 'OUTUBRO' }, { id: 'old-b', name: 'Lançamento' },
    ], () => 'folder-2');
    expect(merged.folders.map((folder) => folder.name)).toEqual(['Outubro', 'Lançamento']);
    expect(merged.remap.get('old-a')).toBe('folder-1');
    expect(merged.remap.get('old-b')).toBe('folder-2');
  });

  it('excluir uma pasta preserva os projetos em Sem pasta', () => {
    const folders = [{ id: 'campanha', name: 'Campanha', createdAt: 1 }];
    const assigned = setEntryFolder([{ id: 'a', folderId: '' }], 'a', 'campanha', folders);
    expect(assigned[0].folderId).toBe('campanha');

    const removed = removeLibraryFolder(assigned, folders, 'campanha');
    expect(removed.folders).toEqual([]);
    expect(removed.library[0]).toMatchObject({ id: 'a', folderId: '' });
  });

  it('tirar a data de um agendado mantém o conteúdo pronto', () => {
    const result = setEntryPublicationDate([
      { id: 'a', status: 'scheduled', publicationDate: '2026-10-09' },
    ], 'a', '');
    expect(result[0]).toMatchObject({ status: 'ready', publicationDate: '' });
  });

  it('gera calendário começando na segunda e agrupa somente o mês', () => {
    const days = calendarDays('2026-10');
    expect(days[0]).toBeNull(); // 01/10/2026 é quinta: seg/ter/qua ficam vazios
    expect(days[3]).toBe('2026-10-01');
    const grouped = entriesByPublicationDate([
      { id: 'a', publicationDate: '2026-10-03' },
      { id: 'b', publicationDate: '2026-11-03' },
    ], '2026-10');
    expect(grouped.get('2026-10-03').map((entry) => entry.id)).toEqual(['a']);
    expect(normalizeLibraryFolders([{ id: 'x', name: ' Pasta ' }, { id: 'x', name: 'Outra' }])).toHaveLength(1);
  });

  it('monta fila editorial: atrasados, próximos 7 dias e sem data', () => {
    expect(localDateKey(new Date(2026, 9, 4))).toBe('2026-10-04');
    const queue = buildEditorialQueue([
      { id: 'late', name: 'B', status: 'scheduled', publicationDate: '2026-10-01' },
      { id: 'soon', name: 'A', status: 'scheduled', publicationDate: '2026-10-07' },
      { id: 'far', name: 'Longe', status: 'scheduled', publicationDate: '2026-10-20' },
      { id: 'none', name: 'Sem', status: 'draft', publicationDate: '' },
      { id: 'done', name: 'Já', status: 'published', publicationDate: '2026-09-01' },
      { id: 'today', name: 'Hoje', status: 'ready', publicationDate: '2026-10-04' },
    ], { today: '2026-10-04' });
    expect(queue.overdue.map((e) => e.id)).toEqual(['late']);
    expect(queue.next7.map((e) => e.id)).toEqual(['today', 'soon']);
    expect(queue.undated.map((e) => e.id)).toEqual(['none']);
    expect(queue.counts.total).toBe(4);
  });
});
