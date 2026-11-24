/**
 * Texto que a pessoa digitou num elemento em edição no próprio card.
 *
 * `innerText` devolve o texto como está pintado, já com o `text-transform` do
 * estilo aplicado (MAIÚSCULAS no Sports Editorial, por exemplo). Gravar esse
 * valor trocava a caixa do que foi escrito, mesmo sem digitar nada. A caixa é
 * só do estilo: a leitura desliga o `text-transform` do elemento durante a
 * chamada (não chega a pintar) e devolve o valor que estava. As quebras de
 * linha do `contentEditable` continuam vindo do navegador, como antes.
 */
export function readTypedText(element) {
  if (!element) return '';
  const style = element.style;
  if (!style || typeof element.innerText !== 'string') {
    return String(element.innerText ?? element.textContent ?? '');
  }
  const previous = style.textTransform;
  style.textTransform = 'none';
  try {
    return String(element.innerText ?? '');
  } finally {
    style.textTransform = previous;
  }
}
