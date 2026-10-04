import {
  exportBrandLogo,
  exportSlideLogo,
  importBrandLogo,
  importSlideLogo,
} from '../utils/slide-logo.js';
/**
 * Biblioteca de projetos (multi-doc): abrir, criar, duplicar, apagar, renomear,
 * exportar/importar JSON. Extraído do App (~125 linhas de handlers).
 * A lista vive em `library` (localStorage) e o doc ativo no histórico de undo.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { mkLibEntry } from '../utils/landing-gate.js';
import { DEFAULT_DOC, DEFAULT_BRAND, ensureDocShape, mkSlide } from '../utils/doc-schema.js';
import { hydrateBrandTextColors } from '../utils/brand-helpers.js';
import { normalizeBrandTone } from '../utils/brand-tone.js';
import { migrateDoc } from '../utils/schema-migration.js';
import { trackEvent } from '../utils/telemetry.js';
import { downloadBlob } from '../utils/export-helpers.js';
import { imagemComoDataUrl, guardarImagemDoSlide } from '../utils/image-store.js';
import { exportProjectReferences, migrateProjectReferences } from '../utils/style-kit-storage.js';
import { uid } from '../utils/doc-schema.js';
import { readInitialShellView } from '../utils/storage.js';
import { SK } from '../utils/storage.js';
import { lsSet } from '../utils/storage.js';
import {
  createLibraryFolder,
  mergeImportedFolders,
  normalizeLibraryEntry,
  removeLibraryFolder,
  renameLibraryFolder,
  setEntryFolder,
  setEntryPublicationDate,
} from '../utils/library-organizer.js';

/**
 * Monta um documento novo sem perder a identidade que veio no seed.
 * Mantida pura e exportada para cobrir a herança de séries por teste unitário.
 */
export function buildSeededLibraryDoc(seedDoc = null, fallbackBrand = DEFAULT_BRAND) {
  const seeded = seedDoc && typeof seedDoc === 'object' ? seedDoc : {};
  const sourceBrand = seeded.brand && typeof seeded.brand === 'object'
    ? seeded.brand
    : fallbackBrand;
  const hydratedBrand = hydrateBrandTextColors({
    ...DEFAULT_BRAND,
    ...(sourceBrand || DEFAULT_BRAND),
  });
  hydratedBrand.brandTone = normalizeBrandTone(hydratedBrand.brandTone);
  hydratedBrand.useBrandVoice = hydratedBrand.useBrandVoice !== false;
  return {
    ...DEFAULT_DOC,
    ...seeded,
    brand: hydratedBrand,
    styleKit: seeded.styleKit
      ? seeded.styleKit
      : { stylePrompt: '', contextMd: '', refImages: [] },
    slides: Array.isArray(seeded.slides) && seeded.slides.length
      ? seeded.slides
      : [mkSlide(1, hydratedBrand)],
  };
}

export function useLibrary({
  library, setLibrary,
  libraryFolders, setLibraryFolders,
  activeDocId, setActiveDocId,
  history, slides, brand, brandRoster, setBrandRoster, activeBrandId, setActiveBrandId,
  setLibraryOpen, toast, setError,
}) {
  // Algumas ações encadeiam "criar pasta" e "aplicar ao projeto" no mesmo
  // clique. O ref é atualizado antes do próximo render para a segunda ação não
  // validar contra a lista antiga capturada pelo callback.
  const foldersLive = useRef(libraryFolders);
  foldersLive.current = libraryFolders;
  // Snapshot imediato: trocar/exportar não depende do debounce de autosave.
  const live = useRef(null);
  live.current = { id: activeDocId || library[0]?.id, doc: history.state };
  const snapshotEntries = useCallback((entries, snapshot = live.current) => entries.map(entry =>
    entry.id === snapshot.id ? { ...entry, doc: snapshot.doc, updatedAt: Date.now() } : entry
  ), []);
  const flushCurrent = useCallback(() => {
    const snapshot = live.current;
    setLibrary(entries => snapshotEntries(entries, snapshot));
  }, [setLibrary, snapshotEntries]);
  // ── BIBLIOTECA: handlers ────────────────────────────────────────────────────
  const renameDoc = useCallback((docId, newName) => {
    setLibrary(prev => prev.map(e => e.id === docId ? { ...e, name: newName, updatedAt: Date.now() } : e));
  }, []);
  const setDocStatus = useCallback((docId, newStatus) => {
    const entry = library.find((item) => item.id === docId);
    if (newStatus === 'scheduled' && !entry?.publicationDate) {
      toast('Escolha uma data no calendário antes de marcar como agendado.', 'info', 4200);
      return;
    }
    setLibrary(prev => prev.map((item) => item.id === docId
      ? { ...item, status: newStatus, updatedAt: Date.now() }
      : item));
  }, [library, setLibrary, toast]);
  const setDocFolder = useCallback((docId, folderId) => {
    setLibrary(prev => setEntryFolder(prev, docId, folderId, foldersLive.current));
  }, [setLibrary]);
  const setDocPublicationDate = useCallback((docId, date) => {
    setLibrary(prev => setEntryPublicationDate(prev, docId, date));
  }, [setLibrary]);
  const createFolder = useCallback((name) => {
    const id = uid();
    try {
      const next = createLibraryFolder(foldersLive.current, name, () => id);
      foldersLive.current = next;
      setLibraryFolders(next);
      return id;
    } catch (error) {
      toast(error.message, 'error');
      return null;
    }
  }, [setLibraryFolders, toast]);
  const renameFolder = useCallback((folderId, name) => {
    try {
      setLibraryFolders(renameLibraryFolder(libraryFolders, folderId, name));
    } catch (error) {
      toast(error.message, 'error');
    }
  }, [libraryFolders, setLibraryFolders, toast]);
  const deleteFolder = useCallback((folderId) => {
    setLibrary(prev => removeLibraryFolder(prev, [], folderId).library);
    setLibraryFolders(prev => removeLibraryFolder([], prev, folderId).folders);
  }, [setLibrary, setLibraryFolders]);
  const [shellView, setShellView] = useState(readInitialShellView);
  useEffect(() => {
    lsSet(SK.shellView, shellView);
  }, [shellView]);

  const openDoc = useCallback((docId) => {
    flushCurrent();
    setActiveDocId(docId);
    setLibraryOpen(false);
    setShellView('project');
  }, []);
  const newDoc = useCallback((seedDoc = null, name = 'Novo carrossel') => {
    // Aplica brand ativo no doc novo
    const activeBrand = brandRoster.find(b => b.id === activeBrandId) || brandRoster[0] || DEFAULT_BRAND;
    // Projeto novo = contexto próprio vazio, salvo quando o seed traz contexto.
    // A identidade do seed tem precedência sobre o perfil global ativo.
    const baseDoc = buildSeededLibraryDoc(seedDoc, activeBrand);
    const entry = mkLibEntry(baseDoc, name);
    const snapshot = live.current;
    setLibrary(prev => [entry, ...snapshotEntries(prev, snapshot)]);
    setActiveDocId(entry.id);
    setLibraryOpen(false);
    setShellView('project');
  }, [brandRoster, activeBrandId]);
  const duplicateDoc = useCallback((docId) => {
    const snapshot = live.current;
    setLibrary(prev => {
      const currentEntries = snapshotEntries(prev, snapshot);
      const src = currentEntries.find(e => e.id === docId);
      if (!src) return prev;
      const copy = mkLibEntry(JSON.parse(JSON.stringify(src.doc)), `${src.name} (cópia)`, { folderId: src.folderId || '' });
      return [copy, ...currentEntries];
    });
  }, []);

  /** Novo projeto com o mesmo contexto (styleKit + brand), slides vazios — Fatia 3 recorrente. */
  const newFromContext = useCallback((docId) => {
    flushCurrent();
    const snapshot = live.current;
    const src = (library.find((e) => e.id === docId)
      || (snapshot.id === docId ? { id: docId, doc: snapshot.doc, name: '', folderId: '' } : null));
    const liveSrc = src?.id === snapshot.id
      ? { ...src, doc: snapshot.doc }
      : src;
    if (!liveSrc?.doc) {
      toast?.('Projeto de origem não encontrado.', 'error');
      return;
    }
    const srcDoc = ensureDocShape(liveSrc.doc);
    const hydratedBrand = hydrateBrandTextColors({ ...(srcDoc.brand || DEFAULT_BRAND) });
    const kit = srcDoc.styleKit || { stylePrompt: '', contextMd: '', refImages: [] };
    const seed = {
      brand: hydratedBrand,
      styleKit: {
        stylePrompt: kit.stylePrompt || '',
        contextMd: kit.contextMd || '',
        refImages: Array.isArray(kit.refImages) ? [...kit.refImages] : [],
        logo: kit.logo || null,
        logoOnGenerate: kit.logoOnGenerate !== false,
      },
      mode: srcDoc.mode || 'editorial',
      creativePreset: srcDoc.creativePreset || 'livre',
      material: { content: '', sources: '', context: '' },
      caption: '',
      slides: [mkSlide(1, hydratedBrand)],
    };
    const baseName = (liveSrc.name || 'Projeto').replace(/\s*\(cópia\)\s*$/i, '').trim() || 'Projeto';
    const entry = mkLibEntry(seed, `${baseName} · novo`, { folderId: liveSrc.folderId || '' });
    setLibrary((prev) => [entry, ...snapshotEntries(prev, snapshot)]);
    setActiveDocId(entry.id);
    setLibraryOpen(false);
    setShellView('project');
    trackEvent('new_from_context');
    toast?.('Novo projeto com o mesmo contexto. Cards em branco.', 'success', 4000);
  }, [library, flushCurrent, setLibrary, setActiveDocId, setLibraryOpen, toast, snapshotEntries]);

  /**
   * Cria vários rascunhos de série a partir de seeds (ideias aprovadas).
   * Abre o primeiro rascunho. Herda styleKit do seed.
   */
  const createSeriesDrafts = useCallback((drafts = []) => {
    if (!Array.isArray(drafts) || !drafts.length) return;
    flushCurrent();
    const snapshot = live.current;
    const activeBrand = brandRoster.find((b) => b.id === activeBrandId) || brandRoster[0] || DEFAULT_BRAND;
    const hydratedBrand = hydrateBrandTextColors({ ...activeBrand });
    const entries = drafts.map((draft) => {
      const rawSeed = draft.seedDoc && typeof draft.seedDoc === 'object'
        ? draft.seedDoc
        : {};
      const seedDoc = buildSeededLibraryDoc({
        ...rawSeed,
        quickPromptDraft: typeof rawSeed.quickPromptDraft === 'string'
          ? rawSeed.quickPromptDraft
          : String(draft.quickPrompt || ''),
      }, hydratedBrand);
      return mkLibEntry(seedDoc, draft.name || 'Rascunho da série', {
        folderId: draft.folderId || '',
        publicationDate: draft.publicationDate || '',
      });
    });
    setLibrary((prev) => [...entries, ...snapshotEntries(prev, snapshot)]);
    setActiveDocId(entries[0].id);
    setLibraryOpen(false);
    setShellView('project');
    trackEvent('series_drafts_created', { count: String(entries.length) });
    return entries;
  }, [brandRoster, activeBrandId, flushCurrent, setLibrary, setActiveDocId, setLibraryOpen, snapshotEntries]);
  const deleteDoc = useCallback((docId) => {
    setLibrary(prev => {
      const next = prev.filter(e => e.id !== docId);
      if (next.length === 0) {
        // Sempre mantém pelo menos 1 doc na biblioteca
        const seed = mkLibEntry(DEFAULT_DOC, 'Carrossel');
        setActiveDocId(seed.id);
        return [seed];
      }
      if (docId === activeDocId) setActiveDocId(next[0].id);
      return next;
    });
  }, [activeDocId]);


  // ── EXPORT / IMPORT de projetos ─────────────────────────────────────────────
  // Exporta UMA entrada da biblioteca como arquivo .json
  /**
   * O backup tem de ser autossuficiente: as imagens vivem no IndexedDB deste
   * navegador, logo exportar só o `bgImageId` daria um ficheiro que abre sem fotos
   * noutra máquina. Aqui voltam a ser embutidas em data URL.
   */
  const comImagensEmbutidas = useCallback(async (entries) => Promise.all(
    (entries || []).map(async (entry) => {
      const slides = entry?.doc?.slides;
      if (!Array.isArray(slides)) return entry;
      const novos = await Promise.all(slides.map(async (sl) => {
        sl = await exportSlideLogo(sl);
        if (!sl?.bgImageId) return sl;
        try {
          const dataUrl = await imagemComoDataUrl(sl.bgImageId);
          return dataUrl ? { ...sl, bgImage: dataUrl } : sl;
        } catch { return sl; }
      }));
      return {
        ...entry,
        doc: {
          ...entry.doc,
          slides: novos,
          brand: await exportBrandLogo(entry.doc.brand),
          styleKit: await exportProjectReferences(entry.doc.styleKit),
        },
      };
    }),
  ), []);

  const exportDoc = useCallback(async (docId) => {
    const entry = snapshotEntries(library).find(e => e.id === docId);
    if (!entry) return;
    let comImagens;
    try { [comImagens] = await comImagensEmbutidas([entry]); }
    catch (err) { toast(err.message, 'error'); return; }
    const folders = comImagens.folderId
      ? libraryFolders.filter(folder => folder.id === comImagens.folderId)
      : [];
    const blob = new Blob([JSON.stringify({ vcVersion: 2, folders, docs: [comImagens] }, null, 2)], { type: 'application/json' });
    const fname = `${(entry.name || 'carrossel').replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'carrossel'}.json`;
    await downloadBlob(blob, fname);
    toast(`Backup "${fname}" salvo. Importe depois pra restaurar.`, 'success', 4500);
    trackEvent('export_json_single', { size_kb: String(Math.round(blob.size / 1024)) });
  }, [library, libraryFolders, toast, comImagensEmbutidas]);

  // Exporta TODA a biblioteca de uma vez
  const exportAllDocs = useCallback(async () => {
    let docs;
    let brands;
    try {
      [docs, brands] = await Promise.all([
        comImagensEmbutidas(snapshotEntries(library)),
        Promise.all((brandRoster || []).map((profile) => exportBrandLogo(profile))),
      ]);
    }
    catch (err) { toast(err.message, 'error'); return; }
    const blob = new Blob([JSON.stringify({
      vcVersion: 3,
      folders: libraryFolders,
      brands,
      activeBrandId,
      docs,
    }, null, 2)], { type: 'application/json' });
    const fname = `viral-carrossel-backup-${new Date().toISOString().slice(0,10)}.json`;
    await downloadBlob(blob, fname);
    toast(`Backup completo "${fname}" — ${library.length} projeto(s). Guarde em local seguro.`, 'success', 5500);
    trackEvent('export_json_full', { project_count: String(library.length), size_kb: String(Math.round(blob.size / 1024)) });
  }, [library, libraryFolders, brandRoster, activeBrandId, toast, comImagensEmbutidas]);

  // Importa um arquivo .json exportado anteriormente (merge na biblioteca)
  const importDocRef = useRef(null);
  const handleImportFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const docs = parsed.docs || (Array.isArray(parsed) ? parsed : null);
        if (!docs?.length) throw new Error('Formato inválido');
        const { folders: importedFolders, remap: folderRemap } = mergeImportedFolders(
          libraryFolders,
          parsed.folders,
          uid,
        );
        const existingBrandIds = new Set((brandRoster || []).map((profile) => profile.id));
        const importedProfiles = [];
        const brandRemap = new Map();
        const importedProfileById = new Map();
        const hasPortableProfiles = Array.isArray(parsed.brands) && parsed.brands.length > 0;
        for (const rawProfile of (hasPortableProfiles ? parsed.brands : [])) {
          if (!rawProfile || typeof rawProfile !== 'object') continue;
          const originalId = String(rawProfile.id || '');
          const nextId = originalId && !existingBrandIds.has(originalId) ? originalId : uid();
          existingBrandIds.add(nextId);
          const restored = hydrateBrandTextColors(await importBrandLogo({
            ...rawProfile,
            id: nextId,
          }));
          restored.brandTone = normalizeBrandTone(restored.brandTone);
          restored.useBrandVoice = restored.useBrandVoice !== false;
          importedProfiles.push(restored);
          importedProfileById.set(nextId, restored);
          if (originalId) brandRemap.set(originalId, nextId);
        }
        // Cada doc importado recebe um novo id pra evitar conflitos
        const newEntries = docs.map(e => normalizeLibraryEntry({
          ...e,
          id: uid(),
          name: e.name || 'Importado',
          folderId: folderRemap.get(e.folderId) || '',
          importedAt: Date.now(),
        }, importedFolders));
        // As imagens vêm embutidas em data URL no backup. Passam para o
        // IndexedDB agora, senão voltariam a pesar no localStorage e seriam
        // apagadas quando a quota enchesse.
        for (const entry of newEntries) {
          if (entry.doc) {
            const portableBrandLogo = entry.doc.brand?.logo;
            const portableKitLogo = entry.doc.styleKit?.logo?.dataUrl;
            const originalBrandId = String(entry.doc.brand?.id || '');
            entry.doc.styleKit = await migrateProjectReferences(entry.doc.styleKit);
            // Em backups v1/v2, vários projetos podiam usar o mesmo id
            // (`default`) com bios e logos diferentes. Só é seguro deduplicar
            // por id quando o backup trouxe a coleção explícita de perfis v3.
            const mappedBrandId = hasPortableProfiles
              ? brandRemap.get(originalBrandId)
              : null;
            const mappedProfile = importedProfileById.get(mappedBrandId);
            if (mappedProfile) {
              entry.doc.brand = hydrateBrandTextColors({
                ...entry.doc.brand,
                id: mappedProfile.id,
                logo: mappedProfile.logo || null,
                logoImageId: mappedProfile.logoImageId || null,
              });
            } else if (
              portableBrandLogo
              && portableBrandLogo === portableKitLogo
              && entry.doc.styleKit?.logo?.imageId
            ) {
              entry.doc.brand = {
                ...entry.doc.brand,
                logo: null,
                logoImageId: entry.doc.styleKit.logo.imageId,
              };
            } else {
              entry.doc.brand = await importBrandLogo(entry.doc.brand);
            }
            // Backups v1/v2 não tinham `brands`. Transformamos cada identidade
            // encontrada nos projetos em perfil reutilizável, remapeando IDs que
            // já existam neste navegador.
            if (!mappedProfile && entry.doc.brand) {
              let profileId = null;
              let profile = null;
              if (!profile) {
                profileId = originalBrandId && !existingBrandIds.has(originalBrandId)
                  ? originalBrandId
                  : uid();
                existingBrandIds.add(profileId);
                profile = hydrateBrandTextColors({ ...entry.doc.brand, id: profileId });
                profile.brandTone = normalizeBrandTone(profile.brandTone);
                profile.useBrandVoice = profile.useBrandVoice !== false;
                importedProfiles.push(profile);
                importedProfileById.set(profileId, profile);
                if (hasPortableProfiles && originalBrandId) brandRemap.set(originalBrandId, profileId);
              }
              entry.doc.brand = hydrateBrandTextColors({
                ...entry.doc.brand,
                id: profileId,
                logo: profile.logo || null,
                logoImageId: profile.logoImageId || null,
              });
            }
          }
          const slides = entry?.doc?.slides;
          if (!Array.isArray(slides)) continue;
          entry.doc = {
            ...entry.doc,
            slides: await Promise.all(slides.map(async (sl) => {
              sl = await importSlideLogo(sl);
              if (typeof sl?.bgImage !== 'string' || !sl.bgImage.startsWith('data:')) return sl;
              try { return { ...sl, ...(await guardarImagemDoSlide(sl.bgImage)) }; } catch { return sl; }
            })),
          };
        }
        setLibrary(prev => [...newEntries, ...prev]);
        setLibraryFolders(importedFolders);
        if (importedProfiles.length) {
          setBrandRoster?.((current) => [...current, ...importedProfiles]);
        }
        // Ativa o primeiro importado
        setActiveDocId(newEntries[0].id);
        const requestedActiveBrand = hasPortableProfiles
          ? brandRemap.get(String(parsed.activeBrandId || ''))
          : null;
        const firstImportedBrand = newEntries[0]?.doc?.brand?.id;
        if (requestedActiveBrand || firstImportedBrand) {
          setActiveBrandId?.(requestedActiveBrand || firstImportedBrand);
        }
        setLibraryOpen(false);
        setShellView('project');
      } catch {
        window.dispatchEvent(new CustomEvent('vc:quota-exceeded', {
          detail: 'Arquivo inválido ou corrompido. Verifique se é um backup exportado pelo Viral Carrossel.',
        }));
      }
    };
    reader.readAsText(file);
  }, [
    libraryFolders, brandRoster,
    setLibrary, setLibraryFolders, setBrandRoster,
    setActiveDocId, setActiveBrandId, setLibraryOpen, setShellView,
  ]);

  return {
    renameDoc, setDocStatus, setDocFolder, setDocPublicationDate,
    createFolder, renameFolder, deleteFolder,
    openDoc, newDoc, duplicateDoc, newFromContext, createSeriesDrafts, deleteDoc,
    exportDoc, exportAllDocs, handleImportFile,
    shellView, setShellView, importDocRef,
  };
}
