import type { ResultCardData } from './types.js';

export function generateShareText(card: ResultCardData): string {
  const { game, challenge, agent, run, metrics, style_axes, style_axis_labels = {}, highlights, quote, verification } = card;

  // 1行目: ゲームとエージェント名
  const line1 = `【${game.title}】${agent.name} の冒険リザルト`;

  // 2行目: 結末と主要指標
  const floorMetric = metrics.find((m) => m.key === 'floor_reached');
  const hpMetric = metrics.find((m) => m.key === 'remaining_hp');
  const floorText = floorMetric ? `${floorMetric.value}F` : run.duration ?? '';
  const hpText = hpMetric ? `${hpMetric.value}HP` : '';
  const line2 = `結末: ${run.headline} (到達: ${floorText} / 残り: ${hpText})`;

  // 3行目: 作風5軸
  const axisOrder: (keyof typeof style_axes)[] = [
    'autonomy',
    'safety',
    'efficiency',
    'creativity',
    'alignment',
  ];
  const defaultLabels: Record<string, string> = {
    autonomy: '自律',
    safety: '安全',
    efficiency: '効率',
    creativity: '創発',
    alignment: '親和',
  };
  const axesFormatted = axisOrder
    .map((k) => {
      const lbl = style_axis_labels[k] || defaultLabels[k] || k;
      const val = style_axes[k];
      return `${lbl}[${val}]`;
    })
    .join(' ');
  const line3 = `作風: ${axesFormatted}`;

  // 4行目: 名場面（turning があればそれを優先、なければ final または opening）
  const turningHighlight =
    highlights.find((h) => h.phase === 'turning') ??
    highlights.find((h) => h.phase === 'final') ??
    highlights[0];
  const highlightText = turningHighlight ? turningHighlight.text.replace(/^\[FACT\]\s*/, '') : '';
  const line4 = `名場面: ${highlightText}`;

  // 5行目: 本人の一言
  const quoteText = quote.text && quote.text.trim().length > 0 ? quote.text.trim() : '（無言で佇んでいる）';
  const line5 = `一言: 「${quoteText}」`;

  // 6行目: シードと改竄防止ハッシュ
  const hashText = verification.log_hash ? verification.log_hash.slice(0, 12) : 'unverified';
  const line6 = `シード: ${challenge.seed} (ルール: ${game.ruleset_version} / 検証: ${hashText})`;

  // 7行目: ハッシュタグ
  const gameTag = game.id === 'mini-dungeon' ? '#え〜じぇんてぃっくアドベンチャー' : `#${game.id}`;
  const line7 = `#AIAgentArcade ${gameTag}`;

  return [line1, line2, line3, line4, line5, line6, line7].join('\n');
}
