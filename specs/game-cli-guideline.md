# ゲームCLI共通規約（Game CLI Guideline v1）

本ドキュメントは、`PROJECT_VISION.md` の「2層パイプライン」を実現するため、各ゲームCLI（Step A）が守るべき入出力インターフェースと、`result_draft.json` の仕様を定義する。

---

## 1. CLIの基本要件

1. **決定論的シード (`--seed`)**
   - すべてのゲームは `--seed <string>`（例: `--seed W46-8842`）を受け取り、同じシードとルール版数であれば同じ初期配置・乱数系列を再現できること。
2. **構造化出力 (`--json`)**
   - AIエージェントが状態を読み取りやすいよう、`--json` オプション指定時は標準出力に1行または1オブジェクトの有効なJSONのみを出力すること。
3. **終了コード（Exit Code）**
   - `0`: 正常処理完了（ゲーム進行中、またはゲーム終了に伴うドラフト出力完了）
   - `1`: 不正なコマンド・ルール違反の行動指定（エージェントが再試行可能）
   - `2`: システムエラー・ファイルI/Oエラー

---

## 2. プレイ終了時の出力（Step A → Step B の境界）

ゲーム終了時（クリア、ゲームオーバー、リタイア問わず）、ゲームCLIは指定された出力ディレクトリ（例: `runs/<run_id>/`）に以下の2ファイルを必ず出力する。

1. **`logs/<seed>_<agent>.jsonl`（行動ログ）**
   - 1ターン1行のJSON Lines形式。
   - このファイル全体の SHA-256 ハッシュの先頭12桁を `verification.log_hash` に記録する。
2. **`result_draft.json`（結果ドラフト）**
   - `result-card-v1.schema.json` と同じ骨格を持つが、以下の点が異なる。
   - **ゲーム側が機械的に確定させる項目（エージェントによる書き換え禁止）**:
     - `game`, `challenge`, `run.finished_at`, `run.duration`, `run.outcome`
     - `metrics`（数値・順序固定）
     - `style_axes`（行動ログから算出した作風5軸 0〜5）
     - `verification`（`action_log_ref`, `log_hash`, `replayable`）
   - **エージェントが Step B で記入・推敲する項目**:
     - `agent`（名前・アバター参照・自己紹介セリフ・個性タグ最大5個）
     - `run.headline`（結末の1行・30字以内目安。ドラフト段階では機械生成の仮タイトルが入る）
     - `highlights[].text`（各60字以内。ドラフト段階では `fact` として機械抽出された事実が入る）
     - `quote.text`（本人の一言・40字以内。ドラフト段階では空文字列 `""`）

---

## 3. ハイライト抽出の原則（捏造防止）

ゲームCLIは `result_draft.json` の `highlights` に、ログから機械的に拾った3つの瞬間（`opening` / `turning` / `final`）の事実データを出力する。
エージェント（Step B）は、この事実データに基づいて表現・口調のみを整え、存在しない出来事を作ってはならない。

---

## 4. 付録：第1弾ゲーム `mini-dungeon`（20階層ダンジョン）固有規約

詳細なコマンド体系・状態管理およびデータ契約は [`proposal/06-cli-and-data-contract.md`](../proposal/06-cli-and-data-contract.md) を正とする。

### コマンド体系（保留・確定ステートマシン）
1. `mini-dungeon new --seed <S> --setup <F> --omamori <F> --run-dir <D> --json` : 初期化
2. `mini-dungeon status --run-dir <D> --json` : 現在階層・HP・選択肢取得
3. `mini-dungeon choose <A|B> --run-dir <D> --json` : 選択実行（判定ランクは保留状態）
4. `mini-dungeon omamori --excuse "<str>" --run-dir <D> --json` : おまもり発動（判定+1昇格、1回限定）
5. `mini-dungeon accept --run-dir <D> --json` : 保留判定の確定・HP変動
6. `mini-dungeon comment --text "<str>" --run-dir <D> --json` : 階層短評記録・次階層へ進行
7. `mini-dungeon finish --run-dir <D> --json` : ドラフト出力（`result_draft.json` と `adventure.md`）

### プライバシー保護と検疫
- `setup.json` で `private_owner_names`（非公開オーナー名配列）が指定されている場合、`finish` 時に `adventure.md` やドラフト内への混入を自動スキャンし、警告を出力する。
- リザルトカードレンダラ（`result-card render`）は、`private_owner_names` の混入を検知した場合にレンダリングをブロックし、ロールプレイ呼称への推敲を促す。
8. `mini-dungeon verify --run-dir <D> --json` : ログリプレイと `log_hash` 検証

