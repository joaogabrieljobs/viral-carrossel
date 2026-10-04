import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Folder,
  FolderPlus,
  Layers,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { resolveSlideBrandBg } from '../utils/brand-helpers.js';
import { STATUS_DEFS, STATUS_BY_ID, fmtDate, isDefault } from '../utils/library-helpers.js';
import {
  UNFILED_FOLDER_ID,
  calendarDays,
  entriesByPublicationDate,
  monthKey,
  shiftMonth,
  localDateKey,
  buildEditorialQueue,
} from '../utils/library-organizer.js';

const controlStyle = {
  minHeight: 36,
  padding: '0 10px',
  borderRadius: 8,
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--control-border)',
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
};

const actionButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: 8,
  border: '1px solid var(--control-border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const folderIconStyle = {
  width: 26,
  height: 26,
  padding: 0,
  border: 0,
  borderLeft: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const folderChipStyle = (active) => ({
  fontSize: 11,
  padding: '5px 11px',
  borderRadius: 99,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
  background: active ? 'rgba(255,77,46,0.12)' : 'var(--bg-elevated)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
});

const fieldLabelStyle = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const fieldLabelTextStyle = {
  color: 'var(--text-muted)',
  fontSize: 9.5,
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const dayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const projectViews = [
  { id: 'library', label: 'Biblioteca', icon: BookOpen },
  { id: 'queue', label: 'Fila', icon: ListOrdered },
  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
];

function useModalKeyboard(open, onClose) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const focusEditorAfterCloseRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    focusEditorAfterCloseRef.current = false;
    const focusTimer = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusTimer);
      // Abrir um projeto troca o conteúdo atrás do modal. Nesse caso o alvo
      // lógico é a aba ativa do editor; nos demais fechamentos voltamos ao
      // botão que abriu a Biblioteca, se ele ainda existir.
      window.requestAnimationFrame(() => {
        const editorTarget = document.querySelector(
          '[aria-label="Áreas de edição do projeto"] [role="tab"][aria-selected="true"], '
          + '[aria-label="Abas do editor"] button',
        );
        const returnTarget = returnFocusRef.current;
        if (focusEditorAfterCloseRef.current && editorTarget instanceof HTMLElement) {
          editorTarget.focus();
        } else if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
          returnTarget.focus();
        } else if (editorTarget instanceof HTMLElement) {
          editorTarget.focus();
        }
      });
    };
  }, [open]);

  const onDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const controls = [...dialogRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0);
    if (!controls.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { dialogRef, onDialogKeyDown, focusEditorAfterCloseRef };
}

const monthLabel = (key) => {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return '';
  const label = new Date(Number(match[1]), Number(match[2]) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const calendarDateLabel = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  if (!match) return key || 'Sem data';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};

function FolderOrganizer({
  folders,
  folderFilter,
  onFolderFilter,
  library,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) {
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState(null);
  const newFolderInputRef = useRef(null);
  const folderDeleteConfirmRef = useRef(null);
  const folderDeleteButtonsRef = useRef(new Map());

  useEffect(() => {
    if (!confirmDeleteFolderId) return undefined;
    const focusTimer = window.requestAnimationFrame(() => folderDeleteConfirmRef.current?.focus());
    return () => window.cancelAnimationFrame(focusTimer);
  }, [confirmDeleteFolderId]);

  const cancelFolderDelete = (folderId) => {
    setConfirmDeleteFolderId(null);
    window.requestAnimationFrame(() => folderDeleteButtonsRef.current.get(folderId)?.focus());
  };

  const submitNewFolder = (event) => {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const createdId = onCreateFolder?.(name);
    if (createdId) {
      setNewFolderName('');
    }
  };

  const beginRename = (folder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setConfirmDeleteFolderId(null);
  };

  const commitRename = () => {
    const name = editingFolderName.trim();
    if (editingFolderId && name) onRenameFolder?.(editingFolderId, name);
    setEditingFolderId(null);
  };

  return (
    <section
      aria-label="Organização por pastas"
      style={{
        display: 'flex', flexDirection: 'column', gap: 9, padding: 12,
        borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)' }}>
          <Folder size={14}/>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)' }}>PASTAS</span>
        </div>
        <form onSubmit={submitNewFolder} style={{ display: 'flex', gap: 6, flex: '1 1 250px', maxWidth: 340 }}>
          <input
            ref={newFolderInputRef}
            type="text"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Nova pasta"
            aria-label="Nome da nova pasta"
            maxLength={60}
            className="vc-input"
            style={{ flex: 1, minWidth: 0, minHeight: 36 }}
          />
          <button
            type="submit"
            aria-label="Criar pasta"
            title="Criar pasta"
            disabled={!newFolderName.trim()}
            style={{
              ...actionButtonStyle,
              opacity: newFolderName.trim() ? 1 : 0.45,
              cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <FolderPlus size={14}/>
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onFolderFilter('all')}
          aria-pressed={folderFilter === 'all'}
          style={folderChipStyle(folderFilter === 'all')}
        >
          Todas <span style={{ opacity: 0.65 }}>({library.length})</span>
        </button>
        <button
          type="button"
          onClick={() => onFolderFilter(UNFILED_FOLDER_ID)}
          aria-pressed={folderFilter === UNFILED_FOLDER_ID}
          style={folderChipStyle(folderFilter === UNFILED_FOLDER_ID)}
        >
          Sem pasta <span style={{ opacity: 0.65 }}>({library.filter((entry) => !entry.folderId).length})</span>
        </button>

        {folders.map((folder) => {
          const active = folderFilter === folder.id;
          const editing = editingFolderId === folder.id;
          const confirming = confirmDeleteFolderId === folder.id;
          const count = library.filter((entry) => entry.folderId === folder.id).length;

          if (editing) {
            return (
              <div key={folder.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  autoFocus
                  type="text"
                  value={editingFolderName}
                  onChange={(event) => setEditingFolderName(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename();
                    if (event.key === 'Escape') {
                      event.stopPropagation();
                      setEditingFolderId(null);
                    }
                  }}
                  aria-label={`Novo nome da pasta ${folder.name}`}
                  className="vc-input"
                  maxLength={60}
                  style={{ width: 150, minHeight: 30, padding: '4px 8px', fontSize: 11 }}
                />
              </div>
            );
          }

          return (
            <div
              key={folder.id}
              role={confirming ? 'group' : undefined}
              aria-label={confirming ? `Confirmar exclusão da pasta ${folder.name}` : undefined}
              onKeyDown={confirming ? (event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelFolderDelete(folder.id);
                }
              } : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', borderRadius: 99,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'rgba(255,77,46,0.12)' : 'var(--bg-elevated)',
              }}
            >
              <button
                type="button"
                onClick={() => onFolderFilter(folder.id)}
                aria-pressed={active}
                style={{
                  padding: '5px 8px 5px 11px', border: 0, background: 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
                }}
              >
                {folder.name} <span style={{ opacity: 0.65 }}>({count})</span>
              </button>
              {confirming ? (
                <>
                  <button
                    ref={folderDeleteConfirmRef}
                    type="button"
                    onClick={() => {
                      onDeleteFolder?.(folder.id);
                      if (active) onFolderFilter('all');
                      setConfirmDeleteFolderId(null);
                      window.requestAnimationFrame(() => newFolderInputRef.current?.focus());
                    }}
                    title="Confirmar exclusão. Os projetos ficarão sem pasta."
                    aria-label={`Confirmar exclusão da pasta ${folder.name}`}
                    style={{
                      height: 26, padding: '0 7px', border: 0, borderLeft: '1px solid var(--border)',
                      background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: 10,
                      fontWeight: 800, fontFamily: 'var(--font-ui)',
                    }}
                  >OK</button>
                  <button
                    type="button"
                    onClick={() => cancelFolderDelete(folder.id)}
                    title="Cancelar exclusão"
                    aria-label="Cancelar exclusão da pasta"
                    style={folderIconStyle}
                  ><X size={11}/></button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => beginRename(folder)}
                    title={`Renomear ${folder.name}`}
                    aria-label={`Renomear pasta ${folder.name}`}
                    style={folderIconStyle}
                  ><Pencil size={10}/></button>
                  <button
                    ref={(node) => {
                      if (node) folderDeleteButtonsRef.current.set(folder.id, node);
                      else folderDeleteButtonsRef.current.delete(folder.id);
                    }}
                    type="button"
                    onClick={() => {
                      setConfirmDeleteFolderId(folder.id);
                      setEditingFolderId(null);
                    }}
                    title={`Excluir ${folder.name}`}
                    aria-label={`Excluir pasta ${folder.name}`}
                    style={{ ...folderIconStyle, color: '#f87171' }}
                  ><Trash2 size={10}/></button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {confirmDeleteFolderId ? (
        <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          Excluir uma pasta não apaga carrosséis. Os projetos dela voltam para “Sem pasta”.
        </p>
      ) : null}
    </section>
  );
}

function LibraryCalendar({ library, folders, currentMonth, onMonthChange, onOpen }) {
  const days = calendarDays(currentMonth);
  const grouped = entriesByPublicationDate(library, currentMonth);
  const today = localDateKey();
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const withoutDate = library.filter((entry) => !entry.publicationDate);

  return (
    <div style={{ padding: '14px 20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        role="note"
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 9,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.23)',
          color: 'var(--text-secondary)', fontSize: 11.5, lineHeight: 1.45, fontFamily: 'var(--font-ui)',
        }}
      >
        <CalendarDays size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }}/>
        <span><strong style={{ color: 'var(--text-primary)' }}>Planejamento local:</strong> este calendário organiza sua pauta. O Viral Carrossel não publica automaticamente no Instagram.</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button type="button" onClick={() => onMonthChange(shiftMonth(currentMonth, -1))} aria-label="Mês anterior" style={actionButtonStyle}>
          <ChevronLeft size={15}/>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div aria-live="polite" aria-atomic="true" style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-ui)' }}>
            {monthLabel(currentMonth)}
          </div>
          <button
            type="button"
            onClick={() => onMonthChange(monthKey())}
            style={{ border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 10.5, fontFamily: 'var(--font-ui)', padding: '3px 6px' }}
          >Ir para hoje</button>
        </div>
        <button type="button" onClick={() => onMonthChange(shiftMonth(currentMonth, 1))} aria-label="Próximo mês" style={actionButtonStyle}>
          <ChevronRight size={15}/>
        </button>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
        <div style={{ minWidth: 760 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5, marginBottom: 5 }}>
            {dayNames.map((day) => (
              <div key={day} style={{ padding: '5px 7px', color: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                {day}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 }}>
            {days.map((date, index) => {
              const entries = date ? grouped.get(date) || [] : [];
              const isToday = date === today;
              return (
                <div
                  key={date || `blank-${index}`}
                  aria-label={date ? `${date}: ${entries.length} projeto(s)` : undefined}
                  style={{
                    minHeight: 116, padding: 7, borderRadius: 8,
                    background: date ? (isToday ? 'rgba(255,77,46,0.055)' : 'var(--bg-card)') : 'transparent',
                    border: date ? `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}` : '1px solid transparent',
                  }}
                >
                  {date ? (
                    <>
                      <div style={{
                        width: 23, height: 23, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 99, background: isToday ? 'var(--accent)' : 'transparent',
                        color: isToday ? 'var(--text-on-accent)' : 'var(--text-muted)', fontSize: 10.5, fontWeight: 700,
                        fontFamily: 'var(--font-mono)', marginBottom: 4,
                      }}>
                        {Number(date.slice(-2))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {entries.map((entry) => {
                          const status = STATUS_BY_ID[entry.status] || STATUS_BY_ID.draft;
                          const folderName = folderById.get(entry.folderId)?.name;
                          return (
                            <button
                              type="button"
                              key={entry.id}
                              onClick={() => onOpen(entry.id)}
                              title={`${entry.name}${folderName ? ` · ${folderName}` : ''}`}
                              aria-label={`${entry.name}. Data: ${calendarDateLabel(date)}. Status: ${status.label}. Pasta: ${folderName || 'Sem pasta'}.`}
                              style={{
                                width: '100%', minWidth: 0, padding: '6px 7px', borderRadius: 6,
                                background: status.bg, border: `1px solid ${status.border}`,
                                color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
                                fontSize: 9.5, lineHeight: 1.25, fontWeight: 650, fontFamily: 'var(--font-ui)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              <span aria-hidden="true" style={{ color: status.color, marginRight: 4 }}>●</span>
                              {entry.name}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {withoutDate.length ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-card)',
          color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-ui)',
        }}>
          <span><strong style={{ color: 'var(--text-secondary)' }}>{withoutDate.length}</strong> projeto{withoutDate.length !== 1 ? 's' : ''} ainda sem data.</span>
          <span>Defina a data na aba Biblioteca ou na Fila.</span>
        </div>
      ) : null}
    </div>
  );
}

function QueueSection({ title, hint, entries, emptyLabel, folders, onOpen, onSetStatus, accent }) {
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: accent || 'var(--text-primary)',
          fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em',
        }}>
          {title}
          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            {entries.length}
          </span>
        </div>
        {hint ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>
        ) : null}
      </div>
      {!entries.length ? (
        <div style={{
          padding: '12px 14px', borderRadius: 10, border: '1px dashed var(--border)',
          color: 'var(--text-muted)', fontSize: 12,
        }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((entry) => {
            const status = STATUS_BY_ID[entry.status] || STATUS_BY_ID.draft;
            const folderName = folderById.get(entry.folderId)?.name;
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(entry.id)}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                    cursor: 'pointer', textAlign: 'left', padding: 0,
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {[
                      entry.publicationDate || 'Sem data',
                      folderName || 'Sem pasta',
                      status.label,
                    ].join(' · ')}
                  </div>
                </button>
                {onSetStatus && entry.status !== 'published' ? (
                  <button
                    type="button"
                    className="vc-btn"
                    onClick={() => onSetStatus(entry.id, 'published')}
                    title="Marcar como publicado (manual — fora do Viral)"
                    aria-label={`Marcar ${entry.name} como publicado`}
                    style={{
                      minHeight: 32, padding: '0 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                      border: '1px solid var(--hairline)', background: 'var(--bg-pearl)', whiteSpace: 'nowrap',
                    }}
                  >
                    Marcar publicado
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LibraryQueue({ library, folders, onOpen, onSetStatus }) {
  const queue = useMemo(() => buildEditorialQueue(library), [library]);
  return (
    <div style={{ padding: '14px 20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        role="note"
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 9,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.23)',
          color: 'var(--text-secondary)', fontSize: 11.5, lineHeight: 1.45, fontFamily: 'var(--font-ui)',
        }}
      >
        <ListOrdered size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>Fila editorial local.</strong>{' '}
          Organize o que publicar a seguir. A publicação continua sendo feita por você no Instagram.
        </span>
      </div>

      <QueueSection
        title="Atrasados"
        hint="Com data anterior a hoje e ainda não marcados como publicados."
        entries={queue.overdue}
        emptyLabel="Nada atrasado."
        folders={folders}
        onOpen={onOpen}
        onSetStatus={onSetStatus}
        accent="#f87171"
      />
      <QueueSection
        title="Próximos 7 dias"
        hint={`De ${queue.today} até ${queue.horizon} (planejamento local).`}
        entries={queue.next7}
        emptyLabel="Nada agendado nesta janela."
        folders={folders}
        onOpen={onOpen}
        onSetStatus={onSetStatus}
      />
      <QueueSection
        title="Sem data"
        hint="Projetos ativos sem data editorial — úteis para organizar a seguir."
        entries={queue.undated.slice(0, 20)}
        emptyLabel="Todos os projetos ativos têm data ou já foram publicados."
        folders={folders}
        onOpen={onOpen}
        onSetStatus={onSetStatus}
      />
      {queue.undated.length > 20 ? (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
          +{queue.undated.length - 20} sem data — veja na Biblioteca.
        </p>
      ) : null}
    </div>
  );
}

export default function LibraryModal({
  open,
  onClose,
  library = [],
  folders = [],
  activeDocId,
  onOpen,
  onNew,
  onDuplicate,
  onNewFromContext,
  onDelete,
  onRename,
  onSetStatus,
  onSetFolder,
  onSetPublicationDate,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onExportDoc,
  onExportAll,
  onImportTrigger,
  appMode = 'criador',
}) {
  useScrollLock(open);
  const { dialogRef, onDialogKeyDown, focusEditorAfterCloseRef } = useModalKeyboard(open, onClose);
  const [view, setView] = useState('library');
  const [filter, setFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(monthKey());
  const [organizeIds, setOrganizeIds] = useState(() => new Set());
  const projectDeleteConfirmRef = useRef(null);
  const projectDeleteButtonsRef = useRef(new Map());
  const newProjectButtonRef = useRef(null);
  const compactCards = appMode === 'criador';
  const showLibraryFilters = view === 'library';

  const toggleOrganize = (id) => {
    setOrganizeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleItems = useMemo(() => library
    .filter((entry) => filter === 'all' || entry.status === filter)
    .filter((entry) => folderFilter === 'all'
      || (folderFilter === UNFILED_FOLDER_ID ? !entry.folderId : entry.folderId === folderFilter))
    .filter((entry) => !search.trim() || entry.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), [library, filter, folderFilter, search]);

  const counts = useMemo(() => ({
    all: library.length,
    ...Object.fromEntries(STATUS_DEFS.map((status) => [
      status.id,
      library.filter((entry) => entry.status === status.id).length,
    ])),
  }), [library]);
  const statusFilters = [{ id: 'all', label: 'Todos' }, ...STATUS_DEFS];

  const changeView = (nextView) => {
    // Busca e filtros pertencem à Biblioteca. Ao sair dela, limpamos os
    // filtros para o Calendário e a Fila nunca parecerem vazios por um estado
    // que ficou invisível.
    if (nextView !== 'library') {
      setFilter('all');
      setFolderFilter('all');
      setSearch('');
    }
    setView(nextView);
  };

  const openProject = (projectId) => {
    focusEditorAfterCloseRef.current = true;
    onOpen?.(projectId);
  };

  useEffect(() => {
    if (!confirmDeleteId) return undefined;
    const focusTimer = window.requestAnimationFrame(() => projectDeleteConfirmRef.current?.focus());
    return () => window.cancelAnimationFrame(focusTimer);
  }, [confirmDeleteId]);

  useEffect(() => {
    if (open) return;
    setConfirmDeleteId(null);
    setEditingId(null);
  }, [open]);

  const cancelProjectDelete = (projectId) => {
    setConfirmDeleteId(null);
    window.requestAnimationFrame(() => projectDeleteButtonsRef.current.get(projectId)?.focus());
  };

  const onViewKeyDown = (event, currentId) => {
    const currentIndex = projectViews.findIndex((item) => item.id === currentId);
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % projectViews.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + projectViews.length) % projectViews.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = projectViews.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextId = projectViews[nextIndex].id;
    changeView(nextId);
    window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector(`[data-project-view="${nextId}"]`)?.focus();
    });
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditingName(entry.name);
  };
  const commitEdit = () => {
    if (editingId && editingName.trim()) onRename(editingId, editingName.trim());
    setEditingId(null);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-panel modal-panel-wide"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        style={{ maxWidth: view === 'calendar' ? 1040 : 860 }}
        role="dialog"
        aria-modal="true"
        aria-label="Biblioteca de carrosséis"
        tabIndex={-1}
      >
        <div className="vc-library-header" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-sidebar)', zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {view === 'calendar'
                ? <CalendarDays size={14} color="var(--text-secondary)"/>
                : view === 'queue'
                  ? <ListOrdered size={14} color="var(--text-secondary)"/>
                  : <BookOpen size={14} color="var(--text-secondary)"/>}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.022em' }}>Projetos</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {counts.all === 1 ? '1 carrossel salvo' : `${counts.all} carrosséis salvos`}
              </div>
            </div>
          </div>

          <div className="vc-library-view-tabs" role="tablist" aria-label="Visualização dos projetos" style={{ display: 'flex', padding: 3, borderRadius: 9, border: '1px solid var(--control-border)', background: 'var(--bg-card)' }}>
            {projectViews.map((tab) => {
              const Icon = tab.icon;
              const active = view === tab.id;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`project-view-${tab.id}`}
                  id={`project-view-tab-${tab.id}`}
                  tabIndex={active ? 0 : -1}
                  data-project-view={tab.id}
                  key={tab.id}
                  onClick={() => changeView(tab.id)}
                  onKeyDown={(event) => onViewKeyDown(event, tab.id)}
                  style={{
                    minHeight: 32, padding: '0 11px', borderRadius: 7, border: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 11, fontWeight: 650, fontFamily: 'var(--font-ui)',
                    boxShadow: active ? '0 1px 5px rgba(0,0,0,0.18)' : 'none',
                  }}
                ><Icon size={12}/>{tab.label}</button>
              );
            })}
          </div>

          <button type="button" onClick={onClose} aria-label="Fechar biblioteca" className="vc-icon-btn"><X size={16}/></button>
        </div>

        <div className="vc-library-toolbar" style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="vc-library-actions" style={{ display: 'flex', gap: 8 }}>
            <button
              ref={newProjectButtonRef}
              type="button"
              className="vc-btn vc-btn-primary vc-library-new"
              onClick={() => onNew()}
              style={{
                height: 40, flex: 1, borderRadius: 9, border: 'none', cursor: 'pointer',
                background: 'var(--accent)', color: 'var(--text-on-accent)',
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-ui)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(255,77,46,0.25)',
              }}
            ><Plus size={14}/>Novo carrossel</button>
            <button type="button" onClick={onExportAll} title="Exportar toda a biblioteca como JSON" style={{ ...controlStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13}/>Exportar
            </button>
            <button type="button" onClick={onImportTrigger} title="Importar projetos de um arquivo JSON" style={{ ...controlStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={13}/>Importar
            </button>
          </div>

          {showLibraryFilters ? (
            <>
          <FolderOrganizer
            folders={folders}
            folderFilter={folderFilter}
            onFolderFilter={setFolderFilter}
            library={library}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar pelo nome..."
              aria-label="Buscar carrosséis"
              className="vc-input"
              style={{ flex: '1 1 220px' }}
            />
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {statusFilters.map((statusFilter) => (
                <button
                  type="button"
                  key={statusFilter.id}
                  onClick={() => setFilter(statusFilter.id)}
                  aria-pressed={filter === statusFilter.id}
                  style={{
                    fontSize: 11, padding: '5px 10px', borderRadius: 99, cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontWeight: 600, transition: 'all 0.12s',
                    background: filter === statusFilter.id ? 'var(--accent)' : 'var(--bg-card)',
                    border: `1px solid ${filter === statusFilter.id ? 'var(--accent)' : 'var(--border)'}`,
                    color: filter === statusFilter.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                  }}
                >
                  {statusFilter.label} <span style={{ opacity: 0.65, marginLeft: 3 }}>({counts[statusFilter.id] || 0})</span>
                </button>
              ))}
            </div>
          </div>
            </>
          ) : null}
        </div>

        <div
          id={`project-view-${view}`}
          role="tabpanel"
          aria-labelledby={`project-view-tab-${view}`}
          tabIndex={0}
          style={{ minHeight: 0 }}
        >
        {view === 'calendar' ? (
          <LibraryCalendar
            library={library}
            folders={folders}
            currentMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            onOpen={openProject}
          />
        ) : view === 'queue' ? (
          <LibraryQueue
            library={library}
            folders={folders}
            onOpen={openProject}
            onSetStatus={onSetStatus}
          />
        ) : (
          <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleItems.length === 0 && (() => {
              const totalLibrary = library.filter((entry) => !isDefault(entry.doc?.slides || [])).length;
              const hasActiveFilter = search.trim() || filter !== 'all' || folderFilter !== 'all';
              const isFirstVisit = totalLibrary === 0 && !hasActiveFilter;
              if (isFirstVisit) {
                return (
                  <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                    <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--success-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={24} style={{ color: 'var(--accent)' }}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.018em', marginBottom: 4 }}>
                        Sua biblioteca está vazia
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 340, color: 'var(--text-muted)', letterSpacing: '-0.011em' }}>
                        Crie seu primeiro carrossel. Depois organize em pastas, defina a data da pauta e acompanhe pelo calendário.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { onClose(); onNew?.(); }}
                      style={{
                        marginTop: 6, padding: '10px 18px', borderRadius: 9999, cursor: 'pointer',
                        background: 'var(--accent)', color: 'var(--text-on-accent)', border: 'none', fontSize: 13,
                        fontWeight: 600, fontFamily: 'var(--font-ui)', letterSpacing: '-0.011em',
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                      }}
                    ><Plus size={14}/>Criar primeiro carrossel</button>
                  </div>
                );
              }
              return (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>
                  Nenhum carrossel corresponde aos filtros atuais.
                </div>
              );
            })()}

            {visibleItems.map((entry) => {
              const isActive = entry.id === activeDocId;
              const status = STATUS_BY_ID[entry.status] || STATUS_BY_ID.draft;
              const slides = entry.doc?.slides || [];
              const firstSlide = slides[0];
              const bg = resolveSlideBrandBg(entry.doc?.brand || {}, 0, firstSlide || {}) || '#0a0a0a';
              const editing = editingId === entry.id;
              const organizeOpen = !compactCards || organizeIds.has(entry.id);
              const folderName = folders.find((f) => f.id === entry.folderId)?.name;
              return (
                <article
                  key={entry.id}
                  style={{
                    background: isActive ? 'rgba(255,77,46,0.06)' : 'var(--bg-card)',
                    border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 11, padding: 12, display: 'flex', flexDirection: 'column', gap: 11,
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => openProject(entry.id)}
                      style={{
                        width: 56, height: 70, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                        background: bg, backgroundImage: firstSlide?.bgImage ? `url(${firstSlide.bgImage})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid rgba(255,255,255,0.06)',
                        position: 'relative', overflow: 'hidden',
                      }}
                      aria-label={`Abrir ${entry.name}`}
                    >
                      {firstSlide?.bgImage ? <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}/> : null}
                      <span style={{ position: 'absolute', bottom: 3, left: 5, fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                        {String(slides.length).padStart(2, '0')}
                      </span>
                    </button>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {editing ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitEdit();
                            if (event.key === 'Escape') {
                              event.stopPropagation();
                              setEditingId(null);
                            }
                          }}
                          className="vc-input"
                          style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600 }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => openProject(entry.id)}
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                            fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
                            letterSpacing: '-0.011em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                          }}
                          title={`Abrir ${entry.name}`}
                        >{entry.name}</button>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 99, background: status.bg, color: status.color, border: `1px solid ${status.border}`, fontWeight: 700 }}>
                          {status.label}
                        </span>
                        <span>{slides.length} card{slides.length !== 1 ? 's' : ''}</span>
                        {entry.updatedAt ? <span style={{ opacity: 0.7 }}>{fmtDate(entry.updatedAt)}</span> : null}
                        {compactCards && !organizeOpen ? (
                          <span style={{ opacity: 0.75 }}>
                            {[folderName || 'Sem pasta', entry.publicationDate || 'Sem data'].join(' · ')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {compactCards && !organizeOpen ? (
                    <button
                      type="button"
                      className="vc-btn vc-btn-ghost"
                      onClick={() => toggleOrganize(entry.id)}
                      aria-expanded={false}
                      style={{
                        alignSelf: 'flex-start', minHeight: 36, padding: '0 12px', borderRadius: 8,
                        fontSize: 11, fontWeight: 600, border: '1px solid var(--hairline)',
                      }}
                    >
                      Organizar
                    </button>
                  ) : null}

                  {organizeOpen ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
                    <label style={fieldLabelStyle}>
                      <span style={fieldLabelTextStyle}>Pasta</span>
                      <select
                        value={entry.folderId || ''}
                        onChange={(event) => onSetFolder?.(entry.id, event.target.value)}
                        aria-label={`Pasta de ${entry.name}`}
                        style={{ ...controlStyle, width: '100%', cursor: 'pointer' }}
                      >
                        <option value="">Sem pasta</option>
                        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                      </select>
                    </label>

                    <label style={fieldLabelStyle}>
                      <span style={fieldLabelTextStyle}>Data da pauta</span>
                      <input
                        type="date"
                        value={entry.publicationDate || ''}
                        onChange={(event) => onSetPublicationDate?.(entry.id, event.target.value)}
                        aria-label={`Data de publicação de ${entry.name}`}
                        style={{ ...controlStyle, width: '100%', boxSizing: 'border-box', colorScheme: 'dark' }}
                      />
                    </label>

                    <label style={fieldLabelStyle}>
                      <span style={fieldLabelTextStyle}>Status</span>
                      <select
                        value={entry.status}
                        onChange={(event) => onSetStatus(entry.id, event.target.value)}
                        aria-label={`Estado de ${entry.name}`}
                        style={{ ...controlStyle, width: '100%', cursor: 'pointer' }}
                      >
                        {STATUS_DEFS.map((statusDef) => <option key={statusDef.id} value={statusDef.id}>{statusDef.label}</option>)}
                      </select>
                    </label>
                    {compactCards ? (
                      <button
                        type="button"
                        className="vc-btn vc-btn-ghost"
                        onClick={() => toggleOrganize(entry.id)}
                        style={{
                          alignSelf: 'end', minHeight: 36, padding: '0 12px', borderRadius: 8,
                          fontSize: 11, fontWeight: 600, border: '1px solid var(--hairline)',
                        }}
                      >
                        Recolher
                      </button>
                    ) : null}
                  </div>
                  ) : null}

                  <div
                    role={confirmDeleteId === entry.id ? 'group' : undefined}
                    aria-label={confirmDeleteId === entry.id ? `Confirmar exclusão de ${entry.name}` : undefined}
                    onKeyDown={confirmDeleteId === entry.id ? (event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        cancelProjectDelete(entry.id);
                      }
                    } : undefined}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}
                  >
                    <button type="button" onClick={() => startEdit(entry)} aria-label={`Renomear ${entry.name}`} title="Renomear" style={actionButtonStyle}><Pencil size={12}/></button>
                    <button type="button" onClick={() => onDuplicate(entry.id)} aria-label={`Duplicar ${entry.name}`} title="Duplicar" style={actionButtonStyle}><Copy size={12}/></button>
                    {onNewFromContext ? (
                      <button
                        type="button"
                        onClick={() => onNewFromContext(entry.id)}
                        aria-label={`Novo com o contexto de ${entry.name}`}
                        title="Novo com este contexto"
                        style={actionButtonStyle}
                      >
                        <Layers size={12}/>
                      </button>
                    ) : null}
                    <button type="button" onClick={() => onExportDoc(entry.id)} aria-label={`Exportar ${entry.name} como JSON`} title="Exportar como JSON" style={actionButtonStyle}><Download size={12}/></button>
                    {confirmDeleteId === entry.id ? (
                      <>
                        <button
                          ref={projectDeleteConfirmRef}
                          type="button"
                          onClick={() => {
                            onDelete(entry.id);
                            setConfirmDeleteId(null);
                            window.requestAnimationFrame(() => newProjectButtonRef.current?.focus());
                          }}
                          title="Confirmar exclusão"
                          aria-label={`Confirmar exclusão de ${entry.name}`}
                          style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.5)', background: 'rgba(248,113,113,0.15)', color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)' }}
                        >Apagar</button>
                        <button type="button" onClick={() => cancelProjectDelete(entry.id)} aria-label={`Cancelar exclusão de ${entry.name}`} title="Cancelar" style={actionButtonStyle}><X size={12}/></button>
                      </>
                    ) : (
                      <button
                        ref={(node) => {
                          if (node) projectDeleteButtonsRef.current.set(entry.id, node);
                          else projectDeleteButtonsRef.current.delete(entry.id);
                        }}
                        type="button"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label={`Apagar ${entry.name}`}
                        title="Apagar"
                        style={{ ...actionButtonStyle, color: '#f87171' }}
                      ><Trash2 size={12}/></button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
