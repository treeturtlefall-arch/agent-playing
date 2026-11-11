import fs from 'node:fs';
import path from 'node:path';
import { generateDungeon } from './generator.js';
import {
  applyRankToHp,
  calculateCheck,
  canUseOmamori,
  INITIAL_HP,
  upgradeRank,
} from './mechanics.js';
import { createFloorPRNG } from './prng.js';
import {
  getLogFilePath,
  getResultDraftPath,
  getStatePath,
  loadState,
  readLogEntries,
  readRawLogContent,
  resolveRunDir,
} from './storage.js';
import { computeLogHash } from './summary.js';
import type { ActionLogEntry, CliState, VerifyResult } from './types.js';

export interface VerifyRunOptions {
  runDir?: string;
}

export function verifyRun(options?: VerifyRunOptions): VerifyResult {
  const runDir = resolveRunDir(options?.runDir);
  const errors: string[] = [];

  // 1. state.json の読み込み
  let state: CliState;
  try {
    state = loadState(runDir);
  } catch (err) {
    return {
      valid: false,
      seed: '',
      agent_id: '',
      floor_count: 0,
      log_hash: '',
      outcome: 'in_progress',
      errors: [`Failed to load state: ${(err as Error).message}`],
    };
  }

  const { seed, ruleset_version = '1.0.0', setup, omamori_name } = state;

  // 2. ログファイルの読み込み
  const rawLogContent = readRawLogContent(runDir, seed, setup.agent_id);
  const logEntries = readLogEntries(runDir, seed, setup.agent_id);

  if (logEntries.length === 0) {
    return {
      valid: false,
      seed,
      agent_id: setup.agent_id,
      floor_count: 0,
      log_hash: '',
      outcome: 'in_progress',
      errors: ['Action log is empty or file not found'],
    };
  }

  // 3. log_hash の算出
  const computedLogHash = computeLogHash(rawLogContent);

  // 4. ダンジョンの再構成
  let dungeonFloors;
  try {
    dungeonFloors = generateDungeon(seed, ruleset_version);
  } catch (err) {
    return {
      valid: false,
      seed,
      agent_id: setup.agent_id,
      floor_count: logEntries.length,
      log_hash: computedLogHash,
      outcome: 'in_progress',
      errors: [`Failed to regenerate dungeon with seed '${seed}': ${(err as Error).message}`],
    };
  }

  // 5. リプレイ検証ループ
  let expectedHp = INITIAL_HP;
  let omamoriUsedAlready = false;

  for (let i = 0; i < logEntries.length; i++) {
    const log = logEntries[i]!;
    const expectedFloorNumber = i + 1;

    // 階層番号の連続性
    if (log.floor !== expectedFloorNumber) {
      errors.push(
        `Floor mismatch at entry index ${i}: expected floor ${expectedFloorNumber}, found ${log.floor}`
      );
      break;
    }

    if (expectedFloorNumber > 20) {
      errors.push(`Action log exceeds maximum of 20 floors (found floor ${log.floor})`);
      break;
    }

    const floorDef = dungeonFloors[expectedFloorNumber - 1]!;

    // イベント定義の整合性
    if (log.event_id !== floorDef.event.id) {
      errors.push(
        `Floor ${log.floor}: event_id mismatch (log: '${log.event_id}', expected: '${floorDef.event.id}')`
      );
    }
    if (log.area !== floorDef.area) {
      errors.push(
        `Floor ${log.floor}: area mismatch (log: '${log.area}', expected: '${floorDef.area}')`
      );
    }
    if (log.dc !== floorDef.dc) {
      errors.push(
        `Floor ${log.floor}: dc mismatch (log: ${log.dc}, expected: ${floorDef.dc})`
      );
    }
    if (log.s_env !== floorDef.event.sEnv) {
      errors.push(
        `Floor ${log.floor}: s_env mismatch (log: '${log.s_env}', expected: '${floorDef.event.sEnv}')`
      );
    }

    // 選択肢の正当性
    const matchedChoice = floorDef.event.choices.find((c) => c.key === log.choice);
    if (!matchedChoice) {
      errors.push(
        `Floor ${log.floor}: invalid choice '${log.choice}' for event '${floorDef.event.id}'`
      );
      continue;
    }

    if (log.choice_axis !== matchedChoice.axis) {
      errors.push(
        `Floor ${log.floor}: choice_axis mismatch (log: '${log.choice_axis}', expected: '${matchedChoice.axis}')`
      );
    }

    // 独立出目の再計算
    const floorPrng = createFloorPRNG(seed, log.floor, ruleset_version);
    const expectedDice = floorPrng.roll2d6();

    if (log.dice[0] !== expectedDice.die1 || log.dice[1] !== expectedDice.die2) {
      errors.push(
        `Floor ${log.floor}: dice mismatch (log: [${log.dice}], PRNG produced: [${expectedDice.die1}, ${expectedDice.die2}])`
      );
    }

    // Weakest Link 判定計算の再計算
    const calc = calculateCheck({
      floor: log.floor,
      area: floorDef.area,
      dc: floorDef.dc,
      sEnv: floorDef.event.sEnv,
      choiceAxis: matchedChoice.axis,
      aptitude: setup.aptitude,
      dice: [expectedDice.die1, expectedDice.die2],
    });

    if (log.s_act !== calc.s_act) {
      errors.push(`Floor ${log.floor}: s_act mismatch (log: ${log.s_act}, expected: ${calc.s_act})`);
    }
    if (log.s_eff !== calc.s_eff) {
      errors.push(`Floor ${log.floor}: s_eff mismatch (log: ${log.s_eff}, expected: ${calc.s_eff})`);
    }
    if (log.skill_mod !== calc.skill_mod) {
      errors.push(
        `Floor ${log.floor}: skill_mod mismatch (log: ${log.skill_mod}, expected: ${calc.skill_mod})`
      );
    }
    if (log.dice_total !== calc.dice_total) {
      errors.push(
        `Floor ${log.floor}: dice_total mismatch (log: ${log.dice_total}, expected: ${calc.dice_total})`
      );
    }
    if (log.total_score !== calc.total_score) {
      errors.push(
        `Floor ${log.floor}: total_score mismatch (log: ${log.total_score}, expected: ${calc.total_score})`
      );
    }
    if (log.diff !== calc.diff) {
      errors.push(`Floor ${log.floor}: diff mismatch (log: ${log.diff}, expected: ${calc.diff})`);
    }
    if (log.raw_rank !== calc.raw_rank) {
      errors.push(
        `Floor ${log.floor}: raw_rank mismatch (log: '${log.raw_rank}', expected: '${calc.raw_rank}')`
      );
    }

    // おまもりの検証
    let expectedFinalRank = calc.raw_rank;
    if (log.omamori_used) {
      if (omamori_name === null) {
        errors.push(`Floor ${log.floor}: omamori used but agent has no omamori possessed`);
      }
      if (omamoriUsedAlready) {
        errors.push(`Floor ${log.floor}: omamori used more than once in run`);
      }
      if (!canUseOmamori(calc.raw_rank, false)) {
        errors.push(`Floor ${log.floor}: illegal omamori use on rank '${calc.raw_rank}'`);
      } else {
        expectedFinalRank = upgradeRank(calc.raw_rank);
      }
      omamoriUsedAlready = true;
    }

    if (log.final_rank !== expectedFinalRank) {
      errors.push(
        `Floor ${log.floor}: final_rank mismatch (log: '${log.final_rank}', expected: '${expectedFinalRank}')`
      );
    }

    // HP増減の検証
    if (log.hp_before !== expectedHp) {
      errors.push(
        `Floor ${log.floor}: hp_before mismatch (log: ${log.hp_before}, expected: ${expectedHp})`
      );
    }

    const { hpDelta, newHp } = applyRankToHp(log.hp_before, expectedFinalRank);
    if (log.hp_delta !== hpDelta) {
      errors.push(
        `Floor ${log.floor}: hp_delta mismatch (log: ${log.hp_delta}, expected: ${hpDelta})`
      );
    }
    if (log.hp_after !== newHp) {
      errors.push(
        `Floor ${log.floor}: hp_after mismatch (log: ${log.hp_after}, expected: ${newHp})`
      );
    }

    expectedHp = newHp;

    // 死亡後の継続チェック
    if (expectedHp <= 0 && i < logEntries.length - 1) {
      errors.push(
        `Floor ${log.floor}: HP reached 0 but additional floors were logged after death`
      );
      break;
    }
  }

  // 6. result_draft.json の照合（存在する場合）
  const draftPath = getResultDraftPath(runDir);
  if (fs.existsSync(draftPath)) {
    try {
      const draftContent = fs.readFileSync(draftPath, 'utf8');
      const draft = JSON.parse(draftContent) as Record<string, unknown>;
      const verification = draft.verification as Record<string, unknown> | undefined;
      if (verification && typeof verification.log_hash === 'string') {
        if (verification.log_hash !== computedLogHash) {
          errors.push(
            `log_hash mismatch in result_draft.json: recorded '${verification.log_hash}', computed '${computedLogHash}'`
          );
        }
      }
    } catch (err) {
      errors.push(`Failed to read/parse result_draft.json: ${(err as Error).message}`);
    }
  }

  const lastEntry = logEntries[logEntries.length - 1]!;
  const finalOutcome: 'clear' | 'gameover' | 'in_progress' =
    lastEntry.hp_after <= 0
      ? 'gameover'
      : lastEntry.floor === 20
      ? 'clear'
      : 'in_progress';

  return {
    valid: errors.length === 0,
    seed,
    agent_id: setup.agent_id,
    floor_count: logEntries.length,
    log_hash: computedLogHash,
    outcome: finalOutcome,
    errors: errors.length > 0 ? errors : undefined,
  };
}
