import {
  type AptitudeMap,
  type Area,
  type CheckCalculation,
  type CheckRank,
  type ChoiceKey,
  type DungeonEvent,
  type DungeonFloor,
  type ResolvedFloorCheck,
  type StyleAxis,
} from './types.js';

export const MAX_HP = 10;
export const INITIAL_HP = 10;

/**
 * 実効素質（Effective Aptitude）を算出
 * proposal/01 §3.1: Weakest Link則
 * 道中は選んだ行動の素質と部屋の環境属性の素質の「低い方」にボトルネックされる
 */
export function getEffectiveAptitude(sActVal: number, sEnvVal?: number): number {
  if (sEnvVal !== undefined) {
    return Math.min(sActVal, sEnvVal);
  }
  return sActVal;
}

/**
 * 実効素質から補正値（Skill Modifier）を算出
 * proposal/01 §3.1 / §3.2
 * - 道中: s_eff - 3 (-3 〜 +2)
 * - ボス戦: 一律 +2 (魂の切り札覚醒)
 */
export function getSkillModifier(sEff: number, isBoss: boolean): number {
  if (isBoss) {
    return 2;
  }
  return sEff - 3;
}

export interface CalculateCheckOptions {
  floor: number;
  area: Area;
  dc: number;
  sEnv: StyleAxis | 'none';
  choiceAxis: StyleAxis;
  aptitude: AptitudeMap;
  dice: [number, number];
}

/**
 * 判定計算を行う（道中ボトルネックモデル・ボス魂の切り札覚醒モデル）
 */
export function calculateCheck(options: CalculateCheckOptions): CheckCalculation {
  const { floor, area, dc, sEnv, choiceAxis, aptitude, dice } = options;
  const dice_total = dice[0] + dice[1];
  const is_natural_critical = dice_total === 12;
  const is_natural_fumble = dice_total === 2;

  const s_act = aptitude[choiceAxis];
  const isBoss = area === 'boss' || floor >= 19;

  let s_eff = s_act;
  let skill_mod = 0;

  if (isBoss) {
    // ボス戦判定式（proposal/01 §3.2）:
    // 達成値 = 2d6 + 2 (弱点ペナルティなし)
    // どの選択肢を選んでも一律 +2 補正
    s_eff = s_act;
    skill_mod = getSkillModifier(s_eff, true);
  } else {
    // 道中判定式（proposal/01 §3.1）:
    // 実効素質 s_eff = min(s_act, s_env)
    // 達成値 = 2d6 + (s_eff - 3)
    const s_env_val = sEnv !== 'none' ? aptitude[sEnv] : undefined;
    s_eff = getEffectiveAptitude(s_act, s_env_val);
    skill_mod = getSkillModifier(s_eff, false);
  }

  const total_score = dice_total + skill_mod;
  const diff = total_score - dc;

  let raw_rank: CheckRank;
  if (is_natural_critical) {
    raw_rank = 'critical';
  } else if (is_natural_fumble) {
    raw_rank = 'fumble';
  } else {
    if (diff >= 3) {
      raw_rank = 'critical';
    } else if (diff >= 0) {
      raw_rank = 'success';
    } else if (diff >= -2) {
      raw_rank = 'failure';
    } else {
      raw_rank = 'fumble';
    }
  }

  return {
    dice,
    dice_total,
    is_natural_critical,
    is_natural_fumble,
    s_act,
    s_eff,
    skill_mod,
    total_score,
    dc,
    diff,
    raw_rank,
  };
}

/**
 * おまもりによる判定ランク+1昇格
 * proposal/01 §3.3
 */
export function upgradeRank(rank: CheckRank): CheckRank {
  switch (rank) {
    case 'fumble':
      return 'failure';
    case 'failure':
      return 'success';
    case 'success':
      return 'critical';
    case 'critical':
      throw new Error('Cannot upgrade already critical rank');
  }
}

/**
 * おまもりが使用可能か判定（大成功時は空撃ち防止のため不可）
 */
export function canUseOmamori(currentRank: CheckRank, alreadyUsed: boolean): boolean {
  if (alreadyUsed) return false;
  if (currentRank === 'critical') return false;
  return true;
}

/**
 * 判定ランクに応じたHP増減と新HPを計算（上限10・下限0、実効デルタ返却）
 */
export function applyRankToHp(currentHp: number, rank: CheckRank): { hpDelta: number; newHp: number } {
  let rankDelta: number;
  switch (rank) {
    case 'critical':
      rankDelta = 1;
      break;
    case 'success':
      rankDelta = 0;
      break;
    case 'failure':
      rankDelta = -1;
      break;
    case 'fumble':
      rankDelta = -2;
      break;
  }

  let newHp = currentHp + rankDelta;
  if (newHp > MAX_HP) {
    newHp = MAX_HP;
  }
  if (newHp < 0) {
    newHp = 0;
  }
  // 満タン時の大成功や瀕死時の大失敗でも hp_before + hp_delta === hp_after が常に成立する実効デルタ
  // （例: HP1で大失敗なら hp_delta は -2 ではなく -1 になり、HPは -1 ではなく 0 で止まる）
  const hpDelta = newHp - currentHp;
  return { hpDelta, newHp };
}

export interface OmamoriSuggestion {
  suggest: boolean;
  reason: string | null;
}

/**
 * おまもり発動の推奨判定（外部レビュー改善）
 * - 大失敗時（HP-2）
 * - または確定後のHPが2以下（瀕死・危険域）
 */
export function evaluateOmamoriSuggestion(
  currentRank: CheckRank,
  currentHp: number,
  hpDelta: number,
  canUse: boolean
): OmamoriSuggestion {
  if (!canUse) {
    return { suggest: false, reason: null };
  }
  const hpAfter = Math.max(0, currentHp + hpDelta);
  if (currentRank === 'fumble') {
    return {
      suggest: true,
      reason: '大失敗（HP-2）が発生しました。おまもりで失敗（HP-1）に引き上げて被害を軽減することを推奨します。',
    };
  }
  if (hpAfter <= 2) {
    return {
      suggest: true,
      reason: `確定後の残りHPが${hpAfter}となり瀕死・危険域に入ります。おまもりを発動して生き残ることを推奨します。`,
    };
  }
  return { suggest: false, reason: null };
}

