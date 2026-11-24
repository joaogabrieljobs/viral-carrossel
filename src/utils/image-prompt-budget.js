/**
 * Aviso de corte do pedido de imagem (IA-02).
 *
 * `shared/image-prompt.js` monta o pedido dentro do orçamento da rota e diz o
 * que saiu inteiro (`dropped`) e o que foi reduzido (`trimmed`). Aqui o editor
 * transforma isso em aviso antes de gastar crédito. Só conta texto que a
 * pessoa escreveu ou escolheu; bloco opcional do app sai sem aviso.
 */
const USER_BLOCKS = Object.freeze({
  scene: 'a descrição da cena',
  slideAction: 'a direção da imagem',
  style: 'o estilo do projeto',
  subjects: 'a ficha visual',
  referenceMap: 'o mapa das referências',
  identityAnchor: 'a referência da pessoa',
});

const lista = (itens) => (itens.length < 2 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);
const doUsuario = (chaves) => [...new Set(Array.isArray(chaves) ? chaves : [])].filter((chave) => USER_BLOCKS[chave]);

/** Chaves de texto do usuário que foram reduzidas ou ficaram de fora. */
export function imagePromptUserCuts(plan) {
  const dropped = doUsuario(plan?.dropped);
  const trimmed = doUsuario(plan?.trimmed).filter((chave) => !dropped.includes(chave));
  return { trimmed, dropped };
}

/** Frase do aviso, ou '' quando nada do usuário saiu. */
export function imagePromptCutMessage(plan) {
  const { trimmed, dropped } = imagePromptUserCuts(plan);
  if (!trimmed.length && !dropped.length) return '';
  return [
    'O pedido desta imagem não coube inteiro no gerador do plano.',
    trimmed.length ? `Reduzido: ${lista(trimmed.map((chave) => USER_BLOCKS[chave]))}.` : '',
    dropped.length ? `Fora do pedido: ${lista(dropped.map((chave) => USER_BLOCKS[chave]))}.` : '',
  ].filter(Boolean).join(' ');
}

/**
 * Porteiro do envio: quando há corte, pergunta antes (`ask(texto)` devolve
 * true para seguir). O sim vale para o mesmo corte no mesmo projeto, para não
 * repetir a pergunta a cada imagem; o não nunca fica guardado.
 */
export function createImagePromptCutGate({ ask, acknowledged = new Set() } = {}) {
  return async function gate(plan, scope = '') {
    const message = imagePromptCutMessage(plan);
    if (!message) return true;
    const { trimmed, dropped } = imagePromptUserCuts(plan);
    const key = `${scope}|${trimmed.join(',')}|${dropped.join(',')}`;
    if (acknowledged.has(key)) return true;
    const ok = (await ask(`${message}\n\nA imagem pode sair diferente do que você definiu. Gerar mesmo assim? Cada imagem usa 1 crédito.\n\nCancelar não gera a imagem e não usa crédito. Para enviar tudo, encurte o estilo do projeto ou a direção da imagem.`)) === true;
    if (ok) acknowledged.add(key);
    return ok;
  };
}
