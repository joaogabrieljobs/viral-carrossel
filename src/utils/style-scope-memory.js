/**
 * Alcance da troca de estilo ("Todos" ou "Este card"), lembrado por projeto
 * enquanto a aba está aberta.
 *
 * O padrão é "Todos". O painel de Ajustes desmonta ao trocar de aba e ao
 * fechar a gaveta no celular; sem esta memória, quem escolhia "Este card"
 * voltava para "Todos" sem perceber e o clique seguinte mudava o projeto
 * inteiro (auditoria 23/11, FE-02). Os dois painéis leem daqui, para não
 * divergirem.
 */
const scopes = new Map();
const MAX_PROJECTS = 200;

export function readStyleScope(projectId) {
  return scopes.get(String(projectId || '')) === 'card' ? 'card' : 'all';
}

export function writeStyleScope(projectId, scope) {
  const key = String(projectId || '');
  if (scope === 'card') {
    scopes.delete(key);
    scopes.set(key, 'card');
    if (scopes.size > MAX_PROJECTS) scopes.delete(scopes.keys().next().value);
  } else {
    scopes.delete(key);
  }
  return readStyleScope(key);
}

/** Cards com ajuste visual próprio, que uma troca "em todos" substitui. */
export function countSlidesWithOwnVisuals(slides, exceptIndex = -1) {
  return (Array.isArray(slides) ? slides : []).filter((slide, index) => index !== exceptIndex && slide && (
    slide.visualPresetId || slide.visualBrand || slide.customBg
    || slide.canvas?.userEdited
    || (slide.elementOffsets && Object.keys(slide.elementOffsets).length > 0)
  )).length;
}
