import React, { useState } from 'react';
import { ArrowRight, BookOpen, Check, Image, Layers, Palette, Square, Wand2 } from 'lucide-react';

const FEATURES = [
  { icon: BookOpen, title: 'Um contexto para cada projeto', body: 'Guarde o brief, o estilo visual e até quatro referências. O aviso Contexto ON mostra qual direção está em uso.' },
  { icon: Layers, title: 'Você escolhe o que gerar', body: 'Só texto ou texto e imagens. Escolha um dos oito modos narrativos ou Nenhum, para seguir o seu pedido sem fórmula predefinida.' },
  { icon: Wand2, title: 'Outro tom, a mesma identidade', body: 'Refaça em oito tons. No remix só de texto, imagens, fontes, cores e composição continuam como estão.' },
  { icon: Palette, title: 'Sua logo, no card que você escolher', body: 'Importe um PNG transparente uma vez. Reutilize a logo salva no projeto e ajuste tamanho e posição em cada card.' },
  { icon: Square, title: 'Pode parar quando precisar', body: 'O botão Cancelar geração continua disponível ao trocar de aba. O que já ficou pronto é mantido.' },
];

/** Demonstração local: não chama IA, não altera projetos e não consome créditos. */
export default function ProjectWorkflowShowcase({ onEnter, isMobile }) {
  const [scope, setScope] = useState('text');
  const [selected, setSelected] = useState(0);
  const [logos, setLogos] = useState([]);
  return (
    <section id="contexto-projeto" aria-labelledby="project-workflow-title" style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: isMobile ? '24px 16px 48px' : '40px clamp(24px, 5vw, 48px) 64px' }}>
      <p style={{ margin: '0 0 10px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Mais contexto. Mais controle.</p>
      <h2 id="project-workflow-title" style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: isMobile ? 28 : 40, lineHeight: 1.12, letterSpacing: '-0.028em' }}>
        Seu projeto tem uma identidade.<br /><span style={{ color: 'var(--accent)' }}>A criação parte dela.</span>
      </h2>
      <p style={{ margin: '0 0 32px', maxWidth: '60ch', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Traga o que a IA precisa saber sobre a sua marca. Depois, decida o que gerar, o que manter e onde aplicar sua assinatura.</p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 28 : 40, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 22 }}>
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} style={{ display: 'flex', gap: 14 }}>
              <Icon size={20} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
              <div><h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{title}</h3><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</p></div>
            </div>
          ))}
        </div>
        <div aria-label="Demonstração do projeto" style={{ minWidth: 0, padding: isMobile ? 16 : 24, border: '1px solid var(--glass-border-strong)', borderRadius: 20, background: 'linear-gradient(145deg, rgba(255,45,141,0.1), var(--bg-secondary) 55%)' }}>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: 'var(--text-muted)' }}>PRÉVIA ILUSTRATIVA · SEM CONSUMO DE CRÉDITOS</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 10, background: 'var(--accent-surface)', fontSize: 13, marginBottom: 18 }}><BookOpen size={16} aria-hidden="true" /><strong>Sua marca — Contexto ON</strong></div>
          <fieldset style={{ padding: 0, border: 0, margin: '0 0 16px', minWidth: 0 }}>
            <legend style={{ fontSize: 13, marginBottom: 8 }}>Experimente as opções</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['text', 'Só texto'], ['images', 'Texto e imagens']].map(([value, label]) => (
                <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 8px', minHeight: 44, fontSize: 12, borderRadius: 10, border: `1px solid ${scope === value ? 'var(--accent)' : 'var(--hairline)'}`, background: scope === value ? 'var(--accent-surface)' : 'var(--bg-primary)', cursor: 'pointer' }}>
                  <input type="radio" name="landing-demo-scope" value={value} checked={scope === value} onChange={() => setScope(value)} style={{ accentColor: 'var(--accent)' }} />{label}
                </label>
              ))}
            </div>
          </fieldset>
          <p role="status" style={{ minHeight: 40, margin: '0 0 12px', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{scope === 'text' ? 'O texto ganha forma. Você pode adicionar as imagens depois.' : 'Texto e direção visual juntos. No studio, gerar imagens usa o saldo do plano ou a sua chave.'}</p>
          <div role="group" aria-label="Cards da demonstração" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {['Uma ideia.', 'Uma direção.', 'Sua assinatura.'].map((title, index) => (
              <button key={title} type="button" aria-label={`Selecionar card ${index + 1} da demonstração`} aria-pressed={selected === index} onClick={() => setSelected(index)} style={{ position: 'relative', aspectRatio: '4 / 5', minWidth: 0, overflow: 'hidden', padding: 10, borderRadius: 10, border: `2px solid ${selected === index ? 'var(--accent)' : 'transparent'}`, background: scope === 'images' ? `linear-gradient(${125 + index * 45}deg, #69204c, #271527 55%, #ad395b)` : '#211c29', color: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                {scope === 'images' && <Image size={24} aria-hidden="true" style={{ position: 'absolute', top: 12, right: 10, opacity: 0.5 }} />}
                <span style={{ display: 'block', position: 'relative', fontSize: isMobile ? 13 : 15, fontWeight: 700, lineHeight: 1.2 }}>{title}</span>
                {logos.includes(index) && <span aria-label={`Logo aplicada no card ${index + 1}`} style={{ position: 'absolute', bottom: 8, left: 8, padding: '3px 5px', border: '1px solid #ffffff70', borderRadius: 4, fontSize: 8, fontWeight: 700 }}>SUA MARCA</span>}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setLogos(prev => prev.includes(selected) ? prev.filter(i => i !== selected) : [...prev, selected])} style={{ width: '100%', minHeight: 44, marginTop: 12, borderRadius: 10, border: '1px solid var(--glass-border-strong)', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '10px 12px', fontSize: 13, cursor: 'pointer' }}>
            {logos.includes(selected) ? 'Remover logo' : 'Aplicar logo salva'} no card {selected + 1}
          </button>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0' }}><Check size={12} aria-hidden="true" />Escolha outro card para reutilizar a mesma logo.</p>
        </div>
      </div>
      <button type="button" className="vc-landing-cta" onClick={onEnter} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 32, minHeight: 48, padding: '12px 24px', border: 0, borderRadius: 'var(--radius-pill)', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Criar com o contexto da minha marca <ArrowRight size={16} aria-hidden="true" /></button>
    </section>
  );
}
