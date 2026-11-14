import React, { useEffect, useState } from 'react';

/** Read-only progress: draft text never becomes an editor document here. */
export default function GenerationPreview({ active, startedAt, progress, slides = [], phase = 'draft', isPresentation = false }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);
  const seconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const item = isPresentation ? 'Slide' : 'Card';
  const items = isPresentation ? 'slides' : 'cards';
  const draft = phase === 'draft';
  const heading = draft
    ? (active ? 'Rascunho — em revisão' : 'Rascunho — revisão interrompida')
    : phase === 'needs_attention' || phase === 'unavailable'
      ? 'Rascunho — confira antes de exportar'
      : 'Texto revisado';

  return <section className="vc-create-generation" aria-label="Acompanhamento da geração">
    {active && <>
      <div className="vc-create-generation-status">
        <strong role="status" aria-live="polite">{progress?.label || 'Preparando seu projeto…'}</strong>
        <span className="vc-create-elapsed" aria-live="off">Tempo decorrido: {elapsed}</span>
      </div>
      <div className="vc-create-progressbar" aria-hidden><span style={progress?.total ? {
        width: `${Math.max(8, Math.min(100, (Number(progress.current || 0) / Number(progress.total)) * 100))}%`, animation: 'none',
      } : undefined}/></div>
    </>}
    {slides.length ? <>
      <div className="vc-create-preview-heading">
        <h2>{heading}</h2>
        <p className="vc-create-note">{draft
          ? active
            ? `A primeira versão dos ${items} já está aqui. Estamos conferindo fatos, clareza e tamanho do texto; o conteúdo ainda pode mudar.`
            : 'Esta prévia não foi aplicada ao projeto. Retome a geração para concluir a revisão.'
          : 'Acompanhe o conteúdo abaixo. A composição completa e os ajustes ficam disponíveis no editor.'}</p>
      </div>
      <div className={`vc-create-live-grid ${isPresentation ? 'is-presentation' : ''}`} aria-label={`Prévia dos ${items}`}>
        {slides.map((slide, index) => <article className="vc-create-live-card" key={slide.id || index} aria-label={`${item} ${index + 1}`}>
          {slide.bgImage && <img src={slide.bgImage} alt=""/>}
          <div className="vc-create-live-copy">
            <small>{item} {String(index + 1).padStart(2, '0')}</small>
            <h3>{slide.title || 'Título em revisão'}</h3>
            {slide.subtitle && <p>{slide.subtitle}</p>}
            {slide.bodyAfterImage && <p>{slide.bodyAfterImage}</p>}
          </div>
        </article>)}
      </div>
    </> : active && <p className="vc-create-note">O texto é preparado como uma sequência. Assim que a primeira versão chegar, os {items} aparecerão aqui durante a revisão.</p>}
  </section>;
}
