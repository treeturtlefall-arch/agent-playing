import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ChromiumDetectionResult {
  path: string | null;
  detected: boolean;
  version?: string;
}

let cachedDetection: ChromiumDetectionResult | null = null;
let lastScreenshotError: string | null = null;
let lastScreenshotPath: string | null = null;

export function resetChromiumCache(): void {
  cachedDetection = null;
  lastScreenshotError = null;
  lastScreenshotPath = null;
}

/** 直近の captureScreenshot 失敗理由（stderr の要約）。成功時は null。 */
export function getLastScreenshotError(): string | null {
  return lastScreenshotError;
}

/** 直近に PNG 生成へ成功した Chromium のパス。未成功なら null。 */
export function getLastScreenshotPath(): string | null {
  return lastScreenshotPath;
}

/** 専用ブラウザの配置先（install_browser.sh と一致させること） */
export function dedicatedBrowserDir(): string {
  return (
    process.env.AGENT_PLAYING_BROWSER_DIR ??
    path.join(os.homedir(), '.cache', 'agent-playing', 'browsers')
  );
}

const DEDICATED_BINARY_NAMES = ['chrome-headless-shell', 'headless_shell', 'chrome'];

/**
 * 専用配置先の中から Chromium 系バイナリを探す。
 * @puppeteer/browsers の配置レイアウト
 * （<dir>/chrome-headless-shell/linux-<ver>/chrome-headless-shell-linux64/chrome-headless-shell 等）を
 * 深さ5まで走査する。
 */
export function findDedicatedBrowsers(dir: string = dedicatedBrowserDir()): string[] {
  const found: string[] = [];
  const walk = (current: string, depth: number): void => {
    if (depth > 5 || found.length >= 8) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && DEDICATED_BINARY_NAMES.includes(entry.name)) {
        found.push(full);
      }
    }
  };
  if (fs.existsSync(dir)) {
    walk(dir, 0);
  }
  // headless-shell を通常の chrome より優先する
  return found.sort((a, b) => {
    const rank = (p: string) => (p.includes('headless') ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

/**
 * 撮影候補となる Chromium のパスを優先順に列挙する（実在するものだけ）。
 * 順序: 環境変数 → 専用配置先（install_browser.sh） → PATH → 既知パス。
 *
 * 注意: /opt/meta-chromium/chrome（Muse VM 専用）は --version には応答するが
 * 実起動がポリシーで禁止されており撮影には使えない。存在だけでは「使える」と
 * 判断せず、captureScreenshot 側で実撮影の成否をもって候補を進める。
 */
export function collectChromiumCandidates(): string[] {
  const candidates: string[] = [];
  const push = (p: string | null | undefined): void => {
    if (p && fs.existsSync(p) && !candidates.includes(p)) {
      candidates.push(p);
    }
  };

  // 1. 環境変数
  push(process.env.CHROME_PATH || process.env.CHROMIUM_PATH);

  // 2. 専用配置先
  for (const p of findDedicatedBrowsers()) {
    push(p);
  }

  // 3. PATH 上のコマンド候補
  const pathCandidates = ['google-chrome', 'chromium', 'chromium-browser', 'chrome'];
  for (const cmd of pathCandidates) {
    const isWindows = os.platform() === 'win32';
    try {
      const res = spawnSync(isWindows ? 'where.exe' : 'which', [cmd], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (res.status === 0 && res.stdout.trim().length > 0) {
        push(res.stdout.trim().split('\n')[0]!.trim());
      }
    } catch {
      // ignore
    }
  }

  // 4. プラットフォーム別既知パス
  const platform = os.platform();
  if (platform === 'linux') {
    push('/usr/bin/google-chrome');
    push('/usr/bin/chromium');
    push('/usr/bin/chromium-browser');
    push('/snap/bin/chromium');
    push('/opt/meta-chromium/chrome'); // Muse VM専用（実起動できない場合があるため最後尾）
  } else if (platform === 'darwin') {
    push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else if (platform === 'win32') {
    push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
    push('C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe');
    push('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
  }

  return candidates;
}

export function findChromiumPath(options?: { includeVersion?: boolean }): ChromiumDetectionResult {
  if (cachedDetection) {
    return cachedDetection;
  }

  const includeVersion = options?.includeVersion ?? false;
  const candidates = collectChromiumCandidates();
  const first = candidates[0];

  if (first) {
    cachedDetection = {
      path: first,
      detected: true,
      version: includeVersion ? getVersion(first) : undefined,
    };
    return cachedDetection;
  }

  cachedDetection = { path: null, detected: false };
  return cachedDetection;
}

function getVersion(executablePath: string): string | undefined {
  try {
    const res = spawnSync(executablePath, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    });
    if (res.status === 0 && res.stdout.trim().length > 0) {
      return res.stdout.trim();
    }
  } catch {
    // ignore
  }
  return undefined;
}

export interface ScreenshotOptions {
  chromiumPath?: string;
  tmpDir?: string;
  timeoutMs?: number;
}

export async function captureScreenshot(
  htmlPath: string,
  outPngPath: string,
  options?: ScreenshotOptions
): Promise<boolean> {
  const candidates = options?.chromiumPath ? [options.chromiumPath] : collectChromiumCandidates();

  if (candidates.length === 0) {
    lastScreenshotError = 'Chromium 候補が1つも見つかりませんでした';
    return false;
  }

  const absHtmlPath = path.resolve(htmlPath);
  const absOutPath = path.resolve(outPngPath);
  fs.mkdirSync(path.dirname(absOutPath), { recursive: true });

  // Muse VM 512MB制限対策: プロファイルは .tmp 配下の独立ディレクトリに置き、複数プロセス間の衝突を防ぐ
  const profileDir = path.resolve(
    options?.tmpDir ??
      path.join('.tmp', `chromium-profile-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  );
  fs.mkdirSync(profileDir, { recursive: true });

  const fileUrl = pathToFileURL(absHtmlPath);
  const errors: string[] = [];

  for (const chromiumPath of candidates) {
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--window-size=1080,1350',
      // デザインキャンバスは 1080x1350 CSS px のまま、物理解像度を2倍(2160x2700)で撮影する。
      // その後 sharp (Lanczos3) で 1080x1350 に高品質縮小（SSAA）することで、
      // 文字の掠れ・アンチエイリアスのボケを完全に解消しつつ仕様通りの寸法・軽量サイズで出力する。
      '--force-device-scale-factor=2',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--user-data-dir=${profileDir}`,
      `--screenshot=${absOutPath}`,
      fileUrl,
    ];

    try {
      let res = spawnSync(chromiumPath, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options?.timeoutMs ?? 15000,
      });

      if (res.status === 0 && fs.existsSync(absOutPath)) {
        await applySsaaDownscale(absOutPath, 1080, 1350);
        lastScreenshotError = null;
        lastScreenshotPath = chromiumPath;
        return true;
      }
      errors.push(summarizeError(chromiumPath, res.stderr, res.status));

      // 古い Chromium / headless-shell 用のフォールバック (--headless=new が効かない場合)
      if (!fs.existsSync(absOutPath)) {
        args[0] = '--headless';
        res = spawnSync(chromiumPath, args, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: options?.timeoutMs ?? 15000,
        });
        if (fs.existsSync(absOutPath)) {
          await applySsaaDownscale(absOutPath, 1080, 1350);
          lastScreenshotError = null;
          lastScreenshotPath = chromiumPath;
          return true;
        }
        errors.push(summarizeError(chromiumPath, res.stderr, res.status));
      }
    } catch (err) {
      errors.push(`${chromiumPath}: ${(err as Error).message}`);
    }
  }

  lastScreenshotError = errors.filter(Boolean).join(' | ').slice(0, 500) || 'unknown error';
  return false;
}

function summarizeError(chromiumPath: string, stderr: string | undefined, status: number | null): string {
  const lines = (stderr ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.includes('dbus'));
  const last = lines[lines.length - 1];
  return `${chromiumPath} (exit ${status ?? '?'})${last ? `: ${last.slice(0, 200)}` : ''}`;
}

function pathToFileURL(filePath: string): string {
  let normalized = path.resolve(filePath).replace(/\\/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return `file://${normalized}`;
}

/**
 * 2x 撮影された画像を sharp (Lanczos3) を用いて 1080x1350 に高品質縮小 (SSAA) する。
 * 万一 sharp のロードや縮小処理が失敗した場合は、クラッシュさせず 2x 画像のまま納品するフェイルセーフを備える。
 */
export async function applySsaaDownscale(
  pngPath: string,
  targetWidth = 1080,
  targetHeight = 1350
): Promise<boolean> {
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const buf = await sharp(pngPath)
      .resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill',
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(pngPath, buf);
    return true;
  } catch (err) {
    console.warn(
      `⚠️ [WARN] sharp による SSAA 縮小に失敗したため、2x 高解像度画像（2160x2700）のまま保存しました: ${
        (err as Error).message
      }`
    );
    return false;
  }
}
