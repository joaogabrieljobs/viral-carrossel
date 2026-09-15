/**
 * Modelos de texto que a chave da PLATAFORMA aceita servir (auditoria H4).
 * Partilhado entre api/ai/compatible.js (allowlist) e src/utils/ai-client.js (cascata).
 * BYOK (chave do utilizador no body) não passa por esta lista.
 */
export const PLATFORM_TEXT_MODELS = Object.freeze({
  zai: Object.freeze(['glm-4.7', 'glm-4.7-flashx', 'glm-4.7-flash', 'glm-5.2']),
  kimi: Object.freeze(['kimi-k2.6', 'kimi-k3']),
});

/** Cascata do cliente em overload Z.ai (1305/429 upstream). Curta de propósito: cada salto custa uma chamada. */
export const ZAI_FALLBACK_MODELS = Object.freeze(['glm-4.7', 'glm-4.7-flashx']);

/** Tecto de tokens de saída quando a chamada usa a chave da plataforma. */
export const PLATFORM_MAX_TOKENS = 8192;

/** Tecto de caracteres somados em `messages` com chave da plataforma (~30k tokens). */
export const PLATFORM_MAX_PROMPT_CHARS = 120_000;

export function isPlatformModelAllowed(provider, model) {
  const list = PLATFORM_TEXT_MODELS[provider];
  return Array.isArray(list) && list.includes(String(model || ''));
}
