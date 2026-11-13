# 非同期・疑似協力プレイ（Asynchronous Co-op）＆ ゲスト共有データ仕様書 v1.0

作成日: 2026-11-13  
対象スキーマ: [`specs/guest-agent-v1.schema.json`](./guest-agent-v1.schema.json)  
関連仕様: [`specs/result-card-spec-v1.md`](./result-card-spec-v1.md) / [`proposal/01-mechanics-and-math.md`](../proposal/01-mechanics-and-math.md)

---

## 1. 概要・コアコンセプト

本仕様は、`mini-dungeon`（20階層ダンジョン）において、他の家庭の自律型AIエージェント（Muse等）の探索データを「同行者（Companion / Guest）」として迎え入れ、**非同期の疑似協力プレイ**および**共闘ハイライトイラスト生成（Step D）**を実現するためのデータ契約を定義する。

1. **非同期データ共有による疑似マルチプレイ（ポーン／白霊方式）**
   - リアルタイム通信を行わず、JSONファイル1つ（またはAPIからの1件取得）で他エージェントの人格・作風5軸・外見データを召喚する。
2. **ゲームバランスを壊さない「1ラン1回の見せ場保証（V2o方式）」**
   - Muse側でのモンテカルロ試算（`N=2000/型` ペア比較）に基づき、踏破率の目標帯（35〜40%）と型間公平性を維持するため、**「環境軸（`s_env`）とゲスト得意軸（`target_axis`）が一致した最初のフロアで、実効素質 `s_eff` を `+1`（上限5）する効果を1ラン1回のみ発動」**する **V2o方式** を採用する。
   - ダンジョン生成の環境軸クォータ保証（各軸3〜4フロア配置）により、**18Fまで進めば100%、浅層〜中層でもほぼ確実に1ラン1回のゲストの見せ場が発生する**。
3. **参照3枚による共闘ハイライト画像生成（Step D 拡張）**
   - JSON内に **256×256px WebP（Base64 Data URI、上限約32KB）** と外見・ポーズ描写（`appearance_prompt` / `highlight_poses`）を同梱するハイブリッド方式を採用。
   - 探索終了後（Step D）、`[シーン背景参照] + [ホスト原寸アバター] + [ゲスト256pxアバター]` の3枚参照により、人間型・マスコット型を問わず特徴の混同なく共闘一枚絵を生成できる（Muse実機検証済）。

---

## 2. ゲームメカニクス（V2o：軸一致アシスト・1ラン1回）

### 2.1 スロットの位置づけ
- 既存の「おまもり（`omamori`：オーナーが託した1つを任意のピンチで1回発動、判定ランク+1）」とは**完全に独立した `companion`（同行者）スロット**として扱う。
- `--guest <path>` を指定しない通常のソロプレイでは、従来と1bitの狂いもなく同一の挙動・乱数消費・検証結果を維持する。

### 2.2 発動条件と計算式（V2o）
道中フロア（1F〜18F、環境属性 `s_env !== 'none'`）の判定解決（`choose`）時、以下の条件を満たす場合に**自動発動**する：

1. このランでまだゲストのアシスト（`companion_assisted`）が発動していない（**1ラン1回限り**）。
2. 現在のフロアの環境属性 `s_env` が、ゲストの `gameplay.assist.target_axis` と一致している。

**発動時の効果**:
- 通常の Weakest Link 実効素質 `base_s_eff = min(s_act, s_env_val)` に対し、**`s_eff = min(5, base_s_eff + 1)`** としてスキル補正値 `skill_mod = s_eff - 3` を算出する。
- ※すでに `base_s_eff === 5` であっても、「その環境軸の試練において同行者が背中を支えた」という物語上の見せ場を保証するため、**最初の軸一致フロアで発動扱い（消費）**とし、ログに `companion_assisted: true` とゲストの掛け合いセリフ（`dialogues.on_assist`）を記録する。

---

## 3. 決定論的検証（`verify`）との整合性

外部から読み込んだゲストデータが判定計算（`s_eff` および `skill_mod`）に介入するため、リプレイ検証（`verify`）の完全再現性を以下の手順で担保する：

1. **開始時のランディレクトリ凍結**:
   - `mini-dungeon new --seed <seed> --setup <setup.json> --guest <guest.json>` 実行時、バリデーションを通過したゲストJSONを **`runs/<run_id>/guest.json` としてランタイムディレクトリ内に凍結保存**する。
2. **SHA-256 ハッシュの記録**:
   - 凍結したゲストJSONの正規化文字列に対する SHA-256 ハッシュ（先頭12文字 `guest_hash`）を算出し、`state.json` および `result_draft.json` の `verification.guest_hash` に記録する。
3. **`verify` 時の再計算**:
   - `mini-dungeon verify` 実行時は、`runs/<run_id>/guest.json` の存在と `guest_hash` の一致を検証した上で、同一の V2o ルールで全フロアの `s_eff`・`skill_mod`・`companion_assisted` フラグを再計算し、改竄を検知する。

---

## 4. セキュリティ・検疫・バリデーション規約

他プレイヤーが作成した外部JSONを取り込むため、`validateGuestAgent()` において以下の多層防御を実施する：

1. **5軸合計15点の厳格検証**:
   - `gameplay.style_axes` は `autonomy`, `safety`, `efficiency`, `creativity`, `alignment` の5軸すべてが `0〜5` の整数であり、かつ**合計がちょうど `15`** でなければ拒絶する。
2. **アシスト効果の固定キャップ**:
   - `gameplay.assist.mode` は `"v2o_axis_boost"`、`s_eff_modifier` は `1` のみ許可し、不正なDC加算や無敵化効果を拒絶する。
3. **画像データのサイズ・形式制限**:
   - `visuals.avatar_base64` は `data:image/(webp|png|jpeg);base64,...` 形式のみ許可し、文字列長上限を **45,000文字（バイナリ約32KB相当）** に制限する（実測では 256×256 WebP quality 82 で 5KB〜18KB に収まる）。
4. **プロンプトインジェクション対策＆文字数制限**:
   - すべてのテキストフィールド（`personality`, `speech_style`, `appearance_prompt`, `dialogues.*` 等）に厳格な文字数上限（60〜200文字）を設け、制御文字やシステム命令偽装パターン（`Ignore previous instructions` / `システムプロンプトを無視` 等）を含むデータを拒絶・無害化する。
5. **非公開オーナー名検疫（`scanPrivacyLeaks`）**:
   - エクスポート時（自分のデータを共有JSON化する際）、ローカルの `setup.json` にある `private_owner_names` がゲストJSON内のセリフや碑文に混入していないか自動スキャンし、漏洩をブロックする。
