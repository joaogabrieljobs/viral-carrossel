/**
 * Tipografia da marca → slides, por ação explícita.
 *
 * Antes, um efeito observava nove campos `brand.text*` e regravava os nove em
 * TODOS os slides sempre que qualquer um mudava — também quando a marca mudava
 * por código (geração, preset, troca de formato, abertura de projeto). Na
 * rodada R2 isso apagou a hierarquia que a composição tinha acabado de definir:
 * os carrosséis saíram com título, subtítulo e apoio em 100/100/100.
 *
 * Agora a propagação acontece só quando a pessoa mexe num controle de
 * tipografia (ou troca o perfil de marca), e com duas regras:
 *
 * 1. Só o campo que mudou é propagado. Ajuste por card nos outros campos fica.
 * 2. Tamanhos propagam em PROPORÇÃO: a capa em 88 e o miolo em 66 continuam
 *    proporcionais quando a marca vai de 100 para 110. Entre-letras,
 *    entrelinha, peso e caixa são absolutos: o valor da marca substitui.
 *
 * "Aplicar tipografia da marca a todos" continua igualando tudo de propósito.
 */
import { typographyPatchFromBrand } from './doc-schema.js';

/** Campo da marca → campo do slide. */
export const BRAND_TYPOGRAPHY_FIELDS = Object.freeze({
  textTitleSize: 'titleSize',
  textSubSize: 'subSize',
  textBodyAfterSize: 'bodyAfterSize',
  textTitleTracking: 'titleTracking',
  textSubTracking: 'subTracking',
  textTitleLeading: 'titleLeading',
  textSubLeading: 'subLeading',
  textTitleWeight: 'titleWeight',
  textTitleCase: 'titleCase',
});

const PROPORTIONAL = new Set(['titleSize', 'subSize', 'bodyAfterSize']);
/** Mesma faixa aceita pela edição visual do agente (`api/lib/visual-patch.js`). */
export const SLIDE_SIZE_MIN = 30;
export const SLIDE_SIZE_MAX = 250;

const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const duasCasas = (v) => Math.round(v * 100) / 100;
const naFaixa = (v) => Math.min(SLIDE_SIZE_MAX, Math.max(SLIDE_SIZE_MIN, v));

/**
 * Campos de slide cujo valor efetivo da marca mudou entre `prev` e `next`.
 * Compara valores normalizados: 100 → undefined não é mudança (o padrão é 100),
 * e o peso passa pelo mesmo teto anti-faux-bold da fonte.
 */
export function changedTypographyFields(prevBrand, nextBrand) {
  const antes = typographyPatchFromBrand(prevBrand);
  const depois = typographyPatchFromBrand(nextBrand);
  return Object.values(BRAND_TYPOGRAPHY_FIELDS)
    .filter((campo) => antes[campo] !== depois[campo])
    .map((campo) => ({ campo, antes: antes[campo], depois: depois[campo] }));
}

/** Patch de UM slide para as mudanças já calculadas. `null` quando nada muda. */
export function slideTypographyPatch(slide, mudancas) {
  const patch = {};
  for (const { campo, antes, depois } of mudancas) {
    if (!PROPORTIONAL.has(campo)) {
      if (slide?.[campo] !== depois) patch[campo] = depois;
      continue;
    }
    const atual = finite(slide?.[campo]);
    const base = finite(antes);
    const alvo = finite(depois);
    if (alvo == null) continue;
    // Slide sem valor próprio (ou marca sem base numérica) adota o valor da marca.
    const novo = atual == null || !(base > 0) ? alvo : naFaixa(duasCasas(atual * (alvo / base)));
    if (novo !== slide?.[campo]) patch[campo] = novo;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * Propaga para os slides a diferença de tipografia entre duas marcas.
 * Devolve o MESMO array quando nenhum slide muda.
 */
export function propagateBrandTypography(slides, prevBrand, nextBrand) {
  if (!Array.isArray(slides) || !slides.length) return slides;
  const mudancas = changedTypographyFields(prevBrand, nextBrand);
  if (!mudancas.length) return slides;
  let mudou = false;
  const out = slides.map((slide) => {
    const patch = slideTypographyPatch(slide, mudancas);
    if (!patch) return slide;
    mudou = true;
    return { ...slide, ...patch };
  });
  return mudou ? out : slides;
}
