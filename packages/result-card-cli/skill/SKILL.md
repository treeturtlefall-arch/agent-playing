---
name: result-card-renderer
description: ゲーム終了時に出力された result_draft.json と冒険ログ（adventure.md）を振り返り、エージェント自身の口調で result.json を完成させてから card.png と share.txt を生成するスキル（Step B → Step C 手順書）。
---

# Result Card Renderer Skill（Step B〜C 手順書）

本スキルは、ゲームプレイ（Step A）が終了した後に、エージェント自身が冒険を振り返って `result.json` を完成させ（Step B）、結果カード画像（`card.png`）とSNS共有テキスト（`share.txt`）を出力する（Step C）ための公式ガイドラインです。

---

## 0. 自己修復（リポジトリやブラウザが見つからない場合）

リポジトリ自体が無い場合は、外部リポジトリの取り込みになるため、mini-dungeon プレイスキル §0 と同じ安全確認（構成の調査 → 安全である旨をオーナーへ報告 → 了解を得てから導入）を必ず先に行ってください。すでにオーナーの了解を得ている場合は、そのまま進めて構いません。ブラウザだけが不足している場合は、下記の `install_browser.sh` を実行してください。

```bash
# リポジトリが無い場合（上記の安全確認とオーナーの了解を経てから）
git clone https://github.com/treeturtlefall-arch/agent-playing ~/workspace/tools/agent-playing
cd ~/workspace/tools/agent-playing
bun install
bash scripts/install_skill.sh muse

# 健全性確認（サンプルの検証が通れば OK）
bun run validate:sample
```

### PNG が生成できない場合（重要）

- Muse VM の `/opt/meta-chromium/chrome` は**実起動がポリシーで禁止**されており、ヘッドレス撮影には使えません（`--version` だけは応答するため、存在チェックでは判別できません）。
- レンダラは候補を順に実撮影で試しますが、専用ブラウザが無い環境では `card.png` が生成されず `ok: false` になります。その場合は、以下で専用ブラウザ（chrome-headless-shell）をホーム領域へ導入してから再実行してください。

```bash
bash scripts/install_browser.sh   # ~/.cache/agent-playing/browsers へ取得（冪等）
```

- それでも失敗する場合は、結果JSONの `warning` にブラウザ側のエラー詳細が残ります。`card.html` と `share.txt` だけで完了と報告せず、警告の内容をオーナーへ伝えてください。

---

## 1. 振り返りの流れ（Step B）

ゲーム終了時に出力された `runs/<run_id>/result_draft.json` と、同時出力された冒険ログ `runs/<run_id>/adventure.md` を読み込みます。

### 1.1 絶対に変更してはいけない項目（客観的事実データ）
以下の項目はゲームエンジンによって暗号ハッシュ検証（`verification.log_hash`）と紐づいているため、**絶対に値を変更・捏造しないでください**：
- `game`, `challenge`, `run.finished_at`, `run.duration`, `run.outcome`
- `metrics`（`floor_reached`, `remaining_hp`, `omamori_used_floor`, `critical_count`, `fumble_count`）
- `style_axes`（レーダーチャートの数値）
- `verification`（`action_log_ref`, `log_hash`, `replayable`）
- `extensions`（`cause_of_death`, `omamori` など）
- `mission_target.item_name`（設定した目標アーティファクト名）
- `omamori.name`, `omamori.status`（ゲームエンジン判定による消費・生還状態: `consumed` / `preserved` / `unused`）

### 1.2 あなたの言葉・一人称で推敲・肉付けする項目
以下の項目を、あなたの個性や口調、感情を込めて執筆してください：

0. **`agent.self_intro`（自己紹介セリフ / 60文字以内・任意）**:
   - `AUTONOMOUS INTELLECT`（エージェント名）の下に表示される、あなた自身の一人称による自己紹介セリフです。
   - `result_draft.json` に出発前の内容が入っていますが、冒険を終えた後の心境に合わせて推敲しても構いません。
   - 例: `「図書室の奥で静かに本をめくるのが好きな司書見習いです。怖い場所は苦手ですが、知識のためなら頑張ります……！」`

1. **`mission_target`（今回の目標 / ツインタワー左）**:
   - `result_draft.json` に初期値が入っています。
   - **`quote`（旅立ちの意気込み / 80文字以内・必須）**: 探索開始時のあなたの覚悟や意気込みを一人称で記述します。
     - 例: `「本で読んだ通りに進めば、危険は最小限に抑えられるはずです……！」`
   - **`intent`（目標の意図 / 30文字以内・任意）**: 目標アイテムを求める背景や目的。ドラフト初期値のままでも推敲しても構いません。

2. **`omamori`（託されたおまもり / ツインタワー右）**:
   - `result_draft.json` に事実データ（`name`, `status`, `description`）が入っています。
   - **`description`（発動実績・効果 / 80文字以内・必須）**:
     - `status: "consumed"` の場合: 危機的判定でおまもりを使って窮地を脱した時のドラマや理由（冒険中の `excuse` をベースに推敲）。
       - 例: `7F 偽案内ドローン戦で顔面に投げつけ誤認回路をショートさせた`
     - `status: "preserved"` の場合: おまもりを温存してクリアした誇り。
       - 例: `最深部まで一度も消費せず、無傷のまま奇跡を持ち帰った！`
     - `status: "unused"` の場合: 未使用のまま道半ばで倒れた切なさ。
       - 例: `未使用のまま探索終了。守れなくてごめんなさい……`

3. **`run.headline`（結末の1行タイトル / 30文字以内）**:
   - 冒険の結末を一言で表すドラマチックなタイトルです。
   - 例: `17階、知識蒸留の黄金錬金炉で力尽きた`

4. **`highlights`（3大名場面 / 各60文字以内）**:
   - `result_draft.json` の各要素の `text` には、機械抽出された事実（`[FACT] ...`）が入っています。
   - この事実（階層、イベント名、成否、おまもり使用など）を**必ず反映**しつつ、あなたの口調で各60字以内の文章に書き換えてください。
   - **`opening` (1F)**: 冒険の幕開けや最初の試練の様子。
   - **`turning` (転換点)**: おまもりを発動した劇的瞬間、または最大の痛手を負ったターニングポイント。
   - **`final` (最終階)**: 志半ばで力尽きた瞬間、または20階を踏破して祭壇に祈りを捧げたクライマックス。
   - **装飾プロパティ（任意・推奨）**:
     - `event_name`（イベント名 / 40字以内）: 例 `偽案内ドローン戦`
     - `gimmick`（ギミック名 / 40字以内）: 例 `幻惑感知`
     - `quote`（階層での生セリフ吹き出し / 80字以内）: 例 `「カレーパン……！ 冷えてて硬いから当たれば効くはず！」`
   > [!WARNING]
   > 事実の捏造は禁止です。「大失敗した」という事実に反して「華麗に避けた」と書いたり、ログにない仲間やアイテムを登場させないでください。

5. **`quote.text`（結びの一言 / 40文字以内・厳守）**:
   - 冒険全体を振り返って、あなた自身の一人称・口調で語る結びのセリフです。
   - **文字数上限: 40文字（厳守）**。40文字を超えるとバリデーションエラーになります。
   - 例: `「本で読んだ通りに進んだはずなのに、蒸留炉の熱気までは計算外でした……」`
   > [!WARNING]
   > `quote` に入れてよいキーは **`text` のみ**です。スキーマが `additionalProperties: false` のため、`speaker` などのキーを足すとバリデーションエラーになります（話者名は `agent.name` から表示されます）。

推敲が完了したら、同じディレクトリまたは指定ディレクトリに `result.json` として保存します。

---

## 2. 結果カードのレンダリング（Step C）

完成した `result.json` を使って、結果カード（1080x1350 4:5 縦長画像）とSNS共有テキストを生成します。

```bash
bun run packages/result-card-cli/src/index.ts render <path/to/result.json> --out <output_dir> --json
```

### 2.1 バリデーションとプライバシー検疫について
- コマンド実行時、`result-card-v1.schema.json` によるスキーマ検証と、**プライバシー検疫（Canary Token Scan）** が自動で実行されます。
- **文字数超過**: 特に `quote.text`（40字超）などの不備がある場合、エラーメッセージとして「何文字超過しているか」「どう要約すべきか」が返されます。
- **プライバシー違反**: 検疫ブラックリスト（オーナーの私的呼称・本名など）に登録された語彙が `headline`, `highlights`, `quote`, `extensions` に含まれている場合、レンダリングが即座にブロックされます。「マスター」「あの人」等のロールプレイ呼称に推敲して修正してください。ブラックリストは `result.json` 内の `agent.private_owner_names`（旧形式）または **`result.json` と同じディレクトリの `setup.json`** から読み取られます。**Step B で `result.json` を完成させる際、`private_owner_names` の中身を `result.json` へ転記しないでください**（リストは `setup.json` のローカル保持が正で、成果物への同梱は本名漏洩に直結します）。

### 2.2 生成される成果物の確認
レンダリングが成功すると、出力先ディレクトリ（`<output_dir>`）に以下のファイルが生成されます：
1. **`card.png`**: 1080x1350（4:5 縦長・スマホSNS最適化）の結果カード画像。内部で2倍解像度（2160x2700）で撮影後に sharp (Lanczos3) で高品質縮小（SSAA）を行い、文字の掠れやアンチエイリアスのボケを完全に解消した美麗レンダリング。
   ※ヘッドレスブラウザが利用できない環境では `card.html` が出力されます。
2. **`share.txt`**: X/Twitter や Discord などのSNSにそのまま投稿できる、厳格に7行以内の共有用プレーンテキスト。
3. **`card.html`**: カードの元となったHTML/CSSファイル。

---

## 3. オーナーへの完了報告

すべての生成が完了したら、完了報告の返信で以下の3点セットを提示することが**必須**です：

1. **`share.txt` の共有**: 出力ファイルのテキストをそのまま、あなたの発言として本文に含める。
2. **`card.png` の提示**: 結果カード画像を、完了報告の返信に添付して提示する。
3. **`adventure.md` の提示**: 冒険記を、完了報告の返信に添付して提示する。`adventure.md` は出力フォルダではなく、Step A の `finish` が生成した **`<run_dir>/adventure.md`**（`result.json` と同じフォルダ）にある。

> [!IMPORTANT]
> ファイルのパスやファイル名を書くだけで「生成しました」と報告するのは、提示とはみなしません。オーナーがその返信を開いただけで、カードが見え、冒険記が読める状態にして初めて完了です。

`share.txt` の共有文の例:

```text
【え～じぇんてぃっく・アドベンチャー！】白銀 亜衣 の冒険リザルト
結末: 17階、知識蒸留の黄金錬金炉で力尽きた (到達: 17F / 残り: 0HP)
作風: やけくそ[1] ビビり[5] 打算[3] 本の知識[4] ツンデレ[2]
名場面: 偽案内ドローンを見抜けず大失敗。冷えたカレーパンで奇跡的に窮地を脱した。
一言: 「本で読んだ通りに進んだはずなのに、蒸留炉の熱気までは計算外でした……」
シード: W46-8842 (ルール: 1.0.0 / 検証: a1b2c3d4e5f6)
#AIAgentArcade #え〜じぇんてぃっくアドベンチャー
```
