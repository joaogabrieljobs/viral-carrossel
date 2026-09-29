// Registro único para o comando global de cancelamento, inclusive entre etapas.
const jobs = new Set();
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());
export const subscribeAIGeneration = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getAIGenerationCount = () => jobs.size;
export const isGenerationCancelled = error => error?.code === 'generation_cancelled' || error?.name === 'AbortError';

function cancelledError() {
  return Object.assign(new Error('Geração cancelada.'), { name: 'AbortError', code: 'generation_cancelled' });
}

export function throwIfGenerationCancelled(signal) {
  if (signal?.aborted) throw signal.reason || cancelledError();
}

export function startAIJob(parentSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort(cancelledError());
  const finish = () => {
    parentSignal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', finish);
    if (jobs.delete(job)) notify();
  };
  const job = { signal: controller.signal, cancel, finish };
  jobs.add(job);
  controller.signal.addEventListener('abort', finish, { once: true });
  parentSignal?.addEventListener('abort', cancel, { once: true });
  if (parentSignal?.aborted) cancel();
  notify();
  return job;
}

export function cancelAllAIGeneration() {
  for (const job of [...jobs]) job.cancel();
}

// A corrida também descarta respostas tardias de provedores que ignoram abort.
export async function runAIJob(work, parentSignal) {
  const job = startAIJob(parentSignal);
  let rejectOnAbort;
  try {
    throwIfGenerationCancelled(job.signal);
    return await Promise.race([
      Promise.resolve().then(() => { throwIfGenerationCancelled(job.signal); return work(job.signal); }),
      new Promise((_, reject) => {
        rejectOnAbort = () => reject(job.signal.reason || cancelledError());
        job.signal.addEventListener('abort', rejectOnAbort, { once: true });
      }),
    ]);
  } finally {
    if (rejectOnAbort) job.signal.removeEventListener('abort', rejectOnAbort);
    job.finish();
  }
}

export function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    throwIfGenerationCancelled(signal);
    const done = () => { signal?.removeEventListener('abort', cancel); resolve(); };
    const timer = setTimeout(done, ms);
    const cancel = () => { clearTimeout(timer); reject(signal.reason || cancelledError()); };
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
