/**
 * Configuração de IA (BYOK): provedores, modelos e chaves.
 * Preferências (sem segredos) no localStorage; chaves na sessão por padrão e
 * só em localStorage se o usuário autorizar (`persistKeys`).
 * Sincroniza o estado de runtime consumido por `ai-client`.
 */
import { useState, useEffect } from 'react';
import { DEFAULT_AI_SETTINGS, normalizeAISettings } from '../config/ai-providers.js';
import { setAIRuntimeSettings } from '../utils/ai-client.js';
import { SK, lsSet } from '../utils/storage.js';
import { lsGet } from '../utils/telemetry.js';

export function useAiSettings() {
  // Configuração unificada de IA. Preferências (sem segredos) ficam no localStorage;
  // chaves ficam na sessão por padrão e só persistem se o usuário autorizar.
  const [aiSettings, setAISettings] = useState(() => {
    try {
      const savedConfig = JSON.parse(localStorage.getItem(SK.aiSettings) || '{}');
      const savedKeys = JSON.parse(
        localStorage.getItem(SK.aiKeys) ||
        sessionStorage.getItem(SK.aiKeys) ||
        '{}',
      );
      // Migração transparente da janela antiga.
      const legacyOpenAI =
        localStorage.getItem(SK.openaiKey) ||
        sessionStorage.getItem(SK.openaiKey) ||
        '';
      const legacyAnthropic =
        localStorage.getItem(SK.anthropicKey) ||
        sessionStorage.getItem(SK.anthropicKey) ||
        '';
      const legacyClaudeModel = localStorage.getItem(SK.claudeModel);
      return normalizeAISettings({
        ...savedConfig,
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
        persistKeys:
          savedConfig.persistKeys ??
          (localStorage.getItem(SK.openaiKeyPersist) === '1' ||
            localStorage.getItem(SK.anthropicKeyPersist) === '1'),
      });
    } catch {
      return normalizeAISettings(DEFAULT_AI_SETTINGS);
    }
  });
  useEffect(() => {
    setAIRuntimeSettings(aiSettings);
    try {
      const { keys, ...safeSettings } = aiSettings;
      localStorage.setItem(SK.aiSettings, JSON.stringify(safeSettings));
      const target = aiSettings.persistKeys ? localStorage : sessionStorage;
      const other = aiSettings.persistKeys ? sessionStorage : localStorage;
      target.setItem(SK.aiKeys, JSON.stringify(keys));
      other.removeItem(SK.aiKeys);
      // Remove cópias legadas para não deixar segredos duplicados.
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
