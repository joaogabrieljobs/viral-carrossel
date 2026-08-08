// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React from 'react';
import { Sparkles, Flame, Instagram, Target, Camera } from 'lucide-react';
import { SectionLabel as S } from '../ui/SectionLabel.jsx';
import { GEN_MODES, GEN_MODE_BY_ID } from '../../utils/generation-prompts.js';
import { REFERENCE_PROFILES } from '../../utils/brand-visuals.js';

/** Sugestões de voz de referência por modo narrativo (opcional — serve de guia, não de regra fixa). */
const NARRATIVE_MODE_REF_VOICE_PAIRING = {
  editorial: 'Editorial premium · Tech didático · Finanças pop BR',
  deep: 'Editorial premium · Tech didático · Coach sóbrio',
  pain: 'Coach sóbrio · Clínica / estética · Microcriador BR',
  viral: 'Microcriador BR · Gancho provocador',
  storytelling: 'Storytelling em cena · Microcriador BR · Editorial premium',
  how_to: 'Tech didático · Coach sóbrio · Microcriador BR',
  jornalistico: 'Editorial premium · Tech didático',
  sensacionalista: 'Gancho provocador · Microcriador BR',
};

// ─── MODE PICKER ──────────────────────────────────────────────────────────────
// Seletor visual dos modos narrativos. Cada card mostra ícone + nome + 1-line
// descrição. Selecionado tem borda accent e background glow.
function ModePicker({ value, onChange }) {
  const active = GEN_MODE_BY_ID[value] || GEN_MODES[0];
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <label className="vc-label" style={{ marginBottom:0 }}>
          Modo narrativo
        </label>
        <span style={{
          fontSize:10, color:'var(--text-muted)',
          fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
        }}>
          {GEN_MODES.length} modos
        </span>
      </div>
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))',
        gap:6,
      }}>
        {GEN_MODES.map(m => {
          const on = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              style={{
                padding:'10px 10px 9px', borderRadius:10, cursor:'pointer', textAlign:'left',
                border:`1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent-surface-strong)' : 'var(--bg-card)',
                transition:'all 0.12s',
                display:'flex', flexDirection:'column', gap:3, minHeight:60,
              }}
              title={m.desc}
            >
              <div style={{
                fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                color: on ? 'var(--accent)' : 'var(--text-primary)',
                letterSpacing:'-0.011em',
                display:'flex', alignItems:'center', gap:8,
              }}>
                <m.Icon
                  size={17}
                  strokeWidth={2}
                  aria-hidden
                  style={{
                    flexShrink:0,
                    color: on ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                />
                {m.label}
              </div>
              <div style={{
                fontSize:10.5, color:'var(--text-muted)', lineHeight:1.4,
                fontFamily:'var(--font-ui)',
              }}>{m.desc}</div>
            </button>
          );
        })}
      </div>
      {/* Resumo do modo selecionado — preview do que será injetado */}
      <div style={{
        marginTop:8, fontSize:10.5, color:'var(--text-muted)',
        fontFamily:'var(--font-ui)', lineHeight:1.5,
        padding:'7px 10px', background:'var(--bg-card)',
        border:'1px dashed var(--border)', borderRadius:8,
        display:'flex', alignItems:'flex-start', gap:8,
      }}>
        <active.Icon
          size={16}
          strokeWidth={2}
          aria-hidden
          style={{ flexShrink:0, marginTop:1, color:'var(--accent)' }}
        />
        <span>
          <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{active.label}: </span>
          {active.desc}.
        </span>
      </div>
    </div>
  );
}

function ReferenceProfilesCuradoria({ material, setMaterial }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label className="vc-label" style={{ marginBottom: 4 }}>Curadoria: voz de referência</label>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          lineHeight: 1.5, marginTop: 2,
        }}>
          Inspire tom e ritmo do texto (carrosséis fortes no Instagram). Não copia posts nem nomes de perfis.
        </div>
      </div>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.47, letterSpacing: '-0.011em',
        padding: '8px 10px', background: 'var(--bg-pearl)', borderRadius: 11, border: '1px solid var(--hairline)',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Sugestões por modo narrativo
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GEN_MODES.map((m) => (
            <li key={m.id} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <m.Icon
                size={15}
                strokeWidth={2}
                aria-hidden
                style={{ flexShrink:0, marginTop:2, color:'var(--text-secondary)' }}
              />
              <span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</span>
                {' — '}
                {NARRATIVE_MODE_REF_VOICE_PAIRING[m.id]}
              </span>
            </li>
          ))}
        </ul>
        <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.47 }}>
          Você pode combinar modo e voz livremente até encontrar o tom que mais agrada — não há par obrigatório.
        </p>
      </div>
      <div data-vc-tour="ref-profiles" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => setMaterial({ ...material, refProfileId: null })}
          style={{
            alignSelf: 'flex-start', height: 32, padding: '0 14px', borderRadius: 9999,
            border: `1px solid ${!material.refProfileId ? 'var(--accent)' : 'var(--border)'}`,
            background: !material.refProfileId ? 'var(--accent-surface-strong)' : 'var(--bg-card)',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
            cursor: 'pointer', letterSpacing: '-0.011em',
          }}
        >
          Nenhuma referência fixa
        </button>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
          gap: 8,
        }}>
          {REFERENCE_PROFILES.map((p) => {
            const on = material.refProfileId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setMaterial({ ...material, refProfileId: p.id })}
                title={p.promptBlock.slice(0, 220) + '…'}
                style={{
                  textAlign: 'left', padding: '10px 10px', borderRadius: 11,
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                  background: on ? 'var(--accent-surface)' : 'var(--bg-card)',
                  cursor: 'pointer', transition: 'border-color 0.12s',
                  minHeight: 72,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.011em', lineHeight: 1.25 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.35 }}>
                  {p.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── IMG PARAMS PANEL ─────────────────────────────────────────────────────────
// 4 sliders bipolares (esquerda/direita são extremos opostos). Cada um modula
// uma faceta do prompt de geração de imagem. Os valores são guardados no doc
// (persistem entre re-aberturas) e só viram instrução de prompt fora da faixa
// neutra (35..65) — assim "centro" significa "deixa a IA decidir".
const IMG_AXES = [
  { key:'fidelity',    Icon: Target,   label:'Fidelidade ao tema', left:'Metafórico', right:'Literal',     hint:'Quão direto a imagem retrata o assunto' },
  { key:'creativity',  Icon: Sparkles, label:'Criatividade',       left:'Convencional', right:'Inusitado',  hint:'Composições clássicas vs inesperadas' },
  { key:'irreverence', Icon: Flame,    label:'Irreverência',       left:'Sério',     right:'Cheeky',        hint:'Tom contemplativo vs bem-humorado' },
  { key:'objectivity', Icon: Camera,   label:'Objetividade',       left:'Atmosférico', right:'Documental',  hint:'Atmosfera/emoção vs ação/fato' },
];
function ImgParamsPanel({ value, onChange }) {
  const reset = () => IMG_AXES.forEach(a => onChange(a.key, 50));
  return (
    <div>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:10,
      }}>
        <label style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em' }}>
          Direção da imagem
        </label>
        <button
          type="button"
          onClick={reset}
          style={{
            fontSize:11, padding:'3px 9px', borderRadius:99, cursor:'pointer',
            background:'transparent', border:'1px solid var(--border)',
            color:'var(--text-muted)', fontFamily:'var(--font-ui)',
          }}
          title="Voltar tudo ao centro (sem instruções específicas)"
        >Resetar</button>
      </div>
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:11, padding:12, display:'flex', flexDirection:'column', gap:14,
      }}>
        {IMG_AXES.map(axis => {
          const v = value[axis.key] ?? 50;
          const isCenter = v >= 35 && v <= 65;
          // Cor do eixo: muted se centro, accent se foi puxado pra um lado
          const dot = isCenter ? 'var(--text-muted)' : 'var(--accent)';
          return (
            <div key={axis.key}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom:6, gap:8,
              }}>
                <span style={{
                  fontSize:12, fontWeight:600, color:'var(--text-secondary)',
                  letterSpacing:'-0.011em', display:'flex', alignItems:'center', gap:8,
                }}>
                  <axis.Icon size={16} strokeWidth={2} aria-hidden style={{ flexShrink:0, color:'var(--text-secondary)' }} />
                  {axis.label}
                </span>
                <span style={{
                  fontSize:10, color: isCenter ? 'var(--text-muted)' : dot,
                  fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                  fontWeight:700,
                }}>
                  {isCenter ? 'AUTO' : v}
                </span>
              </div>
              <input
                type="range"
                min={0} max={100} step={5} value={v}
                onChange={e => onChange(axis.key, parseInt(e.target.value, 10))}
                style={{ '--pct': `${v}%` }}
                aria-label={`${axis.label}: ${axis.left} a ${axis.right}`}
              />
              <div style={{
                display:'flex', justifyContent:'space-between',
                marginTop:4, fontSize:9.5, color:'var(--text-muted)',
                fontFamily:'var(--font-mono)', letterSpacing:'0.06em', textTransform:'uppercase',
              }}>
                <span style={{ color: v <= 25 ? 'var(--text-secondary)' : undefined }}>{axis.left}</span>
                <span style={{ color: v >= 75 ? 'var(--text-secondary)' : undefined }}>{axis.right}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop:6, fontSize:10, color:'var(--text-muted)',
        fontFamily:'var(--font-ui)', lineHeight:1.5,
      }}>
        Valores no centro (AUTO) deixam a IA livre. Puxe para um lado quando quiser direção forte.
      </div>
    </div>
  );
}

export {
  NARRATIVE_MODE_REF_VOICE_PAIRING,
  ModePicker,
  ReferenceProfilesCuradoria,
  IMG_AXES,
  ImgParamsPanel,
};
