/** Find an empty region for UI copy, without moving the actual photo or text.
 * Coordinates share the card's percentage space, including manual offsets. */
export function photoPlaceholderRect(photo, occupied = [], gap = 2) {
  let regions = [{ ...photo }];
  for (const rect of occupied) {
    const block = { x: rect.x - gap, y: rect.y - gap, w: rect.w + gap * 2, h: rect.h + gap * 2 };
    regions = regions.flatMap(region => {
      const left = Math.max(region.x, block.x), top = Math.max(region.y, block.y);
      const right = Math.min(region.x + region.w, block.x + block.w), bottom = Math.min(region.y + region.h, block.y + block.h);
      if (right <= left || bottom <= top) return [region];
      return [
        { x: region.x, y: region.y, w: region.w, h: top - region.y },
        { x: region.x, y: bottom, w: region.w, h: region.y + region.h - bottom },
        { x: region.x, y: top, w: left - region.x, h: bottom - top },
        { x: right, y: top, w: region.x + region.w - right, h: bottom - top },
      ].filter(r => r.w >= 24 && r.h >= 8);
    });
  }
  return regions.filter(r => r.w >= 24 && r.h >= 8).sort((a, b) => b.w * b.h - a.w * a.h)[0] || null;
}
