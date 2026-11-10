import { stripLeadingSlideCardLabel } from './generation-prompts.js';

export const REMIX_TONES = [
  { id: 'analitico', label: 'Analítico', blurb: 'Calmo, preciso, com raciocínio.', hint: 'analítico e editorial, explicando relações concretas sem abstração vazia' },
  { id: 'provocador', label: 'Provocador', blurb: 'Questiona o óbvio com base.', hint: 'provocador e contraintuitivo, sustentando a tensão com os fatos do brief' },
  { id: 'leve', label: 'Leve', blurb: 'Conversa com humor sutil.', hint: 'leve e conversacional, com humor sutil e frases curtas' },
  { id: 'didatico', label: 'Didático', blurb: 'Explica sem complicar.', hint: 'didático e acessível, com exemplos concretos, sem transformar um anúncio em aula' },
  { id: 'inspirador', label: 'Inspirador', blurb: 'Possibilidades reais, sem clichê.', hint: 'inspirador, mostrando possibilidades reais sem promessas grandiosas ou frases de guru' },
  { id: 'acolhedor', label: 'Acolhedor', blurb: 'Próximo, humano, empático.', hint: 'acolhedor e empático, reconhecendo dificuldades sem exagerar dores ou infantilizar o público' },
  { id: 'tecnico', label: 'Técnico', blurb: 'Detalhes e termos precisos.', hint: 'técnico e preciso, com termos adequados ao público e somente detalhes sustentados pelo material' },
  { id: 'comercial', label: 'Comercial', blurb: 'Benefício claro, convite direto.', hint: 'comercial e direto, destacando benefícios comprovados e um convite claro, sem inventar urgência, preço ou resultados' },
];

export function buildRemixBlock(slides, withImages) {
  return `REMIX DO CARROSSEL ATUAL — varie a voz, preserve a identidade.
O tom solicitado muda a redação, não os fatos, o produto, a oferta, a promessa central nem o papel de cada card. O brief atual e suas restrições continuam valendo. Preserve quantidade e ordem; não transforme anúncio em tutorial.
O design atual está fixo: não redefina paleta, tipografia, composição ou layout. Mantenha o volume de texto próximo ao original para caber nos mesmos espaços. Campos textuais vazios continuam vazios.
${withImages ? 'Adapte imageQuery ao conteúdo preservando o meio visual, a paleta e a linguagem do estilo e do moodboard do projeto. O tom verbal não autoriza trocar o estilo da imagem.' : 'As imagens existentes serão mantidas. Preserve imageQuery de cada card e escreva texto compatível com essas imagens.'}
<carrossel_atual>
${JSON.stringify(slides.map(({ title, subtitle, bodyAfterImage, imageQuery }) => ({ title, subtitle, bodyAfterImage: bodyAfterImage || '', imageQuery })))}
</carrossel_atual>`;
}

/**
 * Validação que pode ser executada antes de chamar a IA. O merge mantém a
 * mesma defesa, mas o editor deve usar este retorno para não gastar uma
 * geração de texto quando um roteiro do material pede outra quantidade.
 */
export function validateRemixCardCount(current, explicitCardScript = null) {
  const currentCount = Array.isArray(current) ? current.length : 0;
  const scriptCount = Number(explicitCardScript?.count || 0);
  const compatible = !scriptCount || scriptCount === currentCount;
  return {
    ok: compatible,
    currentCount,
    scriptCount: scriptCount || null,
    message: compatible
      ? ''
      : `O roteiro tem ${scriptCount} cards, mas o projeto atual tem ${currentCount}. Ajuste o roteiro antes de refazer.`,
  };
}

export function mergeRemixedSlides(current, generated, withImages) {
  if (!Array.isArray(generated) || current.length !== generated.length) {
    throw new Error('O remix precisa manter a quantidade de cards.');
  }
  return current.map((slide, i) => {
    const next = generated[i];
    const patch = {};
    for (const field of ['title', 'subtitle', 'bodyAfterImage']) {
      // Não preenche espaços que o layout atual não usa.
      patch[field] = String(slide[field] || '').trim()
        ? stripLeadingSlideCardLabel(String(next[field] ?? slide[field]).trim()) : (slide[field] || '');
    }
    return { ...slide, ...patch, ...(withImages ? { imageQuery: next.imageQuery || slide.imageQuery } : {}) };
  });
}
