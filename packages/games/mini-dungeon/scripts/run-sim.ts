import { simulateArchetype, STANDARD_ARCHETYPES, type SimulationResult } from '../src/sim.js';

const USAGE = [
  'Usage: run-sim [--runs <N>] [--policy greedy|random] [--omamori auto|none]',
  '       run-sim [runs] [policy] [omamori]   (従来の位置引数も可)',
  '  --runs <N>     各アーキタイプの試行回数（1以上の整数、既定: 50000）',
  '  --policy       greedy | random（既定: greedy）',
  '  --omamori      auto | none（既定: auto）',
].join('\n');

interface SimArgs {
  runs: number;
  policy: 'greedy' | 'random';
  omamoriPolicy: 'auto' | 'none';
}

function parseSimArgs(argv: string[]): SimArgs {
  let runsRaw: string | undefined;
  let policyRaw: string | undefined;
  let omamoriRaw: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    }
    // --name=value 形式
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq >= 0 ? arg.slice(0, eq) : arg;
    const inlineValue = eq >= 0 ? arg.slice(eq + 1) : undefined;
    if (name === '--runs' || name === '--policy' || name === '--omamori') {
      const value = inlineValue ?? argv[++i];
      if (value === undefined) {
        throw new Error(`${name} には値が必要です。\n${USAGE}`);
      }
      if (name === '--runs') runsRaw = value;
      else if (name === '--policy') policyRaw = value;
      else omamoriRaw = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`不明なオプションです: ${arg}\n${USAGE}`);
    } else {
      positional.push(arg);
    }
  }

  // 位置引数（後方互換）: 名前付きで指定されなかった項目だけを補う
  runsRaw ??= positional[0];
  policyRaw ??= positional[1];
  omamoriRaw ??= positional[2];
  if (positional.length > 3) {
    throw new Error(`位置引数が多すぎます。\n${USAGE}`);
  }

  const runs = runsRaw === undefined ? 50000 : Number(runsRaw);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs は1以上の整数で指定してください（受け取った値: ${runsRaw}）。\n${USAGE}`);
  }
  const policy = policyRaw ?? 'greedy';
  if (policy !== 'greedy' && policy !== 'random') {
    throw new Error(`--policy は greedy | random のいずれかです（受け取った値: ${policyRaw}）。\n${USAGE}`);
  }
  const omamoriPolicy = omamoriRaw ?? 'auto';
  if (omamoriPolicy !== 'auto' && omamoriPolicy !== 'none') {
    throw new Error(`--omamori は auto | none のいずれかです（受け取った値: ${omamoriRaw}）。\n${USAGE}`);
  }

  return { runs, policy, omamoriPolicy };
}

let runs: number;
let policy: 'greedy' | 'random';
let omamoriPolicy: 'auto' | 'none';
try {
  ({ runs, policy, omamoriPolicy } = parseSimArgs(process.argv.slice(2)));
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

console.log('================================================================');
console.log(' mini-dungeon モンテカルロシミュレーション検証');
console.log('================================================================');
console.log(`試行回数: 各アーキタイプ ${runs.toLocaleString()} 回（計${(runs * Object.keys(STANDARD_ARCHETYPES).length).toLocaleString()}回ラン）`);
console.log(`ポリシー: ${policy} / おまもり: ${omamoriPolicy}\n`);

const results: SimulationResult[] = [];
const overallStartTime = Date.now();

for (const [name, aptitude] of Object.entries(STANDARD_ARCHETYPES)) {
  const startTime = Date.now();
  const res = simulateArchetype(name, aptitude, {
    runs,
    policy,
    omamoriPolicy,
  });
  const elapsed = Date.now() - startTime;
  results.push(res);
  console.log(
    `[${name.padEnd(25)}] 踏破率: ${res.clear_rate_pct.toFixed(2)}% | 平均到達: ${res.avg_floor_reached}F | おまもり使用率: ${res.omamori_used_rate_pct}% (${elapsed}ms)`
  );
}

const totalElapsed = Date.now() - overallStartTime;

console.log('\n================================================================');
console.log(' シミュレーション統計集計結果');
console.log('================================================================');
const rates = results.map((r) => r.clear_rate_pct);
const avgRate = (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2);
const minRate = Math.min(...rates).toFixed(2);
const maxRate = Math.max(...rates).toFixed(2);

console.log(`総試行数: ${(runs * results.length).toLocaleString()} 回`);
console.log(`総実行時間: ${totalElapsed}ms (${(totalElapsed / 1000).toFixed(2)}秒)`);
console.log(`平均踏破率: ${avgRate}%`);
console.log(`踏破率範囲: ${minRate}% 〜 ${maxRate}% (最大乖離幅: ${(Number(maxRate) - Number(minRate)).toFixed(2)}%)`);
