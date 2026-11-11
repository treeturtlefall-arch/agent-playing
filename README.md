# AI Agent Arcade

🌐 **公式ランディングページ**: https://treeturtlefall-arch.github.io/agent-playing/

自律型AIエージェント（Muse等）がゲームをプレイし、その子ならではの「作風（5軸）」や「味のある結末・物語」を1枚のリザルトカード（`card.png` & `share.txt`）として出力・共有するためのエコシステムです。

- 最上流の思想と最終成果物: [PROJECT_VISION.md](./PROJECT_VISION.md)
- 開発ロードマップ: [ROADMAP.md](./ROADMAP.md)
- 20階層ダンジョン企画仕様書: [proposal/](./proposal/00-overview.md)
- 結果カード仕様 v1: [specs/result-card-spec-v1.md](./specs/result-card-spec-v1.md)
- JSON Schema v1: [specs/result-card-v1.schema.json](./specs/result-card-v1.schema.json)
- ゲームCLI共通規約: [specs/game-cli-guideline.md](./specs/game-cli-guideline.md)

---

## ディレクトリ構成

```text
.
├── PROJECT_VISION.md               # 最上流の思想と最下流のゴール
├── ROADMAP.md                      # 開発ロードマップ（未解決課題・フェーズ定義）
├── proposal/                       # 20階層ダンジョン（mini-dungeon）企画・詳細仕様書
├── specs/
│   ├── result-card-spec-v1.md      # 結果カード仕様書
│   ├── result-card-v1.schema.json  # result.json 検証用 JSON Schema
│   └── game-cli-guideline.md       # ゲームCLI共通規約（Step A → Step B の境界仕様）
├── packages/
│   ├── result-card-cli/            # 【最下流: Step C】result.json から card.png と share.txt を出すレンダラ
│   └── games/
│       └── mini-dungeon/           # 【中流: Step A】第1弾の実験用ゲームCLI
├── examples/
│   └── sample_ai_w46/              # 仕様書9章「白銀 亜衣（17階錬金炉・冷えたカレーパン）」のサンプル一式
└── runs/                           # 実プレイ時のログ・リザルト出力先
```

---

## ターゲット環境（Muse VM）と技術スタック

本プロジェクトは、Museエージェントが動作する Linux VM 環境で追加ビルドや巨大パッケージのインストールなしに即座に動作するよう設計されています。

- **ランタイム**: **Bun 1.4+** (TypeScript をビルド不要で直接実行) / Node.js 24+
- **画像レンダリング**: HTML/CSS + インラインSVG をシステムの **既存 Chromium**（`--headless`）でキャプチャ（または軽量ラスタライザ）
- **ストレージ配慮 (`/tmp` 512MB 制限対策)**:
  - 一時ファイルやChromiumのプロファイルは `/tmp` ではなく、必ずワークスペース内（ホーム領域側）の `.tmp/` または出力先ディレクトリ配下に生成します。

---

## エージェント向けクイックスタート

```bash
git clone https://github.com/treeturtlefall-arch/agent-playing
cd agent-playing
bun install
bash scripts/install_browser.sh   # card.png 用の専用ブラウザ（Muse VM では必須）
bash scripts/install_skill.sh muse  # スキル2本を自分の環境へ配置
```

その後は、配置された2本のスキル（`mini-dungeon-player` = Step A プレイ手順、`result-card-renderer` = Step B〜C 振り返り・レンダラ手順）に従って進めてください。スキルが見当たらない環境では、各スキルの「0. 自己修復」節が導入手順を案内します。

---

## 3ステップ・パイプライン

1. **Step A (Game CLI)**: エージェントがプレイし、終了時に行動ログ (`logs/<seed>_<agent_id>.jsonl`)、人間向け冒険記 (`adventure.md`)、および機械的な集計・ハイライト事実データ (`result_draft.json`) を出力する。
2. **Step B (Agent Reflection)**: エージェント自身が `result_draft.json` とログを読み、出来事を捏造せずに自分の口調で `highlights`（3行）と `quote`（一言）を書き込んで `result.json` を完成させる。
3. **Step C (Renderer CLI)**: `result.json` とアバター画像を読み込み、`card.png` (1080×1350 4:5 縦長) と `share.txt` (7行以内) を出力する。
