/**
 * Coordena a proteção de vídeos entre abas antes do garbage collector.
 *
 * Cada aba registra os IDs que continuam alcançáveis pelo editor/Desfazer. O
 * coletor envia uma sonda e só decide depois de ouvir as abas vivas. A carência
 * aplicada pelo video-store continua sendo a proteção para abas suspensas que
 * não responderem a tempo.
 */

export const VIDEO_GC_CHANNEL = 'vc-video-gc-protection-v1';
export const VIDEO_GC_PROBE_WAIT_MS = 120;

function newToken(prefix = 'video-tab') {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`;
  } catch { /* fallback determinístico o bastante para uma aba */ }
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function appendIds(target, values) {
  for (const value of values || []) {
    const id = String(value || '').trim();
    if (id) target.add(id);
  }
  return target;
}

/** Factory exportada para testar duas abas sem depender do browser real. */
export function createVideoTabCoordinator({
  BroadcastChannelCtor = null,
  channelName = VIDEO_GC_CHANNEL,
  tabId = newToken(),
  defaultWaitMs = VIDEO_GC_PROBE_WAIT_MS,
} = {}) {
  const providers = new Set();
  const pending = new Map();
  let channel = null;
  let closed = false;

  try {
    channel = typeof BroadcastChannelCtor === 'function'
      ? new BroadcastChannelCtor(channelName) : null;
  } catch { channel = null; }

  const localProtectedIds = () => {
    const ids = new Set();
    for (const provider of providers) {
      try { appendIds(ids, provider()); } catch { /* uma extensão não bloqueia as demais */ }
    }
    return ids;
  };

  if (channel) {
    channel.onmessage = ({ data } = {}) => {
      if (!data || data.sender === tabId) return;
      if (data.type === 'video-gc-probe' && data.requestId) {
        try {
          channel.postMessage({
            type: 'video-gc-protected',
            requestId: data.requestId,
            sender: tabId,
            ids: [...localProtectedIds()],
          });
        } catch { /* a carência ainda impede exclusão imediata */ }
        return;
      }
      if (data.type === 'video-gc-protected' && data.requestId) {
        const request = pending.get(data.requestId);
        if (request) appendIds(request.ids, data.ids);
      }
    };
  }

  const register = (provider) => {
    if (typeof provider !== 'function' || closed) return () => {};
    providers.add(provider);
    return () => { providers.delete(provider); };
  };

  const collect = async (seedIds = [], { waitMs = defaultWaitMs } = {}) => {
    const ids = appendIds(localProtectedIds(), seedIds);
    if (!channel || closed) return ids;
    const requestId = newToken('video-probe');
    const timeout = Math.max(20, Number(waitMs) || defaultWaitMs);
    return new Promise((resolve) => {
      const finish = () => {
        const request = pending.get(requestId);
        if (!request) return;
        pending.delete(requestId);
        resolve(request.ids);
      };
      const timer = setTimeout(finish, timeout);
      pending.set(requestId, { ids, timer, resolve });
      try { channel.postMessage({ type: 'video-gc-probe', requestId, sender: tabId }); }
      catch {
        clearTimeout(timer);
        finish();
      }
    });
  };

  const close = () => {
    if (closed) return;
    closed = true;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      appendIds(request.ids, localProtectedIds());
      request.resolve?.(request.ids);
    }
    pending.clear();
    providers.clear();
    try { channel?.close(); } catch { /* */ }
    channel = null;
  };

  return { tabId, register, collect, close, localProtectedIds };
}

let defaultCoordinator = null;

function browserBroadcastChannel() {
  try {
    return typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function'
      ? window.BroadcastChannel : null;
  } catch { return null; }
}

function getDefaultCoordinator() {
  if (!defaultCoordinator) {
    defaultCoordinator = createVideoTabCoordinator({ BroadcastChannelCtor: browserBroadcastChannel() });
  }
  return defaultCoordinator;
}

/** Registra IDs alcançáveis pelo histórico vivo desta aba. */
export function registerVideoGcProtection(provider) {
  return getDefaultCoordinator().register(provider);
}

/** Reúne IDs locais e os informados por outras abas vivas. */
export async function collectLiveVideoProtectedIds(seedIds = [], options = {}) {
  return getDefaultCoordinator().collect(seedIds, options);
}
