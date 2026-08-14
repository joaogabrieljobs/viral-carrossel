/**
 * Configuração de IA (BYOK): provedores, modelos e chaves.
 * Preferências (sem segredos) no localStorage; chaves **só** em sessionStorage
 * por defeito. `persistKeys` grava em localStorage (risco XSS — opt-in explícito).
 */
import { useState, useEffect } from 'react';
import { DEFAULT_AI_SETTINGS, normalizeAISettings } from '../config/ai-providers.js';
import { setAIRuntimeSettings } from '../utils/ai-client.js';
import { SK } from '../utils/storage.js';

export function useAiSettings() {
  const [aiSettings, setAISettings] = useState(() => {
    try {
      const savedConfig = JSON.parse(localStorage.getItem(SK.aiSettings) || '{}');
      const persistKeys =
        savedConfig.persistKeys === true
        || localStorage.getItem(SK.openaiKeyPersist) === '1'
        || localStorage.getItem(SK.anthropicKeyPersist) === '1';

      // Migração: keys no localStorage sem opt-in → sessão e limpa local.
      if (!persistKeys && localStorage.getItem(SK.aiKeys)) {
        try {
          const orphan = JSON.parse(localStorage.getItem(SK.aiKeys) || '{}');
          const sessionKeys = JSON.parse(sessionStorage.getItem(SK.aiKeys) || '{}');
          if (orphan && typeof orphan === 'object') {
            sessionStorage.setItem(SK.aiKeys, JSON.stringify({ ...orphan, ...sessionKeys }));
          }
          localStorage.removeItem(SK.aiKeys);
        } catch { /* ignore */ }
      }

      const sessionKeys = JSON.parse(sessionStorage.getItem(SK.aiKeys) || '{}');
      const localKeys = persistKeys
        ? JSON.parse(localStorage.getItem(SK.aiKeys) || '{}')
        : {};
      const savedKeys = { ...localKeys, ...sessionKeys };

      const legacyOpenAI =
        sessionStorage.getItem(SK.openaiKey) ||
        (persistKeys ? localStorage.getItem(SK.openaiKey) : '') ||
        '';
      const legacyAnthropic =
        sessionStorage.getItem(SK.anthropicKey) ||
        (persistKeys ? localStorage.getItem(SK.anthropicKey) : '') ||
        '';
      const legacyClaudeModel = localStorage.getItem(SK.claudeModel);

      return normalizeAISettings({
        ...savedConfig,
        persistKeys: !!persistKeys,
        keys: {
          ...savedKeys,
          openai: savedKeys.openai || legacyOpenAI,
          anthropic: savedKeys.anthropic || legacyAnthropic,
        },
        textModels: {
          ...(savedConfig.textModels || {}),
          ...(!savedConfig.textModels?.anthropic && legacyClaudeModel
            ? { anthropic: legacyClaudeModel === 'opus' ? 'claude-opus-5' : 'claude-sonnet-5' }
            : {}),
        },
      });
    } catch {
      return normalizeAISettings(DEFAULT_AI_SETTINGS);
    }
  });

  useEffect(() => {
    setAIRuntimeSettings(aiSettings);
    try {
      const { keys, ...safeSettings } = aiSettings;
      localStorage.setItem(SK.aiSettings, JSON.stringify({
        ...safeSettings,
        persistKeys: !!aiSettings.persistKeys,
      }));
      if (aiSettings.persistKeys) {
        localStorage.setItem(SK.aiKeys, JSON.stringify(keys));
        sessionStorage.setItem(SK.aiKeys, JSON.stringify(keys));
      } else {
        sessionStorage.setItem(SK.aiKeys, JSON.stringify(keys));
        localStorage.removeItem(SK.aiKeys);
      }
      localStorage.removeItem(SK.openaiKey);
      sessionStorage.removeItem(SK.openaiKey);
      localStorage.removeItem(SK.anthropicKey);
      sessionStorage.removeItem(SK.anthropicKey);
    } catch { /* storage privado/bloqueado */ }
  }, [aiSettings]);

  const openaiKey = aiSettings.keys.openai || '';
  const anthropicKey = aiSettings.keys.anthropic || '';

  return { aiSettings, setAISettings, openaiKey, anthropicKey };
}
