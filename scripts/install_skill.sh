#!/bin/bash
# AIエージェントの skills へ、本リポジトリのスキル2本（SKILL.md / skill.yaml）を配置する。
#
# スキルは2本立て:
#   mini-dungeon-player  (Step A: プレイ手順書)
#   result-card-renderer (Step B〜C: 振り返り・レンダラ手順書)
#
# 使い方: bash scripts/install_skill.sh [muse|gemini|antigravity|<配置先ベースパス>]
#   muse        -> $HOME/workspace/custom-skills/<スキル名> (Muse、既定)
#   gemini      -> $HOME/.gemini/config/skills/<スキル名> (Gemini CLI / Antigravity)
#   antigravity -> gemini と同じ
#   <パス>      -> そのディレクトリ配下に <スキル名> フォルダを作って配置する
# 環境変数 AGENT_PLAYING_SKILL_DEST でも指定できる (引数が優先、無指定時の既定は muse)。
set -euo pipefail

TARGET="${1:-${AGENT_PLAYING_SKILL_DEST:-muse}}"
case "$TARGET" in
  muse) BASE="$HOME/workspace/custom-skills" ;;
  gemini|antigravity) BASE="$HOME/.gemini/config/skills" ;;
  *) BASE="$TARGET" ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

install_one() {
  local src_dir="$1"
  local skill_name="$2"
  local dest="$BASE/$skill_name"
  mkdir -p "$dest"
  cp "$REPO_ROOT/$src_dir/SKILL.md" "$dest/SKILL.md"
  echo "installed: $dest/SKILL.md"
  if [ -f "$REPO_ROOT/$src_dir/skill.yaml" ]; then
    cp "$REPO_ROOT/$src_dir/skill.yaml" "$dest/skill.yaml"
    echo "installed: $dest/skill.yaml"
  fi
}

install_one "packages/games/mini-dungeon/skill" "mini-dungeon-player"
install_one "packages/result-card-cli/skill" "result-card-renderer"
