/** Contratos exclusivos do modo Livre social. Nenhum deles entra no catálogo. */
import { FREE_BLOCKS, FREE_FONT_FAMILIES, FREE_GROUNDS, FREE_ICONS, FREE_PHOTO_SIZES } from './free-design.js';
import { SOCIAL_FREE_FAMILY_KEYS, SOCIAL_FREE_LAYOUT_KEYS } from './social-free-design.js';
import { slideForFormatDisplay } from './format-view.js';
import { photoTextBounds, textOverPhoto } from './image-composition.js';
import { reservedAreaColour, visualHex } from './visual-direction.js';
import { wcagContrast } from './wcag.js';
import { buildReferenceVisualAnalysisContext } from './reference-visual-analysis.js';

export const SOCIAL_FREE_FORMATS = Object.freeze({
  carrossel: Object.freeze({ w: 1080, h: 1350, ratio: '4:5', top: 8.5, bottom: 8.5 }),
  quadrado: Object.freeze({ w: 1080, h: 1080, ratio: '1:1', top: 9, bottom: 9 }),
  stories: Object.freeze({ w: 1080, h: 1920, ratio: '9:16', top: 14, bottom: 18 }),
});

export function normalizeSocialFreeFormat(value) {
  return Object.hasOwn(SOCIAL_FREE_FORMATS, value) ? value : 'carrossel';
}

export function isSocialFreeSlide(slide) {
  return slide?.socialPresetId === 'social_free' || slide?.socialPlan?.kind === 'social_free';
}

const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const trim = (value, max) => text(value).slice(0, max);

export function buildSocialFreePrompt({ formato = 'carrossel', brand = {}, styleKit = {}, referenceColors = [], signature = '', referenceVisualAnalysis = null } = {}) {
  const fmt = normalizeSocialFreeFormat(formato);
  const frame = SOCIAL_FREE_FORMATS[fmt];
  const explicit = Object.fromEntries(['bg', 'accent', 'titleColor', 'subtitleColor', 'textColor', 'titleFont', 'bodyFont']
    .filter(key => typeof brand?.[key] === 'string' && brand[key]).map(key => [key, brand[key]]));
  const reference = (Array.isArray(referenceColors) ? referenceColors : []).map(item => typeof item === 'string'
    ? { hex: visualHex(item) } : { hex: visualHex(item?.hex), ...(Number.isFinite(item?.weight) ? { weight: item.weight } : {}) }).filter(item => item.hex);
  // Apoteose 8 no carrossel: só uma leitura multimodal validada entra. Sem
  // ela, o contrato social continua idêntico ao anterior.
  const referenceContext = buildReferenceVisualAnalysisContext(referenceVisualAnalysis);
  const referenceBlock = referenceContext ? `${referenceContext}
Instruções escritas explícitas prevalecem sobre a referência. Não invente "no grain" nem "no people" como exclusões para preencher lacunas. Grafismos ficam secundários ao sujeito quando o briefing pede fotografia; intervenções tipográficas pertencem às camadas editáveis. Leve a direção derivada a visualDirection e às cenas; a observação da referência não é fato sobre o projeto, o público ou um local.
` : '';
  return `MODO LIVRE SOCIAL — CONTRATO FINAL DA MESMA REDAÇÃO:
Mantenha o briefing, o idioma, o modo narrativo, a quantidade e os limites editoriais acima. Este contrato amplia e substitui apenas o formato JSON anterior: escreva texto e direção visual no mesmo objeto JSON, sem etapa ou pedido de planejamento separado, sem HTML, CSS ou coordenadas.
Formato deste projeto: ${frame.w} × ${frame.h}, ${frame.ratio} (${fmt}). Proteja ${frame.top}% no alto e ${frame.bottom}% embaixo; no Stories, o CTA e o rodapé ficam acima da área de interface. O código calculará as zonas reais e manterá pelo menos 28 px de leitura, contraste 4,5:1, reserva para logo e nunca três layouts iguais seguidos.
CAPA: título editorial com no máximo 8 palavras; eyebrow vazio. O editor acrescenta a seta “arraste”, nunca desenhe a seta na foto. FECHO: texto com um CTA claro e coerente com o objetivo, sem inventar oferta, prazo ou resultado. Em cada card de miolo, uma contribuição própria.
No Livre, bodyAfterImage é opcional em qualquer posição, inclusive capa e segundo card; uma assinatura ou complemento escrito nesse campo permanece visível. Esta regra substitui a proibição posicional de bodyAfterImage dos modelos de sanduíche anteriores, mantendo o teto total de apoio.
Assinatura: uma frase literal do material pode reaparecer somente na capa e no fecho, em signature; sem assinatura fornecida, use "". A mesma frase em dois cards de miolo já é repetição. Não espalhe a assinatura pelo miolo.
Identidade única: deckDesign.palette contém bg, surface, ink, muted, accent, accent2, inverse e inverseInk, todos #RRGGBB. deckDesign.fonts contém display e text, escolhidos entre ${FREE_FONT_FAMILIES.join(', ')}. deckDesign.mood é uma frase breve de direção. As definições explícitas da marca vencem a proposta: ${JSON.stringify(explicit)}. Cores extraídas da referência e seus pesos: ${JSON.stringify(reference)}. Distribua essas cores por papel, sem substituir a base por preto/branco genérico. Sem kit ou referência, proponha uma identidade própria para este briefing; não use a paleta ou os grafismos de outro projeto como padrão.
Kit escrito (direção, não fonte de novos fatos): ${trim([styleKit?.stylePrompt, styleKit?.contextMd].filter(Boolean).join('\n'), 1800)}
visualDirection contém palette (3–6 objetos {role,hex}, roles base/subject_light/shadow/graphic/accent), finish, atmosphere, graphics e avoid. O acabamento e os grafismos são os da identidade; graphics pode ser "none". Respeite exclusões, inclusive ausência de grão ou de decoração. Não imponha recortes orgânicos, serigrafia ou luz saturada.
Por card, inclua scene, avoid, design e eyebrow além dos campos editoriais pedidos. scene é um briefing em inglês: {subject,wardrobe,action,expression,setting,light,graphics,shot}; preserve sujeitos e âncoras de identidade existentes. Varie ação, lugar e enquadramento entre fotos. Casting é criação visual, nunca evidência factual sobre o público. A referência de estilo fornece só meio, cores, luz e textura, nunca a pessoa ou a composição.
${referenceBlock}DECISÕES VISÍVEIS DA CENA:
Para cada imagem, escolha uma decisão visual distintiva coerente com a função editorial do card e com o briefing. Adjetivos de qualidade não substituem decisões observáveis. Use os oito campos existentes; campos sem aplicação ficam "". Mantenha scene null quando uma foto não contribuir.
- subject: descreva o assunto e um traço relevante; objetos e ambientes também podem conduzir a cena, com pessoas só quando fizerem parte da ideia.
- wardrobe: descreva material, textura ou detalhe do figurino ou objeto quando relevante para a cena; não acrescente adornos só para preencher o campo.
- action: capture um gesto físico ou instante observável; para objetos, uma interação, transformação ou estado que explique a ideia.
- expression: descreva expressão, atitude e direção do olhar quando houver pessoas; deixe vazio quando não se aplicar.
- setting: situe o ambiente e a relação entre primeiro plano, assunto e fundo, com detalhes sustentados pelo briefing ou claramente conceituais.
- light: descreva fonte, direção e função da luz pela paleta efetiva, distinguindo incidência no assunto, sombra ou recorte quando úteis. Respeite o acabamento pedido, inclusive uma superfície lisa e sem grão; não imponha luz saturada ou efeitos fotográficos a uma linguagem que não os pede.
- graphics: visualDirection.graphics: "none" proíbe acrescentar grafismos nas imagens. scene.graphics: "none" impede intervenções dentro da imagem daquela cena, mesmo quando a linguagem global permite formas. O layout é separado da foto e não autoriza desenhar seus elementos nela.
- shot: escolha distância e ponto de vista, com profundidade, foco ou movimento quando contribuírem; sem câmera, lente ou parâmetros obrigatórios. A composição calculada pelo app define a reserva do texto, sem coordenadas inventadas no plano.
Identidade recorrente somente quando solicitada no briefing ou na ficha, ou planejada explicitamente na sequência. Uma ficha não obriga o sujeito a aparecer em todas as imagens. Preserve suas características quando ele aparecer e varie ação, ambiente ou enquadramento conforme a função do card. Casting, ações e locais conceituais não são fatos sobre o projeto, o público ou um local real; não invente documentação, presença real ou características oficiais do público.
design: family entre ${SOCIAL_FREE_FAMILY_KEYS.join(', ')}; layout opcional entre ${SOCIAL_FREE_LAYOUT_KEYS.join(', ')}; ground entre ${FREE_GROUNDS.join(', ')}; photo entre ${FREE_PHOTO_SIZES.join(', ')}; block entre ${FREE_BLOCKS.join(', ')} (lista usa steps); emphasis até 3 trechos literais do texto; icons até 4 nomes entre ${FREE_ICONS.join(', ')}. Sem conteúdo que sustente um bloco, use block none. Nunca crie números, citações ou pares para preencher um layout.
Quando block não for none, escreva o conteúdo em presentationBlocks: steps {type,items:[{title,body}]}; comparison {type,headers:[...],rows:[[...]]}; quote {type,text,author}; bignumber {type,value,label,detail}; icons {type,items:[{icon,title,body}]}. O bloco substitui somente a informação que ele já mostra; o apoio deve acrescentar contexto sem repetir suas células. Não descarte ressalvas ou condições.
photo none: scene null e imageQuery ""; nenhum pedido de foto. ground art exige photo none: a mesma arte abstrata da identidade, gerada uma vez por projeto, é reutilizada em cards sem foto. A imagem nunca contém texto, números factuais, logo ou tabelas. Texto, CTA, seta e marca são camadas editáveis.
eyebrow: 1–3 palavras em CAIXA ALTA que nomeiam o assunto, obrigatório após a capa; sem número, promessa ou fato novo. emphasis cita apenas palavras já escritas.
Retorne {"slides":[{"title":"","subtitle":"","bodyAfterImage":"","imageQuery":"","scene":null,"avoid":"","eyebrow":"","design":{"family":"editorial","ground":"bg","photo":"none","block":"none","emphasis":[],"icons":[]},"presentationBlocks":[]}],"caption":"","signature":${JSON.stringify(trim(signature, 240))},"deckDesign":{"palette":{},"fonts":{"display":"","text":""},"mood":""},"visualDirection":{"palette":[],"finish":"","atmosphere":"","graphics":"none","avoid":""}}. Preencha os objetos conforme o contrato, preservando os demais campos editoriais exigidos. Esse é o JSON final da redação, não um plano para outra chamada.`;
}

export function buildSocialFreeReviewRules({ signatures = [], violations = [] } = {}) {
  return `\nREVISÃO DO MODO LIVRE SOCIAL: confira a capa com até 8 palavras e o CTA do fecho, vinculado ao objetivo. Frase repetida em dois cards já exige correção. ${signatures.length ? `Assinatura literal protegida somente na capa e no fecho: ${signatures.map(value => JSON.stringify(value)).join('; ')}. Preserve-a onde já está; isso não autoriza repeti-la no miolo.` : 'Não invente uma assinatura.'} Não altere scene, avoid, imageQuery, design, deckDesign, visualDirection nem configurações visuais. eyebrow e presentationBlocks podem ser corrigidos apenas como texto sustentado pelo material.${violations.length ? ` Problemas medidos: ${JSON.stringify(violations)}.` : ''}`;
}

/** A vista editada do formato prevalece; o card salvo não é modificado. */
export function socialFreeImageSlide(slide, { fmt = 'carrossel', formatViews = null } = {}) {
  const format = normalizeSocialFreeFormat(fmt);
  const shown = slideForFormatDisplay(slide, format, formatViews);
  const entry = formatViews?.[format]?.slides?.[slide?.id];
  return entry && typeof entry === 'object' ? { ...shown, ...entry } : shown;
}

const validZone = zone => zone && ['x', 'y', 'w', 'h'].every(key => Number.isFinite(zone[key])) && zone.w > 0 && zone.h > 0;
const TEXT_ZONES = ['title', 'subtitle', 'evidence', 'body', 'bodyAfterImage', 'eyebrow'];
function bounds(zones) {
  const items = TEXT_ZONES.map(key => zones?.[key]).filter(validZone);
  if (!items.length) return null;
  const x = Math.max(0, Math.min(...items.map(zone => zone.x)));
  const y = Math.max(0, Math.min(...items.map(zone => zone.y)));
  return { x, y, w: Math.min(100, Math.max(...items.map(zone => zone.x + zone.w))) - x,
    h: Math.min(100, Math.max(...items.map(zone => zone.y + zone.h))) - y };
}
const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
const lightInk = hex => wcagContrast(hex, '#000000') >= wcagContrast(hex, '#FFFFFF');
const frameLine = fmt => {
  const frame = SOCIAL_FREE_FORMATS[normalizeSocialFreeFormat(fmt)];
  return `${frame.w} × ${frame.h}, ${frame.ratio}; protected top ${frame.top}% and bottom ${frame.bottom}%`;
};

export function composeSocialFreeComposition(slide, { fmt = 'carrossel', formatViews = null, visualDirection = null, shot = '' } = {}) {
  const shown = socialFreeImageSlide(slide, { fmt, formatViews });
  if (shown?.socialFreeDesign?.photo === 'none' || shown?.socialSuppressPhoto) return '';
  const zones = shown?.canvas?.zones || {};
  const title = bounds(zones);
  const geometry = textOverPhoto({ photo: zones.photo, ...(title ? { title } : {}) });
  if (!geometry) return '';
  const prefix = `COMPOSITION (social card ${frameLine(fmt)}): ${text(shot) ? `Shot: ${text(shot).replace(/[.\s]+$/, '')}. ` : ''}`;
  if (geometry.mode === 'panel') {
    const panel = zones.photo;
    return `${prefix}The visible photo panel starts at ${panel.x}% from the left and ${panel.y}% from the top, covering ${panel.w}% of the card width and ${panel.h}% of its height. Text sits outside that panel. Fill its crop with the subject, keeping faces, hands and key details away from the crop edges. Do not reserve an invented widescreen text column inside the photo.`;
  }
  const ink = visualHex(shown?.titleColor) || '#FFFFFF';
  const tone = lightInk(ink) ? 'dark' : 'light';
  const color = visualHex(shown?.overlayColor) || reservedAreaColour(visualDirection, ink, { preferBase: true });
  const area = photoTextBounds(zones, TEXT_ZONES);
  const location = geometry.side === 'center' && area
    ? `the text rectangle (x ${area.x0}–${area.x1}%, y ${area.y0}–${area.y1}% of this image)`
    : geometry.side === 'center' ? 'the central text area' : `the ${geometry.side} ${geometry.reserve}% of the frame`;
  const subject = geometry.side === 'center' ? 'outside the central text area' : `in the ${opposite[geometry.side]} ${100 - geometry.reserve}%`;
  return `${prefix}Editable type overlays ${location}. Keep that area ${tone}, quiet${color ? ` in ${color}` : ''} and low-detail, with no faces, hands or key details. Place the subject ${subject}. Keep essential details clear of the protected top and bottom areas; do not generate lettering, CTA, arrows or a logo.`;
}

/** União das caixas reais dos cards que compartilharão a arte no formato. */
export function composeSocialFreeArtComposition(slides, { fmt = 'carrossel', formatViews = null, base = '#111111', graphics = false } = {}) {
  const rectangles = (Array.isArray(slides) ? slides : []).map(slide => bounds(socialFreeImageSlide(slide, { fmt, formatViews })?.canvas?.zones)).filter(Boolean);
  const area = rectangles.length ? {
    x: Math.min(...rectangles.map(rect => rect.x)), y: Math.min(...rectangles.map(rect => rect.y)),
    right: Math.max(...rectangles.map(rect => rect.x + rect.w)), bottom: Math.max(...rectangles.map(rect => rect.y + rect.h)),
  } : null;
  const locations = area ? `from ${Math.floor(area.x)}% to ${Math.ceil(area.right)}% of the width and ${Math.floor(area.y)}% to ${Math.ceil(area.bottom)}% of the height` : 'throughout the usable frame';
  return `COMPOSITION (shared social background ${frameLine(fmt)}): Editable text and blocks occupy ${locations}, the union of the actual card text zones. Keep that entire area uniform and calm in ${base}, with no shapes, faces, lettering or texture changes. ${graphics ? 'Use only the specified graphic language in the remaining outer margins, away from all text and the reserved footer/logo area; if no clear margin remains, omit the graphics.' : `No graphic interventions. Keep the whole frame uniform in ${base}.`} Do not impose a landscape presentation layout or a fixed horizontal text column.`;
}
