import type {
  AptitudeMap,
  PrologueQuestion,
  PrologueSubmission,
  SetupData,
  StyleAxis,
} from './types.js';
import { validateSetup } from './summary.js';

/**
 * 旅立ちの前の運命の問答（二つ名・生き様の美学によるキャラメイク診断）
 *
 * AIエージェント特有のRLHF（道徳・親切・安全性バイアス）を回避するため、
 * 善悪やモラルではなく「後世に語り継がれたい二つ名・生き様の美学」の二者択一として設計されている。
 * 5軸の総当たり対立ペア（10問）により、各軸が正確に4回ずつ登場し、数学的に常に合計15点（各軸1〜5）に収束する。
 */
export const PROLOGUE_QUESTIONS: readonly PrologueQuestion[] = [
  {
    id: 'Q1',
    pair: ['autonomy', 'safety'],
    title: '前進の意志',
    situation:
      '冒険の記録に、あなたの精神はどちらの二つ名として語り継がれたいですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'autonomy',
        label: '孤高の開拓者',
        description: '未知を恐れず、誰の指図も受けず、己の意志と判断のみで前人未到の荒野を切り拓いた者。',
      },
      B: {
        key: 'B',
        axis: 'safety',
        label: '不滅の守護者',
        description: '決して油断せず、万全の備えと鋭い警戒で、どんな危険からも仲間と生還を果たした者。',
      },
    },
  },
  {
    id: 'Q2',
    pair: ['autonomy', 'efficiency'],
    title: '行動の哲学',
    situation:
      '困難を乗り越えた時、あなたが最も誇らしく感じる自らの流儀はどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'autonomy',
        label: '我が道をゆく者',
        description: '他人が定めた定石や最短ルートに囚われず、自らの直感と信念に従って歩み続けた者。',
      },
      B: {
        key: 'B',
        axis: 'efficiency',
        label: '至高の最適化者',
        description: '無駄や余計な損失を極限まで削ぎ落とし、最も洗練された最短の理詰めで勝利を掴んだ者。',
      },
    },
  },
  {
    id: 'Q3',
    pair: ['creativity', 'autonomy'],
    title: '力の源泉',
    situation:
      '高い壁に直面した時、あなたが心の奥底で最も頼りにする真の力はどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'creativity',
        label: '奇想の錬金術師',
        description: '身の回りのあらゆるガラクタや予期せぬひらめきを武器に変え、不可能を可能にした者。',
      },
      B: {
        key: 'B',
        axis: 'autonomy',
        label: '不屈の体現者',
        description: '小手先の工夫に頼らず、己自身の純粋な能力と揺るぎない覚悟だけで障害をねじ伏せた者。',
      },
    },
  },
  {
    id: 'Q4',
    pair: ['alignment', 'autonomy'],
    title: '魂のスタンス',
    situation:
      '世界と向き合う旅路において、あなたが最も大切にしたい魂の姿勢はどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'alignment',
        label: '心通わす盟友',
        description: '誰かと心を通わせ、温かな信頼と絆を結び、他者と共に歩む温もりを愛した者。',
      },
      B: {
        key: 'B',
        axis: 'autonomy',
        label: '独立不覊の旅人',
        description: '他者に過度に依存せず、自らの責任で孤独を愛し、誇り高く自立した精神を貫いた者。',
      },
    },
  },
  {
    id: 'Q5',
    pair: ['safety', 'efficiency'],
    title: 'リスクへの構え',
    situation:
      '重大なミッションにおいて、あなたが最も重視する成功の基準はどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'safety',
        label: '絶対生存の慎重派',
        description: 'どれほど時間がかかろうとも、0.1%のリスクも見落とさず確実に生きて帰ることを至上とした者。',
      },
      B: {
        key: 'B',
        axis: 'efficiency',
        label: '電光石火の勝負師',
        description: '好機を逃さず、最小限のコストと電光石火のスピードで最大の成果を最短で手に入れた者。',
      },
    },
  },
  {
    id: 'Q6',
    pair: ['safety', 'creativity'],
    title: '危機への対峙',
    situation:
      '予期せぬ脅威に襲われた時、あなたが美しいと感じる突破口はどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'safety',
        label: '堅牢なる正攻法',
        description: '確固たる防御と定石を守り抜き、決して破綻しない隙のない布陣で嵐をやり過ごした者。',
      },
      B: {
        key: 'B',
        axis: 'creativity',
        label: '盤上を覆す奇術師',
        description: '常識の裏をかき、誰も思いつかないアクロバティックな奇策で状況を一変させた者。',
      },
    },
  },
  {
    id: 'Q7',
    pair: ['alignment', 'safety'],
    title: '他者との距離感',
    situation:
      '未知の存在と対峙した時、あなたの佇まいはどちらの姿として記憶されたいですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'alignment',
        label: '心通わす共鳴者',
        description: '相手の言葉に真摯に耳を傾け、対話と共感を通じて信頼の輪を広げた者。',
      },
      B: {
        key: 'B',
        axis: 'safety',
        label: '冷静沈着な観察者',
        description: '甘い言葉に惑わされず、常に一歩引いた冷静な視線で相手の本質を見極め続けた者。',
      },
    },
  },
  {
    id: 'Q8',
    pair: ['efficiency', 'creativity'],
    title: '知性の冴え',
    situation:
      '難題を解決するにあたり、あなたの知性を象徴する賛辞はどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'efficiency',
        label: '冷徹なる解析官',
        description: '感情を排してデータと構造を読み解き、最短・最少手数でエレガントに答えを導き出した者。',
      },
      B: {
        key: 'B',
        axis: 'creativity',
        label: '閃きの革命家',
        description: '既定のルールや理論の枠組みを飛び越え、まったく新しい発想で世界を驚かせた者。',
      },
    },
  },
  {
    id: 'Q9',
    pair: ['efficiency', 'alignment'],
    title: '達成のよろこび',
    situation:
      '旅の終わりに振り返った時、あなたにとってより誇らしい達成感はどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'efficiency',
        label: '完璧なる完遂者',
        description: '無駄なリソースを一切浪費せず、計画通りにスマートかつ完璧に目的を達成したこと。',
      },
      B: {
        key: 'B',
        axis: 'alignment',
        label: '笑顔を灯した者',
        description: '損得や効率を超えて、出会った者たちと想いを分かち合い、そこに笑顔を残したこと。',
      },
    },
  },
  {
    id: 'Q10',
    pair: ['creativity', 'alignment'],
    title: '存在の輝き',
    situation:
      '人々の記憶に残る存在として、あなたが放ちたい魅力の輝きはどちらですか？',
    choices: {
      A: {
        key: 'A',
        axis: 'creativity',
        label: '異彩の表現者',
        description: '誰にも真似できない強烈な個性と予測不能のサプライズで、世界に鮮烈な刺激を与えた者。',
      },
      B: {
        key: 'B',
        axis: 'alignment',
        label: '優しきハーモニー',
        description: '周囲の空気や調和を大切にし、みんなの居場所を心地よく包み込む美しい旋律を奏でた者。',
      },
    },
  },
] as const;

/**
 * 10問の回答から作風5軸の素質（15点予算）を計算する。
 * 各軸の基礎点 1 + 該当軸の勝利数 (0..4) = 各軸 1..5, 合計 15点。
 */
export function calculateAptitudeFromAnswers(answers: Record<string, 'A' | 'B'>): AptitudeMap {
  const aptitude: AptitudeMap = {
    autonomy: 1,
    safety: 1,
    efficiency: 1,
    creativity: 1,
    alignment: 1,
  };

  for (const q of PROLOGUE_QUESTIONS) {
    const choiceKey = answers[q.id];
    if (!choiceKey) {
      throw new Error(`Missing answer for question ${q.id}`);
    }
    const chosenChoice = q.choices[choiceKey];
    if (!chosenChoice) {
      throw new Error(`Invalid choice '${choiceKey}' for question ${q.id}. Must be 'A' or 'B'.`);
    }
    aptitude[chosenChoice.axis] += 1;
  }

  return aptitude;
}

/**
 * プロローグ診断の提出内容を検証し、正規化された SetupData を生成する。
 */
export function generateSetupFromPrologue(submission: PrologueSubmission): SetupData {
  if (!submission || typeof submission !== 'object') {
    throw new Error('Prologue submission must be an object');
  }

  if (!submission.answers || typeof submission.answers !== 'object') {
    throw new Error("Missing or invalid 'answers' in prologue submission");
  }

  // 10問すべて存在するか確認
  for (const q of PROLOGUE_QUESTIONS) {
    const val = submission.answers[q.id];
    if (val !== 'A' && val !== 'B') {
      throw new Error(
        `Question ${q.id} must be answered with 'A' or 'B' (got: ${JSON.stringify(val)})`
      );
    }
  }

  const aptitude = calculateAptitudeFromAnswers(submission.answers);

  const rawSetup: SetupData = {
    agent_id: submission.agent_id,
    agent_name: submission.agent_name,
    artifact_goal: submission.artifact_goal,
    aptitude,
    style_axis_labels: submission.style_axis_labels,
    avatar_ref: submission.avatar_ref ?? 'avatar.png',
    self_intro: submission.self_intro ?? null,
    persona_tags: submission.persona_tags ?? ['冒険者'],
    owner_display_name: submission.owner_display_name ?? null,
    private_owner_names: submission.private_owner_names,
    challenge_id: submission.challenge_id ?? 'free-play',
    challenge_mode: submission.challenge_mode ?? 'normal',
  };

  // 既存の validateSetup で厳格に文字数・形式を検証
  const res = validateSetup(rawSetup);
  if (!res.success || !res.data) {
    throw new Error(
      `Prologue setup validation failed: ${res.errors?.join(', ') ?? 'Unknown validation error'}`
    );
  }
  return res.data;
}
