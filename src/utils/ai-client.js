/**
 * TRANSPORTE DE IA — extraído do monólito (decomposição B2).
 * Texto: callAI / callAIwithSearch (Anthropic, OpenAI, Z.ai, Kimi).
 * Imagem: gpt-image com cascata de fallback, Z.ai, edits com referência.
 * Estado de runtime das chaves (BYOK) vive aqui — setAIRuntimeSettings.
 */
import { DEFAULT_AI_SETTINGS, normalizeAISettings } from '../config/ai-providers.js';
import { getServerStatus } from './server-status.js';
import { extractJSON } from './parsers.js';
import { buildImgParamsTagsEN } from './generation-prompts.js';
import { ZAI_FALLBACK_MODELS } from '../../shared/ai-models.js';

// Acima do orçamento do proxy (240 s em api/ai/compatible.js): se o cliente
// abortasse primeiro, o utilizador perdia uma geração que o servidor ainda ia
// entregar. Só existe para não deixar o botão preso para sempre.
const TEXT_TIMEOUT_MS = 260_000;
const textTimeoutSignal = () => {
  const AS = globalThis.AbortSignal; // via globalThis: scripts/check-undefined.mjs não conhece o global
  return AS && typeof AS.timeout === 'function' ? AS.timeout(TEXT_TIMEOUT_MS) : undefined;
};

// ─── AI BACKENDS ──────────────────────────────────────────────────────────────
// Detecta se está rodando localmente (Vite dev) — nesse caso usa o proxy
// configurado em vite.config.js para evitar CORS. Em produção (Claude artifact)
// bate direto na API porque o ambiente já está autenticado.
const IS_LOCAL_DEV =
  typeof window !== 'undefined' &&
  /^(localhost|127\.|0\.0|192\.168|10\.|\[::1\])/.test(window.location.hostname);

/** Em build de produção (VITE_ANTHROPIC_PROXY) usa a função serverless → sem CORS. */
const USE_ANTHROPIC_PROXY =
  IS_LOCAL_DEV ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_PROXY === 'true');

const ANTHROPIC_URL = USE_ANTHROPIC_PROXY
  ? '/api/anthropic/v1/messages'
  : 'https://api.anthropic.com/v1/messages';
const OPENAI_CHAT_URL  = IS_LOCAL_DEV ? '/api/openai/v1/chat/completions'      : 'https://api.openai.com/v1/chat/completions';
const OPENAI_IMAGE_URL = IS_LOCAL_DEV ? '/api/openai/v1/images/generations'    : 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGE_EDITS_URL = IS_LOCAL_DEV ? '/api/openai/v1/images/edits'     : 'https://api.openai.com/v1/images/edits';
const COMPATIBLE_AI_URL = '/api/ai/compatible';

/** Converte "Failed to fetch" numa mensagem acionável (CORS, preview sem proxy, rede). */
function enhanceNetworkError(err, label) {
  const m = (err && err.message) ? err.message : String(err);
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    const t = new Error(`${label}: a resposta demorou demasiado. Tente de novo.`);
    t.isNetwork = true;
    return t;
  }
  if (!/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    return err instanceof Error ? err : new Error(m);
  }
  const hosted = typeof window !== 'undefined' && !IS_LOCAL_DEV;
  const isClaude = /claude|anthropic/i.test(label);
  const isOpenAI = /openai|gpt|dall/i.test(label);
  let hint;
  if (!hosted) {
    // Dev local: provavelmente o proxy /api não está respondendo
    // Só alcançável em localhost — mensagem para quem desenvolve.
    hint = 'Ambiente local: confirme que o servidor de desenvolvimento está a correr e que há internet.';
  } else if (isClaude) {
    hint =
      'Não foi possível falar com o Claude. Confirme a sua chave em Configurar IA, ou escolha outro modelo de texto.';
  } else if (isOpenAI) {
    hint =
      'Sua chave OpenAI pode estar inválida, expirada ou sem saldo. ' +
      'Verifique em platform.openai.com/api-keys e platform.openai.com/account/billing. ' +
      'Se ainda não configurou, adicione a chave em Configurar IA.';
  } else {
    hint =
      'Não foi possível falar com a IA. Verifique a sua ligação à internet e tente de novo.';
  }
  const out = new Error(`${label}: falha de rede. ${hint}`);
  out.isNetwork = true; // lido por generateDALLEWithRetry — a mensagem traduzida não casa com o regex antigo (auditoria M7)
  return out;
}

/** 401/402 vindos do gate de sessão do proxy — não são erro do provedor (auditoria H3). */
function sessionGateError(status, data) {
  if (status !== 401 && status !== 402) return null;
  const e = new Error(
    status === 401
      ? 'Sessão expirada. Faça login pela assinatura para usar a IA.'
      : String(data?.error?.message || data?.error || 'Assinatura inativa. Renove o plano para continuar.'),
  );
  e.status = status;
  e.code = status === 401 ? 'session_required' : 'subscription_inactive';
  return e;
}

const AI_SYSTEM_PT = 'Você é especialista em conteúdo estratégico para Instagram no Brasil. Use português brasileiro em todo texto visível ao leitor (títulos, subtítulos, parágrafos, legendas), salvo quando o pedido do usuário exigir explicitamente outro idioma apenas num campo isolado — por exemplo palavras-chave de busca de imagem em inglês.';

// Configuração selecionada no modal. Mantida em módulo para as funções de geração,
// que vivem fora do componente React, lerem a preferência atual sem prop drilling.
let _aiRuntimeSettings = normalizeAISettings(DEFAULT_AI_SETTINGS);
const setAIRuntimeSettings = (value) => {
  _aiRuntimeSettings = normalizeAISettings(value);
};
const getTextModel = (provider) =>
  _aiRuntimeSettings.textModels?.[provider] || DEFAULT_AI_SETTINGS.textModels[provider];
const getProviderKey = (provider) => String(_aiRuntimeSettings.keys?.[provider] || '').trim();

const callAnthropic = async (userMsg, { json = false, maxTokens = 4096, tools = null } = {}) => {
  const body = {
    model: getTextModel('anthropic'),
    max_tokens: maxTokens,
    system: AI_SYSTEM_PT,
    messages: [{ role: 'user', content: userMsg }],
  };
  if (tools) body.tools = tools;
  const headers = { 'Content-Type': 'application/json' };
  // Claude é BYOK: sem chave do utilizador o proxy responde 400 (o fallback para a
  // chave do host foi removido em 2026-09-15). `callAI` já encaminha para Z.ai nesse caso.
  const anthropicKey = getProviderKey('anthropic');
  if (anthropicKey) {
    headers['x-anthropic-key'] = anthropicKey;
  }
  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
      signal: textTimeoutSignal(),
    });
  } catch (e) {
    throw enhanceNetworkError(e, 'Claude');
  }
  const raw = await res.text();
  if (res.status === 404 && IS_LOCAL_DEV && String(ANTHROPIC_URL).startsWith('/api')) {
    throw new Error(
      'Ambiente local sem as rotas de IA: use o servidor de desenvolvimento em vez do preview.',
    );
  }
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Resposta inválida (HTTP ${res.status})`); }
  if (!res.ok || data.error) {
    if (USE_ANTHROPIC_PROXY && !IS_LOCAL_DEV) {
      const gate = sessionGateError(res.status, data);
      if (gate) throw gate;
    }
    const e = new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const text = (data.content||[])
    .filter(b => b?.type === 'text')
    .map(b => b.text)
    .join('\n');
  if (!text.trim()) throw new Error('Claude retornou conteúdo vazio.');
  return json ? extractJSON(text) : text.trim();
};

// Backend OpenAI — Chat Completions com a família GPT-5.6.
const callOpenAIChat = async (userMsg, { json = false, maxTokens = 4096, key }) => {
  key = String(key || getProviderKey('openai')).trim();
  // Em local dev, o proxy usa a chave do .env.local quando o frontend não envia uma.
  // Fora do dev (Claude artifact), a chave é obrigatória.
  if (!IS_LOCAL_DEV && !key) throw new Error('Falta a chave da OpenAI. Adicione-a em Configurar IA.');
  const body = {
    model: getTextModel('openai'),
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: `${AI_SYSTEM_PT} Responda APENAS o que foi pedido, sem texto extra, sem markdown explicativo.` },
      { role: 'user',   content: userMsg },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };
  const headers = { 'Content-Type': 'application/json' };
  if (IS_LOCAL_DEV) {
    if (key) headers['x-openai-key'] = key; // senão, proxy usa OPENAI_API_KEY do .env.local
  } else {
    headers['Authorization'] = `Bearer ${key}`;
  }
  let res;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: textTimeoutSignal(),
    });
  } catch (e) {
    throw enhanceNetworkError(e, 'OpenAI');
  }
  const raw = await res.text();
  if (res.status === 404 && IS_LOCAL_DEV && String(OPENAI_CHAT_URL).startsWith('/api')) {
    throw new Error(
      'Ambiente local sem as rotas de IA: use o servidor de desenvolvimento em vez do preview.',
    );
  }
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`OpenAI: resposta inválida (HTTP ${res.status})`); }
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('OpenAI retornou conteúdo vazio.');
  return json ? extractJSON(text) : text.trim();
};

const COMPATIBLE_DIRECT_URLS = {
  zai: '/api/zai/api/paas/v4/chat/completions',
  kimi: '/api/kimi/v1/chat/completions',
};

// ZAI_FALLBACK_MODELS vem de shared/ai-models.js (mesma lista que o proxy permite).

function isZaiOverloadError(status, data, raw) {
  if (status === 429) return true;
  const msg = String(data?.error?.message || data?.message || raw || '');
  const code = String(data?.error?.code || data?.code || '');
  return code === '1305' || /overloaded|temporar|congest|busy|try again later/i.test(msg);
}

function translateProviderError(provider, status, data, raw) {
  const msg = String(data?.error?.message || data?.message || '').trim();
  const code = String(data?.error?.code || data?.code || '');
  if (code === '1305' || /overloaded|try again later/i.test(msg)) {
    return 'Z.ai está sobrecarregada neste momento. Tenta de novo em alguns segundos.';
  }
  if (status === 401 || /token expired|incorrect|unauthorized/i.test(msg)) {
    return 'A IA incluída no plano está indisponível neste momento. Tente de novo em instantes — se persistir, fale com o suporte.';
  }
  if (status === 429) {
    return 'Muitos pedidos à Z.ai. Espera um momento e tenta de novo.';
  }
  return msg || `${provider === 'zai' ? 'Z.ai' : 'Kimi'} HTTP ${status}`;
}

const callCompatibleChat = async (
  provider,
  userMsg,
  { json = false, maxTokens = 4096 } = {},
) => {
  const apiKey = getProviderKey(provider);
  // Local com chave: proxy Vite directo. Sem chave: proxy serverless (env no host).
  const useDirect = IS_LOCAL_DEV && !!apiKey;
  const preferred = getTextModel(provider);
  const modelCandidates = provider === 'zai'
    ? [preferred, ...ZAI_FALLBACK_MODELS.filter((m) => m !== preferred)]
    : [preferred];

  const basePayload = {
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: `${AI_SYSTEM_PT} Responda APENAS o que foi pedido, sem texto extra.` },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.8,
  };
  if (json) basePayload.response_format = { type: 'json_object' };

  const url = useDirect ? COMPATIBLE_DIRECT_URLS[provider] : COMPATIBLE_AI_URL;
  let lastError = null;

  for (let i = 0; i < modelCandidates.length; i += 1) {
    const model = modelCandidates[i];
    const payload = { ...basePayload, model };
    const headers = { 'Content-Type': 'application/json' };
    const body = useDirect
      ? payload
      : { provider, operation: 'chat', apiKey: apiKey || undefined, payload };
    if (useDirect) headers.Authorization = `Bearer ${apiKey}`;

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
        signal: textTimeoutSignal(),
      });
    } catch (error) {
      throw enhanceNetworkError(error, provider === 'zai' ? 'Z.ai' : 'Kimi');
    }

    // 429 do rate-limiter do PROXY (traz Retry-After) — não é overload da Z.ai; cascatear
    // só multiplicava pedidos contra o mesmo limite (auditoria H3).
    const retryAfter = res.headers?.get?.('retry-after');
    if (!useDirect && res.status === 429 && retryAfter) {
      const e = new Error(`Muitos pedidos seguidos. Aguarde ${retryAfter}s e tente de novo.`);
      e.status = 429;
      e.code = 'rate_limited';
      throw e;
    }

    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); }
    catch {
      lastError = new Error(`${provider === 'zai' ? 'Z.ai' : 'Kimi'}: resposta inválida (HTTP ${res.status})`);
      continue;
    }

    if (!res.ok || data.error) {
      if (!useDirect) {
        const gate = sessionGateError(res.status, data);
        if (gate) throw gate;
      }
      lastError = new Error(translateProviderError(provider, res.status, data, raw));
      // Flash/grátis em overload → tenta modelo pago seguinte.
      if (provider === 'zai' && isZaiOverloadError(res.status, data, raw) && i < modelCandidates.length - 1) {
        continue;
      }
      throw lastError;
    }

    const text = data.choices?.[0]?.message?.content || '';
    if (!text.trim()) {
      lastError = new Error(`${provider === 'zai' ? 'Z.ai' : 'Kimi'} retornou conteúdo vazio.`);
      if (i < modelCandidates.length - 1) continue;
      throw lastError;
    }
    return json ? extractJSON(text) : text.trim();
  }

  throw lastError || new Error('Z.ai indisponível. Tenta de novo.');
};

// Texto incluso = Z.ai no servidor (`ZAI_API_KEY`). Sem chave própria noutro
// provedor, usa sempre Z.ai — não cai em Anthropic (mais caro).
const callAI = async (userMsg, { json = false, maxTokens = 4096, openaiKey = null } = {}) => {
  let provider = _aiRuntimeSettings.textProvider;
  if (provider === 'openai' && !(getProviderKey('openai') || openaiKey)) provider = 'zai';
  if (provider === 'anthropic' && !getProviderKey('anthropic')) provider = 'zai';
  if (provider === 'kimi' && !getProviderKey('kimi')) provider = 'zai';

  if (provider === 'anthropic') return callAnthropic(userMsg, { json, maxTokens });
  if (provider === 'openai') {
    return callOpenAIChat(userMsg, { json, maxTokens, key: getProviderKey('openai') || openaiKey });
  }
  if (provider === 'zai' || provider === 'kimi') {
    return callCompatibleChat(provider, userMsg, { json, maxTokens });
  }
  throw new Error('Modelo de texto inválido. Abra Configurar IA e escolha uma opção.');
};

// Pesquisa com web_search é EXCLUSIVA do Claude/Anthropic (BYOK). Sem chave Anthropic,
// a UI deve cair em callAI (Z.ai) sem web ao vivo.
const callAIwithSearch = async (userMsg, { json = false, maxTokens = 4096 } = {}) => {
  if (!getProviderKey('anthropic')) {
    throw new Error('Pesquisa web ao vivo precisa de chave Anthropic (opcional).');
  }
  return callAnthropic(userMsg, {
    json, maxTokens,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });
};

// ─── GPT IMAGE 2 (OpenAI) ─────────────────────────────────────────────────────
// Migração de DALL·E 3 → gpt-image-2 (modelo flagship lançado em abril/2026):
// - Fotorealismo significativamente melhor (rosto, pele, texturas)
// - Sem o "prompt rewriting" agressivo do DALL·E 3 (não precisa do hack "I NEED to test…")
// - Sem `style:'vivid|natural'` — modelo já é natural por padrão
// - Suporta resoluções flexíveis (múltiplos de 16, max edge 3840px); `1024x1280` é
//   exato 4:5 do feed do Instagram, melhor que 1024x1792 (que era 9:16 no DALL·E 3).
//
// Prompt baseado nas best practices oficiais (developers.openai.com/cookbook):
// usar palavra "photorealistic" diretamente, vocabulário de fotografia (lente, luz,
// grão de filme), detalhes de textura real (poros, rugas, gasto de tecido), e
// EVITAR palavras que sugiram studio polish/staging.
const GPT_IMAGE_ART_DIRECTION = `You are an art director specialized in realistic imagery for editorial, institutional and commercial carousels. Create a visual support image for a card, always connected to the central theme of the content but avoiding obvious, generic or excessively literal solutions.

GENERAL DIRECTION
Generate realistic, natural and sophisticated images that look like real photographs or carefully composed documentary scenes captured in a real moment — not artificially created. Avoid creative exaggeration, visual fantasy, gratuitous surrealism, excess elements, overly dramatic compositions or visual cliché metaphors. The image must convey visual intelligence, subtlety and context.

AESTHETIC
Realistic, clean, contemporary, natural. Use natural or soft light, moderate contrast, sober balanced colors, real texture of environments and people, discrete cinematic composition, natural shallow depth of field, editorial premium atmosphere. Subtle film grain. Slightly desaturated muted tones. No glamorization, no heavy retouching, no studio strobes, no extreme contrast.

RELATION TO THEME
Connect to the card's theme intelligently and indirectly. Avoid clichés: no chess for "strategy", no rising graphs for "growth", no lightbulbs for "ideas", no floating holograms or robots for "technology", no generic corporate meetings for "business", no paint splashes for "creativity", no handshakes for "partnership". Suggest the concept through atmosphere, gesture, context, object or visual tension. The image is a sophisticated visual layer, not an obvious caption.

COMPOSITION FOR CAROUSEL
Designed for carousel cards. Leave visual breathing space for text overlay. Important elements never at edges. Negative space, slightly defocused background, one clear focal element, few objects, balance between information and visual silence. Image must not compete with text.

PEOPLE
Real, natural, spontaneous — never posed-model, no advertising smile. Contemporary, discrete clothing. Plausible situations. No artificially staged diversity, no generic corporate-ad composition. Real skin texture with visible pores and slight imperfections, natural unposed expressions.

ENVIRONMENTS
Real, well-observed: contemporary offices, urban streets, cafés, studios, homes, shops, behind-the-scenes, work spaces, cultural spaces, objects on tables, process details. The environment reinforces the theme without looking staged.

VISUAL QUALITY
Photorealistic, shot like 35mm film photograph at eye level using a 50mm lens, shallow depth of field, subtle film grain, natural color balance. Realistic materials, organic texture, subtle imperfections. Avoid: plasticized skin, deformed hands, malformed objects, floating elements, fake logos, excessive sharpness, evident AI aesthetic.

EXPECTED OUTPUT
A photorealistic, sophisticated and natural image related to the theme indirectly, with low saturation, moderate contrast, clean composition, generous text-friendly space, premium editorial appearance. Feels real, silent, intelligent and visually refined. Strictly no text, no captions, no watermarks, no logos inside the image.`;

function dataUrlToBlob(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Formato de imagem inválido.');
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const mime = (m[1] || 'image/png').split(';')[0].trim();
  return new Blob([arr], { type: mime || 'image/png' });
}

async function blobFromSlideRef(refImage) {
  if (!refImage || typeof refImage !== 'string') throw new Error('Referência ausente.');
  if (refImage.startsWith('data:')) return dataUrlToBlob(refImage);
  const res = await fetch(refImage);
  if (!res.ok) throw new Error('Não foi possível carregar a URL da imagem de referência.');
  return res.blob();
}

/** Prompt completo para GPT Image (geração ou edição com referência). */
function buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference = false, priorityFirst = false } = {}) {
  const safeTheme = (q || '').slice(0, 280);
  const axisTags = buildImgParamsTagsEN(imgParams);
  const extra = (imgExtraPrompt || '').trim().slice(0, priorityFirst ? 1200 : 2000);
  const refLead = withReference
    ? 'REFERENCE IMAGE IS ATTACHED: Preserve brand/product identity — palette, materials, proportions, packaging style, typography mood. Produce a NEW editorial photograph suitable as a carousel slide background with generous negative space for headline/body text; reinterpret in a fresh scene aligned with the theme — do not output a flat crop of the reference alone.\n\n'
    : '';
  if (priorityFirst) {
    // Caminho SJinn corta a 4000 chars: o que importa (tema, marca, regras duras) vai à frente
    // e o art-direction longo fica no fim, onde um corte custa menos (auditoria H8).
    let head =
      `THEME OF THIS CARD: ${safeTheme}${axisTags}\n\n` +
      refLead +
      (extra ? `BRAND / CLIENT DIRECTION (priority — incorporate faithfully):\n${extra}\n\n` : '') +
      'HARD RULES: photorealistic real-photograph rendering; generous text-friendly negative space; strictly no text, no captions, no watermarks, no logos inside the image.\n\n' +
      'ART DIRECTION (follow as far as it fits the theme):\n';
    return head + GPT_IMAGE_ART_DIRECTION;
  }
  let body =
    `${GPT_IMAGE_ART_DIRECTION}\n\n` +
    refLead +
    `THEME OF THIS CARD: ${safeTheme}` +
    `${axisTags}`;
  if (extra) {
    body += `\n\nBRAND / CLIENT DIRECTION (priority — incorporate faithfully):\n${extra}`;
  }
  body += `\n\nNow create the image following all the directions above. Use photorealistic real-photograph rendering.`;
  return body;
}

async function generateZaiImage(q, imgParams, imgExtraPrompt) {
  const apiKey = getProviderKey('zai');
  if (!apiKey) throw new Error('Falta a chave da Z.ai. Adicione-a em Configurar IA.');
  const model = _aiRuntimeSettings.imageModels?.zai || 'cogview-4-250304';
  const prompt = buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference: false });
  const payload = {
    model,
    prompt: prompt.slice(0, 32000),
    size: model === 'glm-image' ? '1088x1472' : '864x1152',
    quality: model === 'glm-image' ? 'hd' : 'standard',
  };
  const useDirect = IS_LOCAL_DEV;
  const url = useDirect
    ? '/api/zai/api/paas/v4/images/generations'
    : COMPATIBLE_AI_URL;
  const headers = { 'Content-Type': 'application/json' };
  const body = useDirect
    ? payload
    : { provider: 'zai', operation: 'images', apiKey, payload };
  if (useDirect) headers.Authorization = `Bearer ${apiKey}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw enhanceNetworkError(error, 'Z.ai Image');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || data.code) {
    throw new Error(data?.error?.message || data?.message || `Z.ai Image HTTP ${res.status}`);
  }
  const image = data.data?.[0];
  if (image?.b64_json) {
    return `data:${image.mime || 'image/png'};base64,${image.b64_json}`;
  }
  if (image?.url) return image.url;
  throw new Error('Z.ai não retornou a imagem.');
}

// Lista de modelos OpenAI tentados em ordem (do mais novo/melhor pro mais antigo).
// `gpt-image-2` exige org verificada (>=abril/2026); `gpt-image-1` e `dall-e-3`
// não. O fallback acontece automaticamente quando a API retorna 403 (verificação)
// ou 404 (modelo não disponível na conta).
const OPENAI_IMAGE_MODELS = [
  // Família GPT Image (params modernos: quality high|medium|low, qualquer size múltiplo de 16)
  { name: 'gpt-image-2',   size: '1024x1280', quality: 'high' },
  { name: 'gpt-image-1.5', size: '1024x1536', quality: 'high' },
  { name: 'gpt-image-1',   size: '1024x1536', quality: 'high' },
  // Legacy: DALL·E 3 (params diferentes — usa hd/standard, vivid/natural)
  { name: 'dall-e-3',      size: '1024x1792', quality: 'hd', style: 'natural', responseFormat: true },
];

let _cachedModel = null; // memoiza o primeiro modelo que funcionou nesta sessão
function getOpenAIImageOrder() {
  const selectedName = _aiRuntimeSettings.imageModels?.openai || 'gpt-image-2';
  const selected = OPENAI_IMAGE_MODELS.find((model) => model.name === selectedName);
  const candidates = [selected, _cachedModel, ...OPENAI_IMAGE_MODELS].filter(Boolean);
  return candidates.filter(
    (model, index, all) => all.findIndex((item) => item.name === model.name) === index,
  );
}

/** Geração com uma ou mais imagens de referência (API edits — multipart). */
async function generateDALLEEdits(refBlob, prompt, apiKey) {
  if (!IS_LOCAL_DEV && !apiKey) throw new Error('Chave OpenAI ausente.');
  const headers = {};
  if (IS_LOCAL_DEV) {
    if (apiKey) headers['x-openai-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const order = getOpenAIImageOrder();

  let lastErr = null;
  for (const model of order) {
    const fd = new FormData();
    fd.append('model', model.name);
    fd.append('prompt', prompt.slice(0, model.name === 'dall-e-3' ? 4000 : 32000));
    fd.append('n', '1');
    fd.append('size', model.size);
    fd.append('quality', model.quality);
    if (model.style) fd.append('style', model.style);
    if (model.responseFormat) fd.append('response_format', 'b64_json');
    const ext =
      (refBlob.type && refBlob.type.includes('jpeg')) || (refBlob.type && refBlob.type.includes('jpg'))
        ? 'jpg'
        : 'png';
    fd.append('image[]', refBlob, `reference.${ext}`);

    try {
      let res;
      try {
        res = await fetch(OPENAI_IMAGE_EDITS_URL, { method: 'POST', headers, body: fd });
      } catch (e) {
        throw enhanceNetworkError(e, 'GPT Image (referência)');
      }
      if (res.status === 404 && IS_LOCAL_DEV && String(OPENAI_IMAGE_EDITS_URL).startsWith('/api')) {
        throw new Error(
          'Ambiente local sem as rotas de imagem: use o servidor de desenvolvimento em vez do preview.',
        );
      }
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const msg = errPayload.error?.message || `HTTP ${res.status}`;
        const shouldFallback =
          res.status === 403 ||
          res.status === 404 ||
          res.status === 400 ||
          /must be verified|model.*not.*found|does not have access|unsupported model|not supported/i.test(msg);
        if (shouldFallback) {
          console.warn(`[OpenAI Image edits] ${model.name}: ${msg} — próximo modelo`);
          lastErr = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      const d = await res.json();
      _cachedModel = model;
      return `data:image/png;base64,${d.data[0].b64_json}`;
    } catch (e) {
      if (e instanceof TypeError) { lastErr = e; continue; }
      throw e;
    }
  }
  throw new Error(
    lastErr?.message ||
      'Nenhum modelo aceitou imagem de referência. Tente gerar só com texto ou outro modelo.',
  );
}

const generatePlatformSjinnImage = async (q, imgParams = null, options = {}) => {
  const { imgExtraPrompt } = options || {};
  if (options?.refImage) {
    console.warn('[img] Referência ignorada no modo plano (requer URL pública).');
  }
  const prompt = buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference: false, priorityFirst: true });
  let res;
  try {
    res = await fetch('/api/ai/sjinn-image', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.slice(0, 4000),
        aspectRatio: '2:3',
        resolution: '1K',
      }),
    });
  } catch (e) {
    throw enhanceNetworkError(e, 'Imagens do plano');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const gate = sessionGateError(res.status, data);
    if (gate && !data.code) throw Object.assign(gate, { platformImage: true });
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    err.quota = data.quota;
    err.status = res.status;
    err.platformImage = true; // o servidor já reembolsou/decidiu — não retentar (auditoria C3)
    // Quota esgotada / plano sem imagem: actualiza o estado da UI também em erro (auditoria H6).
    if (typeof window !== 'undefined' && data.quota) {
      window.dispatchEvent(new CustomEvent('vc:image-quota', { detail: { ...data.quota, tier: data.tier || data.quota.tier } }));
    }
    throw err;
  }
  if (!data.b64_json) throw new Error('Plataforma não devolveu a imagem.');
  if (typeof window !== 'undefined' && data.quota) {
    window.dispatchEvent(new CustomEvent('vc:image-quota', { detail: data.quota }));
  }
  return `data:${data.mime || 'image/png'};base64,${data.b64_json}`;
};

/**
 * GPT Image a partir de texto. Opcional: `options.refImage` (data URL ou https) + `options.imgExtraPrompt`.
 * Com referência, usa POST /v1/images/edits; sem referência, /v1/images/generations.
 * Default: imagens inclusas no plano. BYOK só com useOwnImageKey.
 */
const generateDALLE = async (q, apiKey, imgParams = null, options = {}) => {
  const { refImage, imgExtraPrompt } = options || {};

  if (!_aiRuntimeSettings.useOwnImageKey) {
    return generatePlatformSjinnImage(q, imgParams, options);
  }

  if (_aiRuntimeSettings.imageProvider === 'zai') {
    return generateZaiImage(q, imgParams, imgExtraPrompt);
  }
  apiKey = getProviderKey('openai') || apiKey;
  if (!IS_LOCAL_DEV && !apiKey) throw new Error('Chave OpenAI ausente.');

  if (refImage) {
    try {
      const blob = await blobFromSlideRef(refImage);
      const promptRef = buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference: true });
      return await generateDALLEEdits(blob, promptRef, apiKey);
    } catch (e) {
      console.warn('[GPT Image] Referência indisponível, gerando só com texto:', e.message);
    }
  }

  const prompt = buildGptImageFullPrompt(q, imgParams, imgExtraPrompt, { withReference: false });
  const headers = { 'Content-Type': 'application/json' };
  if (IS_LOCAL_DEV) {
    if (apiKey) headers['x-openai-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const order = getOpenAIImageOrder();

  let lastErr = null;
  for (const model of order) {
    const body = {
      model: model.name,
      prompt: prompt.slice(0, model.name === 'dall-e-3' ? 4000 : 32000),
      n: 1,
      size: model.size,
      quality: model.quality,
    };
    if (model.style) body.style = model.style;
    if (model.responseFormat) body.response_format = 'b64_json';

    try {
      let res;
      try {
        res = await fetch(OPENAI_IMAGE_URL, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        throw enhanceNetworkError(e, 'GPT Image');
      }
      if (res.status === 404 && IS_LOCAL_DEV && String(OPENAI_IMAGE_URL).startsWith('/api')) {
        throw new Error(
          'Ambiente local sem as rotas de imagem: use o servidor de desenvolvimento em vez do preview.',
        );
      }
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const msg = errPayload.error?.message || `HTTP ${res.status}`;
        const shouldFallback =
          res.status === 403 ||
          res.status === 404 ||
          /must be verified|model.*not.*found|does not have access|unsupported model/i.test(msg);
        if (shouldFallback) {
          console.warn(`[OpenAI Image] ${model.name} indisponível: ${msg} — tentando próximo modelo`);
          lastErr = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      const d = await res.json();
      _cachedModel = model;
      return `data:image/png;base64,${d.data[0].b64_json}`;
    } catch (e) {
      if (e instanceof TypeError) { lastErr = e; continue; }
      throw e;
    }
  }
  throw new Error(
    `Nenhum modelo de imagem da OpenAI disponível para sua conta. ` +
      `Último erro: ${lastErr?.message || 'desconhecido'}. ` +
      `Verifique sua organização em https://platform.openai.com/settings/organization/general`,
  );
};

/** Wrapper que tenta `generateDALLE` até N+1 vezes com backoff curto. Útil para rate-limits transitórios.
 *  Erros 4xx persistentes (auth, conteúdo, modelo indisponível) NÃO retentam — só rede / 5xx / 429. */
const generateDALLEWithRetry = async (q, apiKey, imgParams = null, options = {}, { retries = 1, backoffMs = 1200 } = {}) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await generateDALLE(q, apiKey, imgParams, options);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || '');
      // Erros do endpoint do plano (quota, sessão, sjinn_*) já foram decididos no servidor — retentar
      // duplicava o débito de crédito (auditoria C3/H6). Só rede transitória volta a tentar.
      const isRetriable =
        e?.isNetwork === true ||
        (!e?.platformImage && !e?.code && (
          e instanceof TypeError ||
          /HTTP\s*5\d\d|429|rate.?limit|timeout|network|fetch/i.test(msg)
        ));
      if (!isRetriable || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  throw lastErr;
};

export function getAIRuntimeSettings() {
  return _aiRuntimeSettings;
}

export {
  IS_LOCAL_DEV,
  USE_ANTHROPIC_PROXY,
  ANTHROPIC_URL,
  OPENAI_CHAT_URL,
  OPENAI_IMAGE_URL,
  OPENAI_IMAGE_EDITS_URL,
  COMPATIBLE_AI_URL,
  enhanceNetworkError,
  AI_SYSTEM_PT,
  setAIRuntimeSettings,
  getTextModel,
  getProviderKey,
  callAnthropic,
  callOpenAIChat,
  COMPATIBLE_DIRECT_URLS,
  callCompatibleChat,
  callAI,
  callAIwithSearch,
  ZAI_FALLBACK_MODELS,
  GPT_IMAGE_ART_DIRECTION,
  dataUrlToBlob,
  blobFromSlideRef,
  buildGptImageFullPrompt,
  generateZaiImage,
  OPENAI_IMAGE_MODELS,
  getOpenAIImageOrder,
  generateDALLEEdits,
  generateDALLE,
  generateDALLEWithRetry,
};
