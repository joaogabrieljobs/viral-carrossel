import { sanitizeCustomVisualPresetBrand } from './custom-visual-presets.js';
import { normalizeBrandTone } from './brand-tone.js';
import { normalizeStyleKit } from './style-kit.js';

export const CREATION_STEPS = ['Projeto', 'Marca', 'Conteúdo', 'Narrativa', 'Quantidade', 'Visual', 'Revisão'];
export const NARRATIVE_CHOICES = [
  { id: 'none', label: 'Seguir meu pedido', desc: 'Organiza o conteúdo conforme o seu briefing.', example: 'Apresente meus serviços, benefícios e como contratar.' },
  { id: 'editorial', label: 'Explicar com autoridade', desc: 'Defende uma ideia com contexto, argumentos e consequências.', example: 'Por que uma proposta clara ajuda o cliente a decidir.' },
  { id: 'how_to', label: 'Ensinar passo a passo', desc: 'Mostra uma sequência prática que a pessoa pode seguir.', example: 'Como preparar uma proposta comercial em cinco etapas.' },
  { id: 'storytelling', label: 'Contar uma história', desc: 'Conecta uma situação, uma mudança e o que aconteceu depois.', example: 'O que mudou quando uma pequena loja ganhou um site.' },
  { id: 'viral', label: 'Prender atenção', desc: 'Começa com um gancho e entrega a resposta ao longo dos cards.', example: 'Seu cliente procura no Google. Quem ele encontra?' },
  { id: 'pain', label: 'Falar da dor', desc: 'Reconhece um problema e apresenta uma saída possível.', example: 'Você responde orçamentos o dia inteiro, mas vende pouco.' },
  { id: 'deep', label: 'Ir a fundo', desc: 'Explora causas, exemplos e implicações de um assunto.', example: 'O que existe por trás de um cliente que pede desconto.' },
  { id: 'jornalistico', label: 'Informar com clareza', desc: 'Apresenta o fato, o contexto e por que ele importa.', example: 'O que mudou nesta regra e quem será afetado.' },
  { id: 'sensacionalista', label: 'Criar alto impacto', desc: 'Usa ritmo e contraste fortes, mantendo os fatos fiéis.', example: 'O custo de deixar uma decisão importante para depois.' },
];
export const CREATION_DENSITIES = [
  { id: '1_5', label: 'Essencial', desc: 'Poucas frases, com bastante espaço para imagens.' },
  { id: '1_4', label: 'Curto', desc: 'Ideias diretas e leitura rápida.' },
  { id: '1_3', label: 'Moderado', desc: 'Uma explicação breve em cada página.' },
  { id: '1_2', label: 'Balanceado', desc: 'Explicação e exemplos com espaço para o visual.' },
  { id: '1_1', label: 'Detalhado', desc: 'Mais desenvolvimento, mantendo o texto organizado.' },
];
export function cloneCreationBrand(profile = {}) {
  // Never retain shared object references to an existing saved brand.
  const copy = JSON.parse(JSON.stringify(profile || {}));
  return { brand: copy, styleKit: normalizeStyleKit(copy.styleKit) };
}
export function validCreationCount(value, productKind) {
  const n = Number(value);
  return Number.isInteger(n) && n >= (productKind === 'apresentacao' ? 5 : 1) && n <= 24;
}
export function creationMaterialHasContent(material) {
  return ['content', 'sources', 'context'].some(key => String(material?.[key] || '').trim());
}
export async function readCreationTextFile(file) {
  if (!file || !/\.(txt|md|markdown)$/i.test(file.name || '')) throw new Error('Escolha um arquivo de texto .txt ou .md. Para outros formatos, cole o texto no campo de apoio.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Este arquivo é muito grande. Use um arquivo de texto de até 2 MB.');
  const text = await file.text();
  if (!text.trim()) throw new Error('O arquivo está vazio. Escolha outro texto.');
  if (/\u0000/.test(text)) throw new Error('Não foi possível ler este arquivo como texto. Cole o conteúdo no campo de apoio.');
  if (text.length > 200000) throw new Error('O texto ultrapassa 200 mil caracteres. Divida o material; nenhum trecho foi importado.');
  return text;
}

/** A neutral start never borrows identity or source material from another project. */
export function neutralCreationIdentity(defaultBrand = {}) {
  const { brand } = cloneCreationBrand(defaultBrand);
  return {
    brandId: '__local__',
    brand: {
      ...brand, name:'', handle:'', showHandle:false, handleAvatar:null,
      logo:null, logoImageId:null, logoAssetId:null,
      bio:'', positioning:'', signature:'', links:'', niche:'',
      defaultAudience:'', defaultTone:'', brandTone:null,
      styleKit:normalizeStyleKit({}),
    },
    styleKit:normalizeStyleKit({}),
  };
}

export function creationIdentitySummary(brand = {}, styleKit = {}) {
  const kit = normalizeStyleKit(styleKit);
  const hasLogo = !!(kit.logo?.imageId || kit.logo?.assetId || kit.logo?.dataUrl || brand.logoImageId || brand.logoAssetId || brand.logo);
  return {
    logo:hasLogo && kit.logoOnGenerate !== false ? 'Logo incluída' : hasLogo ? 'Logo desativada' : 'Sem logo',
    references:kit.refImages.length,
    tone:String(brand.defaultTone || (brand.useBrandVoice !== false && (normalizeBrandTone(brand.brandTone)?.summary || (normalizeBrandTone(brand.brandTone)?.method ? 'Tom salvo na marca' : ''))) || '').trim(),
    hasBrief:!!kit.contextMd.trim(),
  };
}

/** Capture only visual identity so returning from a preset never reverts copy or media edits. */
export function captureCreationVisualIdentity(brand = {}) {
  return {
    ...sanitizeCustomVisualPresetBrand(brand),
    customTitleFont:brand.customTitleFont ? JSON.parse(JSON.stringify(brand.customTitleFont)) : null,
    customBodyFont:brand.customBodyFont ? JSON.parse(JSON.stringify(brand.customBodyFont)) : null,
  };
}

/** Every preset is applied over the same identity, not over the previous preview. */
export function applyCreationVisualChoice(currentBrand, identityVisuals, preset = null) {
  const next = { ...currentBrand };
  for (const key of Object.keys(sanitizeCustomVisualPresetBrand(currentBrand))) delete next[key];
  delete next.customTitleFont;
  delete next.customBodyFont;
  Object.assign(next, JSON.parse(JSON.stringify(identityVisuals || {})));
  if (preset) {
    const tokens = sanitizeCustomVisualPresetBrand(preset.brand);
    Object.assign(next, tokens);
    if (tokens.titleFont) next.customTitleFont = null;
    if (tokens.bodyFont) next.customBodyFont = null;
  }
  return next;
}
