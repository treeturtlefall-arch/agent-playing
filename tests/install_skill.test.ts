import { describe, expect, test, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dir, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'install_skill.sh');
const SKILLS = ['mini-dungeon-player', 'result-card-renderer'] as const;

let fakeHome: string | null = null;

afterEach(() => {
  if (fakeHome && fs.existsSync(fakeHome)) {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
  fakeHome = null;
});

function makeHome(): string {
  fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-playing-home-'));
  return fakeHome;
}

function getBashPath(): string | null {
  // PATH 上にあればそれを優先
  const probe = spawnSync('bash', ['--version'], { encoding: 'utf8' });
  if (probe.status === 0) return 'bash';

  // Windows Git Bash フォールバック
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  if (fs.existsSync(gitBash)) return gitBash;

  return null;
}

const BASH_PATH = getBashPath();

function runInstall(home: string, args: string[], extraEnv: Record<string, string> = {}) {
  if (!BASH_PATH) {
    throw new Error('bash executable not found');
  }
  return spawnSync(BASH_PATH, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, ...extraEnv },
    timeout: 15000,
  });
}

function expectSkillsInstalled(base: string) {
  for (const name of SKILLS) {
    expect(fs.existsSync(path.join(base, name, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(base, name, 'skill.yaml'))).toBe(true);
  }
}

describe('install_skill.sh', () => {
  test('既定 (muse) で custom-skills 配下に2本とも配置されること', () => {
    const home = makeHome();
    const res = runInstall(home, []);
    expect(res.status).toBe(0);
    expectSkillsInstalled(path.join(home, 'workspace', 'custom-skills'));
  });

  test('gemini キーワードで .gemini/config/skills 配下に配置されること', () => {
    const home = makeHome();
    const res = runInstall(home, ['gemini']);
    expect(res.status).toBe(0);
    expectSkillsInstalled(path.join(home, '.gemini', 'config', 'skills'));
  });

  test('任意パスをベースとして配置されること', () => {
    const home = makeHome();
    const base = path.join(home, 'my-skills');
    const res = runInstall(home, [base]);
    expect(res.status).toBe(0);
    expectSkillsInstalled(base);
  });

  test('環境変数 AGENT_PLAYING_SKILL_DEST が使われ、引数が優先されること', () => {
    const home = makeHome();
    const envBase = path.join(home, 'env-skills');
    const argBase = path.join(home, 'arg-skills');

    const resEnv = runInstall(home, [], { AGENT_PLAYING_SKILL_DEST: envBase });
    expect(resEnv.status).toBe(0);
    expectSkillsInstalled(envBase);

    const resArg = runInstall(home, [argBase], { AGENT_PLAYING_SKILL_DEST: envBase });
    expect(resArg.status).toBe(0);
    expectSkillsInstalled(argBase);
  });
});
