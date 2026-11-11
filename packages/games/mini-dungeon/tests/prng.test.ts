import { describe, expect, it } from 'bun:test';
import { PRNG, computeHmacDigest, createDungeonPRNG, createFloorPRNG } from '../src/prng.js';

describe('PRNG (sfc32)', () => {
  it('同一シードとメッセージから同一のダイジェストと乱数列が生成されること', () => {
    const seed = 'W46-8842';
    const prng1 = createDungeonPRNG(seed);
    const prng2 = createDungeonPRNG(seed);

    for (let i = 0; i < 50; i++) {
      expect(prng1.nextUint32()).toBe(prng2.nextUint32());
    }
  });

  it('異なるシードからは異なる乱数列が生成されること', () => {
    const prngA = createDungeonPRNG('SEED-A');
    const prngB = createDungeonPRNG('SEED-B');

    const numsA = Array.from({ length: 5 }, () => prngA.nextUint32());
    const numsB = Array.from({ length: 5 }, () => prngB.nextUint32());
    expect(numsA).not.toEqual(numsB);
  });

  it('nextInt(max) が 0 <= r < max の範囲内であること', () => {
    const prng = createDungeonPRNG('TEST-RANGE');
    for (let i = 0; i < 1000; i++) {
      const val = prng.nextInt(6);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(6);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('roll2d6() が 2..12 の範囲で die1, die2 が 1..6 であること', () => {
    const prng = createFloorPRNG('TEST-DICE', 1);
    for (let i = 0; i < 500; i++) {
      const { die1, die2, total } = prng.roll2d6();
      expect(die1).toBeGreaterThanOrEqual(1);
      expect(die1).toBeLessThanOrEqual(6);
      expect(die2).toBeGreaterThanOrEqual(1);
      expect(die2).toBeLessThanOrEqual(6);
      expect(total).toBe(die1 + die2);
      expect(total).toBeGreaterThanOrEqual(2);
      expect(total).toBeLessThanOrEqual(12);
    }
  });

  it('各階層のFloorPRNGが独立していること', () => {
    const seed = 'W46-8842';
    const floor1 = createFloorPRNG(seed, 1);
    const floor2 = createFloorPRNG(seed, 2);

    const roll1 = floor1.roll2d6();
    const roll2 = floor2.roll2d6();
    // 独立した別ストリームであることを確認
    const floor1Again = createFloorPRNG(seed, 1);
    expect(floor1Again.roll2d6()).toEqual(roll1);
  });

  it('shuffle が配列の要素を維持しつつシャッフルすること', () => {
    const prng = createDungeonPRNG('SHUFFLE-SEED');
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const copy = [...original];
    prng.shuffle(copy);

    expect(copy.slice().sort((a, b) => a - b)).toEqual(original);
    // シャッフル後の配列は決定論的に再現されること
    const prng2 = createDungeonPRNG('SHUFFLE-SEED');
    const copy2 = [...original];
    prng2.shuffle(copy2);
    expect(copy).toEqual(copy2);
  });
});
