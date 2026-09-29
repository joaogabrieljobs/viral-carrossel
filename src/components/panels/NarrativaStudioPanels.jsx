import { GEN_MODES } from '../../utils/generation-prompts.js';
import React, { useState } from 'react';
import { GenerationScopePicker } from '../GenerationScopePicker.jsx';
import { BookOpen, ChevronDown, FileText, Loader2, Sparkles, Type } from 'lucide-react';
import { ProjectStyleKitPanel } from './ProjectStyleKitPanel.jsx';
import { styleKitHasContent } from '../../utils/style-kit.js';

/**
 * Cabeçalho de acordeão — clica para maximizar / minimizar.
 * Um painel aberto de cada vez (os outros viram só o botão).
 */
function AccordionHeader({
  title,
  hint,
  badge,
  icon: Icon,
  open,
  onToggle,
  connectBody = false,
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="vc-btn"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: open && connectBody ? '12px 12px 0 0' : 12,
        border: `1px solid ${open ? 'var(--text-primary)' : 'var(--hairline)'}`,
        borderBottom: open && connectBody ? '1px solid var(--hairline)' : undefined,
        background: open ? 'var(--bg-base)' : 'var(--bg-parchment)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-ui)',
        transition: 'border-color 0.15s, background-color 0.15s, transform 0.1s',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: open ? 'var(--accent)' : 'var(--accent-surface)',
        color: open ? 'var(--accent-on-dark)' : 'var(--text-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
          letterSpacing: '0.04em', lineHeight: 1.3,
          textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', letterSpacing: '-0.005em',
          marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-ui)',
          textTransform: 'none',
        }}>
          {badge || hint}
        </div>
      </div>
      <ChevronDown
        size={16}
        style={{
          flexShrink: 0,
          color: 'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }}
      />
    </button>
  );
}

function AccordionPanel({ open, children, flushBottom = false }) {
  if (!open) return null;
  return (
    <div style={{
      padding: 14,
      border: '1px solid var(--text-primary)',
      borderTop: 'none',
      borderRadius: flushBottom ? 0 : '0 0 12px 12px',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      marginBottom: flushBottom ? 0 : undefined,
    }}>
      {children}
    </div>
  );
}

const BTN_CAPS = {
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
};

/**
 * Topo da aba Narrativa: controlos maximizáveis.
 * 1) Contexto da marca · 2) Prompt · 3) ADD CONTEÚDO · 4) EDITAR CARD
 */
function NarrativaStudioPanels({
  panel,
  setPanel,
  styleKit,
  setStyleKit,
  toast,
  projectName = '',
  onOpenProjects = null,
  onNewProject = null,
  quickPrompt,
  setQuickPrompt,
  onQuickGenerate,
  genBusy = false,
  hasImages = false,
  narrativeMode = 'none',
  onNarrativeModeChange = () => {},
  activeIdx = 0,
  slidesCount = 1,
  cardChildren = null,
  materialChildren = null,
  materialSummary = '',
}) {
  const [scope, setScope] = useState('text');
  const effectiveScope = hasImages ? scope : 'text';
  const kit = styleKit || {};
  const hasKit = styleKitHasContent(kit);
  const promptTrim = (quickPrompt || '').trim();
  const nome = (projectName || '').trim() || 'este projeto';
  const contextBadge = hasKit
    ? [
        `«${nome}»`,
        kit.contextMd?.trim() ? 'brief' : null,
        kit.stylePrompt?.trim() ? 'estilo' : null,
        (kit.refImages || []).length ? `${kit.refImages.length} ref.` : null,
      ].filter(Boolean).join(' · ')
    : `Só de «${nome}» — outros projetos não partilham`;
  const promptBadge = promptTrim
    ? (promptTrim.length > 48 ? `${promptTrim.slice(0, 48)}…` : promptTrim)
    : 'Ex.: criar card sobre a ferramenta X';

  const toggle = (id) => {
    setPanel((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <AccordionHeader
          title="Usar contexto da marca"
          hint={`Brief, estilo e referências de «${nome}»`}
          badge={contextBadge}
          icon={BookOpen}
          open={panel === 'context'}
          onToggle={() => toggle('context')}
          connectBody
        />
        <AccordionPanel open={panel === 'context'}>
          <ProjectStyleKitPanel
            styleKit={styleKit}
            setStyleKit={setStyleKit}
            toast={toast}
            projectName={projectName}
            onOpenProjects={onOpenProjects}
            onNewProject={onNewProject}
          />
        </AccordionPanel>
      </div>

      <div>
        <AccordionHeader
          title="Prompt para gerar"
          hint="Descreve o que queres criar — usa o contexto e as referências"
          badge={promptBadge}
          icon={Sparkles}
          open={panel === 'prompt'}
          onToggle={() => toggle('prompt')}
          connectBody
        />
        <AccordionPanel open={panel === 'prompt'}>
          <p style={{
            margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)',
            letterSpacing: '-0.005em',
          }}>
            O pedido define o que criar e quantos cards gerar. O brief orienta o conteúdo
            e o estilo orienta a arte. O moodboard é enviado apenas a geradores de imagem compatíveis.
          </p>
          <textarea
            aria-label="Prompt para gerar"
            value={quickPrompt || ''}
            onChange={(e) => setQuickPrompt(e.target.value)}
            rows={5}
            placeholder={
              'Ex.: Criar card sobre a ferramenta X.\n' +
              'Falar sobre o procedimento Y passo a passo.\n' +
              'Explicar o erro comum ao configurar Z.'
            }
            className="vc-input vc-textarea"
            disabled={genBusy}
            style={{
              minHeight: 110, resize: 'vertical', lineHeight: 1.5, fontSize: 14,
            }}
          />
          <fieldset disabled={genBusy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Modo narrativo</legend>
            <div role="group" aria-label="Modo narrativo" style={{ display: 'flex', overflowX: 'auto', gap: 6, paddingBottom: 8 }}>
              {[GEN_MODES.find(item => item.id === 'none'), ...GEN_MODES.filter(item => item.id !== 'none')].map(item => (
                <button key={item.id} type="button" aria-pressed={narrativeMode === item.id} title={item.desc} onClick={() => onNarrativeModeChange(item.id)}
                  style={{ flexShrink: 0, minHeight: 40, padding: '8px 12px', borderRadius: 9999, border: `1px solid ${narrativeMode === item.id ? 'var(--accent)' : 'var(--border)'}`, background: narrativeMode === item.id ? 'var(--accent-surface)' : 'var(--bg-card)', color: 'var(--text-primary)', cursor: genBusy ? 'not-allowed' : 'pointer' }}>{item.label}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)', margin: 0 }}>{GEN_MODES.find(item => item.id === narrativeMode)?.desc}</p>
          </fieldset>
          <GenerationScopePicker value={effectiveScope} onChange={setScope} disabled={genBusy} hasImages={hasImages} />
          <button
            type="button"
            disabled={genBusy || !promptTrim}
            onClick={() => onQuickGenerate?.(promptTrim, { withImages: effectiveScope === 'text_images', narrativeMode })}
            style={{
              width: '100%', height: 44, borderRadius: 9999, border: 'none',
              cursor: genBusy || !promptTrim ? 'not-allowed' : 'pointer',
              background: genBusy || !promptTrim ? 'var(--bg-pearl)' : 'var(--accent)',
              color: genBusy || !promptTrim ? 'var(--text-muted)' : '#fff',
              fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: genBusy || !promptTrim ? 0.7 : 1,
              transition: 'background-color 0.15s, transform 0.1s',
              ...BTN_CAPS,
            }}
            onMouseDown={(e) => {
              if (!genBusy && promptTrim) e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {genBusy ? (
              <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> A GERAR…</>
            ) : (
              <><Sparkles size={14} /> Gerar com contexto e referências</>
            )}
          </button>
          {!hasKit ? (
            <button
              type="button"
              onClick={() => setPanel('context')}
              style={{
                alignSelf: 'center', border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11,
                fontFamily: 'var(--font-mono)', textDecoration: 'underline',
                textUnderlineOffset: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              Preencher contexto da marca primeiro
            </button>
          ) : null}
        </AccordionPanel>
      </div>

      <div>
        <AccordionHeader
          title="Add Conteúdo"
          hint="Matéria-prima, fontes e instruções para a IA"
          badge={materialSummary || 'Conteúdo base · fontes · contexto'}
          icon={FileText}
          open={panel === 'material'}
          onToggle={() => toggle('material')}
          connectBody={!!materialChildren}
        />
        {panel === 'material' && materialChildren ? (
          <div
            style={{
              border: '1px solid var(--text-primary)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              background: 'var(--bg-base)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {materialChildren}
          </div>
        ) : null}
      </div>

      <div>
        <AccordionHeader
          title="Editar Card"
          hint="Título, subtítulo e refinamentos deste card"
          badge={`Card ${activeIdx + 1} / ${slidesCount}`}
          icon={Type}
          open={panel === 'card'}
          onToggle={() => toggle('card')}
          connectBody={!!cardChildren}
        />
        {panel === 'card' && cardChildren ? (
          <div
            style={{
              border: '1px solid var(--text-primary)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              background: 'var(--bg-base)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {cardChildren}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { NarrativaStudioPanels, BTN_CAPS };
