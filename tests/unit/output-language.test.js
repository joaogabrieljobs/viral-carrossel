import { describe, it, expect } from 'vitest';
import {
  explicitOutputLanguage, detectTextLanguage, resolveOutputLanguage, buildOutputLanguageBlock,
  buildOutputLanguageSystemInstruction,
} from '../../src/utils/output-language.js';

const BRIEF_EN = 'Black Frog builds websites for local businesses in San Diego. Case: a Brazilian massage therapist with 22 years of practice, 5.0 on Yelp and Google, whose old site was a template with a wrong phone number and no prices.';
const BRIEF_PT = 'Um massoterapeuta com 22 anos de prática tinha um site que sabotava o próprio trabalho, com trechos em espanhol e telefone errado para o cliente.';

describe('idioma de saída', () => {
  it('respeita pedido explícito nas instruções', () => {
    expect(explicitOutputLanguage('Write everything in English')).toBe('en');
    expect(explicitOutputLanguage('escreva tudo em inglês')).toBe('en');
    expect(explicitOutputLanguage('Escreva em espanhol.')).toBe('es');
    expect(explicitOutputLanguage('aula de inglês para crianças')).toBe(null);
    expect(explicitOutputLanguage('inclua tudo sobre o curso de inglês')).toBe(null);
    expect(explicitOutputLanguage('Texto final em inglês, por favor')).toBe('en');
    expect(explicitOutputLanguage('Language: English. All titles and texts in English.')).toBe('en');
    expect(explicitOutputLanguage('Output language = Spanish')).toBe('es');
  });
  it('segue a língua do brief quando não há pedido', () => {
    expect(detectTextLanguage(BRIEF_EN)).toBe('en');
    expect(detectTextLanguage(BRIEF_PT)).toBe('pt');
    expect(detectTextLanguage('curto demais')).toBe(null);
    expect(resolveOutputLanguage({ topic: BRIEF_EN })).toBe('en');
    expect(resolveOutputLanguage({ topic: BRIEF_EN, instructions: 'escreva em português' })).toBe('pt');
  });
  it('não muda o prompt no padrão português', () => {
    expect(buildOutputLanguageBlock({ content: BRIEF_PT })).toBe('');
    expect(buildOutputLanguageBlock({}, BRIEF_EN)).toContain('IDIOMA DE SAÍDA');
    expect(buildOutputLanguageBlock({}, BRIEF_EN)).toContain('inglês');
    expect(buildOutputLanguageSystemInstruction('en')).toContain('every reader-visible field');
    expect(buildOutputLanguageSystemInstruction('pt')).toBe('');
  });
});
