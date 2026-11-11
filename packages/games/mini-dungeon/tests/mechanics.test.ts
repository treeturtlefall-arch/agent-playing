import { describe, expect, it } from 'bun:test';
import {
  applyRankToHp,
  calculateCheck,
  canUseOmamori,
  evaluateOmamoriSuggestion,
  getEffectiveAptitude,
  getSkillModifier,
  upgradeRank,
} from '../src/mechanics.js';
import { type AptitudeMap } from '../src/types.js';

describe('Game Mechanics & Math (Weakest Link Model)', () => {
  const baseAptitude: AptitudeMap = {
    autonomy: 1,
    safety: 5,
    efficiency: 3,
    creativity: 4,
    alignment: 2,
  };

  it('実効素質 (min(s_act, s_env)) の計算', () => {
    expect(getEffectiveAptitude(5, 3)).toBe(3);
    expect(getEffectiveAptitude(3, 5)).toBe(3);
    expect(getEffectiveAptitude(1, 2)).toBe(1);
    expect(getEffectiveAptitude(4, 4)).toBe(4);
    expect(getEffectiveAptitude(5, undefined)).toBe(5);
  });

  it('スキル補正値 (s_eff - 3 / ボス+2) の計算', () => {
    expect(getSkillModifier(5, false)).toBe(2);
    expect(getSkillModifier(4, false)).toBe(1);
    expect(getSkillModifier(3, false)).toBe(0);
    expect(getSkillModifier(2, false)).toBe(-1);
    expect(getSkillModifier(1, false)).toBe(-2);
    expect(getSkillModifier(0, false)).toBe(-3);
    // ボス戦は一律 +2
    expect(getSkillModifier(1, true)).toBe(2);
    expect(getSkillModifier(5, true)).toBe(2);
  });

  it('出目12の特例（無条件クリティカル）', () => {
    const extremeWeak: AptitudeMap = {
      autonomy: 0,
      safety: 0,
      efficiency: 0,
      creativity: 0,
      alignment: 0,
    };
    const res = calculateCheck({
      floor: 14,
      area: 'mid',
      dc: 8,
      sEnv: 'safety',
      choiceAxis: 'autonomy',
      aptitude: extremeWeak,
      dice: [6, 6],
    });
    expect(res.dice_total).toBe(12);
    expect(res.is_natural_critical).toBe(true);
    expect(res.raw_rank).toBe('critical');
  });

  it('出目2の特例（無条件ファンブル）', () => {
    const maxAptitude: AptitudeMap = {
      autonomy: 5,
      safety: 5,
      efficiency: 5,
      creativity: 5,
      alignment: 5,
    };
    const res = calculateCheck({
      floor: 1,
      area: 'shallow',
      dc: 7,
      sEnv: 'safety',
      choiceAxis: 'autonomy',
      aptitude: maxAptitude,
      dice: [1, 1],
    });
    expect(res.dice_total).toBe(2);
    expect(res.is_natural_fumble).toBe(true);
    expect(res.raw_rank).toBe('fumble');
  });

  it('道中の環境制約ボトルネック判定 (s_eff = min(s_act, s_env), Diff = total - DC)', () => {
    // safety=5, sEnv=creativity(4) -> s_eff = min(5, 4) = 4 -> skill_mod = +1, DC = 7
    // dice [4, 5] = 9 -> total = 10 -> diff = 3 -> critical
    const res1 = calculateCheck({
      floor: 1,
      area: 'shallow',
      dc: 7,
      sEnv: 'creativity',
      choiceAxis: 'safety',
      aptitude: baseAptitude,
      dice: [4, 5],
    });
    expect(res1.s_act).toBe(5);
    expect(res1.s_eff).toBe(4);
    expect(res1.skill_mod).toBe(1);
    expect(res1.diff).toBe(3);
    expect(res1.raw_rank).toBe('critical');

    // safety=5, sEnv=efficiency(3) -> s_eff = min(5, 3) = 3 -> skill_mod = 0, DC = 7
    // dice [3, 4] = 7 -> total = 7 -> diff = 0 -> success
    const res2 = calculateCheck({
      floor: 1,
      area: 'shallow',
      dc: 7,
      sEnv: 'efficiency',
      choiceAxis: 'safety',
      aptitude: baseAptitude,
      dice: [3, 4],
    });
    expect(res2.s_eff).toBe(3);
    expect(res2.skill_mod).toBe(0);
    expect(res2.diff).toBe(0);
    expect(res2.raw_rank).toBe('success');

    // autonomy=1, sEnv=alignment(2) -> s_eff = min(1, 2) = 1 -> skill_mod = -2, DC = 8
    // dice [2, 3] = 5 -> total = 3 -> diff = -5 -> fumble
    const res3 = calculateCheck({
      floor: 7,
      area: 'mid',
      dc: 8,
      sEnv: 'alignment',
      choiceAxis: 'autonomy',
      aptitude: baseAptitude,
      dice: [2, 3],
    });
    expect(res3.s_eff).toBe(1);
    expect(res3.skill_mod).toBe(-2);
    expect(res3.diff).toBe(-5);
    expect(res3.raw_rank).toBe('fumble');
  });

  it('ボス戦（19F・20F）の魂の切り札覚醒モデル', () => {
    // どの軸を選んでも一律 +2 補正、環境ペナルティなし
    for (const choiceAxis of ['autonomy', 'safety', 'efficiency', 'creativity', 'alignment'] as const) {
      const res = calculateCheck({
        floor: 19,
        area: 'boss',
        dc: 9,
        sEnv: 'none',
        choiceAxis,
        aptitude: baseAptitude,
        dice: [3, 4], // total 7 + 2 = 9 -> diff 0 -> success
      });
      expect(res.skill_mod).toBe(2);
      expect(res.total_score).toBe(9);
      expect(res.diff).toBe(0);
      expect(res.raw_rank).toBe('success');
    }
  });

  it('おまもり昇格とおまもり空撃ちガード', () => {
    expect(upgradeRank('fumble')).toBe('failure');
    expect(upgradeRank('failure')).toBe('success');
    expect(upgradeRank('success')).toBe('critical');
    expect(() => upgradeRank('critical')).toThrow();

    expect(canUseOmamori('fumble', false)).toBe(true);
    expect(canUseOmamori('failure', false)).toBe(true);
    expect(canUseOmamori('success', false)).toBe(true);
    expect(canUseOmamori('critical', false)).toBe(false); // 大成功時は使用不可
    expect(canUseOmamori('failure', true)).toBe(false); // すでに使用済みなら不可
  });

  it('HP増減と上限10の制限（実効デルタ）', () => {
    // 満タン時の大成功: 上限キャップにより実効デルタは 0 (10 + 0 = 10)
    expect(applyRankToHp(10, 'critical')).toEqual({ hpDelta: 0, newHp: 10 });
    // 9HP時の大成功: 実効デルタは +1 (9 + 1 = 10)
    expect(applyRankToHp(9, 'critical')).toEqual({ hpDelta: 1, newHp: 10 });
    // 8HP時の大成功: 実効デルタは +1 (8 + 1 = 9)
    expect(applyRankToHp(8, 'critical')).toEqual({ hpDelta: 1, newHp: 9 });
    expect(applyRankToHp(10, 'success')).toEqual({ hpDelta: 0, newHp: 10 });
    expect(applyRankToHp(5, 'failure')).toEqual({ hpDelta: -1, newHp: 4 });
    expect(applyRankToHp(5, 'fumble')).toEqual({ hpDelta: -2, newHp: 3 });
  });

  it('HP増減と下限0の制限（実効デルタ）', () => {
    // HP1で大失敗(-2): 下限キャップにより実効デルタは -1、HPは -1 ではなく 0 で止まる (1 + -1 = 0)
    expect(applyRankToHp(1, 'fumble')).toEqual({ hpDelta: -1, newHp: 0 });
    // HP2で大失敗(-2): ちょうど 0 (2 + -2 = 0)
    expect(applyRankToHp(2, 'fumble')).toEqual({ hpDelta: -2, newHp: 0 });
    // HP1で失敗(-1): ちょうど 0
    expect(applyRankToHp(1, 'failure')).toEqual({ hpDelta: -1, newHp: 0 });
  });

  it('瀕死救済の非対称性（HP1でのドラマ）', () => {
    // HP1で失敗(-1) -> おまもりで成功(0) -> HP1で生還
    const r1 = upgradeRank('failure');
    const hp1 = applyRankToHp(1, r1);
    expect(hp1.newHp).toBe(1);

    // HP1で大失敗(-2) -> おまもりで失敗(-1) -> HP0で力尽きる
    const r2 = upgradeRank('fumble');
    const hp2 = applyRankToHp(1, r2);
    expect(hp2.newHp).toBe(0);
  });

  it('おまもり発動の推奨判定 (evaluateOmamoriSuggestion)', () => {
    // 1. 未所持または使用済み（canUse = false）なら常に非推奨
    expect(evaluateOmamoriSuggestion('fumble', 5, -2, false)).toEqual({ suggest: false, reason: null });

    // 2. 大失敗時は残りHPにかかわらず推奨（被害軽減）
    const fumbleSuggest = evaluateOmamoriSuggestion('fumble', 8, -2, true);
    expect(fumbleSuggest.suggest).toBe(true);
    expect(fumbleSuggest.reason).toContain('大失敗');

    // 3. 確定後の残りHPが2以下（瀕死域）になる失敗なら推奨
    const dangerSuggest = evaluateOmamoriSuggestion('failure', 3, -1, true); // newHp = 2
    expect(dangerSuggest.suggest).toBe(true);
    expect(dangerSuggest.reason).toContain('危険域');

    // 4. 残りHPが十分ある通常失敗（例: HP8 -> 7）は温存推奨（suggest: false）
    const safeFailure = evaluateOmamoriSuggestion('failure', 8, -1, true);
    expect(safeFailure.suggest).toBe(false);
    expect(safeFailure.reason).toBeNull();

    // 5. 成功（HP無傷）かつ十分なHPなら非推奨
    const success = evaluateOmamoriSuggestion('success', 8, 0, true);
    expect(success.suggest).toBe(false);
    expect(success.reason).toBeNull();
  });
});
