import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.resolve('packages/games/mini-dungeon/scripts/run-sim.ts');

function runScript(args: string[]) {
  return spawnSync('bun', ['run', SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 30000,
  });
}

describe('run-sim script argument parsing', () => {
  test('名前付き引数 (--runs / --policy / --omamori) が解釈され NaN にならないこと', () => {
    const res = runScript(['--runs', '5', '--policy', 'greedy', '--omamori', 'auto']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('各アーキタイプ 5 回');
    expect(res.stdout).not.toContain('NaN');
  });

  test('--name=value 形式も解釈されること', () => {
    const res = runScript(['--runs=5', '--policy=random', '--omamori=none']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('各アーキタイプ 5 回');
    expect(res.stdout).not.toContain('NaN');
  });

  test('従来の位置引数も引き続き動くこと', () => {
    const res = runScript(['5', 'greedy', 'auto']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('各アーキタイプ 5 回');
    expect(res.stdout).not.toContain('NaN');
  });

  test('不正な --runs は NaN で完走せずエラー終了すること', () => {
    const res = runScript(['--runs', 'abc']);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('--runs');
  });

  test('不明なオプションはエラー終了すること', () => {
    const res = runScript(['--bogus', '1']);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('不明なオプション');
  });
});
