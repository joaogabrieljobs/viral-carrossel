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
