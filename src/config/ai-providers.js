export const TEXT_PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    short: 'Claude',
    keyLabel: 'Chave Anthropic',
    placeholder: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-haiku-4-5', name: 'Haiku 4.5', note: 'Mais econômico', tier: 'economy' },
      { id: 'claude-sonnet-5', name: 'Sonnet 5', note: 'Melhor equilíbrio', tier: 'balanced' },
      { id: 'claude-opus-5', name: 'Opus 5', note: 'Máxima qualidade', tier: 'quality' },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    short: 'GPT',
    keyLabel: 'Chave OpenAI',
    placeholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', note: 'Mais econômico', tier: 'economy' },
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', note: 'Melhor equilíbrio', tier: 'balanced' },
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', note: 'Máxima qualidade', tier: 'quality' },
    ],
  },
  zai: {
    id: 'zai',
    // Nome de produto: o fornecedor por trás do texto incluso não aparece na UI.
    name: 'Viral AI',
    short: 'IA do Viral',
    platform: true,
    models: [
      { id: 'glm-4.7-flashx', name: 'Viral AI Rápido', note: 'Mais econômico', tier: 'economy' },
      { id: 'glm-4.7', name: 'Viral AI', note: 'Melhor equilíbrio', tier: 'balanced' },
      { id: 'glm-5.2', name: 'Viral AI Pro', note: 'Máxima qualidade', tier: 'quality' },
    ],
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    short: 'Moonshot',
    keyLabel: 'Chave Kimi',
    placeholder: 'Cole sua chave Moonshot',
    keyUrl: 'https://platform.kimi.ai/console/api-keys',
    models: [
      { id: 'kimi-k2.6', name: 'Kimi K2.6', note: 'Rápido + multimodal', tier: 'balanced' },
      { id: 'kimi-k3', name: 'Kimi K3', note: '1M de contexto', tier: 'quality' },
    ],
  },
};

export const IMAGE_PROVIDERS = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    short: 'GPT Image',
    keyProvider: 'openai',
    models: [
      { id: 'gpt-image-2', name: 'GPT Image 2', note: 'Melhor qualidade', tier: 'quality' },
      { id: 'gpt-image-1.5', name: 'GPT Image 1.5', note: 'Compatível', tier: 'balanced' },
    ],
  },
  zai: {
    id: 'zai',
    name: 'CogView',
    short: 'GLM Image',
    keyProvider: 'zai',
    // Exige chave própria do fornecedor do texto incluso — escondido da UI.
    hidden: true,
    models: [
      { id: 'cogview-4-250304', name: 'CogView-4', note: 'US$ 0,01/imagem', tier: 'economy' },
      { id: 'glm-image', name: 'GLM-Image', note: 'US$ 0,015/imagem', tier: 'balanced' },
    ],
  },
};

export const DEFAULT_AI_SETTINGS = {
  // Texto incluso no plano via Z.ai no servidor (`ZAI_API_KEY`).
  textProvider: 'zai',
  textModels: {
    anthropic: 'claude-sonnet-5',
    openai: 'gpt-5.6-terra',
    // Flash grátis sobrecarrega muito (erro 1305); 4.7 é o default estável.
    zai: 'glm-4.7',
    kimi: 'kimi-k2.6',
  },
  imageProvider: 'openai',
  imageModels: {
    openai: 'gpt-image-2',
    zai: 'cogview-4-250304',
  },
  /** false = imagens inclusas no plano. true = chave própria (Essencial / avançado). */
  useOwnImageKey: false,
  keys: {
    anthropic: '',
    openai: '',
    zai: '',
    kimi: '',
  },
  persistKeys: false,
};

/** Provedores de texto que o servidor cobre sem chave do utilizador. */
export const PLATFORM_TEXT_PROVIDERS = new Set(['zai']);

export function normalizeAISettings(value = {}) {
  const next = {
    ...DEFAULT_AI_SETTINGS,
    ...value,
    textModels: { ...DEFAULT_AI_SETTINGS.textModels, ...(value.textModels || {}) },
    imageModels: { ...DEFAULT_AI_SETTINGS.imageModels, ...(value.imageModels || {}) },
    keys: { ...DEFAULT_AI_SETTINGS.keys, ...(value.keys || {}) },
    useOwnImageKey: value.useOwnImageKey === true,
  };
  if (!TEXT_PROVIDERS[next.textProvider]) next.textProvider = DEFAULT_AI_SETTINGS.textProvider;
  if (!IMAGE_PROVIDERS[next.imageProvider]) next.imageProvider = DEFAULT_AI_SETTINGS.imageProvider;

  // Migração: quem ficou em Anthropic/OpenAI/Kimi sem chave própria volta ao Z.ai incluso.
  // Flash gratuito sobrecarrega (1305) — promove para glm-4.7.
  const textKey = String(next.keys[next.textProvider] || '').trim();
  if (!PLATFORM_TEXT_PROVIDERS.has(next.textProvider) && !textKey) {
    next.textProvider = DEFAULT_AI_SETTINGS.textProvider;
  }
  if (next.textProvider === 'zai' && next.textModels.zai === 'glm-4.7-flash') {
    next.textModels.zai = DEFAULT_AI_SETTINGS.textModels.zai;
  }
  // Provedor de imagem escondido da UI: quem o tinha volta ao OpenAI.
  if (IMAGE_PROVIDERS[next.imageProvider]?.hidden) {
    next.imageProvider = DEFAULT_AI_SETTINGS.imageProvider;
  }
  return next;
}
