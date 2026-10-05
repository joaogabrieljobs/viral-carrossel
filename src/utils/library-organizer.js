const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const UNFILED_FOLDER_ID = 'unfiled';

export function normalizeFolderName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function normalizeLibraryFolders(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  const names = new Set();
  return value.flatMap((folder) => {
    const id = String(folder?.id || '').trim();
    const name = normalizeFolderName(folder?.name);
    const nameKey = name.toLocaleLowerCase('pt-BR');
    if (!id || !name || ids.has(id) || names.has(nameKey)) return [];
    ids.add(id);
    names.add(nameKey);
    return [{ id, name, createdAt: Number(folder?.createdAt) || Date.now() }];
  });
}

export function normalizePublicationDate(value) {
  const text = String(value || '').trim();
  if (!DATE_RE.test(text)) return '';
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? text
    : '';
}

export function normalizePerformanceSettings(value) {
  if (!value || typeof value !== 'object') return null;
  const windowDaysRaw = Number(value.windowDays);
  return {
    account: String(value.account || '').trim().slice(0, 80),
    windowDays: Number.isFinite(windowDaysRaw)
      ? Math.max(1, Math.min(90, Math.floor(windowDaysRaw)))
      : 7,
    enabled: value.enabled !== false,
  };
}

export function normalizeLibraryEntry(entry, folders = []) {
  const folderIds = new Set(normalizeLibraryFolders(folders).map((folder) => folder.id));
  const folderId = folderIds.has(String(entry?.folderId || '')) ? String(entry.folderId) : '';
  const publicationDate = normalizePublicationDate(entry?.publicationDate);
  const status = ['draft', 'ready', 'scheduled', 'published'].includes(entry?.status)
    ? entry.status
    : 'draft';
  const next = { ...entry, folderId, publicationDate, status };
  // FE-006: campo declarativo — não depende só do spread acidental.
  if (entry && Object.prototype.hasOwnProperty.call(entry, 'performanceSettings')) {
    const normalized = normalizePerformanceSettings(entry.performanceSettings);
    if (normalized) next.performanceSettings = normalized;
    else delete next.performanceSettings;
  }
  return next;
}

export function createLibraryFolder(folders, name, idFactory = () => Math.random().toString(36).slice(2, 10)) {
  const normalized = normalizeLibraryFolders(folders);
  const folderName = normalizeFolderName(name);
  if (!folderName) throw new Error('Dê um nome para a pasta.');
  if (normalized.some((folder) => folder.name.localeCompare(folderName, 'pt-BR', { sensitivity: 'base' }) === 0)) {
    throw new Error('Já existe uma pasta com esse nome.');
  }
  return [...normalized, { id: idFactory(), name: folderName, createdAt: Date.now() }];
}

export function renameLibraryFolder(folders, folderId, name) {
  const normalized = normalizeLibraryFolders(folders);
  const folderName = normalizeFolderName(name);
  if (!folderName) throw new Error('Dê um nome para a pasta.');
  if (normalized.some((folder) => folder.id !== folderId
    && folder.name.localeCompare(folderName, 'pt-BR', { sensitivity: 'base' }) === 0)) {
    throw new Error('Já existe uma pasta com esse nome.');
  }
  return normalized.map((folder) => folder.id === folderId ? { ...folder, name: folderName } : folder);
}

export function removeLibraryFolder(library, folders, folderId) {
  return {
    library: (library || []).map((entry) => entry.folderId === folderId
      ? { ...entry, folderId: '', updatedAt: Date.now() }
      : entry),
    folders: normalizeLibraryFolders(folders).filter((folder) => folder.id !== folderId),
  };
}

export function setEntryFolder(library, docId, folderId, folders) {
  const validIds = new Set(normalizeLibraryFolders(folders).map((folder) => folder.id));
  const nextFolderId = validIds.has(folderId) ? folderId : '';
  return (library || []).map((entry) => entry.id === docId
    ? { ...entry, folderId: nextFolderId, updatedAt: Date.now() }
    : entry);
}

export function setEntryPublicationDate(library, docId, value) {
  const publicationDate = normalizePublicationDate(value);
  return (library || []).map((entry) => {
    if (entry.id !== docId) return entry;
    let status = entry.status;
    if (publicationDate && status !== 'published') status = 'scheduled';
    if (!publicationDate && status === 'scheduled') status = 'ready';
    return { ...entry, publicationDate, status, updatedAt: Date.now() };
  });
}

export function monthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key, amount) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!match) return monthKey();
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + amount, 1);
  return monthKey(date);
}

export function calendarDays(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const first = new Date(year, monthIndex, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const total = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < mondayOffset; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(`${key}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function entriesByPublicationDate(library, key) {
  const grouped = new Map();
  for (const entry of library || []) {
    const date = normalizePublicationDate(entry?.publicationDate);
    if (!date || !date.startsWith(`${key}-`)) continue;
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(entry);
  }
  for (const entries of grouped.values()) {
    entries.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  return grouped;
}

export function mergeImportedFolders(existingFolders, importedFolders, idFactory) {
  let folders = normalizeLibraryFolders(existingFolders);
  const remap = new Map();
  for (const imported of normalizeLibraryFolders(importedFolders)) {
    const sameName = folders.find((folder) => folder.name.localeCompare(imported.name, 'pt-BR', { sensitivity: 'base' }) === 0);
    if (sameName) {
      remap.set(imported.id, sameName.id);
      continue;
    }
    const newId = idFactory();
    folders = [...folders, { ...imported, id: newId }];
    remap.set(imported.id, newId);
  }
  return { folders, remap };
}

/** YYYY-MM-DD no fuso local (para fila e “hoje”). */
export function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function addLocalDays(dateKey, days) {
  const base = normalizePublicationDate(dateKey);
  if (!base) return '';
  const [y, m, d] = base.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return localDateKey(next);
}

/**
 * Fila editorial: atrasados · próximos 7 dias · sem data.
 * Publicados ficam fora da fila ativa (já concluídos fora do Viral).
 */
export function buildEditorialQueue(library = [], { today = localDateKey() } = {}) {
  const todayKey = normalizePublicationDate(today) || localDateKey();
  const horizon = addLocalDays(todayKey, 6);
  const overdue = [];
  const next7 = [];
  const undated = [];

  for (const entry of library || []) {
    if (!entry || entry.status === 'published') continue;
    const date = normalizePublicationDate(entry.publicationDate);
    if (!date) {
      undated.push(entry);
      continue;
    }
    if (date < todayKey) {
      overdue.push(entry);
      continue;
    }
    if (date <= horizon) {
      next7.push(entry);
    }
  }

  const byDateThenName = (a, b) => {
    const da = normalizePublicationDate(a.publicationDate) || '';
    const db = normalizePublicationDate(b.publicationDate) || '';
    if (da !== db) return da.localeCompare(db);
    return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
  };

  overdue.sort(byDateThenName);
  next7.sort(byDateThenName);
  undated.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return {
    today: todayKey,
    horizon,
    overdue,
    next7,
    undated,
    counts: {
      overdue: overdue.length,
      next7: next7.length,
      undated: undated.length,
      total: overdue.length + next7.length + undated.length,
    },
  };
}
