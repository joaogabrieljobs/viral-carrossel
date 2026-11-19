/**
 * Os 12 estilos de carrossel viral em dados declarativos (composição v4).
 *
 * Mesma máquina das famílias editoriais (social-families.js: arquétipos por
 * formato, ajuste de densidade, trava de rodapé, palavra inteira, dispositivos
 * desenhados no editor e na exportação), com outra linguagem: capa que para o
 * polegar, título dominante na cor-assinatura em todos os cards, afirmação
 * como pôster tipográfico, numeral grande no miolo e selo com papel na
 * sequência. Fontes, pesos, caixa, cores e assinatura (cabeçalho, contador,
 * selo, barra) continuam sendo os do preset em visual-presets.jsx: este
 * arquivo decide geometria, escala, chão por função e dispositivos.
 *
 * Projeto salvo com a composição v3 não é recomposto; a v4 entra em geração
 * nova e quando a pessoa reaplica o estilo.
 */

/**
 * Selo do rodapé por papel:
 *  - swipe: convite de arrastar → capa e miolo, nunca no fechamento;
 *  - cta: chamada final → só no fechamento;
 *  - tag: etiqueta de identidade (hashtag, @) → capa e fechamento.
 */
export const PILL_ROLE_VISIBLE = Object.freeze({
  swipe: (fn) => fn !== 'closing',
  cta: (fn) => fn === 'closing',
  tag: (fn) => fn === 'cover' || fn === 'closing',
});

/**
 * O papel vem do texto que está no selo (a pessoa pode reescrevê-lo): convite
 * de arrastar, chamada final ou etiqueta (# / @). Sem pista, vale o do estilo.
 */
export function pillRoleFor(text, fallback = null) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (/arrast|deslize|desliza|swipe|pr[oó]ximo|→|➜|»/i.test(t)) return 'swipe';
  if (/^[#@]/.test(t)) return 'tag';
  if (/\b(veja|confira|salve|siga|segue|link|acesse|comente|compartilhe|garanta|inscreva|baixe|clique|saiba)\b/i.test(t)) return 'cta';
  return fallback;
}

const COVER = ['vCoverBleed', 'vCoverType'];
const CLOSING = ['vClosingBleed', 'vCoverType'];

/** Escala de display (px num card de 1080 de largura). */
const HEAVY = { cover: 132, statement: 184, opener: 118, development: 110, photo: 104, list: 100, closing: 124, body: 44, support: 34 };
const CONDENSED = { cover: 156, statement: 210, opener: 136, development: 128, photo: 120, list: 114, closing: 144, body: 44, support: 34 };
const SERIF = { cover: 124, statement: 150, opener: 108, development: 100, photo: 94, list: 94, closing: 112, body: 44, support: 34 };

const v = (def) => Object.freeze({ kind: 'viral', grounds: {}, pillRole: null, subtitleOverrides: null, ...def });

export const VIRAL_STYLES = Object.freeze({
  sports_editorial: v({
    id: 'sports_editorial', presetId: 'sports_editorial', label: 'Sports Editorial', align: 'left',
    intent: 'Capa esportiva: foto em sangria, título rosa pastel enorme embaixo, fio coral e numeral coral no miolo; cabeçalho de 3 colunas e contador N/M.',
    scale: HEAVY,
    pick: { cover: COVER, opener: 'vDevNumeral', development: ['vDevNumeral', 'vDevBlock'], photo: ['vPhotoTop', 'vPhotoBleed'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.06) saturate(1.04)', directionEn: 'Sports editorial photography: dynamic body in action or a strong portrait, hard light, subject in the upper two thirds and calm dark area at the bottom for the headline.', direction: 'Fotografia esportiva editorial: corpo em ação ou retrato forte, luz dura, assunto nos dois terços de cima e área escura calma embaixo para a manchete.' },
    devices: 'sports',
  }),
  case_study_neon: v({
    id: 'case_study_neon', presetId: 'case_study_neon', label: 'Case Study Neon', align: 'left',
    intent: 'Estudo de caso: título condensado com sublinhado neon, estrela neon de 8 pontas, card de resultado em chão neon e CTA só no fechamento.',
    scale: CONDENSED, pillRole: 'cta', grounds: { statement: 'accent' },
    pick: { cover: COVER, opener: 'vDevNumeral', development: ['vDevNumeral', 'vDevBlock'], photo: ['vPhotoTop', 'vPhotoTop'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.08) saturate(0.9)', directionEn: 'Case study documentation: real workspace, screen, product or process in use, clean dark background, sharp detail; nothing staged as a result.', direction: 'Documentação de caso: espaço de trabalho real, tela, produto ou processo em uso, fundo escuro limpo, detalhe nítido; nada encenado como resultado.' },
    devices: 'case',
  }),
  mood_sepia: v({
    id: 'mood_sepia', presetId: 'mood_sepia', label: 'Mood Sépia', align: 'center',
    intent: 'Mood reflexivo: creme centralizado sobre sépia escuro, fio âmbar, foto em sépia e hashtag só na capa e no fechamento.',
    scale: HEAVY, pillRole: 'tag',
    pick: { cover: COVER, opener: 'vDevCenter', development: ['vDevCenter', 'vDevCenter'], photo: ['vPhotoColumn', 'vPhotoTop'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'sepia(0.38) saturate(0.85) contrast(1.05)', directionEn: 'Warm reflective photography: window light, quiet gesture, hands or a person in thought, film grain feel, soft shadows, room for centered text.', direction: 'Fotografia reflexiva e quente: luz de janela, gesto calmo, mãos ou pessoa pensando, sensação de filme, sombras suaves e espaço para texto centralizado.' },
    devices: 'mood',
  }),
  bold_promo_rosa: v({
    id: 'bold_promo_rosa', presetId: 'bold_promo_rosa', label: 'Bold Promo Pink', align: 'left',
    intent: 'Promoção: chão rosa profundo, título branco enorme, etiqueta âmbar inclinada (mostra a oferta só quando a pessoa a escreveu) e afirmação em chão branco.',
    scale: HEAVY, grounds: { statement: 'inverse' },
    pick: { cover: COVER, opener: 'vDevNumeral', development: ['vDevNumeral', 'vDevBlock'], photo: ['vPhotoTop', 'vPhotoTop'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.06) saturate(1.08)', directionEn: 'Bright product or lifestyle photography with saturated colour, product fully visible, plain background, direct light; no text, no price tags.', direction: 'Produto ou lifestyle com cor saturada, produto inteiro visível, fundo simples, luz direta; sem texto e sem etiqueta de preço.' },
    devices: 'promo',
  }),
  reflexivo_cream: v({
    id: 'reflexivo_cream', presetId: 'reflexivo_cream', label: 'Reflexivo Serif', align: 'center',
    intent: 'Ensaio reflexivo: serifa creme centralizada sobre grafite frio, aspas e losango dourados, @ do perfil na capa e no fechamento.',
    scale: SERIF, pillRole: 'tag',
    pick: { cover: COVER, opener: 'vDevCenter', development: ['vDevCenter', 'vDevCenter'], photo: ['vPhotoColumn', 'vPhotoTop'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'saturate(0.8) contrast(1.04)', directionEn: 'Quiet contemplative photography: cool light, solitary figure or still life, muted palette, generous negative space.', direction: 'Fotografia contemplativa: luz fria, figura solitária ou natureza-morta, paleta contida e muito espaço livre.' },
    devices: 'reflexivo',
  }),
  tabloid_keywords: v({
    id: 'tabloid_keywords', presetId: 'tabloid_keywords', label: 'Tabloid Keywords', align: 'left',
    intent: 'Manchete de tabloide: Anton gigante, faixa menta de plantão, palavra-chave em destaque menta e afirmação em chão menta.',
    scale: CONDENSED, pillRole: 'tag', grounds: { statement: 'accent' },
    pick: { cover: COVER, opener: 'vDevBlock', development: ['vDevBlock', 'vDevNumeral'], photo: ['vPhotoTop', 'vPhotoBleed'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.12) saturate(0.95)', directionEn: 'News photography: decisive moment, faces and gestures in close-up, high contrast, simple background behind the subject.', direction: 'Fotojornalismo: momento decisivo, rostos e gestos em close, alto contraste e fundo simples atrás do assunto.' },
    devices: 'tabloid',
  }),
  editorial_magazine: v({
    id: 'editorial_magazine', presetId: 'editorial_magazine', label: 'Editorial Magazine', align: 'center',
    intent: 'Capa de revista: Playfair centralizada sobre azul-marinho, moldura fina dourada, fio dourado; apoio longo sai da caixa alta para ler bem.',
    scale: SERIF,
    subtitleOverrides: { longCase: 'normal', longFrom: 48 },
    pick: { cover: COVER, opener: 'vDevCenter', development: ['vDevCenter', 'vDevCenter'], photo: ['vPhotoColumn', 'vPhotoTop'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.04) saturate(0.95)', directionEn: 'Fashion and lifestyle magazine photography: styled portrait or lookbook scene, soft directional light, subject in the upper half, elegant palette.', direction: 'Fotografia de revista de moda e lifestyle: retrato produzido ou cena de lookbook, luz suave direcional, assunto na metade de cima, paleta elegante.' },
    devices: 'magazine',
  }),
  luxury_hybrid: v({
    id: 'luxury_hybrid', presetId: 'luxury_hybrid', label: 'Luxury Hybrid', align: 'left',
    intent: 'Luxo fashion: título branco pesado sobre marrom, moldura e fios dourados, numeral dourado; apoio sem itálico falso.',
    scale: HEAVY,
    subtitleOverrides: { italic: false },
    pick: { cover: COVER, opener: 'vDevNumeral', development: ['vDevNumeral', 'vDevBlock'], photo: ['vPhotoTop', 'vPhotoBleed'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.05) saturate(0.92) sepia(0.06)', directionEn: 'Luxury fashion photography: rich textures, leather, gold and warm shadows, single soft key light, product or model fully in frame.', direction: 'Moda de luxo: texturas ricas, couro, dourado e sombras quentes, uma luz suave, produto ou modelo inteiro no quadro.' },
    devices: 'luxury',
  }),
  viral_hype_dark: v({
    id: 'viral_hype_dark', presetId: 'viral_hype_dark', label: 'Viral Hype Dark', align: 'left',
    intent: 'Hype: preto e vermelho, barra vermelha ao lado do título, numeral vermelho, afirmação em chão vermelho e "arrasta pro lado" só enquanto há card seguinte.',
    scale: HEAVY, pillRole: 'swipe', grounds: { statement: 'accent' },
    pick: { cover: COVER, opener: 'vDevNumeral', development: ['vDevNumeral', 'vDevBlock'], photo: ['vPhotoTop', 'vPhotoBleed'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.1) saturate(1.02)', directionEn: 'High energy photography: strong expression or striking object, dark background, red or warm practical light accents.', direction: 'Foto de alta energia: expressão forte ou objeto marcante, fundo escuro, toques de luz vermelha ou quente.' },
    devices: 'hype',
  }),
  cinematic_hybrid: v({
    id: 'cinematic_hybrid', presetId: 'cinematic_hybrid', label: 'Cinematic Hybrid', align: 'left',
    intent: 'Cinema noir: Yeseva vermelha em todos os cards, letterbox nas fotos, fotos em sangria e afirmação centralizada como cartela.',
    scale: SERIF,
    subtitleOverrides: { italic: false },
    pick: { cover: COVER, opener: 'vDevBlock', development: ['vDevBlock', 'vDevBlock'], photo: ['vPhotoBleed', 'vPhotoColumn'], statement: 'vStatementCenter', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'contrast(1.12) saturate(0.82) brightness(0.96)', directionEn: 'Film noir still: night or low light, practical lights, small human figure in a wide frame, deep shadows, low horizon.', direction: 'Fotograma noir: noite ou pouca luz, luzes práticas, figura pequena em plano aberto, sombras fundas e horizonte baixo.' },
    devices: 'cinematic',
  }),
  authority_black: v({
    id: 'authority_black', presetId: 'authority_black', label: 'Authority Black', align: 'center',
    intent: 'Autoridade: título branco gigante centralizado, fio âmbar, numeral âmbar e a ficha técnica de 3 colunas sempre legível no rodapé.',
    scale: HEAVY,
    pick: { cover: COVER, opener: 'vDevCenter', development: ['vDevCenter', 'vDevCenter'], photo: ['vPhotoTop', 'vPhotoBleed'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'grayscale(0.2) contrast(1.08)', directionEn: 'Authority portrait or workplace: confident person or professional setting, frontal framing, dark background, controlled light.', direction: 'Retrato de autoridade ou ambiente profissional: pessoa confiante ou cenário de trabalho, enquadramento frontal, fundo escuro, luz controlada.' },
    devices: 'authority',
  }),
  minimal_clean: v({
    id: 'minimal_clean', presetId: 'minimal_clean', label: 'Minimal Clean', align: 'center',
    intent: 'Minimal Apple/Swiss: creme, tipografia centralizada, um fio fino; afirmação grande no centro e muito ar com o bloco no centro óptico.',
    scale: { cover: 120, statement: 140, opener: 108, development: 100, photo: 92, list: 92, closing: 112, body: 44, support: 34 },
    pick: { cover: COVER, opener: 'vDevCenter', development: ['vDevCenter', 'vDevCenter'], photo: ['vPhotoTop', 'vPhotoTop'], statement: 'vStatement', list: 'vList', comparison: 'compare', closing: CLOSING },
    photo: { filter: 'saturate(0.95) contrast(1.02)', directionEn: 'Clean bright photography, few elements, tidy light background, sharp subject with generous empty space.', direction: 'Foto limpa e clara, poucos elementos, fundo claro e organizado, assunto nítido com muito espaço livre.' },
    devices: 'minimal',
  }),
});

export const VIRAL_STYLE_KEYS = Object.freeze(Object.keys(VIRAL_STYLES));

/** Texto de amostra que o preset grava no card e que nunca deve ser impresso. */
export const PRESET_SAMPLE_TEXT = /^(O RESULTADO EM UMA LINHA|DE R\$\s*0+|POR R\$\s*0+.*|.*SUA OFERTA.*)$/i;
export function realSlideText(value) {
  const t = String(value || '').trim();
  return t && !PRESET_SAMPLE_TEXT.test(t) ? t : '';
}
