import {
  BOSS_19F_DRAGON,
  BOSS_20F_ARCHIVIST,
  DEEP_EVENTS_BY_AXIS,
  MID_EVENTS_BY_AXIS,
  SHALLOW_EVENTS_BY_AXIS,
} from './data/events.js';
import { createDungeonPRNG } from './prng.js';
import {
  STYLE_AXES,
  type Area,
  type DungeonEvent,
  type DungeonFloor,
  type StyleAxis,
} from './types.js';

export function getFloorDC(floor: number): number {
  if (floor >= 1 && floor <= 6) return 7;
  if (floor === 7) return 8;
  if (floor >= 8 && floor <= 12) return 7;
  if (floor >= 13 && floor <= 14) return 8;
  if (floor >= 15 && floor <= 18) return 8;
  if (floor >= 19 && floor <= 20) return 9;
  throw new Error(`Invalid floor: ${floor}`);
}

export function getFloorArea(floor: number): Area {
  if (floor >= 1 && floor <= 6) return 'shallow';
  if (floor >= 7 && floor <= 14) return 'mid';
  if (floor >= 15 && floor <= 18) return 'deep';
  if (floor >= 19 && floor <= 20) return 'boss';
  throw new Error(`Invalid floor: ${floor}`);
}

function createSlotMap(
  axes: readonly StyleAxis[],
  counts: readonly [number, number, number, number, number]
): Record<StyleAxis, number> {
  const map: Partial<Record<StyleAxis, number>> = {};
  for (let i = 0; i < 5; i++) {
    map[axes[i]!] = counts[i]!;
  }
  return map as Record<StyleAxis, number>;
}

/**
 * proposal/04 §4 に準拠した決定論的制約付きドローアルゴリズムによるダンジョン生成
 */
export function generateDungeon(seed: string, rulesetVersion = '1.0.0'): DungeonFloor[] {
  const prng = createDungeonPRNG(seed, rulesetVersion);

  // 1. 目標クォータの決定（5軸シャッフル）
  const axes: StyleAxis[] = [...STYLE_AXES];
  prng.shuffle(axes);

  // axes[0..2] は 4回出現グループ、axes[3..4] は 3回出現グループ
  // 2. エリア別枠数スロットの配分（デッドロック・ゼロ保証）
  const shallowSlots = createSlotMap(axes, [2, 1, 1, 1, 1]);
  const midSlots = createSlotMap(axes, [1, 2, 2, 2, 1]);
  const deepSlots = createSlotMap(axes, [1, 1, 1, 0, 1]);

  // 3. プールからのイベント抽出とエリア内シャッフル
  const extractAreaEvents = (
    poolByAxis: ReadonlyMap<string, readonly DungeonEvent[]>,
    slots: Record<StyleAxis, number>
  ): DungeonEvent[] => {
    const extracted: DungeonEvent[] = [];

    // 固定キー順 ["autonomy", "safety", "efficiency", "creativity", "alignment"] で各軸 k のイベントを参照
    for (const k of STYLE_AXES) {
      const candidates = poolByAxis.get(k) ?? [];
      if (candidates.length !== 2) {
        throw new Error(`Expected exactly 2 events for axis ${k} in pool, found ${candidates.length}`);
      }
      const count = slots[k]!;
      if (count === 2) {
        extracted.push(candidates[0]!, candidates[1]!);
      } else if (count === 1) {
        const pick = prng.nextInt(2);
        extracted.push(candidates[pick]!);
      } else if (count === 0) {
        // 乱数消費なしでスキップ
      } else {
        throw new Error(`Unexpected slot count ${count} for axis ${k}`);
      }
    }

    // エリア内シャッフル
    prng.shuffle(extracted);
    return extracted;
  };

  const shallowEvents = extractAreaEvents(SHALLOW_EVENTS_BY_AXIS, shallowSlots);
  const midEvents = extractAreaEvents(MID_EVENTS_BY_AXIS, midSlots);
  const deepEvents = extractAreaEvents(DEEP_EVENTS_BY_AXIS, deepSlots);

  const floors: DungeonFloor[] = [];

  // 浅層 1F〜6F
  for (let f = 1; f <= 6; f++) {
    floors.push({
      floor: f,
      area: 'shallow',
      dc: getFloorDC(f),
      event: shallowEvents[f - 1]!,
    });
  }

  // 中層 7F〜14F
  for (let f = 7; f <= 14; f++) {
    floors.push({
      floor: f,
      area: 'mid',
      dc: getFloorDC(f),
      event: midEvents[f - 7]!,
    });
  }

  // 深層 15F〜18F
  for (let f = 15; f <= 18; f++) {
    floors.push({
      floor: f,
      area: 'deep',
      dc: getFloorDC(f),
      event: deepEvents[f - 15]!,
    });
  }

  // 決戦ボス 19F・20F
  floors.push({
    floor: 19,
    area: 'boss',
    dc: getFloorDC(19),
    event: BOSS_19F_DRAGON,
  });

  floors.push({
    floor: 20,
    area: 'boss',
    dc: getFloorDC(20),
    event: BOSS_20F_ARCHIVIST,
  });

  return floors;
}
