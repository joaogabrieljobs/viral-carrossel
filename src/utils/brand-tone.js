/**
 * Tom de voz da marca — analisado a partir do brief + identidade verbal.
 * Camada transversal: acompanha QUALQUER modo narrativo (não é um modo).
 * Preferência `brand.useBrandVoice` (default true) activa a voz na geração.
 */

import { buildSocialToneEvidenceBlock } from './social-tone.js';
import { extractJSON } from './parsers.js';

const FIELD_MAX = 1200;
const TRAIT_MAX = 8;
const PHRASE_MAX = 6;

const TONE_KEY_ALIASES = Object.freeze({
  summary: ['summary', 'resumo', 'perfil', 'descricao', 'descrição'],
  traits: ['traits', 'tracos', 'traços', 'caracteristicas', 'características'],
  do: ['do', 'faca', 'faça', 'fazer', 'recomendacoes', 'recomendações'],
  dont: ['dont', 'evite', 'evitar', 'nao_fazer', 'não_fazer'],
  ctaStyle: ['ctastyle', 'cta_style', 'estilocta', 'estilo_cta', 'cta'],
  samplePhrases: ['samplephrases', 'sample_phrases', 'frasesexemplo', 'frases_exemplo', 'exemplos'],
});

function asString(v, max = FIELD_MAX) {
  return String(v || '').trim().slice(0, max);
}

function asStringList(v, maxItems, itemMax = 80) {
  const values = Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? v.split(/\n|[;•|]/)
      : [];
  return values
    .map((x) => asString(x, itemMax))
    .filter(Boolean)
    .slice(0, maxItems);
}

function stripDiacritics(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function readToneField(source, field) {
  if (!source || typeof source !== 'object') return undefined;
  const aliases = TONE_KEY_ALIASES[field] || [field];
  const entries = Object.entries(source);
  const match = entries.find(([key]) => aliases.includes(stripDiacritics(key).replace(/[\s-]/g, '_')));
  return match?.[1];
}

function unwrapTonePayload(raw) {
  let value = raw;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      value = value[0];
      continue;
    }
    if (readToneField(value, 'summary') != null || readToneField(value, 'traits') != null) return value;
    value = value.result
      ?? value.data
      ?? value.output
      ?? value.content
      ?? value.message?.content
      ?? value.choices?.[0]?.message?.content;
  }
  return value;
}

function repairJsonText(raw) {
  const input = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  let out = '';
  let inString = false;
  let escaped = false;
  for (const char of input) {
    if (escaped) {
      out += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      out += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      out += char;
      continue;
    }
    if (inString && char === '\n') {
      out += '\\n';
      continue;
    }
    if (inString && char === '\r') continue;
    if (inString && char === '\t') {
      out += '\\t';
      continue;
    }
    out += char;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

function parseLabeledToneText(raw) {
  const text = String(raw || '').replace(/```/g, '').trim();
  const labels = {
    summary: 'summary|resumo|perfil|descri(?:ç|c)ão',
    traits: 'traits|tra(?:ç|c)os|caracter(?:í|i)sticas',
    do: 'do|fa(?:ç|c)a|fazer|recomenda(?:ç|c)(?:ões|oes)',
    dont: "don't|dont|evite|evitar|n(?:ã|a)o fazer",
    ctaStyle: 'ctaStyle|cta_style|estilo(?: do)? cta|cta',
    samplePhrases: 'samplePhrases|sample_phrases|frases? exemplo|exemplos',
  };
  const found = {};
  const allLabels = Object.values(labels).join('|');
  for (const [field, label] of Object.entries(labels)) {
    const pattern = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:["'*_-]\\s*)?(?:${label})(?:\\s*["'*_-])?\\s*[:：-]\\s*([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*)?(?:["'*_-]\\s*)?(?:${allLabels})(?:\\s*["'*_-])?\\s*[:：-]|$)`, 'i');
    const match = text.match(pattern);
    if (match?.[1]?.trim()) found[field] = match[1].trim();
  }
  return Object.keys(found).length >= 2 ? found : null;
}

function normalizeAnalysisFields(source) {
  return {
    summary: asString(readToneField(source, 'summary'), 280),
    traits: asStringList(readToneField(source, 'traits'), TRAIT_MAX),
    do: asString(readToneField(source, 'do'), FIELD_MAX),
    dont: asString(readToneField(source, 'dont'), FIELD_MAX),
    ctaStyle: asString(readToneField(source, 'ctaStyle'), FIELD_MAX),
    samplePhrases: asStringList(readToneField(source, 'samplePhrases'), PHRASE_MAX, 120),
  };
}

/**
 * Interpreta a resposta do provedor sem exigir que ela venha num único formato.
 * Mantém a validação do conteúdo: wrappers, aliases e pequenos desvios de JSON
 * são aceitos, mas texto sem um perfil de voz utilizável continua sendo erro.
 */
export function parseBrandToneAnalysisResponse(raw) {
  let source = unwrapTonePayload(raw);
  if (typeof source === 'string') {
    try {
      source = extractJSON(source);
    } catch {
      try {
        source = extractJSON(repairJsonText(source));
      } catch {
        source = parseLabeledToneText(source);
      }
    }
    source = unwrapTonePayload(source);
    if (typeof source === 'string') {
      try { source = extractJSON(repairJsonText(source)); }
      catch { source = parseLabeledToneText(source); }
    }
  }
  const normalized = normalizeAnalysisFields(source);
  const evidenceCount = [
    normalized.summary,
    normalized.traits.length ? normalized.traits.join(' ') : '',
    normalized.do,
    normalized.dont,
    normalized.ctaStyle,
    normalized.samplePhrases.length ? normalized.samplePhrases.join(' ') : '',
  ].filter(Boolean).length;
  if (!normalized.summary || evidenceCount < 2) {
    throw new Error('A análise voltou incompleta. Tente novamente — suas fontes continuam salvas.');
  }
  return normalized;
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
  const src = normalizeAnalysisFields(raw && typeof raw === 'object' ? raw : {});
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
