/**
 * Documento depois de aplicar um template pronto: cards, marca e pacote
 * criativo passam a ser os do template, e o que falava do conteúdo anterior
 * sai junto. Função pura para o editor e os testes usarem a mesma regra.
 */
export function docAfterReadyTemplate(doc, { slides, brand, creativePreset } = {}) {
  const source = doc && typeof doc === 'object' ? doc : {};
  return {
    ...source,
    slides,
    brand,
    creativePreset: creativePreset || source.creativePreset || 'livre',
    productKind: 'carrossel',
    fmt: source.fmt === 'apresentacao' ? 'carrossel' : source.fmt,
    visualPreset: null,
    // Aviso de revisão, pontos a conferir, aviso de material e ficha visual
    // descrevem o conteúdo que acabou de sair: não valem para o do template.
    editorialReviewStatus: undefined,
    editorialReviewIssues: [],
    imageAuditFindings: [],
    materialNotice: '',
    presentationMaterialNotice: undefined,
    visualBible: null,
  };
}
