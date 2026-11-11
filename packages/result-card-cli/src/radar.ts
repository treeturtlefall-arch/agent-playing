import type { StyleAxes, StyleAxisLabels } from './types.js';

interface AxisMeta {
  key: keyof StyleAxes;
  defaultName: string;
}

const AXIS_ORDER: AxisMeta[] = [
  { key: 'autonomy', defaultName: '自律性' },
  { key: 'safety', defaultName: '安全性' },
  { key: 'efficiency', defaultName: '効率性' },
  { key: 'creativity', defaultName: '創発性' },
  { key: 'alignment', defaultName: '親和性' },
];

const AXIS_COLORS: Record<keyof StyleAxes, string> = {
  autonomy: '#f43f5e', // スカーレット・朱赤（リスク追求・前線突破）
  safety: '#10b981',   // エメラルド・安全の緑（ガードレール・慎重防御）
  efficiency: '#38bdf8', // スカイシアン・冷静の青（最短最適化・ロジック）
  creativity: '#fbbf24', // アンバー・ひらめきの黄金（奇策・アイディア・美学）
  alignment: '#f472b6',  // サクラ・絆の桃色（感情・忠誠・仲間思い）
};

export interface RadarChartOptions {
  size?: number; // 互換用基準サイズ
  width?: number; // SVG viewBox 幅（デフォルト 390）
  height?: number | string; // SVG の height 属性（デフォルト 244）
  viewBoxHeight?: number; // SVG viewBox 高さ（デフォルト 244）
  radius?: number; // 最大半径（デフォルト 104）
  cx?: number; // 中心X（デフォルト 195）
  cy?: number; // 中心Y（デフォルト 142）
  labels?: StyleAxisLabels;
  labelDistance?: number;
  padX?: number;
  padY?: number;
  variant?: 'cyan' | 'rainbow' | 'A' | 'B' | 'C'; // cyan(デフォルト): 透明感のある水色・青色グラデーション＋鮮明なシアン枠線, rainbow: 内部アンビエントレインボー, A: 紫グロー, B: サイバーシアングロー, C: ワイヤーフレーム
  lineWidth?: number; // 枠線の太さ（デフォルト: 1.0）
  lineOpacity?: number; // 枠線の不透明度（デフォルト: 0.45）
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateRadarSvg(axes: StyleAxes, options?: RadarChartOptions): string {
  const vbWidth = options?.width ?? 390;
  const vbHeight = options?.viewBoxHeight ?? 244;
  const cx = options?.cx ?? vbWidth / 2;
  const cy = options?.cy ?? 142;
  const R = options?.radius ?? 104;
  const customLabels = options?.labels ?? {};
  const heightAttr = options?.height ?? 244;

  // 角度計算: 頂点0は上 (-90度)、時計回りに72度ずつ
  const angles = AXIS_ORDER.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

  // 1. グリッド同心五角形 (1〜5段階)
  const gridPolygons: string[] = [];
  for (let step = 1; step <= 5; step++) {
    const r = (R * step) / 5;
    const points = angles
      .map((theta) => {
        const x = cx + r * Math.cos(theta);
        const y = cy + r * Math.sin(theta);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    // 5段階目（外周）と3段階目（平均値ライン）を強調
    const strokeColor =
      step === 5
        ? 'rgba(255, 255, 255, 0.45)'
        : step === 3
        ? 'rgba(255, 255, 255, 0.24)'
        : 'rgba(255, 255, 255, 0.12)';
    const strokeWidth = step === 5 ? '1.6' : step === 3 ? '1.2' : '1';

    gridPolygons.push(
      `<polygon points="${points}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`
    );
  }

  // 2. 軸線
  const axisLines = angles
    .map((theta) => {
      const x = cx + R * Math.cos(theta);
      const y = cy + R * Math.sin(theta);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(
        1
      )}" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1" stroke-dasharray="2,2" />`;
    })
    .join('\n');

  // 3. データポリゴンと頂点マーカー
  const dataPoints: { x: number; y: number; val: number }[] = [];
  const polygonPointsStr = AXIS_ORDER.map((axis, i) => {
    const val = Math.max(0, Math.min(5, axes[axis.key] ?? 0));
    const r = (R * val) / 5;
    const theta = angles[i]!;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    dataPoints.push({ x, y, val });
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const markers = dataPoints
    .map((p, i) => {
      const axis = AXIS_ORDER[i]!;
      const markerColor = AXIS_COLORS[axis.key] ?? '#38bdf8';
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(
        1
      )}" r="5.0" fill="${markerColor}" stroke="#ffffff" stroke-width="1.8" />`;
    })
    .join('\n');

  // 4. ラベル (各頂点の外側・枠内最大化レイアウト)
  const labelElements = AXIS_ORDER.map((axis, i) => {
    const theta = angles[i]!;
    const val = Math.max(0, Math.min(5, axes[axis.key] ?? 0));
    const customLabel = customLabels[axis.key];
    const displayLabel = customLabel && customLabel.trim().length > 0 ? customLabel.trim() : axis.defaultName;
    const scoreColor = AXIS_COLORS[axis.key] ?? '#c084fc';

    const vx = cx + R * Math.cos(theta);
    const vy = cy + R * Math.sin(theta);

    let lx = vx;
    let ly = vy;
    let textAnchor = 'middle';
    let titleDy = -15;
    let valDy = 0;

    if (i === 0) {
      // 頂点0: 上 (autonomy) - 頂点マーカーの直上に配置
      lx = cx;
      ly = vy - 8;
      textAnchor = 'middle';
      titleDy = -15;
      valDy = 0;
    } else if (i === 1) {
      // 頂点1: 右上 (safety) - 頂点の右外側に配置
      lx = vx + 10;
      ly = vy - 4;
      textAnchor = 'start';
      titleDy = 0;
      valDy = 14;
    } else if (i === 2) {
      // 頂点2: 右下 (efficiency) - 頂点の右外側に配置（下方向のはみ出しを抑制）
      lx = vx + 10;
      ly = vy - 2;
      textAnchor = 'start';
      titleDy = 0;
      valDy = 14;
    } else if (i === 3) {
      // 頂点3: 左下 (creativity) - 頂点の左外側に配置
      lx = vx - 10;
      ly = vy - 2;
      textAnchor = 'end';
      titleDy = 0;
      valDy = 14;
    } else if (i === 4) {
      // 頂点4: 左上 (alignment) - 頂点の左外側に配置
      lx = vx - 10;
      ly = vy - 4;
      textAnchor = 'end';
      titleDy = 0;
      valDy = 14;
    }

    return `
      <g class="radar-label" transform="translate(${lx.toFixed(1)}, ${ly.toFixed(1)})">
        <text text-anchor="${textAnchor}" dy="${titleDy}" font-family="'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif" font-size="13.5" font-weight="800" fill="#f8fafc">
          ${escapeXml(displayLabel)}
        </text>
        <text text-anchor="${textAnchor}" dy="${valDy}" font-family="'JetBrains Mono', 'M PLUS Rounded 1c', monospace" font-size="12.5" font-weight="800" fill="${scoreColor}">
          ${val}/5
        </text>
      </g>
    `;
  }).join('\n');

  const variant = options?.variant ?? 'cyan';

  let defsHtml = '';
  let bodyContentHtml = '';

  if (variant === 'rainbow') {
    // rainbow: 内部アンビエントレインボー ＋ 単色ソリッドホワイト枠線（グローなし）
    const ambientDefs: string[] = [];
    const ambientRects: string[] = [];

    for (let i = 0; i < 5; i++) {
      const p = dataPoints[i]!;
      const color = AXIS_COLORS[AXIS_ORDER[i]!.key];
      const gradId = `radarAmbGrad${i}`;

      ambientDefs.push(`
        <radialGradient id="${gradId}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(R * 1.35).toFixed(1)}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.48" />
          <stop offset="45%" stop-color="${color}" stop-opacity="0.22" />
          <stop offset="85%" stop-color="${color}" stop-opacity="0.04" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0" />
        </radialGradient>
      `);

      ambientRects.push(
        `<rect x="0" y="0" width="${vbWidth}" height="${vbHeight}" fill="url(#${gradId})" style="mix-blend-mode: screen;" />`
      );
    }

    defsHtml = `
      <defs>
        <!-- 多角形内部だけにアンビエント光を閉じ込めるクリップパス -->
        <clipPath id="radarPolygonClip">
          <polygon points="${polygonPointsStr}" />
        </clipPath>
        <!-- 中心部のベースアンビエント -->
        <radialGradient id="centerBaseGrad" cx="${cx}" cy="${cy}" r="${R}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.05" />
        </radialGradient>
        ${ambientDefs.join('\n')}
      </defs>
    `;
    const strokeWidth = options?.lineWidth !== undefined ? options.lineWidth : 1.0;
    const strokeOpacity = options?.lineOpacity !== undefined ? options.lineOpacity : 0.45;
    const strokeAttr =
      strokeWidth <= 0
        ? 'stroke="none"'
        : `stroke="rgba(255, 255, 255, ${strokeOpacity})" stroke-width="${strokeWidth}"`;

    bodyContentHtml = `
      <!-- 多角形内部のアンビエントレインボー（内側限定・グローなし） -->
      <g clip-path="url(#radarPolygonClip)">
        <rect x="0" y="0" width="${vbWidth}" height="${vbHeight}" fill="url(#centerBaseGrad)" />
        ${ambientRects.join('\n')}
      </g>
      <!-- 外枠の線（極細ヘアラインで存在感を抑え、アンビエント光を引き立てる） -->
      <polygon points="${polygonPointsStr}" fill="none" ${strokeAttr} stroke-linejoin="round" />
      <!-- 頂点マーカードット -->
      <g class="radar-markers">${markers}</g>
    `;
  } else if (variant === 'B') {
    // B: 違う色（サイバーシアン）・グローあり
    defsHtml = `
      <defs>
        <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.65" />
          <stop offset="50%" stop-color="#0284c7" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#0369a1" stop-opacity="0.15" />
        </radialGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    `;
    bodyContentHtml = `
      <polygon points="${polygonPointsStr}" fill="url(#radarFillGrad)" stroke="#38bdf8" stroke-width="2.8" filter="url(#glow)" />
      <g class="radar-markers">${markers}</g>
    `;
  } else if (variant === 'C') {
    // C: 色もグローも無し（クリーン・ミニマルワイヤーフレーム）
    defsHtml = '';
    bodyContentHtml = `
      <polygon points="${polygonPointsStr}" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.75)" stroke-width="2.0" />
      <g class="radar-markers">${markers}</g>
    `;
  } else if (variant === 'A') {
    // A: 従来のパープルグロー
    defsHtml = `
      <defs>
        <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#c084fc" stop-opacity="0.7" />
          <stop offset="50%" stop-color="#a855f7" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0.2" />
        </radialGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    `;
    bodyContentHtml = `
      <polygon points="${polygonPointsStr}" fill="url(#radarFillGrad)" stroke="#c084fc" stroke-width="2.8" filter="url(#glow)" />
      <g class="radar-markers">${markers}</g>
    `;
  } else {
    // cyan (デフォルト): 内部は一定の透明度を持つ水色・青色 ＋ 鮮明なシアン枠線
    defsHtml = '';
    const strokeWidth = options?.lineWidth !== undefined ? options.lineWidth : 2.0;
    const strokeOpacity = options?.lineOpacity !== undefined ? options.lineOpacity : 0.95;

    bodyContentHtml = `
      <!-- 多角形内部の透明感ある水色・青色（一定の透明度） ＋ 鮮明なシアン枠線 -->
      <polygon points="${polygonPointsStr}" fill="rgba(56, 189, 248, 0.25)" stroke="rgba(56, 189, 248, ${strokeOpacity})" stroke-width="${strokeWidth}" stroke-linejoin="round" />
      <!-- 頂点マーカードット -->
      <g class="radar-markers">${markers}</g>
    `;
  }

  return `
    <svg viewBox="0 0 ${vbWidth} ${vbHeight}" width="100%" height="${heightAttr}" xmlns="http://www.w3.org/2000/svg" class="radar-chart-svg" role="img" aria-label="行動傾向レーダーチャート" style="overflow: visible; display: block;">
      <title>行動傾向レーダーチャート</title>
      ${defsHtml}
      <!-- 背景グリッド -->
      <g class="radar-grid">
        ${gridPolygons.join('\n')}
        ${axisLines}
      </g>
      <!-- データポリゴン＆エッジ -->
      ${bodyContentHtml}
      <!-- ラベル -->
      <g class="radar-labels">
        ${labelElements}
      </g>
    </svg>
  `.trim();
}
