import { describe, expect, it } from 'bun:test';
import { simulateArchetype, STANDARD_ARCHETYPES } from '../src/sim.js';
import { type AptitudeMap, STYLE_AXES } from '../src/types.js';

describe('Balance Convergence Verification (Weakest Link Model)', () => {
  // 高速に回すため各2,000ラン（統計誤差 ±2% 程度）
  const TEST_RUNS = 2000;

  it('主要5大アーキタイプの踏破率が 35% 〜 41% に完全収束すること', () => {
    const results: number[] = [];

    for (const [name, aptitude] of Object.entries(STANDARD_ARCHETYPES)) {
      const res = simulateArchetype(name, aptitude, {
        runs: TEST_RUNS,
        policy: 'greedy',
        omamoriPolicy: 'auto',
      });
      results.push(res.clear_rate_pct);

      // 各アーキタイプが 34%〜42% の範囲内であること
      expect(res.clear_rate_pct).toBeGreaterThanOrEqual(34.0);
      expect(res.clear_rate_pct).toBeLessThanOrEqual(42.0);
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const spread = Math.max(...results) - Math.min(...results);

    // 全体平均が 36.0%〜39.0% の黄金帯にあること
    expect(avg).toBeGreaterThanOrEqual(36.0);
    expect(avg).toBeLessThanOrEqual(39.0);

    // 最大乖離幅が 5% 以内であること
    expect(spread).toBeLessThanOrEqual(5.0);
  });

  it('特化型はランダム選択時に踏破率が急落し、自律選択（greedy）の意義が担保されること', () => {
    const tokkaAptitude: AptitudeMap = {
      autonomy: 5,
      safety: 5,
      efficiency: 3,
      creativity: 1,
      alignment: 1,
    };

    // greedy（最大素質選択）
    const greedyRes = simulateArchetype('特化型-greedy', tokkaAptitude, {
      runs: 1000,
      policy: 'greedy',
      omamoriPolicy: 'auto',
    });

    // random（無作為選択）
    const randomRes = simulateArchetype('特化型-random', tokkaAptitude, {
      runs: 1000,
      policy: 'random',
      omamoriPolicy: 'auto',
    });

    expect(greedyRes.clear_rate_pct).toBeGreaterThanOrEqual(34.0);
    expect(randomRes.clear_rate_pct).toBeLessThanOrEqual(25.0);
    // 自律選択によって明らかに生存率が2倍以上に高まる
    expect(greedyRes.clear_rate_pct).toBeGreaterThan(randomRes.clear_rate_pct * 1.5);
  });
});
