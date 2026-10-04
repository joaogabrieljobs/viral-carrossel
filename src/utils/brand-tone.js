/**
 * Tom de voz da marca — analisado a partir do brief + identidade verbal.
 * Camada transversal: acompanha QUALQUER modo narrativo (não é um modo).
 * Preferência `brand.useBrandVoice` (default true) activa a voz na geração.
 */

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

/** Normaliza o objeto persistido em `brand.brandTone`. */
export function normalizeBrandTone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = asString(raw.summary, 280);
  const method = asString(raw.method, 4000);
  if (!summary && !method) return null;
  return {
    summary: summary || 'Tom da marca',
    traits: asStringList(raw.traits, TRAIT_MAX),
    do: asString(raw.do, FIELD_MAX),
    dont: asString(raw.dont, FIELD_MAX),
    narrativeArc: asString(raw.narrativeArc, FIELD_MAX),
    samplePhrases: asStringList(raw.samplePhrases, PHRASE_MAX, 120),
    method: method || buildBrandToneMethod({
      summary,
      traits: asStringList(raw.traits, TRAIT_MAX),
      do: asString(raw.do, FIELD_MAX),
      dont: asString(raw.dont, FIELD_MAX),
      narrativeArc: asString(raw.narrativeArc, FIELD_MAX),
      samplePhrases: asStringList(raw.samplePhrases, PHRASE_MAX, 120),
    }),
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
  const arc = asString(tone.narrativeArc, FIELD_MAX);
  const samples = asStringList(tone.samplePhrases, PHRASE_MAX, 120);

  return `MÉTODO TOM DA MARCA — voz e narrativa próprias (escala ao N de slides):
Objetivo: escrever o carrossel INTEIRO nesta voz, como se a marca falasse — não use fórmulas de outros modos (editorial, viral, storytelling genérico) salvo quando encaixem nesta voz.
Perfil: ${summary}
${traits.length ? `Traços de voz: ${traits.join('; ')}.` : ''}
${doList ? `FAÇA:\n${doList}` : ''}
${dont ? `EVITE:\n${dont}` : ''}
${arc ? `Arco narrativo preferido:\n${arc}` : 'Arco: hook na voz da marca → miolo com camadas coerentes com o perfil → fecho com CTA/pergunta no mesmo tom.'}
${samples.length ? `Referência de fraseado (imite o espírito, não copie):\n${samples.map((s) => `• "${s}"`).join('\n')}` : ''}
- Slide 1 · HOOK na voz da marca (não force tese contraintuitiva se o tom for sóbrio; não force urgência se o tom for calmo).
- Slides do meio: uma ideia nova por card, léxico e ritmo alinhados ao perfil.
- Último slide: fecho coerente com a assinatura da marca (pergunta ou save com utilidade).
REGRA: se o brief do projeto contradisser um traço, priorize o brief factual; mantenha o tom.`;
}

/** Prompt JSON para a IA analisar brief + identidade e devolver o perfil. */
export function buildBrandToneAnalysisPrompt({ brand = {}, styleKit = {}, projectName = '' } = {}) {
  const brief = asString(styleKit?.contextMd, 14000);
  const style = asString(styleKit?.stylePrompt, 2000);
  const nome = asString(projectName || styleKit?.name || brand?.handle || 'a marca', 80);

  return `Você é estrategista de voz de marca. Analise o material abaixo e devolva o TOM DE VOZ + NARRATIVA da marca "${nome}" para carrosséis Instagram.

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
  "do": "bullet points do que a voz FAZ (ritmo, vocabulário, ângulo)",
  "dont": "bullet points do que a voz EVITA",
  "narrativeArc": "como esta marca estrutura um carrossel (hook → miolo → fecho) na própria voz",
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
    narrativeArc: asString(src.narrativeArc, FIELD_MAX),
    samplePhrases: asStringList(src.samplePhrases, PHRASE_MAX, 120),
    analyzedAt: new Date().toISOString(),
  };
  draft.method = buildBrandToneMethod(draft);
  return normalizeBrandTone(draft);
}
