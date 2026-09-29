import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CONTENT_OBJECTIVES, EDITORIAL_STRUCTURES } from '../../utils/editorial-strategy.js';
import { RESULT_METRICS, RESULT_WINDOWS, analyzePublicationResults, collectPublicationResults, createPublicationResult } from '../../utils/publication-results.js';
import { useScrollLock } from '../../hooks/useScrollLock.js';

const today = () => new Date().toISOString().slice(0, 10);
const fieldStyle = { display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-secondary)' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 };

export function PublicationResultsModal({ doc, library, projectId, settings, onSettingsChange, onSave, onRemove, onClose }) {
  const dialog = useRef(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filterObjective, setFilterObjective] = useState(doc.contentObjective === 'auto' ? 'saves' : (doc.contentObjective || 'saves'));
  const [filterNiche, setFilterNiche] = useState(doc.editorialContext?.niche || '');
  const freshForm = () => ({
    account: settings.account || '', postURL: '', publishedAt: '', measuredAt: today(), windowDays: String(settings.windowDays || 7),
    objective: doc.contentObjective || 'auto', structureId: 'unknown', distribution: 'organic',
    niche: doc.editorialContext?.niche || '', metrics: Object.fromEntries(RESULT_METRICS.map(m => [m.id, ''])),
  });
  const [form, setForm] = useState(freshForm);
  useScrollLock(true);
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.focus();
    return () => trigger?.focus?.();
  }, []);
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const records = collectPublicationResults(library);
  const analysis = analyzePublicationResults(library, {
    ...settings, objective: filterObjective, niche: filterNiche, mode: doc.mode || 'editorial', presetId: doc.creativePreset || 'livre',
  });
  const save = e => {
    e.preventDefault(); setError(''); setNotice('');
    try {
      const record = createPublicationResult(form, doc, editing);
      onSave(editing?.projectId || projectId, record);
      setNotice('Resultados salvos. O texto publicado foi preservado.');
      setEditing(null); setForm(freshForm());
    } catch (err) { setError(err.message); }
  };
  const edit = record => {
    setEditing(record); setError(''); setNotice('');
    setForm({ ...record, metrics: Object.fromEntries(RESULT_METRICS.map(m => [m.id, record.metrics?.[m.id] ?? ''])) });
    dialog.current?.querySelector('form')?.scrollIntoView({ block: 'start' });
  };
  const trapKeys = e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button, input, select, a[href], textarea')].filter(el => !el.disabled && el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="publication-results-title"
        className="modal-panel" style={{ maxWidth: 820 }} onClick={e => e.stopPropagation()} onKeyDown={trapKeys}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-sidebar)', zIndex: 1 }}>
          <h2 id="publication-results-title" style={{ fontSize: 20, margin: 0 }}>Resultados das publicações</h2>
          <button type="button" className="vc-icon-btn" aria-label="Fechar resultados" onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 24 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Informe os números que você mediu no Instagram. Os dados ficam neste navegador e nos backups da biblioteca. Excluir o projeto também exclui seus registros locais.</p>
          <section aria-label="Comparação de resultados" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>O que o seu histórico mostra</h3>
            <div style={gridStyle}>
              <label style={fieldStyle}>Conta para comparar e orientar a geração
                <input className="vc-input" value={settings.account || ''} placeholder="@sua.conta" onChange={e => onSettingsChange({ account: e.target.value })}/>
              </label>
              <label style={fieldStyle}>Período de comparação
                <select className="vc-input" value={settings.windowDays || 7} onChange={e => onSettingsChange({ windowDays: Number(e.target.value) })}>
                  {RESULT_WINDOWS.map(days => <option key={days} value={days}>{days} dia{days > 1 ? 's' : ''} após publicar</option>)}
                </select>
              </label>
              <label style={fieldStyle}>Objetivo para comparar
                <select className="vc-input" value={filterObjective} onChange={e => setFilterObjective(e.target.value)}>
                  {CONTENT_OBJECTIVES.filter(o => o.id !== 'auto').map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <label style={fieldStyle}>Nicho para comparar
                <input className="vc-input" value={filterNiche} onChange={e => setFilterNiche(e.target.value)}/>
              </label>
            </div>
            <label style={{ ...fieldStyle, display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={settings.enabled !== false} onChange={e => onSettingsChange({ enabled: e.target.checked })}/>
              Usar histórico nas próximas gerações deste projeto
            </label>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Mesmo nicho, modo e pacote deste projeto; somente orgânicos dos últimos 180 dias. Na geração, vale o objetivo e o nicho escolhidos no briefing. Cada resultado é calculado por mil contas alcançadas.</p>
            {analysis.rows.length > 0 && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', fontSize: 12, textAlign: 'left', borderCollapse: 'collapse' }}>
              <caption style={{ textAlign: 'left', padding: '8px 0' }}>{analysis.metricLabel} por mil contas alcançadas</caption>
              <thead><tr><th scope="col">Estrutura</th><th scope="col">Posts</th><th scope="col">Mediana</th></tr></thead>
              <tbody>{analysis.rows.map(row => <tr key={row.structureId}><th scope="row" style={{ padding: '8px 0' }}>{row.label}</th><td>{row.count}</td><td>{row.rate.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>)}</tbody>
            </table></div>}
            {!analysis.rows.length && <p style={{ fontSize: 13, margin: 0 }}>Ainda não há medições comparáveis para estes filtros.</p>}
            {analysis.preferred && <p style={{ fontSize: 13, margin: 0 }}>Estrutura para considerar no próximo teste: <strong>{analysis.preferred.label}</strong>.</p>}
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{analysis.reason} Estes números não medem, sozinhos, autoridade ou qualidade editorial.</p>
          </section>

          <form onSubmit={save} style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{editing ? 'Atualizar números' : 'Registrar uma publicação'}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{editing ? 'O texto original permanece guardado.' : 'Registre o projeto que corresponde ao post publicado. A cópia do texto atual será guardada junto dos números.'} Campos de métricas vazios significam “não medido”.</p>
            <div style={gridStyle}>
              <label style={fieldStyle}>Conta da publicação
                <input className="vc-input" required disabled={!!editing} value={form.account} onChange={e => change('account', e.target.value)} placeholder="@sua.conta"/>
              </label>
              <label style={fieldStyle}>Link da publicação
                <input className="vc-input" type="url" required disabled={!!editing} value={form.postURL} onChange={e => change('postURL', e.target.value)} placeholder="https://www.instagram.com/p/…"/>
              </label>
              <label style={fieldStyle}>Data da publicação
                <input className="vc-input" type="date" required max={today()} disabled={!!editing} value={form.publishedAt} onChange={e => change('publishedAt', e.target.value)}/>
              </label>
              <label style={fieldStyle}>Data da medição
                <input className="vc-input" type="date" required max={today()} disabled={!!editing} value={form.measuredAt} onChange={e => change('measuredAt', e.target.value)}/>
              </label>
              <label style={fieldStyle}>Período medido
                <select className="vc-input" disabled={!!editing} value={form.windowDays} onChange={e => change('windowDays', e.target.value)}>
                  {RESULT_WINDOWS.map(days => <option key={days} value={days}>{days} dia{days > 1 ? 's' : ''} após publicar</option>)}
                </select>
              </label>
              <label style={fieldStyle}>Distribuição
                <select className="vc-input" value={form.distribution} onChange={e => change('distribution', e.target.value)}>
                  <option value="organic">Orgânica, sem impulsionamento</option><option value="paid">Teve impulsionamento</option>
                </select>
              </label>
              <label style={fieldStyle}>Objetivo da publicação
                <select className="vc-input" required value={form.objective} onChange={e => change('objective', e.target.value)}>
                  <option value="auto" disabled>Escolha o objetivo</option>
                  {CONTENT_OBJECTIVES.filter(o => o.id !== 'auto').map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <label style={fieldStyle}>Estrutura que você publicou
                <select className="vc-input" value={form.structureId} onChange={e => change('structureId', e.target.value)}>
                  <option value="unknown">Não informada (fora da comparação)</option>
                  {EDITORIAL_STRUCTURES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {EDITORIAL_STRUCTURES.find(s => s.id === form.structureId)?.arc}
              </label>
              <label style={fieldStyle}>Nicho da publicação
                <input className="vc-input" value={form.niche} maxLength={200} onChange={e => change('niche', e.target.value)}/>
              </label>
            </div>
            <div style={gridStyle}>{RESULT_METRICS.map(metric => <label key={metric.id} style={fieldStyle}>{metric.label}
              <input className="vc-input" type="number" inputMode="numeric" min="0" step="1" required={metric.id === 'reach'} value={form.metrics[metric.id]} onChange={e => setForm(f => ({ ...f, metrics: { ...f.metrics, [metric.id]: e.target.value } }))}/>
            </label>)}</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Contatos comerciais: informe apenas os atribuídos a este post por você. Não use o total de mensagens da conta.</p>
            {error && <p role="alert" style={{ color: 'var(--accent)', margin: 0 }}>{error}</p>}
            {notice && <p role="status" style={{ margin: 0 }}>{notice}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="vc-btn vc-btn-primary" type="submit">Salvar resultados</button>
              {editing && <button className="vc-btn vc-btn-ghost" type="button" onClick={() => { setEditing(null); setForm(freshForm()); setError(''); }}>Cancelar edição</button>}
            </div>
          </form>

          <section aria-label="Publicações registradas" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Publicações registradas na biblioteca ({records.length})</h3>
            {records.map(record => <article key={`${record.postURL}|${record.windowDays}`} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
              <a href={record.postURL} target="_blank" rel="noreferrer">@{record.account} · {record.publishedAt} · {record.windowDays} dias</a>
              <p style={{ fontSize: 12, margin: '6px 0' }}>{record.projectName} · {record.distribution === 'paid' ? 'Impulsionado' : 'Orgânico'} · {EDITORIAL_STRUCTURES.find(s => s.id === record.structureId)?.label || 'Estrutura não informada'}</p>
              <details style={{ fontSize: 12, marginBottom: 10 }}><summary>Texto registrado na publicação</summary>
                {(record.snapshot?.slides || []).map((s, i) => <p key={i}>{[s.title, s.subtitle, s.bodyAfterImage].filter(Boolean).join('\n')}</p>)}
                <p style={{ whiteSpace: 'pre-wrap' }}>{record.snapshot?.caption}</p>
              </details>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="vc-btn vc-btn-ghost" onClick={() => edit(record)}>Atualizar números</button>
                <button type="button" className="vc-btn vc-btn-ghost" onClick={() => {
                  if (window.confirm('Excluir esta medição do histórico? O projeto e o post no Instagram permanecem.')) {
                    onRemove(record.id);
                    dialog.current?.focus();
                    if (editing?.id === record.id) { setEditing(null); setForm(freshForm()); }
                  }
                }}>Excluir medição</button>
              </div>
            </article>)}
          </section>
        </div>
      </section>
    </div>
  );
}
