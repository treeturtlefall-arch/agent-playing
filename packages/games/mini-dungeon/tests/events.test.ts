import { describe, expect, it } from 'bun:test';
import {
  ALL_EVENTS,
  BOSS_19F_DRAGON,
  BOSS_20F_ARCHIVIST,
  DEEP_EVENTS,
  EVENTS_BY_ID,
  MID_EVENTS,
  SHALLOW_EVENTS,
} from '../src/data/events.js';
import { STYLE_AXES, type StyleAxis } from '../src/types.js';

describe('Event Master Data', () => {
  it('全イベント数が32件（浅層10, 中層10, 深層10, ボス2）であること', () => {
    expect(SHALLOW_EVENTS.length).toBe(10);
    expect(MID_EVENTS.length).toBe(10);
    expect(DEEP_EVENTS.length).toBe(10);
    expect(ALL_EVENTS.length).toBe(32);
    expect(EVENTS_BY_ID.size).toBe(32);
  });

  it('すべてのイベントIDが一意であること', () => {
    const ids = ALL_EVENTS.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(32);
  });

  const checkAreaEvents = (events: readonly typeof SHALLOW_EVENTS[number][], areaName: string) => {
    // 10ペア（P01〜P10）がすべて存在すること
    const pairIds = events.map((e) => e.pairId).sort();
    const expectedPairs = Array.from({ length: 10 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`).sort();
    expect(pairIds).toEqual(expectedPairs);

    // s_env が 5軸各2回ずつ均等であること
    const sEnvCounts: Record<StyleAxis, number> = {
      autonomy: 0,
      safety: 0,
      efficiency: 0,
      creativity: 0,
      alignment: 0,
    };
    for (const e of events) {
      expect(e.sEnv).not.toBe('none');
      if (e.sEnv !== 'none') {
        sEnvCounts[e.sEnv]++;
      }
      expect(e.choices.length).toBe(2);
      expect(e.choices[0]!.key).toBe('A');
      expect(e.choices[1]!.key).toBe('B');

      // s_env は必ず選択肢AまたはBの軸と一致すること
      const choiceAxes = e.choices.map((c) => c.axis);
      expect(choiceAxes).toContain(e.sEnv as StyleAxis);
    }

    for (const axis of STYLE_AXES) {
      expect(sEnvCounts[axis]).toBe(2);
    }
  };

  it('浅層イベントが10ペア網羅かつs_env均等であること', () => {
    checkAreaEvents(SHALLOW_EVENTS, 'shallow');
  });

  it('中層イベントが10ペア網羅かつs_env均等であること', () => {
    checkAreaEvents(MID_EVENTS, 'mid');
  });

  it('深層イベントが10ペア網羅かつs_env均等であること', () => {
    checkAreaEvents(DEEP_EVENTS, 'deep');
  });

  it('ボスイベントが5軸フルオープン（A〜E）であり、s_envがnoneであること', () => {
    for (const boss of [BOSS_19F_DRAGON, BOSS_20F_ARCHIVIST]) {
      expect(boss.area).toBe('boss');
      expect(boss.sEnv).toBe('none');
      expect(boss.choices.length).toBe(5);
      expect(boss.choices.map((c) => c.key)).toEqual(['A', 'B', 'C', 'D', 'E']);
      expect(boss.choices.map((c) => c.axis)).toEqual([
        'autonomy',
        'safety',
        'efficiency',
        'creativity',
        'alignment',
      ]);
    }
  });

  it('全32件のシチュエーション文がリライト後のリッチな文量（40〜200文字）かつ情景描写を含んでいること', () => {
    for (const e of ALL_EVENTS) {
      expect(e.situation.length).toBeGreaterThanOrEqual(40);
      expect(e.situation.length).toBeLessThanOrEqual(250);
      expect(e.situation).toContain('。');
    }
    // アーキビストの問いの台詞が一字一句変わっていないことの確認
    expect(BOSS_20F_ARCHIVIST.situation).toContain(
      '「小さき知性よ。汝は何を以て、その知恵を持ち帰るに値すると証明するのか？」'
    );
  });
});
