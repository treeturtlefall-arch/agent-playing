import { describe, expect, it } from 'bun:test';
import { generateDungeon, getFloorArea, getFloorDC } from '../src/generator.js';
import { STYLE_AXES, type StyleAxis } from '../src/types.js';

describe('Dungeon Generator', () => {
  it('DCカーブとエリア判定が確定仕様に一致すること', () => {
    const expectedDCs = [
      7, 7, 7, 7, 7, 7, // 1-6F
      8,                // 7F (難所)
      7, 7, 7, 7, 7,    // 8-12F (息継ぎ)
      8, 8,             // 13-14F (関門)
      8, 8, 8, 8,       // 15-18F (深層)
      9, 9,             // 19-20F (ボス)
    ];

    for (let f = 1; f <= 20; f++) {
      expect(getFloorDC(f)).toBe(expectedDCs[f - 1]!);
      if (f <= 6) expect(getFloorArea(f)).toBe('shallow');
      else if (f <= 14) expect(getFloorArea(f)).toBe('mid');
      else if (f <= 18) expect(getFloorArea(f)).toBe('deep');
      else expect(getFloorArea(f)).toBe('boss');
    }
  });

  it('生成されたダンジョンが20階層で決定論的に再現されること', () => {
    const seed = 'W46-8842';
    const dungeon1 = generateDungeon(seed);
    const dungeon2 = generateDungeon(seed);

    expect(dungeon1.length).toBe(20);
    expect(dungeon2.length).toBe(20);

    for (let f = 0; f < 20; f++) {
      expect(dungeon1[f]!.floor).toBe(f + 1);
      expect(dungeon1[f]!.event.id).toBe(dungeon2[f]!.event.id);
      expect(dungeon1[f]!.dc).toBe(dungeon2[f]!.dc);
      expect(dungeon1[f]!.area).toBe(dungeon2[f]!.area);
    }

    expect(dungeon1[18]!.event.id).toBe('B_19F_DRAGON');
    expect(dungeon1[19]!.event.id).toBe('B_20F_ARCHIVIST');
  });

  it('多数のシードで道中18階層のs_envが「3軸が4回、2軸が3回」の数学的保証を満たすこと', () => {
    const testSeeds = [
      'W46-8842',
      'TEST-SEED-1',
      'ALPHA',
      'BETA',
      'GAMMA',
      'DELTA',
      'EPSILON',
      'ZETA',
      '2026-W47',
      'MUSE-AGENT-007',
    ];

    for (const seed of testSeeds) {
      const dungeon = generateDungeon(seed);
      expect(dungeon.length).toBe(20);

      const sEnvCounts: Record<StyleAxis, number> = {
        autonomy: 0,
        safety: 0,
        efficiency: 0,
        creativity: 0,
        alignment: 0,
      };

      const eventIdsInArea = {
        shallow: new Set<string>(),
        mid: new Set<string>(),
        deep: new Set<string>(),
      };

      // 1F〜18F
      for (let f = 0; f < 18; f++) {
        const floor = dungeon[f]!;
        expect(floor.event.sEnv).not.toBe('none');
        sEnvCounts[floor.event.sEnv as StyleAxis]++;

        if (floor.area === 'shallow') {
          expect(eventIdsInArea.shallow.has(floor.event.id)).toBe(false);
          eventIdsInArea.shallow.add(floor.event.id);
        } else if (floor.area === 'mid') {
          expect(eventIdsInArea.mid.has(floor.event.id)).toBe(false);
          eventIdsInArea.mid.add(floor.event.id);
        } else if (floor.area === 'deep') {
          expect(eventIdsInArea.deep.has(floor.event.id)).toBe(false);
          eventIdsInArea.deep.add(floor.event.id);
        }
      }

      // 各エリアの選出数チェック
      expect(eventIdsInArea.shallow.size).toBe(6);
      expect(eventIdsInArea.mid.size).toBe(8);
      expect(eventIdsInArea.deep.size).toBe(4);

      // 3軸が4回、2軸が3回
      const counts = Object.values(sEnvCounts).sort((a, b) => b - a);
      expect(counts).toEqual([4, 4, 4, 3, 3]);

      // ボス2階層
      expect(dungeon[18]!.event.sEnv).toBe('none');
      expect(dungeon[19]!.event.sEnv).toBe('none');
    }
  });
});
