/**
 * Rótulos de profundidade de UI e linguagem do caminho «Criar rápido».
 * IDs internos (criador/diretor/studio, GEN_MODES.id) não mudam —
 * só a comunicação com o utilizador (spec duas-profundidades-criacao.md).
 * Não confundir «Criador» do plano comercial (shared/plans.js) com o modo de interface.
 */

export const APP_MODE_UI = {
  criador: {
    label: 'Criar rápido',
    tagline: 'Pra começar agora',
    desc: 'Ideia → carrossel com a sua identidade → revisar → baixar',
    shortDesc: 'Poucas decisões — gerar e exportar',
  },
  diretor: {
    label: 'Controle profissional',
    tagline: 'Dirigir o resultado',
    desc: 'Contexto, narrativa, tom, densidade e identidade visual',
    shortDesc: 'Brief, modos e refino',
  },
  studio: {
    label: 'Studio',
    tagline: 'Edição avançada',
    desc: 'Layout, canvas, composição e ajustes finos',
    shortDesc: 'Todos os controles',
  },
};

/** Rótulos humanos para modos narrativos (caminho rápido). */
export const GEN_MODE_UI_LABELS = {
  none: 'Seguir meu pedido',
  editorial: 'Explicar com autoridade',
  deep: 'Ir a fundo',
  pain: 'Falar da dor',
  viral: 'Prender atenção',
  storytelling: 'Contar uma história',
  how_to: 'Ensinar passo a passo',
  jornalistico: 'Tom jornalístico',
  sensacionalista: 'Alto impacto',
};

export function appModeLabel(id) {
  return APP_MODE_UI[id]?.label || id;
}

export function genModeUiLabel(id, fallbackLabel) {
  return GEN_MODE_UI_LABELS[id] || fallbackLabel || id;
}

/** Microcopy interface × narrativa × voz (ajuda contextual). */
export const DEPTH_LAYERS_HINT =
  'Modo de interface define quantos controles você vê. Modo narrativo define como a história avança. Tom de voz define como a marca fala.';
