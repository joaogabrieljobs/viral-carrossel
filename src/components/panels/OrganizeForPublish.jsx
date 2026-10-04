import React, { useState } from 'react';
import { FolderPlus, CalendarDays } from 'lucide-react';
import { trackEvent } from '../../utils/telemetry.js';

/**
 * Ação curta pós-geração (Criar rápido): pasta + data editorial local.
 * Spec: docs/product/organizacao-calendario.md — «Organizar para publicar».
 * Não publica no Instagram.
 */
export function OrganizeForPublish({
  projectId = null,
  folderId = '',
  publicationDate = '',
  folders = [],
  onSetFolder = null,
  onSetPublicationDate = null,
  onCreateFolder = null,
  toast = null,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  if (!projectId || (!onSetFolder && !onSetPublicationDate)) return null;

  const folderName = folders.find((f) => f.id === folderId)?.name || '';
  const hasOrg = !!(folderId || publicationDate);
  const summary = [
    folderName || (folderId ? 'Pasta' : 'Sem pasta'),
    publicationDate || 'Sem data',
  ].join(' · ');

  const createFolder = async () => {
    const name = String(newFolderName || '').trim();
    if (!name || !onCreateFolder) return;
    setCreating(true);
    try {
      const created = onCreateFolder(name);
      const id = created?.id || created;
      if (id && typeof id === 'string') {
        onSetFolder?.(projectId, id);
        setNewFolderName('');
        trackEvent('organize_create_folder');
        toast?.(`Pasta «${name}» criada e aplicada.`, 'success', 3200);
      }
    } catch (e) {
      toast?.(e.message || 'Não foi possível criar a pasta.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? 8 : 10,
      padding: compact ? '10px 12px' : '12px 14px',
      borderRadius: 12,
      border: '1px solid var(--glass-border-strong)',
      background: 'var(--bg-card)',
    }}>
      <button
        type="button"
        className="vc-btn"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) trackEvent('organize_open');
        }}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', minHeight: 40, padding: 0, border: 'none', background: 'transparent',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <CalendarDays size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          <span style={{ minWidth: 0 }}>
            <span style={{
              display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
              letterSpacing: '-0.011em',
            }}>
              Organizar para publicar
            </span>
            <span style={{
              display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {hasOrg ? summary : 'Pasta e data locais — a publicação continua no Instagram'}
            </span>
          </span>
        </span>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {open ? 'Fechar' : (hasOrg ? 'Editar' : 'Abrir')}
        </span>
      </button>

      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Pasta</span>
            <select
              className="vc-input"
              value={folderId || ''}
              onChange={(e) => {
                onSetFolder?.(projectId, e.target.value);
                trackEvent('organize_set_folder');
              }}
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
                placeholder="Nova pasta (cliente ou campanha)"
                aria-label="Nome da nova pasta"
                style={{ flex: 1, minHeight: 40 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createFolder();
                  }
                }}
              />
              <button
                type="button"
                className="vc-btn"
                disabled={creating || !String(newFolderName || '').trim()}
                onClick={createFolder}
                title="Criar pasta e aplicar a este projeto"
                style={{
                  minHeight: 40, minWidth: 40, padding: '0 12px', borderRadius: 10,
                  border: '1px solid var(--hairline)', background: 'var(--bg-pearl)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FolderPlus size={14} />
              </button>
            </div>
          ) : null}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Data editorial (local)</span>
            <input
              type="date"
              className="vc-input"
              value={publicationDate || ''}
              onChange={(e) => {
                onSetPublicationDate?.(projectId, e.target.value);
                trackEvent('organize_set_date');
              }}
              style={{ minHeight: 40, colorScheme: 'dark' }}
              aria-label="Data editorial do projeto"
            />
          </label>

          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            A data é só planeamento neste browser. Não agenda nem publica no Instagram.
            {publicationDate ? ' Com data, o estado passa a Agendado.' : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
