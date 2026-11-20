/**
 * Marcador de lista na exibição: a IA e a pessoa escrevem "- item", o card
 * mostra "• item" (MF-02). Troca um caractere por um caractere, então os
 * destaques gravados por posição (destaqueSpans) continuam no lugar. O texto
 * salvo e o editor mantêm o que foi digitado.
 */
const MARKER = /^([ \t]*)[-*–](?=[ \t]+\S)/gm;

export function displayListMarkers(text) {
  const value = String(text ?? '');
  return value.includes('-') || value.includes('*') || value.includes('–') ? value.replace(MARKER, '$1•') : value;
}
