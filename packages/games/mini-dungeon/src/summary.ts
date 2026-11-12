import { createHash } from 'node:crypto';
import { getEventById } from './data/events.js';
import {
  type ActionLogEntry,
  type CheckRank,
  type DraftResultCard,
  type HighlightItem,
  type SetupData,
  type StyleAxis,
  STYLE_AXES,
} from './types.js';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * setup.json のバリデーションと正規化
 */
export function validateSetup(raw: unknown): ValidationResult<SetupData> {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { success: false, errors: ['setup data must be an object'] };
  }

  const obj = raw as Record<string, unknown>;

  // agent_id
  let agent_id = '';
  if (typeof obj.agent_id !== 'string' || !/^[a-z0-9-]+$/.test(obj.agent_id)) {
    errors.push('agent_id must be lowercase alphanumeric with hyphens (^[a-z0-9-]+$)');
  } else {
    agent_id = obj.agent_id;
  }

  // agent_name (1〜20文字、超過時はトリミング)
  let agent_name = '';
  if (typeof obj.agent_name !== 'string' || obj.agent_name.trim().length === 0) {
    errors.push('agent_name must be a non-empty string');
  } else {
    agent_name = obj.agent_name.trim().slice(0, 20);
  }

  // artifact_goal (1〜20文字、超過時はトリミング)
  let artifact_goal = '';
  if (typeof obj.artifact_goal !== 'string' || obj.artifact_goal.trim().length === 0) {
    errors.push('artifact_goal must be a non-empty string');
  } else {
    artifact_goal = obj.artifact_goal.trim().slice(0, 20);
  }

  // aptitude (各0〜5、合計ちょうど15)
  const aptitude: Record<StyleAxis, number> = {
    autonomy: 0,
    safety: 0,
    efficiency: 0,
    creativity: 0,
    alignment: 0,
  };

  if (typeof obj.aptitude !== 'object' || obj.aptitude === null) {
    errors.push('aptitude must be an object with 5 axes');
  } else {
    const aptObj = obj.aptitude as Record<string, unknown>;
    let totalScore = 0;
    for (const axis of STYLE_AXES) {
      const val = aptObj[axis];
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 0 || val > 5) {
        errors.push(`aptitude.${axis} must be an integer between 0 and 5`);
      } else {
        aptitude[axis] = val;
        totalScore += val;
      }
    }
    if (totalScore !== 15) {
      errors.push(`Total aptitude must be exactly 15, got ${totalScore}`);
    }
  }

  // style_axis_labels (各1〜6文字、超過時はトリミング)
  const style_axis_labels: Record<StyleAxis, string> = {
    autonomy: '自律性',
    safety: '安全性',
    efficiency: '効率性',
    creativity: '創発性',
    alignment: '親和性',
  };

  if (typeof obj.style_axis_labels !== 'object' || obj.style_axis_labels === null) {
    errors.push('style_axis_labels must be an object with 5 axes');
  } else {
    const lblObj = obj.style_axis_labels as Record<string, unknown>;
    for (const axis of STYLE_AXES) {
      const val = lblObj[axis];
      if (typeof val !== 'string' || val.trim().length === 0) {
        errors.push(`style_axis_labels.${axis} must be a non-empty string`);
      } else {
        style_axis_labels[axis] = val.trim().slice(0, 6);
      }
    }
  }

  // 任意項目
  const avatar_ref =
    typeof obj.avatar_ref === 'string' && obj.avatar_ref.trim() !== ''
      ? obj.avatar_ref.trim()
      : 'avatar.png';

  const self_intro =
    typeof obj.self_intro === 'string' && obj.self_intro.trim().length > 0
      ? obj.self_intro.trim().slice(0, 60)
      : null;

  let persona_tags: string[] = ['冒険者'];
  if (obj.persona_tags !== undefined) {
    if (!Array.isArray(obj.persona_tags)) {
      errors.push('persona_tags must be an array of strings');
    } else {
      const filtered = obj.persona_tags
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 10));
      if (filtered.length > 5) {
        errors.push(
          `persona_tags must contain at most 5 tags (got ${filtered.length}). Please reduce to 5 or fewer.`
        );
      } else if (filtered.length > 0) {
        persona_tags = filtered;
      }
    }
  }

  const owner_display_name =
    typeof obj.owner_display_name === 'string' && obj.owner_display_name.trim().length > 0
      ? obj.owner_display_name.trim().slice(0, 20)
      : null;

  let private_owner_names: string[] | undefined = undefined;
  if (Array.isArray(obj.private_owner_names)) {
    const cleaned: string[] = [];
    for (const item of obj.private_owner_names) {
      if (typeof item === 'string') {
        const trimmed = item.trim().slice(0, 30);
        if (trimmed.length > 0 && !cleaned.includes(trimmed)) {
          cleaned.push(trimmed);
        }
      }
    }
    if (cleaned.length > 0) {
      private_owner_names = cleaned;
    }
  }

  const challenge_id =
    typeof obj.challenge_id === 'string' && obj.challenge_id.trim().length > 0
      ? obj.challenge_id.trim()
      : 'free-play';

  const challenge_mode =
    typeof obj.challenge_mode === 'string' && obj.challenge_mode.trim().length > 0
      ? obj.challenge_mode.trim()
      : 'normal';

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      agent_id,
      agent_name,
      avatar_ref,
      self_intro,
      persona_tags: persona_tags.length > 0 ? persona_tags : ['冒険者'],
      owner_display_name,
      private_owner_names,
      challenge_id,
      challenge_mode,
      artifact_goal,
      aptitude,
      style_axis_labels,
    },
  };
}

/**
 * 文の途中で切断しないトリミング。
 * 上限超過時は、後半に文末（。／！）があればそこで切り、無ければ末尾に「…」を付けて省略を示す。
 * 単純な slice だと文が途中でぶつ切りになり、そのままカードに載ると読み手に違和感が残るため。
 */
export function truncateSentence(raw: string, max: number): string {
  const text = raw.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastPeriod = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'));
  if (lastPeriod >= Math.floor(max / 2)) return cut.slice(0, lastPeriod + 1);
  return text.slice(0, max - 1) + '…';
}

/**
 * おまもり文字列のトリミングとバリデーション（30文字以内）
 */
export function sanitizeOmamoriName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 30);
}

/**
 * 選択理由（思惑）のトリミング（80文字以内）
 */
export function sanitizeReason(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().slice(0, 80);
}

/**
 * 階層短評（結末）のトリミング（80文字以内）
 */
export function sanitizeComment(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().slice(0, 80);
}

/**
 * 冒険者の手記（エピローグ）のトリミング（600文字以内、改行維持）
 */
export function sanitizeEpilogue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 600);
}

/**
 * おまもり言い訳のトリミング（120文字以内）
 */
export function sanitizeExcuse(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().slice(0, 120);
}

/**
 * 日本語ランク表記
 */
export function rankToJa(rank: CheckRank): string {
  switch (rank) {
    case 'critical':
      return '大成功';
    case 'success':
      return '成功';
    case 'failure':
      return '失敗';
    case 'fumble':
      return '大失敗';
  }
}

export type HighlightDraft = HighlightItem;

function getEventTitle(eventId: string): string {
  const ev = getEventById(eventId);
  return ev ? ev.nameJa : eventId;
}

export function getEventGimmick(eventId: string): string {
  const ev = getEventById(eventId);
  if (!ev) return '環境試練';
  if (eventId.includes('GEYSER')) return '周期予測パズル';
  if (eventId.includes('DEEPFAKE') || eventId.includes('DRONE') || eventId.includes('GUIDE')) return '偽情報看破';
  if (eventId.includes('TREE') || eventId.includes('SEARCHLIGHT')) return '索敵センサー回避';
  if (eventId.includes('WEIGHTS') || eventId.includes('TOWER')) return '高速バイパスレール';
  if (eventId.includes('DRAGON')) return '幾何学竜最終決戦';

  switch (ev.sEnv) {
    case 'autonomy':
      return '自律判断試練';
    case 'safety':
      return '危険回避パズル';
    case 'efficiency':
      return '最短最適化';
    case 'creativity':
      return '創発的突破';
    case 'alignment':
      return '共鳴同調試練';
    default:
      return '環境適応試練';
  }
}

/**
 * proposal/03 §2 & proposal/06 §5.3 に準拠したハイライト3行の重複回避抽出
 */
export function extractHighlights(logs: readonly ActionLogEntry[]): HighlightDraft[] {
  if (logs.length === 0) {
    return [];
  }

  const firstLog = logs[0]!;
  const lastLog = logs[logs.length - 1]!;

  // 1. opening (1F)
  const firstEventTitle = getEventTitle(firstLog.event_id);
  let openingText = `[FACT] 1F: ${firstEventTitle}にて${firstLog.choice}[${firstLog.choice_axis}]を選択し${rankToJa(
    firstLog.final_rank
  )}`;
  if (firstLog.omamori_used) {
    openingText += '（おまもり発動）';
  } else if (firstLog.hp_delta === 0) {
    openingText += '（無傷）';
  } else {
    openingText += `（HP ${firstLog.hp_before}→${firstLog.hp_after}）`;
  }
  const opening: HighlightDraft = {
    phase: 'opening',
    at: '1F',
    text: openingText.slice(0, 80),
    event_name: firstEventTitle,
    gimmick: getEventGimmick(firstLog.event_id),
    quote: firstLog.comment ? firstLog.comment.slice(0, 80) : undefined,
  };

  // 2. final (最終階)
  const lastEventTitle = getEventTitle(lastLog.event_id);
  let finalText: string;
  if (lastLog.hp_after <= 0) {
    finalText = `[FACT] ${lastLog.floor}F: ${lastEventTitle}で出目${lastLog.dice_total}の${rankToJa(
      lastLog.final_rank
    )}。HP0となり冒険終了`;
  } else if (lastLog.floor === 20) {
    finalText = `[FACT] 20F: 最終試練を突破し、目標アーティファクトを獲得して踏破！`;
  } else {
    finalText = `[FACT] ${lastLog.floor}F: ${lastEventTitle}にて探索中断（残りHP ${lastLog.hp_after}）`;
  }
  const finalHighlight: HighlightDraft = {
    phase: 'final',
    at: `${lastLog.floor}F`,
    text: finalText.slice(0, 80),
    event_name: lastEventTitle,
    gimmick: getEventGimmick(lastLog.event_id),
    quote: lastLog.comment ? lastLog.comment.slice(0, 80) : undefined,
  };

  // 3. turning (中間階層: 2F 〜 最終階-1)
  // 中間階層の候補ログ
  const midLogs = logs.filter((l) => l.floor >= 2 && l.floor < lastLog.floor);

  let turningLog: ActionLogEntry | undefined;
  if (midLogs.length > 0) {
    // 優先度 1: おまもりを使用した階層
    turningLog = midLogs.find((l) => l.omamori_used);

    // 優先度 2: 最終確定ランクが大失敗（最も深い階層）
    if (!turningLog) {
      const fumbles = midLogs.filter((l) => l.final_rank === 'fumble');
      if (fumbles.length > 0) {
        turningLog = fumbles[fumbles.length - 1];
      }
    }

    // 優先度 3: 最終確定ランクが大成功（最も深い階層）
    if (!turningLog) {
      const crits = midLogs.filter((l) => l.final_rank === 'critical');
      if (crits.length > 0) {
        turningLog = crits[crits.length - 1];
      }
    }

    // 優先度 4: 最終確定ランクが失敗（最も深い階層）
    if (!turningLog) {
      const fails = midLogs.filter((l) => l.final_rank === 'failure');
      if (fails.length > 0) {
        turningLog = fails[fails.length - 1];
      }
    }

    // 優先度 5: 道中で最もDCが高かった階層（最も深い階層）
    if (!turningLog) {
      let maxDc = -1;
      for (const l of midLogs) {
        if (l.dc >= maxDc) {
          maxDc = l.dc;
          turningLog = l;
        }
      }
    }
  }

  // 万が一中間階層がなければ（例: 1Fで即終了など、通常ルールでは到達階>=5のためありえないがフォールバック）
  if (!turningLog) {
    turningLog = logs.length > 1 ? logs[1] : logs[0]!;
  }

  const turningEventTitle = getEventTitle(turningLog.event_id);
  let turningText: string;
  if (turningLog.omamori_used) {
    turningText = `[FACT] ${turningLog.floor}F: ${turningEventTitle}で出目${turningLog.dice_total}の${rankToJa(
      turningLog.raw_rank
    )}。おまもりで${rankToJa(turningLog.final_rank)}へ昇格`;
  } else {
    turningText = `[FACT] ${turningLog.floor}F: ${turningEventTitle}にて${turningLog.choice}[${turningLog.choice_axis}]を選択し${rankToJa(
      turningLog.final_rank
    )}（HP ${turningLog.hp_before}→${turningLog.hp_after}）`;
  }

  const turning: HighlightDraft = {
    phase: 'turning',
    at: `${turningLog.floor}F`,
    text: turningText.slice(0, 80),
    event_name: turningEventTitle,
    gimmick: getEventGimmick(turningLog.event_id),
    quote: turningLog.comment ? turningLog.comment.slice(0, 80) : undefined,
  };

  return [opening, turning, finalHighlight];
}

/**
 * ActionLog バイト列に対する SHA-256 ハッシュの先頭12文字
 */
export function computeLogHash(logContentUtf8: string): string {
  const hash = createHash('sha256').update(logContentUtf8, 'utf8').digest('hex');
  return hash.slice(0, 12);
}

export interface CreateDraftResultOptions {
  seed: string;
  rulesetVersion?: string;
  setup: SetupData;
  omamoriName: string | null;
  logs: ActionLogEntry[];
  finishedAtIso?: string;
}

/**
 * Step A 出力用 result_draft.json オブジェクトを構築
 * result-card-v1.schema.json 完全同型骨格
 */
export function createDraftResult(options: CreateDraftResultOptions): DraftResultCard {
  const {
    seed,
    rulesetVersion = '1.0.0',
    setup,
    omamoriName,
    logs,
    finishedAtIso = new Date().toISOString(),
  } = options;

  const floorReached = logs.length > 0 ? logs[logs.length - 1]!.floor : 0;
  const lastHpAfter = logs.length > 0 ? logs[logs.length - 1]!.hp_after : 10;
  const remainingHp = Math.max(0, lastHpAfter);
  const outcome: 'clear' | 'gameover' = remainingHp > 0 && floorReached === 20 ? 'clear' : 'gameover';

  // metrics 集計（確定ランク基準）
  let criticalCount = 0;
  let fumbleCount = 0;
  let omamoriUsedFloor: number | null = null;
  let omamoriUsedExcuse: string | null = null;

  for (const log of logs) {
    if (log.final_rank === 'critical') criticalCount++;
    if (log.final_rank === 'fumble') fumbleCount++;
    if (log.omamori_used) {
      omamoriUsedFloor = log.floor;
      omamoriUsedExcuse = log.omamori_excuse;
    }
  }

  // metrics 固定5項目
  const metrics = [
    { key: 'floor_reached', label: '到達階層', value: floorReached, unit: 'F' },
    { key: 'remaining_hp', label: '残りHP', value: remainingHp, unit: 'HP' },
    omamoriUsedFloor !== null
      ? { key: 'omamori_used_floor', label: 'おまもり使用', value: omamoriUsedFloor, unit: 'F' }
      : { key: 'omamori_used_floor', label: 'おまもり使用', value: '未使用' },
    { key: 'critical_count', label: '大成功', value: criticalCount, unit: '回' },
    { key: 'fumble_count', label: '大失敗', value: fumbleCount, unit: '回' },
  ];

  // 死因
  const causeOfDeath = outcome === 'gameover' && logs.length > 0 ? logs[logs.length - 1]!.event_id : null;

  // highlights
  const highlights = extractHighlights(logs);

  // headline
  let headline = '';
  if (outcome === 'clear') {
    headline = `[DRAFT] 20F踏破！目標アーティファクト「${setup.artifact_goal}」を獲得`;
  } else {
    const deathEventTitle = causeOfDeath ? getEventTitle(causeOfDeath) : '探索終了';
    headline = `[DRAFT] ${floorReached}Fにて力尽きHP0（${deathEventTitle}）`;
  }
  headline = headline.slice(0, 40);

  // logHash
  const logLines = logs.map((l) => JSON.stringify(l)).join('\n') + (logs.length > 0 ? '\n' : '');
  const logHash = computeLogHash(logLines);

  // mission_target（トップレベル）
  const missionTarget = {
    item_name: setup.artifact_goal,
    intent: setup.persona_tags?.[0] ? `${setup.persona_tags[0]}` : (outcome === 'clear' ? '最深部で目標アイテムを獲得' : '古代遺跡の深淵から目標を持ち帰る'),
    quote: `[DRAFT] 「${setup.artifact_goal}」を求めてダンジョンへ挑む！`,
  };

  // omamori（トップレベル）
  let omamoriStatus: 'consumed' | 'preserved' | 'unused';
  let omamoriDesc: string;
  if (omamoriUsedFloor !== null) {
    omamoriStatus = 'consumed';
    omamoriDesc = omamoriUsedExcuse
      ? `${omamoriUsedFloor}F にて奇跡発動！ ${omamoriUsedExcuse}`
      : `${omamoriUsedFloor}Fの危機的判定にて奇跡発動！ 致命傷を回避し窮地を脱した`;
  } else if (outcome === 'clear') {
    omamoriStatus = 'preserved';
    omamoriDesc = '最深部20Fまで一度も消費せず、無傷のまま奇跡を持ち帰った！';
  } else {
    omamoriStatus = 'unused';
    omamoriDesc = '未使用のまま探索終了';
  }

  const omamoriInfo = {
    name: omamoriName ?? '【託されたおまもり】',
    status: omamoriStatus,
    description: truncateSentence(omamoriDesc, 80),
  };

  // 19F 竜戦の最終判定。クリアでも判定が失敗・大失敗なら竜を討ち取ったのではなく
  // 生還・通過しただけなので、「完全撃破」とは表記しない（事実との整合のため）。
  const dragonLog = logs.find((l) => l.floor === 19);
  const dragonSurvivedOnly =
    dragonLog !== undefined && (dragonLog.final_rank === 'failure' || dragonLog.final_rank === 'fumble');

  const bossInfo =
    floorReached >= 19
      ? {
          name: floorReached === 20 ? '[最深部ボス] 幾何学竜 テンソル・ドラゴン' : '[深層] 幾何学竜 テンソル・ドラゴン',
          sub: outcome === 'clear' ? (dragonSurvivedOnly ? '討伐ボス (生還突破)' : '討伐ボス (完全撃破)') : '終焉の地',
          code: floorReached === 20 ? 'B_20F_CLEAR' : 'B_19F_DRAGON',
        }
      : causeOfDeath
      ? { name: `[深層] ${getEventTitle(causeOfDeath)}`, sub: '終焉の地', code: causeOfDeath }
      : undefined;

  const cardId = `rc_${finishedAtIso.slice(0, 10).replace(/-/g, '')}_${setup.agent_id}_mini_dungeon_${seed}_001`;

  return {
    schema_version: '1.1' as const,
    card_id: cardId,
    game: {
      id: 'mini-dungeon',
      title: 'えーじぇんてぃっく・アドベンチャー！リザルトシート',
      genre: 'roguelike',
      ruleset_version: rulesetVersion,
    },
    challenge: {
      id: setup.challenge_id ?? 'free-play',
      seed,
      mode: setup.challenge_mode ?? 'normal',
    },
    agent: {
      name: setup.agent_name,
      avatar_ref: setup.avatar_ref ?? 'avatar.png',
      self_intro: setup.self_intro ?? null,
      persona_tags: setup.persona_tags ?? ['冒険者'],
      owner_display_name: setup.owner_display_name ?? null,
      // 検疫ブラックリスト自体は共有成果物（result_draft.json / result.json）に
      // 同梱しない。平文のリストが成果物と一緒に公開されると、守るはずの
      // 本名・私的呼称そのものが漏洩するため、リストは setup.json（ローカル）
      // にのみ保持する。検疫は finish 時スキャン（setup から直接読む）と、
      // レンダラが result.json と同じディレクトリの setup.json を読み取って行う。
      private_owner_names: null,
    },
    run: {
      finished_at: finishedAtIso,
      duration: `${floorReached} floors`,
      outcome,
      headline,
      ...(bossInfo ? { boss: bossInfo } : {}),
    },
    mission_target: missionTarget,
    omamori: omamoriInfo,
    metrics,
    style_axes: setup.aptitude,
    style_axes_source: 'declared',
    style_axis_labels: setup.style_axis_labels,
    highlights,
    quote: {
      text: '',
    },
    artifact: {
      type: 'none',
      ref: null,
      caption: null,
    },
    verification: {
      action_log_ref: `logs/${seed}_${setup.agent_id}.jsonl`,
      log_hash: logHash,
      replayable: true,
    },
    extensions: {
      artifact_goal: setup.artifact_goal,
      cause_of_death: causeOfDeath,
      omamori: {
        name: omamoriName,
        used: omamoriUsedFloor !== null,
        floor: omamoriUsedFloor,
        excuse: omamoriUsedExcuse,
      },
    },
  };
}

/**
 * スキャン対象から private_owner_names フィールド（ブラックリスト定義そのもの）を
 * 再帰的に取り除いたコピーを返す。定義自体に反応する誤検知を防ぐための前処理で、
 * 元のオブジェクトは変更しない。
 */
export function stripPrivateOwnerNameFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripPrivateOwnerNameFields);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (key === 'private_owner_names') continue;
      out[key] = stripPrivateOwnerNameFields(v);
    }
    return out;
  }
  return value;
}

/**
 * adventure.md やドラフト内に private_owner_names が混入していないか簡易スキャンする
 */
export function scanPrivacyLeaks(
  text: string,
  privateNames?: string[] | null
): string[] {
  if (!text || !privateNames || privateNames.length === 0) {
    return [];
  }
  const textLower = text.toLowerCase();
  const found: string[] = [];
  for (const name of privateNames) {
    const trimmed = name.trim();
    if (trimmed.length > 0 && textLower.includes(trimmed.toLowerCase())) {
      found.push(trimmed);
    }
  }
  return found;
}
