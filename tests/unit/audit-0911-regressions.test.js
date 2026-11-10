import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI, setAIRuntimeSettings } from '../../src/utils/ai-client.js';

const source = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function sliceBetween(text, start, end) {
  const startAt = text.indexOf(start);
  const endAt = text.indexOf(end, startAt + start.length);
  expect(startAt, `marcador inicial ausente: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endAt, `marcador final ausente: ${end}`).toBeGreaterThan(startAt);
  return text.slice(startAt, endAt);
}

function compatibleResponse(payload) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAIRuntimeSettings({});
});

describe('regressões da auditoria de 09/11', () => {
  it.each([
    'src/components/HelpModal.jsx',
    'src/components/BrandsModal.jsx',
  ])('%s usa o contrato comum de diálogo', path => {
    const modal = source(path);
    expect(modal).toContain("import { useModalDialog } from '../hooks/useModalDialog.js'");
    expect(modal).toContain('useModalDialog({ open, onClose })');
    expect(modal).toContain('ref={overlayRef}');
    expect(modal).toContain('ref={dialogRef}');
    expect(modal).toContain('onKeyDown={onDialogKeyDown}');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
  });

  it('separa cancelamento e progresso da importação da geração de IA', () => {
    const app = source('ViralCarrossel.jsx');
    const cancelGeneration = sliceBetween(app, 'const cancelGeneration = useCallback', 'const cancelImport = useCallback');
    const cancelImport = sliceBetween(app, 'const cancelImport = useCallback', 'useEffect(() => {\n    setQuickPrompt');

    expect(cancelGeneration).not.toContain('importAbortRef');
    expect(cancelGeneration).not.toContain('setImportProgress');
    expect(cancelImport).toContain('importAbortRef.current.cancelled = true');
    expect(cancelImport).toContain('setImportProgress(null)');
    expect(cancelImport).not.toContain('generationRef.current');
    expect(cancelImport).not.toContain('cancelAllAIGeneration');

    expect(app).toContain("setImportProgress({ phase: 'import'");
    expect(app).toContain('progress={importProgress}');
    expect(app).toContain('onCancel={cancelImport}');
  });

  it('não fecha nem anuncia sucesso quando uma importação ambígua não foi confirmada', () => {
    const app = source('ViralCarrossel.jsx');
    const sidebar = source('src/components/SidebarContent.jsx');
    const handler = sliceBetween(app, 'const handleImportTextApply = useCallback', 'const handleTeamShareLinked');

    expect(handler).toContain('confirmationRequired');
    expect(handler).toContain("toast('Confirme no importador que cada bloco deve virar um card.'");
    expect(handler.indexOf('if (confirmationRequired)')).toBeLessThan(handler.indexOf('setSlides(next)'));
    expect(handler).toContain('return false');
    expect(sidebar).toContain('if (applied !== false) setImportTextOpen(false)');
  });

  it('encaminha a geração lateral ao caminho canônico por projeto e card', () => {
    const sidebar = source('src/components/SidebarContent.jsx');
    const app = source('ViralCarrossel.jsx');

    expect(sidebar).not.toContain("import { generateDALLE }");
    expect(sidebar).toContain('await generateSlideImageAt(activeIdx, null, {');
    expect(sidebar).toContain('...target');
    expect(sidebar).toContain("queryOverride: String(q || '').trim()");
    expect(app).toContain("const queryOverride = String(target?.queryOverride || '').trim()");
    expect(app).toContain('imageQuery: imageState.query');
  });

  it('envia um system prompt em inglês quando o conteúdo exige inglês', async () => {
    setAIRuntimeSettings({ textProvider: 'zai' });
    const fetchMock = vi.fn().mockResolvedValue(compatibleResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAI('Write every title and text in English.', {
      json: true,
      contentLanguage: 'en',
    })).resolves.toEqual({ ok: true });

    const envelope = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system = envelope.payload.messages.find(message => message.role === 'system').content;
    expect(system).toContain('natural English');
    expect(system).toContain('Do not switch to Portuguese');
    expect(system).not.toContain('Use português brasileiro em todo texto visível');
  });

  it('propaga e persiste a identidade canônica da partilha', () => {
    const panel = source('src/components/panels/TeamSharePanel.jsx');
    const app = source('ViralCarrossel.jsx');

    expect(panel).toContain('normalizeShareProjectId');
    expect(panel.match(/projectId: res\.projectId/g)?.length).toBeGreaterThanOrEqual(4);
    expect(panel).toContain('docShareProjectId');
    expect(panel).toContain('docShareCode === activeCode');
    expect(panel).toContain('legacyBindingPending');

    expect(app).toContain("const shareProjectId = meta?.projectId || ''");
    expect(app).toContain("shareProjectId: shareProjectId || d.shareProjectId || ''");
    expect(app).toContain("shareProjectId: payload.projectId || hydrated.shareProjectId || ''");
  });

  it('libera o lock forte antes de validar o metadata da quota', () => {
    const migration = source('db/migrations/011_image_quota_metadata.sql');
    const addConstraintAt = migration.indexOf('ADD CONSTRAINT image_quota_operations_metadata_object');
    const firstCommitAfterConstraint = migration.indexOf('COMMIT;', addConstraintAt);
    const validateAt = migration.indexOf('VALIDATE CONSTRAINT image_quota_operations_metadata_object');

    expect(addConstraintAt).toBeGreaterThanOrEqual(0);
    expect(firstCommitAfterConstraint).toBeGreaterThan(addConstraintAt);
    expect(validateAt).toBeGreaterThan(firstCommitAfterConstraint);
  });
});
