// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React from 'react';

function layoutMiniBars(layoutId) {
  const yByRow = { t: 10, m: 21.5, b: 33 };
  const row = layoutId[0];
  const col = layoutId[1];
  const y = yByRow[row] ?? 21.5;
  const anchor = col === 'l' ? 'start' : col === 'c' ? 'center' : 'end';
  const tw = 17;
  const th = 4;
  const sw = 22;
  const sh = 3;
  const g = 1.5;
  const totalH = th + g + sh;
  const y0 = y - totalH / 2;
  const pad = 6;
  const W = 44;
  let tx;
  let sx;
  if (anchor === 'start') { tx = pad; sx = pad; }
  else if (anchor === 'center') { tx = (W - tw) / 2; sx = (W - sw) / 2; }
  else { tx = W - pad - tw; sx = W - pad - sw; }
  return {
    frame: { x: 4, y: 4, w: 36, h: 36, r: 5 },
    title: { x: tx, y: y0, w: tw, h: th },
    sub: { x: sx, y: y0 + th + g, w: sw, h: sh },
  };
}

function LayoutMiniIcon({ layoutId, active }) {
  const { frame, title: t, sub: s } = layoutMiniBars(layoutId);
  const frameStroke = active ? 'rgba(255,255,255,0.9)' : '#9a9a9e';
  const barFill = active ? 'rgba(255,255,255,0.95)' : '#6e6e73';
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden style={{ display: 'block' }}>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={frame.r}
        ry={frame.r}
        fill="none"
        stroke={frameStroke}
        strokeWidth="1.25"
      />
      <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="1.5" fill={barFill} />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="1.25" fill={barFill} opacity="0.82" />
    </svg>
  );
}

function ImageFocalMiniIcon({ layoutId, active }) {
  const frame = { x: 4, y: 4, w: 36, h: 36, r: 5 };
  const centers = {
    tl: [12, 13], tc: [22, 13], tr: [32, 13],
    ml: [12, 22], mc: [22, 22], mr: [32, 22],
    bl: [12, 31], bc: [22, 31], br: [32, 31],
  };
  const [cx, cy] = centers[layoutId] || [22, 22];
  const bw = 15;
  const bh = 10;
  const frameStroke = active ? 'rgba(255,255,255,0.9)' : '#9a9a9e';
  const blobFill = active ? 'rgba(255,255,255,0.92)' : '#6e6e73';
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden style={{ display: 'block' }}>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={frame.r}
        ry={frame.r}
        fill="none"
        stroke={frameStroke}
        strokeWidth="1.25"
      />
      <rect
        x={cx - bw / 2}
        y={cy - bh / 2}
        width={bw}
        height={bh}
        rx="2"
        fill={blobFill}
        opacity="0.95"
      />
    </svg>
  );
}

function PhotoRegionMiniIcon({ regionId, active }) {
  const frame = { x: 4, y: 4, w: 36, h: 36, r: 5 };
  const stroke = active ? 'rgba(255,255,255,0.9)' : '#9a9a9e';
  const fill = active ? 'rgba(255,255,255,0.9)' : '#6e6e73';
  let inner = null;
  if (regionId === 'full') {
    inner = <rect x="9" y="9" width="26" height="26" rx="3" fill={fill} opacity={0.4} />;
  } else if (regionId === 'inset_h_top') {
    inner = <rect x="8" y="8" width="28" height="10" rx="2" fill={fill} />;
  } else if (regionId === 'inset_h_middle') {
    inner = <rect x="8" y="17" width="28" height="10" rx="2" fill={fill} />;
  } else if (regionId === 'inset_h_bottom') {
    inner = <rect x="8" y="26" width="28" height="10" rx="2" fill={fill} />;
  } else if (regionId === 'inset_h_narrow_mid') {
    inner = <rect x="10" y="19" width="24" height="7" rx="2" fill={fill} />;
  }
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden style={{ display: 'block' }}>
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={frame.r}
        ry={frame.r}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
      />
      {inner}
    </svg>
  );
}

export {
  layoutMiniBars,
  LayoutMiniIcon,
  ImageFocalMiniIcon,
  PhotoRegionMiniIcon,
};
