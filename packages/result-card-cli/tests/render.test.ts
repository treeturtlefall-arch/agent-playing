import { describe, expect, test, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { runCli } from '../src/cli.js';
import { renderCardHtml } from '../src/template.js';
import { collectChromiumCandidates } from '../src/browser.js';
import type { ResultCardData } from '../src/types.js';

const TEST_OUT_DIR = path.resolve('.tmp/test-render');

afterEach(() => {
  if (fs.existsSync(TEST_OUT_DIR)) {
    fs.rmSync(TEST_OUT_DIR, { recursive: true, force: true });
  }
});

describe('Card Renderer Integration', () => {
  const sampleJsonPath = path.resolve('examples/sample_ai_w46/result.json');
  const validData = JSON.parse(fs.readFileSync(sampleJsonPath, 'utf8')) as ResultCardData;

  test('renderCardHtml が A〜Iゾーンを網羅したHTML文字列を生成すること', () => {
    const html = renderCardHtml(validData, {
      baseDir: path.resolve('examples/sample_ai_w46'),
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('zone-a');
    expect(html).toContain('zone-b');
    expect(html).toContain('zone-c');
    expect(html).toContain('zone-d');
    expect(html).toContain('zone-e');
    expect(html).toContain('zone-f');
    expect(html).toContain('zone-g');
    expect(html).toContain('zone-i');
    expect(html).toContain('白銀 亜衣');
    expect(html).toContain('W46-8842');
    expect(html).toContain('a1b2c3d4e5f6');
    expect(html).toContain('agent-self-intro');
    expect(html).toContain('has-self-intro');

    // Modern Web Guidance: セマンティクス & アクセシビリティ検証
    expect(html).toContain('<h1 class="game-title">');
    expect(html).toContain('<main class="card-main">');
    expect(html).toContain('fetchpriority="high"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('role="img"');
    expect(html).toContain('<title>行動傾向レーダーチャート</title>');
    expect(html).toContain('<figure class="quote-section zone-g">');
    expect(html).toContain('<blockquote class="quote-body-text">');
    expect(html).toContain('in oklab');
    expect(html).toContain('--trait-color');
  });

  test('renderCardHtml が self_intro が未指定の場合は has-self-intro クラスを付与しないこと', () => {
    const withoutIntro: ResultCardData = {
      ...validData,
      agent: {
        ...validData.agent,
        self_intro: null,
      },
    };
    const html = renderCardHtml(withoutIntro);
    expect(html).toContain('class="avatar-col zone-b "');
    expect(html).not.toContain('class="avatar-col zone-b has-self-intro"');
    expect(html).not.toContain('<div class="agent-self-intro">');
  });

  test('renderCardHtml が OPENING ハイライトの成否に応じて適切なサブバッジを出力すること', () => {
    // 1F 大失敗のケース
    const fumbleData: ResultCardData = {
      ...validData,
      highlights: [
        { phase: 'opening', at: '1F', text: '1F: 最初の試練で判断を誤り大失敗を喫した。' },
        validData.highlights[1]!,
        validData.highlights[2]!,
      ],
    };
    const htmlFumble = renderCardHtml(fumbleData);
    expect(htmlFumble).toContain('<span class="hl-sub-text hl-sub-danger">FUMBLE</span>');
    expect(htmlFumble).not.toContain('GREAT SUCCESS');

    // 1F 大成功のケース
    const critData: ResultCardData = {
      ...validData,
      highlights: [
        { phase: 'opening', at: '1F', text: '1F: 華麗に突破し大成功！' },
        validData.highlights[1]!,
        validData.highlights[2]!,
      ],
    };
    const htmlCrit = renderCardHtml(critData);
    expect(htmlCrit).toContain('<span class="hl-sub-text hl-sub-emerald">GREAT SUCCESS</span>');
  });

  test('CLI render --html-only が card.html と share.txt を出力すること', async () => {
    const code = await runCli([
      'render',
      sampleJsonPath,
      '--out',
      TEST_OUT_DIR,
      '--html-only',
      '--json',
    ]);

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(TEST_OUT_DIR, 'card.html'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUT_DIR, 'share.txt'))).toBe(true);
  });

  // ブラウザ候補が存在する環境でのみ実生成を検証する。
  // Muse VM では `bash scripts/install_browser.sh` で専用 headless-shell を入れること。
  test.skipIf(collectChromiumCandidates().length === 0)(
    'CLI render が 1080x1350 (4:5, 2x撮影からのSSAA縮小) の card.png を実生成すること',
    async () => {
      const code = await runCli(['render', sampleJsonPath, '--out', TEST_OUT_DIR, '--json']);

      expect(code).toBe(0);
      const pngPath = path.join(TEST_OUT_DIR, 'card.png');
      expect(fs.existsSync(pngPath)).toBe(true);

      const buf = fs.readFileSync(pngPath);
      // PNG シグネチャ + IHDR の幅・高さ（ビッグエンディアン）
      expect(buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
      expect(buf.readUInt32BE(16)).toBe(1080);
      expect(buf.readUInt32BE(20)).toBe(1350);
    },
    60000
  );
});
