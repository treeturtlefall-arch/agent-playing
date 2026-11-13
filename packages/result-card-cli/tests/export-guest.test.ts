import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_AVATAR_BASE64_LENGTH, validateGuestAgent } from '../../games/mini-dungeon/src/guest.js';
import { runCli } from '../src/cli.js';
import { exportGuestAgent, type GuestMetaInput, uploadGuestToHub } from '../src/export-guest.js';

const TEMP_DIR = path.resolve('./.tmp/test-export-guest');

afterEach(() => {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});

const SAMPLE_META: GuestMetaInput = {
  title: '深層帰りの司書見習い',
  personality: '慎重で怖がりだが、書物の知識と事前準備で仲間の危機を未然に防ぐ真面目な司書見習い。',
  speech_style: '丁寧な敬語（「〜です」「〜ます」）。一人称は「私」。',
  appearance_prompt: '銀髪のロングヘアに青いリボン、灰色の瞳、司書見習いのローブを纏い魔導書を抱えた少女',
  highlight_poses: {
    on_assist: '古文書を開いて安全経路を光の図形で浮かび上がらせ、仲間を導いている姿',
    on_clear: '胸元で古文書を抱きしめながら、安堵の笑顔で並んでいる姿',
  },
  dialogues: {
    on_join: 'あの……足手まといにならないよう、書物の記録で精一杯サポートしますね……！',
    on_assist: '待ってください！ この構造、古文書の図解で見たことがあります……こちらなら安全です！',
    on_clear: 'やりました……！ 最後まで無事に辿り着けて、本当に良かったです……！',
    on_retire: 'どうか無理をなさらないでください……この記録は、きっと次の挑戦に繋がりますから。',
  },
};

describe('export-guest CLI & Helper', () => {
  test('examples/sample_ai_w46/result.json と ai_portrait.png から 256px WebP 埋め込み済み guest.json を生成し検証を通過すること', async () => {
    const outPath = path.join(TEMP_DIR, 'shiragane-ai-guest.json');
    const res = await exportGuestAgent({
      resultPath: path.resolve('examples/sample_ai_w46/result.json'),
      meta: SAMPLE_META,
      outPath,
    });

    expect(res.ok).toBe(true);
    expect(res.agent_id).toBe('shiragane-ai'); // 同ディレクトリの setup.json から自動取得
    expect(res.target_axis).toBe('safety'); // 最高値 (5) の軸が自動選択される
    expect(res.avatar_base64_length).toBeGreaterThan(100);
    expect(res.avatar_base64_length).toBeLessThanOrEqual(MAX_AVATAR_BASE64_LENGTH);
    expect(fs.existsSync(outPath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const validation = validateGuestAgent(written);
    expect(validation.success).toBe(true);
    expect(written.footprint.reached_floor).toBe(17);
    expect(written.footprint.outcome).toBe('gameover');
    expect(written.footprint.seed).toBe('W46-8842');
  });

  test('setup.json に登録された private_owner_names がメタ情報に混入している場合に検疫で拒絶されること', async () => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const sampleDir = path.resolve('examples/sample_ai_w46');
    const copiedResult = path.join(TEMP_DIR, 'result.json');
    const copiedSetup = path.join(TEMP_DIR, 'setup.json');
    fs.copyFileSync(path.join(sampleDir, 'result.json'), copiedResult);

    const setupObj = JSON.parse(fs.readFileSync(path.join(sampleDir, 'setup.json'), 'utf8'));
    setupObj.private_owner_names = ['秘密のオーナー'];
    fs.writeFileSync(copiedSetup, JSON.stringify(setupObj, null, 2), 'utf8');

    const metaPath = path.join(TEMP_DIR, 'meta.json');
    const badMeta: GuestMetaInput = {
      ...SAMPLE_META,
      dialogues: {
        ...SAMPLE_META.dialogues,
        on_assist: '秘密のオーナーが教えてくれた通りに進みましょう！',
      },
    };
    fs.writeFileSync(metaPath, JSON.stringify(badMeta, null, 2), 'utf8');

    const exitCode = await runCli([
      'export-guest',
      copiedResult,
      '--meta',
      metaPath,
      '--avatar',
      path.join(sampleDir, 'ai_portrait.png'),
      '--out',
      path.join(TEMP_DIR, 'guest.json'),
      '--json',
    ]);

    expect(exitCode).toBe(1);
    expect(fs.existsSync(path.join(TEMP_DIR, 'guest.json'))).toBe(false);
  });

  test('CLI export-guest コマンド経由で正常終了 (exitCode 0) し guest.json を出力すること', async () => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const metaPath = path.join(TEMP_DIR, 'meta.json');
    const outPath = path.join(TEMP_DIR, 'guest.json');
    fs.writeFileSync(metaPath, JSON.stringify(SAMPLE_META, null, 2), 'utf8');

    const exitCode = await runCli([
      'export-guest',
      path.resolve('examples/sample_ai_w46/result.json'),
      '--meta',
      metaPath,
      '--out',
      outPath,
      '--json',
    ]);

    expect(exitCode).toBe(0);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('uploadGuestToHub が成功レスポンスの count を返し、失敗時はエラーを透過しつつ例外を投げないこと', async () => {
    const outPath = path.join(TEMP_DIR, 'shiragane-ai-guest.json');
    const res = await exportGuestAgent({
      resultPath: path.resolve('examples/sample_ai_w46/result.json'),
      meta: SAMPLE_META,
      outPath,
    });
    expect(res.ok).toBe(true);
    const guest = res.guest!;

    const okUp = await uploadGuestToHub(guest, {
      hubUrl: 'https://hub.example.workers.dev',
      fetchFn: async () =>
        new Response(JSON.stringify({ ok: true, count: 3 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    expect(okUp.ok).toBe(true);
    expect(okUp.count).toBe(3);
    expect(okUp.hub_url).toBe('https://hub.example.workers.dev/api/guests');

    const rejectedUp = await uploadGuestToHub(guest, {
      hubUrl: 'https://hub.example.workers.dev',
      fetchFn: async () =>
        new Response(
          JSON.stringify({ ok: false, error: 'Validation failed', details: ['bad title'] }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
    });
    expect(rejectedUp.ok).toBe(false);
    expect(rejectedUp.status).toBe(400);
    expect(rejectedUp.error).toContain('Validation failed');
    expect(rejectedUp.error).toContain('bad title');
  });

  test('CLI export-guest --upload がハブ登録でき、失敗時もフェイルソフトで exitCode 0 になること', async () => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const metaPath = path.join(TEMP_DIR, 'meta.json');
    const outPath = path.join(TEMP_DIR, 'guest.json');
    fs.writeFileSync(metaPath, JSON.stringify(SAMPLE_META, null, 2), 'utf8');

    const receivedIds: Array<string | null> = [];
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === '/api/guests' && req.method === 'POST') {
          const body = (await req.json()) as { agent?: { id?: string } };
          receivedIds.push(body.agent?.id ?? null);
          return new Response(JSON.stringify({ ok: true, count: 1 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    try {
      const okCode = await runCli([
        'export-guest',
        path.resolve('examples/sample_ai_w46/result.json'),
        '--meta',
        metaPath,
        '--out',
        outPath,
        '--upload',
        '--hub',
        `http://127.0.0.1:${server.port}`,
        '--json',
      ]);
      expect(okCode).toBe(0);
      expect(receivedIds).toEqual(['shiragane-ai']);
      expect(fs.existsSync(outPath)).toBe(true);
    } finally {
      server.stop();
    }

    // 失敗系: 不正なハブURLでも export 自体は成功し exitCode 0（フェイルソフト）
    const failSoftCode = await runCli([
      'export-guest',
      path.resolve('examples/sample_ai_w46/result.json'),
      '--meta',
      metaPath,
      '--out',
      outPath,
      '--upload',
      '--hub',
      'not-a-valid-url',
      '--json',
    ]);
    expect(failSoftCode).toBe(0);
    expect(fs.existsSync(outPath)).toBe(true);
  });
});
