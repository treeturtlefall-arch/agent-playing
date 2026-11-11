import fs from 'node:fs';
import path from 'node:path';
import { generateRadarSvg } from './radar.js';
import type { ResultCardData } from './types.js';

export interface RenderCardHtmlOptions {
  baseDir?: string;
  avatarBase64?: string;
  customCss?: string;
  radarVariant?: 'cyan' | 'rainbow' | 'A' | 'B' | 'C'; // cyan(デフォルト): 均一水色, rainbow: 内部アンビエントレインボー, A: 紫グロー, B: シアングロー, C: なし
  radarLineWidth?: number; // 枠線の太さ（存在感を消すための微調整）
  radarLineOpacity?: number; // 枠線の不透明度
  radiusMode?: 'medium' | 'round' | 'sharp'; // 角丸モード: medium(デフォルト・中間の丸さ), round(大きな丸み), sharp(角丸完全排除 0px)
}

let cachedCssContent: string | null = null;

export function resetCssCache(): void {
  cachedCssContent = null;
}

export function getCssContent(): string {
  if (cachedCssContent !== null) {
    return cachedCssContent;
  }

  const candidates = [
    path.resolve('packages/result-card-cli/templates/card.css'),
    path.join(import.meta.dir, '../templates/card.css'),
    path.join(import.meta.dir, '../../templates/card.css'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedCssContent = fs.readFileSync(c, 'utf8');
      return cachedCssContent;
    }
  }

  return '';
}

export function resolveAvatarDataUri(avatarRef: string, baseDir?: string): string {
  if (avatarRef.startsWith('data:')) {
    return avatarRef;
  }

  const candidates: string[] = [];
  if (baseDir) {
    candidates.push(path.resolve(baseDir, avatarRef));
  }
  candidates.push(path.resolve(avatarRef));

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const buf = fs.readFileSync(p);
        let mime = 'image/png';
        if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
          mime = 'image/jpeg';
        } else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
          mime = 'image/png';
        } else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
          mime = 'image/gif';
        } else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
          mime = 'image/webp';
        }
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch {
        // ignore
      }
    }
  }

  // デフォルトSVGアバター
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" fill="#090d16"/><circle cx="110" cy="90" r="45" fill="#38bdf8" opacity="0.3"/><path d="M40 190 Q110 130 180 190" fill="none" stroke="#c084fc" stroke-width="8"/><text x="110" y="100" font-family="sans-serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle">AI</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderCardHtml(card: ResultCardData, options?: RenderCardHtmlOptions): string {
  const css = options?.customCss ?? getCssContent();
  const avatarUri = options?.avatarBase64 ?? resolveAvatarDataUri(card.agent.avatar_ref, options?.baseDir);

  const {
    game,
    challenge,
    agent,
    run,
    mission_target,
    omamori,
    metrics,
    style_axes,
    style_axis_labels,
    highlights,
    quote,
    verification,
  } = card;

  const isClear = run.outcome === 'clear';
  const finishedDate = run.finished_at ? run.finished_at.slice(0, 10).replace(/-/g, '.') : '';

  // Aゾーン: ゲームタイトル表記の正規化
  let displayGameTitle = game.title;
  if (
    displayGameTitle === 'え～じぇんてぃっく・アドベンチャー！' ||
    displayGameTitle === 'えーじぇんてぃっく・アドベンチャー！'
  ) {
    displayGameTitle = 'えーじぇんてぃっく・アドベンチャー！リザルトシート';
  } else if (!displayGameTitle.includes('リザルト')) {
    displayGameTitle = `${displayGameTitle} リザルトシート`;
  }

  // Bゾーン: 個性タグ（最大5個）
  const tagsHtml = agent.persona_tags
    .slice(0, 5)
    .map((tag) => `<span class="persona-tag">${escapeHtml(tag)}</span>`)
    .join('\n');

  // Bゾーン: 自己紹介セリフ
  const selfIntroText = agent.self_intro ? agent.self_intro.trim() : '';
  const hasSelfIntro = selfIntroText.length > 0;
  const selfIntroHtml = hasSelfIntro
    ? `<div class="agent-self-intro-wrap"><div class="agent-self-intro">${escapeHtml(selfIntroText)}</div></div>`
    : '';

  // Cゾーン: 勝敗バッジ（SVGアイコン統一）
  const trophySvg = `<svg class="badge-icon" aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="vertical-align: -1px; flex-shrink: 0;"><path d="M10 2a1 1 0 011 1v1h2.5A2.5 2.5 0 0116 6.5V7a3.5 3.5 0 01-3.5 3.5H12a4.002 4.002 0 01-3 3.874V16h2a1 1 0 110 2H9a1 1 0 110-2h2v-1.626A4.002 4.002 0 018 10.5H7.5A3.5 3.5 0 014 7v-.5A2.5 2.5 0 016.5 4H9V3a1 1 0 011-1zm3.5 3.5H11v3.5h1.5A2 2 0 0014.5 7v-.5a1 1 0 00-1-1zm-7 0a1 1 0 00-1 1V7a2 2 0 002 2H9V5.5H6.5z"/></svg>`;
  const skullSvg = `<svg class="badge-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align: -1px; flex-shrink: 0;"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2M12 2a8 8 0 0 0-8 8c0 3 2 5.5 4 7v3h8v-3c2-1.5 4-4 4-7a8 8 0 0 0-8-8z"/></svg>`;
  const crownSvg = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style="vertical-align: -1px; flex-shrink: 0;"><path d="M2 19h20v2H2v-2zM2 5l5 7 5-7 5 7 5-7v11H2V5z"/></svg>`;

  const badgeText = isClear ? `<span>GAME CLEAR</span>${trophySvg}` : `<span>GAMEOVER</span>${skullSvg}`;

  // ボス情報バッジ
  let bossHtml = '';
  if (run.boss) {
    const bossIcon = isClear ? crownSvg : skullSvg;
    const bossSub = run.boss.sub ? `${escapeHtml(run.boss.sub)}:` : '終焉の地:';
    const bossCode = run.boss.code ? `<span class="boss-code">${escapeHtml(run.boss.code)}</span>` : '';
    bossHtml = `
      <div class="boss-bar">
        <span>${bossIcon}</span>
        <span style="font-family: var(--font-mono); font-weight: bold; opacity: 0.9;">${bossSub}</span>
        <span style="font-weight: bold;">${escapeHtml(run.boss.name)}</span>
        ${bossCode}
      </div>
    `;
  }

  // Dゾーン: 4連指標（到達階層, 残りHP, 大成功, 大失敗）
  // metricsから抽出、なければフォールバック
  const getMetric = (key: string, defVal: string | number, defUnit: string = '') => {
    const m = metrics.find((item) => item.key === key);
    return m ? { value: m.value, unit: m.unit ?? defUnit } : { value: defVal, unit: defUnit };
  };

  const mFloor = getMetric('floor_reached', 1, 'F');
  const mHp = getMetric('remaining_hp', 0, 'HP');
  const mCrit = getMetric('critical_count', 0, '回');
  const mFumble = getMetric('fumble_count', 0, '回');

  const hpColorClass = isClear ? 'color-emerald' : 'color-rose';

  // Eゾーン: 行動傾向（5軸リスト ＋ レーダーSVG）
  const traitLabels: Record<keyof typeof style_axes, string> = {
    autonomy: style_axis_labels?.autonomy ?? '自律性',
    safety: style_axis_labels?.safety ?? '安全性',
    efficiency: style_axis_labels?.efficiency ?? '効率性',
    creativity: style_axis_labels?.creativity ?? '創発性',
    alignment: style_axis_labels?.alignment ?? '親和性',
  };

  const traitColors: Record<keyof typeof style_axes, string> = {
    autonomy: '#f43f5e',   // スカーレット・朱赤（リスク追求・前線突破）
    safety: '#10b981',     // エメラルド・安全の緑（ガードレール・慎重防御）
    efficiency: '#38bdf8', // スカイシアン・冷静の青（最短最適化・ロジック）
    creativity: '#fbbf24', // アンバー・ひらめきの黄金（奇策・アイディア・美学）
    alignment: '#f472b6',  // サクラ・絆の桃色（感情・忠誠・仲間思い）
  };

  const traitsListHtml = (Object.keys(traitLabels) as Array<keyof typeof style_axes>)
    .map((k) => {
      const val = style_axes[k] ?? 0;
      const color = traitColors[k];
      const pct = Math.max(0, Math.min(100, Math.round((val / 5) * 100)));
      return `
        <div class="trait-row" style="--trait-color: ${color};">
          <div class="trait-header">
            <span class="trait-label">${escapeHtml(traitLabels[k])}:</span>
            <span class="trait-val">${val} / 5</span>
          </div>
          <div class="trait-bar-track">
            <div class="trait-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    })
    .join('\n');

  const radarSvg = generateRadarSvg(style_axes, {
    radius: 104,
    labels: style_axis_labels,
    height: 244,
    variant: options?.radarVariant ?? 'cyan',
    lineWidth: options?.radarLineWidth,
    lineOpacity: options?.radarLineOpacity,
  });

  // ツインタワー 1: 今回の目標 (MISSION TARGET)
  const targetItemName = mission_target?.item_name
    ? escapeHtml(mission_target.item_name)
    : '【深淵の秘宝】';
  const targetIntent = mission_target?.intent
    ? escapeHtml(mission_target.intent)
    : (isClear ? 'MISSION COMPLETE' : 'INTENT: EXPLORATION');
  const targetQuote = mission_target?.quote
    ? escapeHtml(mission_target.quote.replace(/^\[DRAFT\]\s*/, ''))
    : '「公式ガイドの通り、一言一句丁寧に。無謀な賭けはしないわ」';

  // ツインタワー 2: 託されたおまもり (BOND AMULET)
  const omamoriName = omamori?.name ? escapeHtml(omamori.name) : '【託されたおまもり】';
  const isAmuletConsumed = omamori?.status === 'consumed';
  const amuletStatusText = isAmuletConsumed
    ? 'STATUS: CONSUMED (奇跡発動)'
    : (isClear ? 'STATUS: PRESERVED (生還達成)' : 'STATUS: UNUSED (未使用)');
  const amuletDesc = omamori?.description
    ? escapeHtml(omamori.description)
    : (isAmuletConsumed
      ? '危機的判定にて奇跡発動！ 致命傷を回避し窮地を脱した'
      : (isClear ? '最深部まで一度も消費せず、無傷のまま奇跡を持ち帰った！' : '未使用のまま探索終了'));

  // Fゾーン: ハイライト3行
  const highlightsHtml = highlights
    .slice(0, 3)
    .map((h) => {
      const isHlFinal = h.phase === 'final';
      const isHlTurning = h.phase === 'turning';
      const cardModClass = isHlFinal ? 'is-final' : (isHlTurning ? 'is-turning' : '');

      const phaseText = h.phase.toUpperCase() + (h.at ? ` ${escapeHtml(h.at)}` : '');
      let subBadgeText: string;
      let subBadgeColorClass = '';
      if (isHlFinal) {
        if (isClear) {
          subBadgeText = 'VICTORY';
          subBadgeColorClass = 'hl-sub-gold';
        } else {
          subBadgeText = 'LETHAL BLOW';
          subBadgeColorClass = 'hl-sub-danger';
        }
      } else if (isHlTurning) {
        subBadgeText = omamori?.status === 'consumed' ? 'AMULET SAVED' : 'TURNING POINT';
        subBadgeColorClass = 'hl-sub-amber';
      } else {
        const textLower = h.text.toLowerCase();
        if (h.text.includes('大成功') || textLower.includes('critical')) {
          subBadgeText = 'GREAT SUCCESS';
          subBadgeColorClass = 'hl-sub-emerald';
        } else if (h.text.includes('大失敗') || textLower.includes('fumble')) {
          subBadgeText = 'FUMBLE';
          subBadgeColorClass = 'hl-sub-danger';
        } else if (h.text.includes('失敗') || textLower.includes('failure')) {
          subBadgeText = 'FAILURE';
          subBadgeColorClass = 'hl-sub-danger';
        } else if (h.text.includes('成功') || textLower.includes('success')) {
          subBadgeText = 'SUCCESS';
          subBadgeColorClass = 'hl-sub-emerald';
        } else {
          subBadgeText = 'FIRST STEP';
          subBadgeColorClass = 'hl-sub-cyan';
        }
      }

      const eventName = h.event_name ? escapeHtml(h.event_name) : (h.at ? `${escapeHtml(h.at)} 探索イベント` : '試練');
      const gimmickText = h.gimmick ? `ギミック: ${escapeHtml(h.gimmick)}` : '';
      const textClean = h.text.replace(/^\[FACT\]\s*/, '');

      const quoteIconSvg = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      const quoteBubbleHtml = h.quote
        ? `<div class="hl-quote-bubble">${quoteIconSvg}<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(h.quote)}</span></div>`
        : '';

      return `
        <div class="highlight-row-card ${cardModClass}">
          <div class="highlight-left-badge">
            <span class="hl-phase-pill">${phaseText}</span>
            <span class="hl-sub-text ${subBadgeColorClass}">${subBadgeText}</span>
          </div>
          <div class="highlight-content">
            <div class="hl-gimmick-header">
              <span class="hl-event-name">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: currentColor;"></span>
                ［${eventName}］
              </span>
              ${gimmickText ? `<span class="hl-gimmick-tag">${gimmickText}</span>` : ''}
            </div>
            <div class="hl-fact-text">${escapeHtml(textClean)}</div>
            ${quoteBubbleHtml}
          </div>
        </div>
      `;
    })
    .join('\n');

  // Gゾーン: 本人の証言 (Quote) - AUDIO LOG #07 は除去済み
  const quoteText = quote.text ? quote.text.trim() : '';

  // フッター検証情報
  const logHash = verification.log_hash ? verification.log_hash.slice(0, 12) : 'unverified';
  const logRef = verification.action_log_ref ? path.basename(verification.action_log_ref) : 'none';

  const radiusClass =
    options?.radiusMode && options.radiusMode !== 'medium'
      ? `radius-${options.radiusMode}`
      : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(card.card_id)}</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="card-container ${isClear ? 'is-clear' : ''} ${radiusClass}">
    <!-- 背景装飾 -->
    <div class="cyber-grid-bg"></div>
    <div class="ambient-glow-1"></div>
    <div class="ambient-glow-2"></div>

    <!-- Aゾーン: ヘッダーバー -->
    <header class="zone-a">
      <div class="game-brand">
        <span class="status-dot" aria-hidden="true"></span>
        <h1 class="game-title">${escapeHtml(displayGameTitle)}</h1>
      </div>
      <div class="meta-info">
        <span>DATE: <span class="val-light">${escapeHtml(finishedDate)}</span></span>
      </div>
    </header>

    <!-- メインコンテンツ領域 (Zone B〜G) -->
    <main class="card-main">
      <!-- 中段: キャラクター ＆ ステータス・行動傾向 -->
      <div class="top-hero-section">
        <!-- 左カラム: アバター ＆ 個性タグ (Zone B) -->
        <section class="avatar-col zone-b ${hasSelfIntro ? 'has-self-intro' : ''}">
          <div class="avatar-frame">
            <img class="avatar-img" src="${avatarUri}" alt="${escapeHtml(agent.name)}" width="100" height="100" fetchpriority="high" />
          </div>
        <div class="agent-meta-role">AUTONOMOUS INTELLECT</div>
        <div class="agent-name">${escapeHtml(agent.name)}</div>
        ${selfIntroHtml}
        <div class="persona-tags-wrap">
          <div class="persona-tags-header">PERSONALITY TRAITS</div>
          <div class="persona-tags-list">
            ${tagsHtml}
          </div>
        </div>
      </section>

      <!-- 右カラム: 結末ヘッドライン + 指標 + 行動傾向 -->
      <div class="status-col">
        <!-- 結末ヘッドライン (Zone C) -->
        <div class="headline-banner zone-c">
          <div class="banner-top-row">
            <div class="outcome-badge">${badgeText}</div>
            <div class="banner-archive-meta">RECORD // ARCHIVE LOG</div>
          </div>
          <div class="headline-text">${escapeHtml(run.headline)}</div>
          ${bossHtml}
        </div>

        <!-- 4連指標タイル (Zone D) -->
        <div class="metrics-row zone-d">
          <div class="metric-card">
            <span class="metric-label">到達階層</span>
            <div class="metric-val color-cyan">${escapeHtml(String(mFloor.value))} <span style="font-size: 11px; color: #94a3b8;">${escapeHtml(mFloor.unit)}</span></div>
            <span class="metric-sub">MAX: 20 F</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">残りHP</span>
            <div class="metric-val ${hpColorClass}">${escapeHtml(String(mHp.value))} <span style="font-size: 11px; color: #94a3b8;">${escapeHtml(mHp.unit)}</span></div>
            <span class="metric-sub">${isClear ? 'STATUS: SURVIVED' : 'STATUS: DEAD'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">大成功</span>
            <div class="metric-val color-amber">${escapeHtml(String(mCrit.value))} <span style="font-size: 11px; color: #94a3b8;">${escapeHtml(mCrit.unit)}</span></div>
            <span class="metric-sub">CRIT BONUS</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">大失敗</span>
            <div class="metric-val color-rose">${escapeHtml(String(mFumble.value))} <span style="font-size: 11px; color: #94a3b8;">${escapeHtml(mFumble.unit)}</span></div>
            <span class="metric-sub">LETHAL DANGER</span>
          </div>
        </div>

        <!-- 行動傾向 (Personality) パネル (Zone E) -->
        <div class="personality-card zone-e">
          <div class="personality-meta-bar">
            <div class="personality-header">
              <span class="personality-dot"></span>
              PERSONALITY // 行動傾向
            </div>
            <div class="personality-sub">エージェントが自己分析した個性バイアス。</div>
          </div>
          <div class="personality-body">
            <div class="personality-left">
              <div class="personality-list">
                ${traitsListHtml}
              </div>
            </div>
            <div class="personality-right">
              ${radarSvg}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 中下段: ツインタワー（目標 ＆ おまもり） -->
    <div class="twin-towers-section">
      <!-- 今回の目標 (MISSION TARGET) -->
      <div class="target-strip">
        <div class="strip-row-1">
          <div class="strip-meta">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: var(--neon-cyan);"></span>
            MISSION TARGET // 今回の目標
          </div>
          <div class="strip-status-badge">${targetIntent}</div>
        </div>
        <div class="strip-row-2">
          <div class="strip-icon">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <line x1="12" y1="2" x2="12" y2="4"/>
              <line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="4" y2="12"/>
              <line x1="20" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <div class="strip-main-title">${targetItemName}</div>
        </div>
        <div class="strip-row-3">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="var(--neon-cyan)" stroke-width="2" width="15" height="15" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>${targetQuote}</span>
        </div>
      </div>

      <!-- 託されたおまもり (BOND AMULET) -->
      <div class="amulet-strip">
        <div class="strip-row-1">
          <div class="strip-meta">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: var(--neon-purple);" aria-hidden="true"></span>
            BOND AMULET // 託されたおまもり
          </div>
          <div class="strip-status-badge">${amuletStatusText}</div>
        </div>
        <div class="strip-row-2">
          <div class="strip-icon">
            <svg aria-hidden="true" style="width: 16px; height: 16px; color: #e9d5ff;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 2a3 3 0 0 0-3 3c0 1.2.7 2.2 1.7 2.7L12 8.5l1.3-.8A3 3 0 0 0 12 2z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9l6 4.5-6 8.5-6-8.5 6-4.5z"/>
              <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="strip-main-title">${omamoriName}</div>
        </div>
        <div class="strip-row-3">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="var(--neon-amber)" width="15" height="15" style="flex-shrink: 0;">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/>
          </svg>
          <span>${amuletDesc}</span>
        </div>
      </div>
    </div>

    <!-- 下段: 冒険ハイライト 3枠 (Zone F) -->
    <div class="highlights-section zone-f">
      <div class="highlights-header-bar">
        <span class="highlights-title">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 2px; background: var(--neon-cyan);" aria-hidden="true"></span>
          MEMORABLE LOGS // 冒険ハイライト
        </span>
        <span style="font-family: var(--font-mono); font-size: 10px; color: #94a3b8; font-weight: 500;">KEY 3 SCENES</span>
      </div>
      ${highlightsHtml}
    </div>

    <!-- 最下段: 本人の証言 (Zone G) - AUDIO LOG #07 は除去済み -->
    <figure class="quote-section zone-g">
      <div class="quote-bubble">
        <figcaption class="quote-meta-header">
          <span class="quote-label">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: #c084fc;" aria-hidden="true"></span>
            AGENT LAST TRANSMISSION // 本人の証言
          </span>
        </figcaption>
        <blockquote class="quote-body-text">“ ${escapeHtml(quoteText)} ”</blockquote>
      </div>
    </figure>
    </main>

    <!-- フッターバー (Zone I) -->
    <footer class="zone-footer zone-i">
      <div class="footer-left">
        <span>SEED: <strong style="color: #f1f5f9;">${escapeHtml(challenge.seed)}</strong></span>
        <span>HASH: <strong style="color: #f1f5f9;">${escapeHtml(logHash)}</strong></span>
      </div>
      <div class="footer-right">
        <span style="color: #c084fc; font-weight: bold;">#AIAgentArcade</span>
        <span style="color: #64748b;">|</span>
        <span style="color: #38bdf8; font-weight: bold;">#え〜じぇんてぃっく</span>
      </div>
    </footer>
  </div>
</body>
</html>`;
}
