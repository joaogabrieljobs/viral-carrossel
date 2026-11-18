import React, { useEffect, useState } from 'react';
import { getPresentationPath } from '../utils/presentation.js';
import { normalizePresentationBlocks } from '../utils/presentation-quality.js';
// A prévia mostra o texto como o leitor vai ver: os marcadores de destaque
// (**trecho**, _itálico_) são formatação do card, não texto literal.
import { visibleSocialText } from '../utils/social-generation.js';

function PreviewEvidence({ blocks }) {
  const block = normalizePresentationBlocks(blocks)[0];
  if (!block) return null;
  return <div className="vc-create-preview-evidence">
    {block.type === 'comparison' ? <div className="vc-create-preview-table"><table aria-label="Comparação do slide">
      <thead><tr>{block.headers.map((header, index) => <th key={index} scope="col">{header}</th>)}</tr></thead>
      <tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody>
    </table></div> : block.type === 'metrics' ? <dl aria-label="Indicadores do slide">
      {block.items.map((item, index) => <div key={index}><dt>{item.label}</dt><dd><strong>{item.value}</strong>{item.detail && <span>{item.detail}</span>}</dd></div>)}
    </dl> : <ol aria-label="Etapas do slide">
      {block.items.map((item, index) => <li key={index}><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}</li>)}
    </ol>}
  </div>;
}

/** A route is a suggested argument, not a fixed page-by-page template. */
export function PresentationStructureSummary({ presentationPath = 'auto', count }) {
  const route = getPresentationPath(presentationPath);
  return <details className="vc-create-structure">
    <summary>Estrutura sugerida · {route.shortLabel || route.label}</summary>
    <p>Esta sequência será adaptada ao seu material{Number(count) > 0 ? ` e aos ${count} slides` : ''}. Etapas podem ser combinadas; informações ausentes não serão inventadas.</p>
    <ol>{route.stages.map((stage, index) => <li key={`${stage.label}-${index}`}><strong>{stage.label}</strong><span>{stage.instruction}</span></li>)}</ol>
  </details>;
}

/** Read-only progress: draft text never becomes an editor document here. */
export default function GenerationPreview({ active, startedAt, progress, slides = [], phase = 'draft', isPresentation = false, plan = null, completedCount, totalCount }) {
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
  const writing = phase === 'writing';
  const draft = ['draft', 'writing', 'reviewing'].includes(phase);
  const planSlides = Array.isArray(plan?.slides) ? plan.slides : [];
  const total = Math.max(slides.length, Number(totalCount) || planSlides.length || slides.length);
  const completed = Math.min(slides.length, Number(completedCount) || slides.length);
  const partial = completed < total;
  const heading = writing && active ? 'Rascunho — criando os slides' : draft
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
    {isPresentation && planSlides.length > 0 && <details className="vc-create-structure vc-create-plan" open={!slides.length || undefined}>
      <summary>Roteiro organizado · {planSlides.length} slides</summary>
      <p>{plan.thesis || 'A sequência está organizada. Agora o Moont transforma cada parte em um slide.'}</p>
      <ol aria-label="Estrutura da apresentação">
        {planSlides.map((slide, index) => <li key={slide.index || index}>
          <strong>Slide {String(index + 1).padStart(2, '0')} · {slide.question}</strong>
          <span>{slide.keyMessage}</span>
        </li>)}
      </ol>
      <p className="vc-create-note">Este é o roteiro de trabalho. O texto final aparece abaixo conforme os slides ficam prontos e ainda passa por revisão.</p>
    </details>}
    {slides.length ? <>
      <div className="vc-create-preview-heading">
        <h2>{heading}</h2>
        {isPresentation && total > 0 && <p className="vc-create-preview-count" role="status" aria-live="polite">Slides preparados: {completed} de {total}</p>}
        <p className="vc-create-note">{partial
          ? active
            ? 'Os slides prontos aparecem aqui enquanto os próximos são escritos. Esta prévia é somente para acompanhar; o texto e a composição ainda serão revisados.'
            : 'A geração parou antes de completar a apresentação. Esta prévia está incompleta; confira os slides disponíveis antes de continuar.'
          : draft
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
            <h3>{visibleSocialText(slide.title) || 'Título em revisão'}</h3>
            {slide.subtitle && <p>{visibleSocialText(slide.subtitle)}</p>}
            {slide.bodyAfterImage && <p>{visibleSocialText(slide.bodyAfterImage)}</p>}
            {isPresentation && <PreviewEvidence blocks={slide.presentationBlocks}/>}
            {isPresentation && slide.speakerNotes && <details className="vc-create-preview-notes"><summary>Notas de apoio</summary><p>{slide.speakerNotes}</p></details>}
          </div>
        </article>)}
      </div>
    </> : active && <p className="vc-create-note">{isPresentation
      ? planSlides.length ? 'Escrevendo os primeiros slides a partir deste roteiro. Eles aparecerão aqui conforme ficarem prontos.' : 'Organizando o material e conferindo as fontes. O roteiro aparecerá aqui antes dos primeiros slides.'
      : `O texto é preparado como uma sequência. Assim que a primeira versão chegar, os ${items} aparecerão aqui durante a revisão.`}</p>}
  </section>;
}
