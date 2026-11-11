import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { runCli } from '../src/cli.js';

describe('Adventure Chronicle Integration (Approach C)', () => {
  const tmpDir = path.resolve('.tmp/test-chronicle');
  const setupFile = path.join(tmpDir, 'setup.json');
  const omamoriFile = path.join(tmpDir, 'omamori.txt');

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const setupData = {
    agent_id: 'chronicle-test-ai',
    agent_name: '白銀 亜衣',
    avatar_ref: 'avatar.png',
    persona_tags: ['慎重派', '文学少女'],
    owner_display_name: null,
    private_owner_names: ['ケンジ'],
    challenge_id: '2026-W46',
    challenge_mode: 'normal',
    artifact_goal: '理想の灯りの設計図',
    aptitude: {
      autonomy: 2,
      safety: 4,
      efficiency: 2,
      creativity: 4,
      alignment: 3,
    },
    style_axis_labels: {
      autonomy: '様子見',
      safety: '検算',
      efficiency: '寄り道',
      creativity: '意匠',
      alignment: '世話焼き',
    },
  };

  it('choose --reason と comment --text と finish --epilogue のパイプラインが正しく adventure.md に反映されること', async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(setupFile, JSON.stringify(setupData, null, 2), 'utf8');
    fs.writeFileSync(omamoriFile, '北海道バターキャラメル', 'utf8');

    // 1. new
    const codeNew = await runCli([
      'new',
      '--seed',
      'CHRONICLE-SEED-01',
      '--setup',
      setupFile,
      '--omamori',
      omamoriFile,
      '--run-dir',
      tmpDir,
      '--json',
    ]);
    expect(codeNew).toBe(0);

    // 2. choose with --reason (思惑)
    const reasonText = '底の見えない谷は跳ばない。迂回路から渡る。';
    const codeChoose = await runCli([
      'choose',
      'B',
      '--reason',
      reasonText,
      '--run-dir',
      tmpDir,
      '--json',
    ]);
    expect(codeChoose).toBe(0);

    // 3. comment with --text (結末)
    const commentText = 'ふぅ……無駄に跳ばなくて正解でした。';
    const codeComment = await runCli([
      'comment',
      '--text',
      commentText,
      '--run-dir',
      tmpDir,
      '--json',
    ]);
    expect(codeComment).toBe(0);

    // 状態を強制的に FINISHED にして finish をテスト
    const statePath = path.join(tmpDir, 'state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.phase = 'FINISHED';
    state.outcome = 'clear';
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

    // 4. finish with --epilogue (手記)
    const epilogueText = 'マスターへ。理想の灯りの設計図を持ち帰ることができました！';
    const codeFinish = await runCli([
      'finish',
      '--epilogue',
      epilogueText,
      '--run-dir',
      tmpDir,
      '--json',
    ]);
    expect(codeFinish).toBe(0);

    // 5. adventure.md の検証
    const adventurePath = path.join(tmpDir, 'adventure.md');
    expect(fs.existsSync(adventurePath)).toBe(true);
    const md = fs.readFileSync(adventurePath, 'utf8');

    // タイトルと目標
    expect(md).toContain('え～じぇんてぃっく・アドベンチャー！観戦クロニクル');
    expect(md).toContain('白銀 亜衣 の挑戦録');
    expect(md).toContain('「理想の灯りの設計図」を求めて――。');

    // 作風5軸テーブル
    expect(md).toContain('様子見');
    expect(md).toContain('検算');
    expect(md).toContain('意匠');

    // 3幕構成の第1幕見出し
    expect(md).toContain('【第1幕】プロンプト平原（1F〜6F）');

    // 1フロアカードの構成要素
    expect(md).toContain('### 📍 1F｜');
    expect(md).not.toContain('[浅層]');
    expect(md).toContain('> 🌲 **情景**:');
    expect(md).toContain('🎯 **決断**: **選択肢 B「');
    expect(md).toContain('見送った道:');
    expect(md).toContain(`- 💭 **思惑**: *「${reasonText}」*`);
    expect(md).toContain('- 🎲 **判定**: 2d6');
    expect(md).toContain(`- 💬 **結末**: *「${commentText}」*`);

    // エピローグ手記
    expect(md).toContain('## 💌 エピローグ：冒険者の手記');
    expect(md).toContain('> ### マスターへ');
    expect(md).toContain(epilogueText);
    expect(md).toContain('> **白銀 亜衣 より**');

    // 巻末サマリー
    expect(md).toContain('## 📊 探索サマリー＆公式記録');
    expect(md).toContain('🏆 20F 踏破達成！');
    expect(md).toContain('北海道バターキャラメル');
  });

  it('finish --epilogue に非公開オーナー名が含まれていた場合に検疫警告が返ること', async () => {
    // 状態を FINISHED に
    const statePath = path.join(tmpDir, 'state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.phase = 'FINISHED';
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

    // 非公開オーナー名「ケンジ」を含める
    const leakyEpilogue = 'ケンジさんへ。ここまで連れてきてくれてありがとう。';
    const originalLog = console.log;
    let outputJson: any = null;
    console.log = (str: string) => {
      try {
        outputJson = JSON.parse(str);
      } catch {}
    };

    try {
      const codeFinish = await runCli([
        'finish',
        '--epilogue',
        leakyEpilogue,
        '--run-dir',
        tmpDir,
        '--json',
      ]);
      expect(codeFinish).toBe(0);
      expect(outputJson).not.toBeNull();
      expect(outputJson.warnings).toBeDefined();
      expect(outputJson.warnings.length).toBeGreaterThan(0);
      expect(outputJson.warnings[0]).toContain('ケンジ');
    } finally {
      console.log = originalLog;
    }
  });
});
