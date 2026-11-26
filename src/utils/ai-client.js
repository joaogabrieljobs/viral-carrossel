import { modelStyleRules } from '../config/model-style.js';
import { runAIJob, throwIfGenerationCancelled, isGenerationCancelled, abortableDelay } from './generation-control.js';
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
import { imageFramingDirection } from '../../shared/image-aspect.js';
import { IMAGE_PROMPT_TEXT, imageRouteCapabilities, planImageRequest } from '../../shared/image-prompt.js';
import { prepareImageReferencesForUpload } from './image-reference-upload.js';
import { PITCH_SYSTEM_PT } from './pitch-content.js';
import { assertPaidFeature } from './free-plan.js';
import { buildPresentationSystemPrompt } from './presentation.js';

// Acima do orçamento do proxy (240 s em api/ai/compatible.js): se o cliente
// abortasse primeiro, o utilizador perdia uma geração que o servidor ainda ia
// entregar. Só existe para não deixar o botão preso para sempre.
const TEXT_TIMEOUT_MS = 260_000;
async function fetchText(url, options) {
  const controller = new AbortController();
  const parent = options.signal;
  let timer;
  const cancel = () => { clearTimeout(timer); controller.abort(parent.reason); };
  parent?.addEventListener('abort', cancel, { once: true });
  if (parent?.aborted) cancel();
  timer = setTimeout(() => controller.abort(Object.assign(new Error('Tempo de resposta excedido.'), { name: 'TimeoutError' })), TEXT_TIMEOUT_MS);
  try {
    throwIfGenerationCancelled(parent);
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Mantém cancelamento e timeout ativos até terminar de ler o corpo.
    let raw;
    try { raw = await response.text(); }
    catch (error) {
      // Auditoria 23/11 (B5): o servidor já respondeu (ex.: 503) e o corpo
      // caiu no meio. Leva o status, para a mensagem não culpar a internet.
      if (error && typeof error === 'object' && !Number.isInteger(error.status)) {
        try { error.status = response.status; } catch { /* erro congelado */ }
      }
      throw error;
    }
    return { ok: response.ok, status: response.status, headers: response.headers, text: async () => raw };
  }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', cancel); }
}

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
  if (isGenerationCancelled(err)) return err;
  const m = (err && err.message) ? err.message : String(err);
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    const t = new Error(`${label}: a resposta demorou muito. Tente novamente.`);
    t.isNetwork = true;
    return t;
  }
  // Auditoria 23/11 (B5): com status 5xx a resposta chegou; a falha é do
  // serviço, não da conexão de quem usa ("verifique sua internet" era errado).
  if (Number.isInteger(err?.status) && err.status >= 500) {
    const s = new Error(`${label}: o serviço de IA falhou (HTTP ${err.status}). Nada foi perdido. Tente novamente em alguns segundos.`);
    s.status = err.status;
    s.isNetwork = true;
    return s;
  }
  if (!/failed to fetch|networkerror|network error|load failed|network request failed/i.test(m)) {
    return err instanceof Error ? err : new Error(m);
  }
  const hosted = typeof window !== 'undefined' && !IS_LOCAL_DEV;
  const isClaude = /claude|anthropic/i.test(label);
  const isOpenAI = /openai|gpt|dall/i.test(label);
  let hint;
  if (!hosted) {
    // Dev local: provavelmente o proxy /api não está respondendo
    // Só alcançável em localhost — mensagem para quem desenvolve.
    hint = 'Ambiente local: confirme que o servidor de desenvolvimento está em execução e que há internet.';
  } else if (isClaude) {
    hint =
      'Não foi possível falar com o Claude. Confirme sua chave em Configurar IA ou escolha outro modelo de texto.';
  } else if (isOpenAI) {
    hint =
      'Sua chave OpenAI pode estar inválida, expirada ou sem saldo. ' +
      'Verifique em platform.openai.com/api-keys e platform.openai.com/account/billing. ' +
      'Se ainda não configurou, adicione a chave em Configurar IA.';
  } else {
    hint =
      'Não foi possível falar com a IA. Verifique sua conexão com a internet e tente novamente.';
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

/**
 * Nos proxies de texto, só o portão do Moont marca a própria recusa (cabeçalho
 * `X-Moont-Gate` ou `error.code`); o 401/402 do provedor é repassado sem marca
 * e não é sessão expirada (auditoria 23/11, IA-07).
 */
function moontGateError(res, data) {
  const marked = !!res?.headers?.get?.('x-moont-gate')
    || ['session_required', 'subscription_inactive'].includes(data?.error?.code);
  return marked ? sessionGateError(res.status, data) : null;
}

/** 401 do provedor com a chave da própria pessoa: sair e entrar de novo não resolve. */
function providerKeyRejectedError() {
  return Object.assign(new Error('Chave recusada pelo provedor. Confira em Configurar IA.'), { status: 401, code: 'provider_key_rejected' });
}

const AI_SYSTEM_CORE = 'Você é especialista em conteúdo estratégico para redes sociais. Escreva com verbos concretos e vocabulário adequado ao público; evite jargão corporativo vazio e tom de guru. Use somente o material fornecido como base factual. Não invente dados, pesquisas, citações, preços, vagas, prazos, depoimentos, casos, cenas, sensações, hábitos do público, generalizações ou relações de causa e efeito; isso também vale para afirmações sem números. Um problema, benefício ou resultado apenas plausível não é um fato disponível. Preserve condições, limites e a diferença entre plano e realização. Notas de produção, como marca fictícia ou rascunho, não viram automaticamente texto público; quando um exemplo, dado ou resultado simulado puder ser confundido com evidência real, identifique seu caráter ilustrativo junto ao conteúdo pertinente. Só desenvolva exemplos hipotéticos quando o usuário os solicitar expressamente, sem apresentá-los como fatos do projeto. Fidelidade e restrições do usuário prevalecem sobre o arco e o tom; não complete etapas com informação ausente. Não use Slide N/Card N como rótulo no texto visível; Passo N é permitido em tutoriais. Preserve o schema solicitado, sem acrescentar campos.';

const CONTENT_LANGUAGE_SYSTEM_RULES = Object.freeze({
  en: 'Write every reader-visible field (titles, subtitles, paragraphs and captions) in natural English. Do not switch to Portuguese. Image-search keywords may remain in English.',
  es: 'Escribe todos los campos visibles para el lector (títulos, subtítulos, párrafos y leyendas) en español natural. No cambies al portugués. Las palabras clave de búsqueda de imágenes pueden permanecer en inglés.',
  'pt-BR': 'Use português brasileiro em todo texto visível ao leitor (títulos, subtítulos, parágrafos e legendas). Palavras-chave de busca de imagem podem permanecer em inglês. Escreva com naturalidade brasileira.',
});

const CONTENT_LANGUAGE_POLICY = `IDIOMA DO CONTEÚDO — ordem de prioridade:
1. Siga o idioma explicitamente pedido pelo usuário, inclusive nas Instruções adicionais, em TODO o texto visível (title, subtitle, bodyAfterImage e caption).
2. Sem pedido explícito de idioma, siga a língua predominante do briefing e do conteúdo fornecidos pelo usuário. Em revisão ou refinamento, preserve a língua do conteúdo atual, salvo pedido de tradução.
3. Use português brasileiro apenas quando o pedido e o material não permitirem identificar um idioma.
Instruções técnicas, rótulos da interface, exemplos internos, voz de referência e palavras-chave de imagem não definem o idioma. Uma regra automática do app que peça português não deve substituir a escolha explícita do usuário ou a língua do briefing. imageQuery permanece no idioma solicitado para busca de imagem, sem mudar o idioma dos demais campos.`;

function buildContentSystemPrompt(language = '') {
  const languageRule = CONTENT_LANGUAGE_SYSTEM_RULES[language] || '';
  return `${AI_SYSTEM_CORE} ${CONTENT_LANGUAGE_POLICY}${languageRule ? `\n${languageRule}` : ''}`;
}

const AI_SYSTEM_PT = buildContentSystemPrompt();

// Configuração selecionada no modal. Mantida em módulo para as funções de geração,
// que vivem fora do componente React, lerem a preferência atual sem prop drilling.
let _aiRuntimeSettings = normalizeAISettings(DEFAULT_AI_SETTINGS);
const setAIRuntimeSettings = (value) => {
  _aiRuntimeSettings = normalizeAISettings(value);
};
const getTextModel = (provider) =>
  _aiRuntimeSettings.textModels?.[provider] || DEFAULT_AI_SETTINGS.textModels[provider];
const getProviderKey = (provider) => String(_aiRuntimeSettings.keys?.[provider] || '').trim();

const parseStructuredText = (text, json, jsonParser) => (
  json ? (typeof jsonParser === 'function' ? jsonParser(text) : extractJSON(text)) : text.trim()
);

function responseDiagnostics(provider, model, reason, maxTokens, usage = {}) {
  const value = { provider, model: String(model || '').slice(0, 100), finishReason: String(reason || '').slice(0, 40), maxTokens };
  for (const [name, amount] of Object.entries({ promptTokens: usage.prompt_tokens ?? usage.input_tokens, completionTokens: usage.completion_tokens ?? usage.output_tokens, totalTokens: usage.total_tokens, reasoningTokens: usage.completion_tokens_details?.reasoning_tokens })) {
    if (Number.isFinite(amount) && amount >= 0) value[name] = amount;
  }
  return value;
}

function assertCompleteText(reason, aiDiagnostics) {
  if (reason !== 'length' && reason !== 'max_tokens') return;
  throw Object.assign(new Error('A resposta da IA ficou incompleta. Reduza a quantidade de slides ou o material e tente novamente. Seu projeto foi preservado.'), { code: 'ai_output_truncated', ...(aiDiagnostics ? { aiDiagnostics } : {}) });
}

const callAnthropic = async (userMsg, { json = false, jsonParser = null, maxTokens = 4096, tools = null, signal, systemPrompt = AI_SYSTEM_PT, thinking } = {}) => {
  const model = getTextModel('anthropic');
  const body = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  };
  // Haiku 5.5 pensa por padrão (esforço médio) e o raciocínio conta no teto de
  // saída. A geração do Moont pede raciocínio desligado, como no GLM; o Haiku
  // 5.5 aceita isso no esforço padrão (teste de custo 22/11).
  if (thinking === 'disabled' && /^claude-haiku-5-5$/.test(model)) body.thinking = { type: 'disabled' };
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
    res = await fetchText(ANTHROPIC_URL, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
      signal,
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
    const gate = moontGateError(res, data);
    if (gate) throw gate;
    // Claude só funciona com a chave da própria pessoa.
    if (res.status === 401) throw providerKeyRejectedError();
    const e = new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  assertCompleteText(data.stop_reason);
  const text = (data.content||[])
    .filter(b => b?.type === 'text')
    .map(b => b.text)
    .join('\n');
  if (!text.trim()) throw new Error('Claude retornou conteúdo vazio.');
  return parseStructuredText(text, json, jsonParser);
};

// Backend OpenAI — Chat Completions com a família GPT-5.6.
const callOpenAIChat = async (userMsg, { json = false, jsonParser = null, maxTokens = 4096, key, signal, systemPrompt = AI_SYSTEM_PT, thinking }) => {
  key = String(key || getProviderKey('openai')).trim();
  // Em local dev, o proxy usa a chave do .env.local quando o frontend não envia uma.
  // Fora do dev (Claude artifact), a chave é obrigatória.
  if (!IS_LOCAL_DEV && !key) throw new Error('Falta a chave da OpenAI. Adicione-a em Configurar IA.');
  const model = getTextModel('openai');
  const body = {
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: `${systemPrompt} Responda APENAS o que foi pedido, sem texto extra, sem markdown explicativo.${modelStyleRules(model)}` },
      { role: 'user',   content: userMsg },
    ],
  };
  // GPT-6 (teste de custo 22/11): raciocínio por padrão em "medium"; a geração
  // pede desligado (`none`, aceito pelo modelo). A documentação não confirma o
  // json_object legado na família 6: o JSON vem pelo pedido, como no Claude.
  const gpt6 = /^gpt-6(?:[.-]|$)/.test(body.model);
  if (gpt6 && thinking === 'disabled') body.reasoning_effort = 'none';
  if (json && !gpt6) body.response_format = { type: 'json_object' };
  const headers = { 'Content-Type': 'application/json' };
  if (IS_LOCAL_DEV) {
    if (key) headers['x-openai-key'] = key; // senão, proxy usa OPENAI_API_KEY do .env.local
  } else {
    headers['Authorization'] = `Bearer ${key}`;
  }
  let res;
  try {
    res = await fetchText(OPENAI_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
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
  assertCompleteText(data.choices?.[0]?.finish_reason);
  const text = data.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('OpenAI retornou conteúdo vazio.');
  return parseStructuredText(text, json, jsonParser);
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
    return 'A Moont AI está sobrecarregada neste momento. Tente novamente em alguns segundos.';
  }
  if (status === 401 || /token expired|incorrect|unauthorized/i.test(msg)) {
    return 'A IA incluída no plano está indisponível neste momento. Tente novamente em instantes — se persistir, fale com o suporte.';
  }
  if (status === 429) {
    return 'Muitos pedidos à Moont AI. Aguarde um momento e tente novamente.';
  }
  return msg || `${provider === 'zai' ? 'Moont AI' : 'Kimi'} HTTP ${status}`;
}

const callCompatibleChat = async (
  provider,
  userMsg,
  { json = false, jsonParser = null, maxTokens = 4096, signal, systemPrompt = AI_SYSTEM_PT, temperature = 0.8, onRetry, thinking, onResponseMetadata } = {},
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
      { role: 'system', content: `${systemPrompt} Responda APENAS o que foi pedido, sem texto extra.` },
      { role: 'user', content: userMsg },
    ],
    temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(1, temperature)) : 0.8,
  };
  if (json) basePayload.response_format = { type: 'json_object' };

  const url = useDirect ? COMPATIBLE_DIRECT_URLS[provider] : COMPATIBLE_AI_URL;
  let lastError = null;

  for (let i = 0; i < modelCandidates.length; i += 1) {
    throwIfGenerationCancelled(signal);
    const model = modelCandidates[i];
    const payload = { ...basePayload, model };
    // Structured generation needs bounded JSON rather than hidden reasoning
    // consuming its output budget. Only explicit callers and supported Z.ai
    // models get this parameter; other providers retain their own behavior.
    if (provider === 'zai' && thinking === 'disabled' && /^glm-(?:4\.[67](?:-|$)|5(?:\.[012])?(?:-|$))/i.test(model)) {
      payload.thinking = { type: 'disabled' };
    }
    const headers = { 'Content-Type': 'application/json' };
    const body = useDirect
      ? payload
      : { provider, operation: 'chat', apiKey: apiKey || undefined, payload };
    if (useDirect) headers.Authorization = `Bearer ${apiKey}`;

    let res;
    try {
      res = await fetchText(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      throw enhanceNetworkError(error, provider === 'zai' ? 'Moont AI' : 'Kimi');
    }

    // 429 do rate-limiter do PROXY (traz Retry-After) — não é overload da Z.ai; cascatear
    // só multiplicava pedidos contra o mesmo limite (auditoria H3).
    const retryAfter = res.headers?.get?.('retry-after');
    if (!useDirect && res.status === 429 && retryAfter) {
      const e = new Error(`Muitos pedidos seguidos. Aguarde ${retryAfter}s e tente novamente.`);
      e.status = 429;
      e.code = 'rate_limited';
      throw e;
    }

    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); }
    catch {
      lastError = new Error(`${provider === 'zai' ? 'Moont AI' : 'Kimi'}: resposta inválida (HTTP ${res.status})`);
      if (i < modelCandidates.length - 1) {
        onRetry?.({ attempt:i + 2, total:modelCandidates.length, reason:'resposta inválida do serviço' });
      }
      continue;
    }

    if (!res.ok || data.error) {
      if (!useDirect) {
        const gate = moontGateError(res, data);
        if (gate) throw gate;
      }
      if (res.status === 401 && apiKey) throw providerKeyRejectedError();
      // Limite diário do texto incluso (auditoria 23/11, IA-01): quem recusou
      // foi o Moont, não o provedor. Trocar de modelo só repetia a recusa, e a
      // frase do servidor (quando volta, chave própria) era descartada.
      if (res.status === 429 && data?.error?.code === 'text_quota_exhausted') {
        throw Object.assign(
          new Error(String(data.error.message || '').trim() || 'Você atingiu o limite diário de texto incluído no plano. Ele volta à meia-noite, ou use sua própria chave em Configurar IA.'),
          { status: 429, code: 'text_quota_exhausted' },
        );
      }
      lastError = new Error(translateProviderError(provider, res.status, data, raw));
      // Flash/grátis em overload → tenta modelo pago seguinte.
      if (provider === 'zai' && isZaiOverloadError(res.status, data, raw) && i < modelCandidates.length - 1) {
        onRetry?.({ attempt:i + 2, total:modelCandidates.length, reason:'serviço temporariamente ocupado' });
        continue;
      }
      throw lastError;
    }

    const diagnostics = responseDiagnostics(provider, model, data.choices?.[0]?.finish_reason, maxTokens, data.usage);
    onResponseMetadata?.(diagnostics);
    assertCompleteText(data.choices?.[0]?.finish_reason, diagnostics);
    const text = data.choices?.[0]?.message?.content || '';
    if (!text.trim()) {
      lastError = new Error(`${provider === 'zai' ? 'Moont AI' : 'Kimi'} retornou conteúdo vazio.`);
      if (i < modelCandidates.length - 1) {
        onRetry?.({ attempt:i + 2, total:modelCandidates.length, reason:'resposta vazia do serviço' });
        continue;
      }
      throw lastError;
    }
    try { return parseStructuredText(text, json, jsonParser); }
    catch (error) { error.aiDiagnostics = diagnostics; throw error; }
  }

  throw lastError || new Error('Moont AI indisponível. Tente novamente.');
};

// Texto incluso = Z.ai no servidor (`ZAI_API_KEY`). Sem chave própria noutro
// provedor, usa sempre Z.ai — não cai em Anthropic (mais caro).
const callAI = (userMsg, { json = false, jsonParser = null, maxTokens = 4096, openaiKey = null, contentMode, presentationPath, contentLanguage = '', systemPrompt: explicitSystemPrompt = '', temperature, onRetry, thinking, onResponseMetadata, signal: parentSignal } = {}) => runAIJob(async (signal) => {
  assertPaidFeature('text');
  const baseSystemPrompt = contentMode === 'pitch'
    ? PITCH_SYSTEM_PT
    : contentMode === 'presentation'
      ? buildPresentationSystemPrompt(presentationPath)
      : AI_SYSTEM_CORE;
  // Only a caller that resolved the raw user material may fix the language.
  // Inferring it from the expanded technical prompt biases short briefs to PT.
  const languageSystemRule = CONTENT_LANGUAGE_SYSTEM_RULES[contentLanguage] || '';
  const systemPrompt = String(explicitSystemPrompt || '').trim()
    || `${baseSystemPrompt} ${CONTENT_LANGUAGE_POLICY}${languageSystemRule ? `\n${languageSystemRule}` : ''}`;
  let provider = _aiRuntimeSettings.textProvider;
  if (provider === 'openai' && !(getProviderKey('openai') || openaiKey)) provider = 'zai';
  if (provider === 'anthropic' && !getProviderKey('anthropic')) provider = 'zai';
  if (provider === 'kimi' && !getProviderKey('kimi')) provider = 'zai';

  if (provider === 'anthropic') return callAnthropic(userMsg, { json, jsonParser, maxTokens, signal, systemPrompt, thinking });
  if (provider === 'openai') {
    return callOpenAIChat(userMsg, { json, jsonParser, maxTokens, signal, systemPrompt, thinking, key: getProviderKey('openai') || openaiKey });
  }
  if (provider === 'zai' || provider === 'kimi') {
    return callCompatibleChat(provider, userMsg, { json, jsonParser, maxTokens, signal, systemPrompt, temperature, onRetry, thinking, onResponseMetadata });
  }
  throw new Error('Modelo de texto inválido. Abra Configurar IA e escolha uma opção.');
}, parentSignal);

// Pesquisa com web_search é EXCLUSIVA do Claude/Anthropic (BYOK). Sem chave Anthropic,
// a UI deve cair em callAI (Z.ai) sem web ao vivo.
const callAIwithSearch = (userMsg, { json = false, maxTokens = 4096, signal: parentSignal } = {}) => runAIJob(async (signal) => {
  assertPaidFeature('text');
  if (!getProviderKey('anthropic')) {
    throw new Error('Pesquisa web ao vivo precisa de chave Anthropic (opcional).');
  }
  return callAnthropic(userMsg, {
    json, maxTokens, signal,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });
}, parentSignal);

// ─── GPT IMAGE 2 (OpenAI) ─────────────────────────────────────────────────────
// Direção de arte padrão do Moont (catálogo final de 22/11/2026, I02). O texto
// vive em shared/image-prompt.js porque a montagem e o orçamento são comuns ao
// navegador e ao servidor. Só entra sem direção estética explícita e sem
// moodboard de estilo; painel, referência de produto e âncora não a desligam.
const GPT_IMAGE_ART_DIRECTION = IMAGE_PROMPT_TEXT.defaultArtDirection;

function dataUrlToBlob(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Formato de imagem inválido.');
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const mime = (m[1] || 'image/png').split(';')[0].trim();
  return new Blob([arr], { type: mime || 'image/png' });
}

async function blobFromSlideRef(refImage, signal) {
  if (!refImage || typeof refImage !== 'string') throw new Error('Referência ausente.');
  if (refImage.startsWith('data:')) return dataUrlToBlob(refImage);
  const res = await fetch(refImage, { signal });
  if (!res.ok) throw new Error('Não foi possível carregar a URL da imagem de referência.');
  return res.blob();
}

/** Prompt completo para GPT Image (geração ou edição com referência). */
function normalizeImageAspectRatio(value) {
  return ['1:1', '16:9', '9:16', '3:2', '2:3', '4:5', 'auto'].includes(value)
    ? value
    : '4:5';
}

/**
 * O endpoint SJinn trabalha com uma lista fechada de proporções e não aceita
 * 4:5. Mantemos 2:3 como aproximação vertical histórica; 16:9 passa sem
 * conversão para que apresentações sejam realmente geradas em landscape.
 */
function resolveSjinnAspectRatio(aspectRatio = '4:5') {
  const ratio = normalizeImageAspectRatio(aspectRatio);
  return ratio === '4:5' ? '2:3' : ratio;
}

/**
 * Entradas do pedido para `shared/image-prompt.js`.
 * `direction` é o objeto de `composeImageDirection` (src/utils/image-direction.js).
 * Chamada antiga: uma string vale como estilo escrito, e anexos sem papel
 * declarado valem como moodboard de estilo.
 * O texto dos eixos (I04–I11) é consumido como `buildImgParamsTagsEN` devolver.
 */
function imagePromptParts(q, imgParams, direction, { aspectRatio = '4:5', withReference = false, referenceCount } = {}) {
  const estruturada = direction && typeof direction === 'object';
  const d = estruturada ? direction : { styleBody: String(direction || '').trim().slice(0, 3000) };
  const anexos = Number.isFinite(referenceCount)
    ? Math.max(0, referenceCount)
    : Math.max(0, Number(d.referenceCount) || 0, withReference ? 1 : 0);
  return {
    scene: q,
    axisTags: buildImgParamsTagsEN(imgParams),
    format: d.format || (normalizeImageAspectRatio(aspectRatio) === '16:9' ? 'presentation' : 'carousel'),
    framing: typeof d.framing === 'string' ? d.framing : `FRAMING: ${imageFramingDirection({}, 'carrossel')}`,
    referenceCount: anexos,
    styleMoodboard: anexos > 0 && (typeof d.styleMoodboard === 'boolean' ? d.styleMoodboard : true),
    referenceMap: d.referenceMap || '',
    identityAnchor: d.identityAnchor || '',
    presentationPanel: d.presentationPanel === true,
    slideAction: d.slideAction || '',
    subjects: d.subjects || '',
    styleBody: d.styleBody || '',
    familyEnglish: d.familyEnglish || '',
    avoid: d.avoid || '',
    styleReferenceLook: d.styleReferenceLook === true,
    otherScenes: Array.isArray(d.otherScenes) ? d.otherScenes : [],
    // Direção de arte (26/11): direção visual do deck, espaço do texto e cena como briefing.
    composition: d.composition || '',
    visualDirection: d.visualDirection || '',
    sceneBrief: d.sceneBrief && typeof d.sceneBrief === 'object' ? d.sceneBrief : null,
  };
}

/**
 * Pedido de imagem para a rota e o modelo efetivos: `{ status: 'ready', prompt,
 * chars, dropped, trimmed, defaultAesthetic }` ou `{ status: 'blocked', code:
 * 'reference_unsupported' }` quando a rota não aceita os anexos exigidos.
 * Rotas: 'sjinn' (plano), 'openai', 'zai'. O orçamento vem do modelo; chame de
 * novo a cada fallback.
 */
function planImagePrompt(q, imgParams, direction, { route = 'openai', model = '', limit = 0, ...shape } = {}) {
  return planImageRequest(imagePromptParts(q, imgParams, direction, shape), { route, model, limit });
}

/** Prompt completo para o gerador (geração ou edição com referência). */
function buildGptImageFullPrompt(q, imgParams, direction, options = {}) {
  return planImagePrompt(q, imgParams, direction, { ...options, limit: options.limit || options.maxChars || 0 }).prompt;
}

/** Rota sem anexos com referência exigida: erro antes de qualquer chamada. */
function referenceIncompatibleError(plan) {
  return Object.assign(new Error(plan.message), { code: plan.code, label: plan.label });
}

function resolveZaiImageSize(model, aspectRatio = '4:5') {
  const ratio = normalizeImageAspectRatio(aspectRatio);
  if (ratio === '16:9') return model === 'glm-image' ? '1728x960' : '1344x768';
  if (ratio === '9:16') return model === 'glm-image' ? '960x1728' : '768x1344';
  if (ratio === '3:2') return model === 'glm-image' ? '1568x1056' : '1152x864';
  if (ratio === '1:1') return model === 'glm-image' ? '1280x1280' : '1024x1024';
  return model === 'glm-image' ? '1088x1472' : '864x1152';
}

async function generateZaiImage(q, imgParams, imgExtraPrompt, signal, options = {}) {
  assertPaidFeature('image');
  const apiKey = getProviderKey('zai');
  if (!apiKey) throw new Error('Falta a chave do provedor de imagem. Adicione-a em Configurar IA.');
  const model = _aiRuntimeSettings.imageModels?.zai || 'cogview-4-250304';
  const aspectRatio = normalizeImageAspectRatio(options.aspectRatio);
  // A rota não aceita anexos: com referência exigida, devolve incompatibilidade
  // em vez de gerar sem ela.
  const anexos = options.refImages || (options.refImage ? [options.refImage] : []);
  const plan = planImagePrompt(q, imgParams, options.imageDirection ?? imgExtraPrompt, {
    route: 'zai', model, aspectRatio, referenceCount: anexos.length,
  });
  if (plan.status !== 'ready') throw referenceIncompatibleError(plan);
  const payload = {
    model,
    prompt: plan.prompt,
    size: resolveZaiImageSize(model, aspectRatio),
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
      signal,
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw enhanceNetworkError(error, 'Provedor de imagem');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || data.code) {
    throw new Error(data?.error?.message || data?.message || `Provedor de imagem HTTP ${res.status}`);
  }
  const image = data.data?.[0];
  if (image?.b64_json) {
    return `data:${image.mime || 'image/png'};base64,${image.b64_json}`;
  }
  if (image?.url) return image.url;
  throw new Error('O provedor não retornou a imagem.');
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

function resolveOpenAIImageSize(model, aspectRatio = '4:5') {
  const ratio = normalizeImageAspectRatio(aspectRatio);
  if (ratio === '1:1') return '1024x1024';
  if (ratio === '16:9') {
    if (/^gpt-image-2(?:\.|-|$)/.test(model.name)) return '1536x864';
    return model.name === 'dall-e-3' ? '1792x1024' : '1536x1024';
  }
  if (ratio === '3:2') {
    return model.name === 'dall-e-3' ? '1792x1024' : '1536x1024';
  }
  if (ratio === '9:16') {
    if (/^gpt-image-2(?:\.|-|$)/.test(model.name)) return '864x1536';
    return model.size;
  }
  if (ratio === '2:3') {
    if (/^gpt-image-2(?:\.|-|$)/.test(model.name)) return '1024x1536';
    return model.size;
  }
  return model.size;
}

let _cachedModel = null; // memoiza o primeiro modelo que funcionou nesta sessão
function getOpenAIImageOrder() {
  const selectedName = _aiRuntimeSettings.imageModels?.openai || 'gpt-image-2';
  const selected = OPENAI_IMAGE_MODELS.find((model) => model.name === selectedName);
  const candidates = [selected, _cachedModel, ...OPENAI_IMAGE_MODELS].filter(Boolean);
  return candidates.filter(
    (model, index, all) => all.findIndex((item) => item.name === model.name) === index,
  );
}

/**
 * Geração com uma ou mais imagens de referência (API edits — multipart).
 * `prompt` pode ser uma função `(nomeDoModelo) => texto`: o orçamento é
 * recalculado a cada fallback. Modelos sem anexos (DALL·E 3) ficam de fora.
 */
async function generateDALLEEdits(refBlob, prompt, apiKey, signal, options = {}) {
  assertPaidFeature('image');
  const referenceBlobs = Array.isArray(refBlob) ? refBlob : [refBlob];
  if (!IS_LOCAL_DEV && !apiKey) throw new Error('Chave OpenAI ausente.');
  const headers = {};
  if (IS_LOCAL_DEV) {
    if (apiKey) headers['x-openai-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const order = getOpenAIImageOrder().filter(model => imageRouteCapabilities('openai', model.name).maxReferences > 0);

  let lastErr = null;
  for (const model of order) {
    throwIfGenerationCancelled(signal);
    const fd = new FormData();
    fd.append('model', model.name);
    fd.append('prompt', typeof prompt === 'function'
      ? prompt(model.name)
      : String(prompt).slice(0, imageRouteCapabilities('openai', model.name).promptLimit));
    fd.append('n', '1');
    fd.append('size', resolveOpenAIImageSize(model, options.aspectRatio));
    fd.append('quality', model.quality);
    if (model.style) fd.append('style', model.style);
    if (model.responseFormat) fd.append('response_format', 'b64_json');
    referenceBlobs.slice(0, 4).forEach((blob, index) => {
      const ext = /jpe?g/.test(blob.type) ? 'jpg' : 'png';
      fd.append('image[]', blob, `reference-${index + 1}.${ext}`);
    });

    try {
      let res;
      try {
        res = await fetch(OPENAI_IMAGE_EDITS_URL, { method: 'POST', headers, body: fd, signal });
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
  const { imgExtraPrompt, signal } = options || {};
  const operationId = typeof options.operationId === 'string'
    && /^[A-Za-z0-9._:-]{1,160}$/.test(options.operationId)
    ? options.operationId
    : (globalThis.crypto?.randomUUID?.()
      || `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`);
  const requestedAspectRatio = normalizeImageAspectRatio(options.aspectRatio);
  const aspectRatio = resolveSjinnAspectRatio(requestedAspectRatio);
  const refs = await prepareImageReferencesForUpload(options.refImages || (options.refImage ? [options.refImage] : []));
  throwIfGenerationCancelled(signal);
  // Orçamento da rota do plano: 4.000 no pedido completo. O servidor valida o
  // mesmo comprimento, então o texto sai daqui inteiro e dentro do limite.
  const plan = planImagePrompt(q, imgParams, options.imageDirection ?? imgExtraPrompt, {
    route: 'sjinn',
    aspectRatio: requestedAspectRatio,
    referenceCount: refs.length,
  });
  // IA-02: quem chamou vê o que saiu ou encolheu antes de o crédito ser
  // reservado. `false` desiste do envio; a retentativa não insiste.
  if (typeof options.onPromptPlan === 'function') {
    const proceed = await options.onPromptPlan({
      route: 'sjinn', chars: plan.chars, limit: plan.limit, dropped: plan.dropped, trimmed: plan.trimmed,
    });
    throwIfGenerationCancelled(signal);
    if (proceed === false) {
      throw Object.assign(new Error('Imagem não gerada. Nenhum crédito foi usado.'), { code: 'image_prompt_declined', platformImage: true });
    }
  }
  let res;
  try {
    res = await fetch('/api/ai/sjinn-image', {
      signal,
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        prompt: plan.prompt,
        aspectRatio,
        resolution: '1K',
        imageList: refs,
        ...(options.usageContext ? { usageContext: options.usageContext } : {}),
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
 * GPT Image a partir de texto. Opcional: `options.refImages` (data URL ou https) e
 * `options.imageDirection` (objeto de `composeImageDirection`; `imgExtraPrompt` em texto ainda é aceito como estilo escrito).
 * Com referência, usa POST /v1/images/edits; sem referência, /v1/images/generations.
 * Default: imagens inclusas no plano. BYOK só com useOwnImageKey.
 */
const generateDALLE = (q, apiKey, imgParams = null, options = {}) => runAIJob(async (signal) => {
  assertPaidFeature('image');
  options = { ...options, signal };
  const { refImage, imgExtraPrompt } = options || {};
  const refs = options.refImages || (refImage ? [refImage] : []);

  if (!_aiRuntimeSettings.useOwnImageKey) {
    return generatePlatformSjinnImage(q, imgParams, options);
  }

  const direction = options.imageDirection ?? imgExtraPrompt;
  if (_aiRuntimeSettings.imageProvider === 'zai') {
    // Bloqueia antes da chamada quando há referência exigida (rota sem anexos).
    return generateZaiImage(q, imgParams, direction, signal, { ...options, refImages: refs });
  }
  apiKey = getProviderKey('openai') || apiKey;
  if (!IS_LOCAL_DEV && !apiKey) throw new Error('Chave OpenAI ausente.');

  if (refs.length) {
    const blobs = await Promise.all(refs.slice(0, 4).map(ref => blobFromSlideRef(ref, signal)));
    // Orçamento e capacidades do modelo efetivo, recalculados a cada fallback.
    const promptRef = (modelName) => planImagePrompt(q, imgParams, direction, {
      route: 'openai', model: modelName, aspectRatio: options.aspectRatio, referenceCount: blobs.length,
    }).prompt;
    throwIfGenerationCancelled(signal);
    return generateDALLEEdits(blobs, promptRef, apiKey, signal, options);
  }

  const headers = { 'Content-Type': 'application/json' };
  if (IS_LOCAL_DEV) {
    if (apiKey) headers['x-openai-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const order = getOpenAIImageOrder();

  let lastErr = null;
  for (const model of order) {
    throwIfGenerationCancelled(signal);
    const body = {
      model: model.name,
      // DALL·E 3 tem 4.000 caracteres e zero anexos: o pedido é remontado para
      // o modelo da vez; blocos opcionais saem inteiros, nada é fatiado.
      prompt: planImagePrompt(q, imgParams, direction, {
        route: 'openai', model: model.name, aspectRatio: options.aspectRatio, referenceCount: 0,
      }).prompt,
      n: 1,
      size: resolveOpenAIImageSize(model, options.aspectRatio),
      quality: model.quality,
    };
    if (model.style) body.style = model.style;
    if (model.responseFormat) body.response_format = 'b64_json';

    try {
      let res;
      try {
        res = await fetch(OPENAI_IMAGE_URL, { method: 'POST', headers, body: JSON.stringify(body), signal });
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
}, options.signal);

/** Wrapper que tenta `generateDALLE` até N+1 vezes com backoff curto. Útil para rate-limits transitórios.
 *  Erros 4xx persistentes (auth, conteúdo, modelo indisponível) NÃO retentam — só rede / 5xx / 429. */
const generateDALLEWithRetry = (q, apiKey, imgParams = null, options = {}, { retries = 1, backoffMs = 1200 } = {}) => runAIJob(async (signal) => {
  assertPaidFeature('image');
  // A operação identifica o pedido do usuário, não cada tentativa de rede.
  // Reutilizá-la permite que o servidor reconheça uma resposta perdida sem
  // reservar um segundo crédito na retentativa.
  const operationId = typeof options.operationId === 'string'
    && /^[A-Za-z0-9._:-]{1,160}$/.test(options.operationId)
    ? options.operationId
    : (globalThis.crypto?.randomUUID?.()
      || `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`);
  const retryOptions = { ...options, operationId };
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    throwIfGenerationCancelled(signal);
    try {
      return await generateDALLE(q, apiKey, imgParams, { ...retryOptions, signal });
    } catch (e) {
      if (isGenerationCancelled(e)) throw e;
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
      await abortableDelay(backoffMs * (attempt + 1), signal);
    }
  }
  throw lastErr;
}, options.signal);

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
  buildContentSystemPrompt,
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
  normalizeImageAspectRatio,
  resolveSjinnAspectRatio,
  buildGptImageFullPrompt,
  planImagePrompt,
  resolveZaiImageSize,
  resolveOpenAIImageSize,
  generateZaiImage,
  OPENAI_IMAGE_MODELS,
  getOpenAIImageOrder,
  generateDALLEEdits,
  generateDALLE,
  generateDALLEWithRetry,
};
