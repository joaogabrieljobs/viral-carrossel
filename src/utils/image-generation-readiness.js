const text = (value) => typeof value === 'string' ? value.trim() : '';
const ready = { canGenerate: true, reason: null, message: '' };
const blocked = (reason, message) => ({ canGenerate: false, reason, message });

/** Acesso à imagem é independente da disponibilidade do provedor de texto. */
export function imageGenerationAccess({ access = {}, useOwnImageKey = false, hasByokImageKey = false } = {}) {
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
  if (access.tier === 'essential' || (quota?.limit != null && Number(quota.limit) === 0)) {
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

  const hasReference = Boolean(slide.refImage || styleKit.refImages?.length);
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
  if (!instruction.query) {
    return {
      ...blocked('missing_direction', 'Abra Direção e descreva a imagem que você quer criar. A referência precisa de uma instrução ou do conteúdo do card.'),
      ...instruction,
    };
  }
  return { ...ready, ...instruction };
}
