/** Native evidence is data, never HTML or an image of a table. Invalid input is
 * rejected as a whole instead of losing rows, digits or words silently. */
import { PRESENTATION_ICON_NAMES, isPresentationIcon } from './presentation-icons.js';

const stringValue = (value, max, optional = false) => {
  if (optional && (value == null || value === '')) return '';
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : null;
};

/** Linhas da personalidade em pares no modo livre (o alvo do ChatGPT tem 7). */
export const COMPARISON_PAIRS_MAX_ROWS = 7;

export function normalizePresentationBlocks(raw) {
  if (!Array.isArray(raw) || raw.length !== 1) return [];
  const block = raw[0];
  if (!block || typeof block !== 'object') return [];
  if (block.type === 'comparison') {
    // Teste 6 (26/11): a personalidade em pares do modo livre ("traço / sem
    // ser…", variant 'pairs', montada pelo código em free-draft.js) aceita
    // até 7 linhas. Qualquer outro quadro continua com o teto de 5.
    const pairs = block.variant === 'pairs';
    const maxRows = pairs ? COMPARISON_PAIRS_MAX_ROWS : 5;
    if (!Array.isArray(block.headers) || block.headers.length < 2 || block.headers.length > 4
      || !Array.isArray(block.rows) || !block.rows.length || block.rows.length > maxRows) return [];
    const headers = block.headers.map((value) => stringValue(value, 80));
    const rows = block.rows.map((row) => Array.isArray(row) && row.length === headers.length
      ? row.map((value) => stringValue(value, 240)) : null);
    if (headers.includes(null) || rows.some((row) => !row || row.includes(null))) return [];
    if (pairs && (headers.length !== 2 || rows.some(row => !/^sem\s/i.test(row[1])))) return [];
    return [{ type: 'comparison', headers, rows, ...(pairs ? { variant: 'pairs' } : {}) }];
  }
  if (block.type === 'metrics') {
    if (!Array.isArray(block.items) || !block.items.length || block.items.length > 4) return [];
    const items = block.items.map((item) => ({
      label: stringValue(item?.label, 100), value: stringValue(item?.value, 48),
      detail: stringValue(item?.detail, 180, true),
    }));
    return items.some((item) => Object.values(item).includes(null)) ? [] : [{ type: 'metrics', items }];
  }
  if (block.type === 'steps') {
    if (!Array.isArray(block.items) || block.items.length < 2 || block.items.length > 5) return [];
    const items = block.items.map((item) => ({ title: stringValue(item?.title, 100), body: stringValue(item?.body, 260, true) }));
    return items.some((item) => Object.values(item).includes(null)) ? [] : [{ type: 'steps', items }];
  }
  // Modo livre, fase 3: citação, número grande e ícones.
  if (block.type === 'quote') {
    // Só as aspas de fora saem: a citação é desenhada com o próprio sinal.
    const text = stringValue(typeof block.text === 'string' ? block.text.trim().replace(/^["“”«»']+|["“”«»']+$/gu, '') : block.text, QUOTE_MAX);
    const author = stringValue(block.author, 80, true);
    return text === null || author === null ? [] : [{ type: 'quote', text, author }];
  }
  if (block.type === 'bignumber') {
    const value = stringValue(block.value, 16);
    const item = { type: 'bignumber', value: value && /\d/.test(value) ? value : null, label: stringValue(block.label, 90), detail: stringValue(block.detail, 160, true) };
    return Object.values(item).includes(null) ? [] : [item];
  }
  if (block.type === 'icons') {
    if (!Array.isArray(block.items) || block.items.length < 2 || block.items.length > 4) return [];
    const items = block.items.map((item) => ({
      icon: isPresentationIcon(item?.icon) ? item.icon : null, title: stringValue(item?.title, 60), body: stringValue(item?.body, 140, true),
    }));
    return items.some((item) => Object.values(item).includes(null)) ? [] : [{ type: 'icons', items }];
  }
  return [];
}

const QUOTE_MAX = 240;

/**
 * Direção de arte, parte 5: a personalidade em duas colunas ("traço / sem
 * ser…", página 10 do deck da Apoteose) é um comparison de 2 colunas em que a
 * segunda coluna nega o excesso de cada traço. O render a desenha como pares
 * (traço em destaque, sem zebra nem fios); o resto é a tabela de sempre.
 */
const PAIR_NEGATION = /^(sem|nem|nunca|mas\s+sem|não|without|never|not|sin|nunca)\b/iu;
export function comparisonVariant(block) {
  if (block?.type !== 'comparison' || !Array.isArray(block.headers) || block.headers.length !== 2 || !Array.isArray(block.rows) || !block.rows.length) return 'table';
  return block.rows.every(row => Array.isArray(row) && PAIR_NEGATION.test(String(row[1] || '').trim())) ? 'pairs' : 'table';
}

/** Textos visíveis de um bloco (sem tipo nem nome de ícone), na ordem de leitura. */
export function presentationBlockStrings(block) {
  if (!block || typeof block !== 'object') return [];
  if (block.type === 'comparison') return [...(block.headers || []), ...(block.rows || []).flat()];
  if (block.type === 'quote') return [block.text, block.author].filter(value => typeof value === 'string' && value);
  if (block.type === 'bignumber') return [block.value, block.label, block.detail].filter(value => typeof value === 'string' && value);
  return (Array.isArray(block.items) ? block.items : []).flatMap(item => (block.type === 'metrics' ? [item?.value, item?.label, item?.detail]
    : [item?.title, item?.body]).filter(value => typeof value === 'string' && value));
}

/** O mesmo bloco com `fn` aplicada a cada texto visível; tipo e ícone ficam. */
export function mapPresentationBlockStrings(block, fn) {
  const map = value => (typeof value === 'string' ? fn(value) : value);
  if (!block || typeof block !== 'object') return block;
  if (block.type === 'comparison') return { ...block, headers: block.headers.map(map), rows: block.rows.map(row => row.map(map)) };
  if (block.type === 'quote') return { ...block, text: map(block.text), author: map(block.author) };
  if (block.type === 'bignumber') return { ...block, value: map(block.value), label: map(block.label), detail: map(block.detail) };
  if (!Array.isArray(block.items)) return block;
  return { ...block, items: block.items.map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, key === 'icon' ? value : map(value)]))) };
}

export function buildPresentationBlocksPrompt({ free = false } = {}) {
  const base = `BLOCOS NATIVOS EDITÁVEIS — em cada slide inclua presentationBlocks: []. Use no máximo um bloco apenas quando os dados fornecidos sustentarem sua função no roteiro. Formatos permitidos:
- comparação: [{"type":"comparison","headers":["Critério","Opção A","Opção B"],"rows":[["Critério real","Condição real A","Condição real B"]]}]. 2–4 colunas, 1–5 linhas; cada célula até 240 caracteres e cabeçalho até 80.
- métricas: [{"type":"metrics","items":[{"label":"Indicador real","value":"Valor com unidade","detail":"Período, condição ou ressalva"}]}]. 1–4 itens; label até 100, value até 48, detail até 180 caracteres.
- sequência: [{"type":"steps","items":[{"title":"Etapa real","body":"Explicação concreta"},{"title":"Próxima etapa","body":"Responsável ou critério informado"}]}]. 2–5 itens; título até 100, corpo até 260 caracteres.
Os limites são máximos de segurança, não uma meta de preenchimento: prefira 2–3 colunas, até 4 linhas, células de até 80 caracteres, detalhes de métricas até 90 e corpos de etapas até 110. Divida argumentos extensos entre slides ou notas; nunca corte palavras para caber.
Não transforme informação ausente em zero ou comparação inventada. Números devem manter unidade, período e condição. Texto simples; sem HTML nem CSS. O bloco contém a evidência e o subtitle explica sua implicação, sem repetir cada célula. Use [] quando não houver dados suficientes. Não peça à imagem que desenhe tabela, gráfico, números, rótulos ou qualquer prova. Essas informações serão renderizadas de forma nativa.`;
  if (!free) return base;
  // Modo livre (fase 3): blocos de citação, número grande e ícones. Só o
  // preset presentation_free pede; os outros continuam com o pedido de antes.
  return `${base}
BLOCOS DO MODO LIVRE — além dos três acima, quando design.block da posição for quote, bignumber ou icons, presentationBlocks traz esse bloco, e só quando o material o sustentar:
- personalidade em pares: comparison com variant: "pairs", headers com 2 colunas (traço e ressalva) e rows com 3 a 7 pares presentes no material. Essa variante admite os sete pares completos, sem aplicar o limite comum de 5 linhas.
- citação: [{"type":"quote","text":"frase copiada literalmente do material","author":"autoria exatamente como está no material"}]. text até ${QUOTE_MAX} caracteres (prefira até 140), sem aspas; author opcional até 80, "" quando o material não diz quem falou. Nunca parafraseie nem atribua a frase a alguém que o material não nomeia: citação ou autoria sem fonte literal faz o bloco cair.
- número grande: [{"type":"bignumber","value":"40 mil","label":"pessoas por edição","detail":"período ou condição"}]. value até 16 caracteres, com o número como está no material; label até 90; detail opcional até 160. Número que não está no material faz o bloco cair.
- ícones: [{"type":"icons","items":[{"icon":"users","title":"Título curto","body":"Uma linha concreta"}]}]. 2–4 itens; icon só desta lista: ${PRESENTATION_ICON_NAMES.join(', ')}; title até 60 (prefira até 28); body opcional até 140 (prefira uma linha, até 60).
Sem material para o bloco pedido, use [] e escreva a ideia no texto.`;
}

const isPresentation = (slide, fmt) => fmt === 'apresentacao' || !!slide?.presentationCompositionId || !!slide?.presentationPresetId;
const rectValid = (rect) => rect && ['x', 'y', 'w', 'h'].every((key) => typeof rect[key] === 'number' && Number.isFinite(rect[key])) && rect.w > 0 && rect.h > 0;
const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.2
  && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.2;

/** Only deliberate, saved presentation geometry is audited. Legacy free-form
 * documents do not acquire new export requirements from missing metadata. */
export function auditPresentationLayout(slide, { index = 0, fmt = 'apresentacao' } = {}) {
  const issues = [];
  const add = (code, message, zone, severity = 'error') => issues.push({ code, message, severity, zone, slideIndex: index, slideId: slide?.id });
  if (!isPresentation(slide, fmt)) return { ok: true, issues };
  const blocks = normalizePresentationBlocks(slide?.presentationBlocks);
  if (slide?.presentationBlocks?.length && !blocks.length) add('invalid-block', 'O bloco de dados precisa ser revisado; há campos inválidos ou conteúdo além do limite.');
  const zones = slide?.canvas?.zones;
  if (!zones || !(slide.canvas.applied || slide.canvas.enabled)) return { ok: !issues.length, issues };
  const active = [
    ...(String(slide.title || '').trim() ? ['title'] : []),
    ...(String(slide.subtitle || '').trim() || String(slide.bodyAfterImage || '').trim() ? ['subtitle'] : []),
    ...(blocks.length ? ['evidence'] : []),
  ];
  for (const key of active) {
    const rect = zones[key];
    if (!rectValid(rect)) { add('invalid-zone', `A área de ${key === 'title' ? 'título' : key === 'subtitle' ? 'texto' : 'dados'} não tem dimensões válidas.`, key); continue; }
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > 100.05 || rect.y + rect.h > 100.05) add('outside-canvas', 'Uma área de conteúdo ultrapassa o slide.', key);
    if (key === 'evidence' && (rect.w < 50 || rect.h < 25)) add('small-evidence-zone', 'O quadro de dados precisa de mais espaço para manter a leitura.', key);
  }
  for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
    const a = active[i]; const b = active[j];
    if (rectValid(zones[a]) && rectValid(zones[b]) && overlaps(zones[a], zones[b])) add('overlapping-content', 'Duas áreas de conteúdo se sobrepõem. Reorganize a composição antes de baixar.', `${a}/${b}`);
  }
  return { ok: !issues.some((issue) => issue.severity === 'error'), issues };
}

/** Bounded repairs preserve every word, value, asset and font. They only move
 * a generated box by up to 2 percentage points back inside the canvas. */
export function repairPresentationLayouts(input, options = {}) {
  const repairs = [];
  const slides = (Array.isArray(input) ? input : []).map((slide, index) => {
    if (!isPresentation(slide, options.fmt ?? 'apresentacao') || slide?.canvas?.source !== 'presentation-preset') return slide;
    const zones = { ...slide.canvas.zones }; let changed = false;
    for (const [key, rect] of Object.entries(zones)) {
      if (!rectValid(rect) || rect.w > 100 || rect.h > 100) continue;
      const x = Math.max(0, Math.min(100 - rect.w, rect.x));
      const y = Math.max(0, Math.min(100 - rect.h, rect.y));
      if ((x !== rect.x || y !== rect.y) && Math.abs(x - rect.x) <= 2 && Math.abs(y - rect.y) <= 2) {
        zones[key] = { ...rect, x, y }; changed = true;
        repairs.push({ slideIndex: index, code: 'bounded-box', message: 'Área reposicionada dentro do slide.', zone: key });
      }
    }
    return changed ? { ...slide, canvas: { ...slide.canvas, zones } } : slide;
  });
  const issues = slides.flatMap((slide, index) => auditPresentationLayout(slide, { ...options, index }).issues);
  return { slides, repairs, issues, ok: !issues.some((issue) => issue.severity === 'error') };
}

function rgb(color) {
  const match = String(color || '').match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (!match || (match[4] != null && Number(match[4]) < 0.99)) return null;
  return match.slice(1, 4).map(Number);
}
function luminance(channels) {
  const values = channels.map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

/** Piso de leitura no deck: 1,25% da largura — 24 px num slide de 1920.
 * Ponto de partida calibrável; entra só como aviso. */
export const PRESENTATION_TEXT_FLOOR_RATIO = 0.0125;

/** Measurements run on the actual offscreen export tree after fonts/assets.
 * Photo semantics cannot be inferred here; contrast is checked only where a
 * native evidence panel declares an opaque surface. */
export function auditRenderedPresentationLayout(roots, { getStyle = globalThis.getComputedStyle } = {}) {
  const issues = [];
  for (const [index, root] of (Array.isArray(roots) ? roots : []).entries()) {
    if (!root) continue;
    const surface = root.matches?.('[data-vc-presentation="true"]') ? root
      : root.closest?.('[data-vc-presentation="true"]') || root.querySelector?.('[data-vc-presentation="true"]');
    if (!surface) continue;
    const add = (code, message, severity = 'error') => issues.push({ code, message, severity, slideIndex: index, slideId: surface.getAttribute?.('data-vc-card-surface') });
    const frame = surface.getBoundingClientRect?.();
    const zones = Array.from(surface.querySelectorAll?.('[data-vc-quality-zone]') || []).filter((node) => node.textContent?.trim());
    const measured = [];
    for (const node of zones) {
      const box = node.getBoundingClientRect?.();
      if (!box?.width || !box?.height) continue;
      if (frame?.width && (box.left < frame.left - 2 || box.top < frame.top - 2 || box.right > frame.right + 2 || box.bottom > frame.bottom + 2)) add('render-outside', 'Há conteúdo fora da área do slide.');
      if ((node.scrollHeight > node.clientHeight + 3 && node.clientHeight > 0) || (node.scrollWidth > node.clientWidth + 3 && node.clientWidth > 0)) add('render-overflow', 'O texto ou quadro de dados excede a área disponível. Amplie a área ou revise o conteúdo.');
      measured.push({ node, box });
    }
    // Aviso, nunca bloqueio: texto de título, subtítulo ou apoio abaixo do piso
    // de leitura em projeção. Blocos de dados têm escala própria e ficam fora.
    if (typeof getStyle === 'function') {
      const largura = surface.clientWidth || frame?.width || 0;
      const piso = largura * PRESENTATION_TEXT_FLOOR_RATIO;
      const pequeno = piso > 0 && measured.some(({ node }) => {
        if (node.getAttribute?.('data-vc-quality-zone') === 'evidence') return false;
        const folhas = [node, ...Array.from(node.querySelectorAll?.('*') || [])]
          .filter((el) => Array.from(el.childNodes || []).some((filho) => filho.nodeType === 3 && filho.textContent?.trim()));
        return folhas.some((el) => {
          const px = Number.parseFloat(getStyle(el)?.fontSize);
          return px > 0 && px < piso - 0.5;
        });
      });
      if (pequeno) add('text-below-floor', 'Há texto pequeno demais para leitura em apresentação. Aumente o tamanho ou reduza o texto do slide.', 'warning');
    }
    for (let i = 0; i < measured.length; i += 1) for (let j = i + 1; j < measured.length; j += 1) {
      const a = measured[i]; const b = measured[j];
      if (a.node.contains?.(b.node) || b.node.contains?.(a.node)) continue;
      if (Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 2
        && Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 2) add('render-overlap', 'Título, texto ou quadro de dados se sobrepõem.');
    }
    for (const logo of Array.from(surface.querySelectorAll?.('[data-vc-logo-visible-rect]') || [])) {
      const bounds = logo.getBoundingClientRect?.();
      const ink = String(logo.getAttribute?.('data-vc-logo-visible-rect') || '').split(',').map(Number);
      if (!bounds?.width || ink.length !== 4 || ink.some((value) => !Number.isFinite(value))) continue;
      const sx = bounds.width / (logo.clientWidth || bounds.width);
      const sy = bounds.height / (logo.clientHeight || bounds.height);
      const box = { left: bounds.left + ink[0] * sx, top: bounds.top + ink[1] * sy,
        right: bounds.left + (ink[0] + ink[2]) * sx, bottom: bounds.top + (ink[1] + ink[3]) * sy };
      if (measured.some(({ box: textBox }) => Math.min(box.right, textBox.right) - Math.max(box.left, textBox.left) > 2
        && Math.min(box.bottom, textBox.bottom) - Math.max(box.top, textBox.top) > 2)) add('logo-overlap', 'A logo cobre uma área de texto ou dados. Mova a logo ou reorganize a composição.');
    }
    for (const panel of Array.from(surface.querySelectorAll?.('[data-vc-evidence-surface]') || [])) {
      if (typeof getStyle !== 'function') continue;
      const back = rgb(getStyle(panel)?.backgroundColor); if (!back) continue;
      for (const node of Array.from(panel.querySelectorAll?.('[data-vc-evidence-cell]') || [])) {
        const ink = rgb(getStyle(node)?.color); if (!ink || !node.textContent?.trim()) continue;
        const [light, dark] = [luminance(back), luminance(ink)].sort((a, b) => b - a);
        if ((light + 0.05) / (dark + 0.05) < 3) { add('evidence-contrast', 'O quadro de dados precisa de mais contraste para ser legível.'); break; }
      }
    }
  }
  return { ok: !issues.some((issue) => issue.severity === 'error'), issues };
}
