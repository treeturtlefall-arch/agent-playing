#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import { captureScreenshot, findChromiumPath, getLastScreenshotError, getLastScreenshotPath } from './browser.js';
import { exportGuestAgent, type GuestMetaInput } from './export-guest.js';
import { generateShareText } from './share.js';
import { renderCardHtml } from './template.js';
import type { RenderResult, ResultCardData } from './types.js';
import { validateResultCard } from './validate.js';

/**
 * result.json と同じディレクトリにある setup.json（ローカル保持）から
 * 検疫ブラックリスト（private_owner_names）を読み取る。
 * 新形式では result.json 自体にリストを同梱しないため、レンダラはこの
 * サイドカーから検疫リストを補う。setup.json が無い・読めない場合は
 * 空リスト（従来動作: result.json 内のリストのみで判定）を返す。
 */
export function loadLocalPrivateNames(resultAbsPath: string): string[] {
  try {
    const setupPath = path.join(path.dirname(resultAbsPath), 'setup.json');
    if (!fs.existsSync(setupPath)) return [];
    const setup = JSON.parse(fs.readFileSync(setupPath, 'utf8')) as {
      private_owner_names?: unknown;
      agent?: { private_owner_names?: unknown };
    };
    const raw = setup.private_owner_names ?? setup.agent?.private_owner_names;
    if (!Array.isArray(raw)) return [];
    return raw.filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
  } catch {
    return [];
  }
}

export interface ParsedArgs {
  command: string | null;
  positional: string[];
  options: Record<string, string | boolean>;
}

const BOOLEAN_FLAGS = new Set(['json', 'help', 'html-only', 'force']);

export function parseCliArgs(args: string[]): ParsedArgs {
  let command: string | null = null;
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const full = arg.slice(2);
      const eqIdx = full.indexOf('=');
      if (eqIdx !== -1) {
        const key = full.slice(0, eqIdx);
        const val = full.slice(eqIdx + 1);
        options[key] = val;
        i += 1;
      } else {
        const key = full;
        if (BOOLEAN_FLAGS.has(key)) {
          options[key] = true;
          i += 1;
        } else if (i + 1 < args.length && !args[i + 1]!.startsWith('--')) {
          options[key] = args[i + 1]!;
          i += 2;
        } else {
          options[key] = true;
          i += 1;
        }
      }
    } else if (!command) {
      command = arg;
      i += 1;
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  return { command, positional, options };
}

function printOutput(data: unknown, isJson: boolean, humanFormatter?: () => void): void {
  if (isJson) {
    console.log(JSON.stringify(data, null, 2));
  } else if (humanFormatter) {
    humanFormatter();
  } else {
    console.log(data);
  }
}

function printError(msg: string, code: number, isJson: boolean): void {
  if (isJson) {
    console.log(JSON.stringify({ ok: false, error: msg, code }, null, 2));
  } else {
    console.error(`❌ エラー (${code === 1 ? '検証失敗・警告' : 'システムエラー'}): ${msg}`);
  }
}

async function handleValidate(
  positional: string[],
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const targetFile = positional[0];
  if (!targetFile) {
    printError('Target JSON file path is required: result-card validate <path/to/result.json>', 1, isJson);
    return 1;
  }

  const absPath = path.resolve(targetFile);
  if (!fs.existsSync(absPath)) {
    printError(`File not found: ${absPath}`, 2, isJson);
    return 2;
  }

  let rawData: unknown;
  try {
    rawData = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    printError(`JSON parse error: ${(err as Error).message}`, 2, isJson);
    return 2;
  }

  const validation = validateResultCard(rawData, loadLocalPrivateNames(absPath));

  if (validation.valid) {
    printOutput({ ok: true, valid: true, file: absPath }, isJson, () => {
      console.log(`✅ 検証に合格しました（スキーマ・プライバシー適合）: ${absPath}`);
    });
    return 0;
  } else {
    printOutput({ ok: false, valid: false, file: absPath, errors: validation.errors, privacy: validation.privacy }, isJson, () => {
      console.error(`❌ 検証に失敗しました (${validation.errors?.length} 件のエラー):`);
      for (const err of validation.errors ?? []) {
        console.error(`  - ${err}`);
      }
    });
    return 1;
  }
}

async function handleRender(
  positional: string[],
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const targetFile = positional[0];
  if (!targetFile) {
    printError('Target JSON file path is required: result-card render <path/to/result.json> [--out <dir>]', 1, isJson);
    return 1;
  }

  const absPath = path.resolve(targetFile);
  if (!fs.existsSync(absPath)) {
    printError(`File not found: ${absPath}`, 2, isJson);
    return 2;
  }

  let rawData: unknown;
  try {
    rawData = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    printError(`JSON parse error: ${(err as Error).message}`, 2, isJson);
    return 2;
  }

  // 1. スキーマ＆プライバシーバリデーション
  const validation = validateResultCard(rawData, loadLocalPrivateNames(absPath));
  const force = Boolean(options['force']);

  if (!validation.valid) {
    if (validation.privacy?.hasLeak && !force) {
      printError(
        `検疫エラー: 非公開オーナー名の混入が検出されたため、レンダリングを停止しました。\n${validation.errors?.join('\n')}\n※強制出力するには --force を指定してください。`,
        1,
        isJson
      );
      return 1;
    } else if (!validation.valid && !validation.privacy?.hasLeak) {
      printError(`スキーマ検証に失敗しました:\n${validation.errors?.join('\n')}`, 1, isJson);
      return 1;
    } else if (force && validation.privacy?.hasLeak) {
      console.warn(`⚠️ 警告 (--force 有効): プライバシー違反が検出されましたが出力を続行します:\n${validation.errors?.join('\n')}`);
    }
  }

  const card = rawData as ResultCardData;

  // 2. 出力先ディレクトリの決定
  const defaultOutDir = path.join(path.dirname(absPath), 'out');
  const outDir = path.resolve(typeof options['out'] === 'string' ? options['out'] : defaultOutDir);
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.join(outDir, 'card.html');
  const pngPath = path.join(outDir, 'card.png');
  const shareTextPath = path.join(outDir, 'share.txt');

  // 3. HTML の生成と保存
  const rawVariant = typeof options['radar-variant'] === 'string' ? options['radar-variant'].toLowerCase() : '';
  const radarVariant =
    rawVariant === 'b'
      ? 'B'
      : rawVariant === 'c'
      ? 'C'
      : rawVariant === 'a'
      ? 'A'
      : rawVariant === 'rainbow'
      ? 'rainbow'
      : 'cyan';
  const radarLineWidth =
    typeof options['radar-line-width'] === 'string'
      ? parseFloat(options['radar-line-width'])
      : undefined;
  const radarLineOpacity =
    typeof options['radar-line-opacity'] === 'string'
      ? parseFloat(options['radar-line-opacity'])
      : undefined;

  const rawRadius = typeof options['radius'] === 'string' ? options['radius'].toLowerCase() : '';
  const radiusMode: 'medium' | 'round' | 'sharp' =
    rawRadius === 'sharp'
      ? 'sharp'
      : rawRadius === 'round'
      ? 'round'
      : 'medium';

  const htmlContent = renderCardHtml(card, {
    baseDir: path.dirname(absPath),
    radarVariant,
    radarLineWidth,
    radarLineOpacity,
    radiusMode,
  });
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');

  // 4. share.txt の生成と保存
  const shareText = generateShareText(card);
  fs.writeFileSync(shareTextPath, shareText, 'utf8');

  // 5. Chromium による PNG ラスタライズ
  const htmlOnly = Boolean(options['html-only']);
  let pngCreated = false;
  const detection = htmlOnly ? { path: null, detected: false } : findChromiumPath();

  if (!htmlOnly && detection.detected) {
    // 候補を順に実撮影で試す（存在しても実起動できないブラウザが混ざるため）
    pngCreated = await captureScreenshot(htmlPath, pngPath, {});
  }
  const usedChromiumPath = pngCreated ? getLastScreenshotPath() : null;

  const result: RenderResult = {
    ok: htmlOnly || pngCreated,
    card_id: card.card_id,
    out_dir: outDir,
    html_path: htmlPath,
    png_path: pngCreated ? pngPath : null,
    share_text_path: shareTextPath,
    share_text: shareText,
    chromium_detected: detection.detected,
    chromium_path: usedChromiumPath ?? detection.path,
    warning:
      !htmlOnly && !pngCreated
        ? detection.detected
          ? `Failed to rasterize PNG via Chromium screenshot: ${getLastScreenshotError() ?? 'unknown error'}`
          : 'Chromium not found (env, dedicated browsers dir, PATH, known paths). Run `bash scripts/install_browser.sh` to install the dedicated chrome-headless-shell. card.html and share.txt were generated, but card.png was skipped.'
        : undefined,
  };

  printOutput(result, isJson, () => {
    console.log(`🎨 結果カード一式の生成が完了しました！ [Card ID: ${card.card_id}]`);
    console.log(`📂 出力先ディレクトリ: ${outDir}`);
    console.log(`📄 HTMLカード: ${htmlPath}`);
    console.log(`📝 共有テキスト: ${shareTextPath}`);
    if (pngCreated) {
      console.log(`🖼️ 結果カード画像: ${pngPath} (1080x1350 4:5 PNG, SSAA高品質縮小済)`);
    } else if (!htmlOnly) {
      console.warn(`⚠️ 注意: ${result.warning}`);
    }
  });

  return result.ok ? 0 : 1;
}

async function handleExportGuest(
  positional: string[],
  options: Record<string, string | boolean>,
  isJson: boolean
): Promise<number> {
  const resultFile = positional[0];
  const metaFile = options['meta'];
  if (!resultFile) {
    printError(
      'Target result.json path is required: result-card export-guest <path/to/result.json> --meta <path/to/guest_meta.json>',
      1,
      isJson
    );
    return 1;
  }
  if (!metaFile || typeof metaFile !== 'string') {
    printError('Option --meta <path/to/guest_meta.json> is required', 1, isJson);
    return 1;
  }

  const metaAbsPath = path.resolve(metaFile);
  if (!fs.existsSync(metaAbsPath)) {
    printError(`Meta file not found: ${metaAbsPath}`, 2, isJson);
    return 2;
  }

  let meta: GuestMetaInput;
  try {
    meta = JSON.parse(fs.readFileSync(metaAbsPath, 'utf8')) as GuestMetaInput;
  } catch (err) {
    printError(`Failed to parse meta JSON: ${(err as Error).message}`, 2, isJson);
    return 2;
  }

  const res = await exportGuestAgent({
    resultPath: resultFile,
    meta,
    avatarPath: typeof options['avatar'] === 'string' ? options['avatar'] : undefined,
    outPath: typeof options['out'] === 'string' ? options['out'] : undefined,
  });

  if (!res.ok) {
    printOutput({ ok: false, errors: res.errors }, isJson, () => {
      console.error(`❌ ゲストデータのエクスポートに失敗しました:`);
      for (const err of res.errors ?? []) {
        console.error(`  - ${err}`);
      }
    });
    return 1;
  }

  printOutput(
    {
      ok: true,
      out_path: res.out_path,
      agent_id: res.agent_id,
      target_axis: res.target_axis,
      avatar_base64_length: res.avatar_base64_length,
    },
    isJson,
    () => {
      console.log(`🤝 ゲスト共有データ（guest.json）を出力しました！`);
      console.log(`📄 出力先: ${res.out_path}`);
      console.log(`🆔 ID: ${res.agent_id} | 得意軸: ${res.target_axis}`);
      console.log(`🖼️ 256px WebP Base64長: ${res.avatar_base64_length} chars`);
    }
  );
  return 0;
}

export async function runCli(argv: string[]): Promise<number> {
  const { command, positional, options } = parseCliArgs(argv);
  const isJson = Boolean(options['json']);

  if (options['help'] || !command) {
    if (isJson) {
      console.log(JSON.stringify({ ok: true, commands: ['render', 'validate', 'export-guest'] }));
    } else {
      console.log(`
Result Card CLI (Step C Renderer v0.9)

Usage:
  result-card render <path/to/result.json> [--out <dir>] [--html-only] [--json]
  result-card validate <path/to/result.json> [--json]
  result-card export-guest <path/to/result.json> --meta <path/to/guest_meta.json> [--avatar <path>] [--out <path>] [--json]
      `);
    }
    return 0;
  }

  switch (command) {
    case 'validate':
      return await handleValidate(positional, options, isJson);
    case 'render':
      return await handleRender(positional, options, isJson);
    case 'export-guest':
      return await handleExportGuest(positional, options, isJson);
    default:
      printError(`Unknown command '${command}'`, 1, isJson);
      return 1;
  }
}

if (import.meta.main) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
}
