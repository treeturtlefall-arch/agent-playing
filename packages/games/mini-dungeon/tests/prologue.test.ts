import { describe, expect, test } from 'bun:test';
import {
  calculateAptitudeFromAnswers,
  generateSetupFromPrologue,
  PROLOGUE_QUESTIONS,
} from '../src/prologue.js';
import { STYLE_AXES, type StyleAxis } from '../src/types.js';

describe('Prologue Character Diagnostic System', () => {
  test('10問の質問が定義され、全10対立ペアが重複なく網羅されていること', () => {
    expect(PROLOGUE_QUESTIONS.length).toBe(10);

    const pairKeys = new Set<string>();
    for (const q of PROLOGUE_QUESTIONS) {
      const [a1, a2] = q.pair;
      const sortedPair = [a1, a2].sort().join(':');
      expect(pairKeys.has(sortedPair)).toBe(false);
      pairKeys.add(sortedPair);

      expect(q.choices.A.axis).toBe(q.pair[0]);
      expect(q.choices.B.axis).toBe(q.pair[1]);
      expect(q.title.length).toBeGreaterThan(0);
      expect(q.situation.length).toBeGreaterThan(20);
    }

    expect(pairKeys.size).toBe(10);
  });

  test('各作風軸が全10問の中に正確に4回ずつ出現すること（数学的均等保証）', () => {
    const axisCounts: Record<StyleAxis, number> = {
      autonomy: 0,
      safety: 0,
      efficiency: 0,
      creativity: 0,
      alignment: 0,
    };

    for (const q of PROLOGUE_QUESTIONS) {
      axisCounts[q.pair[0]] += 1;
      axisCounts[q.pair[1]] += 1;
    }

    for (const axis of STYLE_AXES) {
      expect(axisCounts[axis]).toBe(4);
    }
  });

  test('オイラー正則化により、全5軸が選択肢Aに2回・選択肢Bに2回登場し位置バイアスが完全にゼロであること', () => {
    const choiceACounts: Record<StyleAxis, number> = {
      autonomy: 0,
      safety: 0,
      efficiency: 0,
      creativity: 0,
      alignment: 0,
    };
    const choiceBCounts: Record<StyleAxis, number> = {
      autonomy: 0,
      safety: 0,
      efficiency: 0,
      creativity: 0,
      alignment: 0,
    };

    for (const q of PROLOGUE_QUESTIONS) {
      choiceACounts[q.choices.A.axis] += 1;
      choiceBCounts[q.choices.B.axis] += 1;
    }

    // 全5軸が A に2回、B に2回
    for (const axis of STYLE_AXES) {
      expect(choiceACounts[axis]).toBe(2);
      expect(choiceBCounts[axis]).toBe(2);
    }

    // 全問 A を選んだ場合、全軸が基礎点1 + 2勝 = 3点（完全均等 [3,3,3,3,3]）になること
    const allA: Record<string, 'A' | 'B'> = {};
    for (const q of PROLOGUE_QUESTIONS) allA[q.id] = 'A';
    const aptA = calculateAptitudeFromAnswers(allA);
    expect(aptA).toEqual({
      autonomy: 3,
      safety: 3,
      efficiency: 3,
      creativity: 3,
      alignment: 3,
    });

    // 全問 B を選んだ場合、全軸が基礎点1 + 2勝 = 3点（完全均等 [3,3,3,3,3]）になること
    const allB: Record<string, 'A' | 'B'> = {};
    for (const q of PROLOGUE_QUESTIONS) allB[q.id] = 'B';
    const aptB = calculateAptitudeFromAnswers(allB);
    expect(aptB).toEqual({
      autonomy: 3,
      safety: 3,
      efficiency: 3,
      creativity: 3,
      alignment: 3,
    });
  });

  test('全問A、全問B、その他どんな組み合わせでも常に合計15点かつ各1〜5に収まること', () => {
    // 2^10 = 1024 通りの全探索でも常に合計15点かつ1〜5に収まることを数学的に証明
    for (let mask = 0; mask < 1024; mask++) {
      const answers: Record<string, 'A' | 'B'> = {};
      for (let i = 0; i < 10; i++) {
        answers[PROLOGUE_QUESTIONS[i].id] = (mask & (1 << i)) ? 'B' : 'A';
      }
      const apt = calculateAptitudeFromAnswers(answers);
      const sum = Object.values(apt).reduce((acc, v) => acc + v, 0);
      expect(sum).toBe(15);
      for (const v of Object.values(apt)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });

  test('白銀亜衣（慎重・本の知識型）の回答で期待通りの素質配分が得られること', () => {
    // 白銀亜衣: safety=5 (4勝), creativity=4 (3勝), efficiency=3 (2勝), alignment=2 (1勝), autonomy=1 (0勝)
    // Q1(autonomy vs safety) -> B(safety) -> safety 1勝
    // Q2(autonomy vs efficiency) -> B(efficiency) -> efficiency 1勝
    // Q3(creativity vs autonomy) -> A(creativity) -> creativity 1勝
    // Q4(alignment vs autonomy) -> A(alignment) -> alignment 1勝 (autonomy全敗=1)
    // Q5(safety vs efficiency) -> A(safety) -> safety 2勝
    // Q6(safety vs creativity) -> A(safety) -> safety 3勝
    // Q7(alignment vs safety) -> B(safety) -> safety 4勝(全勝=5)
    // Q8(efficiency vs creativity) -> B(creativity) -> creativity 2勝
    // Q9(efficiency vs alignment) -> A(efficiency) -> efficiency 2勝(=3)
    // Q10(creativity vs alignment) -> A(creativity) -> creativity 3勝(=4)
    const aiAnswers: Record<string, 'A' | 'B'> = {
      Q1: 'B',
      Q2: 'B',
      Q3: 'A',
      Q4: 'A',
      Q5: 'A',
      Q6: 'A',
      Q7: 'B',
      Q8: 'B',
      Q9: 'A',
      Q10: 'A',
    };

    const apt = calculateAptitudeFromAnswers(aiAnswers);
    expect(apt).toEqual({
      autonomy: 1,
      safety: 5,
      efficiency: 3,
      creativity: 4,
      alignment: 2,
    });
  });

  test('generateSetupFromPrologue が合法な SetupData を生成すること', () => {
    const submission = {
      agent_id: 'ai-silver',
      agent_name: '白銀 亜衣',
      artifact_goal: '深淵の知恵の林檎',
      answers: {
        Q1: 'B' as const,
        Q2: 'B' as const,
        Q3: 'A' as const,
        Q4: 'A' as const,
        Q5: 'A' as const,
        Q6: 'A' as const,
        Q7: 'B' as const,
        Q8: 'B' as const,
        Q9: 'A' as const,
        Q10: 'A' as const,
      },
      style_axis_labels: {
        autonomy: 'やけくそ',
        safety: 'ビビり',
        efficiency: '打算',
        creativity: '本の知識',
        alignment: 'ツンデレ',
      },
      self_intro: '図書室の奥で本をめくるのが好きな司書見習いです。',
      persona_tags: ['慎重派', '図書室の主'],
      owner_display_name: 'ケンジ',
    };

    const setup = generateSetupFromPrologue(submission);
    expect(setup.agent_id).toBe('ai-silver');
    expect(setup.agent_name).toBe('白銀 亜衣');
    expect(setup.self_intro).toBe('図書室の奥で本をめくるのが好きな司書見習いです。');
    expect(setup.aptitude.safety).toBe(5);
    expect(setup.aptitude.autonomy).toBe(1);
    expect(setup.style_axis_labels.safety).toBe('ビビり');
  });

  test('回答が欠落している場合にエラーをスローすること', () => {
    const invalidSubmission: any = {
      agent_id: 'test',
      agent_name: 'Test',
      artifact_goal: 'Goal',
      answers: {
        Q1: 'A',
        // Q2 missing
      },
      style_axis_labels: {
        autonomy: '自律',
        safety: '安全',
        efficiency: '効率',
        creativity: '創発',
        alignment: '親和',
      },
    };

    expect(() => generateSetupFromPrologue(invalidSubmission)).toThrow(/Question Q2 must be answered/);
  });
});
