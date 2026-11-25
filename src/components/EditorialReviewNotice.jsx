import React from 'react';
import { movedToNotesNotice } from '../utils/presentation-render-review.js';

export function presentationInterruptionMessage(reason) {
  switch (reason) {
    case 'subscription_required': return 'O serviço pediu a confirmação da assinatura para continuar. Confira o acesso da sua conta antes de tentar novamente.';
    case 'session_required': return 'A sessão não pôde ser confirmada. Entre novamente na sua conta antes de tentar continuar.';
    case 'provider_key_rejected': return 'O provedor recusou a sua chave. Confira a chave em Configurar IA antes de tentar novamente.';
    case 'text_quota_exhausted': return 'Você atingiu o limite diário de texto incluído no plano. Ele volta à meia-noite; para continuar agora, use sua própria chave em Configurar IA.';
    case 'rate_limited': return 'O serviço limitou novas solicitações. Aguarde um pouco antes de tentar novamente.';
    case 'access_denied': return 'O serviço não autorizou a continuação. Confira o acesso da sua conta.';
    case 'writing_failed': return 'Não foi possível concluir a redação do próximo grupo de slides.';
    default: return '';
  }
}

function issueDescription(issue) {
  if (issue.code === 'presentation_incomplete') {
    const completed = Number(issue.completedCount);
    const total = Number(issue.totalCount);
    return Number.isInteger(completed) && Number.isInteger(total) && total > completed
      ? `${completed} de ${total} slides foram preservados. Faltam ${total - completed}; complete a sequência antes de exportar.`
      : 'a apresentação não foi concluída. Complete os slides que faltam antes de exportar.';
  }
  if (issue.kind === 'missing_title') return 'falta um título.';
  if (issue.kind === 'recovered_title' || issue.code === 'social_title_recovered') return 'título recuperado automaticamente do texto de apoio; confira antes de exportar.';
  if (issue.kind === 'factual') return `informação sem apoio suficiente no briefing${issue.claim ? `: “${issue.claim}”` : '.'}`;
  if (issue.kind === 'repeated_title') return 'o título repete o de outro card ou slide; reescreva com a ideia própria deste.';
  if (issue.kind === 'repeated_content') return 'o texto repete o de outro card com outras palavras; reescreva com a ideia própria deste ou remova o card.';
  if (issue.code === 'repetition_remaining') return 'ainda repete texto de outro depois do reparo automático; reescreva o trecho repetido.';
  if (issue.code === 'repeated_cards_removed') return 'um card repetia outro e foi removido. O projeto ficou com menos cards do que o pedido.';
  if (issue.kind === 'density') return 'texto acima do espaço previsto; reduza mantendo a ideia e as condições.';
  if (issue.code === 'missing_slides_padded') return 'a IA devolveu menos cards do que o pedido. Confira os espaços que ainda precisam de conteúdo.';
  if (issue.code === 'extra_slides_trimmed') return 'a sequência foi ajustada à quantidade pedida. Confira se a mensagem ficou completa.';
  if (issue.kind === 'normalization') return 'o conteúdo precisou de ajuste de estrutura. Confira a sequência e os campos recuperados.';
  return 'confira este ponto do rascunho antes de exportar.';
}

/** MF-11: aviso sobre o material (ex.: Caso sem "antes"), fora do slide e independente da revisão. */
function MaterialNotice({ text, onDismiss }) {
  if (!text) return null;
  return <section className="vc-editor-review-notice" aria-label="Aviso sobre o material">
    <strong>Sobre o material</strong>
    <p>{text}</p>
    {onDismiss && <button type="button" className="vc-btn vc-btn-ghost" onClick={onDismiss}>Entendi</button>}
  </section>;
}

/** FE-12: texto que o reparo de espaço tirou do slide e pôs nas notas (`renderRepairStatus`). */
function MovedToNotesNotice({ quality, slides, onDismiss }) {
  const notice = movedToNotesNotice(quality, slides);
  if (!notice) return null;
  return <section className="vc-editor-review-notice" aria-label="Texto movido para as notas">
    <strong>Texto movido para as notas</strong>
    <p>{notice.message}</p>
    {onDismiss && <button type="button" className="vc-btn vc-btn-ghost" onClick={onDismiss}>Conferi as notas</button>}
  </section>;
}

/**
 * Spec 1.1, entrega 5: o que a auditoria de imagem apontou (slide, regra e o
 * que se vê na imagem). Nada foi trocado: o botão de cada slide pede outra
 * imagem, e quem o recebe pergunta antes com o custo.
 */
function ImageAuditNotice({ findings, slides, isPresentation, onRegenerate, onDismiss }) {
  const positions = new Map((Array.isArray(slides) ? slides : []).map((slide, index) => [slide?.id, index]));
  const items = (Array.isArray(findings) ? findings : [])
    .filter(item => item && positions.has(item.slideId) && item.rule && item.evidence)
    .map(item => ({ ...item, number: positions.get(item.slideId) + 1 }));
  if (!items.length) return null;
  const label = isPresentation ? 'Slide' : 'Card';
  return <section className="vc-editor-review-notice" aria-label="Imagens para conferir">
    <strong>Imagens para conferir</strong>
    <p>A conferência das imagens achou {items.length === 1 ? 'uma imagem que não segue' : 'imagens que não seguem'} o briefing. Nada foi trocado. Se quiser outra imagem, o app mostra o custo antes de gerar.</p>
    <ul>{items.map(item => <li key={`${item.slideId}-${item.ruleId}`}>
      <strong>{label} {item.number}: </strong>
      regra “{item.rule}”. Na imagem: {item.evidence}
      {onRegenerate && <> <button type="button" className="vc-btn vc-btn-ghost" aria-label={`Gerar outra imagem do ${label.toLowerCase()} ${item.number}`} onClick={() => onRegenerate(item)}>Gerar outra imagem</button></>}
    </li>)}</ul>
    {onDismiss && <button type="button" className="vc-btn vc-btn-ghost" onClick={onDismiss}>Conferi as imagens</button>}
  </section>;
}

export default function EditorialReviewNotice({ materialNotice = '', onDismissMaterialNotice, presentationQuality = null, slides = [], onDismissMovedToNotes,
  imageAuditFindings = [], onRegenerateAuditImage, onDismissImageAudit, ...props }) {
  const material = <MaterialNotice text={materialNotice} onDismiss={onDismissMaterialNotice} />;
  const moved = <MovedToNotesNotice quality={presentationQuality} slides={slides} onDismiss={onDismissMovedToNotes} />;
  const imageAudit = <ImageAuditNotice findings={imageAuditFindings} slides={slides} isPresentation={props.isPresentation}
    onRegenerate={onRegenerateAuditImage} onDismiss={onDismissImageAudit} />;
  const review = <ReviewNotice {...props} />;
  return materialNotice || presentationQuality || imageAuditFindings?.length ? <>{material}{moved}{imageAudit}{review}</> : review;
}

function ReviewNotice({ status, issues = [], isPresentation = false, onReviewed }) {
  const items = Array.isArray(issues) ? issues : [];
  // Teste 4 (25/11): repetição que sobrou depois do reparo aparece aqui sem
  // transformar o deck em rascunho (o status da revisão não muda).
  const onlyRepetition = !['needs_attention', 'unavailable'].includes(status);
  if (onlyRepetition && (status === 'reviewed_by_user' || !items.some(issue => issue.code === 'repetition_remaining'))) return null;
  const incomplete = items.find(issue => issue.code === 'presentation_incomplete');
  const completed = Number(incomplete?.completedCount);
  const total = Number(incomplete?.totalCount);
  const hasIncompleteCount = incomplete && Number.isInteger(completed) && Number.isInteger(total) && total > completed;
  const interruptionMessage = incomplete ? presentationInterruptionMessage(incomplete.interruptionReason) : '';
  // QA 24/11 (texto 3): a pessoa pediu N cards e recebeu menos. Isso não pode
  // ficar só dentro de "O que conferir", que nasce fechado.
  const cardsRemoved = items.some(issue => issue.code === 'repeated_cards_removed');
  // Teste 4 (25/11): repetição que o reparo não resolveu, com os números.
  const repeatedLeft = [...new Set(items.filter(issue => issue.code === 'repetition_remaining' && Number.isInteger(issue.slideIndex) && issue.slideIndex >= 0)
    .map(issue => issue.slideIndex + 1))].sort((a, b) => a - b);
  const repeatedList = repeatedLeft.length > 1 ? `${repeatedLeft.slice(0, -1).join(', ')} e ${repeatedLeft.at(-1)}` : String(repeatedLeft[0] ?? '');
  const pages = [...new Set(items.filter(issue => Number.isInteger(issue.slideIndex) && issue.slideIndex >= 0)
    .map(issue => issue.slideIndex + 1))].sort((a, b) => a - b);
  const locations = [
    pages.length ? `${isPresentation ? 'Slides' : 'Cards'}: ${pages.join(', ')}` : '',
    items.some(issue => issue.field === 'caption' || issue.slideIndex === -1) ? 'Legenda' : '',
  ].filter(Boolean).join(' · ');
  return <section className="vc-editor-review-notice" aria-label="Revisão pendente do conteúdo">
    <strong>{incomplete ? 'Apresentação incompleta — revise antes de exportar' : onlyRepetition ? 'Repetição para conferir — revise antes de exportar' : 'Rascunho preservado — revise antes de exportar'}</strong>
    {incomplete && <p>{hasIncompleteCount
      ? `${completed} de ${total} slides preservados. A geração parou antes de escrever os ${total - completed} restantes.`
      : 'Os slides concluídos foram preservados, mas a geração parou antes de completar a apresentação.'} Complete a sequência antes de exportar.</p>}
    {interruptionMessage && <p>{interruptionMessage}</p>}
    {cardsRemoved && <p>Um card repetia outro e foi removido. O projeto ficou com menos cards do que o pedido.</p>}
    {repeatedLeft.length > 0 && <p>Sobrou repetição depois do reparo automático {repeatedLeft.length > 1 ? `nos ${isPresentation ? 'slides' : 'cards'}` : `no ${isPresentation ? 'slide' : 'card'}`} {repeatedList}. Reescreva o trecho repetido antes de exportar.</p>}
    {!onlyRepetition && <p>{incomplete
      ? 'Confira as informações, os títulos e o tamanho dos textos dos slides disponíveis. A sequência ainda precisa ser completada.'
      : status === 'unavailable'
      ? 'Este texto ainda não passou pela revisão automática. Confira as informações e o tamanho dos textos.'
      : 'A revisão encontrou pontos que precisam de conferência. Verifique as informações, os títulos e o tamanho dos textos.'}</p>}
    {locations && <p>{locations}</p>}
    {items.length > 0 && <details>
      <summary>O que conferir</summary>
      <ul>{items.map((issue, index) => <li key={index}>
        <strong>{issue.field === 'caption' || issue.slideIndex === -1 ? 'Legenda'
          : Number.isInteger(issue.slideIndex) && issue.slideIndex >= 0 ? `${isPresentation ? 'Slide' : 'Card'} ${issue.slideIndex + 1}`
            : 'Estrutura do rascunho'}: </strong>
        {issueDescription(issue)}
      </li>)}</ul>
    </details>}
    {!incomplete && <button type="button" className="vc-btn vc-btn-ghost" onClick={onReviewed}>Conferi o conteúdo</button>}
  </section>;
}
