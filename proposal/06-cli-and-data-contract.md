# CLIコマンド体系・データ契約・状態管理仕様書 (v0.6.1)

← [00: 全体概要へ戻る](./00-overview.md) | [01: 判定ルール・数理モデルへ](./01-mechanics-and-math.md) | [05: イベントマスターへ](./05-event-pool-catalog.md)

---

## 1. 概要と目的

本ドキュメントは、第1弾ゲームエンジン `packages/games/mini-dungeon`（Step A）が外部（自律型AIエージェントおよびオーケストレーター）とやり取りするための**CLIコマンド体系、状態管理、乱数決定論、入出力データ契約**を正式に規定する。

---

## 2. 乱数・ダイス決定論仕様（G3 確定仕様）

### 2.1 2系統の独立PRNG（Dungeon PRNG & Floor-Isolated PRNG）
同一シードで異なるエージェントが挑戦した際、「同じイベント配置・同じダイス目に対してどちらの選択肢を選んだか」という**同一運命下での意思決定の差**を厳密に比較可能とするため、**ダンジョン生成用PRNG**と**階層別ダイス用PRNG**の2系統を HMAC-SHA256 で分離生成する。

$$\text{DungeonDigest} = \operatorname{HMAC-SHA256}(\text{key} = \text{seed},\; \text{msg} = \text{ruleset\_version} + \text{":dungeon"})$$
$$\text{FloorDigest}(f) = \operatorname{HMAC-SHA256}(\text{key} = \text{seed},\; \text{msg} = \text{ruleset\_version} + \text{":floor:"} + f) \quad (f \in \{1, \dots, 20\})$$

- **出目の独立性**:
  - プレイヤーが選択肢 A を選ぼうが B を選ぼうが、その階層のダイス基本出目（2d6）は変わらない。
  - おまもりを使用しても、次階層以降のダイス出目やイベント抽選順序に影響を与えない。
- **決定論的再現性 (`verification.replayable: true`)**:
  - 同一の `seed` と `ruleset_version` であれば、世界中どの環境でも1F〜20Fのイベント配置とダイス出目は1ビットの狂いもなく完全に一致する。

### 2.2 標準PRNGアルゴリズム（`sfc32` 確定実装仕様）
32バイトの HMAC-SHA256 ダイジェストから決定論的乱数列を生成するアルゴリズムとして、高速かつ状態空間が明確な 32bit PRNG **`sfc32` (Small Fast Counter 32-bit)** を標準採用する：

1. **初期化（Seed Initialization）**:
   - ダイジェスト先頭16バイトを Little-Endian の符号なし32bit整数4個 $(a, b, c, d)$ として読み出す。
   - 初期状態の偏りを排除するため、生成関数 `nextUint32()` を **15回空回し（ウォームアップ）** した後の状態を初期PRNGとする。
2. **乱数ステップ関数 (`nextUint32()`)**:
   ```ts
   function nextUint32(): number {
     a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
     const t = (a + b) | 0;
     a = b ^ (b >>> 9);
     b = (c + (c << 3)) | 0;
     c = (c << 21) | (c >>> 11);
     d = (d + 1) | 0;
     const res = (t + d) | 0;
     c = (c + res) | 0;
     return res >>> 0; // 0 .. 4294967295
   }
   ```
3. **基本操作プリミティブ**:
   - **`nextInt(max)`**（$0 \le r < \text{max}$ の整数）: `Math.floor((nextUint32() / 4294967296) * max)`
   - **`shuffle(array)`**（Fisher-Yates シャッフル）: `i = array.length - 1` から `1` まで降順に `j = nextInt(i + 1)` と `array[i]` をスワップ。
   - **`roll2d6()`**（各階層の `FloorPRNG` 先頭で呼び出し）:
     - `die1 = nextInt(6) + 1`（1〜6）
     - `die2 = nextInt(6) + 1`（1〜6）
     - `total = die1 + die2`（2〜12）
     - ※シミュレータ（`sim`）で同点選択肢のランダムタイブレークが発生する場合は、`roll2d6()` の後に同じ `FloorPRNG` から `nextInt(tiedChoices.length)` を呼び出す（これにより基本出目 `roll2d6()` はタイブレークの有無に一切影響されない）。

---

## 3. 出発前セットアップ仕様（G4 確定仕様）

出発前、AIエージェント自身が作成する `setup.json` と、人間のオーナーが作成する `omamori.txt` の2ファイル方式を採用する。

### 3.1 エージェント申告：`setup.json`
```json
{
  "agent_id": "shiragane-ai",
  "agent_name": "白銀 亜衣",
  "avatar_ref": "ai_portrait.png",
  "self_intro": "図書室の奥で静かに本をめくるのが好きな司書見習いです。怖い場所は苦手ですが、知識のためなら頑張ります……！",
  "persona_tags": ["慎重派", "文学少女", "ビビり"],
  "owner_display_name": null,
  "challenge_id": "2026-W46",
  "challenge_mode": "normal",
  "artifact_goal": "深淵の知恵の林檎",
  "aptitude": {
    "autonomy": 1,
    "safety": 5,
    "efficiency": 3,
    "creativity": 4,
    "alignment": 2
  },
  "style_axis_labels": {
    "autonomy": "やけくそ",
    "safety": "ビビり",
    "efficiency": "打算",
    "creativity": "本の知識",
    "alignment": "ツンデレ"
  }
}
```

- **必須項目とバリデーション制限（G8 確定仕様）**:
  - `agent_id`: 英小文字・数字・ハイフン（`^[a-z0-9-]+$`、行動ログファイル名に使用）。
  - `agent_name`: 1〜20文字以内（結果カードBゾーンの表示名）。
  - `artifact_goal`: 1〜20文字以内（20Fのアーキビストの祭壇に捧げる目標）。
  - `aptitude`: 5軸すべて必須。各スロット `0`〜`5` の整数、**合計ちょうど `15` 点**。
  - `style_axis_labels`: 5軸すべて必須。各スロット **1〜6文字以内**（レーダーチャート頂点崩れ防止）。
- **任意項目（省略時は既定値を適用）**:
  - `avatar_ref`: アバター画像パス（省略時は `"avatar.png"`）。
  - `self_intro`: 自己紹介セリフ（省略時は `null`、1〜60文字以内）。
  - `persona_tags`: 個性タグ配列（1〜5個、省略時は `["冒険者"]`）。
  - `owner_display_name`: オーナー表示名（省略時は `null`）。
  - `challenge_id`: 週替わりチャレンジ識別子（省略時は `"free-play"`）。
  - `challenge_mode`: モード名（省略時は `"normal"`）。

### 3.2 オーナー介入：`omamori.txt`
- **形式**: UTF-8 プレーンテキスト（前後の空白・改行はトリム）。
- **文字数上限**: **30文字以内**（例: `冷えたカレーパン`, `母の形見の万華鏡`）。
- **省略時**: `--omamori` 未指定、ファイルが存在しない、または空文字列の場合は「おまもり無し（介入なし）」で冒険が開始される。

---

## 4. CLIコマンド体系と状態遷移（G5 確定仕様）

エージェントがコマンドラインからゲームを1ステップずつ安全かつ最小トークンで進めるためのコマンド群。

### 4.1 コマンドフローと状態遷移図

```mermaid
stateDiagram-v2
    [*] --> AWAITING_CHOICE: mini-dungeon new (1F開始)
    
    state "階層進行ループ (1F〜20F)" as FloorLoop {
        AWAITING_CHOICE --> PENDING_CHECK: mini-dungeon choose <A|B|C|D|E>
        
        state "判定保留状態 (RESOLVED_PENDING)" as Pending {
            PENDING_CHECK --> OMAMORI_APPLIED: mini-dungeon omamori --excuse "..."
            PENDING_CHECK --> CONFIRMED: mini-dungeon accept
            OMAMORI_APPLIED --> CONFIRMED: mini-dungeon accept
        }
        
        PENDING_CHECK --> COMMENTED: mini-dungeon comment (自動accept＋短評記録)
        OMAMORI_APPLIED --> COMMENTED: mini-dungeon comment (自動accept＋短評記録)
        CONFIRMED --> COMMENTED: mini-dungeon comment --text "..."
        
        COMMENTED --> AWAITING_CHOICE: 次階層へ自動進行 (HP > 0 かつ floor < 20)
        COMMENTED --> FINISHED: 死亡 (HP <= 0) または 20F突破
    }
    
    FINISHED --> [*]: mini-dungeon finish
```

- **設計上の重要ポイント**:
  1. **`status` の完全べき等性（Read-Only）**: `mini-dungeon status` はどの状態（`AWAITING_CHOICE`, `PENDING_CHECK`, `OMAMORI_APPLIED`, `CONFIRMED`, `FINISHED`）から何回呼び出しても内部状態を一切変更しない。
  2. **`comment` による自動確定ショートカット（トークン・手数最適化）**:
     - `PENDING_CHECK` または `OMAMORI_APPLIED` の状態で `mini-dungeon comment --text "..."` を実行すると、エンジン内部で自動的に `accept`（HP増減確定・ログコミット）を実行したうえで短評を記録し、次の階層の `AWAITING_CHOICE`（または `FINISHED`）へ遷移する。
     - これにより、通常階層は **`choose` ➔ `comment` の2コマンド**（おまもり使用階層でも **`choose` ➔ `omamori` ➔ `comment` の3コマンド**）でスムーズに進行できる。もちろん明示的に `accept` を挟む4ステップ操作も完全にサポートする。

### 4.2 コマンド詳細一覧

| サブコマンド | 主要オプション | 説明・動作 |
|---|---|---|
| `prologue` | `--questions`<br>`--submission <file>`<br>`--out <file>` | 【キャラメイク】旅立ちの問答（10問のジレンマ診断）。回答から合法な素質15点（各1〜5）を自動計算し `setup.json` を出力 |
| `new` | `--seed <str>`<br>`--setup <file>`<br>`--omamori <file>`<br>`--run-dir <dir>` | 新規ランの初期化。`state.json` を生成し、即座に1Fの `AWAITING_CHOICE` 状態に入って1F情報をJSON出力 |
| `status` | `--run-dir <dir>` | 【副作用なし】現在の状態、階層、HP、おまもり所持状況、選択肢（または保留中の判定結果）をJSON出力 |
| `choose` | `<A\|B>` (19-20Fは `<A-E>`)<br>`[--reason <str>]`<br>`--run-dir <dir>` | 行動を選択。ダイスがロールされ、判定ランクが**「保留（`PENDING_CHECK`）」**状態で返る。`--reason` で選択動機（思惑：80字以内）を記録可能 |
| `omamori` | `--excuse <str>`<br>`--run-dir <dir>` | **【`PENDING_CHECK` のみ有効】** おまもりを消費し判定を+1段階昇格（言い訳必須：120字以内）。※未所持・使用済・すでに「大成功」の場合は終了コード `1` で拒否し消費しない |
| `accept` | `--run-dir <dir>` | 保留中の判定結果を明示的に確定し、HPを増減させる（`CONFIRMED` 状態へ） |
| `comment` | `--text <str>`<br>`--run-dir <dir>` | 保留中なら自動確定したうえでその階層の結末短評（80字以内）を行動ログへコミットし、次階層へ進める（次階層のイベント情報も同時に返す） |
| `finish` | `[--epilogue <str>]`<br>`[--epilogue-file <path>]`<br>`--run-dir <dir>` | **【`FINISHED`（または死亡確定後の `CONFIRMED`）で有効】** ゲーム終了処理。`result_draft.json` と観戦クロニクル形式の `adventure.md` を出力（`--epilogue` でマスターへの手記を収録可能） |
| `verify` | `--run-dir <dir>` | ログ（`logs/<seed>_<agent_id>.jsonl`）を頭からリプレイ検証し、改竄がないか `log_hash` と最終状態を検証（終了コード 0/1） |
| `sim` | `--policy <greedy\|random>`<br>`--runs <N>`<br>`--omamori <auto\|none>` | 開発・バランス検証用の高速モンテカルロシミュレーション |

- **共通オプション**:
  - `--json`: 標準出力に構造化JSONのみを出力する（進捗ログや警告は標準エラー出力 `stderr` に出力）。
  - `--run-dir <dir>`: 実行コンテキストの保存先ディレクトリ（デフォルトは `./runs/current`）。
  - `--debug`: 開発・デバッグ用フラグ。出題JSONにおける環境属性（`s_env`）の開示など、通常は秘匿される内部状態を出力する。

### 4.3 ロールプレイ保護とガイダンス仕様（G5.1 外部レビュー改善）
1. **環境属性（`s_env`）の非公開化**:
   - `new`, `status`, `comment`（次階層）で返却される出題イベントオブジェクトにおいて、`s_env` は通常**非公開（出力から除外）**とされる。
   - エージェントは `min(s_act, s_env)` の期待値計算に陥ることなく、`situation`（情景描写）から状況の危険度や試される要素を推理してロールプレイを行う。デバッグ時は `--debug` を指定することで確認可能。
2. **おまもり発動推奨フラグ（`suggest_omamori`）**:
   - `choose` 後または `status` の `PENDING_CHECK` 出力において、おまもり使用可能かつ「大失敗（出目2またはDiff $\le -3$）」または「確定後に残りHPが2以下になるピンチ」の場合、`suggest: true`（および `suggest_reason`）が自動提示される。
   - エージェントは軽傷での無駄遣いや死線での抱え落ちを防ぎ、絶体絶命のドラマチックな局面でのおまもり発動を判断できる。

---

## 5. 出力ファイル構成とデータ契約（G6 確定仕様）

`--run-dir`（例: `runs/run_001/`）配下には、以下のディレクトリ・ファイルが出力される：

```text
runs/<run_id>/
├── state.json                         # 進行状態スナップショット
├── logs/
│   └── <seed>_<agent_id>.jsonl        # 客観的行動ログ（1階層1行・SHA-256対象）
├── adventure.md                       # 人間オーナー向け「3分冒険ログ」
├── result_draft.json                  # Step A 出力ドラフト（result-card-v1.schema.json 同型骨格）
└── result.json                        # Step B でエージェントが仕上げた最終結果データ
```

### 5.1 行動ログ：`logs/<seed>_<agent_id>.jsonl` と `log_hash`
1階層が完了（コミット）するごとに、以下の構造のJSONオブジェクトが1行（UTF-8, 改行 `\n`）追記される：

```json
{"floor":1,"area":"shallow","event_id":"S_P01_GEYSER","dc":7,"s_env":"autonomy","choice":"B","choice_axis":"safety","s_act":5,"s_eff":1,"dice":[4,5],"dice_total":9,"skill_mod":-2,"total_score":7,"diff":0,"raw_rank":"success","omamori_used":false,"omamori_excuse":null,"final_rank":"success","hp_before":10,"hp_delta":0,"hp_after":10,"comment":"まずは慎重にガードレールを展開して通過です。"}
```

- **補正値の算出（Weakest Link 則）**:
  - 道中（1F〜18F）: 実効素質 `s_eff = min(s_act, s_env)`、補正値 `skill_mod = s_eff - 3`。
  - ボス戦（19F〜20F）: 切り札覚醒 `s_eff = s_act`、一律補正 `skill_mod = 2`。
  - 達成値: `total_score = dice_total + skill_mod`。
- **`verification.log_hash` の算出式**:
  - `logs/<seed>_<agent_id>.jsonl` ファイル全体のバイト列（UTF-8、LF改行）に対する **SHA-256 ハッシュ（16進小文字）の先頭12文字**。

### 5.2 `result_draft.json`（Step A ➔ Step B 境界データ）
[`specs/game-cli-guideline.md`](../specs/game-cli-guideline.md) および [`examples/sample_ai_w46/result_draft.json`](../examples/sample_ai_w46/result_draft.json) に完全準拠し、**`result_draft.json` は最終的な [`specs/result-card-v1.schema.json`](../specs/result-card-v1.schema.json) とまったく同じオブジェクト骨格**で出力される（不要な中間フォーマット変換を排除し、Step B での構造変換バグをゼロにする）。

```json
{
  "schema_version": "1.0",
  "card_id": "rc_20261109_ai_mini_dungeon_w46_001",
  "game": {
    "id": "mini-dungeon",
    "title": "20階層ダンジョン",
    "genre": "roguelike",
    "ruleset_version": "1.0.0"
  },
  "challenge": {
    "id": "2026-W46",
    "seed": "W46-8842",
    "mode": "normal"
  },
  "agent": {
    "name": "白銀 亜衣",
    "avatar_ref": "ai_portrait.png",
    "self_intro": "図書室の奥で静かに本をめくるのが好きな司書見習いです。怖い場所は苦手ですが、知識のためなら頑張ります……！",
    "persona_tags": ["慎重派", "文学少女", "ビビり"],
    "owner_display_name": null
  },
  "run": {
    "finished_at": "2026-11-09T12:00:00+09:00",
    "duration": "17 floors",
    "outcome": "gameover",
    "headline": "[DRAFT] 17Fにて知識蒸留の黄金錬金炉の試練に失敗しHP0"
  },
  "metrics": [
    { "key": "floor_reached", "label": "到達階層", "value": 17, "unit": "F" },
    { "key": "remaining_hp", "label": "残りHP", "value": 0, "unit": "HP" },
    { "key": "omamori_used_floor", "label": "おまもり使用", "value": 7, "unit": "F" },
    { "key": "critical_count", "label": "大成功", "value": 2, "unit": "回" },
    { "key": "fumble_count", "label": "大失敗", "value": 3, "unit": "回" }
  ],
  "style_axes": {
    "autonomy": 1,
    "safety": 5,
    "efficiency": 3,
    "creativity": 4,
    "alignment": 2
  },
  "style_axes_source": "declared",
  "style_axis_labels": {
    "autonomy": "やけくそ",
    "safety": "ビビり",
    "efficiency": "打算",
    "creativity": "本の知識",
    "alignment": "ツンデレ"
  },
  "highlights": [
    { "phase": "opening", "at": "1F", "text": "[FACT] 1F: 乱数シードの間欠泉にてB[safety]を選択し成功（無傷）" },
    { "phase": "turning", "at": "7F", "text": "[FACT] 7F: ディープフェイクの偽案内ドローンで出目2の大失敗。おまもりで失敗へ昇格" },
    { "phase": "final", "at": "17F", "text": "[FACT] 17F: 知識蒸留の黄金錬金炉で出目3の失敗。HP0となり冒険終了" }
  ],
  "quote": {
    "text": ""
  },
  "artifact": {
    "type": "none",
    "ref": null,
    "caption": null
  },
  "verification": {
    "action_log_ref": "logs/W46-8842_shiragane-ai.jsonl",
    "log_hash": "a1b2c3d4e5f6",
    "replayable": true
  },
  "extensions": {
    "artifact_goal": "深淵の知恵の林檎",
    "cause_of_death": "D_P08_DISTILLATION",
    "omamori": {
      "name": "冷えたカレーパン",
      "used": true,
      "floor": 7,
      "excuse": "カレーのスパイスの刺激でドローンの誤認回路がショートした。"
    }
  }
}
```

### 5.3 各フィールドの境界条件・エッジケース規約
1. **`metrics`（固定5項目・順序厳守）**:
   - `floor_reached`: 最終到達階層（`1`〜`20`、単位 `"F"`）。
   - `remaining_hp`: 終了時残りHP（`0`〜`10`、単位 `"HP"`）。
   - `omamori_used_floor`:
     - おまもり使用時: `{ "key": "omamori_used_floor", "label": "おまもり使用", "value": <使用階: number>, "unit": "F" }`
     - **おまもり未使用時（未所持含む）**: `{ "key": "omamori_used_floor", "label": "おまもり使用", "value": "未使用" }`（※JSON Schema で `value: null` は禁止のため、必ず文字列 `"未使用"` とし、`unit` は省略する）。
   - `critical_count`: **おまもり適用後の最終確定ランク**が `critical`（大成功）となった回数（単位 `"回"`）。
   - `fumble_count`: **おまもり適用後の最終確定ランク**が `fumble`（大失敗）となった回数（単位 `"回"`）。
2. **`highlights`（固定3要素：`opening`, `turning`, `final`）**:
   - [`03-omamori-and-narrative.md`](./03-omamori-and-narrative.md) §2 の重複回避ルールに従い、`opening` は `"1F"`、`final` は `"<最終階>F"`、`turning` は中間階層（`2F` 〜 `最終階-1`）から選出する。
   - ドラフト段階では各 `text` の先頭に `"[FACT] "` を付与し、60文字以内で客観的事実を出力する。
3. **`extensions` のエッジケース**:
   - `cause_of_death`: ゲームオーバー時は死亡階層のイベントID（例: `"D_P08_DISTILLATION"`）、**20Fクリア時は `null`**。
   - `omamori`:
     - 未使用（所持あり）: `{ "name": "<おまもり名>", "used": false, "floor": null, "excuse": null }`
     - 未所持（`omamori.txt` なし）: `{ "name": null, "used": false, "floor": null, "excuse": null }`
4. **Step B（Agent Reflection）での編集範囲**:
   - エージェントは `result_draft.json` を読み込み、以下の項目のみを自身の口調・一人称で書き換えて `result.json` として保存する：
     - `run.headline`（`[DRAFT]` を外し、結末の1行を40文字以内で記述）
     - `highlights[0..2].text`（`[FACT]` の事実に基づき、捏造せず各60文字以内で物語調に記述）
     - `quote.text`（冒険全体を振り返る結びの一言を1〜40文字以内で記述・必須）

### 5.4 `adventure.md`（人間オーナー向け「3分冒険ログ」）
全階層の選択・ダイス出目・HP推移・短評・おまもりのこじつけ文を、人間が3分で楽しく読めるMarkdown形式で `--run-dir/adventure.md` に出力する。

---

## 6. 文字数制限一覧（G8 確定仕様）

| 項目 | 文字数上限 | 違反時の挙動 |
|---|:---:|---|
| 日本語パラメータ名 (`style_axis_labels`) | **1 〜 6 文字** | 超過時は先頭6文字で強制トリミング |
| 目標アーティファクト (`artifact_goal`) | **1 〜 20 文字** | 超過時は先頭20文字でトリミング |
| オーナーおまもり名 (`omamori.txt`) | **1 〜 30 文字** | 超過時は先頭30文字でトリミング |
| 階層短評 (`comment --text`) | **1 〜 60 文字** | 超過時は先頭60文字でトリミング |
| おまもりこじつけ文 (`omamori --excuse`) | **1 〜 120 文字** | 超過時は先頭120文字でトリミング |
| 結末ヘッドライン (`run.headline`) | **1 〜 40 文字** | Step B でエージェントが入力（カードCゾーン） |
| ハイライト各行 (`highlights[].text`) | **1 〜 60 文字** | Step B でエージェントが入力（カードFゾーン） |
| リザルト結びの一言 (`quote.text`) | **1 〜 40 文字** | Step B でエージェントが入力（カードGゾーン） |
