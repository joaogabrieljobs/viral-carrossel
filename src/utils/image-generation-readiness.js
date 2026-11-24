const text = (value) => typeof value === 'string' ? value.trim() : '';
const ready = { canGenerate: true, reason: null, message: '' };
const blocked = (reason, message) => ({ canGenerate: false, reason, message });

/** Acesso à imagem é independente da disponibilidade do provedor de texto. */
export function imageGenerationAccess({ access = {}, useOwnImageKey = false, hasByokImageKey = false } = {}) {
  // Plano grátis: nem a plataforma nem a chave própria geram imagem. O botão
  // continua clicável (`upgrade`) para levar à assinatura em vez de ficar mudo.
  if (access.free && !access.active) {
    return { ...blocked('free_plan', 'Gerar imagem faz parte dos planos pagos. No grátis você envia suas próprias fotos.'), upgrade: true };
  }
  if (useOwnImageKey) {
    return hasByokImageKey ? ready : blocked('missing_image_key',
      'Sua chave de imagem não está configurada. Abra Configurar IA para adicioná-la ou usar as imagens do plano.');
  }
  if (access.billingDisabled) return ready;
  if (access.status === 'loading') return blocked('account_loading', 'Verificando seu acesso às imagens…');
  if (!access.active) return blocked('account_inactive', 'Entre em uma conta com plano ativo para gerar imagens.');

  const quota = access.imageQuota;
  // null não é zero: uma falha de consulta nunca deve parecer quota esgotada.
  if (quota?.available === false || quota?.status === 'unavailable') {
    return blocked('quota_unavailable', 'Não foi possível consultar seu saldo de imagens. Tente atualizar a página em instantes.');
  }
  // MT-09: quem decide é a quota que o servidor mandou. Isenção "Essencial sem
  // limite de imagens" chega com limite positivo e pode gerar; o nome do plano
  // só vale quando não veio limite nenhum.
  const quotaLimit = quota?.limit != null ? Number(quota.limit) : null;
  if (quotaLimit === 0 || (access.tier === 'essential' && !(quotaLimit > 0))) {
    return blocked('plan_without_images', 'Seu plano não inclui imagens. Faça upgrade ou use sua chave em Configurar IA.');
  }
  if (quota?.limit != null && quota?.remaining != null
    && Number.isFinite(Number(quota.limit)) && Number.isFinite(Number(quota.remaining))) {
    if (Number(quota.limit) > 0 && Number(quota.remaining) > 0) return ready;
    if (Number(quota.limit) > 0 && Number(quota.remaining) === 0) {
      return blocked('quota_exhausted', 'Você usou todas as imagens deste ciclo. Veja a renovação em Uso ou use sua chave em Configurar IA.');
    }
  }
  return blocked('quota_unavailable', 'Não foi possível consultar seu saldo de imagens. Tente atualizar a página em instantes.');
}

/** A mesma instrução habilita o botão e segue para a API, inclusive em slides só texto. */
export function slideImageInstruction(slide = {}, styleKit = {}) {
  const query = text(slide.imageQuery);
  const extra = text(slide.imgExtraPrompt);
  if (query) return { query, extraPrompt: extra };
  if (extra) return { query: extra, extraPrompt: '' };

  const hasReference = Boolean(slide.refImage || slide.refImageId || slide.refImageAssetId
    || slide.imageReferences?.length || styleKit.refImages?.length);
  const content = [slide.title, slide.subtitle, slide.bodyAfterImage].map(text).filter(Boolean).join('\n');
  if (hasReference && content) {
    return {
      query: `Crie uma imagem que acompanhe o conteúdo abaixo, usando a referência visual anexada. Preserve a identidade do que aparece na referência e conecte a cena ao assunto. Não escreva o texto do card na imagem.\nConteúdo:\n${content.slice(0, 2400)}`,
      extraPrompt: '',
    };
  }
  return { query: '', extraPrompt: '' };
}

export function slideImageGenerationState(slide = {}, accessState = ready, styleKit = {}) {
  const instruction = slideImageInstruction(slide, styleKit);
  if (!accessState.canGenerate) return { ...accessState, ...instruction };
  if (slide.refImageFailed && !text(slide.refImage)) {
    return {
      ...blocked('reference_unavailable', 'Reenvie a referência deste card: o arquivo não está disponível neste navegador.'),
      ...instruction,
    };
  }
  if (Array.isArray(slide.imageReferences)
    && slide.imageReferences.some((ref) => ref?.missing === true && !text(ref?.dataUrl))) {
    return {
      ...blocked('reference_unavailable', 'Reenvie a referência indisponível deste card. O @nome será mantido.'),
      ...instruction,
    };
  }
  if (!instruction.query) {
    return {
      ...blocked('missing_direction', 'Abra Direção e descreva a imagem que você quer criar. A referência precisa de uma instrução ou do conteúdo do card.'),
      ...instruction,
    };
  }
  return { ...ready, ...instruction };
}

/**
 * Cards que "Gerar imagens" pode gerar em lote: têm pedido de imagem e não têm
 * foto. Foto que existe na conta (`bgImageAssetId`) conta como foto mesmo
 * enquanto baixa ou quando o download falhou; gerar por cima gastaria crédito
 * ou trocaria a foto original. Devolve `{ slide, index }` na ordem dos cards.
 */
export function slidesPendingImageGeneration(slides, selectedSlideIds = null) {
  const selected = Array.isArray(selectedSlideIds) && selectedSlideIds.length ? new Set(selectedSlideIds) : null;
  return (Array.isArray(slides) ? slides : [])
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => text(slide?.imageQuery) && !slide?.bgImage && !slide?.bgImageAssetId
      && (!selected || selected.has(slide.id)));
}

/**
 * Seletor "Quais cards terão imagem?" (auditoria 23/11, GB-08). Lista só o que
 * o lote vai gerar e conta só o que está marcado entre eles, para o botão não
 * prometer imagem e crédito de card que a geração pula por já ter foto.
 */
export function imageBatchSelection(slides, selectedSlideIds = []) {
  const eligible = slidesPendingImageGeneration(slides);
  const eligibleIds = new Set(eligible.map(({ slide }) => slide.id));
  const selectedIds = (Array.isArray(selectedSlideIds) ? selectedSlideIds : []).filter((id) => eligibleIds.has(id));
  return { eligible, selectedIds };
}
