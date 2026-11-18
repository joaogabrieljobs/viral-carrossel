import { describe, it, expect } from 'vitest';
import { quoteCandidates, quoteCandidatesBlock, summarizePlanIssues } from '../../src/utils/presentation-plan-repair.js';

// Material numérico do Estudo de caso da R2 — o tipo que falhou no planejamento.
const texto = 'A Papelaria Ponto Azul recebe pedidos para retirada no balcão. A mediana do tempo entre o cliente informar o código e receber o pacote foi de quatro minutos antes e 2,5 minutos depois; são valores de mediana, não média. Houve seis retiradas com busca superior a oito minutos antes e duas depois. No período anterior havia 20 pedidos com itens personalizados; no posterior, oito.';
const sources = [{ id: 'material', text: texto, chunks: [{ text: texto }] }, { id: 'outra', text: 'Texto sem relação com o caso, sobre horários de funcionamento da loja.' }];

describe('recuperação do roteiro — trechos reais para citações reprovadas', () => {
  it('encontra o trecho da fonte mais próximo de uma citação parafraseada', () => {
    const candidatos = quoteCandidates('A mediana do tempo foi de 4 minutos antes e 2,5 minutos depois', sources, { sourceId: 'material' });
    expect(candidatos.length).toBeGreaterThan(0);
    expect(candidatos[0].quote).toContain('2,5 minutos depois');
  });

  it('todo candidato existe literalmente na fonte e respeita o limite de citação', () => {
    for (const consulta of ['seis retiradas com busca superior a oito minutos', '20 pedidos personalizados antes e oito depois', 'mediana de quatro minutos']) {
      for (const c of quoteCandidates(consulta, sources)) {
        expect(texto.includes(c.quote)).toBe(true);
        expect(c.quote.length).toBeLessThanOrEqual(160);
      }
    }
  });

  it('prefere a fonte citada e não devolve nada sem semelhança', () => {
    expect(quoteCandidates('aumento de vendas de 40% no trimestre', sources, { sourceId: 'material' })).toEqual([]);
    expect(quoteCandidates('', sources)).toEqual([]);
    const daOutra = quoteCandidates('horários de funcionamento da loja', sources, { sourceId: 'outra' });
    expect(daOutra[0].sourceId).toBe('outra');
  });

  it('monta o bloco só para citações reprovadas e avisa que é sugestão', () => {
    const previous = { evidence: [
      { id: 'e1', sourceId: 'material', quote: 'mediana caiu de 4 para 2,5 minutos', claim: 'x' },
      { id: 'e2', sourceId: 'material', quote: 'retorno financeiro de 30% em vendas', claim: 'y' },
    ] };
    const issues = [{ code: 'quote_not_found', path: 'evidence[0].quote' }, { code: 'quote_not_found', path: 'evidence[1].quote' }, { code: 'slide_count', path: 'slides' }];
    const bloco = quoteCandidatesBlock(previous, issues, sources);
    expect(bloco).toMatch(/são sugestões de onde a informação está, não confirmação/);
    expect(bloco).toContain('evidence[0]: escolha UM destes trechos');
    expect(bloco).toContain('2,5 minutos depois');
    expect(bloco).toContain('evidence[1]: nenhum trecho próximo encontrado');
    expect(bloco).toMatch(/não a reescreva de memória/);
  });

  it('sem citação reprovada não acrescenta nada', () => {
    expect(quoteCandidatesBlock({ evidence: [] }, [{ code: 'slide_count', path: 'slides' }], sources)).toBe('');
    expect(quoteCandidatesBlock(undefined, [{ code: 'quote_not_found', path: 'evidence[0].quote' }], sources)).toBe('');
  });
});

describe('motivo da falha do roteiro — legível e sem conteúdo', () => {
  it('conta e descreve os códigos', () => {
    const r = summarizePlanIssues([{ code: 'quote_not_found', path: 'evidence[0].quote' }, { code: 'quote_not_found', path: 'evidence[2].quote' }, { code: 'closing_required', path: 'slides[4].visualRole' }]);
    expect(r.codes).toEqual({ quote_not_found: 2, closing_required: 1 });
    expect(r.motivo).toBe('2 citações do roteiro não foram localizadas literalmente no material; o roteiro não marcou a abertura ou o fecho');
  });

  it('singular, resposta incompleta e código desconhecido', () => {
    expect(summarizePlanIssues([{ code: 'quote_not_found', path: 'evidence[0].quote' }]).motivo).toBe('uma citação do roteiro não foi localizada literalmente no material');
    expect(summarizePlanIssues([{ code: 'invalid_json', path: '$' }]).motivo).toBe('a resposta do roteiro veio incompleta');
    expect(summarizePlanIssues([{ code: 'unknown_field', path: '$' }]).motivo).toBe('o roteiro saiu fora do formato esperado');
    expect(summarizePlanIssues([])).toEqual({ codes: {}, motivo: '' });
  });
});
