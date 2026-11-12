/** Trava de envio em andamento com cancelamento.
 *
 *  `run(work)` executa `work(signal)` só se nada estiver em andamento; disparos
 *  repetidos devolvem `SINGLE_FLIGHT_SKIPPED` sem chamar `work`. `cancel()` aborta
 *  o sinal da chamada atual e libera a trava na hora. Uma chamada cancelada que
 *  termina tarde não solta a trava de uma chamada mais nova. */
export const SINGLE_FLIGHT_SKIPPED = Symbol('single-flight-skipped');

export function createSingleFlight() {
  let current = null;
  return {
    get busy() { return current !== null; },
    async run(work) {
      if (current) return SINGLE_FLIGHT_SKIPPED;
      const own = new AbortController();
      current = own;
      try {
        return await work(own.signal);
      } finally {
        if (current === own) current = null;
      }
    },
    cancel() {
      const own = current;
      current = null;
      own?.abort();
    },
  };
}
