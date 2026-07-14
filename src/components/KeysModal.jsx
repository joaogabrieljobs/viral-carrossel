import { useState, useEffect } from 'react';
import { Settings, X, Lock } from 'lucide-react';
import { getServerStatus } from '../utils/server-status.js';

export default function KeysModal({
  open, onClose, openaiKey, onSave, onRefreshStatus,
  openaiKeyPersist, onChangePersist, claudeModel, onChangeClaudeModel,
  anthropicKey, onSaveAnthropic, anthropicKeyPersist, onChangeAnthropicPersist,
}) {
  const [val, setVal] = useState(openaiKey || '');
  const [persist, setPersist] = useState(!!openaiKeyPersist);
  const [model, setModel] = useState(claudeModel || 'sonnet');
  const [anthropicVal, setAnthropicVal] = useState(anthropicKey || '');
  const [anthropicPersistVal, setAnthropicPersistVal] = useState(!!anthropicKeyPersist);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (open) {
      setVal(openaiKey || '');
      setPersist(!!openaiKeyPersist);
      setModel(claudeModel || 'sonnet');
      setAnthropicVal(anthropicKey || '');
      setAnthropicPersistVal(!!anthropicKeyPersist);
      getServerStatus({ force: true }).then(s => {
        setStatus(s);
        onRefreshStatus?.(s);
      });
    }
  }, [open, openaiKey, openaiKeyPersist, claudeModel, anthropicKey, anthropicKeyPersist, onRefreshStatus]);
  if (!open) return null;
  const save = () => {
    onSave(val.trim());
    onChangePersist?.(persist);
    onChangeClaudeModel?.(model);
    onSaveAnthropic?.(anthropicVal.trim());
    onChangeAnthropicPersist?.(anthropicPersistVal);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e=>e.stopPropagation()} style={{ maxWidth:420 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)',
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'1px solid var(--border)',
            }}>
              <Settings size={14} color="var(--text-secondary)"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.022em' }}>Chaves de API</div>
              <div className="vc-eyebrow">Conecte suas chaves de IA</div>
            </div>
          </div>
          <button onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:18 }}>
          {/* Intro — explica o quê, por quê, como obter */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.018em', marginBottom:4 }}>
                Conecte uma chave pra começar
              </div>
              <div style={{ fontSize:12, lineHeight:1.5, color:'var(--text-muted)', fontFamily:'var(--font-ui)', letterSpacing:'-0.011em' }}>
                A IA escreve o copy dos cards e gera as fotos. Você só precisa de uma chave — duas dão o melhor resultado.
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {/* OpenAI — recomendado (border accent) */}
              <div style={{
                position:'relative',
                border:'1.5px solid var(--accent)',
                background:'var(--success-surface)',
                borderRadius:11, padding:'12px 12px 14px',
                display:'flex', flexDirection:'column', gap:6,
              }}>
                <div style={{
                  position:'absolute', top:-9, left:10,
                  fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
                  background:'var(--accent)', color:'#fff',
                  padding:'3px 8px', borderRadius:9999, fontFamily:'var(--font-ui)',
                }}>Recomendado</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.014em' }}>OpenAI</span>
                  <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.02em' }}>GPT-4o · DALL·E</span>
                </div>
                <div style={{ fontSize:11, lineHeight:1.5, color:'var(--text-secondary)', fontFamily:'var(--font-ui)' }}>
                  Texto <strong>e</strong> imagens numa chave só. Mais simples pra começar.
                </div>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                   style={{ marginTop:'auto', fontSize:11, color:'var(--accent)', fontFamily:'var(--font-mono)', textDecoration:'none', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
                   onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                   onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
                  Obter chave →
                </a>
              </div>

              {/* Anthropic — opcional */}
              <div style={{
                border:'1px solid var(--border)',
                background:'var(--bg-card)',
                borderRadius:11, padding:'12px 12px 14px',
                display:'flex', flexDirection:'column', gap:6,
              }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.014em' }}>Anthropic</span>
                  <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.02em' }}>Claude · web search</span>
                </div>
                <div style={{ fontSize:11, lineHeight:1.5, color:'var(--text-secondary)', fontFamily:'var(--font-ui)' }}>
                  Copy mais editorial e profundo. Com OpenAI junto = melhor combo.
                </div>
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                   style={{ marginTop:'auto', fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-mono)', textDecoration:'none', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}
                   onMouseEnter={e=>{ e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.textDecoration='underline'; }}
                   onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.textDecoration='none'; }}>
                  Obter chave →
                </a>
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5, padding:'8px 2px 0' }}>
              <Lock size={11} aria-hidden style={{ marginTop:1, flexShrink:0 }}/>
              <span>
                As chaves ficam <strong style={{ color:'var(--text-secondary)' }}>só no seu navegador</strong>. Custos vão direto pra sua conta da Anthropic/OpenAI — você controla o uso.
              </span>
            </div>
          </div>

          <div>
            <label className="vc-label">
              Anthropic API Key — Claude (texto + web search)
            </label>
            <input
              type="password"
              value={anthropicVal}
              onChange={e=>setAnthropicVal(e.target.value)}
              placeholder="sk-ant-..."
              className="vc-input"
              onKeyDown={e=>e.key==='Enter'&&save()}
            />
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:8, lineHeight:1.5 }}>
              Obtenha em{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                 style={{ color:'var(--accent)', fontFamily:'var(--font-mono)', textDecoration:'none' }}
                 onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                 onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
                console.anthropic.com/settings/keys
              </a>
              . A chave fica salva apenas no seu navegador.
            </div>
            <label style={{
              display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12,
              color:'var(--text-secondary)', fontFamily:'var(--font-ui)', cursor:'pointer',
              userSelect:'none',
            }}>
              <input
                type="checkbox"
                checked={anthropicPersistVal}
                onChange={(e) => setAnthropicPersistVal(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:14, height:14 }}
              />
              <span>Manter chave Anthropic salva entre sessões (localStorage)</span>
            </label>
          </div>

          <div>
            <label className="vc-label">
              OpenAI API Key — gpt-4o + GPT Image 2
            </label>
            <input
              type="password"
              value={val}
              onChange={e=>setVal(e.target.value)}
              placeholder="sk-proj-..."
              className="vc-input"
              onKeyDown={e=>e.key==='Enter'&&save()}
            />
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:8, lineHeight:1.5 }}>
              Obtenha em{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                 style={{ color:'var(--accent)', fontFamily:'var(--font-mono)', textDecoration:'none' }}
                 onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                 onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
                platform.openai.com/api-keys
              </a>
              {!anthropicVal && (
                <> Sem chave Anthropic, esta também é usada para gerar texto (GPT-4o).</>
              )}
            </div>
            <label style={{
              display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12,
              color:'var(--text-secondary)', fontFamily:'var(--font-ui)', cursor:'pointer',
              userSelect:'none',
            }}>
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:14, height:14 }}
              />
              <span>Manter chave salva entre sessões (localStorage)</span>
            </label>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-ui)', marginTop:4, lineHeight:1.5, marginLeft:22 }}>
              {persist
                ? 'A chave fica no localStorage e sobrevive ao fechar a aba — mais conveniente, menos seguro.'
                : 'A chave fica só nesta sessão e some quando fechar a aba — mais seguro contra scripts maliciosos.'}
            </div>
          </div>

          {/* Selector de modelo Claude — sempre visível */}
          <div>
            <label className="vc-label">Modelo Claude (geração de texto)</label>
              <div style={{ display:'flex', gap:8 }}>
                {[
                  { id:'sonnet', label:'Sonnet 4.6', desc:'Rápido + barato' },
                  { id:'opus',   label:'Opus 4.7',   desc:'Máxima qualidade' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setModel(opt.id)}
                    style={{
                      flex:1, padding:'10px 12px', borderRadius:8, cursor:'pointer',
                      border: model === opt.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: model === opt.id ? 'var(--success-surface)' : 'transparent',
                      color: model === opt.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize:12, fontFamily:'var(--font-ui)', textAlign:'left',
                      display:'flex', flexDirection:'column', gap:2,
                    }}
                  >
                    <span style={{ fontWeight:600 }}>{opt.label}</span>
                    <span style={{ fontSize:10, color:'var(--text-muted)' }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          {/* Status compacto das duas chaves — visual claro do que está ativado */}
          {(() => {
            const anthropicOK = !!(anthropicVal && anthropicVal.trim().startsWith('sk-ant-'));
            const openaiOK = !!(val && val.trim().startsWith('sk-'));
            if (!anthropicOK && !openaiOK) return null;
            const Row = ({ ok, label, detail }) => (
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontFamily:'var(--font-ui)' }}>
                <span style={{
                  width:8, height:8, borderRadius:'50%',
                  background: ok ? '#30b352' : 'var(--text-muted)',
                  flexShrink:0,
                }}/>
                <span style={{ color: ok ? 'var(--success-text)' : 'var(--text-muted)', fontWeight:600 }}>{label}</span>
                <span style={{ color:'var(--text-muted)', fontSize:11 }}>{detail}</span>
              </div>
            );
            return (
              <div style={{
                background:'var(--success-surface)',
                border:'1px solid var(--success-border)',
                borderRadius:8, padding:'10px 12px',
                display:'flex', flexDirection:'column', gap:6,
              }}>
                <Row ok={anthropicOK} label="Claude" detail={anthropicOK ? '— texto + web search ativos' : '— não configurado, GPT-4o vai gerar texto'} />
                <Row ok={openaiOK} label="OpenAI" detail={openaiOK ? '— imagens (DALL·E) ativas' : '— sem geração automática de imagens'} />
              </div>
            );
          })()}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="vc-btn vc-btn-ghost" style={{ height:40, padding:'0 16px' }}>Cancelar</button>
            <button onClick={save} style={{
              flex:1, height:40, borderRadius:8, border:'none', cursor:'pointer',
              background:'var(--text-primary)', color:'var(--bg-base)',
              fontSize:13, fontWeight:700, fontFamily:'var(--font-ui)',
            }}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
