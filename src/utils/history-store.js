/**
 * Histórico do editor (desfazer/refazer), fora do React.
 *
 * As pilhas mudavam dentro do updater de `setState`. Como o React pode chamar
 * um updater duas vezes, havia guardas por identidade de objeto para não
 * empilhar em dobro; essas guardas nunca eram zeradas e, depois de um
 * desfazer, a edição seguinte não entrava no histórico. Aqui cada operação
 * roda uma vez, a partir do estado atual, e o React só recebe o resultado.
 */
export function createHistoryStore(initialState, { limit = 100, coalesceMs = 600, now = Date.now } = {}) {
  let state = initialState;
  let past = [];
  let future = [];
  let lastPushAt = -Infinity;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };

  return {
    getState: () => state,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Grava um passo. Gravações muito próximas (digitar) ficam no mesmo passo. */
    set(updater) {
      const prev = state;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return;
      const at = now();
      const coalesce = (at - lastPushAt) < coalesceMs;
      lastPushAt = at;
      if (!coalesce) {
        past.push(prev);
        if (past.length > limit) past.shift();
      }
      future = [];
      state = next;
      notify();
    },
    /** Troca o estado sem criar passo (carregar mídia, hidratar, normalizar). */
    setSilent(updater) {
      const next = typeof updater === 'function' ? updater(state) : updater;
      if (next === state) return;
      state = next;
      notify();
    },
    undo() {
      if (!past.length) return;
      future.push(state);
      state = past.pop();
      // Depois de voltar, a próxima edição é sempre um passo novo.
      lastPushAt = -Infinity;
      notify();
    },
    redo() {
      if (!future.length) return;
      past.push(state);
      state = future.pop();
      lastPushAt = -Infinity;
      notify();
    },
    reset(next) {
      past = [];
      future = [];
      lastPushAt = -Infinity;
      state = next;
      notify();
    },
  };
}
