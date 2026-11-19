/**
 * Galeria de modelos (docs/product/publicar-modelo.md).
 *
 * Três abas:
 *  - Galeria: modelos publicados por qualquer conta; aplicar no projeto aberto.
 *  - Meus modelos: renomear, despublicar (apagar).
 *  - Publicar: transforma o projeto aberto em modelo, mostrando antes o que
 *    vai e o que fica de fora. Publicar é sempre público (decisão do João).
 *
 * As prévias desenham o modelo com texto fictício do Moont: nunca o
 * conteúdo de quem publicou.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, EyeOff, Flag, RotateCcw, Trash2, X } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog.js';
import { SlideCard } from './card/SlideCard.jsx';
import { FORMATS } from '../utils/formats.js';
import {
  buildTemplateContent, templatePreviewDoc, TEMPLATE_NAME_MAX, TEMPLATE_DESCRIPTION_MAX, TEMPLATE_AUTHOR_MAX,
} from '../utils/published-template.js';
import {
  listGalleryTemplates, listMyTemplates, publishTemplate, updateTemplate, deleteTemplate, reportTemplate,
  listModerationQueue, moderateTemplate,
} from '../lib/templates-client.js';

const FORMAT_LABEL = { carrossel: 'Feed 4:5', quadrado: 'Quadrado', stories: 'Stories', apresentacao: 'Apresentação' };

/** Capa do modelo desenhada com o card de verdade, em miniatura. */
function TemplatePreview({ content, width = 150, slideIndex = 0 }) {
  const doc = useMemo(() => {
    try { return templatePreviewDoc(content); } catch { return null; }
  }, [content]);
  if (!doc) return <div style={{ width, aspectRatio: '4 / 5', borderRadius: 10, background: 'var(--bg-card)' }} />;
  const f = FORMATS[doc.fmt] || FORMATS.carrossel;
  const slide = doc.slides[Math.min(slideIndex, doc.slides.length - 1)];
  return (
    <div aria-hidden="true" style={{ width, height: f.h * (width / f.w), borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#000' }}>
      <SlideCard slide={slide} fmt={doc.fmt} brand={doc.brand} num={slideIndex + 1} total={doc.slides.length}
        scale={width / f.w} showCanvasChrome={false} />
    </div>
  );
}

function TabButton({ id, current, onSelect, children }) {
  return (
    <button type="button" role="tab" aria-selected={current === id} onClick={() => onSelect(id)}
      style={{ flex: 1, minHeight: 44, border: 'none', borderBottom: `2px solid ${current === id ? 'var(--accent)' : 'transparent'}`,
        background: 'transparent', color: current === id ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
      {label}
      {children}
      {hint && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
    </label>
  );
}

function Gallery({ onApply, toast, slideCount, itemsLabel, onModerator }) {
  const [state, setState] = useState({ loading: true, templates: [], nextCursor: null, error: '' });
  const [confirming, setConfirming] = useState(null);
  const load = useCallback(async (cursor = '') => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await listGalleryTemplates({ cursor });
      if (data.moderator) onModerator?.(true);
      setState((s) => ({ loading: false, error: '', nextCursor: data.nextCursor,
        templates: cursor ? [...s.templates, ...data.templates] : data.templates }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
    }
  }, [onModerator]);
  useEffect(() => { load(); }, [load]);
  const report = async (template) => {
    const reason = window.prompt(`Denunciar «${template.name}»: o que há de errado? (opcional)\nUse para conteúdo ofensivo ou que copia a marca de alguém.`, '');
    if (reason === null) return;
    try {
      await reportTemplate(template.id, reason);
      toast?.('Denúncia enviada. Obrigado por avisar.', 'success', 4000);
    } catch (error) { toast?.(error.message, 'error', 5000); }
  };
  if (state.error && !state.templates.length) {
    return <div role="alert" style={{ padding: 16, display: 'grid', gap: 10 }}><p style={{ margin: 0 }}>{state.error}</p>
      <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} onClick={() => load()}>Tentar novamente</button></div>;
  }
  if (!state.loading && !state.templates.length) {
    return <p style={{ padding: 16, margin: 0, color: 'var(--text-muted)' }}>Ainda não há modelos publicados. Seja a primeira pessoa: publique o visual deste projeto na aba Publicar.</p>;
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <ul aria-label="Modelos publicados" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {state.templates.map((template) => (
          <li key={template.id} aria-label={`Modelo ${template.name}`} style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
            <TemplatePreview content={template.content} width={150} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</strong>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {FORMAT_LABEL[template.format] || template.format}{template.authorName ? ` · por ${template.authorName}` : ''}{template.useCount ? ` · ${template.useCount} uso${template.useCount > 1 ? 's' : ''}` : ''}
              </span>
              {template.description && <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{template.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="vc-btn vc-btn-primary" style={{ flex: 1, minHeight: 44 }} onClick={() => setConfirming(template)}
                aria-label={`Aplicar modelo ${template.name}`}>Aplicar</button>
              {!template.mine && <button type="button" className="vc-btn vc-btn-ghost" style={{ width: 44, minHeight: 44, padding: 0 }} onClick={() => report(template)}
                aria-label={`Denunciar modelo ${template.name}`} title="Denunciar"><Flag size={15} /></button>}
            </div>
          </li>
        ))}
      </ul>
      {state.nextCursor && <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} disabled={state.loading} onClick={() => load(state.nextCursor)}>
        {state.loading ? 'Carregando…' : 'Ver mais modelos'}</button>}
      {state.loading && !state.templates.length && <p role="status" style={{ margin: 0, color: 'var(--text-muted)' }}>Carregando modelos…</p>}
      {confirming && (
        <div role="alertdialog" aria-label="Aplicar modelo" style={{ position: 'sticky', bottom: 0, padding: 14, borderRadius: 14, background: 'var(--bg-sidebar)', border: '1px solid var(--accent)', display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Aplicar «{confirming.name}» nos {slideCount} {itemsLabel} deste projeto? O visual muda; textos, fotos, logo e formato continuam. Dá para desfazer.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} onClick={() => setConfirming(null)}>Cancelar</button>
            <button type="button" className="vc-btn vc-btn-primary" style={{ minHeight: 44 }} onClick={() => { const t = confirming; setConfirming(null); onApply(t); }}>Aplicar modelo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyTemplates({ toast, refreshKey }) {
  const [state, setState] = useState({ loading: true, templates: [], error: '' });
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try { setState({ loading: false, templates: (await listMyTemplates()).templates, error: '' }); }
    catch (error) { setState({ loading: false, templates: [], error: error.message }); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  const save = async () => {
    try {
      await updateTemplate(editing);
      setEditing(null);
      toast?.('Modelo atualizado.', 'success', 3000);
      load();
    } catch (error) { toast?.(error.message, 'error', 5000); }
  };
  const remove = async (template) => {
    if (!window.confirm(`Despublicar «${template.name}»? Ele sai da galeria e é apagado. Projetos que já usaram o modelo não mudam.`)) return;
    try {
      await deleteTemplate(template.id);
      toast?.('Modelo despublicado.', 'success', 3000);
      load();
    } catch (error) { toast?.(error.message, 'error', 5000); }
  };
  if (state.loading) return <p role="status" style={{ margin: 0, color: 'var(--text-muted)' }}>Carregando seus modelos…</p>;
  if (state.error) return <p role="alert" style={{ margin: 0 }}>{state.error}</p>;
  if (!state.templates.length) return <p style={{ margin: 0, color: 'var(--text-muted)' }}>Você ainda não publicou modelos.</p>;
  return (
    <ul aria-label="Meus modelos" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
      {state.templates.map((template) => (
        <li key={template.id} aria-label={`Meu modelo ${template.name}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 14, border: '1px solid var(--border)' }}>
          <TemplatePreview content={template.content} width={88} />
          {editing?.id === template.id ? (
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
              <Field label="Nome"><input className="vc-input" value={editing.name} maxLength={TEMPLATE_NAME_MAX} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Descrição"><input className="vc-input" value={editing.description} maxLength={TEMPLATE_DESCRIPTION_MAX} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <Field label="Seu nome na galeria" hint="Deixe vazio para publicar sem nome."><input className="vc-input" value={editing.authorName} maxLength={TEMPLATE_AUTHOR_MAX} onChange={(e) => setEditing({ ...editing, authorName: e.target.value })} /></Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} onClick={() => setEditing(null)}>Cancelar</button>
                <button type="button" className="vc-btn vc-btn-primary" style={{ minHeight: 44 }} onClick={save}>Salvar</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
              <strong style={{ fontSize: 14 }}>{template.name}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {FORMAT_LABEL[template.format]} · {template.useCount} uso{template.useCount === 1 ? '' : 's'}{template.authorName ? ` · por ${template.authorName}` : ' · sem nome'}
              </span>
              {template.status === 'hidden' && <span role="status" style={{ fontSize: 12, color: 'var(--danger, #d95c5c)' }}>Fora da galeria após denúncias. Em revisão.</span>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }}
                  onClick={() => setEditing({ id: template.id, name: template.name, description: template.description || '', authorName: template.authorName || '' })}>Editar</button>
                <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44, color: 'var(--danger, #d95c5c)' }} onClick={() => remove(template)}
                  aria-label={`Despublicar modelo ${template.name}`}><Trash2 size={14} /> Despublicar</button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const DECISIONS = {
  keep: { label: 'Manter na galeria', done: 'Modelo mantido na galeria. As denúncias foram zeradas.' },
  hide: { label: 'Ocultar', done: 'Modelo fora da galeria. A autora vê como "em revisão".' },
  remove: { label: 'Remover', done: 'Modelo removido. Ele fica em Removidos e pode ser restaurado.' },
  restore: { label: 'Restaurar', done: 'Modelo restaurado na galeria.' },
};
const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Fila de moderação: só aparece para contas moderadoras (o servidor confere). */
function ModerationQueue({ toast }) {
  const [view, setView] = useState('pending');
  const [state, setState] = useState({ loading: true, templates: [], error: '' });
  const [busyId, setBusyId] = useState('');
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try { setState({ loading: false, templates: (await listModerationQueue(view)).templates, error: '' }); }
    catch (error) { setState({ loading: false, templates: [], error: error.message }); }
  }, [view]);
  useEffect(() => { load(); }, [load]);
  const decide = async (template, decision) => {
    if (decision === 'remove' && !window.confirm(`Remover «${template.name}»? Ele sai da galeria e dos modelos da autora, mas fica guardado em Removidos e pode ser restaurado.`)) return;
    setBusyId(template.id);
    try {
      await moderateTemplate(template.id, decision);
      toast?.(DECISIONS[decision].done, 'success', 4000);
      // Ocultar continua na fila (agora "fora da galeria"); as outras decisões tiram o modelo desta lista.
      setState((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== template.id || decision === 'hide') }));
      if (decision === 'hide') load();
    } catch (error) { toast?.(error.message, 'error', 5000); }
    finally { setBusyId(''); }
  };
  const seletor = (
    <div role="group" aria-label="O que mostrar" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      {[['pending', 'Denúncias'], ['removed', 'Removidos']].map(([id, label]) => (
        <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className="vc-btn vc-btn-ghost"
          style={{ minHeight: 40, borderColor: view === id ? 'var(--accent)' : undefined, fontWeight: view === id ? 700 : 500 }}>{label}</button>
      ))}
    </div>
  );
  if (state.loading) return <>{seletor}<p role="status" style={{ margin: 0, color: 'var(--text-muted)' }}>Carregando…</p></>;
  if (state.error) return <>{seletor}<p role="alert" style={{ margin: 0 }}>{state.error}</p></>;
  if (!state.templates.length) return <>{seletor}<p style={{ margin: 0, color: 'var(--text-muted)' }}>{view === 'removed' ? 'Nenhum modelo removido.' : 'Nenhuma denúncia para revisar.'}</p></>;
  return (
    <>{seletor}
    <ul aria-label={view === 'removed' ? 'Modelos removidos' : 'Fila de moderação'} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
      {state.templates.map((template) => (
        <li key={template.id} aria-label={`Moderar ${template.name}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 14,
          border: `1px solid ${template.status === 'hidden' ? 'var(--danger, #d95c5c)' : 'var(--border)'}` }}>
          <TemplatePreview content={template.content} width={96} />
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
            <strong style={{ fontSize: 14 }}>{template.name}</strong>
            {template.description && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{template.description}</span>}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {FORMAT_LABEL[template.format]} · publicado em {dataCurta(template.createdAt)}{template.authorName ? ` · por ${template.authorName}` : ' · sem nome'}
              {` · ${template.authorTemplateCount} modelo${template.authorTemplateCount === 1 ? '' : 's'} da mesma conta`}
              {template.authorStrikes ? ` · ${template.authorStrikes} já removido${template.authorStrikes === 1 ? '' : 's'}/oculto${template.authorStrikes === 1 ? '' : 's'}` : ''}
            </span>
            <span role="status" style={{ fontSize: 12, fontWeight: 600, color: template.status === 'published' ? 'var(--text-primary)' : 'var(--danger, #d95c5c)' }}>
              {template.status === 'removed' ? `Removido em ${dataCurta(template.removedAt)}` : template.status === 'hidden' ? 'Fora da galeria' : 'Na galeria'} · {template.reportCount} denúncia{template.reportCount === 1 ? '' : 's'}
            </span>
            {template.reports.length > 0 && (
              <ul aria-label="Denúncias" style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 2 }}>
                {template.reports.map((r, i) => <li key={i}>{dataCurta(r.createdAt)} — {r.reason || 'sem motivo escrito'}</li>)}
              </ul>
            )}
            {template.status === 'removed' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} disabled={busyId === template.id}
                  onClick={() => decide(template, 'restore')} aria-label={`Restaurar ${template.name}`}><RotateCcw size={14} /> Restaurar</button>
              </div>
            ) : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} disabled={busyId === template.id}
                onClick={() => decide(template, 'keep')} aria-label={`Manter ${template.name} na galeria`}><Check size={14} /> Manter</button>
              {template.status !== 'hidden' && <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44 }} disabled={busyId === template.id}
                onClick={() => decide(template, 'hide')} aria-label={`Ocultar ${template.name}`}><EyeOff size={14} /> Ocultar</button>}
              <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight: 44, color: 'var(--danger, #d95c5c)' }} disabled={busyId === template.id}
                onClick={() => decide(template, 'remove')} aria-label={`Remover ${template.name}`}><Trash2 size={14} /> Remover</button>
            </div>}
          </div>
        </li>
      ))}
    </ul>
    </>
  );
}

function Publish({ doc, defaultName, toast, onPublished }) {
  const content = useMemo(() => buildTemplateContent(doc), [doc]);
  const [name, setName] = useState(defaultName || '');
  const [description, setDescription] = useState('');
  const [showAuthor, setShowAuthor] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await publishTemplate({ name, description, authorName: showAuthor ? authorName : '', content });
      toast?.('Modelo publicado na galeria.', 'success', 4000);
      onPublished?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} aria-label="Prévia do modelo">
        {content.slides.map((_, index) => <TemplatePreview key={index} content={content} width={96} slideIndex={index} />)}
      </div>
      <div style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 12, background: 'var(--accent-surface)', fontSize: 12, lineHeight: 1.5 }}>
        <strong>Vai para a galeria:</strong>
        <span>diagramação dos {content.slides.length} cards (capa, conteúdo e fechamento), fontes, cores, tamanhos e ornamentos.</span>
        <strong>Fica de fora:</strong>
        <span>textos, fotos, logo, nome e @ da marca, legenda, material e referências. A prévia acima usa texto de exemplo do Moont.</span>
        <span style={{ color: 'var(--text-muted)' }}>Fontes enviadas por você não vão junto: quem usar o modelo vê a fonte mais próxima do catálogo.</span>
      </div>
      <Field label="Nome do modelo"><input className="vc-input" required value={name} maxLength={TEMPLATE_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Editorial com foto em cima" /></Field>
      <Field label="Descrição (opcional)"><input className="vc-input" value={description} maxLength={TEMPLATE_DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} placeholder="Para que tipo de post ele funciona" /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 13 }}>
        <input type="checkbox" checked={showAuthor} onChange={(e) => setShowAuthor(e.target.checked)} style={{ width: 20, height: 20 }} />
        Mostrar meu nome na galeria
      </label>
      {showAuthor && <Field label="Nome que aparece" hint="Seu e-mail nunca aparece."><input className="vc-input" value={authorName} maxLength={TEMPLATE_AUTHOR_MAX} onChange={(e) => setAuthorName(e.target.value)} /></Field>}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>O modelo fica visível para todas as contas do Moont. Você pode despublicar quando quiser em Meus modelos.</p>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger, #d95c5c)' }}>{error}</p>}
      <button type="submit" className="vc-btn vc-btn-primary" style={{ minHeight: 48 }} disabled={busy || !name.trim()}>{busy ? 'Publicando…' : 'Publicar na galeria'}</button>
    </form>
  );
}

export default function TemplateGalleryModal({ open, onClose, doc, projectName, onApply, toast, initialTab = 'gallery', itemsLabel = 'cards' }) {
  const [tab, setTab] = useState(initialTab);
  const [refreshKey, setRefreshKey] = useState(0);
  const [moderator, setModerator] = useState(false);
  // Voltar à aba Galeria recarrega a lista (outra conta pode ter publicado ou despublicado).
  const [galleryKey, setGalleryKey] = useState(0);
  const selectTab = (id) => { if (id === 'gallery' && tab !== 'gallery') setGalleryKey((k) => k + 1); setTab(id); };
  const { overlayRef, dialogRef, onDialogKeyDown } = useModalDialog({ open, onClose });
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  if (!open) return null;
  return (
    <div ref={overlayRef} className="modal-overlay" onClick={onClose} role="presentation" style={{ zIndex: 12000 }}>
      <div ref={dialogRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="vc-template-gallery-title"
        onKeyDown={onDialogKeyDown} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(760px, calc(100vw - 16px))', maxHeight: 'min(900px, calc(100dvh - 16px))', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px 0' }}>
          <h2 id="vc-template-gallery-title" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Galeria de modelos</h2>
          <button type="button" className="vc-icon-btn" onClick={onClose} aria-label="Fechar" style={{ width: 44, height: 44 }}><X size={17} /></button>
        </header>
        <div role="tablist" aria-label="Galeria de modelos" style={{ display: 'flex', padding: '0 8px', borderBottom: '1px solid var(--border)' }}>
          <TabButton id="gallery" current={tab} onSelect={selectTab}>Galeria</TabButton>
          <TabButton id="mine" current={tab} onSelect={selectTab}>Meus modelos</TabButton>
          <TabButton id="publish" current={tab} onSelect={selectTab}>Publicar</TabButton>
          {moderator && <TabButton id="moderation" current={tab} onSelect={selectTab}>Moderação</TabButton>}
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {/* A galeria sempre carrega uma vez: é ela que descobre se a conta modera. */}
          <div hidden={tab !== 'gallery'}>
            <Gallery key={galleryKey} onApply={onApply} toast={toast} slideCount={doc?.slides?.length || 0} itemsLabel={itemsLabel} onModerator={setModerator} />
          </div>
          {tab === 'moderation' && moderator && <ModerationQueue toast={toast} />}
          {tab === 'mine' && <MyTemplates toast={toast} refreshKey={refreshKey} />}
          {tab === 'publish' && <Publish doc={doc} defaultName={projectName} toast={toast} onPublished={() => { setRefreshKey((n) => n + 1); setTab('mine'); }} />}
        </div>
      </div>
    </div>
  );
}
