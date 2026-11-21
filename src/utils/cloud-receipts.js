/**
 * Recibo "salvo na conta" de um projeto: { owner, at, fingerprint }.
 *
 * Reteste 21/11 (T07): fotos que terminam de chegar depois de abrir o projeto
 * não são edição. A linha de base do envio já andava junto; o recibo também
 * precisa andar, senão o aviso fica em "pendente na conta" sem nada a enviar.
 * Só anda quando confirmava exatamente o estado anterior à chegada.
 */
export function advanceReceiptAfterHydration(receipts, projectId, beforeFingerprint, mergedFingerprint) {
  const receipt = receipts?.[projectId];
  if (!receipt || beforeFingerprint === mergedFingerprint || receipt.fingerprint !== beforeFingerprint) return receipts;
  return { ...receipts, [projectId]: { ...receipt, fingerprint: mergedFingerprint } };
}
