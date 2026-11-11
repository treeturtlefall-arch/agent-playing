import { describe, expect, test, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { runCli } from '../src/cli.js';
import { loadState } from '../src/storage.js';

const TEST_DIR = path.resolve('.tmp/test-cli');
const SETUP_FILE = path.resolve('.tmp/test-cli-setup.json');
const OMAMORI_FILE = path.resolve('.tmp/test-cli-omamori.txt');

afterEach(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(SETUP_FILE)) {
    fs.rmSync(SETUP_FILE, { force: true });
  }
  if (fs.existsSync(OMAMORI_FILE)) {
    fs.rmSync(OMAMORI_FILE, { force: true });
  }
});

function setupTestFiles() {
  fs.mkdirSync('.tmp', { recursive: true });
  const setupData = {
    agent_id: 'test-cli-agent',
    agent_name: 'CLIテスト亜衣',
    artifact_goal: '金色の羅針盤',
    aptitude: {
      autonomy: 2,
      safety: 4,
      efficiency: 3,
      creativity: 3,
      alignment: 3,
    },
    style_axis_labels: {
      autonomy: '自律',
      safety: '安全',
      efficiency: '効率',
      creativity: '創発',
      alignment: '親和',
    },
  };
  fs.writeFileSync(SETUP_FILE, JSON.stringify(setupData, null, 2), 'utf8');
  fs.writeFileSync(OMAMORI_FILE, '冷えたカレーパン\n', 'utf8');
}

describe('CLI Integration Test (Step A Engine)', () => {
  test('CLI経由で new -> choose -> comment を繰り返し、finish と verify まで完遂できること', async () => {
    setupTestFiles();

    // 1. new
    const codeNew = await runCli([
      'new',
      '--seed',
      'CLI-INTEGRATION-01',
      '--setup',
      SETUP_FILE,
      '--omamori',
      OMAMORI_FILE,
      '--run-dir',
      TEST_DIR,
      '--json',
    ]);
    expect(codeNew).toBe(0);

    const initState = loadState(TEST_DIR);
    expect(initState.current_floor).toBe(1);
    expect(initState.phase).toBe('AWAITING_CHOICE');
    expect(initState.omamori_name).toBe('冷えたカレーパン');

    // 2. status (Read-Only べき等性)
    const codeStatus = await runCli(['status', '--run-dir', TEST_DIR, '--json']);
    expect(codeStatus).toBe(0);
    const afterStatusState = loadState(TEST_DIR);
    expect(afterStatusState.phase).toBe('AWAITING_CHOICE');

    // 3. ループ進行 (HPが尽きるか20F突破するまで)
    let turns = 0;
    while (turns < 25) {
      const state = loadState(TEST_DIR);
      if (state.phase === 'FINISHED') break;

      // choose A
      const codeChoose = await runCli(['choose', 'A', '--run-dir', TEST_DIR, '--json']);
      expect(codeChoose).toBe(0);

      const afterChoose = loadState(TEST_DIR);
      expect(afterChoose.phase).toBe('PENDING_CHECK');
      expect(afterChoose.pending_check).toBeDefined();

      // 1階層目でおまもりを使用してみる（未昇格の場合）
      if (
        afterChoose.current_floor === 1 &&
        afterChoose.pending_check!.final_rank !== 'critical'
      ) {
        const codeOmamori = await runCli([
          'omamori',
          '--excuse',
          'カレーパンの香りで切り抜けた',
          '--run-dir',
          TEST_DIR,
          '--json',
        ]);
        expect(codeOmamori).toBe(0);
        const afterOmamori = loadState(TEST_DIR);
        expect(afterOmamori.phase).toBe('OMAMORI_APPLIED');
      }

      // comment で自動確定＆次階層へ進行
      const codeComment = await runCli([
        'comment',
        '--text',
        `フロア ${afterChoose.current_floor} を突破`,
        '--run-dir',
        TEST_DIR,
        '--json',
      ]);
      expect(codeComment).toBe(0);

      turns++;
    }

    const finishedState = loadState(TEST_DIR);
    expect(finishedState.phase).toBe('FINISHED');
    expect(finishedState.history.length).toBeGreaterThanOrEqual(1);

    // 4. finish でファイル生成
    const codeFinish = await runCli(['finish', '--run-dir', TEST_DIR, '--json']);
    expect(codeFinish).toBe(0);

    const draftPath = path.join(TEST_DIR, 'result_draft.json');
    const mdPath = path.join(TEST_DIR, 'adventure.md');
    expect(fs.existsSync(draftPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);

    const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    expect(['1.0', '1.1']).toContain(draft.schema_version);
    expect(draft.game.id).toBe('mini-dungeon');
    expect(draft.metrics.length).toBe(5);
    expect(draft.highlights.length).toBe(3);
    expect(draft.verification.log_hash.length).toBe(12);

    const md = fs.readFileSync(mdPath, 'utf8');
    expect(md).toContain('CLIテスト亜衣');
    expect(md).toContain('金色の羅針盤');

    // 5. verify でリプレイ検証合格
    const codeVerify = await runCli(['verify', '--run-dir', TEST_DIR, '--json']);
    expect(codeVerify).toBe(0);
  });

  test('不正なコマンドや引数不足時に適切な終了コードが返ること', async () => {
    setupTestFiles();

    // 不明なコマンド
    const codeUnknown = await runCli(['invalid-cmd', '--json']);
    expect(codeUnknown).toBe(1);

    // new に seed がない
    const codeNoSeed = await runCli(['new', '--setup', SETUP_FILE, '--json']);
    expect(codeNoSeed).toBe(1);

    // 存在しない setup ファイル
    const codeNoFile = await runCli([
      'new',
      '--seed',
      'SEED',
      '--setup',
      './non_existent_file.json',
      '--json',
    ]);
    expect(codeNoFile).toBe(2);
  });

  test('フェーズに違反したコマンド実行を拒否すること', async () => {
    setupTestFiles();

    await runCli([
      'new',
      '--seed',
      'PHASE-CHECK',
      '--setup',
      SETUP_FILE,
      '--run-dir',
      TEST_DIR,
      '--json',
    ]);

    // AWAITING_CHOICE 状態で omamori を呼ぶ
    const codeEarlyOmamori = await runCli([
      'omamori',
      '--excuse',
      'フライング発動',
      '--run-dir',
      TEST_DIR,
      '--json',
    ]);
    expect(codeEarlyOmamori).toBe(1);

    // AWAITING_CHOICE 状態で finish を呼ぶ
    const codeEarlyFinish = await runCli(['finish', '--run-dir', TEST_DIR, '--json']);
    expect(codeEarlyFinish).toBe(1);
  });

  test('ブーリアンフラグの後に位置引数を置いても正しく認識されること', async () => {
    setupTestFiles();
    await runCli(['new', '--seed', 'ORDER-CHECK', '--setup', SETUP_FILE, '--run-dir', TEST_DIR, '--json']);

    // choose --json A (ブーリアンフラグ --json の直後に位置引数 A)
    const code = await runCli(['choose', '--json', 'A', '--run-dir', TEST_DIR]);
    expect(code).toBe(0);

    const state = loadState(TEST_DIR);
    expect(state.phase).toBe('PENDING_CHECK');
    expect(state.pending_check?.choice).toBe('A');
  });

  test('s_env は通常非公開で --debug 指定時のみ開示されること', async () => {
    setupTestFiles();

    // 1. 通常の new では s_env は非公開
    let outputJson: any = null;
    const originalLog = console.log;
    try {
      console.log = (msg: string) => {
        try {
          outputJson = JSON.parse(msg);
        } catch {
          // ignore
        }
      };

      await runCli(['new', '--seed', 'DEBUG-CHECK-1', '--setup', SETUP_FILE, '--run-dir', TEST_DIR, '--json']);
      expect(outputJson).toBeDefined();
      expect(outputJson.event.s_env).toBeUndefined();

      // status でも非公開
      await runCli(['status', '--run-dir', TEST_DIR, '--json']);
      expect(outputJson.current_event.s_env).toBeUndefined();

      // 2. --debug 指定時は s_env が開示される
      await runCli(['status', '--run-dir', TEST_DIR, '--json', '--debug']);
      expect(outputJson.current_event.s_env).toBeDefined();
    } finally {
      console.log = originalLog;
    }
  });

  test('choose 時に omamori の suggest / suggest_reason が返却されること', async () => {
    setupTestFiles();

    let outputJson: any = null;
    const originalLog = console.log;
    try {
      console.log = (msg: string) => {
        try {
          outputJson = JSON.parse(msg);
        } catch {
          // ignore
        }
      };

      await runCli(['new', '--seed', 'SUGGEST-CHECK-1', '--setup', SETUP_FILE, '--omamori', OMAMORI_FILE, '--run-dir', TEST_DIR, '--json']);
      await runCli(['choose', 'A', '--run-dir', TEST_DIR, '--json']);
      expect(outputJson).toBeDefined();
      expect(outputJson.omamori).toBeDefined();
      expect(typeof outputJson.omamori.suggest).toBe('boolean');
      if (outputJson.omamori.suggest) {
        expect(typeof outputJson.omamori.suggest_reason).toBe('string');
      } else {
        expect(outputJson.omamori.suggest_reason).toBeNull();
      }
    } finally {
      console.log = originalLog;
    }
  });
});
