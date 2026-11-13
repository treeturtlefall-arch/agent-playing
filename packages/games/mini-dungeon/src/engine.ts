import { generateDungeon } from './generator.js';
import { shouldTriggerCompanionAssist, validateGuestAgent } from './guest.js';
import {
  applyRankToHp,
  calculateCheck,
  canUseOmamori,
  INITIAL_HP,
  MAX_HP,
  upgradeRank,
} from './mechanics.js';
import { createFloorPRNG, type PRNG } from './prng.js';
import { sanitizeComment, sanitizeExcuse, sanitizeReason, validateSetup } from './summary.js';
import {
  type ActionLogEntry,
  type ChoiceKey,
  type ChoiceOption,
  type DungeonFloor,
  type GuestAgentData,
  type ResolvedFloorCheck,
  type SetupData,
} from './types.js';

export interface DungeonRunState {
  seed: string;
  rulesetVersion: string;
  setup: SetupData;
  omamoriName: string | null;
  omamoriUsed: boolean;
  omamoriUsedFloor: number | null;
  omamoriUsedExcuse: string | null;
  guest?: GuestAgentData | null;
  companionAssisted?: boolean;
  companionAssistFloor?: number | null;
  currentFloor: number;
  currentHp: number;
  isFinished: boolean;
  floors: DungeonFloor[];
  logs: ActionLogEntry[];
}

export interface InitRunOptions {
  seed: string;
  setup: SetupData;
  omamoriName?: string | null;
  guest?: GuestAgentData | null;
  rulesetVersion?: string;
  skipValidation?: boolean;
}

export function initRun(options: InitRunOptions): DungeonRunState {
  const {
    seed,
    setup,
    omamoriName = null,
    guest = null,
    rulesetVersion = '1.0.0',
    skipValidation = false,
  } = options;

  if (!seed || typeof seed !== 'string' || seed.trim().length === 0) {
    throw new Error('Seed must be a non-empty string');
  }

  let validatedSetup = setup;
  let validatedGuest = guest;
  if (!skipValidation) {
    // 多層防御: エンジン層でも setup.json の整合性を検証
    const setupValidation = validateSetup(setup);
    if (!setupValidation.success || !setupValidation.data) {
      throw new Error(`Invalid setup data: ${setupValidation.errors?.join(', ')}`);
    }
    validatedSetup = setupValidation.data;

    if (guest) {
      const guestValidation = validateGuestAgent(guest);
      if (!guestValidation.success || !guestValidation.data) {
        throw new Error(`Invalid guest data: ${guestValidation.errors?.join(', ')}`);
      }
      validatedGuest = guestValidation.data;
    }
  }

  const floors = generateDungeon(seed.trim(), rulesetVersion);

  return {
    seed: seed.trim(),
    rulesetVersion,
    setup: validatedSetup,
    omamoriName,
    omamoriUsed: false,
    omamoriUsedFloor: null,
    omamoriUsedExcuse: null,
    ...(validatedGuest
      ? {
          guest: validatedGuest,
          companionAssisted: false,
          companionAssistFloor: null,
        }
      : {}),
    currentFloor: 1,
    currentHp: INITIAL_HP,
    isFinished: false,
    floors,
    logs: [],
  };
}

export function getCurrentFloor(state: DungeonRunState): DungeonFloor | null {
  if (state.isFinished || state.currentFloor < 1 || state.currentFloor > 20) {
    return null;
  }
  return state.floors[state.currentFloor - 1]!;
}

export interface ResolveFloorCheckOptions {
  floor: DungeonFloor;
  choiceKey: ChoiceKey;
  seed: string;
  rulesetVersion?: string;
  currentHp: number;
  aptitude: SetupData['aptitude'];
  companionAssist?: boolean;
  reason?: string;
}

/**
 * フロアと選択肢に対する判定計算（保留状態の純粋生成）
 */
export function resolveFloorCheck(options: ResolveFloorCheckOptions): ResolvedFloorCheck {
  const {
    floor,
    choiceKey,
    seed,
    rulesetVersion = '1.0.0',
    currentHp,
    aptitude,
    companionAssist = false,
    reason,
  } = options;
  const choice = floor.event.choices.find((c) => c.key === choiceKey);
  if (!choice) {
    throw new Error(
      `Invalid choice key '${choiceKey}' for floor ${floor.floor} (event: ${floor.event.id})`
    );
  }

  const prng = createFloorPRNG(seed, floor.floor, rulesetVersion);
  const { die1, die2 } = prng.roll2d6();

  const calc = calculateCheck({
    floor: floor.floor,
    area: floor.area,
    dc: floor.dc,
    sEnv: floor.event.sEnv,
    choiceAxis: choice.axis,
    aptitude,
    dice: [die1, die2],
    companionAssist,
  });

  const { hpDelta, newHp } = applyRankToHp(currentHp, calc.raw_rank);
  const sanitizedReason = reason ? sanitizeReason(reason) : undefined;

  return {
    floor: floor.floor,
    event: floor.event,
    choice: choice.key,
    choice_axis: choice.axis,
    calc,
    ...(companionAssist ? { companion_assisted: true } : {}),
    omamori_used: false,
    omamori_excuse: null,
    final_rank: calc.raw_rank,
    hp_before: currentHp,
    hp_delta: hpDelta,
    hp_after: newHp,
    ...(sanitizedReason ? { reason: sanitizedReason } : {}),
  };
}

/**
 * 保留判定へのおまもり適用（純粋関数）
 */
export function applyOmamoriToCheck(
  resolved: ResolvedFloorCheck,
  omamoriName: string | null,
  alreadyUsed: boolean,
  excuseText: string
): ResolvedFloorCheck {
  if (omamoriName === null) {
    throw new Error('No omamori possessed');
  }
  if (!canUseOmamori(resolved.final_rank, alreadyUsed || resolved.omamori_used)) {
    throw new Error(
      `Cannot use omamori: alreadyUsed=${alreadyUsed || resolved.omamori_used}, currentRank=${
        resolved.final_rank
      }`
    );
  }

  const upgradedRank = upgradeRank(resolved.final_rank);
  const { hpDelta, newHp } = applyRankToHp(resolved.hp_before, upgradedRank);
  const sanitized = sanitizeExcuse(excuseText);

  return {
    ...resolved,
    omamori_used: true,
    omamori_excuse: sanitized,
    final_rank: upgradedRank,
    hp_delta: hpDelta,
    hp_after: newHp,
  };
}

/**
 * 確定時のログエントリ生成（純粋関数）
 */
export function createActionLogEntry(
  floor: DungeonFloor,
  resolved: ResolvedFloorCheck,
  commentText = ''
): ActionLogEntry {
  const comment = sanitizeComment(commentText);
  return {
    floor: resolved.floor,
    area: floor.area,
    event_id: floor.event.id,
    dc: floor.dc,
    s_env: floor.event.sEnv,
    choice: resolved.choice,
    choice_axis: resolved.choice_axis,
    s_act: resolved.calc.s_act,
    s_eff: resolved.calc.s_eff,
    ...(resolved.companion_assisted ? { companion_assisted: true } : {}),
    dice: resolved.calc.dice,
    dice_total: resolved.calc.dice_total,
    skill_mod: resolved.calc.skill_mod,
    total_score: resolved.calc.total_score,
    diff: resolved.calc.diff,
    raw_rank: resolved.calc.raw_rank,
    omamori_used: resolved.omamori_used,
    omamori_excuse: resolved.omamori_excuse,
    final_rank: resolved.final_rank,
    hp_before: resolved.hp_before,
    hp_delta: resolved.hp_delta,
    hp_after: resolved.hp_after,
    ...(resolved.reason ? { reason: resolved.reason } : {}),
    comment,
  };
}

/**
 * 階層の選択肢に対する出目ロールと判定計算（保留状態の生成）
 * 階層ダイスは常に対話プレイ・自動シミュレーション共通の独立ストリーム先頭から引く
 */
export function resolveChoice(
  state: DungeonRunState,
  choiceKey: ChoiceKey
): ResolvedFloorCheck {
  const floor = getCurrentFloor(state);
  if (!floor) {
    throw new Error(`Cannot resolve choice: run is already finished or invalid floor ${state.currentFloor}`);
  }

  const companionAssist = shouldTriggerCompanionAssist(
    floor,
    state.guest,
    Boolean(state.companionAssisted)
  );

  return resolveFloorCheck({
    floor,
    choiceKey,
    seed: state.seed,
    rulesetVersion: state.rulesetVersion,
    currentHp: state.currentHp,
    aptitude: state.setup.aptitude,
    companionAssist,
  });
}

/**
 * 保留中の判定におまもりを適用して+1段階昇格
 */
export function applyOmamori(
  state: DungeonRunState,
  resolved: ResolvedFloorCheck,
  excuseText: string
): ResolvedFloorCheck {
  return applyOmamoriToCheck(
    resolved,
    state.omamoriName,
    state.omamoriUsed,
    excuseText
  );
}

/**
 * 判定を確定し、HP変動と行動ログを記録して次階層へ進行
 */
export function commitFloor(
  state: DungeonRunState,
  resolved: ResolvedFloorCheck,
  commentText = ''
): ActionLogEntry {
  const floor = getCurrentFloor(state);
  if (!floor || floor.floor !== resolved.floor) {
    throw new Error(
      `Mismatched floor for commit: state floor ${state.currentFloor}, resolved floor ${resolved.floor}`
    );
  }

  // 状態整合性ガード: 保留結果の hp_before と現在の HP が一致しているか検証
  if (resolved.hp_before !== state.currentHp) {
    throw new Error(
      `State inconsistency: resolved.hp_before (${resolved.hp_before}) does not match state.currentHp (${state.currentHp})`
    );
  }

  const logEntry = createActionLogEntry(floor, resolved, commentText);

  state.logs.push(logEntry);
  state.currentHp = resolved.hp_after;

  if (resolved.companion_assisted) {
    state.companionAssisted = true;
    state.companionAssistFloor = resolved.floor;
  }

  if (resolved.omamori_used) {
    state.omamoriUsed = true;
    state.omamoriUsedFloor = resolved.floor;
    state.omamoriUsedExcuse = resolved.omamori_excuse;
  }

  // 終了判定
  if (state.currentHp <= 0 || state.currentFloor >= 20) {
    state.isFinished = true;
  } else {
    state.currentFloor++;
  }

  return logEntry;
}

export type DecisionPolicy = 'greedy' | 'random';
export type OmamoriPolicy = 'auto' | 'none';

/**
 * proposal/01 §3.4 公式シミュレーション検証プロトコルに準拠した自動プレイ
 */
export function playAuto(
  state: DungeonRunState,
  policy: DecisionPolicy = 'greedy',
  omamoriPolicy: OmamoriPolicy = 'auto'
): DungeonRunState {
  while (!state.isFinished) {
    const floor = getCurrentFloor(state);
    if (!floor) break;

    // ポリシー選択用乱数ストリーム（判定ダイスとは完全分離し、出目汚染をゼロにする）
    const policyPrng = createFloorPRNG(
      state.seed,
      state.currentFloor,
      `${state.rulesetVersion}:policy`
    );

    // 1. 選択肢決定
    let chosenOption: ChoiceOption;
    const choices = floor.event.choices;

    if (policy === 'random') {
      const pick = policyPrng.nextInt(choices.length);
      chosenOption = choices[pick]!;
    } else {
      // greedy:
      // 道中（1F〜18F）：提示された2択のうち、素質値が高い方を選択（同点時はポリシーPRNGでタイブレーク）
      // ボス戦（19F〜20F）：5択のうち素質値が最大の軸を選択（同点時はポリシーPRNGでタイブレーク）
      let maxScore = -1;
      let bestChoices: ChoiceOption[] = [];

      for (const c of choices) {
        const score = state.setup.aptitude[c.axis];
        if (score > maxScore) {
          maxScore = score;
          bestChoices = [c];
        } else if (score === maxScore) {
          bestChoices.push(c);
        }
      }

      if (bestChoices.length === 1) {
        chosenOption = bestChoices[0]!;
      } else {
        const pick = policyPrng.nextInt(bestChoices.length);
        chosenOption = bestChoices[pick]!;
      }
    }

    // 2. 判定実行（保留状態）: 常に対話プレイと同一のダイス出目
    let resolved = resolveChoice(state, chosenOption.key);

    // 3. おまもり自動判定
    if (
      omamoriPolicy === 'auto' &&
      state.omamoriName !== null &&
      !state.omamoriUsed &&
      canUseOmamori(resolved.final_rank, false)
    ) {
      let shouldTrigger = false;
      if (resolved.final_rank === 'fumble') {
        shouldTrigger = true;
      } else if (state.currentHp <= 3 && resolved.final_rank === 'failure') {
        shouldTrigger = true;
      } else if (state.currentFloor >= 6 && state.currentHp <= 5 && resolved.final_rank === 'failure') {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        resolved = applyOmamori(state, resolved, 'シミュレーション自動発動');
      }
    }

    // 4. コミットして次へ
    commitFloor(state, resolved, '');
  }

  return state;
}
