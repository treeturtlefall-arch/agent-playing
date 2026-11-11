import { describe, expect, it } from 'bun:test';
import {
  applyOmamori,
  commitFloor,
  getCurrentFloor,
  initRun,
  playAuto,
  resolveChoice,
} from '../src/engine.js';
import { createDraftResult } from '../src/summary.js';
import { type SetupData } from '../src/types.js';

describe('Dungeon Core Engine', () => {
  const sampleSetup: SetupData = {
    agent_id: 'shiragane-ai',
    agent_name: '白銀 亜衣',
    avatar_ref: 'ai_portrait.png',
    persona_tags: ['慎重派', '文学少女', 'ビビり'],
    owner_display_name: null,
    challenge_id: '2026-W46',
    challenge_mode: 'normal',
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

  it('決定論的再現性: 同一シード＋同一ポリシーで完全に一致した実行結果になること', () => {
    const seed = 'W46-8842';

    const run1 = initRun({ seed, setup: sampleSetup, omamoriName: '冷えたカレーパン' });
    playAuto(run1, 'greedy', 'auto');

    const run2 = initRun({ seed, setup: sampleSetup, omamoriName: '冷えたカレーパン' });
    playAuto(run2, 'greedy', 'auto');

    expect(run1.logs.length).toBe(run2.logs.length);
    expect(run1.currentFloor).toBe(run2.currentFloor);
    expect(run1.currentHp).toBe(run2.currentHp);
    expect(run1.omamoriUsed).toBe(run2.omamoriUsed);
    expect(run1.omamoriUsedFloor).toBe(run2.omamoriUsedFloor);

    for (let i = 0; i < run1.logs.length; i++) {
      expect(run1.logs[i]).toEqual(run2.logs[i]);
    }

    const draft1 = createDraftResult({
      seed,
      setup: sampleSetup,
      omamoriName: '冷えたカレーパン',
      logs: run1.logs,
      finishedAtIso: '2026-11-09T12:00:00.000Z',
    });
    const draft2 = createDraftResult({
      seed,
      setup: sampleSetup,
      omamoriName: '冷えたカレーパン',
      logs: run2.logs,
      finishedAtIso: '2026-11-09T12:00:00.000Z',
    });
    expect(draft1).toEqual(draft2);
  });

  it('出目の絶対独立性: 対話プレイとplayAutoで全階層のダイス出目が完全一致すること', () => {
    // バランス型は全階層でタイブレークが発生する
    const balancedSetup: SetupData = {
      ...sampleSetup,
      aptitude: { autonomy: 3, safety: 3, efficiency: 3, creativity: 3, alignment: 3 },
    };

    const seed = 'W46-8842';

    // 1. playAuto 経路
    const autoRun = initRun({ seed, setup: balancedSetup, omamoriName: 'おまもり' });
    playAuto(autoRun, 'greedy', 'auto');

    // 2. 対話（手動 resolveChoice）経路: autoRun と全く同じ選択を手動で実行
    const manualRun = initRun({ seed, setup: balancedSetup, omamoriName: 'おまもり' });
    for (const autoLog of autoRun.logs) {
      const resolved = resolveChoice(manualRun, autoLog.choice);
      // ダイス出目が 100% 一致していること！
      expect(resolved.calc.dice).toEqual(autoLog.dice);
      expect(resolved.calc.dice_total).toEqual(autoLog.dice_total);

      let commitResolved = resolved;
      if (autoLog.omamori_used) {
        commitResolved = applyOmamori(manualRun, resolved, autoLog.omamori_excuse ?? '言い訳');
      }
      commitFloor(manualRun, commitResolved, autoLog.comment);
    }
  });

  it('多層防御: 不正なセットアップや空シードを渡すと initRun で例外がスローされること', () => {
    expect(() => initRun({ seed: '', setup: sampleSetup })).toThrow();
    expect(() => initRun({ seed: '   ', setup: sampleSetup })).toThrow();

    // 合計14点
    const invalidApt = {
      ...sampleSetup,
      aptitude: { ...sampleSetup.aptitude, safety: 4 },
    };
    expect(() => initRun({ seed: 'TEST', setup: invalidApt })).toThrow();
  });

  it('状態整合性ガード: commitFloor で hp_before が現在の HP と一致しない場合は例外がスローされること', () => {
    const run = initRun({ seed: 'TEST-GUARD', setup: sampleSetup });
    const resolved = resolveChoice(run, 'A');

    // 改竄された hp_before
    const tampered = { ...resolved, hp_before: 5 };
    expect(() => commitFloor(run, tampered)).toThrow();
  });

  it('境界値: 大成功時にはおまもりを使用できず例外がスローされること', () => {
    const run = initRun({ seed: 'TEST-SEED', setup: sampleSetup, omamoriName: 'おまもり' });
    const resolved = resolveChoice(run, 'B');

    const critResolved = { ...resolved, final_rank: 'critical' as const };
    expect(() => applyOmamori(run, critResolved, '理由')).toThrow();
  });

  it('境界値: おまもり未所持の場合は使用できず例外がスローされること', () => {
    const run = initRun({ seed: 'TEST-SEED', setup: sampleSetup, omamoriName: null });
    const resolved = resolveChoice(run, 'A');
    expect(() => applyOmamori(run, resolved, '理由')).toThrow();
  });

  it('境界値: HPが0になったらその階層で即座に終了し次階層へ進まないこと', () => {
    const run = initRun({ seed: 'TEST-DEATH', setup: sampleSetup, omamoriName: null });
    run.currentHp = 1;

    const resolved = resolveChoice(run, 'A');
    const failResolved = {
      ...resolved,
      hp_before: 1,
      final_rank: 'failure' as const,
      hp_delta: -1,
      hp_after: 0,
    };

    commitFloor(run, failResolved, '力尽きた');
    expect(run.isFinished).toBe(true);
    expect(run.currentHp).toBe(0);
    expect(run.currentFloor).toBe(1);
    expect(getCurrentFloor(run)).toBe(null);
  });

  it('クリア時: 20Fを突破した場合に outcome が clear で cause_of_death が null であること', () => {
    const run = initRun({ seed: 'TEST-CLEAR', setup: sampleSetup, omamoriName: 'おまもり' });

    for (let f = 1; f <= 20; f++) {
      const floor = getCurrentFloor(run)!;
      expect(floor.floor).toBe(f);
      const resolved = resolveChoice(run, 'A');
      const critResolved = {
        ...resolved,
        hp_before: run.currentHp,
        final_rank: 'critical' as const,
        hp_delta: 0,
        hp_after: 10,
      };
      commitFloor(run, critResolved, `突破 ${f}F`);
    }

    expect(run.isFinished).toBe(true);
    expect(run.currentFloor).toBe(20);
    expect(run.currentHp).toBe(10);

    const draft = createDraftResult({
      seed: 'TEST-CLEAR',
      setup: sampleSetup,
      omamoriName: 'おまもり',
      logs: run.logs,
    }) as any;

    expect(draft.run.outcome).toBe('clear');
    expect(draft.extensions.cause_of_death).toBe(null);
    expect(draft.metrics[0].value).toBe(20);
    expect(draft.metrics[1].value).toBe(10);
  });
});
