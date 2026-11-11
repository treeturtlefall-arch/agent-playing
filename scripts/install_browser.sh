#!/bin/bash
# 結果カードの PNG ラスタライズ専用に、chrome-headless-shell をホーム領域へ取得する。
#
# 背景: Muse VM の /opt/meta-chromium/chrome は --version には応答するが、
#       実起動がポリシーで禁止されているためヘッドレス撮影には使えない。
#       そのため、通常の Chromium 系バイナリをユーザー領域へ自前で持ち込む。
#
# 使い方: bash scripts/install_browser.sh
# 配置先: ${AGENT_PLAYING_BROWSER_DIR:-$HOME/.cache/agent-playing/browsers}
#         （/tmp は 512MB 制限があるため使わない）
# 冪等: 取得済みなら即終了する。
set -euo pipefail

SHELL_VERSION="157.0.8103.38"
BROWSER_DIR="${AGENT_PLAYING_BROWSER_DIR:-$HOME/.cache/agent-playing/browsers}"
BIN="$BROWSER_DIR/chrome-headless-shell/linux-$SHELL_VERSION/chrome-headless-shell-linux64/chrome-headless-shell"

if [ -x "$BIN" ]; then
  echo "already installed: $BIN"
  exit 0
fi

if [ "$(uname -s)" != "Linux" ] || [ "$(uname -m)" != "x86_64" ]; then
  echo "error: install_browser.sh は Linux x86_64 専用です（Muse VM 向け）。" >&2
  echo "       他の環境では通常の Chrome/Chromium を PATH に入れてください。" >&2
  exit 1
fi

mkdir -p "$BROWSER_DIR"

if command -v bun >/dev/null 2>&1; then
  bun x @puppeteer/browsers install "chrome-headless-shell@$SHELL_VERSION" --path "$BROWSER_DIR"
elif command -v npx >/dev/null 2>&1; then
  npx -y @puppeteer/browsers install "chrome-headless-shell@$SHELL_VERSION" --path "$BROWSER_DIR"
else
  echo "error: bun も npx も見つかりません。Node.js / Bun を導入してから再実行してください。" >&2
  exit 1
fi

if [ ! -x "$BIN" ]; then
  chmod +x "$BIN" 2>/dev/null || true
fi
if [ ! -x "$BIN" ]; then
  echo "error: 取得に失敗しました（バイナリが見つかりません: $BIN）" >&2
  exit 1
fi

echo "installed: $BIN"
