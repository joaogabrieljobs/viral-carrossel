// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState } from 'react';
import { Search, Copy, Loader2, TrendingUp, X, Zap, Flame, Lightbulb } from 'lucide-react';
import { buildResearchUserPrompt, normalizeResearchResult, researchIdeaMaterial } from '../../utils/research-prompts.js';
import { callAI, callAIwithSearch } from '../../utils/ai-client.js';

const PRESET_NICHES = [
  'Marketing digital','Empreendedorismo','Finanças pessoais','Saúde mental',
  'Fitness','Nutrição','Tecnologia','IA & produtividade','Design',
  'Carreira','Investimentos','Relacionamentos','Medicina estética','Direito',
];

function ResearchPanel({ open, onClose, onUseIdea, onSetNiche, narrativeMode = 'editorial', creativePreset = 'livre', contentObjective = 'auto', openaiKey = '' }) {
  const [niche, setNiche] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [degraded, setDegraded] = useState(false);

  if (!open) return null;

  const researchPrompt = hasWeb => buildResearchUserPrompt({ niche, narrativeMode, creativePreset, contentObjective, hasWeb });

  const run = async () => {
    if (!niche.trim()) { setErr('Informe o nicho'); return; }
    setBusy(true); setErr(''); setData(null); setDegraded(false);
    try {
      const r = await callAIwithSearch(researchPrompt(true), { json: true });
      setData(normalizeResearchResult(r, true));
      onSetNiche?.(niche);
    } catch (e1) {
      setDegraded(true);
      try {
        const r = await callAI(
          researchPrompt(false),
          { json: true, openaiKey },
        );
        setData(normalizeResearchResult(r, false));
        setDegraded(true);
        onSetNiche?.(niche);
      } catch (e2) {
        setErr(e2.message || e1.message || String(e2));
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:'linear-gradient(135deg, #f59e0b, #d97706)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <TrendingUp size={14} color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Pesquisa de nicho</div>
              <div className="vc-eyebrow">Ideias e referências para seu conteúdo</div>
            </div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {/* Search bar */}
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={niche} onChange={e=>setNiche(e.target.value)}
              placeholder="Nicho ou tema (ex: nutrição, vendas B2B, saúde mental…)"
              className="vc-input" style={{ flex:1 }}
              onKeyDown={e=>{if(e.key==='Enter')run();}}
            />
            <button onClick={run} disabled={busy||!niche.trim()} className="vc-btn vc-btn-primary" aria-label="Pesquisar"
              style={{ padding:'0 16px', height:40, opacity:(busy||!niche.trim())?0.5:1 }}
            >
              {busy ? <Loader2 size={14} style={{animation:'spin 0.8s linear infinite'}}/> : <Search size={14}/>}
            </button>
          </div>

          {/* Preset niches */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {PRESET_NICHES.map(n=>(
              <button key={n} onClick={()=>setNiche(n)} style={{
                fontSize:11, padding:'4px 10px', borderRadius:99, cursor:'pointer',
                fontFamily:'var(--font-ui)', fontWeight:500,
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', transition:'all 0.12s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
              onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
              >{n}</button>
            ))}
          </div>

          {err && (
            <div style={{ fontSize:13, color:'#c5251c', background:'rgba(255,59,48,0.10)', border:'1px solid rgba(255,59,48,0.22)', borderRadius:11, padding:'10px 14px', letterSpacing:'-0.011em' }}>{err}</div>
          )}

          {degraded && !err && (
            <div style={{
              fontSize:12, color:'var(--text-secondary)', background:'var(--bg-pearl)', border:'1px solid var(--hairline)',
              borderRadius:11, padding:'10px 14px', letterSpacing:'-0.011em', lineHeight:1.45, fontFamily:'var(--font-ui)',
            }}>
              Sem pesquisa web ao vivo nesta sessão. As sugestões são hipóteses editoriais para validar, não notícias atuais.
            </div>
          )}

          {busy && (
            <div style={{ textAlign:'center', padding:'32px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
              <div style={{ position:'relative', width:40, height:40 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', border:'2px solid var(--border)', borderTopColor:'var(--accent-amber)', animation:'spin 1s linear infinite' }}/>
              </div>
              <p style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-ui)' }}>{degraded ? 'Explorando ideias para o tema…' : 'Pesquisando fatos e referências…'}</p>
            </div>
          )}

          {data && !busy && (
            <div style={{ display:'flex', flexDirection:'column', gap:20, animation:'fadeUp 0.2s' }}>
              {data.warning && (
                <div style={{ fontSize:12, color:'#fcd34d', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, padding:'10px 14px', display:'flex', gap:8 }}>
                  <Flame size={13} style={{flexShrink:0, marginTop:1, color:'#f59e0b'}}/>{data.warning}
                </div>
              )}

              {data.carousel_ideas?.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                    <Lightbulb size={12} style={{color:'var(--accent-amber)'}}/>Ideias prontas — clique para usar
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {data.carousel_ideas.map((idea,i)=>(
                      <button key={i} className="idea-card" onClick={()=>onUseIdea(idea.title+(idea.angle?'. '+idea.angle:''), researchIdeaMaterial(idea, data.trending_topics))}>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', lineHeight:1.29, marginBottom:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.014em' }}>{idea.title}</div>
                        <div style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.4, fontFamily:'var(--font-ui)' }}>{idea.angle}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>{idea.sourceIndexes.length ? 'Com referências da pesquisa' : 'Hipótese para validar'}</div>
                        <div style={{ marginTop:10, fontSize:13, color:'var(--accent)', fontWeight:600, letterSpacing:'-0.011em' }}>Usar  →</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {data.viral_hooks?.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                    <Zap size={12} style={{color:'var(--accent)'}}/>Ganchos virais
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {data.viral_hooks.map((h,i)=>(
                      <div key={i} className="hook-row">
                        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:1, width:16, flexShrink:0 }}>{String(i+1).padStart(2,'0')}</span>
                        <span style={{ flex:1, fontSize:12, color:'var(--text-secondary)', lineHeight:1.5, fontFamily:'var(--font-ui)' }}>{h}</span>
                        <button onClick={()=>navigator.clipboard?.writeText(h)} aria-label="Copiar gancho" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:8, borderRadius:6, transition:'color 0.12s, background 0.12s', flexShrink:0, minWidth:32, minHeight:32, display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                          onMouseEnter={e=>{ e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='rgba(0,0,0,0.04)'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='none'; }}
                        ><Copy size={11}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.trending_topics?.length > 0 && (
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:10, display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                    <TrendingUp size={12} style={{color:'var(--accent-amber)'}}/>{degraded ? 'Assuntos para explorar' : 'Assuntos e fontes'}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {data.trending_topics.map((t,i)=>(
                      <div key={i} style={{ background:'var(--bg-card)', borderRadius:8, padding:'10px 12px' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-ui)' }}>{t.topic}</div>
                        <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:3, lineHeight:1.4, fontFamily:'var(--font-ui)' }}>{t.why}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
                          {t.sources.length ? 'Fontes indicadas pela pesquisa:' : 'Hipótese — sem fonte datada.'}
                          {t.eventDate && <span> Evento: {t.eventDate}.</span>}
                          {t.sources.map(source => (
                            <div key={source.url}>
                              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a> · {source.publishedAt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  PRESET_NICHES,
  ResearchPanel,
};
