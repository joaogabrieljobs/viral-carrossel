/**
 * Spec 1.1, entrega 5: auditoria de imagem da apresentação, atrás de flag por conta.
 *
 * Depois do laço de imagens, UMA chamada com o mosaico dos slides gerados, os
 * títulos e as rules de imagem do roteiro v2. A resposta é tipada (slide, regra
 * violada, evidência visível) e validada aqui: o que sai do contrato é
 * descartado. A auditoria NUNCA gera imagem; só aponta. Quem decide gerar outra
 * é a pessoa, pelo botão do aviso, com a confirmação de custo.
 */

/** Teto de achados mostrados por auditoria (não há refação automática). */
export const IMAGE_AUDIT_MAX_FINDINGS = 2;
const EVIDENCE_MIN = 12;
const EVIDENCE_MAX = 280;
const RULE_ID = /^[A-Za-z0-9_-]{1,40}$/;
// "Sem evidência" não é evidência; hesitação também não descreve o que se vê.
const EMPTY_EVIDENCE = /^(?:n\/?a|none|null|nenhum[a]?|sem evid[eê]ncia|unknown|desconhecid[oa]|não se aplica|-+|\.+)$/i;
const HEDGED_EVIDENCE = /\b(?:talvez|possivelmente|provavelmente|parece que|pode(?:ria)? (?:haver|ter|ser|mostrar)|might|may|possibly|probably|perhaps|seems?)\b/i;

const text = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** Só as rules de imagem do roteiro (target image) com id e instrução válidos. */
export function imageAuditRules(plan) {
  const rules = Array.isArray(plan?.rules) ? plan.rules : [];
  return rules
    .filter(rule => rule && rule.target === 'image' && ['required', 'avoid'].includes(rule.level)
      && RULE_ID.test(String(rule.id || '')) && text(rule.instruction))
    .map(rule => ({ id: rule.id, level: rule.level, target: 'image', instruction: text(rule.instruction) }));
}

function parseAuditJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(unfenced); } catch { return null; }
}

function visibleEvidence(value) {
  const evidence = text(value);
  if (evidence.length < EVIDENCE_MIN || EMPTY_EVIDENCE.test(evidence) || HEDGED_EVIDENCE.test(evidence)) return '';
  return evidence.length > EVIDENCE_MAX ? `${evidence.slice(0, EVIDENCE_MAX - 1).trimEnd()}…` : evidence;
}

/**
 * Valida a resposta do modelo. `slides` são os slides auditados
 * ({ slideId, slideIndex }); o modelo cita o número do slide (slideIndex + 1),
 * o mesmo que aparece na miniatura. Devolve no máximo IMAGE_AUDIT_MAX_FINDINGS,
 * um por slide, na ordem da resposta.
 */
export function validateImageAuditResponse(raw, { slides = [], rules = [] } = {}) {
  const data = parseAuditJson(raw);
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  const bySlideNumber = new Map((Array.isArray(slides) ? slides : [])
    .filter(slide => slide?.slideId && Number.isInteger(slide.slideIndex) && slide.slideIndex >= 0)
    .map(slide => [slide.slideIndex + 1, slide]));
  const byRuleId = new Map(imageAuditRules({ rules }).map(rule => [rule.id, rule]));
  const out = [];
  const seen = new Set();
  for (const item of findings) {
    if (out.length >= IMAGE_AUDIT_MAX_FINDINGS) break;
    if (!item || typeof item !== 'object') continue;
    const slide = Number.isInteger(item.slide) ? bySlideNumber.get(item.slide) : null;
    const rule = typeof item.ruleId === 'string' ? byRuleId.get(item.ruleId) : null;
    const evidence = visibleEvidence(item.evidence);
    if (!slide || !rule || !evidence || seen.has(slide.slideId)) continue;
    seen.add(slide.slideId);
    out.push({ slideId: slide.slideId, slideIndex: slide.slideIndex, ruleId: rule.id, level: rule.level, rule: rule.instruction, evidence });
  }
  return out;
}

// ─── Mosaico ────────────────────────────────────────────────────────────────
// Um JPEG só, em baixa resolução, montado no navegador com as imagens que o
// laço acabou de gerar (data URL em memória). Nada é baixado de novo: URL
// http(s) ou blob fica de fora. O teto de caracteres mantém o pedido abaixo de
// PLATFORM_MAX_PROMPT_CHARS (120 mil) com folga para o texto.
export const IMAGE_AUDIT_MOSAIC_MAX_CHARS = 90_000;
const MOSAIC_WIDTHS = [1024, 768, 512];
const MOSAIC_QUALITIES = [0.6, 0.45, 0.3];

export function imageAuditMosaicLayout(count, { maxWidth = 1024 } = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const columns = total <= 1 ? 1 : total <= 4 ? 2 : total <= 9 ? 3 : 4;
  const cellWidth = Math.floor(maxWidth / columns);
  const cellHeight = Math.round(cellWidth * 9 / 16);
  const rows = Math.max(1, Math.ceil(total / columns));
  return { columns, rows, cellWidth, cellHeight, width: cellWidth * columns, height: cellHeight * rows };
}

const inMemoryImage = (value) => typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);

function browserCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function browserImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_decode_failed'));
    img.src = src;
  });
}

function drawMosaic(loaded, layout, createCanvas) {
  const canvas = createCanvas(layout.width, layout.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, layout.width, layout.height);
  const labelSize = Math.max(14, Math.round(layout.cellHeight * 0.16));
  loaded.forEach(({ img, slideIndex }, position) => {
    const dx = (position % layout.columns) * layout.cellWidth;
    const dy = Math.floor(position / layout.columns) * layout.cellHeight;
    const iw = Number(img.naturalWidth || img.width) || layout.cellWidth;
    const ih = Number(img.naturalHeight || img.height) || layout.cellHeight;
    // Cobre a célula sem distorcer: recorta o excesso do centro.
    const scale = Math.max(layout.cellWidth / iw, layout.cellHeight / ih);
    const sw = layout.cellWidth / scale;
    const sh = layout.cellHeight / scale;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, layout.cellWidth, layout.cellHeight);
    ctx.fillStyle = '#000';
    ctx.fillRect(dx, dy, labelSize * 1.8, labelSize * 1.4);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${labelSize}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(String(slideIndex + 1), dx + labelSize * 0.3, dy + labelSize * 0.2);
  });
  return canvas;
}

/**
 * `entries`: [{ slideId, slideIndex, dataUrl }]. Devolve
 * { dataUrl, width, height, slides } ou null quando não há imagem em memória
 * ou o mosaico não cabe no teto mesmo reduzido.
 */
export async function buildImageAuditMosaic(entries, { createCanvas = browserCanvas, loadImage = browserImage } = {}) {
  const candidates = (Array.isArray(entries) ? entries : [])
    .filter(entry => entry?.slideId && Number.isInteger(entry.slideIndex) && inMemoryImage(entry.dataUrl));
  const loaded = [];
  for (const entry of candidates) {
    try {
      loaded.push({ img: await loadImage(entry.dataUrl), slideId: entry.slideId, slideIndex: entry.slideIndex });
    } catch { /* imagem que não decodifica fica de fora */ }
  }
  if (!loaded.length) return null;
  for (const maxWidth of MOSAIC_WIDTHS) {
    const layout = imageAuditMosaicLayout(loaded.length, { maxWidth });
    const canvas = drawMosaic(loaded, layout, createCanvas);
    for (const quality of MOSAIC_QUALITIES) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/jpeg') && dataUrl.length <= IMAGE_AUDIT_MOSAIC_MAX_CHARS) {
        return { dataUrl, width: layout.width, height: layout.height,
          slides: loaded.map(({ slideId, slideIndex }) => ({ slideId, slideIndex })) };
      }
    }
  }
  return null;
}
