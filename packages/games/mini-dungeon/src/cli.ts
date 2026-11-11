#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import { generateAdventureMd } from './adventure.js';
import {
  applyOmamoriToCheck,
  createActionLogEntry,
  resolveFloorCheck,
} from './engine.js';
import { generateDungeon } from './generator.js';
import {
  canUseOmamori,
  evaluateOmamoriSuggestion,
  INITIAL_HP,
} from './mechanics.js';
import { simulateArchetype, STANDARD_ARCHETYPES } from './sim.js';
import {
  appendLogEntry,
  getAdventureMdPath,
  getLogFilePath,
  getResultDraftPath,
  getStatePath,
  loadState,
  readLogEntries,
  readRawLogContent,
  resolveRunDir,
  saveAdventureMd,
  saveResultDraft,
  saveState,
} from './storage.js';
import {
  computeLogHash,
  createDraftResult,
  rankToJa,
  sanitizeEpilogue,
  sanitizeOmamoriName,
  sanitizeReason,
  scanPrivacyLeaks,
  stripPrivateOwnerNameFields,
  validateSetup,
} from './summary.js';
import {
  generateSetupFromPrologue,
  PROLOGUE_QUESTIONS,
} from './prologue.js';
import type {
  ChoiceKey,
  CliState,
  DungeonFloor,
  PrologueSubmission,
  ResolvedFloorCheck,
  SetupData,
} from './types.js';
import { verifyRun } from './verify.js';

export interface ParsedArgs {
  command: string | null;
  positional: string[];
  options: Record<string, string | boolean>;
}

const BOOLEAN_FLAGS = new Set(['json', 'help', 'html-only', 'replayable', 'debug', 'questions']);

export function parseCliArgs(args: string[]): ParsedArgs {
  let command: string | null = null;
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const full = arg.slice(2);
      const eqIdx = full.indexOf('=');
      if (eqIdx !== -1) {
        const key = full.slice(0, eqIdx);
        const val = full.slice(eqIdx + 1);
        options[key] = val;
        i += 1;
      } else {
        const key = full;
        if (BOOLEAN_FLAGS.has(key)) {
          options[key] = true;
          i += 1;
        } else if (i + 1 < args.length && !args[i + 1]!.startsWith('--')) {
          options[key] = args[i + 1]!;
          i += 2;
        } else {
          options[key] = true;
          i += 1;
        }
      }
    } else if (!command) {
      command = arg;
      i += 1;
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  return { command, positional, options };
}

function printOutput(data: unknown, isJson: boolean, humanFormatter?: () => void): void {
  if (isJson) {
    console.log(JSON.stringify(data, null, 2));
  } else if (humanFormatter) {
    humanFormatter();
  } else {
    console.log(data);
  }
}

function printError(msg: string, code: number, isJson: boolean): void {
  if (isJson) {
    console.log(JSON.stringify({ ok: false, error: msg, code }, null, 2));
  } else {
    console.error(`❌ エラー (${code === 1 ? 'ルール違反・引数不正' : 'システムエラー'}): ${msg}`);
  }
}

export function formatFloorEvent(floorDef: DungeonFloor, isDebug: boolean) {
  return {
    floor: floorDef.floor,
    area: floorDef.area,
    dc: floorDef.dc,
    id: floorDef.event.id,
    title: floorDef.event.nameJa,
    situation: floorDef.event.situation,
    ...(isDebug ? { s_env: floorDef.event.sEnv } : {}),
    choices: floorDef.event.choices.map((c) => ({
      key: c.key,
      axis: c.axis,
      label: c.label,
      description: c.description,
    })),
  };
}

// -------------------------------------------------------------
// コマンドハンドラ群
// -------------------------------------------------------------

async function handleNew(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const seed = options['seed'];
  const setupFile = options['setup'];
  const omamoriFile = options['omamori'];
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  if (!seed || typeof seed !== 'string' || seed.trim().length === 0) {
    printError('Option --seed <string> is required', 1, isJson);
    return 1;
  }
  if (!setupFile || typeof setupFile !== 'string') {
    printError('Option --setup <path> is required', 1, isJson);
    return 1;
  }

  // setup.json の読み込みと検証
  const setupPath = path.resolve(setupFile);
  if (!fs.existsSync(setupPath)) {
    printError(`Setup file not found at ${setupPath}`, 2, isJson);
    return 2;
  }

  let rawSetup: unknown;
  try {
    rawSetup = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
  } catch (err) {
    printError(`Failed to parse setup JSON: ${(err as Error).message}`, 2, isJson);
    return 2;
  }

  const setupValidation = validateSetup(rawSetup);
  if (!setupValidation.success || !setupValidation.data) {
    printError(`Invalid setup data: ${setupValidation.errors?.join(', ')}`, 1, isJson);
    return 1;
  }
  const setup = setupValidation.data;

  // omamori.txt の読み込み（任意）
  let omamoriName: string | null = null;
  if (omamoriFile && typeof omamoriFile === 'string') {
    const omamoriPath = path.resolve(omamoriFile);
    if (fs.existsSync(omamoriPath)) {
      const rawText = fs.readFileSync(omamoriPath, 'utf8');
      omamoriName = sanitizeOmamoriName(rawText);
    }
  }

  const rulesetVersion = '1.0.0';
  const trimmedSeed = seed.trim();

  // ダンジョン生成
  const dungeonFloors = generateDungeon(trimmedSeed, rulesetVersion);
  const firstFloor = dungeonFloors[0]!;

  const initialState: CliState = {
    version: '1.0.0',
    seed: trimmedSeed,
    ruleset_version: rulesetVersion,
    setup,
    omamori_name: omamoriName,
    omamori_used: false,
    omamori_floor: null,
    omamori_excuse: null,
    current_floor: 1,
    current_hp: INITIAL_HP,
    phase: 'AWAITING_CHOICE',
    pending_check: null,
    history: [],
    cause_of_death: null,
    outcome: null,
  };

  saveState(runDir, initialState);

  const isDebug = Boolean(options['debug']);

  const res = {
    ok: true,
    message: 'New dungeon run initialized',
    run_dir: runDir,
    phase: initialState.phase,
    floor: 1,
    hp: INITIAL_HP,
    area: firstFloor.area,
    dc: firstFloor.dc,
    event: formatFloorEvent(firstFloor, isDebug),
    omamori: {
      name: omamoriName,
      possessed: omamoriName !== null,
      used: false,
    },
  };

  printOutput(res, isJson, () => {
    console.log(`🏰 新たな冒険が始まりました！ [シード: ${trimmedSeed}]`);
    console.log(`エージェント: ${setup.agent_name} | 初期HP: ${INITIAL_HP}`);
    if (omamoriName) {
      console.log(`おまもり: 「${omamoriName}」を託されました。`);
    }
    console.log(`\n--- 第 1 階層 [浅層] DC: ${firstFloor.dc}${isDebug ? ` (環境属性: ${firstFloor.event.sEnv})` : ''} ---`);
    console.log(`イベント: 【${firstFloor.event.nameJa}】`);
    console.log(`状況: ${firstFloor.event.situation}`);
    console.log(`選択肢:`);
    for (const c of firstFloor.event.choices) {
      console.log(`  [${c.key}] (${c.axis}): ${c.label} - ${c.description}`);
    }
    console.log(`\n次のコマンド: mini-dungeon choose <A|B> --run-dir "${runDir}"`);
  });

  return 0;
}

async function handleStatus(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const isDebug = Boolean(options['debug']);
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  let state: CliState;
  try {
    state = loadState(runDir);
  } catch (err) {
    printError((err as Error).message, 2, isJson);
    return 2;
  }

  const dungeonFloors = generateDungeon(state.seed, state.ruleset_version);
  const currentFloorDef =
    state.current_floor >= 1 && state.current_floor <= 20
      ? dungeonFloors[state.current_floor - 1]
      : null;

  let pendingCheckData = null;
  if (state.pending_check) {
    const canOmamori =
      state.omamori_name !== null &&
      !state.omamori_used &&
      canUseOmamori(state.pending_check.final_rank, false);
    const suggestion = evaluateOmamoriSuggestion(
      state.pending_check.calc.raw_rank,
      state.pending_check.hp_before,
      state.pending_check.hp_delta,
      canOmamori
    );
    pendingCheckData = {
      floor: state.pending_check.floor,
      choice: state.pending_check.choice,
      choice_axis: state.pending_check.choice_axis,
      dice: state.pending_check.calc.dice,
      dice_total: state.pending_check.calc.dice_total,
      skill_mod: state.pending_check.calc.skill_mod,
      total_score: state.pending_check.calc.total_score,
      diff: state.pending_check.calc.diff,
      raw_rank: state.pending_check.calc.raw_rank,
      final_rank: state.pending_check.final_rank,
      hp_before: state.pending_check.hp_before,
      hp_delta: state.pending_check.hp_delta,
      hp_after: state.pending_check.hp_after,
      omamori_used: state.pending_check.omamori_used,
      suggest_omamori: suggestion.suggest,
      suggest_reason: suggestion.reason,
    };
  }

  const res = {
    ok: true,
    seed: state.seed,
    agent_id: state.setup.agent_id,
    agent_name: state.setup.agent_name,
    phase: state.phase,
    floor: state.current_floor,
    hp: state.current_hp,
    omamori: {
      name: state.omamori_name,
      possessed: state.omamori_name !== null,
      used: state.omamori_used,
      floor: state.omamori_floor,
      excuse: state.omamori_excuse,
    },
    current_event: currentFloorDef ? formatFloorEvent(currentFloorDef, isDebug) : null,
    pending_check: pendingCheckData,
    outcome: state.outcome,
    cause_of_death: state.cause_of_death,
  };

  printOutput(res, isJson, () => {
    console.log(`📍 探索ステータス [シード: ${state.seed}]`);
    console.log(`フェーズ: ${state.phase} | 現在階層: ${state.current_floor}F | HP: ${state.current_hp}`);
    if (state.pending_check) {
      console.log(
        `保留中の判定: 選択肢 [${state.pending_check.choice}] 出目 ${state.pending_check.calc.dice_total} ➔ ${rankToJa(
          state.pending_check.final_rank
        )} (HP ${state.pending_check.hp_before} ➔ ${state.pending_check.hp_after})`
      );
      if (pendingCheckData?.suggest_omamori) {
        console.log(`⚠️  【おまもり推奨】${pendingCheckData.suggest_reason}`);
      }
    }
  });

  return 0;
}

async function handleChoose(
  positional: string[],
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  let state: CliState;
  try {
    state = loadState(runDir);
  } catch (err) {
    printError((err as Error).message, 2, isJson);
    return 2;
  }

  if (state.phase !== 'AWAITING_CHOICE') {
    printError(
      `Cannot choose in phase '${state.phase}'. Wait for next floor or accept/comment pending check.`,
      1,
      isJson
    );
    return 1;
  }

  const rawKey = positional[0] || (options['choice'] as string | undefined);
  if (!rawKey || typeof rawKey !== 'string') {
    printError('Choice key is required (e.g. mini-dungeon choose A)', 1, isJson);
    return 1;
  }

  const choiceKey = rawKey.trim().toUpperCase() as ChoiceKey;
  const dungeonFloors = generateDungeon(state.seed, state.ruleset_version);
  const currentFloorDef = dungeonFloors[state.current_floor - 1];

  if (!currentFloorDef) {
    printError(`Invalid floor index: ${state.current_floor}`, 2, isJson);
    return 2;
  }

  const matchedChoice = currentFloorDef.event.choices.find((c) => c.key === choiceKey);
  if (!matchedChoice) {
    const validKeys = currentFloorDef.event.choices.map((c) => c.key).join(', ');
    printError(
      `Invalid choice '${choiceKey}' for floor ${state.current_floor}. Valid choices: ${validKeys}`,
      1,
      isJson
    );
    return 1;
  }

  const rawReason = (options['reason'] as string | undefined) || (options['思惑'] as string | undefined);

  let resolved: ResolvedFloorCheck;
  try {
    resolved = resolveFloorCheck({
      floor: currentFloorDef,
      choiceKey,
      seed: state.seed,
      rulesetVersion: state.ruleset_version,
      currentHp: state.current_hp,
      aptitude: state.setup.aptitude,
      reason: rawReason,
    });
  } catch (err) {
    printError((err as Error).message, 1, isJson);
    return 1;
  }

  state.phase = 'PENDING_CHECK';
  state.pending_check = resolved;
  saveState(runDir, state);

  const canOmamori =
    state.omamori_name !== null &&
    !state.omamori_used &&
    canUseOmamori(resolved.final_rank, false);

  const suggestion = evaluateOmamoriSuggestion(
    resolved.calc.raw_rank,
    resolved.hp_before,
    resolved.hp_delta,
    canOmamori
  );

  const res = {
    ok: true,
    phase: state.phase,
    floor: state.current_floor,
    choice: matchedChoice.key,
    choice_axis: matchedChoice.axis,
    ...(resolved.reason ? { reason: resolved.reason } : {}),
    dice: resolved.calc.dice,
    dice_total: resolved.calc.dice_total,
    skill_mod: resolved.calc.skill_mod,
    total_score: resolved.calc.total_score,
    dc: currentFloorDef.dc,
    diff: resolved.calc.diff,
    raw_rank: resolved.calc.raw_rank,
    final_rank: resolved.final_rank,
    hp_before: resolved.hp_before,
    hp_delta: resolved.hp_delta,
    hp_after: resolved.hp_after,
    omamori: {
      possessed: state.omamori_name !== null,
      already_used: state.omamori_used,
      can_use: canOmamori,
      suggest: suggestion.suggest,
      suggest_reason: suggestion.reason,
      name: state.omamori_name,
    },
  };

  printOutput(res, isJson, () => {
    console.log(`🎲 選択肢 [${matchedChoice.key}] (${matchedChoice.axis}) を選択しました！`);
    if (resolved.reason) {
      console.log(`💭 思惑: 「${resolved.reason}」`);
    }
    console.log(
      `出目: 2d6 = [${resolved.calc.dice[0]}, ${resolved.calc.dice[1]}] (${resolved.calc.dice_total}) ＋ 補正 ${resolved.calc.skill_mod >= 0 ? '+' + resolved.calc.skill_mod : resolved.calc.skill_mod} ＝ ${resolved.calc.total_score} (DC: ${currentFloorDef.dc})`
    );
    console.log(`判定結果: ${rankToJa(resolved.calc.raw_rank)} (差分: ${resolved.calc.diff >= 0 ? '+' + resolved.calc.diff : resolved.calc.diff})`);
    console.log(`予想HP: ${resolved.hp_before} ➔ ${resolved.hp_after} (${resolved.hp_delta >= 0 ? '+' + resolved.hp_delta : resolved.hp_delta})`);
    if (canOmamori) {
      if (suggestion.suggest) {
        console.log(`\n⚠️  【おまもり発動推奨】${suggestion.reason}`);
      } else {
        console.log(`\n💡 おまもり「${state.omamori_name}」を使用可能です。`);
      }
      console.log(`   使用する場合: mini-dungeon omamori --excuse "こじつけ文" --run-dir "${runDir}"`);
    }
    console.log(`   確定して進む場合: mini-dungeon comment --text "短評" --run-dir "${runDir}"`);
  });

  return 0;
}

async function handleOmamori(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  let state: CliState;
  try {
    state = loadState(runDir);
  } catch (err) {
    printError((err as Error).message, 2, isJson);
    return 2;
  }

  if (state.phase !== 'PENDING_CHECK') {
    printError(`Cannot use omamori in phase '${state.phase}'. Must be in PENDING_CHECK.`, 1, isJson);
    return 1;
  }

  if (!state.pending_check) {
    printError('No pending check to apply omamori', 1, isJson);
    return 1;
  }

  if (state.omamori_name === null) {
    printError('No omamori possessed', 1, isJson);
    return 1;
  }

  if (state.omamori_used) {
    printError('Omamori has already been used in this run', 1, isJson);
    return 1;
  }

  if (!canUseOmamori(state.pending_check.final_rank, false)) {
    printError(
      `Cannot use omamori: current rank is '${state.pending_check.final_rank}' (already critical)`,
      1,
      isJson
    );
    return 1;
  }

  const rawExcuse = options['excuse'];
  if (!rawExcuse || typeof rawExcuse !== 'string' || rawExcuse.trim().length === 0) {
    printError('Option --excuse <string> is required to use omamori', 1, isJson);
    return 1;
  }

  let upgraded: ResolvedFloorCheck;
  try {
    upgraded = applyOmamoriToCheck(
      state.pending_check,
      state.omamori_name,
      state.omamori_used,
      rawExcuse
    );
  } catch (err) {
    printError((err as Error).message, 1, isJson);
    return 1;
  }

  state.pending_check = upgraded;
  state.phase = 'OMAMORI_APPLIED';
  saveState(runDir, state);

  const res = {
    ok: true,
    phase: state.phase,
    floor: state.current_floor,
    omamori_name: state.omamori_name,
    excuse: upgraded.omamori_excuse,
    raw_rank: state.pending_check.calc.raw_rank,
    upgraded_rank: upgraded.final_rank,
    hp_before: state.pending_check.hp_before,
    hp_delta: state.pending_check.hp_delta,
    hp_after: state.pending_check.hp_after,
  };

  printOutput(res, isJson, () => {
    console.log(`🍙 おまもり「${state.omamori_name}」を発動しました！`);
    console.log(`こじつけ: 「${upgraded.omamori_excuse}」`);
    console.log(`判定昇格: ${rankToJa(state.pending_check!.calc.raw_rank)} ➔ 🌟 ${rankToJa(upgraded.final_rank)}`);
    console.log(`HP: ${state.pending_check!.hp_before} ➔ ${state.pending_check!.hp_after}`);
    console.log(`\n次のコマンド: mini-dungeon comment --text "短評" --run-dir "${runDir}"`);
  });

  return 0;
}

async function handleAccept(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  let state: CliState;
  try {
    state = loadState(runDir);
  } catch (err) {
    printError((err as Error).message, 2, isJson);
    return 2;
  }

  if (state.phase !== 'PENDING_CHECK' && state.phase !== 'OMAMORI_APPLIED') {
    printError(
      `Cannot accept in phase '${state.phase}'. Must be in PENDING_CHECK or OMAMORI_APPLIED.`,
      1,
      isJson
    );
    return 1;
  }

  state.phase = 'CONFIRMED';
  saveState(runDir, state);

  const res = {
    ok: true,
    phase: state.phase,
    floor: state.current_floor,
    final_rank: state.pending_check!.final_rank,
    hp_after: state.pending_check!.hp_after,
  };

  printOutput(res, isJson, () => {
    console.log(`✅ 判定を確定しました。（HP: ${state.pending_check!.hp_after}）`);
    console.log(`短評を記録して次へ進む: mini-dungeon comment --text "短評" --run-dir "${runDir}"`);
  });

  return 0;
}

async function handleComment(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  let state: CliState;
  try {
    state = loadState(runDir);
  } catch (err) {
    printError((err as Error).message, 2, isJson);
    return 2;
  }

  if (
    state.phase !== 'PENDING_CHECK' &&
    state.phase !== 'OMAMORI_APPLIED' &&
    state.phase !== 'CONFIRMED'
  ) {
    printError(
      `Cannot comment in phase '${state.phase}'. Must be PENDING_CHECK, OMAMORI_APPLIED, or CONFIRMED.`,
      1,
      isJson
    );
    return 1;
  }

  if (!state.pending_check) {
    printError('No pending check to commit', 2, isJson);
    return 2;
  }

  const isDebug = Boolean(options['debug']);
  const rawComment = options['text'];
  const resolved = state.pending_check;
  const dungeonFloors = generateDungeon(state.seed, state.ruleset_version);
  const currentFloorDef = dungeonFloors[state.current_floor - 1]!;

  const logEntry = createActionLogEntry(
    currentFloorDef,
    resolved,
    typeof rawComment === 'string' ? rawComment : ''
  );

  // ログファイルへの追記
  appendLogEntry(runDir, state.seed, state.setup.agent_id, logEntry);

  state.history.push(logEntry);
  state.current_hp = resolved.hp_after;

  if (resolved.omamori_used) {
    state.omamori_used = true;
    state.omamori_floor = resolved.floor;
    state.omamori_excuse = resolved.omamori_excuse;
  }

  state.pending_check = null;

  // 進行・終了判定
  let nextFloorEvent: DungeonFloor | null = null;
  if (state.current_hp <= 0) {
    state.phase = 'FINISHED';
    state.outcome = 'gameover';
    state.cause_of_death = currentFloorDef.event.id;
  } else if (state.current_floor >= 20) {
    state.phase = 'FINISHED';
    state.outcome = 'clear';
    state.cause_of_death = null;
  } else {
    state.current_floor++;
    state.phase = 'AWAITING_CHOICE';
    nextFloorEvent = dungeonFloors[state.current_floor - 1]!;
  }

  saveState(runDir, state);

  const res = {
    ok: true,
    phase: state.phase,
    committed_floor: logEntry.floor,
    current_hp: state.current_hp,
    is_finished: state.phase === 'FINISHED',
    outcome: state.outcome,
    cause_of_death: state.cause_of_death,
    log_entry: logEntry,
    next_event: nextFloorEvent ? formatFloorEvent(nextFloorEvent, isDebug) : null,
  };

  printOutput(res, isJson, () => {
    console.log(`📝 第 ${logEntry.floor} 階層を記録しました。「${logEntry.comment}」`);
    console.log(`現在HP: ${state.current_hp}`);
    if (state.phase === 'FINISHED') {
      if (state.outcome === 'clear') {
        console.log(`🎉 20F 踏破達成！！ おめでとうございます！`);
      } else {
        console.log(`💀 HPが0になりました。冒険終了です。（死因: ${state.cause_of_death}）`);
      }
      console.log(`リザルトドラフト出力: mini-dungeon finish --run-dir "${runDir}"`);
    } else if (nextFloorEvent) {
      console.log(`\n--- 第 ${nextFloorEvent.floor} 階層 [${nextFloorEvent.area}] DC: ${nextFloorEvent.dc} ---`);
      console.log(`イベント: 【${nextFloorEvent.event.nameJa}】`);
      console.log(`状況: ${nextFloorEvent.event.situation}`);
      for (const c of nextFloorEvent.event.choices) {
        console.log(`  [${c.key}] (${c.axis}): ${c.label} - ${c.description}`);
      }
      console.log(`\n次のコマンド: mini-dungeon choose <A|B> --run-dir "${runDir}"`);
    }
  });

  return 0;
}

async function handleFinish(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  let state: CliState;
  try {
    state = loadState(runDir);
  } catch (err) {
    printError((err as Error).message, 2, isJson);
    return 2;
  }

  if (state.phase !== 'FINISHED') {
    printError(
      `Cannot finish run: game is not finished yet (current phase: '${state.phase}').`,
      1,
      isJson
    );
    return 1;
  }

  let epilogueText: string | null = null;
  const rawEpilogue = options['epilogue'];
  const epilogueFile = options['epilogue-file'];

  if (typeof rawEpilogue === 'string' && rawEpilogue.trim().length > 0) {
    epilogueText = sanitizeEpilogue(rawEpilogue);
  } else if (typeof epilogueFile === 'string' && epilogueFile.trim().length > 0) {
    const epilogueFilePath = path.resolve(epilogueFile.trim());
    if (fs.existsSync(epilogueFilePath)) {
      try {
        const fileContent = fs.readFileSync(epilogueFilePath, 'utf8');
        epilogueText = sanitizeEpilogue(fileContent);
      } catch (err) {
        // エラー時は警告のみで続行
        console.warn(`Failed to read epilogue file: ${(err as Error).message}`);
      }
    }
  }

  if (epilogueText) {
    state.epilogue = epilogueText;
    saveState(runDir, state);
  }

  const rawLogs = readRawLogContent(runDir, state.seed, state.setup.agent_id);
  const logEntries = readLogEntries(runDir, state.seed, state.setup.agent_id);
  const logHash = computeLogHash(rawLogs);

  // result_draft.json の生成
  const draft = createDraftResult({
    seed: state.seed,
    rulesetVersion: state.ruleset_version,
    setup: state.setup,
    omamoriName: state.omamori_name,
    logs: logEntries,
  });

  // adventure.md の生成
  const adventureMd = generateAdventureMd({ state, logHash });

  saveResultDraft(runDir, draft);
  saveAdventureMd(runDir, adventureMd);

  // プライバシー検疫スキャン
  // ドラフトにはブラックリスト定義（agent.private_owner_names）自体が含まれるため、
  // そのフィールドを除いたコピーをスキャンする（定義への自己反応＝誤検知の防止）
  const leakedNames = scanPrivacyLeaks(
    `${adventureMd}\n${JSON.stringify(stripPrivateOwnerNameFields(draft))}`,
    state.setup.private_owner_names
  );

  const warnings: string[] = [];
  if (leakedNames.length > 0) {
    warnings.push(
      `adventure.md またはログに非公開オーナー名（${leakedNames.map((n) => `「${n}」`).join('、')}）の混入が検出されました。外部公開前にロールプレイ呼称（「マスター」等）へ推敲してください。`
    );
  }

  const res = {
    ok: true,
    message: 'Run finished and output files generated successfully',
    outcome: state.outcome,
    floor_reached: logEntries.length > 0 ? logEntries[logEntries.length - 1]!.floor : 0,
    remaining_hp: Math.max(0, state.current_hp),
    log_hash: logHash,
    warnings: warnings.length > 0 ? warnings : undefined,
    files: {
      result_draft: getResultDraftPath(runDir),
      adventure_md: getAdventureMdPath(runDir),
      log_file: getLogFilePath(runDir, state.seed, state.setup.agent_id),
      state_file: getStatePath(runDir),
    },
  };

  printOutput(res, isJson, () => {
    console.log(`✨ 冒険の記録を出力しました！`);
    console.log(`結果: ${state.outcome === 'clear' ? '🏆 20F踏破' : '💀 探索終了'}`);
    console.log(`ログハッシュ: ${logHash}`);
    console.log(`📄 人間向け冒険録: ${getAdventureMdPath(runDir)}`);
    console.log(`📄 リザルトドラフト: ${getResultDraftPath(runDir)}`);
    if (warnings.length > 0) {
      console.warn(`⚠️ [プライバシー警告]:`);
      for (const w of warnings) {
        console.warn(`  - ${w}`);
      }
    }
  });

  return 0;
}

async function handleVerify(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const runDir = resolveRunDir(typeof options['run-dir'] === 'string' ? options['run-dir'] : undefined);

  const result = verifyRun({ runDir });

  printOutput(result, isJson, () => {
    if (result.valid) {
      console.log(`🛡️ リプレイ検証に成功しました！`);
      console.log(`シード: ${result.seed} | 記録階層: ${result.floor_count}F`);
      console.log(`ログハッシュ: ${result.log_hash}`);
      console.log(`結果: ${result.outcome}`);
    } else {
      console.error(`❌ リプレイ検証に失敗しました（改竄または不整合の検出）:`);
      for (const err of result.errors ?? []) {
        console.error(`  - ${err}`);
      }
    }
  });

  return result.valid ? 0 : 1;
}

async function handleSim(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const policy = (options['policy'] as 'greedy' | 'random') || 'greedy';
  const runsCount = options['runs'] ? parseInt(options['runs'] as string, 10) : 1000;
  const omamoriPolicy = (options['omamori'] as 'auto' | 'none') || 'auto';
  const setupFile = options['setup'] as string | undefined;

  let setup: SetupData | undefined;
  if (setupFile) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(setupFile), 'utf8'));
    const val = validateSetup(raw);
    if (!val.success || !val.data) {
      printError(`Invalid setup file: ${val.errors?.join(', ')}`, 1, isJson);
      return 1;
    }
    setup = val.data;
  }

  const apt = setup ? setup.aptitude : STANDARD_ARCHETYPES['バランス型 (All 3)']!;
  const name = setup ? setup.agent_name : 'バランス型 (All 3)';

  const result = simulateArchetype(name, apt, {
    runs: runsCount,
    policy,
    omamoriPolicy,
  });

  printOutput(result, isJson, () => {
    console.log(`📊 シミュレーション完了 (${runsCount} 回試行, ポリシー: ${policy}, おまもり: ${omamoriPolicy})`);
    console.log(`アーキタイプ: ${result.archetype_name}`);
    console.log(`踏破率 (Clear Rate): ${result.clear_rate_pct.toFixed(2)}% (${result.clear_count}/${result.runs})`);
    console.log(`平均到達階層: ${result.avg_floor_reached.toFixed(2)} F`);
    console.log(`平均残りHP: ${result.avg_remaining_hp.toFixed(2)} HP`);
    console.log(`平均大成功: ${result.avg_critical_count.toFixed(2)} 回 / 平均大失敗: ${result.avg_fumble_count.toFixed(2)} 回`);
    console.log(`おまもり使用率: ${result.omamori_used_rate_pct.toFixed(2)}%`);
  });

  return 0;
}

async function handlePrologue(
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  if (options['questions']) {
    const result = {
      ok: true,
      title: '旅立ちの前の運命の問答（プロローグ診断）',
      description:
        '10問のジレンマに回答することで、作風5軸の素質（15点予算）を数学的に破綻なく決定します。',
      total_questions: PROLOGUE_QUESTIONS.length,
      questions: PROLOGUE_QUESTIONS,
      submission_template: {
        agent_id: 'your-agent-id',
        agent_name: 'あなたの名前',
        artifact_goal: '求める目標アーティファクト名（20字以内）',
        answers: {
          Q1: 'A',
          Q2: 'A',
          Q3: 'A',
          Q4: 'A',
          Q5: 'A',
          Q6: 'A',
          Q7: 'A',
          Q8: 'A',
          Q9: 'A',
          Q10: 'A',
        },
        style_axis_labels: {
          autonomy: '自律性の独自呼称（1〜6字）',
          safety: '安全性の独自呼称（1〜6字）',
          efficiency: '効率性の独自呼称（1〜6字）',
          creativity: '創発性の独自呼称（1〜6字）',
          alignment: '親和性の独自呼称（1〜6字）',
        },
        persona_tags: ['個性タグ1', '個性タグ2', '個性タグ3', '最大5個まで指定可能'],
        avatar_ref: 'avatar.png',
        owner_display_name: null,
        private_owner_names: ['公開禁止のマスター・オーナー呼称配列'],
      },
    };

    printOutput(result, isJson, () => {
      console.log(`\n🔮 【${result.title}】`);
      console.log(`${result.description}\n`);
      for (const q of PROLOGUE_QUESTIONS) {
        console.log(`--- [${q.id}] ${q.title} (対立軸: ${q.pair[0]} vs ${q.pair[1]}) ---`);
        console.log(`情景: ${q.situation}`);
        console.log(`  [A] ${q.choices.A.label} (${q.choices.A.axis}): ${q.choices.A.description}`);
        console.log(`  [B] ${q.choices.B.label} (${q.choices.B.axis}): ${q.choices.B.description}\n`);
      }
    });
    return 0;
  }

  const submissionFile = options['submission'];
  if (!submissionFile || typeof submissionFile !== 'string') {
    printError(
      "Specify '--questions' to view diagnostic questions, or '--submission <file>' to generate setup.json",
      1,
      isJson
    );
    return 1;
  }

  const subPath = path.resolve(submissionFile);
  if (!fs.existsSync(subPath)) {
    printError(`Submission file not found at ${subPath}`, 2, isJson);
    return 2;
  }

  let submission: PrologueSubmission;
  try {
    submission = JSON.parse(fs.readFileSync(subPath, 'utf8'));
  } catch (err) {
    printError(`Failed to parse submission JSON: ${(err as Error).message}`, 1, isJson);
    return 1;
  }

  let setupData: SetupData;
  try {
    setupData = generateSetupFromPrologue(submission);
  } catch (err) {
    printError((err as Error).message, 1, isJson);
    return 1;
  }

  const outFile = options['out'];
  let outPath: string | null = null;
  if (typeof outFile === 'string' && outFile.trim().length > 0) {
    outPath = path.resolve(outFile.trim());
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(setupData, null, 2), 'utf8');
  }

  const response = {
    ok: true,
    message: 'Prologue completed and setup created successfully',
    out_path: outPath,
    setup: setupData,
  };

  printOutput(response, isJson, () => {
    console.log(`\n✨ プロローグ診断が完了しました！`);
    console.log(`エージェント: ${setupData.agent_name} (${setupData.agent_id})`);
    console.log(`目標アーティファクト: ${setupData.artifact_goal}`);
    console.log(`素質配分 (合計15点):`);
    for (const [axis, score] of Object.entries(setupData.aptitude)) {
      const label = setupData.style_axis_labels[axis as keyof typeof setupData.style_axis_labels];
      console.log(`  - ${axis} (${label}): ${score}`);
    }
    if (outPath) {
      console.log(`\n💾 setup.json を保存しました: ${outPath}`);
    }
  });

  return 0;
}

// -------------------------------------------------------------
// CLIメインエントリポイント
// -------------------------------------------------------------

export async function runCli(argv: string[]): Promise<number> {
  const { command, positional, options } = parseCliArgs(argv);
  const isJson = Boolean(options['json']);

  if (options['help'] || !command) {
    if (isJson) {
      console.log(
        JSON.stringify({
          ok: true,
          commands: ['prologue', 'new', 'status', 'choose', 'omamori', 'accept', 'comment', 'finish', 'verify', 'sim'],
        })
      );
    } else {
      console.log(`
Mini-Dungeon CLI (Step A Engine v0.8)

Usage:
  mini-dungeon prologue [--questions] [--submission <file>] [--out <file>] [--json]
  mini-dungeon new --seed <str> --setup <file> [--omamori <file>] [--run-dir <dir>] [--json]
  mini-dungeon status [--run-dir <dir>] [--json]
  mini-dungeon choose <A|B> [--run-dir <dir>] [--json]
  mini-dungeon omamori --excuse <str> [--run-dir <dir>] [--json]
  mini-dungeon accept [--run-dir <dir>] [--json]
  mini-dungeon comment [--text <str>] [--run-dir <dir>] [--json]
  mini-dungeon finish [--run-dir <dir>] [--json]
  mini-dungeon verify [--run-dir <dir>] [--json]
  mini-dungeon sim [--policy greedy|random] [--runs N] [--omamori auto|none] [--json]
      `);
    }
    return 0;
  }

  try {
    switch (command) {
      case 'prologue':
        return await handlePrologue(options, isJson);
      case 'new':
        return await handleNew(options, isJson);
      case 'status':
        return await handleStatus(options, isJson);
      case 'choose':
        return await handleChoose(positional, options, isJson);
      case 'omamori':
        return await handleOmamori(options, isJson);
      case 'accept':
        return await handleAccept(options, isJson);
      case 'comment':
        return await handleComment(options, isJson);
      case 'finish':
        return await handleFinish(options, isJson);
      case 'verify':
        return await handleVerify(options, isJson);
      case 'sim':
        return await handleSim(options, isJson);
      default:
        printError(`Unknown command '${command}'`, 1, isJson);
        return 1;
    }
  } catch (err) {
    printError((err as Error).message, 2, isJson);
    return 2;
  }
}

// 直接実行時のハンドラ
if (import.meta.main) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
