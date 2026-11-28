import React from 'react';
import { getElementOffset, clampOffsetPct } from '../../utils/card-elements.js';

/** Abaixo disto o gesto ainda é clique — abrir a foto, selecionar o card. */
const LIMIAR_ARRASTO_PX = 4;

/** Passo de ajuste fino no teclado, em pixels do card (independe do zoom do preview). */
export const PASSO_TECLADO_PX = 8;
export const PASSO_TECLADO_SHIFT_PX = 32;

const ROTULOS_ELEMENTO = {
  text: 'Bloco de texto',
  title: 'Título',
  subtitle: 'Subtítulo',
  bodyAfterImage: 'Texto abaixo da imagem',
  offer: 'Preço / oferta',
  photo: 'Foto',
  headerBar: 'Barra editorial',
  pageBadge: 'Contador de páginas',
  handleBadge: 'Identificação da marca',
  logo: 'Logo',
  star: 'Estrela',
  pill: 'Selo do rodapé',
  footerBar: 'Barra do rodapé',
};

/**
 * Traduz uma seta em delta de movimento. Exportado para o contrato ficar
 * verificável sem depender de um DOM: Shift acelera, mas continua a usar o
 * mesmo estado percentual do arrasto por ponteiro.
 */
export function deltaMovimentoTeclado(ev) {
  const passo = ev?.shiftKey ? PASSO_TECLADO_SHIFT_PX : PASSO_TECLADO_PX;
  if (ev?.key === 'ArrowLeft') return { dx: -passo, dy: 0 };
  if (ev?.key === 'ArrowRight') return { dx: passo, dy: 0 };
  if (ev?.key === 'ArrowUp') return { dx: 0, dy: -passo };
  if (ev?.key === 'ArrowDown') return { dx: 0, dy: passo };
  return null;
}

/**
 * O carrossel móvel escuta touchstart/touchend no ancestral para fazer swipe.
 * Isolar as quatro fases no alvo impede que arrastar um texto também troque de
 * card, inclusive em navegadores que emitem TouchEvent e PointerEvent juntos.
 */
export function isolarToqueDoElemento(ev) {
  ev?.stopPropagation?.();
}

/**
 * Pinça no celular (27/11): o primeiro dedo pousa num texto e começa a
 * arrastá-lo; quando o segundo chega, o gesto é zoom da tela. Quem está
 * arrastando se inscreve aqui e é cancelado — e volta à posição do início do
 * gesto — assim que há dois dedos na tela. O zoom escuta toque no próprio DOM,
 * então a escuta aqui também é no `window`, em captura.
 */
const aoSegundoDedo = new Set();
/** Dedos na tela, pelos eventos de ponteiro (chegam antes do `touchstart`). */
const dedos = new Set();
let escutandoDedos = false;
function cancelarArrastos() {
  [...aoSegundoDedo].forEach((cancelar) => cancelar());
}
function escutarSegundoDedo() {
  if (escutandoDedos || typeof window === 'undefined') return;
  escutandoDedos = true;
  window.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    dedos.add(ev.pointerId);
    if (dedos.size >= 2) cancelarArrastos();
  }, { capture: true, passive: true });
  const solta = (ev) => { dedos.delete(ev.pointerId); };
  window.addEventListener('pointerup', solta, { capture: true, passive: true });
  window.addEventListener('pointercancel', solta, { capture: true, passive: true });
  window.addEventListener('touchstart', (ev) => {
    if ((ev.touches?.length || 0) >= 2) cancelarArrastos();
  }, { capture: true, passive: true });
  window.addEventListener('touchend', (ev) => {
    if (!(ev.touches?.length)) dedos.clear();
  }, { capture: true, passive: true });
}
/** Escuta desde o carregamento: o primeiro dedo também precisa ser contado. */
if (typeof window !== 'undefined') escutarSegundoDedo();

function resumoAcessivel(slide, chave) {
  const campo = chave === 'title'
    ? slide?.title
    : chave === 'subtitle'
      ? slide?.subtitle
      : chave === 'bodyAfterImage'
        ? slide?.bodyAfterImage
        : '';
  const resumo = String(campo || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(/[.!?…]+$/, '');
  const rotulo = ROTULOS_ELEMENTO[chave] || 'Elemento';
  return resumo ? `${rotulo}: ${resumo}` : rotulo;
}

/**
 * Arrastar qualquer elemento do card com o rato ou o dedo.
 *
 * Devolve uma fábrica: `bind(chave)` produz as props a espalhar no elemento.
 * O clique só vira arrasto depois de {@link LIMIAR_ARRASTO_PX} — sem isso um
 * toque na zona da foto passaria a arrastar em vez de abrir o importador.
 *
 * `interactionScale` é o `transform: scale()` da pré-visualização. O ponteiro
 * anda em pixels de ecrã e o offset é em pixels do card (1080 de largura), por
 * isso todo delta é dividido pela escala — sem isso o elemento anda mais devagar
 * que o dedo, e quanto menor a miniatura pior fica.
 */
export function useElementDrag({ f, slide, onOffsetChange, enabled, interactionScale = 1 }) {
  const arrasto = React.useRef(null);
  const slideRef = React.useRef(slide);
  slideRef.current = slide;
  const onChangeRef = React.useRef(onOffsetChange);
  onChangeRef.current = onOffsetChange;

  const fim = React.useCallback((ev) => {
    const d = arrasto.current;
    arrasto.current = null;
    if (!d) return;
    if (d.cancelar) aoSegundoDedo.delete(d.cancelar);
    ev?.stopPropagation?.();
    try { ev?.currentTarget?.releasePointerCapture?.(d.pointerId); } catch { /* ignore */ }
    // Passou do limiar: engole o clique que o browser dispara a seguir, senão
    // soltar o título em cima da zona da foto abriria o seletor de imagem.
    if (d.moveu) {
      const engole = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', engole, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', engole, { capture: true }), 0);
    }
  }, []);

  const move = React.useCallback((ev) => {
    const d = arrasto.current;
    if (!d) return;
    ev.stopPropagation();
    const esc = Math.max(0.05, interactionScale || 1);
    // Acumula contra o offset capturado no pointerdown, NÃO contra o slide atual:
    // vários pointermove cabem entre dois renders, e reler o slide a cada um
    // fazia todos partirem do mesmo valor — o arrasto rápido perdia distância
    // (medido: 40px de gesto viravam 15px de deslocamento).
    d.totalX = (ev.clientX - d.startX) / esc;
    d.totalY = (ev.clientY - d.startY) / esc;
    if (!d.moveu && Math.abs(d.totalX) + Math.abs(d.totalY) < LIMIAR_ARRASTO_PX) return;
    d.moveu = true;
    if (ev.cancelable) ev.preventDefault();
    onChangeRef.current?.(d.chave, {
      x: clampOffsetPct(d.baseX + (d.totalX / f.w) * 100),
      y: clampOffsetPct(d.baseY + (d.totalY / f.h) * 100),
    });
  }, [f, interactionScale]);

  const moverComTeclado = React.useCallback((chave, ev) => {
    const delta = deltaMovimentoTeclado(ev);
    if (!delta) return;
    ev.preventDefault();
    ev.stopPropagation();
    const atual = getElementOffset(slideRef.current, chave);
    onChangeRef.current?.(chave, {
      x: clampOffsetPct(atual.x + (delta.dx / f.w) * 100),
      y: clampOffsetPct(atual.y + (delta.dy / f.h) * 100),
    });
  }, [f]);

  const bind = React.useCallback((chave) => {
    if (!enabled) return null;
    const nomeAcessivel = resumoAcessivel(slideRef.current, chave);
    return {
      onPointerDown: (ev) => {
        if (ev.button != null && ev.button !== 0) return;
        // Segundo dedo de uma pinça: é zoom da tela, não arrasto.
        if (ev.pointerType === 'touch' && dedos.size >= 2) return;
        ev.stopPropagation();
        const base = getElementOffset(slideRef.current, chave);
        const gesto = {
          chave, pointerId: ev.pointerId,
          startX: ev.clientX, startY: ev.clientY,
          baseX: base.x, baseY: base.y,
          totalX: 0, totalY: 0, moveu: false,
        };
        if (ev.pointerType === 'touch') {
          escutarSegundoDedo();
          gesto.cancelar = () => {
            aoSegundoDedo.delete(gesto.cancelar);
            if (arrasto.current !== gesto) return;
            arrasto.current = null;
            if (gesto.moveu) onChangeRef.current?.(chave, { x: base.x, y: base.y });
          };
          aoSegundoDedo.add(gesto.cancelar);
        }
        arrasto.current = gesto;
        try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
      },
      onPointerMove: move,
      onPointerUp: fim,
      onPointerCancel: fim,
      onLostPointerCapture: fim,
      // Não deixar estes eventos subirem para o swipe horizontal do card.
      // Não chamamos preventDefault no início/fim: um toque curto na foto ainda
      // precisa produzir click e abrir o importador.
      onTouchStart: isolarToqueDoElemento,
      onTouchMove: (ev) => {
        isolarToqueDoElemento(ev);
        if (ev.cancelable) ev.preventDefault();
      },
      onTouchEnd: isolarToqueDoElemento,
      onTouchCancel: isolarToqueDoElemento,
      onKeyDown: (ev) => moverComTeclado(chave, ev),
      tabIndex: 0,
      draggable: false,
      'aria-label': `${nomeAcessivel}. Elemento móvel. Use as setas para mover; segure Shift para mover mais rápido.`,
      'aria-keyshortcuts': 'ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight',
      title: `${nomeAcessivel} — use as setas para mover`,
      style: {
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        outlineOffset: 4,
      },
    };
  }, [enabled, move, fim, moverComTeclado]);

  return bind;
}

export { LIMIAR_ARRASTO_PX };
