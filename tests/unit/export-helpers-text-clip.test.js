import { describe, it, expect } from 'vitest';
import { vcFixHtml2CanvasTextClip } from '../../src/utils/export-helpers.js';

/**
 * Mini DOM sem jsdom: só o que vcFixHtml2CanvasTextClip lê via getComputedStyle.
 */
function makeFakeDoc() {
  const styles = new WeakMap();

  function el(tag, initial = {}) {
    const node = {
      tagName: tag.toUpperCase(),
      style: {},
      children: [],
      parentElement: null,
      textContent: '',
      appendChild(child) {
        child.parentElement = node;
        node.children.push(child);
        return child;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          if (sel === '*' || (sel === 'h1' && n.tagName === 'H1')) out.push(n);
          n.children.forEach(walk);
        };
        walk(node);
        if (sel === 'h1') return out.filter((n) => n.tagName === 'H1');
        return out;
      },
    };
    styles.set(node, { ...initial });
    return node;
  }

  const root = el('div', {
    position: 'relative',
    overflow: 'hidden',
    display: 'block',
    backdropFilter: 'none',
    webkitBackdropFilter: 'none',
    backgroundColor: 'transparent',
    paddingTop: '0px',
    paddingBottom: '0px',
    top: 'auto',
    left: 'auto',
    fontSize: '16px',
    lineHeight: 'normal',
  });

  const zone = el('div', {
    position: 'absolute',
    top: '0px',
    left: '0px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backdropFilter: 'none',
    webkitBackdropFilter: 'none',
    backgroundColor: 'transparent',
    paddingTop: '0px',
    paddingBottom: '0px',
    fontSize: '16px',
    lineHeight: 'normal',
  });

  const glass = el('div', {
    position: 'static',
    top: 'auto',
    left: 'auto',
    display: 'inline-flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
    webkitBackdropFilter: 'blur(8px)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingTop: '8px',
    paddingBottom: '8px',
    fontSize: '16px',
    lineHeight: 'normal',
  });

  const h1 = el('h1', {
    position: 'relative',
    top: '12px',
    left: 'auto',
    display: 'block',
    flexDirection: 'row',
    overflow: 'visible',
    backdropFilter: 'none',
    webkitBackdropFilter: 'none',
    backgroundColor: 'transparent',
    paddingTop: '0px',
    paddingBottom: '0px',
    fontSize: '72px',
    lineHeight: '1.05',
  });

  glass.appendChild(h1);
  zone.appendChild(glass);
  root.appendChild(zone);

  const doc = {
    defaultView: {
      getComputedStyle(node) {
        const base = styles.get(node) || {};
        // Inline style overrides (como no browser após el.style.X = ...)
        return {
          ...base,
          backdropFilter: node.style.backdropFilter || base.backdropFilter,
          webkitBackdropFilter: node.style.webkitBackdropFilter || base.webkitBackdropFilter,
          overflow: node.style.overflow || base.overflow,
          paddingTop: node.style.paddingTop || base.paddingTop,
          paddingBottom: node.style.paddingBottom || base.paddingBottom,
          top: node.style.top || base.top,
          position: node.style.position || base.position,
          display: node.style.display || base.display,
          flexDirection: node.style.flexDirection || base.flexDirection,
          backgroundColor: node.style.backgroundColor || base.backgroundColor,
          fontSize: node.style.fontSize || base.fontSize,
          lineHeight: node.style.lineHeight || base.lineHeight,
          left: node.style.left || base.left,
        };
      },
    },
  };

  return { doc, root, zone, glass, h1 };
}

describe('vcFixHtml2CanvasTextClip', () => {
  it('remove backdrop-filter e abre overflow nas zonas de texto', () => {
    const { doc, root, zone, glass, h1 } = makeFakeDoc();
    vcFixHtml2CanvasTextClip(doc, root);

    expect(glass.style.backdropFilter).toBe('none');
    expect(glass.style.webkitBackdropFilter).toBe('none');
    expect(zone.style.overflow).toBe('visible');
    expect(h1.style.top).toBe('0');
    expect(parseFloat(h1.style.paddingTop)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(glass.style.paddingTop)).toBeGreaterThanOrEqual(14);
  });
});
