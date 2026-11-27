/**
 * Mensagem de erro de entrada, cadastro e recuperação sempre em português (27/11/2026).
 *
 * O servidor da Moont responde em português; o que escapava em inglês vinha do
 * navegador ("Failed to fetch", "Load failed", "NetworkError…") ou de resposta
 * de plataforma fora do nosso código. Só o texto marcado como vindo da nossa API
 * (`fromServer`) chega à tela, e mesmo esse cai no padrão se parecer inglês.
 */
export const MSG_SEM_CONEXAO = 'Não foi possível falar com a Moont. Confira sua conexão e tente novamente.';

const INGLES = /\b(the|is|are|not|allowed|failed|failure|please|password|user|already|invalid|error|method|network|request|unauthorized|forbidden|timeout|internal|server)\b/i;

export function pareceIngles(texto) {
  return INGLES.test(String(texto || ''));
}

/** Marca o erro como resposta da nossa API, para a tela poder mostrar o texto. */
export function erroDoServidor(mensagem, extra = {}) {
  return Object.assign(new Error(mensagem), { fromServer: true }, extra);
}

export function mensagemErroAuth(erro, padrao) {
  const texto = String(erro?.message || '').trim();
  if (erro?.fromServer) return texto && !pareceIngles(texto) ? texto : padrao;
  // TypeError é como fetch reporta falta de rede em todos os navegadores.
  if (erro?.name === 'TypeError' || /fetch|network|load failed/i.test(texto)) return MSG_SEM_CONEXAO;
  return padrao;
}
