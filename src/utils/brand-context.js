/**
 * Contexto editorial da marca (brief + estilo + refs) — herdado por projetos novos.
 * Vive em `brand.styleKit` nos perfis do roster; o projeto recebe uma cópia em `doc.styleKit`.
 */

import { normalizeStyleKit, styleKitHasContent, DEFAULT_STYLE_KIT } from './style-kit.js';

/** Cópia limpa do styleKit da marca para um projeto novo. */
export function cloneBrandStyleKit(brand) {
  const kit = brand && typeof brand === 'object' ? brand.styleKit : null;
  if (!kit || !styleKitHasContent(kit)) {
    return { ...DEFAULT_STYLE_KIT, refImages: [] };
  }
  const normalized = normalizeStyleKit(kit);
  return {
    ...normalized,
    refImages: Array.isArray(normalized.refImages)
      ? normalized.refImages.map((r) => ({ ...r }))
      : [],
    ...(normalized.logo ? { logo: { ...normalized.logo } } : {}),
  };
}

/** Grava / actualiza o contexto default num perfil de marca. */
export function withBrandStyleKit(brand, styleKit) {
  const base = brand && typeof brand === 'object' ? { ...brand } : {};
  const nextKit = normalizeStyleKit(styleKit);
  return {
    ...base,
    styleKit: nextKit,
  };
}

/** Projectos cuja identidade aponta para esta marca. */
export function projectsForBrand(library, brandId) {
  const id = String(brandId || '').trim();
  if (!id) return Array.isArray(library) ? [...library] : [];
  return (library || []).filter((entry) => {
    const bid = entry?.doc?.brand?.id;
    if (id === 'default') {
      return !bid || bid === 'default';
    }
    return bid === id;
  });
}

/**
 * MF-14: projeto aberto cuja marca não está na lista de marcas não trocava a
 * marca ativa, e o painel listava os projetos de outra marca sem ele. O
 * projeto aberto sempre aparece (primeiro, quando é de outra marca).
 */
export function projectsForPanel(library, brandId, activeDocId) {
  const list = projectsForBrand(library, brandId);
  if (!activeDocId || list.some((entry) => entry?.id === activeDocId)) return list;
  const active = (library || []).find((entry) => entry?.id === activeDocId);
  return active ? [active, ...list] : list;
}

export function brandHasContext(brand) {
  return styleKitHasContent(brand?.styleKit);
}
