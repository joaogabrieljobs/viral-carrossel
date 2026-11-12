/** Auditoria 11/11, achado 9: a pesquisa de nicho não pode disparar chamadas em
 *  paralelo com Enter repetido, e fechar o painel precisa cancelar a chamada. */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createSingleFlight, SINGLE_FLIGHT_SKIPPED } from '../../src/utils/single-flight.js';
import { isGenerationCancelled, runAIJob } from '../../src/utils/generation-control.js';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

describe('createSingleFlight', () => {
  it('três disparos seguidos geram uma chamada só', async () => {
    const flight = createSingleFlight();
    const gate = deferred();
    const work = vi.fn(async () => { await gate.promise; return 'resultado'; });
    const first = flight.run(work);
    const second = flight.run(work);
    const third = flight.run(work);
    expect(flight.busy).toBe(true);
    gate.resolve();
    expect(await first).toBe('resultado');
    expect(await second).toBe(SINGLE_FLIGHT_SKIPPED);
    expect(await third).toBe(SINGLE_FLIGHT_SKIPPED);
    expect(work).toHaveBeenCalledTimes(1);
    expect(flight.busy).toBe(false);
  });

  it('libera a trava depois de erro, para a pessoa poder tentar de novo', async () => {
    const flight = createSingleFlight();
    await expect(flight.run(async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
    expect(flight.busy).toBe(false);
    expect(await flight.run(async () => 'ok')).toBe('ok');
  });

  it('cancelar aborta o sinal da chamada em andamento e a chamada de IA para', async () => {
    const flight = createSingleFlight();
    let seenSignal = null;
    const running = flight.run((signal) => {
      seenSignal = signal;
      return runAIJob(() => new Promise(() => {}), signal);
    });
    const outcome = running.then(() => 'terminou', (error) => error);
    flight.cancel();
    expect(seenSignal.aborted).toBe(true);
    expect(isGenerationCancelled(await outcome)).toBe(true);
    expect(flight.busy).toBe(false);
  });

  it('chamada cancelada que termina tarde não solta a trava da chamada nova', async () => {
    const flight = createSingleFlight();
    const oldGate = deferred();
    const newGate = deferred();
    const old = flight.run(async () => { await oldGate.promise; return 'velha'; });
    flight.cancel();
    const fresh = flight.run(async () => { await newGate.promise; return 'nova'; });
    oldGate.resolve();
    await old;
    expect(flight.busy).toBe(true);
    expect(await flight.run(async () => 'intrusa')).toBe(SINGLE_FLIGHT_SKIPPED);
    newGate.resolve();
    expect(await fresh).toBe('nova');
    expect(flight.busy).toBe(false);
  });

  it('cancelar sem nada em andamento não quebra', () => {
    const flight = createSingleFlight();
    expect(() => flight.cancel()).not.toThrow();
    expect(flight.busy).toBe(false);
  });
});

describe('ResearchPanel usa a trava e o cancelamento', () => {
  const panel = source('src/components/panels/ResearchPanel.jsx');

  it('toda pesquisa passa pela trava de envio em andamento', () => {
    expect(panel).toContain("import { createSingleFlight } from '../../utils/single-flight.js'");
    expect(panel).toContain('flight.run(async (signal) => {');
  });

  it('as duas chamadas de IA recebem o sinal de cancelamento', () => {
    expect(panel).toContain('callAIwithSearch(researchPrompt(true), { json: true, signal })');
    expect(panel).toContain('{ json: true, openaiKey, signal }');
  });

  it('fechar o painel (ou desmontar) cancela a pesquisa', () => {
    expect(panel).toMatch(/if \(open\) return undefined;\s+flight\.cancel\(\);/);
    expect(panel).toContain('useEffect(() => () => flight.cancel(), [flight])');
  });

  it('o campo tem limite de tamanho', () => {
    expect(panel).toContain('maxLength={RESEARCH_NICHE_MAX_LENGTH}');
  });
});
