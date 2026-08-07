// Task 02 — RF-03: extractJSON (parser tolerante de respostas LLM).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractJSON } from '../../src/utils/parsers.js';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('extractJSON', () => {
  it('faz parse direto de JSON limpo', () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('remove fences markdown ```json', () => {
    expect(extractJSON('```json\n{"slides":[{"title":"Oi"}]}\n```')).toEqual({
      slides: [{ title: 'Oi' }],
    });
  });

  it('recorta o objeto quando a IA adiciona texto antes/depois', () => {
    const raw = 'Claro! Aqui está:\n{"caption":"legenda"}\nEspero que ajude.';
    expect(extractJSON(raw)).toEqual({ caption: 'legenda' });
  });

  it('respeita chaves dentro de strings ao recortar', () => {
    const raw = 'prefixo {"title":"use { e } no texto","n":2} sufixo';
    expect(extractJSON(raw)).toEqual({ title: 'use { e } no texto', n: 2 });
  });

  it('resposta vazia lança erro amigável', () => {
    expect(() => extractJSON('')).toThrow('IA retornou resposta vazia. Tente novamente.');
  });

  it('resposta sem JSON válido lança erro amigável', () => {
    expect(() => extractJSON('não tem json aqui')).toThrow(
      'Formato de resposta inválido. Tente novamente.',
    );
  });
});
