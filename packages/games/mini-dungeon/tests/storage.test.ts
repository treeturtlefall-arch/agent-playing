import { describe, expect, test, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  appendLogEntry,
  loadState,
  readLogEntries,
  readRawLogContent,
  saveAdventureMd,
  saveResultDraft,
  saveState,
} from '../src/storage.js';
import type { ActionLogEntry, CliState, SetupData } from '../src/types.js';

const TEST_DIR = path.resolve('.tmp/test-storage');

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

const sampleSetup: SetupData = {
  agent_id: 'test-agent',
  agent_name: 'テストエージェント',
  artifact_goal: '知恵の書',
  aptitude: {
    autonomy: 3,
    safety: 3,
    efficiency: 3,
    creativity: 3,
    alignment: 3,
  },
  style_axis_labels: {
    autonomy: '自律',
    safety: '安全',
    efficiency: '効率',
    creativity: '創発',
    alignment: '親和',
  },
};

const sampleState: CliState = {
  version: '1.0.0',
  seed: 'TEST-SEED',
  ruleset_version: '1.0.0',
  setup: sampleSetup,
  omamori_name: 'お守り',
  omamori_used: false,
  omamori_floor: null,
  omamori_excuse: null,
  current_floor: 1,
  current_hp: 10,
  phase: 'AWAITING_CHOICE',
  pending_check: null,
  history: [],
  cause_of_death: null,
  outcome: null,
};

const sampleLogEntry: ActionLogEntry = {
  floor: 1,
  area: 'shallow',
  event_id: 'S_P01_GEYSER',
  dc: 7,
  s_env: 'autonomy',
  choice: 'A',
  choice_axis: 'autonomy',
  s_act: 3,
  s_eff: 3,
  dice: [3, 4],
  dice_total: 7,
  skill_mod: 0,
  total_score: 7,
  diff: 0,
  raw_rank: 'success',
  omamori_used: false,
  omamori_excuse: null,
  final_rank: 'success',
  hp_before: 10,
  hp_delta: 0,
  hp_after: 10,
  comment: '順調な出だし',
};

describe('Storage Module', () => {
  test('saveState と loadState が正常に動作すること', () => {
    saveState(TEST_DIR, sampleState);
    const loaded = loadState(TEST_DIR);

    expect(loaded.seed).toBe('TEST-SEED');
    expect(loaded.current_hp).toBe(10);
    expect(loaded.setup.agent_id).toBe('test-agent');
  });

  test('appendLogEntry と readLogEntries / readRawLogContent が正常に動作すること', () => {
    appendLogEntry(TEST_DIR, 'TEST-SEED', 'test-agent', sampleLogEntry);
    appendLogEntry(TEST_DIR, 'TEST-SEED', 'test-agent', {
      ...sampleLogEntry,
      floor: 2,
      comment: '2階層目',
    });

    const entries = readLogEntries(TEST_DIR, 'TEST-SEED', 'test-agent');
    expect(entries.length).toBe(2);
    expect(entries[0]!.floor).toBe(1);
    expect(entries[1]!.floor).toBe(2);

    const raw = readRawLogContent(TEST_DIR, 'TEST-SEED', 'test-agent');
    expect(raw).toContain('S_P01_GEYSER');
    expect(raw.split('\n').filter((l) => l.trim().length > 0).length).toBe(2);
  });

  test('saveResultDraft と saveAdventureMd がファイルを出力すること', () => {
    const draftPath = saveResultDraft(TEST_DIR, { title: 'Draft' });
    const mdPath = saveAdventureMd(TEST_DIR, '# Adventure');

    expect(fs.existsSync(draftPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);
    expect(fs.readFileSync(mdPath, 'utf8')).toBe('# Adventure');
  });
});
