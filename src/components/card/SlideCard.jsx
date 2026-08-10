// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React from 'react';
import { SlideCardInner } from './SlideCardInner.jsx';

// Memoiza SlideCard: re-renderiza apenas quando suas props relevantes mudam.
// Isso é crítico no desktop, onde até 10 slides são renderizados simultaneamente.
const SlideCard = React.memo(SlideCardInner, (prev, next) => {
  if (prev.fmt !== next.fmt) return false;
  if (prev.num !== next.num || prev.total !== next.total || prev.scale !== next.scale) return false;
  if (prev.brand !== next.brand) return false;
  if (prev.slide !== next.slide) return false;
  if (prev.presentationImgFilter !== next.presentationImgFilter) return false;
  if (prev.creativePreset !== next.creativePreset) return false;
  if (prev.showCanvasChrome !== next.showCanvasChrome) return false;
  if (prev.enableZoneSwapDrag !== next.enableZoneSwapDrag) return false;
  if (prev.slideIndex !== next.slideIndex) return false;
  if (prev.onCanvasZonePatch !== next.onCanvasZonePatch) return false;
  if (prev.onPhotoZoneRequest !== next.onPhotoZoneRequest) return false;
  if (prev.onPhotoZoneNativeFile !== next.onPhotoZoneNativeFile) return false;
  if (prev.movableElements !== next.movableElements) return false;
  if (prev.onElementOffsetChange !== next.onElementOffsetChange) return false;
  return true;
});

export {
  SlideCard,
};
