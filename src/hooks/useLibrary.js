/**
 * Biblioteca de projetos (multi-doc): abrir, criar, duplicar, apagar, renomear,
 * exportar/importar JSON. Extraído do App (~125 linhas de handlers).
 * A lista vive em `library` (localStorage) e o doc ativo no histórico de undo.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { mkLibEntry } from '../utils/landing-gate.js';
import { DEFAULT_DOC, DEFAULT_BRAND, ensureDocShape, mkSlide } from '../utils/doc-schema.js';
import { hydrateBrandTextColors } from '../utils/brand-helpers.js';
import { migrateDoc } from '../utils/schema-migration.js';
import { trackEvent } from '../utils/telemetry.js';
import { downloadBlob } from '../utils/export-helpers.js';
import { uid } from '../utils/doc-schema.js';
import { readInitialShellView } from '../utils/storage.js';
import { SK } from '../utils/storage.js';
import { lsSet } from '../utils/storage.js';

export function useLibrary({
  library, setLibrary,
  activeDocId, setActiveDocId,
  history, slides, brand, brandRoster, activeBrandId,
  setLibraryOpen, toast, setError,
}) {
  // ── BIBLIOTECA: handlers ────────────────────────────────────────────────────
  const renameDoc = useCallback((docId, newName) => {
    setLibrary(prev => prev.map(e => e.id === docId ? { ...e, name: newName, updatedAt: Date.now() } : e));
  }, []);
  const setDocStatus = useCallback((docId, newStatus) => {
    setLibrary(prev => prev.map(e => e.id === docId ? { ...e, status: newStatus, updatedAt: Date.now() } : e));
  }, []);
  const [shellView, setShellView] = useState(readInitialShellView);
  useEffect(() => {
    lsSet(SK.shellView, shellView);
  }, [shellView]);

  const openDoc = useCallback((docId) => {
    setActiveDocId(docId);
    setLibraryOpen(false);
    setShellView('project');
  }, []);
  const newDoc = useCallback((seedDoc = null, name = 'Novo carrossel') => {
    // Aplica brand ativo no doc novo
    const activeBrand = brandRoster.find(b => b.id === activeBrandId) || brandRoster[0] || DEFAULT_BRAND;
    const hydratedBrand = hydrateBrandTextColors({ ...activeBrand });
    const seeded = seedDoc || {};
    const baseDoc = {
      ...DEFAULT_DOC,
      ...seeded,
      brand: hydratedBrand,
      slides: Array.isArray(seeded.slides) && seeded.slides.length
        ? seeded.slides
        : [mkSlide(1, hydratedBrand)],
    };
    const entry = mkLibEntry(baseDoc, name);
    setLibrary(prev => [entry, ...prev]);
    setActiveDocId(entry.id);
    setLibraryOpen(false);
    setShellView('project');
  }, [brandRoster, activeBrandId]);
  const duplicateDoc = useCallback((docId) => {
    setLibrary(prev => {
      const src = prev.find(e => e.id === docId);
      if (!src) return prev;
      const copy = mkLibEntry(JSON.parse(JSON.stringify(src.doc)), `${src.name} (cópia)`);
      return [copy, ...prev];
    });
  }, []);
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
  const exportDoc = useCallback(async (docId) => {
    const entry = library.find(e => e.id === docId);
    if (!entry) return;
    const blob = new Blob([JSON.stringify({ vcVersion: 1, docs: [entry] }, null, 2)], { type: 'application/json' });
    const fname = `${(entry.name || 'carrossel').replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'carrossel'}.json`;
    await downloadBlob(blob, fname);
    toast(`Backup "${fname}" salvo. Importe depois pra restaurar.`, 'success', 4500);
    trackEvent('export_json_single', { size_kb: String(Math.round(blob.size / 1024)) });
  }, [library, toast]);

  // Exporta TODA a biblioteca de uma vez
  const exportAllDocs = useCallback(async () => {
    const blob = new Blob([JSON.stringify({ vcVersion: 1, docs: library }, null, 2)], { type: 'application/json' });
    const fname = `viral-carrossel-backup-${new Date().toISOString().slice(0,10)}.json`;
    await downloadBlob(blob, fname);
    toast(`Backup completo "${fname}" — ${library.length} projeto(s). Guarde em local seguro.`, 'success', 5500);
    trackEvent('export_json_full', { project_count: String(library.length), size_kb: String(Math.round(blob.size / 1024)) });
  }, [library, toast]);

  // Importa um arquivo .json exportado anteriormente (merge na biblioteca)
  const importDocRef = useRef(null);
  const handleImportFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const docs = parsed.docs || (Array.isArray(parsed) ? parsed : null);
        if (!docs?.length) throw new Error('Formato inválido');
        // Cada doc importado recebe um novo id pra evitar conflitos
        const newEntries = docs.map(e => ({
          ...e,
          id: uid(),
          name: e.name || 'Importado',
          importedAt: Date.now(),
        }));
        setLibrary(prev => [...newEntries, ...prev]);
        // Ativa o primeiro importado
        setActiveDocId(newEntries[0].id);
        setLibraryOpen(false);
        setShellView('project');
      } catch {
        window.dispatchEvent(new CustomEvent('vc:quota-exceeded', {
          detail: 'Arquivo inválido ou corrompido. Verifique se é um backup exportado pelo Viral Carrossel.',
        }));
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    renameDoc, setDocStatus, openDoc, newDoc, duplicateDoc, deleteDoc,
    exportDoc, exportAllDocs, handleImportFile,
    shellView, setShellView, importDocRef,
  };
}
