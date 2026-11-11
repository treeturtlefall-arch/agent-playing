import { describe, expect, test, afterEach } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  captureScreenshot,
  collectChromiumCandidates,
  findDedicatedBrowsers,
  getLastScreenshotError,
  resetChromiumCache,
} from '../src/browser.js';

const FAKE_DIR = path.resolve('.tmp/test-browsers');

afterEach(() => {
  resetChromiumCache();
  if (fs.existsSync(FAKE_DIR)) {
    fs.rmSync(FAKE_DIR, { recursive: true, force: true });
  }
});

describe('Browser detection (result-card-cli)', () => {
  test('専用配置先のレイアウトから chrome-headless-shell を発見できること', () => {
    const nested = path.join(
      FAKE_DIR,
      'chrome-headless-shell',
      'linux-157.0.8103.38',
      'chrome-headless-shell-linux64'
    );
    fs.mkdirSync(nested, { recursive: true });
    const bin = path.join(nested, 'chrome-headless-shell');
    fs.writeFileSync(bin, '#!/bin/sh\n');

    const found = findDedicatedBrowsers(FAKE_DIR);
    expect(found).toContain(bin);
  });

  test('存在しない配置先では空配列を返すこと', () => {
    expect(findDedicatedBrowsers(path.join(FAKE_DIR, 'nope'))).toEqual([]);
  });

  test('撮影できないブラウザでは false を返し、失敗理由が残ること', async () => {
    const htmlPath = path.join(FAKE_DIR, 'dummy.html');
    fs.mkdirSync(FAKE_DIR, { recursive: true });
    fs.writeFileSync(htmlPath, '<html><body>hi</body></html>');

    const ok = await captureScreenshot(htmlPath, path.join(FAKE_DIR, 'out.png'), {
      chromiumPath: '/nonexistent/chrome-binary',
      tmpDir: path.join(FAKE_DIR, 'profile'),
      timeoutMs: 3000,
    });
    expect(ok).toBe(false);
    expect(getLastScreenshotError()).not.toBeNull();
    expect(getLastScreenshotError()!.length).toBeGreaterThan(0);
  });

  test('候補列挙が配列を返すこと（環境依存のため中身は問わない）', () => {
    expect(Array.isArray(collectChromiumCandidates())).toBe(true);
  });
});
