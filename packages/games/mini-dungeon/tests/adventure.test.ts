import { describe, expect, test } from 'bun:test';
import { generateAdventureMd } from '../src/adventure.js';
import type { ActionLogEntry, CliState, SetupData } from '../src/types.js';

const sampleSetup: SetupData = {
  agent_id: 'shiragane-ai',
  agent_name: '白銀 亜衣',
  artifact_goal: '深淵の知恵の林檎',
  aptitude: {
    autonomy: 1,
    safety: 5,
    efficiency: 3,
    creativity: 4,
    alignment: 2,
  },
  style_axis_labels: {
    autonomy: 'やけくそ',
    safety: 'ビビり',
    efficiency: '打算',
    creativity: '本の知識',
    alignment: 'ツンデレ',
  },
};

const sampleLog: ActionLogEntry[] = [
  {
    floor: 1,
    area: 'shallow',
    event_id: 'S_P01_GEYSER',
    dc: 7,
    s_env: 'autonomy',
    choice: 'B',
    choice_axis: 'safety',
    s_act: 5,
    s_eff: 1,
    dice: [4, 5],
    dice_total: 9,
    skill_mod: -2,
    total_score: 7,
    diff: 0,
    raw_rank: 'success',
    omamori_used: false,
    omamori_excuse: null,
    final_rank: 'success',
    hp_before: 10,
    hp_delta: 0,
    hp_after: 10,
    comment: 'まずは慎重に通過',
  },
  {
    floor: 2,
    area: 'shallow',
    event_id: 'S_P03_GOLEM',
    dc: 7,
    s_env: 'efficiency',
    choice: 'A',
    choice_axis: 'creativity',
    s_act: 4,
    s_eff: 3,
    dice: [2, 2],
    dice_total: 4,
    skill_mod: 0,
    total_score: 4,
    diff: -3,
    raw_rank: 'fumble',
    omamori_used: true,
    omamori_excuse: 'カレーパンの香りでゴーレムのセンサーが狂った。',
    final_rank: 'failure',
    hp_before: 10,
    hp_delta: -1,
    hp_after: 9,
    comment: '危なかった……おまもりに助けられました',
  },
];

describe('Adventure Markdown Generator', () => {
  test('Markdownが正しく生成され、主要セクションとおまもり引用が含まれること', () => {
    const state: CliState = {
      version: '1.0.0',
      seed: 'TEST-W46',
      ruleset_version: '1.0.0',
      setup: sampleSetup,
      omamori_name: '冷えたカレーパン',
      omamori_used: true,
      omamori_floor: 2,
      omamori_excuse: 'カレーパンの香りでゴーレムのセンサーが狂った。',
      current_floor: 2,
      current_hp: 9,
      phase: 'FINISHED',
      pending_check: null,
      history: sampleLog,
      cause_of_death: null,
      outcome: 'gameover',
    };

    const md = generateAdventureMd({ state, logHash: 'a1b2c3d4e5f6' });

    // ヘッダー・サマリー
    expect(md).toContain('白銀 亜衣');
    expect(md).toContain('深淵の知恵の林檎');
    expect(md).toContain('TEST-W46');
    expect(md).toContain('a1b2c3d4e5f6');

    // 作風5軸
    expect(md).toContain('ビビり');
    expect(md).toContain('やけくそ');
    expect(md).toContain('本の知識');

    // 全階層の軌跡（新カードフォーマット）
    expect(md).toContain('【第1幕】プロンプト平原（1F〜6F）');
    expect(md).toContain('1F｜乱数シードの間欠泉');
    expect(md).not.toContain('[浅層]');
    expect(md).toContain('ガードレール展開。周期を測って進む');
    expect(md).toContain('ノーブレーキ突破！一気に駆け抜ける');
    expect(md).toContain('思惑');
    expect(md).toContain('まずは慎重に通過');

    // おまもり発動の強調引用
    expect(md).toContain('おまもり発動！【冷えたカレーパン】');
    expect(md).toContain('カレーパンの香りでゴーレムのセンサーが狂った。');

    // エピローグ＆サマリー
    expect(md).toContain('エピローグ：冒険者の手記');
    expect(md).toContain('探索サマリー＆公式記録');
  });
});
