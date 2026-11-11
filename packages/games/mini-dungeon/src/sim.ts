import { initRun, playAuto, type DecisionPolicy, type OmamoriPolicy } from './engine.js';
import { validateSetup } from './summary.js';
import { type AptitudeMap, type StyleAxis, STYLE_AXES } from './types.js';

export interface SimulationConfig {
  runs: number;
  policy: DecisionPolicy;
  omamoriPolicy: OmamoriPolicy;
  seedPrefix?: string;
  omamoriName?: string | null;
}

export interface SimulationResult {
  archetype_name: string;
  aptitude: AptitudeMap;
  runs: number;
  policy: DecisionPolicy;
  omamori_policy: OmamoriPolicy;
  clear_count: number;
  clear_rate_pct: number;
  avg_floor_reached: number;
  avg_remaining_hp: number;
  omamori_used_count: number;
  omamori_used_rate_pct: number;
  avg_critical_count: number;
  avg_fumble_count: number;
  deaths_by_floor: Record<number, number>;
}

export const STANDARD_ARCHETYPES: Record<string, AptitudeMap> = {
  'バランス型 (All 3)': {
    autonomy: 3,
    safety: 3,
    efficiency: 3,
    creativity: 3,
    alignment: 3,
  },
  '二点特化型 (5, 5, 3, 1, 1)': {
    autonomy: 5,
    safety: 5,
    efficiency: 3,
    creativity: 1,
    alignment: 1,
  },
  '三拍子型 (4, 4, 4, 2, 1)': {
    autonomy: 4,
    safety: 4,
    efficiency: 4,
    creativity: 2,
    alignment: 1,
  },
  '極振り型 (5, 5, 5, 0, 0)': {
    autonomy: 5,
    safety: 5,
    efficiency: 5,
    creativity: 0,
    alignment: 0,
  },
  '白銀亜衣型 (1, 5, 3, 4, 2)': {
    autonomy: 1,
    safety: 5,
    efficiency: 3,
    creativity: 4,
    alignment: 2,
  },
};

export function simulateArchetype(
  name: string,
  aptitude: AptitudeMap,
  config: SimulationConfig
): SimulationResult {
  const { runs, policy, omamoriPolicy, seedPrefix = 'sim', omamoriName = 'おまもり' } = config;

  let clearCount = 0;
  let totalFloors = 0;
  let totalHp = 0;
  let omamoriUsedCount = 0;
  let totalCrits = 0;
  let totalFumbles = 0;
  const deathsByFloor: Record<number, number> = {};

  for (let f = 1; f <= 20; f++) {
    deathsByFloor[f] = 0;
  }

  const validatedDummySetup = validateSetup({
    agent_id: 'sim-bot',
    agent_name: name,
    artifact_goal: 'テストアーティファクト',
    aptitude,
    style_axis_labels: {
      autonomy: '自律性',
      safety: '安全性',
      efficiency: '効率性',
      creativity: '創発性',
      alignment: '親和性',
    },
  }).data!;

  for (let i = 0; i < runs; i++) {
    const seed = `${seedPrefix}-${i + 1}`;
    const runState = initRun({
      seed,
      setup: validatedDummySetup,
      omamoriName: omamoriPolicy === 'none' ? null : omamoriName,
      skipValidation: true,
    });

    playAuto(runState, policy, omamoriPolicy);

    const floorReached = runState.logs.length > 0 ? runState.logs[runState.logs.length - 1]!.floor : 0;
    const finalHp = runState.currentHp;
    totalFloors += floorReached;
    totalHp += Math.max(0, finalHp);

    if (finalHp > 0 && floorReached === 20) {
      clearCount++;
    } else {
      deathsByFloor[floorReached] = (deathsByFloor[floorReached] || 0) + 1;
    }

    if (runState.omamoriUsed) {
      omamoriUsedCount++;
    }

    for (const log of runState.logs) {
      if (log.final_rank === 'critical') totalCrits++;
      if (log.final_rank === 'fumble') totalFumbles++;
    }
  }

  return {
    archetype_name: name,
    aptitude,
    runs,
    policy,
    omamori_policy: omamoriPolicy,
    clear_count: clearCount,
    clear_rate_pct: Number(((clearCount / runs) * 100).toFixed(2)),
    avg_floor_reached: Number((totalFloors / runs).toFixed(2)),
    avg_remaining_hp: Number((totalHp / runs).toFixed(2)),
    omamori_used_count: omamoriUsedCount,
    omamori_used_rate_pct: Number(((omamoriUsedCount / runs) * 100).toFixed(2)),
    avg_critical_count: Number((totalCrits / runs).toFixed(2)),
    avg_fumble_count: Number((totalFumbles / runs).toFixed(2)),
    deaths_by_floor: deathsByFloor,
  };
}
