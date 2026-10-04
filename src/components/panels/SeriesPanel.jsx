import React, { useState, useEffect } from 'react';
import { Layers, Loader2, X, Check } from 'lucide-react';
import { callAI } from '../../utils/ai-client.js';
import { isGenerationCancelled } from '../../utils/generation-control.js';
import { OBJECTIVE_TEMPLATES } from '../../utils/objective-templates.js';
import {
  buildSeriesIdeasPrompt,
  normalizeSeriesIdeas,
  buildSeriesDraftSeed,
} from '../../utils/series-drafts.js';
import { trackEvent } from '../../utils/telemetry.js';

/**
 * Gerar série (Fatia 3): ideias → seleção → rascunhos.
 * Não gera carrosséis completos — cria projetos com contexto herdado.
 */
export function SeriesPanel({
  open,
  onClose,
  brand = {},
  styleKit = null,
  folderId: initialFolderId = '',
  folders = [],
  onCreateFolder = null,
  openaiKey = '',
  onCreateDrafts,
  toast,
}) {
  const [objectiveId, setObjectiveId] = useState('educar');
  const [ideaCount, setIdeaCount] = useState(5);
  const [variety, setVariety] = useState('media');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [err, setErr] = useState('');
  const [folderId, setFolderId] = useState(initialFolderId || '');
  const [publicationDate, setPublicationDate] = useState('');
  const [newFolderName, setNewFolderName] = useState('');

  // Sync pasta do projeto aberto quando o modal abre
  useEffect(() => {
    if (open) setFolderId(initialFolderId || '');
  }, [open, initialFolderId]);

  if (!open) return null;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runIdeas = async () => {
    setBusy(true);
    setErr('');
    setIdeas([]);
    setSelected(new Set());
    try {
      const prompt = buildSeriesIdeasPrompt({
        brandBio: brand?.bio || '',
        contextMd: styleKit?.contextMd || '',
        objectiveId,
        ideaCount,
        variety,
      });
      const raw = await callAI(prompt, { json: true, openaiKey, maxTokens: 2048 });
      const list = normalizeSeriesIdeas(raw, { max: ideaCount });
      if (!list.length) throw new Error('A IA não devolveu ideias utilizáveis. Tente de novo.');
      setIdeas(list);
      setSelected(new Set(list.map((i) => i.id)));
      trackEvent('series_ideas', { count: String(list.length), objective: objectiveId });
    } catch (e) {
      if (isGenerationCancelled(e)) return;
      setErr(e.message || 'Falha ao gerar ideias.');
    } finally {
      setBusy(false);
    }
  };

  const createDrafts = async () => {
    const picked = ideas.filter((i) => selected.has(i.id));
    if (!picked.length) {
      toast?.('Selecione pelo menos uma ideia.', 'info');
      return;
    }
    setCreating(true);
    try {
      const drafts = picked.map((idea) => buildSeriesDraftSeed({
        idea,
        styleKit,
        objectiveId,
        folderId,
        publicationDate,
      }));
      await onCreateDrafts?.(drafts);
      trackEvent('series_drafts', {
        count: String(drafts.length),
        objective: objectiveId,
        with_folder: folderId ? '1' : '0',
        with_date: publicationDate ? '1' : '0',
      });
      const where = [
        folderId ? 'na mesma pasta' : null,
        publicationDate ? 'com data editorial' : null,
      ].filter(Boolean).join(' e ');
      toast?.(
        `${drafts.length} rascunho${drafts.length === 1 ? '' : 's'} criado${drafts.length === 1 ? '' : 's'}${where ? ` ${where}` : ''} — contexto herdado.`,
        'success',
        5500,
      );
      onClose?.();
    } catch (e) {
      toast?.(e.message || 'Não foi possível criar os rascunhos.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Gerar série"
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-sidebar)', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layers size={14} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.022em' }}>
                Gerar série
              </div>
              <div className="vc-eyebrow">Ideias → seleção → rascunhos</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Gera ideias para aprovar. Só depois cria projetos rascunho com o brief, tom e logo deste projeto — sem gerar cinco carrosséis de uma vez.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {OBJECTIVE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="vc-btn"
                onClick={() => setObjectiveId(t.id)}
                style={{
                  minHeight: 36, padding: '0 12px', borderRadius: 9999,
                  border: `1px solid ${objectiveId === t.id ? 'var(--accent)' : 'var(--hairline)'}`,
                  background: objectiveId === t.id ? 'var(--accent-surface)' : 'var(--bg-card)',
                  fontWeight: objectiveId === t.id ? 600 : 480, fontSize: 12,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Quantidade</span>
              <select
                value={ideaCount}
                onChange={(e) => setIdeaCount(Number(e.target.value))}
                className="vc-input"
                style={{ minHeight: 40, minWidth: 100 }}
              >
                {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} ideias</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Variedade</span>
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="vc-input"
                style={{ minHeight: 40, minWidth: 120 }}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </label>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: '10px 12px', borderRadius: 12,
            border: '1px solid var(--hairline)', background: 'var(--bg-card)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Destino dos rascunhos
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Pasta</span>
              <select
                className="vc-input"
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value)}
                style={{ minHeight: 40 }}
              >
                <option value="">Sem pasta</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            {onCreateFolder ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="vc-input"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nova pasta para a série"
                  style={{ flex: 1, minHeight: 40 }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const name = String(newFolderName || '').trim();
                    if (!name) return;
                    const id = onCreateFolder(name);
                    if (id) {
                      setFolderId(id);
                      setNewFolderName('');
                      toast?.(`Pasta «${name}» criada.`, 'success', 2800);
                    }
                  }}
                />
                <button
                  type="button"
                  className="vc-btn"
                  disabled={!String(newFolderName || '').trim()}
                  onClick={() => {
                    const name = String(newFolderName || '').trim();
                    if (!name) return;
                    const id = onCreateFolder(name);
                    if (id) {
                      setFolderId(id);
                      setNewFolderName('');
                      toast?.(`Pasta «${name}» criada.`, 'success', 2800);
                    }
                  }}
                  style={{
                    minHeight: 40, padding: '0 12px', borderRadius: 10,
                    border: '1px solid var(--hairline)', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Criar
                </button>
              </div>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Data editorial (opcional, todos os rascunhos)</span>
              <input
                type="date"
                className="vc-input"
                value={publicationDate}
                onChange={(e) => setPublicationDate(e.target.value)}
                style={{ minHeight: 40, colorScheme: 'dark' }}
              />
            </label>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              A data é planeamento local — não publica no Instagram. Sem data, os rascunhos ficam em Rascunho.
            </p>
          </div>

          <button
            type="button"
            className="vc-btn"
            disabled={busy}
            onClick={runIdeas}
            style={{
              minHeight: 48, borderRadius: 9999, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {busy ? <><Loader2 size={14} className="spin" /> A gerar ideias…</> : 'Gerar ideias'}
          </button>

          {err ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--danger, #c0392b)' }}>{err}</p>
          ) : null}

          {ideas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                Selecione as ideias para criar rascunhos ({selected.size}/{ideas.length})
              </div>
              {ideas.map((idea) => {
                const on = selected.has(idea.id);
                return (
                  <button
                    key={idea.id}
                    type="button"
                    className="vc-btn"
                    onClick={() => toggle(idea.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: 12, borderRadius: 12, textAlign: 'left',
                      border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                      background: on ? 'var(--accent-surface)' : 'var(--bg-card)',
                    }}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
                      border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                      background: on ? 'var(--accent)' : 'transparent',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on ? <Check size={12} /> : null}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {idea.title}
                      </span>
                      {idea.angle ? (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                          {idea.angle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className="vc-btn"
                disabled={creating || selected.size === 0}
                onClick={createDrafts}
                style={{
                  minHeight: 48, borderRadius: 9999, border: 'none', marginTop: 4,
                  background: 'var(--text-primary)', color: '#fff', fontWeight: 600, fontSize: 13,
                  opacity: creating || selected.size === 0 ? 0.5 : 1,
                }}
              >
                {creating
                  ? 'A criar rascunhos…'
                  : `Criar ${selected.size} rascunho${selected.size === 1 ? '' : 's'}`}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
