/** Allowlisted text edits for the Moont agent. Media and visual fields are never accepted here. */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const dangerous = key => ['__proto__', 'prototype', 'constructor'].includes(key);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const CONTENT_PATCH_SCHEMA = Object.freeze({
  projectName: { type: 'string', maxLength: 160 },
  caption: { type: 'string', maxLength: 10000 },
  slideEdits: {
    type: 'array', maxItems: 100,
    fields: {
      slideId: { type: 'string', required: true, maxLength: 500 },
      title: { type: 'string', maxLength: 500 },
      subtitle: { type: 'string', maxLength: 4000 },
      bodyAfterImage: { type: 'string', maxLength: 6000 },
      caption: { type: 'string', maxLength: 8000 },
      imageQuery: { type: 'string', maxLength: 1000 },
    },
  },
  overlayEdits: {
    type: 'array', maxItems: 200,
    fields: {
      slideId: { type: 'string', required: true, maxLength: 500 },
      overlayId: { type: 'string', required: true, maxLength: 80 },
      text: { type: 'string', required: true, maxLength: 2000 },
    },
  },
  notes: [
    'Only the explicitly supplied text fields change.',
    'Photos, logos, visual styles, order and project identity are preserved.',
    'Use preview_text_edit before apply_text_edit. Version conflicts require a new preview.',
  ],
});

function bad(path, message = `Campo de conteúdo inválido: ${path}.`) {
  throw Object.assign(new Error(message), { code: 'content_patch_invalid', path, status: 400 });
}

function cleanString(value, path, maxLength, { required = false } = {}) {
  if (typeof value !== 'string' || value.length > maxLength || /\u0000/.test(value)
    || (required && !value.trim())) bad(path);
  return value;
}

function cleanId(value, path, maxLength) {
  return cleanString(value, path, maxLength, { required: true });
}

export function validateContentPatch(value) {
  if (!record(value)) bad('patch');
  const allowed = new Set(['projectName', 'caption', 'slideEdits', 'overlayEdits']);
  if (Object.keys(value).some(key => dangerous(key) || !allowed.has(key))) bad('patch');
  const patch = {};
  if (own(value, 'projectName')) patch.projectName = cleanString(value.projectName, 'patch.projectName', 160, { required: true });
  if (own(value, 'caption')) patch.caption = cleanString(value.caption, 'patch.caption', 10000);
  if (own(value, 'slideEdits')) {
    if (!Array.isArray(value.slideEdits) || !value.slideEdits.length || value.slideEdits.length > 100) bad('patch.slideEdits');
    const seen = new Set();
    patch.slideEdits = value.slideEdits.map((edit, index) => {
      const path = `patch.slideEdits.${index}`;
      if (!record(edit)) bad(path);
      const fields = new Set(['slideId', 'title', 'subtitle', 'bodyAfterImage', 'caption', 'imageQuery']);
      if (Object.keys(edit).some(key => dangerous(key) || !fields.has(key))) bad(path);
      const slideId = cleanId(edit.slideId, `${path}.slideId`, 500);
      if (seen.has(slideId)) bad(`${path}.slideId`, 'Cada card pode aparecer uma única vez no patch.');
      seen.add(slideId);
      const clean = { slideId };
      const limits = { title: 500, subtitle: 4000, bodyAfterImage: 6000, caption: 8000, imageQuery: 1000 };
      for (const [field, maxLength] of Object.entries(limits)) {
        if (own(edit, field)) clean[field] = cleanString(edit[field], `${path}.${field}`, maxLength);
      }
      if (Object.keys(clean).length === 1) bad(path, 'Informe ao menos um campo de texto para alterar.');
      return clean;
    });
  }
  if (own(value, 'overlayEdits')) {
    if (!Array.isArray(value.overlayEdits) || !value.overlayEdits.length || value.overlayEdits.length > 200) bad('patch.overlayEdits');
    const seen = new Set();
    patch.overlayEdits = value.overlayEdits.map((edit, index) => {
      const path = `patch.overlayEdits.${index}`;
      if (!record(edit) || Object.keys(edit).some(key => dangerous(key) || !['slideId', 'overlayId', 'text'].includes(key))) bad(path);
      const slideId = cleanId(edit.slideId, `${path}.slideId`, 500);
      const overlayId = cleanId(edit.overlayId, `${path}.overlayId`, 80);
      const key = `${slideId}\u0000${overlayId}`;
      if (seen.has(key)) bad(path, 'Cada área de texto pode aparecer uma única vez no patch.');
      seen.add(key);
      return { slideId, overlayId, text: cleanString(edit.text, `${path}.text`, 2000) };
    });
  }
  if (!Object.keys(patch).length) bad('patch', 'A alteração de conteúdo está vazia.');
  return patch;
}

function previewText(value) {
  return String(value ?? '').replace(/data:[^\s"']+/gi, '[mídia]').slice(0, 500);
}

export function applyContentPatchToEntry(entry, rawPatch) {
  if (!record(entry) || !record(entry.doc) || !Array.isArray(entry.doc.slides)) {
    throw Object.assign(new Error('Documento do projeto inválido.'), { code: 'content_project_invalid', status: 409 });
  }
  const patch = validateContentPatch(rawPatch);
  const slideEdits = new Map((patch.slideEdits || []).map(edit => [edit.slideId, edit]));
  const overlayEdits = new Map((patch.overlayEdits || []).map(edit => [`${edit.slideId}\u0000${edit.overlayId}`, edit]));
  const foundSlides = new Set();
  const foundOverlays = new Set();
  const changes = [];
  const slides = entry.doc.slides.map((slide, index) => {
    if (!record(slide)) return slide;
    const edit = slideEdits.get(slide.id);
    let next = slide;
    const fields = {};
    if (edit) {
      foundSlides.add(slide.id);
      next = { ...slide };
      for (const field of ['title', 'subtitle', 'bodyAfterImage', 'caption', 'imageQuery']) {
        if (!own(edit, field) || same(slide[field] ?? '', edit[field])) continue;
        next[field] = edit[field];
        fields[field] = { before: previewText(slide[field]), after: previewText(edit[field]) };
      }
    }
    const matchingOverlays = [...overlayEdits.entries()].filter(([key]) => key.startsWith(`${slide.id}\u0000`));
    if (matchingOverlays.length) {
      const overlays = Array.isArray(slide.overlays) ? slide.overlays : [];
      const updated = overlays.map(overlay => {
        const key = `${slide.id}\u0000${overlay?.id}`;
        const overlayEdit = overlayEdits.get(key);
        if (!overlayEdit) return overlay;
        foundOverlays.add(key);
        if (same(overlay?.text ?? '', overlayEdit.text)) return overlay;
        fields[`overlay.${overlay.id}.text`] = { before: previewText(overlay.text), after: previewText(overlayEdit.text) };
        return { ...overlay, text: overlayEdit.text };
      });
      if (!same(overlays, updated)) next = { ...next, overlays: updated };
    }
    if (Object.keys(fields).length) changes.push({ slideId: slide.id, index, fields });
    return next;
  });
  if (foundSlides.size !== slideEdits.size) {
    throw Object.assign(new Error('Um ou mais cards não existem neste projeto.'), { code: 'content_slide_missing', status: 404 });
  }
  if (foundOverlays.size !== overlayEdits.size) {
    throw Object.assign(new Error('Uma ou mais áreas de texto não existem neste projeto.'), { code: 'content_overlay_missing', status: 404 });
  }
  const projectChanges = {};
  let name = entry.name;
  if (own(patch, 'projectName') && patch.projectName !== entry.name) {
    projectChanges.projectName = { before: previewText(entry.name), after: previewText(patch.projectName) };
    name = patch.projectName;
  }
  let caption = entry.doc.caption;
  if (own(patch, 'caption') && patch.caption !== (entry.doc.caption ?? '')) {
    projectChanges.caption = { before: previewText(entry.doc.caption), after: previewText(patch.caption) };
    caption = patch.caption;
  }
  const changed = changes.length || Object.keys(projectChanges).length;
  return {
    entry: changed ? { ...entry, name, doc: { ...entry.doc, caption, slides } } : entry,
    changes,
    projectChanges,
    changedSlideCount: changes.length,
  };
}
