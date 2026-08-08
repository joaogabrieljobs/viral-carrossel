// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, X, Zap, ChevronRight, Instagram } from 'lucide-react';
import { buildBrandBlock, buildNarrativeModeReminder, buildHookVariationRules } from '../../utils/generation-prompts.js';
import { callAI } from '../../utils/ai-client.js';
import { resolveMaterialPromptParts } from '../../utils/generation-prompts.js';

function HookVariationsModal({
  open,
  onClose,
  onPick,
  slide,
  niche,
  openaiKey,
  brand,
  material,
  narrativeMode = 'editorial',
  creativePreset = 'livre',
}) {
  const [busy, setBusy] = useState(false);
  const [hooks, setHooks] = useState([]);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    setBusy(true); setErr(''); setHooks([]);
    try {
      const brandBlock = buildBrandBlock(brand);
      const { materialBlock, materialPriorityBlock } = await resolveMaterialPromptParts(material);
      const r = await callAI(
        `Atue como copywriter sênior. Gere 5 variações de gancho (slide 1 de carrossel Instagram) com base no contexto abaixo.

${buildNarrativeModeReminder(narrativeMode)}
${brandBlock}${materialBlock}${materialPriorityBlock}
Tema atual: "${slide?.title || ''}"
Contexto: "${slide?.subtitle || ''}"
${niche ? `Nicho: ${niche}` : ''}

REGRAS:
${buildHookVariationRules(narrativeMode, creativePreset)}
- Se houver MATÉRIA-PRIMA, FONTES & REFERÊNCIAS ou INSTRUÇÕES acima, os ganchos devem estar alinhados a esse material (não genéricos).

Retorne APENAS JSON: {"hooks":[{"title":"...","subtitle":"frase curta de 1 linha que justifica o gancho"}]}`,
        { json: true, openaiKey }
      );
      setHooks(r.hooks || []);
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  }, [
    slide?.title,
    slide?.subtitle,
    niche,
    openaiKey,
    narrativeMode,
    creativePreset,
    brand,
    material,
  ]);

  useEffect(() => { if (open) run(); }, [open, run]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Zap size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Variações de gancho</div>
              <div className="vc-eyebrow">5 alternativas · escolha a melhor</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:10 }}>
          {busy && (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <Loader2 size={22} style={{ animation:'spin 0.8s linear infinite', color:'var(--accent)' }}/>
              <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:10 }}>Gerando variações…</p>
            </div>
          )}
          {err && (
            <div style={{ fontSize:13, color:'#c5251c', background:'rgba(255,59,48,0.10)', border:'1px solid rgba(255,59,48,0.22)', borderRadius:11, padding:'10px 14px', letterSpacing:'-0.011em' }}>{err}</div>
          )}
          {!busy && hooks.map((h, i) => (
            <button
              key={i}
              onClick={()=>{ onPick(h); onClose(); }}
              className="idea-card"
              style={{ display:'flex', alignItems:'flex-start', gap:10 }}
            >
              <span style={{ fontSize:13, color:'var(--accent)', fontWeight:600, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.011em', marginTop:1, width:22, flexShrink:0 }}>
                {String(i+1).padStart(2,'0')}
              </span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)', lineHeight:1.29, letterSpacing:'-0.014em' }}>{h.title}</div>
                {h.subtitle && (
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', marginTop:4, lineHeight:1.4 }}>{h.subtitle}</div>
                )}
              </div>
              <ChevronRight size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:3 }}/>
            </button>
          ))}
          {!busy && hooks.length > 0 && (
            <button onClick={run} className="vc-btn vc-btn-ghost" style={{ width:'100%', height:36, marginTop:4 }}>
              <RefreshCw size={11}/>Gerar outras 5
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  HookVariationsModal,
};
