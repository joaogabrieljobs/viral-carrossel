import React from 'react';

/** Wrapper que reduz fontSize automaticamente quando o conteúdo transborda o
 *  container. Converge em 2-3 frames. Render-prop: children recebe o fontSize
 *  efetivo a aplicar no texto interno (que tem que aceitar prop fontSize).
 *
 *  Uso:
 *    <AutoFitText baseFontSize={20} deps={[text]} minScale={0.7}
 *                 wrapStyle={{ flex:'1 1 auto', minHeight:0 }}>
 *      {(fs) => <Paragraphs fontSize={fs} text={text} />}
 *    </AutoFitText> */
export default function AutoFitText({
  baseFontSize,
  minScale = 0.7,
  deps = [],
  wrapStyle,
  children,
}) {
  const wrapRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  // Reset ao trocar conteúdo / tamanho do canvas
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    setScale(1);
  }, deps);
  // Mede e reduz se transbordou — iteração converge em ≤3 renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const containerH = wrap.clientHeight;
    if (containerH <= 0) return;
    const contentH = inner.scrollHeight;
    if (contentH <= containerH + 1) return;
    const target = Math.max(minScale, scale * (containerH / contentH) * 0.985);
    if (target < scale - 0.003) setScale(target);
  }, [scale, baseFontSize, ...deps]);
  return (
    <div
      ref={wrapRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', ...wrapStyle }}
    >
      <div ref={innerRef}>{children(baseFontSize * scale)}</div>
    </div>
  );
}
