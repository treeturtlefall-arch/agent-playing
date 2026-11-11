# ROADMAP アーカイブ（Phase 0 〜 Phase 4: v1.0 リリースまで）

本ドキュメントは、AI Agent Arcade / 20階層ダンジョン（mini-dungeon）の **Phase 0（仕様凍結）から Phase 4（エージェント実戦投入 v1.0 完了）** までの設計ギャップ解消履歴、タスク実績、完了条件（DoD）検証記録のアーカイブである。

最新のアクティブなロードマップは [`ROADMAP.md`](../ROADMAP.md) を参照のこと。

---

## 目次
- [2. Phase 0：仕様凍結 v0.6（実装前に潰すべきギャップ）](#2-phase-0仕様凍結-v06実装前に潰すべきギャップ)
  - [Critical（実装ブロッカー: G1〜G5）](#critical実装ブロッカー)
  - [Important（v1.0までに必須: G6〜G12）](#importantv10までに必須)
  - [Phase 0 最終監査で解消した潜在バグ・境界条件（B1〜B6）](#️-phase-0-最終監査で洗い出し解消した潜在バグ境界条件v061)
  - [Phase 0 の成果物](#phase-0-の成果物)
- [3. Phase 1：エンジンコア v0.7（入出力のない純粋ロジック）](#3-phase-1エンジンコア-v07入出力のない純粋ロジック-完了)
- [4. Phase 2：CLI・行動ログ・ドラフト出力 v0.8（Step A 完成）](#4-phase-2cli行動ログドラフト出力-v08step-a-完成)
- [5. Phase 3：結果カードレンダラ v0.9（Step C 完成）](#5-phase-3結果カードレンダラ-v09step-c-完成)
- [6. Phase 4：エージェント実戦投入 v1.0（3段パイプラインの開通）](#6-phase-4エージェント実戦投入-v103段パイプラインの開通)

---

## 2. Phase 0：仕様凍結 v0.6（実装前に潰すべきギャップ）

企画書を読み込んで見つかった、**決めないとコードが書けない／バランスが崩れる** 論点です。優先度順に並べています。

### 🔴 Critical（実装ブロッカー）

| ID | 論点 | 問題 | 提案・決定 |
|:---:|---|---|---|
| **G1** | 環境属性「5軸×各4回」保証の数え方が合わない | [04](../proposal/04-world-and-generation.md) は「全20階層で各4回」としているが、[05](../proposal/05-event-pool-catalog.md) ではボス2階層が `s_env: none`。道中は **18階層しかないため、5軸すべてを同じ回数にはできない**（18÷5は割り切れない）。5万回モンテカルロの前提が崩れている可能性がある | **✅ 解決済（環境制約ボトルネックモデル採用）**: 道中18階層で「各軸3〜4回（3軸が4回、2軸が3回）」とし、どの軸を4回にするかはシードで決定。ボス2階層は `s_env: none`（切り札覚醒補正 `+2`、DC 9）。道中は Weakest Link 原則による実効素質 $\min(s_{\text{act}}, s_{\text{env}}) - 3$ を採用。全18通りの15点配分の踏破率が 34.7%〜39.8%（全体平均 37.1%、乖離幅わずか5.1%）に完全収束することを実証し確定。`proposal/01`, `04`, `05`, `06` に反映完了。 |
| **G2** | **作風軸（出力 0〜5）の算出式が決まっていない** | 「選んだ行動が作風軸のカウントに積み上がる」としか書かれていない。単純に回数を数えると、**どのイベントが出たか（＝その軸が選択肢に何回出たか）で値が偏る** | **✅ 解決済（シンプル案・アプローチB採用）**: プレイ後の余計な事後計算による歪みを排し、**「出発前にエージェントが自分で決めた素質15点（＋自律命名ラベル）」をそのまま結果カードのレーダーチャート（Eゾーン）に反映**する方式に統一。実際のプレイ中のドラマや行動パターンのギャップは、冒険ログ（`adventure.md`）やハイライト、`quote` で十分に観測できるため、作風軸の再計算問題そのものを解消・不要化。`proposal/02` に反映完了。 |
| **G3** | 乱数（ダイス）の割り当て方 | 同じシードで「同じ出目に対して別の選択をした」と比べられるかどうかは、乱数の消費順で決まる | **✅ 解決済**: 階層ごとに独立した乱数列 `PRNG(hash(seed, ruleset_version, floor))` を採用。どの選択肢を選んでも、おまもりを使っても各階層のダイス目は不変であり、同一運命下の選択比較を保証。`proposal/06` に反映。 |
| **G4** | 出発前セットアップの仕様 | 素質15点の配分・軸の命名は[02](../proposal/02-parameters-and-5axes.md)で決まっているが、**「目標アーティファクト」の宣言**（20Fで使う）と、**おまもりをオーナーから受け取る経路**がどこにも書かれていない | **🟡 仮採用（テストプレイで検証）**: エージェント作成の `setup.json`（素質・軸名・目標アーティファクト）とオーナー作成の `omamori.txt`（30字以内）の2ファイル方式。Phase 4 のエージェントテストで使い勝手を確認・最適化する。`proposal/06` に反映。 |
| **G5** | CLIのコマンド体系と状態管理 | 「判定を見たあと・HPが減る前におまもりを使う」には**2段階の操作**が必要だが、コマンドの流れが決まっていない | **✅ 解決済**: `new`, `status`, `choose`, `omamori`, `accept`, `comment`, `finish`, `verify`, `sim` の保留・確定ステートマシンを正式仕様化。`proposal/06` に反映。 |

**CLI仕様（確定）**

```bash
mini-dungeon new     --seed W46-8842 --setup setup.json --omamori omamori.txt --run-dir runs/<run_id> --json
mini-dungeon status  --run-dir runs/<run_id> --json          # 現在の階層・HP・選択肢を表示
mini-dungeon choose  A --run-dir runs/<run_id> --json        # 判定を実行 → 結果は「保留」状態になる
mini-dungeon omamori --run-dir runs/<run_id> --excuse "..." --json   # 保留中の判定を+1段階上げる（1回だけ）
mini-dungeon accept  --run-dir runs/<run_id> --json          # 保留中の判定をそのまま確定する
mini-dungeon comment --run-dir runs/<run_id> --text "..." --json     # その階層の一言短評 → 次の階層へ
mini-dungeon finish  --run-dir runs/<run_id> --json          # result_draft.json と adventure.md を出力
mini-dungeon verify  --run-dir runs/<run_id> --json          # ログを最初から再生し、ハッシュと結果が一致するか確認
mini-dungeon sim     --policy greedy --runs 50000 --json     # バランス検証用のモンテカルロ
```

### 🟡 Important（v1.0までに必須）

| ID | 論点 | 提案・決定 |
|:---:|---|---|
| **G6** | `result_draft.json` への項目の対応づけ | **✅ 解決済**: **metrics（5個）**: floor_reached, remaining_hp, omamori_used_floor, critical_count, fumble_count。**extensions**: aptitude, artifact_goal, cause_of_death, omamori。**highlights**: opening(1F), turning(おまもりまたは最大被弾階), final(最終階)。`proposal/06` にスキーマ定義完了。 |
| **G7** | 浅層だけ `s_env` のルールが違う | 浅層の P06・P09 は、`s_env` がどちらの選択肢の軸とも一致しない（中層・深層は必ずどちらかと一致する）。これが意図したもの（第3属性トラップ）なのか、記載ミスなのかを確認し、確定する | **✅ 解決済（オーナー判断：方針A採用）**: オーナーの確認により、原案の不一致はAI生成時の記載ミスであることを確認。方針A（提示された2択のいずれかと必ず一致する完全対称・各軸2回ルール）を正式採用として確定・凍結。P01(autonomy), P02(autonomy), P06(safety), P09(efficiency) 等に統一し、`proposal/05` に反映完了。 |
| **G8** | 自由記述の文字数上限 | **✅ 解決済**: 軸名(1〜6字)、目標アーティファクト(20字)、おまもり名(30字)、短評(60字)、おまもり言い訳(120字)、quote(40字)に確定。`proposal/06` に反映。 |
| **G9** | サンプルの更新 | `examples/sample_ai_w46` を20F版で作り直す（白銀 亜衣・7Fの難所でおまもりを使用、など）。これはレンダラ開発用の基準データ（ゴールデンデータ）も兼ねる | **✅ 解決済**: `examples/sample_ai_w46/result.json` および `result_draft.json` を20階層版仕様（17F到達・冷えたカレーパン・ビビり等）に更新完了。スキーマ検証パスを確認。 |
| **G10** | [result-card-spec §12](../specs/result-card-spec-v1.md) に残っている未決事項4件 | オーナー表示名・5軸を全ゲーム共通で固定するか・カードのフレーム・quote の口調。**v1 は「5軸固定・共通フレーム・素の口調」で凍結**することを推奨 | **✅ 解決済**: ①オーナー表示名は任意（既定null）、②5軸は共通英語キー固定＋日本語自律命名、③1080x1080共通フレーム統一、④quoteはその子の素の口調、として凍結。`specs/result-card-spec-v1.md` に反映完了。 |
| **G11** | **環境属性の均等保証ドローアルゴリズムの未定義** | 05 のカタログは各エリア10イベント（各軸2回）。ドロー数は浅層6・中層8・深層4（計18）。全体で「3軸が4回、2軸が3回」を満たす具体的な生成手順（制約付きドロー）が未定義で、実装者によって決定論的再現性の解釈が割れる | **✅ 解決済（シード駆動制約付きドロー仕様の策定）**: `DungeonPRNG` による5軸シャッフルから浅層6・中層8・深層4の枠数とイベント抽出・並び替えまで、デッドロックゼロかつ乱数消費順序が一意に定まるアルゴリズムを `proposal/04` に明記。 |
| **G12** | **結果カード仕様との `style_axes` の意味乖離** | 共通仕様 v1 は「行動ログから事後算出（measured）」だが、mini-dungeon は「出発前の自己申告素質15点（declared）」がカードに入るため同名異義になる | **✅ 解決済**: 結果カード仕様 v1.1 に `style_axes_source: "declared" \| "measured"`（既定は `measured`）を追加し、スキーマおよび `specs/result-card-spec-v1.md` に反映完了。 |

### 🛠️ Phase 0 最終監査で洗い出し・解消した潜在バグ・境界条件（v0.6.1）

| ID | 論点 | 発見された問題・潜在バグ | 解決・確定仕様 |
|:---:|---|---|---|
| **B1** | `result_draft.json` のスキーマ二重定義バグ | `proposal/06` のみが独自フラット構造を定義しており、`specs/game-cli-guideline.md` や `sample_ai_w46/result_draft.json` と構造が分裂していた | **✅ 解決済**: Step A が出力する `result_draft.json` を `result-card-v1.schema.json` と完全同型の骨格に統一し、不要な構造変換を廃止（`proposal/06` 更新） |
| **B2** | おまもり未使用・クリア時のスキーマ検証クラッシュ | `metrics` の `omamori_used_floor.value` に `null` を入れると JSON Schema 検証でクラッシュする | **✅ 解決済**: 未使用時は `value: "未使用"`（`unit` 省略）、クリア時の `cause_of_death` は `null` と規定（`proposal/06` §5.3） |
| **B3** | PRNGの具体アルゴリズム未定義と `DungeonSeed` 欠落 | ダンジョン生成用シードと 32bit PRNG のビット演算式が未定義で、異環境間の完全再現性が担保できなかった | **✅ 解決済**: `DungeonDigest` と `FloorDigest(f)` の2系統 HMAC-SHA256、および Little-Endian 初期化＋15回ウォームアップ付きの **`sfc32`** を標準仕様として確定（`proposal/06` §2.2） |
| **B4** | イベントIDのエリア間重複と表記不一致 | 浅層・中層・深層すべてが `P01`〜`P10` で重複しており、死因ID（`D_P08_DISTILLATION`）と対応していなかった | **✅ 解決済**: 全30イベント＋ボス2体に `S_P01_GEYSER` 〜 `D_P10_CATHEDRAL`, `B_19F_DRAGON`, `B_20F_ARCHIVIST` の一意なIDを付与（`proposal/05`） |
| **B5** | CLIステートマシンの `status` 副作用と大成功時おまもり空撃ち | `new` 直後に `status` を呼ばないと進めない設計、大成功時におまもりを使うと無駄消費される問題、毎階層3コマンド必須の冗長性 | **✅ 解決済**: ① `new` 直後に1Fの `AWAITING_CHOICE` へ遷移し `status` を完全Read-Only化、② 大成功時のおまもり使用は終了コード `1` で拒否、③ `comment` 実行時の自動 `accept` ショートカット（通常階層2コマンド完結）を導入（`proposal/06` §4） |
| **B6** | 統計集計基準とハイライト `turning` の重複問題 | おまもり昇格時の `critical_count` / `fumble_count` 基準が曖昧。また1Fや最終階でおまもりを使うと `opening` / `final` と `turning` が重複する | **✅ 解決済**: ① カウントは**おまもり適用後の最終確定ランク基準**、② `turning` は中間階層（`2F` 〜 `最終階-1`）から選出する重複回避優先順位ルールを策定（`proposal/01`, `03`, `06`） |

### Phase 0 の成果物
- [x] `proposal/06-cli-and-data-contract.md`（G3〜G6・G8・B1〜B6 の契約を網羅）
- [x] `proposal/04`・`05` の修正（G1・G7・G11・B4）、`proposal/01`（DC・判定式・統計基準更新）、`proposal/02` に素質15点カード直接反映を追記（G2）
- [x] `proposal/05` の浅層 P06/P09 修正および全32イベントの一意ID化完了（G7・B4）
- [x] `specs/game-cli-guideline.md` に mini-dungeon 固有の付録を追加
- [x] `examples/sample_ai_w46` の20F版を作成・正規ID同期（G9・B1・B4）
- [x] `proposal/00-overview.md` のロードマップ節から本ファイルへリンクを張る
- [x] **エージェント（白銀 亜衣）レビュー反映 ＆ Phase 0 最終監査完了（2026-11-09）**

---

## 3. Phase 1：エンジンコア v0.7（入出力のない純粋ロジック）✅ 完了

**ゴール**: シードと選択の並びを与えたら、結果が完全に決定論的に出てくるライブラリを作る。

| タスク | 状態 | 内容 |
|---|:---:|---|
| 1-1 乱数生成器（PRNG） | ✅ 完了 | [`proposal/06`](../proposal/06-cli-and-data-contract.md) §2 に準拠した HMAC-SHA256 ＋ `sfc32`（15回ウォームアップ付）。`DungeonPRNG` と階層独立 `FloorPRNG(f)` を実装（`src/prng.ts`, `tests/prng.test.ts`） |
| 1-2 イベントマスタ | ✅ 完了 | [`proposal/05`](../proposal/05-event-pool-catalog.md) の30イベント（`S_P01_GEYSER`〜`D_P10_CATHEDRAL`）＋ボス2体（`B_19F_DRAGON`, `B_20F_ARCHIVIST`）をデータ化（`src/data/events.ts`, `tests/events.test.ts`） |
| 1-3 ダンジョン生成器 | ✅ 完了 | [`proposal/04`](../proposal/04-world-and-generation.md) §4 の制約付きドローアルゴリズムおよび確定DC表を実装（`src/generator.ts`, `tests/generator.test.ts`） |
| 1-4 判定・HP・おまもり | ✅ 完了 | 2d6＋攻守相殺モデル（素質0は `-3.5`）、19-20F魂の切り札覚醒（一律 `+2`・弱点なし）、出目12/2の特例、HP上限10、おまもり+1段階昇格・空撃ちガード（`src/mechanics.ts`, `tests/mechanics.test.ts`） |
| 1-5 バリデータ・集計 | ✅ 完了 | `setup.json` 検証（合計15点・各0〜5・文字数トリム）、確定ランク基準統計集計、ハイライト3行重複回避抽出、ドラフト骨格生成（`src/summary.ts`, `tests/summary.test.ts`） |
| 1-6 テスト | ✅ 完了 | `bun test`。全36テスト（単体・結合・境界値）がオールグリーン（`tests/engine.test.ts` 他） |
| 1-7 シミュレータ | ✅ 完了 | 公式検証プロトコル（`greedy` ＋ `omamori: auto`）および各種比較ポリシーで25万回ランを実行・分析完了（`src/sim.ts`, `scripts/run-sim.ts`） |

**完了条件 (DoD) 検証状況**
- [x] 同じシード＋同じ選択の並びから、毎回1ビットの狂いもなく同じ結果になる（決定論テスト合格）
- [x] `bun test` で全ユニットテスト・境界値テスト・収束検証テストがグリーンになる（高速実行確認）
- [x] 公式シミュレーション検証プロトコル（`greedy` ＋ `omamori: auto`）で全18通りの15点配分の踏破率が **34.7%〜39.8%（全体平均 37.1%、全アーキタイプが 35%〜40% 帯）** に完全収束することを実コードで再確認完了

---

## 4. Phase 2：CLI・行動ログ・ドラフト出力 v0.8（Step A 完成）

| タスク | 状態 | 内容 |
|---|:---:|---|
| 2-1 CLI | ✅ 完了 | G5 のコマンド体系（`new`, `status`, `choose`, `omamori`, `accept`, `comment`, `finish`, `verify`, `sim`）。`--json` 指定時は標準出力に純粋なJSONのみ出力。終了コード 0/1/2 を厳守（`src/cli.ts`, `tests/cli.test.ts`） |
| 2-2 状態管理 | ✅ 完了 | `runs/<run_id>/state.json`。途中から再開可能。一時ファイルは `/tmp` ではなく `runs/` または `.tmp/` を使用（`src/storage.ts`, `tests/storage.test.ts`） |
| 2-3 行動ログ | ✅ 完了 | `logs/<seed>_<agent>.jsonl`。1階層ごとに出目・補正・判定ランク・HPの変化・おまもり・短評を記録。SHA-256 の先頭12桁を `log_hash` に算出（`src/storage.ts`） |
| 2-4 `verify` | ✅ 完了 | ログに記録された選択を最初から再生し、出目・補正値・判定・HP・おまもり・ハッシュを再計算して改竄を完全検出（`src/verify.ts`, `tests/verify.test.ts`） |
| 2-5 `result_draft.json` | ✅ 完了 | G6 の対応づけで出力。確定ランク基準集計、ハイライト3行抽出、`result-card-v1.schema.json` 同型骨格 |
| 2-6 冒険ログの人間向け版 | ✅ 完了 | `adventure.md`：全階層のイベント・選択・出目・HPの推移・短評・おまもりのこじつけを、**3分で読めるMarkdown**として出力（`src/adventure.ts`, `tests/adventure.test.ts`） |

**完了条件 (DoD) 検証状況**
- [x] ボットが CLI だけを使って1から20Fまで（または死亡するまで）遊びきり、スキーマに準拠した `result_draft.json` と `adventure.md` が出力される
- [x] `verify` コマンドによるリプレイ検証が正常終了し、改竄ログの検出にも成功する
- [x] `bun test` で全51テストがグリーンになる（実行時間 760ms）

---

## 5. Phase 3：結果カードレンダラ v0.9（Step C 完成）

| タスク | 状態 | 内容 |
|---|:---:|---|
| 3-1 `validate` | ✅ 完了 | `specs/result-card-v1.schema.json`（JSON Schema 2020-12）による完全バリデーション。`ajv` ＋ `ajv-formats` で厳格検証（`src/validate.ts`, `tests/validate.test.ts`） |
| 3-2 HTMLテンプレート | ✅ 完了 | 1080×1080 正方形カード（A〜Iゾーン完全網羅）。インラインSVGレーダーチャート（親和円環配置・エージェント独自命名ラベル・0〜5段階グリッド）、DotGothic16 / M PLUS Rounded / Shippori Mincho の美麗組版（`templates/card.css`, `src/template.ts`, `src/radar.ts`） |
| 3-3 PNG化 | ✅ 完了 | Chromium自動検出器（PATH ➔ `/opt/meta-chromium/chrome` 等）。`--headless=new --screenshot` で 1080x1080 正方形 PNG（`card.png`）を生成。プロファイルは `.tmp/` に隔離（`src/browser.ts`, `src/cli.ts`） |
| 3-4 `share.txt` | ✅ 完了 | 厳格に7行以内のSNS共有用プレーンテキスト（到達点・作風5軸・名場面・一言・シード・検証ハッシュ）（`src/share.ts`, `tests/share.test.ts`） |
| 3-5 日本語の組版 | ✅ 完了 | 長いエージェント名、6文字の独自日本語ラベル、40字の quote、複数個性タグでも1080x1080の枠内に収まる安全なタイポグラフィ設計 |

**完了条件 (DoD) 検証状況**
- [x] `bun run validate:sample` で `examples/sample_ai_w46/result.json` がスキーマ検証に合格する
- [x] `bun run render:sample` で、白銀亜衣の実例から 1080x1080 正方形画像 `card.png`、`card.html`、および7行テキスト `share.txt` が生成される
- [x] `bun test` で全59テスト（単体・統合・境界値）がオールグリーンになる（実行時間 約4.8秒）

---

## 6. Phase 4：エージェント実戦投入 v1.0（3段パイプラインの開通）

| タスク | 状態 | 内容 |
|---|:---:|---|
| 4-1 プレイ用スキル | ✅ 完了 | [`packages/games/mini-dungeon/skill/SKILL.md`](../packages/games/mini-dungeon/skill/SKILL.md)：出発前準備（素質15点・軸命名・目標アーティファクト）→ 階層ごとの手順・情景推理 → おまもりこじつけ発動判断 → 短評記録 → ドラフト出力の完全ガイドライン策定 |
| 4-2 振り返りスキルの更新 | ✅ 完了 | [`packages/result-card-cli/skill/SKILL.md`](../packages/result-card-cli/skill/SKILL.md)：`result_draft.json` と `adventure.md` に基づく事実ハイライト執筆、40字以内 quote 推敲、カードレンダリング（Step B〜C）ガイドライン整備 |
| 4-3 実地テスト（ドッグフーディング） | ✅ 完了 | 実戦第1号ラン（白銀亜衣・シードW46-8842・おまもり「冷えたカレーパン」）により Step A → B → C を自律完走。18F瀕死耐え（HP1）から19Fボス「テンソル・ドラゴン」で散るドラマチックな死に様を記録し、1080x1080 `card.png`・`share.txt`・`result.json` を出力。`verify` リプレイ検証も完全合格 |
| 4-4 観測と評価 | ✅ 完了 | ① 作風5軸のオイラー正則化（位置バイアス完全解消） ② 9名の母集団ランダム検証（全軸1〜5フルレンジ発現） ③ 45,000回シミュレーションで全アーキタイプのクリア率が 35.3%〜38.4%（偏差わずか3.1%）に完全収束することを立証 |
| 4-5 調整・凍結 | ✅ 完了 | プライバシー検疫ガードレール（`private_owner_names` による Canary Token Scan / 自動ブロック / ロールプレイ呼称推敲規約）を実装・実証。**`ruleset_version: 1.0.0` として正式凍結**完了！ |

**完了条件 (v1.0 リリース条件)**: 実際のエージェントが人の手を借りずに **Step A → B → C** を通しで実行し、`card.png`・`share.txt`・`result.json` の3点が手元に揃う。 → **達成済**（`runs/playtest_ai_001`）
