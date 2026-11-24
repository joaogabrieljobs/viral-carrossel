/**
 * Conferência de alvo de operação assíncrona.
 *
 * Uma operação guarda o alvo (projeto, card) quando começa e só pode gravar no
 * editor se, ao terminar, o alvo ainda for o mesmo. As decisões ficam aqui,
 * puras, para serem testadas fora do monólito.
 */

/** "A última abertura vence": cada pedido recebe uma senha e só a mais nova vale. */
export function createLatestRequestGate() {
  let latest = 0;
  return {
    begin() { latest += 1; return latest; },
    isLatest(token) { return token === latest; },
  };
}

/**
 * O que `openDoc` pode fazer com a resposta da conta, depois da espera.
 *  - 'superseded': a pessoa abriu outro projeto depois; não toca no editor.
 *  - 'refresh-active': o projeto pedido é o que está no editor agora.
 *  - 'open': o projeto pedido não está no editor; troca para ele.
 * `activeDocId` é o do editor agora, nunca o do momento do clique.
 */
export function resolveOpenDocTarget({ docId, activeDocId, isLatest }) {
  if (!isLatest) return 'superseded';
  return docId === activeDocId ? 'refresh-active' : 'open';
}

/**
 * A operação começou com `startedProjectId` aberto no editor. Só pode gravar
 * no editor se o mesmo projeto continua aberto. Trocar de projeto no meio
 * (importação em lote, receber da equipe) não leva o resultado para o outro.
 */
export function isSameOpenProject(startedProjectId, currentProjectId) {
  return startedProjectId === currentProjectId;
}

/**
 * "Receber alterações da equipe": onde gravar o documento recebido depois do
 * download das fotos. A entrada de origem sempre recebe, porque foi nela que a
 * pessoa confirmou. O editor só recebe se esse projeto continua aberto.
 */
export function teamPullDestination({ targetDocId, activeDocId }) {
  return { entryId: targetDocId, applyToEditor: isSameOpenProject(targetDocId, activeDocId) };
}
