import { describe, expect, test, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { initRun, playAuto } from '../src/engine.js';
import {
  appendLogEntry,
  saveResultDraft,
  saveState,
} from '../src/storage.js';
import { createDraftResult } from '../src/summary.js';
import type { CliState, SetupData } from '../src/types.js';
import { verifyRun } from '../src/verify.js';

const TEST_DIR = path.resolve('.tmp/test-verify');

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

const sampleSetup: SetupData = {
  agent_id: 'verifier-agent',
  agent_name: '検証テスト',
  artifact_goal: '林檎',
  aptitude: {
    autonomy: 1,
    safety: 5,
    efficiency: 3,
    creativity: 4,
    alignment: 2,
  },
  style_axis_labels: {
    autonomy: '自律',
    safety: '安全',
    efficiency: '効率',
    creativity: '創発',
    alignment: '親和',
  },
};

describe('Verification Engine (Replay & Tamper Detection)', () => {
  test('正常なゲームランのログとドラフトが完全一致して検証合格すること', () => {
    const seed = 'VERIFY-SEED-01';
    const state = initRun({ seed, setup: sampleSetup, omamoriName: 'お守り' });
    playAuto(state, 'greedy', 'auto');

    const cliState: CliState = {
      version: '1.0.0',
      seed,
      ruleset_version: '1.0.0',
      setup: sampleSetup,
      omamori_name: 'お守り',
      omamori_used: state.omamoriUsed,
      omamori_floor: state.omamoriUsedFloor,
      omamori_excuse: state.omamoriUsedExcuse,
      current_floor: state.currentFloor,
      current_hp: state.currentHp,
      phase: 'FINISHED',
      pending_check: null,
      history: state.logs,
      cause_of_death: state.currentHp <= 0 ? state.logs[state.logs.length - 1]!.event_id : null,
      outcome: state.currentHp > 0 && state.currentFloor === 20 ? 'clear' : 'gameover',
    };

    saveState(TEST_DIR, cliState);
    for (const entry of state.logs) {
      appendLogEntry(TEST_DIR, seed, sampleSetup.agent_id, entry);
    }

    const draft = createDraftResult({
      seed,
      setup: sampleSetup,
      omamoriName: 'お守り',
      logs: state.logs,
    });
    saveResultDraft(TEST_DIR, draft);

    const res = verifyRun({ runDir: TEST_DIR });
    expect(res.valid).toBe(true);
    expect(res.floor_count).toBe(state.logs.length);
    expect(res.log_hash.length).toBe(12);
    expect(res.errors).toBeUndefined();
  });

  test('出目を不正に改竄したログを検知して検証失敗すること', () => {
    const seed = 'VERIFY-TAMPER-DICE';
    const state = initRun({ seed, setup: sampleSetup, omamoriName: null });
    playAuto(state, 'greedy', 'none');

    const cliState: CliState = {
      version: '1.0.0',
      seed,
      ruleset_version: '1.0.0',
      setup: sampleSetup,
      omamori_name: null,
      omamori_used: false,
      omamori_floor: null,
      omamori_excuse: null,
      current_floor: state.currentFloor,
      current_hp: state.currentHp,
      phase: 'FINISHED',
      pending_check: null,
      history: state.logs,
      cause_of_death: null,
      outcome: 'gameover',
    };

    saveState(TEST_DIR, cliState);

    // 1階層目の出目を [6, 6] に改竄
    const tamperedLogs = state.logs.map((l, idx) => {
      if (idx === 0) {
        return { ...l, dice: [6, 6] as [number, number], dice_total: 12 };
      }
      return l;
    });

    for (const entry of tamperedLogs) {
      appendLogEntry(TEST_DIR, seed, sampleSetup.agent_id, entry);
    }

    const res = verifyRun({ runDir: TEST_DIR });
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
    expect(res.errors!.some((e) => e.includes('dice mismatch'))).toBe(true);
  });

  test('未所持なのに「おまもり使用」と記録された不正ログを検知すること', () => {
    const seed = 'VERIFY-TAMPER-OMAMORI';
    const state = initRun({ seed, setup: sampleSetup, omamoriName: null }); // おまもり無し
    playAuto(state, 'greedy', 'none');

    const cliState: CliState = {
      version: '1.0.0',
      seed,
      ruleset_version: '1.0.0',
      setup: sampleSetup,
      omamori_name: null,
      omamori_used: false,
      omamori_floor: null,
      omamori_excuse: null,
      current_floor: state.currentFloor,
      current_hp: state.currentHp,
      phase: 'FINISHED',
      pending_check: null,
      history: state.logs,
      cause_of_death: null,
      outcome: 'gameover',
    };

    saveState(TEST_DIR, cliState);

    // 1階層目でおまもりを使ったと改竄
    const tamperedLogs = state.logs.map((l, idx) => {
      if (idx === 0) {
        return { ...l, omamori_used: true, omamori_excuse: 'ズルしました' };
      }
      return l;
    });

    for (const entry of tamperedLogs) {
      appendLogEntry(TEST_DIR, seed, sampleSetup.agent_id, entry);
    }

    const res = verifyRun({ runDir: TEST_DIR });
    expect(res.valid).toBe(false);
    expect(res.errors!.some((e) => e.includes('no omamori possessed'))).toBe(true);
  });
});
