/**
 * Lista fechada de ícones lucide (kebab-case) do bloco de ícones da
 * apresentação (modo livre, docs/product/modo-livre-apresentacao.md). Módulo
 * puro: o desenho (componente lucide-react) fica em PresentationBlocks.jsx.
 */
export const PRESENTATION_ICON_NAMES = Object.freeze([
  'check', 'arrow-right', 'trending-up', 'trending-down', 'users', 'user', 'calendar', 'clock',
  'map-pin', 'star', 'heart', 'lightbulb', 'target', 'shield', 'zap', 'globe', 'music', 'camera',
  'book-open', 'briefcase', 'bar-chart', 'dollar-sign', 'leaf', 'sparkles', 'message-circle', 'rocket',
]);

export const isPresentationIcon = name => PRESENTATION_ICON_NAMES.includes(name);
