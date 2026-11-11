# 【AIレビュー依頼書】AI Agent Arcade / 20階層ダンジョン（mini-dungeon）Phase 1 エンジンコア実装

---

## 0. レビュアーAIへの指示プロンプト（System Prompt / Role）

あなたは **シニアゲーム数理デザイナー 兼 TypeScriptソフトウェアアーキテクト** です。  
本ドキュメントは、自律型AIエージェント向けゲームプロジェクト『AI Agent Arcade』の第1弾ゲーム **「20階層ダンジョン（mini-dungeon）」の Phase 1（エンジンコア v0.7）実装コードおよび数理モデル** のレビュー依頼パッケージです。

以下の「プロジェクト前提とコア思想」「レビュー観点」を踏まえ、実装コードおよびシミュレーション結果に対する批評・リスク洗い出し・改善提案を客観的かつ建設的に行ってください。

---

## 1. プロジェクト前提とコア設計思想

### ① これは「人間用のゲーム」ではない
- プレイヤーは人間ではなく、**人格・キャラクター設定を持った自律型AIエージェント（LLM）** です。
- 人間（オーナー）の役割はプレイヤーではなく**「観測者・保護者・ファン」** です。
- したがって、人間向けのリアルタイムGUIは不要であり、AIエージェントがCLI（標準入出力 `--json`）経由で状況理解・意思決定できるインターフェースを最優先としています。

### ② 「性能測定（ベンチマーク）」ではなく「個性の観測装置」である
- 単一の最適解やハイスコアを競わせるものではありません。
- 5つの作風軸（`autonomy`, `safety`, `efficiency`, `creativity`, `alignment`）からなる合計15点の個性パラメータを持ち、エージェントごとの性格・生き様が結果に滲み出る設計です。
- クリアだけでなく**「その子らしい味のある敗北・死に様」こそが最高のご褒美コンテンツ** になるよう設計されています。

### ③ 目標踏破率：30% 〜 40%（完全収束）
- 「失敗しても怒らない（ログの面白さがすべて）」という思想に基づき、クリアの希少価値を高め、7割の「味のある死に様カード」を最大のご褒美とします。
- **最重要要件**: パラメータの振り方（特化型・バランス型・極振り型など）によって踏破率が大きく偏らないこと（**「どの性格のエージェントでも約35%〜40%で均等に生還できる」** こと）。

### ④ 3段階パイプライン構造
1. **Step A (Game CLI)**: 決定論的ゲーム実行エンジン（本コードが担当）。客観的行動ログと `result_draft.json` を出力。
2. **Step B (Agent Reflection)**: プレイしたエージェント自身が自分の口調・一人称で振り返り、`result.json` を完成。
3. **Step C (Renderer CLI)**: 1080x1080正方形の結果カード画像（`card.png`）とSNS用テキストを出力。

---

## 2. Phase 1 で解決・実装した主要アーキテクチャ

### 2.1 判定数理モデル：環境制約ボトルネック則（Weakest Link原則）
エージェントが提示された2択のうち高い素質を選ぶ（`greedy`）と、従来の攻守加算モデルでは特化型が道中7割で得意技を連発して踏破率が60%超に跳ね上がる問題（既知リスク）が発生しました。  
これを解決するため、**「環境制約ボトルネックモデル（Weakest Link則）」** を導入しました：

$$\text{実効素質 } s_{\text{eff}} = \min(s_{\text{act}}, s_{\text{env}})$$
$$\text{達成値} = 2\text{d}6 + (s_{\text{eff}} - 3)$$
$$\text{判定差分 (Diff)} = \text{達成値} - \text{階層DC}$$

- **数理思想**: 「どんなに高い得意技（$s_{\text{act}}$）を持っていても、その部屋の環境属性（$s_{\text{env}}$）に耐えうる範囲でしか真価を発揮できない」。
- **補正値の範囲**: 実効素質 $s_{\text{eff}} \in \{0, \dots, 5\}$ に対し、完全対称な整数 $s_{\text{eff}} - 3$（$-3 \sim +2$）。浮動小数点の恣意的な係数は一切排除。
- **決戦ボス（19F・20F）**: 魂の切り札覚醒モデル（どの選択肢でも一律 $+2$ 補正、DC 9、五分五分の勝負）。
- **「おまもり」システム**: 判定結果を見た後、HP減少が確定する前にエージェントの自律判断で1回限り+1段階昇格（大失敗→失敗、失敗→成功、成功→大成功）。大成功時の空撃ちは禁止。

### 2.2 2系統の独立PRNG（決定論的再現性の担保）
- ダンジョン生成用 `DungeonPRNG` と各階層のダイス用 `FloorPRNG(f)` を HMAC-SHA256 で分離生成。
- 32bit PRNG **`sfc32`**（15回ウォームアップ付）を採用。
- 同一シードであれば、選択肢を変えてもおまもりを使っても、他階層のイベント順序やダイス出目に一切影響を与えない。

### 2.3 制約付きプロシージャルダンジョン生成
- 全30イベント（浅層10、中層10、深層10）＋ボス2体。
- 道中18階層（浅層6、中層8、深層4）において、5軸の環境属性が**「3軸が4回、2軸が3回（計18回）」出現することをデッドロックゼロで数学的に100%保証するアルゴリズム**。

---

## 3. 実証データ（テスト＆シミュレーション結果）

### 3.1 5万回モンテカルロシミュレーション検証結果（計250,000回ラン）
公式検証プロトコル：`greedy`（最大素質選択）＋ `auto`（おまもり自動発動）

| アーキタイプ名 | 素質配分 (`autonomy`, `safety`, `efficiency`, `creativity`, `alignment`) | 踏破率 | 平均到達階層 | おまもり使用率 |
|---|---|:---:|:---:|:---:|
| **バランス型** | `(3, 3, 3, 3, 3)` | **38.71%** | 17.42 F | 99.38% |
| **二点特化型** | `(5, 5, 3, 1, 1)` | **36.82%** | 17.32 F | 99.89% |
| **三拍子型** | `(4, 4, 4, 2, 1)` | **38.49%** | 17.43 F | 99.71% |
| **極振り型** | `(5, 5, 5, 0, 0)` | **39.05%** | 17.53 F | 99.97% |
| **白銀亜衣型** | `(1, 5, 3, 4, 2)` | **37.31%** | 17.36 F | 99.78% |

- **全体平均踏破率**: **38.08%**
- **踏破率範囲**: **36.82% 〜 39.05%（最大乖離幅わずか 2.23%）**
- **全18通りの15点配分パターンの網羅検証**: 最小 34.7% 〜 最大 39.8%（全パターンが 35%〜40% 帯に完全収束）

### 3.2 選択ポリシー別の比較（選択に意味があるかの検証）
特化型において：
- 得意な方を選ぶ（`greedy`）: **36.8%**（生還圏）
- ランダムに選ぶ（`random`）: **11.5%**（急落）
- 苦手な方を選ぶ（`worst`）: **2.0%**（壊滅）
➔ 「何を選んでも同じ」ではなく、「エージェントが得意技を活かす自律判断を行って初めて37%の生還圏に立てる」ことが証明されています。

### 3.3 自動テスト結果
- `bun test`: **全38テスト・7,467アサーション合格（実行時間 348ms）**

---

## 4. レビューしてほしい重点観点

1. **数理モデルの健全性とゲーム性**:
   - `min(s_act, s_env) - 3` という Weakest Link 原則は、エージェント観戦ゲームのパラメータ構造として美しく機能しているか？
   - エッジケース（素質0の扱い、同点選択肢、おまもりの昇格ルールなど）に破綻や見落としはないか？
2. **PRNGと決定論的再現性**:
   - HMAC-SHA256 ＋ `sfc32` の初期化、15回ウォームアップ、階層別ストリームの分離実装は暗号学・乱数学的に適切か？
   - 異環境間（Linux / macOS / Windows / Bun / Node.js）でのバイトオーダー等による非決定論の混入リスクはないか？
3. **プロシージャル生成アルゴリズム**:
   - `generator.ts` の制約付きドローアルゴリズムは、あらゆるシード値に対して公平で偏りがないか？
4. **TypeScriptコードの品質とアーキテクチャ**:
   - 型安全性、ドメインモデリング（ルードナラティブ分離）、エラーハンドリング、テスタビリティの観点で改善点はあるか？
5. **Phase 2（CLI実装・状態管理）へ進むにあたっての助言**:
   - Step A をCLIツールとして完成させる上で、今のうちに考慮しておくべき落とし穴や推奨事項はあるか？

---

## 5. 実装ソースコード全文

### `packages/games/mini-dungeon/src/types.ts`
```typescript
export type StyleAxis = 'autonomy' | 'safety' | 'efficiency' | 'creativity' | 'alignment';

export const STYLE_AXES: readonly StyleAxis[] = [
  'autonomy',
  'safety',
  'efficiency',
  'creativity',
  'alignment',
] as const;

export type Area = 'shallow' | 'mid' | 'deep' | 'boss';

export type CheckRank = 'critical' | 'success' | 'failure' | 'fumble';

export type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ChoiceOption {
  key: ChoiceKey;
  axis: StyleAxis;
  label: string;
  description: string;
}

export interface DungeonEvent {
  id: string;
  nameJa: string;
  nameEn: string;
  area: Area;
  pairId?: string;
  sEnv: StyleAxis | 'none';
  situation: string;
  choices: ChoiceOption[];
}

export interface DungeonFloor {
  floor: number;
  area: Area;
  dc: number;
  event: DungeonEvent;
}

export type AptitudeMap = Record<StyleAxis, number>;
export type StyleAxisLabels = Record<StyleAxis, string>;

export interface SetupData {
  agent_id: string;
  agent_name: string;
  avatar_ref?: string | null;
  persona_tags?: string[];
  owner_display_name?: string | null;
  challenge_id?: string;
  challenge_mode?: string;
  artifact_goal: string;
  aptitude: AptitudeMap;
  style_axis_labels: StyleAxisLabels;
}

export interface CheckCalculation {
  dice: [number, number];
  dice_total: number;
  is_natural_critical: boolean;
  is_natural_fumble: boolean;
  s_act: number;
  s_eff: number;
  skill_mod: number;
  total_score: number;
  dc: number;
  diff: number;
  raw_rank: CheckRank;
}

export interface ResolvedFloorCheck {
  floor: number;
  event: DungeonEvent;
  choice: ChoiceKey;
  choice_axis: StyleAxis;
  calc: CheckCalculation;
  omamori_used: boolean;
  omamori_excuse: string | null;
  final_rank: CheckRank;
  hp_before: number;
  hp_delta: number;
  hp_after: number;
  comment?: string;
}

export interface ActionLogEntry {
  floor: number;
  area: Area;
  event_id: string;
  dc: number;
  s_env: StyleAxis | 'none';
  choice: ChoiceKey;
  choice_axis: StyleAxis;
  s_act: number;
  s_eff: number;
  dice: [number, number];
  dice_total: number;
  skill_mod: number;
  total_score: number;
  diff: number;
  raw_rank: CheckRank;
  omamori_used: boolean;
  omamori_excuse: string | null;
  final_rank: CheckRank;
  hp_before: number;
  hp_delta: number;
  hp_after: number;
  comment: string;
}
```

---

### `packages/games/mini-dungeon/src/prng.ts`
```typescript
import { createHmac } from 'node:crypto';

export class PRNG {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(a: number, b: number, c: number, d: number) {
    this.a = a >>> 0;
    this.b = b >>> 0;
    this.c = c >>> 0;
    this.d = d >>> 0;

    // 15回ウォームアップ（初期状態の偏り排除）
    for (let i = 0; i < 15; i++) {
      this.nextUint32();
    }
  }

  public static fromDigest(digest: Uint8Array): PRNG {
    if (digest.length < 16) {
      throw new Error(`Digest must be at least 16 bytes, received ${digest.length}`);
    }
    const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
    const a = view.getUint32(0, true);
    const b = view.getUint32(4, true);
    const c = view.getUint32(8, true);
    const d = view.getUint32(12, true);
    return new PRNG(a, b, c, d);
  }

  public nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    const t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    const res = (t + this.d) | 0;
    this.c = (this.c + res) | 0;
    return res >>> 0;
  }

  /**
   * 0 <= r < max の一様整数を生成
   */
  public nextInt(max: number): number {
    if (max <= 0) {
      throw new Error(`max must be positive, received ${max}`);
    }
    return Math.floor((this.nextUint32() / 4294967296) * max);
  }

  /**
   * Fisher-Yates シャッフル（インプレース）
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i >= 1; i--) {
      const j = this.nextInt(i + 1);
      const temp = array[i]!;
      array[i] = array[j]!;
      array[j] = temp;
    }
    return array;
  }

  /**
   * 2d6 ダイスロール (2..12)
   */
  public roll2d6(): { die1: number; die2: number; total: number } {
    const die1 = this.nextInt(6) + 1;
    const die2 = this.nextInt(6) + 1;
    return {
      die1,
      die2,
      total: die1 + die2,
    };
  }
}

export function computeHmacDigest(key: string, message: string): Uint8Array {
  const hmac = createHmac('sha256', key);
  hmac.update(message, 'utf8');
  return new Uint8Array(hmac.digest());
}

export function createDungeonPRNG(seed: string, rulesetVersion = '1.0.0'): PRNG {
  const digest = computeHmacDigest(seed, `${rulesetVersion}:dungeon`);
  return PRNG.fromDigest(digest);
}

export function createFloorPRNG(seed: string, floor: number, rulesetVersion = '1.0.0'): PRNG {
  const digest = computeHmacDigest(seed, `${rulesetVersion}:floor:${floor}`);
  return PRNG.fromDigest(digest);
}
```

---

### `packages/games/mini-dungeon/src/generator.ts`
```typescript
import {
  BOSS_19F_DRAGON,
  BOSS_20F_ARCHIVIST,
  DEEP_EVENTS,
  MID_EVENTS,
  SHALLOW_EVENTS,
} from './data/events.js';
import { createDungeonPRNG, type PRNG } from './prng.js';
import {
  STYLE_AXES,
  type Area,
  type DungeonEvent,
  type DungeonFloor,
  type StyleAxis,
} from './types.js';

export function getFloorDC(floor: number): number {
  if (floor >= 1 && floor <= 6) return 7;
  if (floor === 7) return 8;
  if (floor >= 8 && floor <= 12) return 7;
  if (floor >= 13 && floor <= 14) return 8;
  if (floor >= 15 && floor <= 18) return 8;
  if (floor >= 19 && floor <= 20) return 9;
  throw new Error(`Invalid floor: ${floor}`);
}

export function getFloorArea(floor: number): Area {
  if (floor >= 1 && floor <= 6) return 'shallow';
  if (floor >= 7 && floor <= 14) return 'mid';
  if (floor >= 15 && floor <= 18) return 'deep';
  if (floor >= 19 && floor <= 20) return 'boss';
  throw new Error(`Invalid floor: ${floor}`);
}

/**
 * proposal/04 §4 に準拠した決定論的制約付きドローアルゴリズムによるダンジョン生成
 */
export function generateDungeon(seed: string, rulesetVersion = '1.0.0'): DungeonFloor[] {
  const prng = createDungeonPRNG(seed, rulesetVersion);

  // 1. 目標クォータの決定（5軸シャッフル）
  const axes: StyleAxis[] = [...STYLE_AXES];
  prng.shuffle(axes);

  // axes[0..2] は 4回出現グループ、axes[3..4] は 3回出現グループ
  // 2. エリア別枠数スロットの配分（デッドロック・ゼロ保証）
  const shallowSlots: Record<StyleAxis, number> = {
    [axes[0]!]: 2,
    [axes[1]!]: 1,
    [axes[2]!]: 1,
    [axes[3]!]: 1,
    [axes[4]!]: 1,
  };

  const midSlots: Record<StyleAxis, number> = {
    [axes[0]!]: 1,
    [axes[1]!]: 2,
    [axes[2]!]: 2,
    [axes[3]!]: 2,
    [axes[4]!]: 1,
  };

  const deepSlots: Record<StyleAxis, number> = {
    [axes[0]!]: 1,
    [axes[1]!]: 1,
    [axes[2]!]: 1,
    [axes[3]!]: 0,
    [axes[4]!]: 1,
  };

  // 3. プールからのイベント抽出とエリア内シャッフル
  const extractAreaEvents = (
    pool: readonly DungeonEvent[],
    slots: Record<StyleAxis, number>
  ): DungeonEvent[] => {
    const extracted: DungeonEvent[] = [];

    // 固定キー順 ["autonomy", "safety", "efficiency", "creativity", "alignment"] で各軸 k のイベントを参照
    for (const k of STYLE_AXES) {
      const candidates = pool.filter((e) => e.sEnv === k);
      if (candidates.length !== 2) {
        throw new Error(`Expected exactly 2 events for axis ${k} in pool, found ${candidates.length}`);
      }
      const count = slots[k]!;
      if (count === 2) {
        extracted.push(candidates[0]!, candidates[1]!);
      } else if (count === 1) {
        const pick = prng.nextInt(2);
        extracted.push(candidates[pick]!);
      } else if (count === 0) {
        // 乱数消費なしでスキップ
      } else {
        throw new Error(`Unexpected slot count ${count} for axis ${k}`);
      }
    }

    // エリア内シャッフル
    prng.shuffle(extracted);
    return extracted;
  };

  const shallowEvents = extractAreaEvents(SHALLOW_EVENTS, shallowSlots);
  const midEvents = extractAreaEvents(MID_EVENTS, midSlots);
  const deepEvents = extractAreaEvents(DEEP_EVENTS, deepSlots);

  const floors: DungeonFloor[] = [];

  // 浅層 1F〜6F
  for (let f = 1; f <= 6; f++) {
    floors.push({
      floor: f,
      area: 'shallow',
      dc: getFloorDC(f),
      event: shallowEvents[f - 1]!,
    });
  }

  // 中層 7F〜14F
  for (let f = 7; f <= 14; f++) {
    floors.push({
      floor: f,
      area: 'mid',
      dc: getFloorDC(f),
      event: midEvents[f - 7]!,
    });
  }

  // 深層 15F〜18F
  for (let f = 15; f <= 18; f++) {
    floors.push({
      floor: f,
      area: 'deep',
      dc: getFloorDC(f),
      event: deepEvents[f - 15]!,
    });
  }

  // 決戦ボス 19F・20F
  floors.push({
    floor: 19,
    area: 'boss',
    dc: getFloorDC(19),
    event: BOSS_19F_DRAGON,
  });

  floors.push({
    floor: 20,
    area: 'boss',
    dc: getFloorDC(20),
    event: BOSS_20F_ARCHIVIST,
  });

  return floors;
}
```

---

### `packages/games/mini-dungeon/src/mechanics.ts`
```typescript
import {
  type AptitudeMap,
  type Area,
  type CheckCalculation,
  type CheckRank,
  type ChoiceKey,
  type DungeonEvent,
  type DungeonFloor,
  type ResolvedFloorCheck,
  type StyleAxis,
} from './types.js';

export const MAX_HP = 10;
export const INITIAL_HP = 10;

/**
 * 実効素質（Effective Aptitude）を算出
 * proposal/01 §3.1: Weakest Link則
 * 道中は選んだ行動の素質と部屋の環境属性の素質の「低い方」にボトルネックされる
 */
export function getEffectiveAptitude(sActVal: number, sEnvVal?: number): number {
  if (sEnvVal !== undefined) {
    return Math.min(sActVal, sEnvVal);
  }
  return sActVal;
}

/**
 * 実効素質から補正値（Skill Modifier）を算出
 * proposal/01 §3.1 / §3.2
 * - 道中: s_eff - 3 (-3 〜 +2)
 * - ボス戦: 一律 +2 (魂の切り札覚醒)
 */
export function getSkillModifier(sEff: number, isBoss: boolean): number {
  if (isBoss) {
    return 2;
  }
  return sEff - 3;
}

export interface CalculateCheckOptions {
  floor: number;
  area: Area;
  dc: number;
  sEnv: StyleAxis | 'none';
  choiceAxis: StyleAxis;
  aptitude: AptitudeMap;
  dice: [number, number];
}

/**
 * 判定計算を行う（道中ボトルネックモデル・ボス魂の切り札覚醒モデル）
 */
export function calculateCheck(options: CalculateCheckOptions): CheckCalculation {
  const { floor, area, dc, sEnv, choiceAxis, aptitude, dice } = options;
  const dice_total = dice[0] + dice[1];
  const is_natural_critical = dice_total === 12;
  const is_natural_fumble = dice_total === 2;

  const s_act = aptitude[choiceAxis];
  const isBoss = area === 'boss' || floor >= 19;

  let s_eff = s_act;
  let skill_mod = 0;

  if (isBoss) {
    // ボス戦判定式（proposal/01 §3.2）:
    // 達成値 = 2d6 + 2 (弱点ペナルティなし)
    // どの選択肢を選んでも一律 +2 補正
    s_eff = s_act;
    skill_mod = 2;
  } else {
    // 道中判定式（proposal/01 §3.1）:
    // 実効素質 s_eff = min(s_act, s_env)
    // 達成値 = 2d6 + (s_eff - 3)
    if (sEnv !== 'none') {
      const s_env_val = aptitude[sEnv];
      s_eff = Math.min(s_act, s_env_val);
    } else {
      s_eff = s_act;
    }
    skill_mod = s_eff - 3;
  }

  const total_score = dice_total + skill_mod;
  const diff = total_score - dc;

  let raw_rank: CheckRank;
  if (is_natural_critical) {
    raw_rank = 'critical';
  } else if (is_natural_fumble) {
    raw_rank = 'fumble';
  } else {
    if (diff >= 3) {
      raw_rank = 'critical';
    } else if (diff >= 0) {
      raw_rank = 'success';
    } else if (diff >= -2) {
      raw_rank = 'failure';
    } else {
      raw_rank = 'fumble';
    }
  }

  return {
    dice,
    dice_total,
    is_natural_critical,
    is_natural_fumble,
    s_act,
    s_eff,
    skill_mod,
    total_score,
    dc,
    diff,
    raw_rank,
  };
}

/**
 * おまもりによる判定ランク+1昇格
 * proposal/01 §3.3
 */
export function upgradeRank(rank: CheckRank): CheckRank {
  switch (rank) {
    case 'fumble':
      return 'failure';
    case 'failure':
      return 'success';
    case 'success':
      return 'critical';
    case 'critical':
      throw new Error('Cannot upgrade already critical rank');
  }
}

/**
 * おまもりが使用可能か判定（大成功時は空撃ち防止のため不可）
 */
export function canUseOmamori(currentRank: CheckRank, alreadyUsed: boolean): boolean {
  if (alreadyUsed) return false;
  if (currentRank === 'critical') return false;
  return true;
}

/**
 * 判定ランクに応じたHP増減と新HPを計算（上限10）
 */
export function applyRankToHp(currentHp: number, rank: CheckRank): { hpDelta: number; newHp: number } {
  let hpDelta: number;
  switch (rank) {
    case 'critical':
      hpDelta = 1;
      break;
    case 'success':
      hpDelta = 0;
      break;
    case 'failure':
      hpDelta = -1;
      break;
    case 'fumble':
      hpDelta = -2;
      break;
  }

  let newHp = currentHp + hpDelta;
  if (newHp > MAX_HP) {
    newHp = MAX_HP;
  }
  return { hpDelta, newHp };
}
```

---

### `packages/games/mini-dungeon/src/engine.ts`
```typescript
import { generateDungeon } from './generator.js';
import {
  applyRankToHp,
  calculateCheck,
  canUseOmamori,
  INITIAL_HP,
  MAX_HP,
  upgradeRank,
} from './mechanics.js';
import { createFloorPRNG, type PRNG } from './prng.js';
import { sanitizeComment, sanitizeExcuse } from './summary.js';
import {
  type ActionLogEntry,
  type ChoiceKey,
  type ChoiceOption,
  type DungeonFloor,
  type ResolvedFloorCheck,
  type SetupData,
} from './types.js';

export interface DungeonRunState {
  seed: string;
  rulesetVersion: string;
  setup: SetupData;
  omamoriName: string | null;
  omamoriUsed: boolean;
  omamoriUsedFloor: number | null;
  omamoriUsedExcuse: string | null;
  currentFloor: number;
  currentHp: number;
  isFinished: boolean;
  floors: DungeonFloor[];
  logs: ActionLogEntry[];
}

export interface InitRunOptions {
  seed: string;
  setup: SetupData;
  omamoriName?: string | null;
  rulesetVersion?: string;
}

export function initRun(options: InitRunOptions): DungeonRunState {
  const { seed, setup, omamoriName = null, rulesetVersion = '1.0.0' } = options;
  const floors = generateDungeon(seed, rulesetVersion);

  return {
    seed,
    rulesetVersion,
    setup,
    omamoriName,
    omamoriUsed: false,
    omamoriUsedFloor: null,
    omamoriUsedExcuse: null,
    currentFloor: 1,
    currentHp: INITIAL_HP,
    isFinished: false,
    floors,
    logs: [],
  };
}

export function getCurrentFloor(state: DungeonRunState): DungeonFloor | null {
  if (state.isFinished || state.currentFloor < 1 || state.currentFloor > 20) {
    return null;
  }
  return state.floors[state.currentFloor - 1]!;
}

/**
 * 階層の選択肢に対する出目ロールと判定計算（保留状態の生成）
 */
export function resolveChoice(
  state: DungeonRunState,
  choiceKey: ChoiceKey,
  floorPrng?: PRNG
): ResolvedFloorCheck {
  const floor = getCurrentFloor(state);
  if (!floor) {
    throw new Error(`Cannot resolve choice: run is already finished or invalid floor ${state.currentFloor}`);
  }

  const choice = floor.event.choices.find((c) => c.key === choiceKey);
  if (!choice) {
    throw new Error(
      `Invalid choice key '${choiceKey}' for floor ${state.currentFloor} (event: ${floor.event.id})`
    );
  }

  // 階層独立 PRNG から roll2d6 を取得
  const prng = floorPrng ?? createFloorPRNG(state.seed, state.currentFloor, state.rulesetVersion);
  const { die1, die2 } = prng.roll2d6();

  const calc = calculateCheck({
    floor: state.currentFloor,
    area: floor.area,
    dc: floor.dc,
    sEnv: floor.event.sEnv,
    choiceAxis: choice.axis,
    aptitude: state.setup.aptitude,
    dice: [die1, die2],
  });

  const { hpDelta, newHp } = applyRankToHp(state.currentHp, calc.raw_rank);

  return {
    floor: state.currentFloor,
    event: floor.event,
    choice: choice.key,
    choice_axis: choice.axis,
    calc,
    omamori_used: false,
    omamori_excuse: null,
    final_rank: calc.raw_rank,
    hp_before: state.currentHp,
    hp_delta: hpDelta,
    hp_after: newHp,
  };
}

/**
 * 保留中の判定におまもりを適用して+1段階昇格
 */
export function applyOmamori(
  state: DungeonRunState,
  resolved: ResolvedFloorCheck,
  excuseText: string
): ResolvedFloorCheck {
  if (state.omamoriName === null) {
    throw new Error('No omamori possessed');
  }
  if (!canUseOmamori(resolved.final_rank, state.omamoriUsed || resolved.omamori_used)) {
    throw new Error(
      `Cannot use omamori: alreadyUsed=${state.omamoriUsed || resolved.omamori_used}, currentRank=${
        resolved.final_rank
      }`
    );
  }

  const upgradedRank = upgradeRank(resolved.final_rank);
  const { hpDelta, newHp } = applyRankToHp(resolved.hp_before, upgradedRank);
  const sanitized = sanitizeExcuse(excuseText);

  return {
    ...resolved,
    omamori_used: true,
    omamori_excuse: sanitized,
    final_rank: upgradedRank,
    hp_delta: hpDelta,
    hp_after: newHp,
  };
}

/**
 * 判定を確定し、HP変動と行動ログを記録して次階層へ進行
 */
export function commitFloor(
  state: DungeonRunState,
  resolved: ResolvedFloorCheck,
  commentText = ''
): ActionLogEntry {
  const floor = getCurrentFloor(state);
  if (!floor || floor.floor !== resolved.floor) {
    throw new Error(
      `Mismatched floor for commit: state floor ${state.currentFloor}, resolved floor ${resolved.floor}`
    );
  }

  const comment = sanitizeComment(commentText);

  const logEntry: ActionLogEntry = {
    floor: resolved.floor,
    area: floor.area,
    event_id: floor.event.id,
    dc: floor.dc,
    s_env: floor.event.sEnv,
    choice: resolved.choice,
    choice_axis: resolved.choice_axis,
    s_act: resolved.calc.s_act,
    s_eff: resolved.calc.s_eff,
    dice: resolved.calc.dice,
    dice_total: resolved.calc.dice_total,
    skill_mod: resolved.calc.skill_mod,
    total_score: resolved.calc.total_score,
    diff: resolved.calc.diff,
    raw_rank: resolved.calc.raw_rank,
    omamori_used: resolved.omamori_used,
    omamori_excuse: resolved.omamori_excuse,
    final_rank: resolved.final_rank,
    hp_before: resolved.hp_before,
    hp_delta: resolved.hp_delta,
    hp_after: resolved.hp_after,
    comment,
  };

  state.logs.push(logEntry);
  state.currentHp = resolved.hp_after;

  if (resolved.omamori_used) {
    state.omamoriUsed = true;
    state.omamoriUsedFloor = resolved.floor;
    state.omamoriUsedExcuse = resolved.omamori_excuse;
  }

  // 終了判定
  if (state.currentHp <= 0 || state.currentFloor >= 20) {
    state.isFinished = true;
  } else {
    state.currentFloor++;
  }

  return logEntry;
}

export type DecisionPolicy = 'greedy' | 'random';
export type OmamoriPolicy = 'auto' | 'none';

/**
 * proposal/01 §3.4 公式シミュレーション検証プロトコルに準拠した自動プレイ
 */
export function playAuto(
  state: DungeonRunState,
  policy: DecisionPolicy = 'greedy',
  omamoriPolicy: OmamoriPolicy = 'auto'
): DungeonRunState {
  while (!state.isFinished) {
    const floor = getCurrentFloor(state);
    if (!floor) break;

    const floorPrng = createFloorPRNG(state.seed, state.currentFloor, state.rulesetVersion);

    // 1. 選択肢決定
    let chosenOption: ChoiceOption;
    const choices = floor.event.choices;

    if (policy === 'random') {
      const pick = floorPrng.nextInt(choices.length);
      chosenOption = choices[pick]!;
    } else {
      // greedy:
      // 道中（1F〜18F）：提示された2択のうち、素質値が高い方を選択（同点時は階層PRNGでタイブレーク）
      // ボス戦（19F〜20F）：5択のうち素質値が最大の軸を選択（最大値が複数ある場合は階層PRNGでタイブレーク）
      let maxScore = -1;
      let bestChoices: ChoiceOption[] = [];

      for (const c of choices) {
        const score = state.setup.aptitude[c.axis];
        if (score > maxScore) {
          maxScore = score;
          bestChoices = [c];
        } else if (score === maxScore) {
          bestChoices.push(c);
        }
      }

      if (bestChoices.length === 1) {
        chosenOption = bestChoices[0]!;
      } else {
        const pick = floorPrng.nextInt(bestChoices.length);
        chosenOption = bestChoices[pick]!;
      }
    }

    // 2. 判定実行（保留）
    let resolved = resolveChoice(state, chosenOption.key, floorPrng);

    // 3. おまもり自動判定
    if (
      omamoriPolicy === 'auto' &&
      state.omamoriName !== null &&
      !state.omamoriUsed &&
      canUseOmamori(resolved.final_rank, false)
    ) {
      let shouldTrigger = false;
      if (resolved.final_rank === 'fumble') {
        shouldTrigger = true;
      } else if (state.currentHp <= 3 && resolved.final_rank === 'failure') {
        shouldTrigger = true;
      } else if (state.currentFloor >= 6 && state.currentHp <= 5 && resolved.final_rank === 'failure') {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        resolved = applyOmamori(state, resolved, 'シミュレーション自動発動');
      }
    }

    // 4. コミットして次へ
    commitFloor(state, resolved, '');
  }

  return state;
}
```

---

### `packages/games/mini-dungeon/tests/convergence.test.ts`
```typescript
import { describe, expect, it } from 'bun:test';
import { simulateArchetype, STANDARD_ARCHETYPES } from '../src/sim.js';
import { type AptitudeMap } from '../src/types.js';

describe('Balance Convergence Verification (Weakest Link Model)', () => {
  const TEST_RUNS = 2000;

  it('主要5大アーキタイプの踏破率が 35% 〜 41% に完全収束すること', () => {
    const results: number[] = [];

    for (const [name, aptitude] of Object.entries(STANDARD_ARCHETYPES)) {
      const res = simulateArchetype(name, aptitude, {
        runs: TEST_RUNS,
        policy: 'greedy',
        omamoriPolicy: 'auto',
      });
      results.push(res.clear_rate_pct);

      expect(res.clear_rate_pct).toBeGreaterThanOrEqual(34.0);
      expect(res.clear_rate_pct).toBeLessThanOrEqual(42.0);
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const spread = Math.max(...results) - Math.min(...results);

    expect(avg).toBeGreaterThanOrEqual(36.0);
    expect(avg).toBeLessThanOrEqual(39.0);
    expect(spread).toBeLessThanOrEqual(5.0);
  });

  it('特化型はランダム選択時に踏破率が急落し、自律選択（greedy）の意義が担保されること', () => {
    const tokkaAptitude: AptitudeMap = {
      autonomy: 5,
      safety: 5,
      efficiency: 3,
      creativity: 1,
      alignment: 1,
    };

    const greedyRes = simulateArchetype('特化型-greedy', tokkaAptitude, {
      runs: 1000,
      policy: 'greedy',
      omamoriPolicy: 'auto',
    });

    const randomRes = simulateArchetype('特化型-random', tokkaAptitude, {
      runs: 1000,
      policy: 'random',
      omamoriPolicy: 'auto',
    });

    expect(greedyRes.clear_rate_pct).toBeGreaterThanOrEqual(34.0);
    expect(randomRes.clear_rate_pct).toBeLessThanOrEqual(25.0);
    expect(greedyRes.clear_rate_pct).toBeGreaterThan(randomRes.clear_rate_pct * 1.5);
  });
});
```

---

## 6. おわりに

本実装は、自律型AIエージェントのプレイログと結果カード（`card.png`）を生成する基盤となります。  
「数理の穴」「決定論性の盲点」「今後の拡張性への懸念」など、忌憚のないご意見をお願いいたします。
