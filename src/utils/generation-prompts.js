/**
 * PROMPTS DE GERAÇÃO — extraído do monólito ViralCarrossel.jsx (backlog#8 parte 2).
 * Tudo aqui é puro (strings/dados/fetch de fontes) — zero React de render.
 * Único consumidor: ViralCarrossel.jsx. attachGenerationCanvasLayouts ficou no
 * monólito (acoplado ao motor de canvas), importando os helpers daqui.
 */
import {
  Newspaper, Brain, HeartHandshake, TrendingUp, BookOpen,
  GraduationCap, ScrollText, Megaphone,
} from 'lucide-react';
import { TEMPLATES, PALETTES } from './design-data.js';
import { REFERENCE_PROFILE_BY_ID } from './brand-visuals.js';

// Cada modo substitui a seção MÉTODO no prompt. Todos devem escalar ao número
// de slides pedido (hook → meio(s) → fecho), sem assumir sempre 5 slides no miolo.
const GEN_MODES = [
  {
    id: 'editorial',
    Icon: Newspaper,
    label: 'Editorial',
    desc: 'Tese forte, camadas de mercado e leitura que desmonta o óbvio',
    method: `MÉTODO EDITORIAL — leitura estratégica (escala ao número total de slides):
Objetivo: soar como análise de quem enxerga categoria, não como post motivacional.
- Slide 1 · HOOK/Tese: uma frase-tese contraintuitiva que para o scroll. Formatos úteis: "X não está fazendo Y, está fazendo Z.", "Não é sobre X. É sobre Y.", "Todo mundo viu X. Pouca gente entendeu Y.", "O mercado de X deixou de ser sobre Y. Agora é sobre Z."
- Slides do meio (2 até penúltimo): cada um = UMA camada nova — sem repetir o mesmo tipo de argumento. Ordens possíveis (combine conforme N): contexto de mercado → onde a leitura óbvia quebra → mecanismo ou estrutura por trás → impacto na categoria ou no consumidor → erro recorrente → contraste com o que "todo mundo faz". Vocabulário útil quando couber: categoria, distribuição, posicionamento, percepção, comportamento, recorrência, narrativa (da categoria), repertório, diferenciação, sinal, confiança.
- Último slide · Fecho: elegante, reflexivo (não obrigatoriamente "ganhe dinheiro"). Ex.: "Quem entende isso constrói marca. Quem ignora disputa preço." / "Salve antes da próxima campanha."
EVITE: tom de guru, frase vazia de inspiração, repetir "insights" genéricos em vários slides.`,
  },
  {
    id: 'deep',
    Icon: Brain,
    label: 'Profundo',
    desc: 'Autopsia do tema — variáveis, padrão escondido, o que muda na prática',
    method: `MÉTODO PROFUNDO — anatomia do fenômeno (modo "patologista"; escala ao N de slides):
Disseque o tema: variáveis, padrões, hipóteses testáveis. Zero "seja autêntico", zero conselho genérico.
- Slide 1 · HOOK: tese contraintuitiva que expõe um padrão escondido. Ex.: "Não existe X. Existe Y." / "Todo mundo mede X. O que importa é Y." / "X não é o problema. É sintoma."
- Slides do meio — distribua estas ETAPAS ao longo dos slides 2…penúltimo (se N for pequeno, una etapas adjacentes; se N for grande, detalhe mais dentro da mesma etapa):
  (A) AUTÓPSIA — o que acontece por dentro do fenômeno (mecanismo, não aparência): gatilho, fricção, atrito, sinal, ciclo, dependência.
  (B) PADRÃO OCULTO — princípio que conecta casos visíveis; nomeie o que se repete.
  (C) DEMONSTRAÇÃO — um caso onde o padrão aparece em ação.
  (D) IMPLICAÇÃO — o que muda na decisão ou na leitura quando você enxerga isso.
- Último slide · CTA: reflexivo, sem urgência falsa. Ex.: "Quem enxerga padrão vence quem corre atrás de truque."
Vocabulário preferido: mecanismo, gatilho, sinal, distribuição, comportamento, recorrência, fricção, antecipação, hipótese, variável, sistema. EVITE: hack, segredo, fórmula mágica.`,
  },
  {
    id: 'pain',
    Icon: HeartHandshake,
    label: 'Odisseia da Dor',
    desc: 'Nomeia a dor, valida, mostra o que falhou e uma saída honesta',
    method: `MÉTODO ODISSEIA DA DOR — jornada empática (escala ao N de slides):
Escreva para quem sofre com o tema agora. Nomear, validar, expor o ciclo, apontar direção pequena e real — não promessa. Tom sóbrio e perto; ZERO "você consegue", ZERO performance coaching.
- Slide 1 · IDENTIFICAÇÃO: o sentimento que o leitor mal consegue nomear — preciso o suficiente para ele pensar "sou eu". Ex.: "Você fez tudo certo. E ainda assim travou." / "Você não está cansado. Está exausto de fingir que está bem."
- Slides do meio — distribua ao longo de 2…penúltimo:
  VALIDAÇÃO (detalhes sensoriais e situações concretas da dor),
  FALSO REMÉDIO (o que tentaram e por que não segurou — sem julgar),
  RAIZ (mecanismo; sintoma vs causa — o que muda a autoimagem),
  SAÍDA (ângulo honesto e possível hoje — não milagre).
Se poucos slides: priorize validação → raiz → saída.
- Último slide: convite gentil. Ex.: "Salve pra reler quando o ciclo voltar." / pergunta nos comentários qual frase doeu primeiro.
Vocabulário: ciclo, raiz, sintoma, exaustão, repetição, pausa, presença. EVITE: jornada, mindset, foco, você nasceu pra isso.`,
  },
  {
    id: 'viral',
    Icon: TrendingUp,
    label: 'Viral Trends',
    desc: 'Parada de scroll, loop de tensão, prova e frase para guardar ou mandar',
    method: `MÉTODO VIRAL TRENDS — retenção e clareza algorítmica (escala ao N de slides):
Cada slide tem função para segurar o dedo e completar o arco. 90% morre no slide 1 — o hook decide tudo.
- Slide 1 · PARADA DE SCROLL (≤0,5s): UMA técnica abaixo. PROIBIDO abrir com "Hoje vou te ensinar", "Você sabia que", "5 dicas infalíveis".
  • INTERRUPÇÃO — contraria a expectativa do nicho.
  • PROMESSA NUMÉRICA específica — "3 decisões que mudam [X] em [prazo]."
  • REVELAÇÃO ATRASADA — resultado primeiro, causa depois.
  • IDENTIFICAÇÃO brutal — "isso sou eu."
  • PERGUNTA que tira sono — a dúvida às 2h.
- Slides do meio — distribua funções (repetir ou expandir se N for grande):
  BUILD-UP (abre loop; atrasa resposta),
  DESENVOLVIMENTO (prova parcial, autoridade rápida sem paper acadêmico),
  SHARE-TRIGGER (uma frase quotável memorável),
  PAYOFF (fecha o loop — o "ahá").
- Último slide: pergunta real nos comentários OU save com motivo concreto. EVITE: "segue pra mais", "marca o amigo", "compartilha se gostou".
Tom: curto, rápido, confiante; urgência sem sensacionalismo.`,
  },
  {
    id: 'storytelling',
    Icon: BookOpen,
    label: 'Storytelling',
    desc: 'História com arco — cena, tempo e virada (não headline de pitch)',
    method: `MÉTODO STORYTELLING — narrativa em cena (escala ao N de slides):
Conte uma história sobre o tema; não explique em modo manual. Cenas com tempo, lugar, gesto, detalhe verificável. Evite título conceitual genérico ("X: uma reflexão") no lugar de imagem viva.
- Slide 1 · IN MEDIAS RES: entre no meio da ação. Ex.: "Era 23h e ela releu o e-mail pela quinta vez." / "O cliente desligou antes da segunda frase."
- Slides do meio — distribua ao longo de 2…penúltimo:
  CONTEXTO (o que estava em jogo; sensorial),
  VIRADA (um evento concreto que muda tudo — número, fala, objeto),
  CONSEQUÊNCIA (como fica o mundo depois),
  e se couber GENERALIZAÇÃO leve (o que isso significa além deste caso) — antes do fecho.
Se poucos slides: contexto → virada → consequência.
- Último slide: convite a partilhar experiência. Ex.: "Já te aconteceu algo assim?" / "Qual foi teu '23h' com [tema]?"
Use verbos no passado/presente; EVITE "muitas pessoas", "em geral", gerúndio em excesso.`,
  },
  {
    id: 'how_to',
    Icon: GraduationCap,
    label: 'Passo-a-passo',
    desc: 'Manual — um passo por slide, imperativo e verificável',
    method: `MÉTODO PASSO-A-PASSO — tutorial replicável (escala ao N de slides):
Sem palestra motivacional. O leitor deve sair sabendo o que fazer na ordem certa.
- Slide 1 · PROMESSA: deixe explícito resultado + número de passos (alinhado ao total de slides intermediários). Ex.: "Como [resultado] em [K] passos."
- Slides do meio (2 até penúltimo): UM PASSO POR SLIDE, numerados em sequência real (Passo 1… Passo K). Em cada um:
  • TÍTULO: "Passo N · [verbo + objeto]" (nome curto e ativo).
  • SUBTÍTULO: (1) imperativo do que fazer; (2) como fazer com precisão; (3) erro comum OU mini-exemplo.
  Linguagem imperativa: "Identifique…", "Anote…", "Compare…" — evite "é importante que você…".
- Penúltimo slide (se K≥2): o ERRO que faz a maioria falhar mesmo seguindo o roteiro — específico ao tema.
- Último slide: save com utilidade + pergunta sobre qual passo testar primeiro.
Se houver mais slides que passos necessários: acrescente slide de checklist rápido ou variação do passo mais crítico — não encha com teoria.`,
  },
  {
    id: 'jornalistico',
    Icon: ScrollText,
    label: 'Jornalístico',
    desc: 'Fio tipo capa digital: selo de editoria, manchete e texto em pirâmide invertida',
    method: `MÉTODO JORNALÍSTICO — fio editorial / digital first (escala ao N de slides):
Soar como postagem de veículo sério ou newsletter de analítico — não viral barulhento nem pitch de marca.
- Slide 1 · CAPA: hierarquia de três camadas quando couber ao formato do JSON (use título e subtítulo de forma criativa para isso):
  (A) SELO/CATEGORIA — uma linha curta em tom de editoria em CAIXA ALTA OU caixa alta suave (ex.: "ANÁLISE", "MERCADO", "[NICHO]").
  (B) MANCHETE — frase forte, pode ser maior e mais objetiva que um hook meme; até ~12 palavras se precisar densidade.
  (C) LEAD/NUT — 1 linha ou 2 máximas: o "por que importa agora", factual e direto — sem perguntinha vazia.
- Slides do meio (2…penúltimo): cada um como BLOCO DE MATÉRIA — parágrafos curtos (estilo pirâmide invertida: fato/implicação → contexto → detalhe). Um slide = uma peça da história ou um ângulo novo (who/what/when/why/so what). Vocabulário: fonte implícita, consequência, precedente, cenário — sem jargão de guru.
- Último slide · FECHO: linha-editorial ou o que falta saber próximo — convite sóbrio (pergunta precisa ou "salve para acompanhar").
EVITE: "X mudou tudo" sem nuance; clickbait que o miolo não sustenta; tom de relatório institucional de marca.`,
  },
  {
    id: 'sensacionalista',
    Icon: Megaphone,
    label: 'Sensacionalista',
    desc: 'Ganchos tipo tablóide, tensão extrema e viradas — sem mentir nem prometer miragem',
    method: `MÉTODO SENSACIONALISTA — alto impacto, tom de tablóide moderno (escala ao N de slides):
Máximo drama na forma, honestidade no conteúdo: pode exagerar RITMO e TENSÃO lexical, não fatos nem promessas.
- Slide 1 · BERRANTE CONTROLADO — UMA destas âncoras (troque conforme tema):
  • REVELAÇÃO com custo ("O que ninguém te contou sobre [X]").
  • NÚMERO ou prazo espremido ("3 dias de [cenário] e já dá pra ver…").
  • PERGUNTA que arranha ("Por que [grupo] ainda acredita em [Y]?").
  PROIBIDO: "chocante!", "você não vai acreditar" vazio, ou prometer prova que o carrossel não entrega.
- Slides do meio — distribua tensão máxima: cada slide abre novo micro-gancho OU fecha um aberto antes; uso de cortes curtos, frases de efeito, contraste visceral ("parecia X / era Y"). Um slide deve ter a frase "compartilhável" de choque sóbrio quando houver espaço — não vulgaridade gratuita.
- Último slide: payoff real (o que ficou provado neste carrossel) + pergunta inflamável NOS FATOS OU save — sem arme-se sem fechar o arco.
Tom: urgência, segunda pessoa só quando intensificar impacto — sem moralismo.`,
  },
];
const GEN_MODE_BY_ID = Object.fromEntries(GEN_MODES.map(m => [m.id, m]));

function quickTemplateIdFromPreset(presetId) {
  if (presetId == null || typeof presetId !== 'string') return null;
  if (!presetId.startsWith('quick_')) return null;
  const tid = presetId.slice('quick_'.length);
  return TEMPLATES.some((t) => t.id === tid) ? tid : null;
}

function isQuickTemplatePreset(presetId) {
  return quickTemplateIdFromPreset(presetId) != null;
}

/** Entradas «Carbon / Midnight …» no seletor de pacote — mesmos arquétipos que Templates prontos. */
const QUICK_TEMPLATE_CREATIVE_PRESET_ENTRIES = TEMPLATES.map((t) => {
  const pal = PALETTES[t.palette] || PALETTES[0];
  return {
    id: `quick_${t.id}`,
    label: t.name,
    desc: `${t.desc} · Paleta ${pal.name} · arco fixo (sem modo narrativo, nicho ou público — como Templates prontos).`,
  };
});

function isPersoHybridDensity(presetId, densityId) {
  return presetId === 'livre' && (densityId === '1_1' || densityId === '1_2');
}

function buildPersoHybridLayoutBlock(slideCount, textDensityId = '1_1') {
  const n = Math.min(12, Math.max(2, slideCount | 0));
  const { subLo, subHi, bodyLo, bodyHi } = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
  return `
LAYOUT VISUAL HÍBRIDO (Personalizado · densidade ${SLIDE_TEXT_DENSITY_BY_ID[textDensityId]?.label || textDensityId} — prioridade quando ativo):

- Slide 1 e Slide 2: CAPA tipo tela inteira (“full-bleed”) — só "title", "subtitle" e "imageQuery". O campo "bodyAfterImage" DEVE ser exatamente "" (vazio).

- Slide 3 a Slide ${n} (todos quando N≥3): miolo formato sanduíche (como Pacote Tendência/Cultura): bloco inicial em "subtitle" (+ "title" se fizer sentido) ACIMA da fotografia embutida, e payoff em "bodyAfterImage" ABAIXO da foto. Quando incluir foto no card ("imageQuery" preenchido), preencha **subtitle** com **${subLo}–${subHi}** caracteres (prosa de várias frases, não headline solta) e **bodyAfterImage** com **${bodyLo}–${bodyHi}** caracteres. Destaque lexical: UM trecho entre **asteriscos duplos**.
- Opcionalmente "cultureTone": "", "light", "dark" ou "accent" (mesmo significado visual do Pacote Cultura).
- Slide só texto SEM foto neste formato: imageQuery ""; use "subtitle" + "bodyAfterImage" em dupla coluna tipográfica (sem sanduíche de foto).
`;
}

// ─── PROMPT BUILDERS ──────────────────────────────────────────────────────────
// Constroem blocos opcionais que enriquecem o prompt da IA com identidade verbal
// (do brand) e material de referência (do material). São injetados em todos os
// fluxos: handleGenerate, refineSlide, refineAll, generateCaption, hookVariations.

const buildBrandBlock = (brand) => {
  const parts = [];
  if (brand?.bio?.trim())         parts.push(`• Sobre o perfil: ${brand.bio.trim()}`);
  if (brand?.positioning?.trim()) parts.push(`• Posicionamento: ${brand.positioning.trim()}`);
  if (brand?.signature?.trim())   parts.push(`• Assinatura/CTA recorrente: ${brand.signature.trim()}`);
  if (brand?.handle?.trim() && brand.handle !== '@seu.perfil')
    parts.push(`• Perfil: ${brand.handle.trim()}`);
  if (!parts.length) return '';
  return `\nIDENTIDADE VERBAL DA MARCA (use como contexto de tom, voz e coerência):\n${parts.join('\n')}\n`;
};

// Traduz os 4 sliders de direção de imagem em instruções precisas para a IA
// que escreve a `imageQuery` (em português, segue o estilo do prompt geral).
// Apenas valores fora da faixa neutra (35..65) emitem instrução — assim os
// sliders no meio significam "deixa a IA decidir, sem opinião forte".
const buildImgParamsBlockPT = (p) => {
  if (!p) return '';
  const lines = [];
  // Fidelidade (low=metafórico · high=literal)
  if (p.fidelity >= 75)      lines.push('• FIDELIDADE ALTA: a imageQuery DEVE retratar literalmente o tema do slide. Sujeitos e objetos diretamente reconhecíveis e nomeados.');
  else if (p.fidelity >= 60) lines.push('• Fidelidade média-alta: a imageQuery deve mostrar elementos diretos do tema, sem ser metafórica demais.');
  else if (p.fidelity <= 25) lines.push('• FIDELIDADE BAIXA: imageQueries 100% metafóricas. NUNCA mostre o tema literalmente — sugira por atmosfera, gesto ou objeto periférico apenas.');
  else if (p.fidelity <= 40) lines.push('• Fidelidade baixa: prefira sugerir o tema indiretamente.');
  // Criatividade
  if (p.creativity >= 75)      lines.push('• CRIATIVIDADE ALTA: composições inusitadas, ângulos inesperados, contraposições visuais, simbolismo sutil, justaposições conceituais.');
  else if (p.creativity >= 60) lines.push('• Criatividade média-alta: composições com algum elemento inesperado.');
  else if (p.creativity <= 25) lines.push('• CRIATIVIDADE BAIXA: composições convencionais e diretas. Enquadramento clássico editorial. Nada experimental.');
  else if (p.creativity <= 40) lines.push('• Criatividade baixa: composições convencionais e seguras.');
  // Irreverência
  if (p.irreverence >= 75)      lines.push('• IRREVERÊNCIA ALTA: humor sutil, situações cheeky, cenas inusitadas, leve desconforto cômico, quebra do esperado, momentos absurdos do cotidiano.');
  else if (p.irreverence >= 60) lines.push('• Irreverência média-alta: aceite cenas levemente humoradas ou inesperadas.');
  else if (p.irreverence <= 25) lines.push('• TOM SÉRIO: imagens contemplativas, sóbrias, formais, atemporais. Zero humor, zero ironia.');
  else if (p.irreverence <= 40) lines.push('• Tom sério: contemplativo, formal.');
  // Objetividade
  if (p.objectivity >= 75)      lines.push('• OBJETIVIDADE ALTA: cenas factuais e documentárias. Pessoas reais em ações concretas, ambientes reconhecíveis, sem ambiguidade visual.');
  else if (p.objectivity >= 60) lines.push('• Objetividade média-alta: cenas claras e factuais.');
  else if (p.objectivity <= 25) lines.push('• OBJETIVIDADE BAIXA: cenas atmosféricas, abstratas, evocativas. Emoção sobre fato. Detalhes ambíguos. Luz e atmosfera importam mais que ação.');
  else if (p.objectivity <= 40) lines.push('• Objetividade baixa: priorize atmosfera sobre ação.');
  if (!lines.length) return '';
  return `\n\nDIREÇÃO DE IMAGEM (eixos ajustados pelo usuário — siga estritamente):\n${lines.join('\n')}\n`;
};

// Versão em inglês compacta para injetar no prompt do GPT Image (OpenAI).
const buildImgParamsTagsEN = (p) => {
  if (!p) return '';
  const tags = [];
  if (p.fidelity >= 75)      tags.push('literal direct subject representation, theme clearly shown');
  else if (p.fidelity <= 25) tags.push('metaphorical indirect — never show the theme literally, only suggest through atmosphere');
  if (p.creativity >= 75)      tags.push('unconventional unexpected composition, conceptual juxtaposition, surprising angle');
  else if (p.creativity <= 25) tags.push('classic editorial composition, conventional framing, straight photography');
  if (p.irreverence >= 75)      tags.push('subtle wit and humor, slightly cheeky, unexpected mundane situations, dry comedy, broken expectation');
  else if (p.irreverence <= 25) tags.push('serious sober contemplative formal timeless tone, no humor');
  if (p.objectivity >= 75)      tags.push('documentary factual mode, real people in concrete actions, no ambiguity');
  else if (p.objectivity <= 25) tags.push('atmospheric evocative ambiguous, emotion over fact, light and mood dominate');
  if (!tags.length) return '';
  return `\nAdditional art direction (user adjusted): ${tags.join('; ')}.`;
};

const VC_ZWSP = /[\u200B-\u200D\uFEFF]/g;
function normalizeMaterialField(v) {
  if (v == null) return '';
  return String(v).replace(VC_ZWSP, '').trim();
}

/** Bloco é só linhas que parecem URL (ex.: link colado por engano em "Conteúdo base"). */
function isUrlOnlyNormalizedText(n) {
  if (!n) return false;
  const lines = n.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return false;
  return lines.every(
    (line) => /^https?:\/\/.+/i.test(line) || /^www\.[^\s]+$/i.test(line),
  );
}

/** Unifica leitura do material: URLs só em "Conteúdo base" contam como fontes no prompt. */
function normalizedMaterialPieces(material) {
  let c = normalizeMaterialField(material?.content);
  let s = normalizeMaterialField(material?.sources);
  const x = normalizeMaterialField(material?.context);
  if (c && isUrlOnlyNormalizedText(c) && !s) {
    s = c;
    c = '';
  }
  return { c, s, x };
}

/** Recolhe até 5 URLs únicas em «Conteúdo base», «Fontes» e «Contexto». */
function extractHttpUrlsFromMaterial(material) {
  const { c, s, x } = normalizedMaterialPieces(material);
  const blob = [c, s, x].filter(Boolean).join('\n');
  const found = new Set();
  const re = /https?:\/\/[^\s<>"'{}|\\^[\])]+/gi;
  let m;
  while ((m = re.exec(blob)) !== null) {
    let u = m[0].replace(/[,.;:!?)]+$/g, '');
    try {
      found.add(new URL(u).toString());
    } catch {
      /* ignorar token inválido */
    }
    if (found.size >= 6) break;
  }
  return [...found].slice(0, 5);
}

const FETCH_SOURCE_API = '/api/fetch-source';

/** Servidor (Vite dev ou Netlify) devolve JSON { text } — evita CORS do browser. */
async function fetchPlainTextFromUrl(url) {
  const qp = new URLSearchParams({ url });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 22000);
  try {
    const res = await fetch(`${FETCH_SOURCE_API}?${qp}`, { signal: ctl.signal });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const j =
      ct.includes('application/json')
        ? await res.json().catch(() => ({}))
        : {};
    if (!res.ok || j.ok === false) {
      throw new Error(j?.error || `HTTP ${res.status}`);
    }
    if (!ct.includes('application/json')) {
      throw new Error(
        'Leitura de URLs indisponível neste servidor. Use npm run dev (Vite local) ou o deploy Netlify deste projeto.',
      );
    }
    return String(j.text || '').trim();
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Tempo limite ao ler a URL');
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(t);
  }
}

async function fetchMaterialUrlSnippets(material) {
  const urls = extractHttpUrlsFromMaterial(material);
  const out = [];
  for (const url of urls) {
    try {
      const text = await fetchPlainTextFromUrl(url);
      out.push({ url, text });
    } catch (e) {
      out.push({ url, text: '', error: e?.message || String(e) });
    }
  }
  return out;
}

/** Monta os blocos de material para o prompt da IA e, se houver URL(s), obtém texto no servidor antes. `toastCb` opcional — (msg, kind, ttl?). */
async function resolveMaterialPromptParts(material, toastCb) {
  const urls = extractHttpUrlsFromMaterial(material);
  if (!urls.length) {
    return {
      materialBlock: buildMaterialBlock(material, []),
      materialPriorityBlock: buildMaterialPriorityBlock(material, []),
    };
  }
  toastCb?.('A ler texto das URLs em Fontes…', 'info', 2600);
  const urlSnippets = await fetchMaterialUrlSnippets(material);
  const ok = urlSnippets.filter((u) => String(u.text || '').trim().length >= 80).length;
  if (toastCb) {
    if (!ok && urls.length) {
      toastCb(
        'Não foi possível extrair texto da(s) URL (bloqueio, login ou formato). Cole o texto em «Conteúdo base» ou tente outro link.',
        'warning',
        6500,
      );
    } else if (ok < urls.length && urls.length > 1) {
      toastCb('Algumas URLs não devolveram texto; a IA usará as que funcionaram.', 'warning', 4500);
    }
  }
  return {
    materialBlock: buildMaterialBlock(material, urlSnippets),
    materialPriorityBlock: buildMaterialPriorityBlock(material, urlSnippets),
  };
}

function materialHasUserInput(material) {
  if (!material || typeof material !== 'object') return false;
  if (material.refProfileId) return true;
  const { c, s, x } = normalizedMaterialPieces(material);
  return !!(c || s || x);
}

const buildMaterialBlock = (material, urlSnippets = []) => {
  const parts = [];
  const { c, s, x } = normalizedMaterialPieces(material);
  const refId = material?.refProfileId;
  const ref = refId && REFERENCE_PROFILE_BY_ID[refId];

  const hasFetched = Array.isArray(urlSnippets) && urlSnippets.some((p) => p && (String(p.text || '').trim().length > 0 || String(p.url || '').length > 0));
  let fetchedBody = '';
  if (hasFetched) {
    const blobs = [];
    for (const p of urlSnippets) {
      if (!p?.url) continue;
      const body = String(p.text || '').trim()
        ? p.text.trim()
        : `[Não foi possível extrair texto: ${p.error || 'erro desconhecido'}]`;
      blobs.push(`=== ORIGEM ${p.url} ===\n${body.slice(0, 13000)}`);
    }
    if (blobs.length) {
      fetchedBody = blobs.join('\n\n').slice(0, 62000);
      parts.push(
        `TEXTO OBTIDO DAS FONTES (extraído automaticamente pelo app a partir das URL(s); use como BASE FACTUAL principal — sintetize com palavras próprias nos slides em português, sem cópia longa nem plagio):\n"""\n${fetchedBody}\n"""`,
      );
    }
  }

  if (c) parts.push(`MATÉRIA-PRIMA (use como base de fatos antes de inventar — extraia teses, não copie literal):\n"""\n${c.slice(0, 8000)}\n"""`);
  if (s) {
    const fetchedFull = Array.isArray(urlSnippets)
      ? urlSnippets.filter((u) => u.text && String(u.text).trim().length >= 120)
      : [];
    const srcLabel =
      fetchedFull.length > 0
        ? 'FONTES & REFERÊNCIAS (URL listada — o texto legível já foi transcrito para o bloco «TEXTO OBTIDO DAS FONTES» acima):'
        : /https?:\/\//i.test(s) || /\bwww\.[^\s]+\b/i.test(s)
          ? 'FONTES & REFERÊNCIAS (há URL(s) colada(s) sem extração bem-sucedida — use vocabulário do endereço e matéria-prima; não finja ler a página inteira):'
          : 'FONTES & REFERÊNCIAS (você pode citar/integrar quando relevante):';
    parts.push(`${srcLabel}\n${s.slice(0, 2000)}`);
  }
  if (x) parts.push(`INSTRUÇÕES ESPECÍFICAS DO USUÁRIO (sobrepõem regras default — siga literalmente):\n${x.slice(0, 1500)}`);
  if (ref?.promptBlock) {
    parts.push(
      `VOZ DE REFERÊNCIA — curadoria interna (inspire-se no ritmo, cadência e tom abaixo; não cite nomes de perfis nem reproduza posts reais):\n${ref.promptBlock}`,
    );
  }
  if (!parts.length) return '';
  return '\n' + parts.join('\n\n') + '\n';
};

/** Quando há Material, o tema livre do modal não pode sobrepor o que o usuário colou. */
function buildMaterialPriorityBlock(material, urlSnippets = []) {
  const { c, s, x } = normalizedMaterialPieces(material);
  const fetchedOk = Array.isArray(urlSnippets) && urlSnippets.some((p) => p && String(p.text || '').trim().length >= 80);
  if (!c && !s && !x && !fetchedOk) return '';

  let urlClause = `- URLs sem texto transcrito: você não navega na web. Se só houver link sem extração bem-sucedida, infira o tema só do vocabulário visível no URL + instruções + matéria-prima.\n`;

  if (fetchedOk) {
    urlClause = `- TEXTO EXTRAÍDO: o bloco «TEXTO OBTIDO DAS FONTES» contém conteúdo real obtido das páginas. O carrossel DEVE alinhar factos e ângulos a esse texto (parafraseando). NÃO ignore em favor do tema livre nem de clichês virais nem de “marcas/arquétipos” genéricos se o material fala de outro assunto.\n`;
  }

  return `
PRIORIDADE ABSOLUTA — MATERIAL DO USUÁRIO:
- O carrossel DEVE refletir o bloco MATÉRIA-PRIMA, FONTES e INSTRUÇÕES acima — e, quando existir, o TEXTO OBTIDO DAS FONTES. O campo “sobre o que é o conteúdo” e o nicho são SECUNDÁRIOS: servem para tom ou desambiguação, NÃO para trocar o assunto.
- PROIBIDO fabricar narrativa genérica de “rotina de trabalho” (madrugada, arquivo não carrega, tela azul, escritório vazio, café, deadline) se NADA disso estiver no material — isso descola o post do que o usuário forneceu.
${urlClause}- Cada slide deve extrair uma linha de raciocínio do MATERIAL (não de clichês de carrossel viral).
`;
}

/** Pacotes criativos da geração — id `livre` = Personalizado. Entre T/C e Personalizado: arquétipos «Templates prontos» (Erro Comum, Tendência de Mercado, …). */
const CREATIVE_PRESETS = [
  {
    id: 'tendencia_cultura',
    label: 'Tendência/Cultura',
    desc: 'Carrossel de tendência e cultura: nomeia o que o público já sente no mundo — não lista de dicas nem aula de conceito. Gatilhos: identificação, alívio, autoridade.',
  },
  ...QUICK_TEMPLATE_CREATIVE_PRESET_ENTRIES,
  {
    id: 'livre',
    label: 'Personalizado',
    desc: 'Modo narrativo, tom, marca, conteúdo de base e eixos de imagem — sem camada fixa “parece ser / é”. Melhor para Storytelling e quando a aba Conteúdo já está preenchida.',
  },
];
const CREATIVE_PRESET_BY_ID = Object.fromEntries(CREATIVE_PRESETS.map((p) => [p.id, p]));

/** Fração de volume de texto nos cards (persistido): 1/1 ≈ método padrão; menores → mais enxuto. */
const SLIDE_TEXT_DENSITY_OPTIONS = [
  { id: '1_1', label: '1/1', desc: 'Padrão do método — sanduíche com duas zonas de prosa densa (acima e abaixo da foto).' },
  { id: '1_2', label: '1/2', desc: '~Metade da densidade típica; frases proporcionalmente curtas.' },
  { id: '1_3', label: '1/3', desc: '~Um terço da densidade; telegráfico com substância.' },
  { id: '1_4', label: '1/4', desc: 'Mínimo corrido — batidas curtas.' },
  { id: '1_5', label: '1/5', desc: 'Mais esparso — quase só o essencial por card.' },
];
const SLIDE_TEXT_DENSITY_BY_ID = Object.fromEntries(SLIDE_TEXT_DENSITY_OPTIONS.map((o) => [o.id, o]));
/** Multiplicador sobre faixas “típicas” de caracteres do modo / editorial. */
const TEXT_DENSITY_TARGET_MULT = Object.freeze({
  1_1: 1,
  1_2: 0.72,
  1_3: 0.55,
  1_4: 0.38,
  1_5: 0.26,
});

function scaledCharBand(lo, hi, densityId) {
  const m = TEXT_DENSITY_TARGET_MULT[densityId];
  if (m == null || m >= 0.995) return { lo, hi };
  const nlo = Math.max(36, Math.round(lo * m));
  const nhi = Math.max(nlo + 16, Math.round(hi * m));
  return { lo: nlo, hi: nhi };
}

/**
 * Faixas de caracteres para miolo sanduíche T/C & híbrido personalizado (subtitle acima da foto + bodyAfterImage abaixo).
 * 1/1 segue referências editoriais densas (~50–90 palavras por zona quando o tema der), não resumo telegráfico.
 */
function tendenciaStyleSandwichCharBands(textDensityId = '1_1') {
  const mid = scaledCharBand(400, 620, textDensityId || '1_1');
  const subLo = Math.max(200, Math.round(mid.lo * 0.65));
  const subHi = Math.max(subLo + 60, Math.round(mid.hi * 0.65));
  const bodyLo = Math.max(200, Math.round(mid.lo * 0.62));
  const bodyHi = Math.max(bodyLo + 60, Math.round(mid.hi * 0.62));
  return { subLo, subHi, bodyLo, bodyHi };
}

function scaledCeiling(ceiling, densityId) {
  const m = TEXT_DENSITY_TARGET_MULT[densityId];
  if (m == null || m >= 0.995) return ceiling;
  return Math.max(24, Math.round(ceiling * m));
}

/** FONTE ÚNICA das faixas de caracteres do subtítulo nos slides intermediários,
 *  por modo narrativo. Consumida pelos overrides de densidade E pelas regras de
 *  layout do prompt — antes os números viviam duplicados como prosa e como array
 *  e podiam divergir em silêncio (audit-produto §2). */
const MID_SUBTITLE_CHAR_BANDS = {
  storytelling: [120, 280],
  pain: [120, 280],
  viral: [90, 220],
  how_to: [160, 280],
  sensacionalista: [85, 210],
  jornalistico: [140, 300],
};
const midSubtitleBandFor = (modeId) => MID_SUBTITLE_CHAR_BANDS[modeId] || [200, 320];

/** Instrução explícita de volume — só quando ≠ 1/1. */
function buildSlideTextDensityOverrides(densityId, narrativeModeId) {
  if (!densityId || densityId === '1_1') return '';
  const label = SLIDE_TEXT_DENSITY_BY_ID[densityId]?.label || densityId;
  const baseMid = midSubtitleBandFor(narrativeModeId);

  const mid = scaledCharBand(baseMid[0], baseMid[1], densityId);
  const hookMax = scaledCeiling(80, densityId);
  const finMax = scaledCeiling(140, densityId);

  return `
▶ DENSIDADE DE TEXTO (${label}) — SUBSTITUI proporcionalmente as faixas “típicas” do método / blocos acima:
- Slides intermediários: subtítulo com algo entre ~${mid.lo} e ~${mid.hi} caracteres (não estique além).
- Slide 1: subtítulo no máximo ~${hookMax} caracteres (além do título curto já pedido).
- Último slide: subtítulo no máximo ~${finMax} caracteres.
- Quanto menor a fração (1/4, 1/5), menos frases paralelas e menos exemplo redundante — sem esvaziar o significado obrigatório do slide.
`;
}

function buildSlideTextDensityRefineHint(densityId) {
  if (!densityId || densityId === '1_1') return '';
  const label = SLIDE_TEXT_DENSITY_BY_ID[densityId]?.label || densityId;
  return `- Volume do projeto: densidade ${label} — não alongue o subtítulo; comprima mantendo gancho ou argumento intacto.\n`;
}

/**
 * Remove prefixos tipo "Slide 2", "Card 01 —" no início do texto — o app já mostra o índice do card.
 */
function stripLeadingSlideCardLabel(text) {
  if (text == null || typeof text !== 'string') return '';
  let t = text.replace(/^\uFEFF/, '').trim();
  let prev;
  do {
    prev = t;
    t = t
      .replace(/^(?:slide|card)(?![a-záàâãéêíóôõúç])\s*0*\d{1,2}\s*(?:[.:–—\-]|\.{3})?\s*/i, '')
      .trim();
  } while (t !== prev);
  return t;
}

function isTendenciaCulturaPreset(presetId) {
  return presetId === 'tendencia_cultura';
}


/** Sobreposição estratégica do pacote Tendência/Cultura (adapta ao N de slides). */
function buildTendenciaCulturaPackBlock(slideCount, textDensityId = '1_1') {
  const n = Math.min(12, Math.max(3, slideCount | 0));
  const { subLo, subHi, bodyLo, bodyHi } = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
  return `
PACOTE ATIVO — TENDÊNCIA/CULTURA (prioridade quando colidir com clichês genéricos de “dicas virais”):
Este formato NÃO é post de dicas soltas nem explicação de conceito novo. É nomear e ORGANIZAR o que o leitor já percebia no comportamento, na cultura, na polêmica ou na mudança de mercado.

Validação obrigatória do tema antes de escrever:
- O público já está sentindo esse fenômeno no cotidiano ou no feed?
- O texto nomeia e organiza a percepção — ou só ensina algo que o leitor nem sentia falta?

Tipos úteis (escolha o que casa com o material): A) Tendência interpretada B) Tese contraintuitiva C) Case/Benchmark cultural D) Previsão/Futuro sentido mas não nomeado.

Arco editorial de referência (distribua as FUNÇÕES abaixo pelos ${n} slides — se N < 9, una etapas adjacentes; se N > 9, expanda com mais evidência ou contraste mantendo o propósito de cada função):

S1 CAPA · hook que soe como “finalmente alguém falou isso” — teses tipo: fenômeno inesperado + consequência; obsessão comportamental + geração; grupo/categoria em mudança surpreendente; dado de mercado em tensão com narrativa óbvia; “por que X prova Y”.
S2 CONTEXTO · dado ou situação histórica; abre espaço factual.
S3 MECANISMO · síntese densa — princípio central do fenômeno (prosa forte, primeira frase = gancho do slide).
S4 DISSONÂNCIA · conflito que o mecanismo cria; consequência vivida.
S5 LIMITE · teto do comportamento atual; por que as pessoas travam ou param.
S6 (se N≥6) STAT/PARADOXO · UM slide pode ser só insight em tipografia mental: afirmação grande + linha menor com dado ou contrassenso (sem clichê motivacional).
S7 (se N≥7) MECANISMO DUPLO · contraste A vs B nos dois sentidos do fenômeno.
S8 (se N≥8) REFRAME · ângulo que muda como se lê o comportamento (pode citar pesquisa só se plausible ao material — não invente fonte).
S9 FECHO · meta-pergunta que organiza o que o leitor já sentia + CTA orgânico (comentário, save, síntese).

Reforço contínuo: “você já percebia isso; aqui está o porquê.” Três gatilhos ao longo do fio: identificação, alívio (não sou só eu), autoridade sobria.

LAYOUT VISUAL ↔ CAMPOS DO JSON (leitura do app — siga estritamente):
- Slide 1 (CAPA com foto full-bleed): use "title" + "subtitle" + "imageQuery". O campo "bodyAfterImage" DEVE ser "" (string vazia). Nunca sanduíche na capa.
- Slide final (fecho) COM foto: também full-bleed — "bodyAfterImage" vazio; apenas "title", "subtitle", "imageQuery" (e cultureTone se precisar).
- Slides intermediários e fecho COM foto (sanduíche texto · foto inline · texto): quando "imageQuery" estiver preenchido, obrigatório "subtitle" ACIMA da foto com **${subLo}–${subHi} caracteres** (parágrafo(s) corrido(s); primeira frase fecha o gancho) e "bodyAfterImage" ABAIXO da imagem com **${bodyLo}–${bodyHi} caracteres** — duas zonas distintas de prosa editorial, **não** uma headline + frase única nem bullets telegráficos salvo densidade 1/4–1/5. Destaque lexical: dentro de subtitle ou bodyAfterImage, envolva **um trecho** com asteriscos duplos.
- Slide só texto (“stat”) SEM foto: deixe "imageQuery" vazio; use "subtitle" (e opcionalmente "title") no bloco superior e "bodyAfterImage" como segundo bloco inferior (tipografia editorial em fundo sólido).
- "cultureTone" (opcional): omita ou use "" para alternância automática claro/escuro; só use "light", "dark" ou "accent" quando o contraste exigir.

CRITICAL (texto nos slides JSON):
- Sem título de seção tipo “Slide 3 — Mecânismo”: use título+subtítulo como no app; primeira frase do subtítulo faz o trabalho do gancho.
- PROIBIDO usar “Slide N”, “Card N” ou número ordinal de card como "title" — só copy editorial; o app numera os cards na UI.
${textDensityId === '1_1' || !textDensityId ? '- Com densidade 1/1, o miolo sanduíche deve calibrar como referências editoriais densas (capacidade de **~50–85 palavras por zona de texto** quando o material suportar); **proibido** entregar miolo resumido tipo “capa de LinkedIn”.\n' : ''}
- PROIBIDO abrir miolo como manual (“5 passos”, “dica número”) quando o tema for cultura/tendência — salvo modo narrativo Passo-a-passo pedido pelo usuário em outra camada.
`;
}

/** Arquétipos «Templates prontos» no fluxo de geração (Erro Comum, Tendência de Mercado, …). */
function buildQuickTemplatePackBlock(templateId, slideCount) {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) return '';
  const n = Math.min(12, Math.max(3, slideCount | 0));
  const refs = t.slides
    .map(
      (s, i) =>
        `   • Slide ${i + 1} — função no arco: título de referência «${s.title}» · subtítulo «${s.subtitle}» · imageQuery (inglês) «${s.q}».`,
    )
    .join('\n');
  return `
PACOTE ATIVO — ARQUÉTIPO "${t.name}" (mesmo molde que «Templates prontos» no app):
${t.desc}

Regras:
- Adapte títulos, subtítulos e imageQuery ao TEMA do utilizador; NÃO copie texto literal dos exemplos — preserve só a FUNÇÃO de cada posição no arco.
- Cada imageQuery: inglês, 8–15 palavras, alinhada ao argumento do slide (pode inspirar-se na família visual dos exemplos).

CRITICAL — ABA «CONTEÚDO» (MATÉRIA-PRIMA / FONTES / TEXTO EXTRAÍDO / INSTRUÇÕES):
- Se o prompt trouxer esses blocos, o assunto factual do carrossel é **o material colado**, não uma história genérica (escritório, cliente, terça-feira, deadline, etc.) inventada para encaixar no arquétipo.
- O arquétipo «${t.name}» define só a **estrutura** do arco (gancho, prova, virada…): os exemplos abaixo com «título de referência» são **ilustrativos** — reescreva tudo ao tema real do utilizador.
- A linha «sobre: "…"» do formulário é **secundária** quando existe material; use-a só se bater com o material ou para tom/desambiguação — nunca para trocar o assunto.

Distribuição para ${n} slides (o template original tem ${t.slides.length} passos — estique ou una passos adjacentes se N for diferente):
${refs}
`;
}

function buildTendenciaCulturaRefineSlideHint(creativePresetId, textDensityId = '1_1') {
  if (!isTendenciaCulturaPreset(creativePresetId)) return '';
  const { subLo, subHi, bodyLo, bodyHi } = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
  const dense =
    textDensityId === '1_1' || !textDensityId
      ? ' Com 1/1, se estiver curto, expanda até prosa completa por zona (método editorial), sem factos novos fora do material.'
      : '';
  return `- Pacote Tendência/Cultura: "subtitle" = texto acima da mídia (ou bloco superior no slide só texto). "bodyAfterImage" = bloco inferior (abaixo da foto no sanduíche, ou segunda coluna tipográfica sem imagem). Preserve **trechos** marcados para destaque accent. Capa e último slide (foto full-bleed no app) mantêm bodyAfterImage vazio — não devolva texto nesse campo ao refinar só esses cards. Alvo miolo sanduíche: subtitle ~${subLo}–${subHi} car.; bodyAfterImage ~${bodyLo}–${bodyHi} car.${dense}`;
}

function coerceCultureTone(v) {
  const t = (v == null ? '' : String(v)).trim().toLowerCase();
  return t === 'light' || t === 'dark' || t === 'accent' ? t : '';
}

function buildGenerationIntroLine(presetId) {
  if (isTendenciaCulturaPreset(presetId)) {
    return 'Atue como estrategista de cultura digital e comportamento em rede. Produza um carrossel que NOMEIE um fenômeno que o público já percebia — não lista de dicas nem aula solta de conceito. Responda APENAS com JSON válido, sem markdown, sem texto extra.';
  }
  if (isQuickTemplatePreset(presetId)) {
    const tid = quickTemplateIdFromPreset(presetId);
    const t = TEMPLATES.find((x) => x.id === tid);
    return `Atue como criador de carrosséis editoriais para Instagram. Produza um carrossel no arquétipo «${t?.name || 'template'}» — ${t?.desc || 'estrutura fixa de leitura'}. Responda APENAS com JSON válido, sem markdown, sem texto extra.`;
  }
  return 'Crie conteúdo para Instagram alinhado ao contexto abaixo. Responda APENAS com JSON válido, sem markdown, sem texto extra.';
}

function buildGenerationLanguageLayer(presetId, tone, narrativeMode = 'editorial') {
  const storyLike = narrativeMode === 'storytelling' || narrativeMode === 'pain';
  const viralMode = narrativeMode === 'viral' || narrativeMode === 'sensacionalista';
  const journalMode = narrativeMode === 'jornalistico';
  const howToMode = narrativeMode === 'how_to';

  // Storytelling/Odisseia + pacote cultura: narrativa manda forma; cultura acrescenta “fenômeno já sentido”.
  if (isTendenciaCulturaPreset(presetId) && storyLike) {
    return `REGRAS DE LINGUAGEM (pacote Tendência/Cultura + modo narrativo "${narrativeMode}"):
- O MÉTODO narrativo acima MANDA a estrutura. Acrescente do pacote cultural: fenômeno que o público já percebia — nomeie e organize, não vire palestra nem deck “parece ser / é” genérico.
- PROIBIDO soar como relatório institucional; mantenha cena, dor ou tempo — com tensão cultural visível.
- Tom base: "${tone}".`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode && narrativeMode === 'sensacionalista') {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Sensacionalista):
- O MÉTODO SENSACIONALISTA manda tensão forte e cortes rápidos. O pacote cultura exige payoff honesto nomeando fenômeno real — SEM clickbait que o miolo não sustenta.
- Tom "${tone}".`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode) {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Viral Trends):
- O MÉTODO VIRAL acima manda ritmo, loops e parada de scroll. O pacote cultura reforça: identificação com algo que já circula (“eu também vi isso”), sem virar relatório slide a slide.
- Tom "${tone}", preferindo frases curtas e cortantes nos slides de tensão.`;
  }
  if (isTendenciaCulturaPreset(presetId) && journalMode) {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Jornalístico):
- Hierarquia de matéria: selo/editoria → manchete → lead factual. Ângulos de comportamento mercado ou cultura em curso — não coluna motivacional.
- Tom "${tone}", factual e adulto.`;
  }
  if (isTendenciaCulturaPreset(presetId) && howToMode) {
    return `REGRAS DE LINGUAGEM (Tendência/Cultura + Passo-a-passo):
- O tutorial imperativo do MÉTODO acima prevalece. Não empacote cada passo como “tese de mercado”; mantenha utilidade líquida.
- Tom "${tone}" em modo instrução clara, não keynote.`;
  }
  if (isTendenciaCulturaPreset(presetId)) {
    return `REGRAS DE LINGUAGEM — PACOTE TENDÊNCIA/CULTURA (todos os slides):
- Tom jornalístico-analítico calmo; frases que soem como “finalmente alguém articulou o que eu sentia”.
- Cada slide = 1 batida nova no fenômeno; evite repetir o mesmo clichê viral (“5 hacks”, “ninguém te conta” vazio).
- Primeira linha forte do subtítulo é o gancho do slide — sem subdividir em “mini-títulos” artificiais.
- Zero guru, zero motivacional genérico; autoridade vem da clareza sobre o fenômeno já em curso.`;
  }
  if (storyLike) {
    return `REGRAS DE TEXTO (modo narrativo "${narrativeMode}" — prioridade sobre tom genérico):
- Vocabulário de história, não de slide de pitch. Evite fórmulas de marca (“não é sobre X, é sobre Y”) salvo um fecho pontual.
- Tom "${tone}" aplicado em cenas e falas, não em manuais de estratégia.
- Deixe identidade da marca colorir a voz, mas não substitua arco narrativo por mensagem institucional.`;
  }
  if (viralMode && narrativeMode === 'sensacionalista') {
    return `REGRAS DE TEXTO (modo Sensacionalista — tom "${tone}"):
- Frases de impacto máximo; urgência lexical sem mentir nem inventar consequência não sustentada pelo miolo.
- Gancho/miolo devem soar “capa sensacionalista” honesta — não post corporativo nem ensaio acadêmico.`;
  }
  if (viralMode) {
    return `REGRAS DE TEXTO (modo Viral — tom "${tone}"):
- Telegrama mental: corte palavras mortas. Gancho e meio pedem ritmo, não parágrafo de consultoria.
- Marca e material podem informar vocabulário — não viram slide de posicionamento institucional no lugar de tensão ou payoff.`;
  }
  if (journalMode) {
    return `REGRAS DE TEXTO (modo Jornalístico — tom "${tone}"):
- Clara hierarquia de capa quando o slide permitir (categoria/manifestação no título vs lead no subtítulo, ou distribua conforme método).
- Prosa econômica, factual onde couber ao tema — sem meme de influencer nem tom de guru.`;
  }
  if (howToMode) {
    return `REGRAS DE TEXTO (modo Passo-a-passo — tom "${tone}"):
- Imperativo e verificável em cada subtítulo; sem narrativa pessoal nem tese de marca entre um passo e outro.
- Marca só afina escolha de palavras — não slogan por slide.`;
  }
  return `REGRAS DE TEXTO (prioridade: MODO NARRATIVO acima → tom "${tone}" → identidade da marca e material. Não replique um único formato nem uma “voz de página” fixa):
- Deixe o modo narrativo guiar a estrutura; adapte vocabulário ao tema e ao público (sem forçar jargão de mercado se o tom ou o modo pedirem outra coisa).
- Cada slide = 1 ideia principal; evite repetir a mesma fórmula em todos os slides.
- Prefira substância a frases vazias; evite motivacional genérico e guru.
- Ritmo: hook enxuto → desenvolvimento → fechamento, conforme o modo escolhido (não imponha sempre o mesmo arco “analítico”).`;
}

/** Regras de tamanho/layout por slide — modos narrativos não podem usar o bloco “denso analítico” dos editoriais. */
function buildGenerationSlideLayoutRules(narrativeModeId, creativePresetId, textDensityId = '1_1') {
  const [midLo, midHi] = midSubtitleBandFor(narrativeModeId);
  if (isTendenciaCulturaPreset(creativePresetId)) {
    const bands = tendenciaStyleSandwichCharBands(textDensityId || '1_1');
    const sandwichVol = `
▶ VOLUME NO MIOLO SANDUÍCHE (texto · foto · texto) — prevalece sobre faixas genéricas de “subtítulo único”:
- **subtitle** (acima da foto) e **bodyAfterImage** (abaixo) são blocos separados; cada um = parágrafo(s) corrido(s) com múltiplas frases — não substituir por headline + uma linha nem bullets soltos.
- Faixas-alvo neste projeto: subtitle ~${bands.subLo}–${bands.subHi} caracteres; bodyAfterImage ~${bands.bodyLo}–${bands.bodyHi} caracteres.${
      textDensityId === '1_1' || !textDensityId
        ? ' Densidade 1/1 = padrão do método: calibre editorial denso (~50–85 palavras por zona quando o tema der), como referências tipo miolo sanduíche longo.'
        : ''
    }
`;
    return `
REGRAS DE TAMANHO (pacote TENDÊNCIA/CULTURA):
- Siga o arco e o layout descritos no PACOTE ativo; não misture com moldes de “modo narrativo” editorial/viral genéricos.
${sandwichVol}${buildSlideTextDensityOverrides(textDensityId, 'editorial')}
`;
  }
  const hookMag = isTendenciaCulturaPreset(creativePresetId)
    ? '   - Gancho nomeia fenômeno ou tensão vivida pelo público — não título genérico de relatório (“X: uma reflexão”).'
    : '   - Hook que para o scroll: linha de cena ou tensão, não conceito abstrato de marca.';

  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "${narrativeModeId}" — PREVALECEM sobre qualquer hábito de copy “estratégico/coded”):
O MÉTODO deste modo (seção acima) é a lei. Estas instruções substituem o formato padrão de carrossel consultivo.

- PROIBIDO repetir o molde “headline de marca + subtítulo raciocínio binário” em vários slides (ex.: título “Peptídeos: uma revolução na estética” + subtítulo “não é A, é B”; ou “Inovação e ciência” + “quem incorpora ciência constrói credibilidade…”).
- PROIBIDO títulos formulaicos “[Tema]: uma reflexão”, “[Tema]: uma revolução”, “[Dois conceitos] e [conceito]: …” como capa de deck.
- Slide 1 (hook): entrada em cena (in medias res ou imagem forte). Título = momento ou fragmento narrativo. Subtítulo = continua a cena ou a tensão — não posicionamento institucional.
- Slides intermediários: cada um AVANÇA a história (tempo, gesto, virada, consequência). Subtítulo em prosa narrativa: tipicamente 120–280 caracteres; É PERMITIDO bem menos quando for batida seca, fala ou linha única.
- Último slide: desfecho, pergunta ao leitor ou convite honesto — não obrigatoriamente “lição de estratégia”.

🪝 SLIDE 1 — HOOK NARRATIVO:
${hookMag}

📖 SLIDES DO MEIO — narrativa (NÃO mini-artigos de 200–320 caracteres tipo análise de mercado):
   - Título: virada, detalhe sensível, diálogo implícito — evite headline de LinkedIn.
   - Subtítulo: microcena ou sequência de causas; ritmo de narrador, não de slide de pitch.

🔚 SLIDE FINAL — fechamento narrativo ou convite à conversa.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'viral') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "viral" — retenção e ritmo, NÃO parágrafo de ensaio):
O MÉTODO VIRAL acima define as funções (hook, tensão, payoff). Estas regras substituem o formato “subtítulo denso 200–320 caracteres analíticos”.

- Slides intermediários: subtítulo tipicamente ENTRE ${midLo} E ${midHi} caracteres; pode ser MENOR quando for punch, cliffhanger ou frase quotável. Priorize loop, número concreto e virada — não explicação acadêmica longa.
- Título: curto, cortante, pode incluir número ou pergunta — não headline de relatório.
- Um slide do meio deve carregar a frase “guardável” (share-trigger) quando o arco tiver slides suficientes.

🪝 SLIDE 1 — parada de scroll (ver método viral).

📖 MEIO — tensão → prova → payoff (distribuído conforme N).

🔚 FINAL — pergunta ou save com motivo concreto (sem CTA preguiçoso).
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'how_to') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "passo-a-passo" — manual, não narrativa nem pitch):
O MÉTODO acima manda: um passo por slide com "Passo N · …".

- Slides intermediários: subtítulo tipicamente ENTRE ${midLo} E ${midHi} caracteres — imperativo + como fazer + erro ou exemplo; pode ultrapassar levemente se a instrução exigir checklist curto.
- Título DEVE refletir sequência de passos (Passo 1, 2…) até o penúltimo ou até o bloco de “erro comum”, conforme o método.
- PROIBIDO diluir em storytelling ou em tese de marca; mantenha linguagem de procedimento.

🪝 SLIDE 1 — promessa do que será ensinado.

📖 MEIO — instruções numeradas.

🔚 FINAL — save + pergunta sobre qual passo testar.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'sensacionalista') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "sensacionalista" — tensão alta, payoff honesto — NÃO parágrafo de ensaio):
O método sensacionalista acima manda cortes rápidos e micro-ganchos.

- Slides intermediários: subtítulo tipicamente ENTRE ${midLo} E ${midHi} caracteres — pode ser MENOR quando for tacada única ou cliffhanger. Priorize vigas de tensão e contraste visceral sobre explicação longa.
- Título: curto até médio — pode soar "capa" ou pergunta incômoda; evite headline de relatório corporativo.

🪝 SLIDE 1 — gancho forte (ver método).

📖 MEIO — viradas e fechos de mini-loop (distribuído conforme N); um slide pode carregar frase quotável chocante-mas-verdadeira.

🔚 FINAL — revelação ou síntese real + provocação factual / save útil — sem clichê de "segue pra parte 2".
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  if (narrativeModeId === 'jornalistico') {
    return `
REGRAS DE ESTRUTURA POR SLIDE (modo "jornalístico" — matéria digital, hierarquia de capa):
O método jornalístico prevalece. Slides devem ler como sequência de fio ou capas de seção — não meme deck.

🪝 SLIDE 1 (CAPA DE FIO):
   - Manifeste selo/editoria no título (parte inicial CAIXA ALTA OU equivalente compacto se o JSON só tiver dois campos) + manchete impactante na mesma peça textual de forma fluida OU use título = manchete e subtítulo = selo + lead — mantenha a hierarquia clara ao leitor.
   - Subtítulo: LEAD factual (1 linha forte). Se o título já carregar a manchete inteira, o subtítulo faz o nut graf ou data-contexto breve.

📖 MEIO — blocos de matéria pirâmide invertida:
   - Título: ângulo, fato-âncora ou antetítulo curto da peça DAQUELE slide.
   - Subtítulo: 2-4 frases curtas OU um parágrafo denso factual: tipicamente ENTRE ${midLo} E ${midHi} caracteres; informação primeiro, ornamentação zero.

🔚 FINAL — editorial curto ou o que falta saber próximo — sem CTA influencer vazio.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
  }

  const hookVisualHint = isTendenciaCulturaPreset(creativePresetId)
    ? '   - Capa com peso de manchete cultural: fenômeno ou paradoxo já no ar — pouco texto, frase memorável.'
    : '   - Hook com impacto visual forte; não precisa parecer “capa de revista de mercado” se outro formato servir melhor ao modo.';

  return `
REGRAS DE TAMANHO POR POSIÇÃO (CRÍTICO — siga estritamente, NÃO trate todos os slides com mesmo peso):

🪝 SLIDE 1 (HOOK) — texto MÍNIMO, máximo impacto:
   - Título: 5-9 palavras. Frase-tese curta e cortante. Usa o espaço visual.
   - Subtítulo: UMA frase curta apenas, máx 80 caracteres. Pode ser inclusive vazio se a tese se sustenta sozinha.
${hookVisualHint}

📖 SLIDES INTERMEDIÁRIOS (2 ao penúltimo) — texto DENSO e com CONTEÚDO:
   - Título: 5-12 palavras, ideia única em frase clara.
   - Subtítulo: 2-4 frases. ENTRE ${midLo} E ${midHi} CARACTERES. Cada slide intermediário é onde MORA o conteúdo — explica o mecanismo, traz exemplo, contraste, dado, leitura. Não economize palavras aqui.
   - É aqui que o leitor deve sentir que está aprendendo algo de verdade. Use vírgulas, pontos, ritmo. Construa o argumento.

🔚 SLIDE FINAL (CTA) — concisão elegante:
   - Título: 5-9 palavras. Conclusão ou convite.
   - Subtítulo: 1-2 frases curtas, máx 140 caracteres. Fechamento limpo, sem repetir o título.
${buildSlideTextDensityOverrides(textDensityId, narrativeModeId)}
`;
}

function buildGenerationImageLayer(presetId, topic, n, audience) {
  const nicheStr = n ? ` (nicho: ${n})` : '';
  const audStr = audience ? ` (público: ${audience})` : '';
  if (isTendenciaCulturaPreset(presetId)) {
    return `imageQuery — DIREÇÃO DE ARTE “CULTURA EM CURSO” (a IA do gerador de imagem aplicará realismo, luz natural e estética premium em cima — você só precisa descrever a CENA):
• Idioma: INGLÊS, 8-15 palavras descritivas.
• Estrutura: [sujeito real] + [ação cotidiana ou estado] + [ambiente específico observado] + [detalhe de luz/atmosfera].
• OBRIGATÓRIO — relação INDIRETA e inteligente com o tema "${topic}"${nicheStr}${audStr}. NUNCA escolha a representação mais óbvia. A imagem deve sugerir o conceito por atmosfera, gesto, contexto, objeto ou tensão visual — não ser uma "legenda" do título.
• EVITE clichês visuais: xadrez (estratégia), gráficos subindo (crescimento), lâmpadas (ideia), robôs/hologramas (tecnologia), reuniões corporativas (negócios), explosão de tinta (criatividade), aperto de mãos (parceria), engrenagens, escalada de montanha, lupa.
• EVITE: pessoas posando como modelo, sorriso publicitário, diversidade encenada, expressões artificiais, fundo de estúdio, luz dramática teatral, paisagens aleatórias desconectadas, animais decorativos.
• PREFIRA cenas reais e bem observadas: escritórios contemporâneos, ruas urbanas, cafés, casas, lojas, bastidores, mãos manuseando objeto, detalhes de processo, espaços culturais, mesas com objetos, interiores residenciais.
• Composição: espaço negativo para texto, fundo levemente desfocado, foco claro em UM elemento, poucos objetos, silêncio visual.
• Slides de miolo no layout sanduíche mostram a foto como retângulo horizontal com cantos arredondados entre dois blocos de texto — prefira enquadramento horizontal (panorâmico ou ~3:2) com protagonista reconhecível no centro da largura.
• Exemplos BONS (note como sugerem o tema sem ilustrá-lo literalmente):
  - tema "produtividade" → "open notebook beside cooling coffee on wooden desk, late afternoon window light"
  - tema "estratégia"   → "hands rearranging objects on a quiet meeting room table, soft overhead light"
  - tema "longevidade"  → "older woman walking slowly through tree-lined street, soft morning haze"
  - tema "marca pessoal"→ "person reflected on storefront glass at dusk, warm street lights blurred behind"
  - tema "tecnologia"   → "single hand resting on closed laptop on minimal desk, quiet morning light through curtain"
• Cada slide: imageQuery DIFERENTE, todas dentro do mesmo universo visual sóbrio — sinais de tempo, grupo, consumo ou tensão social, nunca “stock genérico de negócios”.`;
  }
  return `imageQuery — uma por slide (INGLÊS, 8-15 palavras). O pipeline de imagem da aplicação aplica realismo; você descreve a CENA:
• Alinhe cada imageQuery ao argumento DAQUELE slide e ao tema "${topic}"${nicheStr}${audStr}.
• Relação com o tema: prefira sugestão inteligente à ilustração óbvia — salvo se os eixos de direção de imagem do usuário (bloco acima) pedirem literalidade ou contrário.
• Varie ambiente, clima e composição entre slides quando o conteúdo ou o modo narrativo pedirem contraste — não prenda todo o carrossel a um único clima visual “editorial”.
• Os eixos ajustados pelo usuário têm PRIORIDADE sobre exemplos genéricos ou um “look” único.
• EVITE repetir o mesmo clichê visual em todos os slides sem necessidade.
• Cada slide: imageQuery DIFERENTE.`;
}


function buildNarrativeModeReminder(modeId) {
  const m = GEN_MODE_BY_ID[modeId] || GEN_MODE_BY_ID.editorial;
  return `Modo narrativo do carrossel (persistido no documento): "${m.label}" — ${m.desc}.`;
}

/** Regras de comprimento/tom para refinar UM slide, alinhadas ao modo + densidade de texto. */
function buildRefineSingleSlideRules(narrativeModeId, textDensityId = '1_1') {
  const denHint = buildSlideTextDensityRefineHint(textDensityId);
  const refNoEnum = '- PROIBIDO "Slide N" / "Card N" como título — o app já numera o card.\n';
  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') {
    return `${denHint}${refNoEnum}- Refine mantendo registro narrativo (cena, tensão, consequência ou empatia) — não converta em headline de deck + subtítulo "tese/antítese" corporativo.
- Título pode ser fragmento de cena ou virada; subtítulo em prosa coerente com o modo, sem forçar três frases analíticas se uma batida basta.`;
  }
  if (narrativeModeId === 'viral') {
    return `${denHint}${refNoEnum}- Mantenha ou reforce ritmo viral: título curto; subtítulo telegráfico (sem parágrafo denso de análise).`;
  }
  if (narrativeModeId === 'sensacionalista') {
    return `${denHint}${refNoEnum}- Refine preservando tensão sensacionalista: cortes rápidos, viradas — SEM inventar fatos nem promessa falsa para clickbait.`;
  }
  if (narrativeModeId === 'jornalistico') {
    return `${denHint}${refNoEnum}- Refine preservando hierarquia jornalística (selo/manchete/lead onde couber ao slide) e prosa factual; não converta em pitch de marca.`;
  }
  if (narrativeModeId === 'how_to') {
    return `${denHint}${refNoEnum}- Se o slide for instrucional, mantenha "Passo N · …" e imperativos; o refinamento não deve virar história ou tese de marca.`;
  }
  return `${denHint}${refNoEnum}- Título: 4–14 palavras conforme impacto. Subtítulo: aprofunde a ideia deste slide; no miolo editorial/profundo pode ser mais denso que no hook.`;
}

/** Estrutura sugerida da legenda conforme modo narrativo. */
function buildCaptionOutlineInstructions(narrativeModeId) {
  switch (narrativeModeId) {
    case 'storytelling':
    case 'pain':
      return `ESTRUTURA DA LEGENDA (modo narrativo — tom humano):
1. Abrir com tensão, momento ou pergunta (não copiar o título do slide 1).
2. Uma ou duas linhas que sintetizem o arco (${narrativeModeId === 'pain' ? 'da dor e da saída honesta' : 'da história e da virada'}).
3. Insight central sem soar como relatório executivo.
4. Convite aos comentários ou à partilha de experiência.
5. Hashtags no final.`;
    case 'viral':
      return `ESTRUTURA DA LEGENDA (modo viral — ritmo curto):
1. Linha que reforça parada de scroll (gancho).
2. Uma ou duas linhas com payoff, número ou virada principal.
3. CTA de save ou pergunta direta.
4. Hashtags. Evite ensaio longo.`;
    case 'how_to':
      return `ESTRUTURA DA LEGENDA (modo passo-a-passo):
1. Reformular a promessa do que o carrossel ensina.
2. Resumir os passos em uma linha fluida (sem listar todos os títulos).
3. Sugerir qual passo testar primeiro + save útil.
4. Hashtags.`;
    case 'deep':
      return `ESTRUTURA DA LEGENDA (modo profundo):
1. Tese contraintuitiva reformulada.
2. Padrão ou mecanismo central em linguagem acessível.
3. Implicação para quem reconhece o padrão.
4. Pergunta precisa ou save para revisitar.
5. Hashtags.`;
    case 'jornalistico':
      return `ESTRUTURA DA LEGENDA (modo jornalístico — fio/coletânea):
1. Linha de editoria/subject em CAIXAS compactas só se ficar natural no Instagram.
2. Manchete resumindo o ângulo (não copie slide 1 por extenso).
3. Lead em 2-3 linhas: o núcleo factual ou implicação.
4. Para onde isso aponta a seguir + pergunta precisa OU save sóbrio.
5. Hashtags.`;
    case 'sensacionalista':
      return `ESTRUTURA DA LEGENDA (modo sensacionalista — honestidade):
1. Gancho forte que casa com o payoff do carrossel (sem cilada).
2. Uma ou duas linhas de tensão antes da revelação sintetizada.
3. PAYOFF verdadeiro — aquilo que o leitor vai descobrir se engajar.
4. Pergunta provocadora ou save com âncora concreta.
5. Hashtags. Ritmo curtíssimo.`;
    default:
      return `ESTRUTURA DA LEGENDA:
1. Frase-tese forte (não repita literalmente o slide 1).
2. Contextualize o problema ou a leitura comum.
3. Sua leitura ou síntese principal.
4. Consequência prática ou insight aplicável.
5. Pergunta nos comentários OU CTA de salvamento elegante.`;
  }
}

/** Regras para o modal de variações de gancho — alinhadas ao modo + pacote. */
function buildHookVariationRules(narrativeModeId, creativePresetId) {
  const tendenciaCulture = isTendenciaCulturaPreset(creativePresetId);
  if (narrativeModeId === 'storytelling' || narrativeModeId === 'pain') {
    return `- Priorize entrada em CENA ou identificação emocional imediata (in medias res / "é exatamente isso") — não só fórmulas "X não é Y".
- Subtítulo: uma linha que prolonga a tensão ou o momento, não pitch analítico.
- 5 variações com cadências diferentes (tempo, gesto, fala implícita).`;
  }
  if (narrativeModeId === 'viral') {
    return `- Parada de scroll: interrupção, número específico, identificação brutal, pergunta noturna ou revelação atrasada — PROIBIDO "hoje vou te ensinar" / "você sabia".
- Subtítulo: linha de tensão ou promessa parcial.
- 5 ganchos distintos nas técnicas acima.`;
  }
  if (narrativeModeId === 'how_to') {
    return `- Título do gancho = promessa clara: "Como [resultado] em [N passos]" ou equivalente.
- Subtítulo: qual dor ou bloqueio isso resolve em uma linha.
- 5 formulações diferentes da mesma promessa (ângulos distintos).`;
  }
  if (narrativeModeId === 'deep') {
    return `- Gancho = tese contraintuitiva sobre padrão ou mecanismo escondido (sintoma vs causa).
- Subtítulo: pista seca do que será dissecado.
- 5 ângulos de tese diferentes.`;
  }
  if (narrativeModeId === 'jornalistico') {
    return `- Capa tipo fio: selo/editoria CAIXA ALTA uma linha + manchete de impacto no título principal.
- Subtítulo: LEAD factual (por que ler agora) — pode incluir marcador temporal leve quando fizer sentido ao tema.
- 5 ângulos de capa distintos (mesmo tema): ângulos de mercado, consequência política/socioeconômica humanizada, erro comum sobre o tema, dado novo, contra-narrativa factível — sem clickbait falso.`;
  }
  if (narrativeModeId === 'sensacionalista') {
    return `- Grito de tensão forte + promessa só do que ENTREGARÁ (sem miragem).
- Subtítulo: linha que aumenta o custo cognitivo de ignorar OU contraste visceral inicial.
- 5 hooks em cadências bem diferentes — tablóide moderno honesto — sem "você vai se arrepender" vazio nem ALL CAPS exagerado em todas.`;
  }
  const editorialFormats = `- Use formatos contraintuitivos: "X não está fazendo Y, está fazendo Z", "Não é sobre X. É sobre Y.", "Todo mundo viu X. Pouca gente entendeu Y.", "O mercado de X está deixando de ser sobre Y. Agora é sobre Z.", "O erro de X é achar que Y. Na prática, o jogo está em Z."`;
  const tendenciaPatterns = `
- Patterns extra (Tendência/Cultura — soe como "finalmente alguém falou isso"): "[Substantivo] muda [algo inesperado]: como [fenômeno] provou [tese]", "A nova obsessão é [comportamento]: como uma geração [consequência]", "[Grupo] está [verbo surpreendente] — e o que isso revela sobre [tensão]", "o que cresceu enquanto [contexto contrário] mudava", "por que [fenômeno] é prova de [tese provocadora]".`;
  if (tendenciaCulture) {
    return `${editorialFormats}${tendenciaPatterns}
- Âncoras no fenômeno JÁ EM CURSO (comportamento, cultura, polêmica, mercado) — não promessa de "aulinha".
- Tom assertivo e adulto — sem clichê motivacional nem guru.
- Cada gancho: 4-12 palavras de impacto.
- 5 variações DIFERENTES entre si (formatos diferentes).`;
  }
  return `${editorialFormats}
- Tom assertivo, sofisticado; pode incluir um gancho mais direto ou numérico se servir ao tema.
- Cada gancho: 4-12 palavras de impacto máximo.
- 5 variações DIFERENTES entre si (formatos diferentes).`;
}

function buildRefineVoiceRules(presetId, narrativeMode = 'editorial') {
  const storyLike = narrativeMode === 'storytelling' || narrativeMode === 'pain';
  const viralMode = narrativeMode === 'viral' || narrativeMode === 'sensacionalista';
  const journalMode = narrativeMode === 'jornalistico';
  const howToMode = narrativeMode === 'how_to';

  if (isTendenciaCulturaPreset(presetId) && storyLike) {
    return `- Refinamento: o modo narrativo "${narrativeMode}" manda — use Tendência/Cultura só para nomear fenômeno vivido com precisão, não para virar cada slide em "parece ser / realmente é" nem pitch de categoria.
- Não substitua cena ou dor por análise genérica de mercado.`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode && narrativeMode === 'sensacionalista') {
    return `- Refinamento sensacionalista: tensão máxima e cortes rápidos; payoff honesto. O pacote cultura afina léxico sem esvaziar o drama nem engrossar em relatório corporativo.
- Zero clickbait falso: pode ser incômodo, não mentiroso.`;
  }
  if (isTendenciaCulturaPreset(presetId) && viralMode) {
    return `- Refinamento viral: frases curtas e tensão; o pacote cultura não deve densificar cada slide em parágrafo de consultoria.`;
  }
  if (isTendenciaCulturaPreset(presetId) && howToMode) {
    return `- Refinamento tutorial: imperativo e claro; sem transformar passos em keynote de “tendência” vazia.`;
  }
  if (isTendenciaCulturaPreset(presetId) && journalMode) {
    return `- Refinamento jornalístico: hierarquia de capa onde couber ao slide; factual e preciso — sem soar como pitch institucional.
- Preserve selo/editoria vs manchete vs lead quando o método pedir.`;
  }
  if (isTendenciaCulturaPreset(presetId)) {
    return `- Tom assertivo, direto, sofisticado. Sem clichês, sem linguagem motivacional, sem guru.
- Vocabulário de comportamento, cultura e mercado quando pertinente: categoria, percepção, narrativa em curso, tensão social, sinal, consequência.`;
  }
  if (storyLike) {
    return `- Refinar mantendo coerência com modo "${narrativeMode}" (narrativa empática ou em cena).
- Respeite marca e material sem impor voz de relatório.`;
  }
  if (viralMode) {
    return narrativeMode === 'sensacionalista'
      ? `- Refinar mantendo ritmo sensacionalista: tacadas curtas, viradas; sem parágrafos analíticos longos nem promessa vazia.`
      : `- Refinar mantendo ritmo viral: cortar palavras mortas; sem parágrafo analítico longo no subtítulo.`;
  }
  if (journalMode) {
    return `- Refinar mantendo registro jornalístico: lead claro quando couber ao slide; dados e consequência antes de opinião solta de influencer.`;
  }
  if (howToMode) {
    return `- Refinar mantendo passos acionáveis e linguagem de manual.`;
  }
  return `- Respeite identidade da marca, material e o tom já presentes no carrossel — não uniformize tudo ao estilo “análise de mercado” se o modo for outro.
- Siga a instrução do usuário e mantenha coerência entre slides.`;
}

function buildCaptionVoiceRules(presetId, narrativeMode = 'editorial') {
  let presetLine;
  if (isTendenciaCulturaPreset(presetId)) {
    presetLine = `- Tom: jornalístico-analítico (expande o insight como algo que o leitor já sentia); sem emojis em excesso (máx 2-3). Bloco 2: pergunta que ativa identificação + CTA orgânico. Hashtags: 5-8 específicas ao nicho.`;
  } else {
    presetLine = `- Tom: alinhado à marca e ao material; natural — sem forçar frieza analítica se o modo narrativo pedir calor humano. Emojis com moderação.`;
  }
  const modeLine =
    narrativeMode === 'storytelling' || narrativeMode === 'pain'
      ? `- Legenda com voz humana; sintetize o arco ${narrativeMode === 'pain' ? 'empático ' : ''}sem soar como resumo de relatório.`
      : narrativeMode === 'sensacionalista'
        ? `- Legenda ultra-curta; gancho + payoff real (sem cilada); CTA ou pergunta com âncora concreta.`
        : narrativeMode === 'viral'
          ? `- Legenda enxuta; reforço de gancho + payoff; CTA ou pergunta direta.`
          : narrativeMode === 'how_to'
            ? `- Legenda útil: o que foi ensinado + qual passo testar primeiro.`
            : narrativeMode === 'deep'
              ? `- Legenda que destaque padrão ou mecanismo sem jargão desnecessário.`
              : narrativeMode === 'jornalistico'
                ? `- Legenda em tom de fio: manchete + lead factual antes de hashtags.`
                : '';
  return [presetLine, modeLine].filter(Boolean).join('\n');
}

/** Viés para pesquisa de nicho — alinha ideias e ganchos ao modo/pacote do documento. */
function buildResearchPromptBias(narrativeModeId, creativePresetId) {
  const m = GEN_MODE_BY_ID[narrativeModeId] || GEN_MODE_BY_ID.editorial;
  const p = CREATIVE_PRESET_BY_ID[creativePresetId] || CREATIVE_PRESET_BY_ID.livre;
  return `
Preferências do usuário (viés suave — continue a pesquisar fatos REAIS na web):
- Modo narrativo alvo: "${m.label}" — ${m.desc}
- Pacote criativo de referência: "${p.label}" — ${p.desc}
Aplicação: em "carousel_ideas", favoreça ângulos que esse modo execute bem (ex.: storytelling → arco em cena; passo-a-passo → passos numerados; viral → tensão e payoff; profundo → padrão/mecanismo; pacote Tendência/Cultura → fenômeno de comportamento ou cultura já em curso que o público sente no feed, não “lista de dicas”). Em "viral_hooks", combine formatos estratégicos com variações compatíveis com o modo.
`;
}

export {
  resolveMaterialPromptParts,
  quickTemplateIdFromPreset,
  isQuickTemplatePreset,
  QUICK_TEMPLATE_CREATIVE_PRESET_ENTRIES,
  GEN_MODES,
  GEN_MODE_BY_ID,
  isPersoHybridDensity,
  buildPersoHybridLayoutBlock,
  buildBrandBlock,
  buildImgParamsBlockPT,
  buildImgParamsTagsEN,
  VC_ZWSP,
  normalizeMaterialField,
  isUrlOnlyNormalizedText,
  normalizedMaterialPieces,
  extractHttpUrlsFromMaterial,
  FETCH_SOURCE_API,
  materialHasUserInput,
  buildMaterialBlock,
  buildMaterialPriorityBlock,
  CREATIVE_PRESETS,
  CREATIVE_PRESET_BY_ID,
  SLIDE_TEXT_DENSITY_OPTIONS,
  SLIDE_TEXT_DENSITY_BY_ID,
  TEXT_DENSITY_TARGET_MULT,
  scaledCharBand,
  tendenciaStyleSandwichCharBands,
  scaledCeiling,
  MID_SUBTITLE_CHAR_BANDS,
  midSubtitleBandFor,
  buildSlideTextDensityOverrides,
  buildSlideTextDensityRefineHint,
  stripLeadingSlideCardLabel,
  isTendenciaCulturaPreset,
  buildTendenciaCulturaPackBlock,
  buildQuickTemplatePackBlock,
  buildTendenciaCulturaRefineSlideHint,
  coerceCultureTone,
  buildGenerationIntroLine,
  buildGenerationLanguageLayer,
  buildGenerationSlideLayoutRules,
  buildGenerationImageLayer,
  buildNarrativeModeReminder,
  buildRefineSingleSlideRules,
  buildCaptionOutlineInstructions,
  buildHookVariationRules,
  buildRefineVoiceRules,
  buildCaptionVoiceRules,
  buildResearchPromptBias,
};
