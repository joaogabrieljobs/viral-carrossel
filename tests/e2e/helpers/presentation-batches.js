// Keep fixtures strict about which positions the writer was asked to return.
export function presentationBatch(prompt, slides) {
  const line = prompt.split('\n').find(value => value.startsWith('POSIÇÕES DESTA CHAMADA: '));
  if (!line) throw new Error('A redação de apresentação deve declarar as posições do lote.');
  const entries = JSON.parse(line.slice('POSIÇÕES DESTA CHAMADA: '.length));
  return entries.map(entry => {
    const slide = slides[entry.index - 1];
    if (!slide) throw new Error(`Posição ${entry.index} fora da apresentação de teste.`);
    return slide;
  });
}
