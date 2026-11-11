# AIエージェントの skills へ、本リポジトリのスキル2本 (SKILL.md / skill.yaml) を配置する。
# install_skill.sh の PowerShell 鏡写し。仕様は .sh 版と同一。
#
# 使い方: powershell -File scripts/install_skill.ps1 [muse|gemini|antigravity|<配置先ベースパス>]
#   muse        -> $HOME\workspace\custom-skills\<スキル名> (Muse、既定)
#   gemini      -> $HOME\.gemini\config\skills\<スキル名> (Gemini CLI / Antigravity)
#   antigravity -> gemini と同じ
#   <パス>      -> そのディレクトリ配下に <スキル名> フォルダを作って配置する
# 環境変数 AGENT_PLAYING_SKILL_DEST でも指定できる (引数が優先、無指定時の既定は muse)。
param([string]$Target = "")

$ErrorActionPreference = "Stop"

if (-not $Target) {
    $Target = if ($env:AGENT_PLAYING_SKILL_DEST) { $env:AGENT_PLAYING_SKILL_DEST } else { "muse" }
}

switch ($Target) {
    "muse" { $Base = Join-Path $HOME "workspace\custom-skills" }
    { $_ -in "gemini", "antigravity" } { $Base = Join-Path $HOME ".gemini\config\skills" }
    default { $Base = $Target }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot

function Install-One([string]$SrcDir, [string]$SkillName) {
    $dest = Join-Path $Base $SkillName
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item (Join-Path $RepoRoot "$SrcDir\SKILL.md") (Join-Path $dest "SKILL.md") -Force
    Write-Host "installed: $(Join-Path $dest 'SKILL.md')"
    $yaml = Join-Path $RepoRoot "$SrcDir\skill.yaml"
    if (Test-Path $yaml) {
        Copy-Item $yaml (Join-Path $dest "skill.yaml") -Force
        Write-Host "installed: $(Join-Path $dest 'skill.yaml')"
    }
}

Install-One "packages\games\mini-dungeon\skill" "mini-dungeon-player"
Install-One "packages\result-card-cli\skill" "result-card-renderer"
