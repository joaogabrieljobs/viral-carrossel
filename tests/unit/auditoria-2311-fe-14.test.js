import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as prompts from '../../src/utils/generation-prompts.js';

// Auditoria 23/11 (FE-14): os campos do pedido rápido não têm limite nem
// contador, e handleGenerate cortava o pedido em 1.500 caracteres sem avisar.
// Metade de um briefing colado era ignorada no prompt e na fonte de fatos.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const LIMIT = prompts.GENERATION_TOPIC_MAX_CHARS;

describe('auditoria 23/11 FE-14: pedido rápido acima do limite não segue cortado', () => {
  it('pedido de 1.600 caracteres gera uma mensagem visível com os números', () => {
    const message = prompts.generationTopicOverageMessage('a'.repeat(1600));
    expect(message).toContain('1.600');
    expect(message).toContain('1.500');
    expect(message).toContain('Nada foi cortado');
    expect(message).toMatch(/reduza 100 caracteres/);
  });

  it('pedido dentro do limite passa sem mensagem', () => {
    expect(prompts.generationTopicOverageMessage('a'.repeat(LIMIT))).toBe('');
    expect(prompts.generationTopicOverageMessage('')).toBe('');
    expect(prompts.generationTopicOverageMessage(null)).toBe('');
  });

  it('roteiro por card reconhecido segue inteiro por outro bloco e não é recusado', () => {
    expect(prompts.generationTopicOverageMessage('a'.repeat(4000), { hasCardScript: true })).toBe('');
  });

  it('handleGenerate recusa antes do corte e antes de chamar a IA', () => {
    const start = app.indexOf('const handleGenerate = async ({');
    expect(start).toBeGreaterThanOrEqual(0);
    const guard = app.indexOf('generationTopicOverageMessage(rawTopic, { hasCardScript: !!topicCardScript })', start);
    const cut = app.indexOf('topic = rawTopic.slice(0, GENERATION_TOPIC_MAX_CHARS);', start);
    const job = app.indexOf('generationRef.current = job;', start);
    expect(guard).toBeGreaterThan(start);
    expect(guard).toBeLessThan(cut);
    expect(cut).toBeLessThan(job);
    expect(app.slice(guard, cut)).toContain('throw new Error(');
  });

  it('roteiro recusado na confirmação também não segue cortado', () => {
    const declined = app.indexOf('if (!confirmed) {');
    const job = app.indexOf('generationRef.current = job;', declined);
    expect(declined).toBeGreaterThanOrEqual(0);
    expect(app.slice(declined, job)).toContain('generationTopicOverageMessage(rawTopic)');
  });
});
