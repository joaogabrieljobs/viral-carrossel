/**
 * Tom de voz da marca — analisado a partir do brief + identidade verbal.
 * Camada transversal: acompanha QUALQUER modo narrativo (não é um modo).
 * Preferência `brand.useBrandVoice` (default true) activa a voz na geração.
 */

import { buildSocialToneEvidenceBlock } from './social-tone.js';

const FIELD_MAX = 1200;
const TRAIT_MAX = 8;
const PHRASE_MAX = 6;

function asString(v, max = FIELD_MAX) {
  return String(v || '').trim().slice(0, max);
}

function asStringList(v, maxItems, itemMax = 80) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => asString(x, itemMax))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isLegacyGeneratedMethod(method) {
  return /voz e narrativa próprias|não use fórmulas de outros modos|arco narrativo preferido|slide 1 · hook/i.test(method);
}

/** Normaliza o objeto persistido em `brand.brandTone`. */
export function normalizeBrandTone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = asString(raw.summary, 280);
  const method = asString(raw.method, 4000);
  if (!summary && !method) return null;
  const normalizedFields = {
    summary,
    traits: asStringList(raw.traits, TRAIT_MAX),
    do: asString(raw.do, FIELD_MAX),
    dont: asString(raw.dont, FIELD_MAX),
    ctaStyle: asString(raw.ctaStyle, FIELD_MAX),
    samplePhrases: asStringList(raw.samplePhrases, PHRASE_MAX, 120),
  };
  return {
    summary: summary || 'Tom da marca',
    traits: normalizedFields.traits,
    do: normalizedFields.do,
    dont: normalizedFields.dont,
    ctaStyle: normalizedFields.ctaStyle,
    // Campo legado mantido para round-trip de projetos antigos. Não entra no
    // método: o arco pertence ao modo narrativo escolhido pelo usuário.
    narrativeArc: asString(raw.narrativeArc, FIELD_MAX),
    samplePhrases: normalizedFields.samplePhrases,
    method: !method || isLegacyGeneratedMethod(method)
      ? buildBrandToneMethod(normalizedFields)
      : method,
    analyzedAt: typeof raw.analyzedAt === 'string' ? raw.analyzedAt : null,
  };
}

export function brandToneIsReady(brand) {
  return !!normalizeBrandTone(brand?.brandTone)?.method;
}

/** Monta o bloco MÉTODO injetado no prompt de geração. */
export function buildBrandToneMethod(tone = {}) {
  const summary = asString(tone.summary, 280) || 'voz própria da marca';
  const traits = asStringList(tone.traits, TRAIT_MAX);
  const doList = asString(tone.do, FIELD_MAX);
  const dont = asString(tone.dont, FIELD_MAX);
  const ctaStyle = asString(tone.ctaStyle, FIELD_MAX);
  const samples = asStringList(tone.samplePhrases, PHRASE_MAX, 120);

  return `MÉTODO TOM DA MARCA — camada de voz transversal:
Objetivo: escrever o carrossel inteiro como se a marca falasse. Este método governa vocabulário, ritmo, postura, exemplos e CTA. O modo narrativo selecionado governa o arco e a função de cada slide; preserve-o.
Perfil: ${summary}
${traits.length ? `Traços de voz: ${traits.join('; ')}.` : ''}
${doList ? `FAÇA:\n${doList}` : ''}
${dont ? `EVITE:\n${dont}` : ''}
${samples.length ? `Referência de fraseado (imite o espírito, não copie):\n${samples.map((s) => `• "${s}"`).join('\n')}` : ''}
${ctaStyle ? `Estilo de CTA:\n${ctaStyle}` : 'CTA: mantenha a postura da marca e cumpra a função de fecho definida pelo modo narrativo.'}
REGRA: se o brief do projeto contradisser um traço, priorize o brief factual; mantenha o tom.`;
}

/** Prompt JSON para a IA analisar brief + identidade e devolver o perfil. */
export function buildBrandToneAnalysisPrompt({
  brand = {},
  styleKit = {},
  projectName = '',
  socialEvidence = null,
} = {}) {
  const brief = asString(styleKit?.contextMd, 14000);
  const style = asString(styleKit?.stylePrompt, 2000);
  const nome = asString(projectName || styleKit?.name || brand?.handle || 'a marca', 80);
  const socialBlock = buildSocialToneEvidenceBlock(socialEvidence);

  return `Você é estrategista de voz de marca. Analise o material abaixo e devolva o TOM DE VOZ da marca "${nome}" para carrosséis Instagram.

O perfil deve orientar vocabulário, ritmo, postura, exemplos e CTA. Não defina sequência de slides nem arco narrativo: isso será controlado separadamente pelo modo narrativo escolhido pelo usuário.

${socialBlock}

IDENTIDADE VERBAL:
• Bio: ${asString(brand.bio, 600) || '(vazio)'}
• Posicionamento: ${asString(brand.positioning, 600) || '(vazio)'}
• Tom já indicado: ${asString(brand.defaultTone, 200) || '(vazio)'}
• Público: ${asString(brand.defaultAudience, 200) || '(vazio)'}
• Assinatura/CTA: ${asString(brand.signature, 200) || '(vazio)'}

BRIEF / CONTEXTO DO PROJETO:
${brief || '(sem brief — use só a identidade verbal; se tudo estiver vazio, invente um perfil editorial sóbrio e declare a incerteza no summary)'}

DIREÇÃO VISUAL (só para inferir tom, não descreva layout):
${style || '(vazio)'}

Responda APENAS com JSON válido (sem markdown):
{
  "summary": "1 frase curta do tom (ex.: direto, editorial, sem motivacional)",
  "traits": ["3 a 6 adjetivos/traços curtos"],
  "do": "bullet points do que a voz FAZ (vocabulário, ritmo, postura e exemplos)",
  "dont": "bullet points do que a voz EVITA",
  "ctaStyle": "como a marca convida a agir sem mudar de voz",
  "samplePhrases": ["2 a 4 frases curtas no tom da marca, originais"]
}`;
}

/** Converte resposta da IA + monta method persistido. */
export function brandToneFromAnalysis(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const draft = {
    summary: asString(src.summary, 280),
    traits: asStringList(src.traits, TRAIT_MAX),
    do: asString(src.do, FIELD_MAX),
    dont: asString(src.dont, FIELD_MAX),
    ctaStyle: asString(src.ctaStyle, FIELD_MAX),
    // Compatibilidade de leitura; não será injetado como regra de arco.
    narrativeArc: asString(src.narrativeArc, FIELD_MAX),
    samplePhrases: asStringList(src.samplePhrases, PHRASE_MAX, 120),
    analyzedAt: new Date().toISOString(),
  };
  draft.method = buildBrandToneMethod(draft);
  return normalizeBrandTone(draft);
}
