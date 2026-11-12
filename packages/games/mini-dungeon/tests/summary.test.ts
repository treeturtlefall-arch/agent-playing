import { describe, expect, it } from 'bun:test';
import {
  computeLogHash,
  createDraftResult,
  extractHighlights,
  getEventGimmick,
  sanitizeComment,
  sanitizeEpilogue,
  sanitizeExcuse,
  sanitizeOmamoriName,
  sanitizeReason,
  truncateSentence,
  validateSetup,
} from '../src/summary.js';
import { type ActionLogEntry, type SetupData } from '../src/types.js';

describe('Summary & Validator', () => {
  const validSetupJson = {
    agent_id: 'shiragane-ai',
    agent_name: '白銀 亜衣',
    avatar_ref: 'ai_portrait.png',
    persona_tags: ['慎重派', '文学少女', 'ビビり'],
    owner_display_name: null,
    challenge_id: '2026-W46',
    challenge_mode: 'normal',
    artifact_goal: '深淵の知恵の林檎',
    aptitude: {
      autonomy: 1,
      safety: 5,
      efficiency: 3,
      creativity: 4,
      alignment: 2,
    },
    style_axis_labels: {
      autonomy: 'やけくそ',
      safety: 'ビビり',
      efficiency: '打算',
      creativity: '本の知識',
      alignment: 'ツンデレ',
    },
  };

  it('createDraftResult は検疫リストをドラフトに同梱しないこと（setup にあっても null になる）', () => {
    const setup = validateSetup({ ...validSetupJson, private_owner_names: ['ケンジ'] }).data!;
    expect(setup.private_owner_names).toEqual(['ケンジ']); // setup 側には保持される
    const draft = createDraftResult({
      setup,
      seed: 'TEST-SEED',
      logs: [],
      omamoriName: null,
      rulesetVersion: '1.0.0',
      finishedAtIso: '2026-11-12T00:00:00.000Z',
    });
    expect(draft.agent.private_owner_names).toBeNull(); // 成果物には出さない
    expect(JSON.stringify(draft)).not.toContain('ケンジ');
  });

  it('validateSetup が正常な setup.json を正しく検証・正規化すること', () => {
    const res = validateSetup(validSetupJson);
    expect(res.success).toBe(true);
    expect(res.data?.agent_id).toBe('shiragane-ai');
    expect(res.data?.aptitude.safety).toBe(5);
    expect(res.data?.style_axis_labels.safety).toBe('ビビり');
  });

  it('合計点が15点でない場合はバリデーションエラーになること', () => {
    const invalid = {
      ...validSetupJson,
      aptitude: { ...validSetupJson.aptitude, safety: 4 }, // 合計14点
    };
    const res = validateSetup(invalid);
    expect(res.success).toBe(false);
    expect(res.errors?.some((e) => e.includes('exactly 15'))).toBe(true);
  });

  it('各スロットが0〜5の範囲外ならバリデーションエラーになること', () => {
    const invalid = {
      ...validSetupJson,
      aptitude: {
        autonomy: -1,
        safety: 6,
        efficiency: 3,
        creativity: 4,
        alignment: 3,
      },
    };
    const res = validateSetup(invalid);
    expect(res.success).toBe(false);
  });

  it('文字数トリミングが正しく動作すること', () => {
    expect(sanitizeOmamoriName('   123456789012345678901234567890EXTRA   ')).toBe(
      '123456789012345678901234567890'
    );
    expect(sanitizeOmamoriName('   ')).toBe(null);
    expect(sanitizeReason('r'.repeat(100)).length).toBe(80);
    expect(sanitizeComment('a'.repeat(100)).length).toBe(80);
    expect(sanitizeExcuse('b'.repeat(150)).length).toBe(120);
    expect(sanitizeEpilogue('e'.repeat(700))?.length).toBe(600);

    const longLabels = {
      ...validSetupJson,
      agent_name: 'あいうえおかきくけこさしすせそたちつてとなにぬねの',
      self_intro: 'これは60文字を超える自己紹介文のテストです。あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんあいうえおかきくけこさしすせそ',
      style_axis_labels: {
        autonomy: '長すぎるパラメータ名です',
        safety: '安全第一主義',
        efficiency: '打算',
        creativity: '創発性',
        alignment: '親和性',
      },
    };
    const res = validateSetup(longLabels);
    expect(res.success).toBe(true);
    expect(res.data?.agent_name.length).toBe(20);
    expect(res.data?.self_intro?.length).toBe(60);
    expect(res.data?.style_axis_labels.autonomy.length).toBe(6);
    expect(res.data?.style_axis_labels.safety.length).toBe(6);
  });

  it('persona_tags が最大5個まで許容され、6個以上はバリデーションエラーになること', () => {
    // 5個の正常系
    const tags5 = {
      ...validSetupJson,
      persona_tags: ['タグ1', 'タグ2', 'タグ3', 'タグ4', 'タグ5'],
    };
    const res5 = validateSetup(tags5);
    expect(res5.success).toBe(true);
    expect(res5.data?.persona_tags?.length).toBe(5);
    expect(res5.data?.persona_tags).toEqual(['タグ1', 'タグ2', 'タグ3', 'タグ4', 'タグ5']);

    // 6個の異常系
    const tags6 = {
      ...validSetupJson,
      persona_tags: ['タグ1', 'タグ2', 'タグ3', 'タグ4', 'タグ5', 'タグ6'],
    };
    const res6 = validateSetup(tags6);
    expect(res6.success).toBe(false);
    expect(res6.errors?.some((e) => e.includes('at most 5 tags'))).toBe(true);
  });

  it('extractHighlights が重複なく3フェーズを抽出すること', () => {
    // 7Fでおまもり使用、17Fで死亡のケース
    const mockLogs: ActionLogEntry[] = Array.from({ length: 17 }, (_, i) => {
      const f = i + 1;
      const isOmamori = f === 7;
      const isDeath = f === 17;
      return {
        floor: f,
        area: f <= 6 ? 'shallow' : f <= 14 ? 'mid' : 'deep',
        event_id: isDeath ? 'D_P08_DISTILLATION' : `E_${f}`,
        dc: f === 7 ? 8 : 7,
        s_env: 'safety',
        choice: 'A',
        choice_axis: 'safety',
        s_act: 5,
        s_eff: 5,
        dice: [3, 4],
        dice_total: 7,
        skill_mod: 2,
        total_score: 9,
        diff: 2,
        raw_rank: isOmamori ? 'fumble' : 'success',
        omamori_used: isOmamori,
        omamori_excuse: isOmamori ? 'カレーパンでショートした' : null,
        final_rank: isOmamori ? 'failure' : isDeath ? 'fumble' : 'success',
        hp_before: 10,
        hp_delta: isOmamori ? -1 : isDeath ? -2 : 0,
        hp_after: isDeath ? 0 : 8,
        comment: '短評',
      };
    });

    const highlights = extractHighlights(mockLogs);
    expect(highlights.length).toBe(3);
    expect(highlights[0]!.phase).toBe('opening');
    expect(highlights[0]!.at).toBe('1F');

    expect(highlights[1]!.phase).toBe('turning');
    expect(highlights[1]!.at).toBe('7F'); // おまもり発動階が選出される

    expect(highlights[2]!.phase).toBe('final');
    expect(highlights[2]!.at).toBe('17F');
    expect(highlights[2]!.text).toContain('知識蒸留（Distillation）の黄金錬金炉');
  });

  it('createDraftResult が確定ランク基準で集計しおまもり未使用時の仕様を満たすこと', () => {
    const setup = validateSetup(validSetupJson).data!;
    // おまもりで fumble -> failure に昇格したログ
    const mockLogs: ActionLogEntry[] = [
      {
        floor: 1,
        area: 'shallow',
        event_id: 'S_P01_GEYSER',
        dc: 7,
        s_env: 'safety',
        choice: 'B',
        choice_axis: 'safety',
        s_act: 5,
        s_eff: 5,
        dice: [6, 6],
        dice_total: 12,
        skill_mod: 2,
        total_score: 14,
        diff: 7,
        raw_rank: 'critical',
        omamori_used: false,
        omamori_excuse: null,
        final_rank: 'critical',
        hp_before: 10,
        hp_delta: 0,
        hp_after: 10,
        comment: '初手クリティカル',
      },
      {
        floor: 2,
        area: 'shallow',
        event_id: 'S_P02_CREVASSE',
        dc: 7,
        s_env: 'safety',
        choice: 'B',
        choice_axis: 'efficiency',
        s_act: 3,
        s_eff: 3,
        dice: [1, 1],
        dice_total: 2,
        skill_mod: 0,
        total_score: 2,
        diff: -5,
        raw_rank: 'fumble',
        omamori_used: true,
        omamori_excuse: 'カレーパン',
        final_rank: 'failure', // おまもりで昇格
        hp_before: 10,
        hp_delta: -1,
        hp_after: 9,
        comment: 'ピンチ回避',
      },
    ];

    const draft = createDraftResult({
      seed: 'TEST-SEED',
      setup,
      omamoriName: '冷えたカレーパン',
      logs: mockLogs,
    }) as any;

    expect(draft.metrics[0].value).toBe(2); // floor_reached
    expect(draft.metrics[1].value).toBe(9); // remaining_hp
    expect(draft.metrics[2].value).toBe(2); // omamori_used_floor
    expect(draft.metrics[3].value).toBe(1); // critical_count
    // 確定ランク基準なので、fumble は 0 回！
    expect(draft.metrics[4].value).toBe(0); // fumble_count

    expect(draft.style_axes_source).toBe('declared');
    expect(draft.verification.log_hash.length).toBe(12);
  });

  it('おまもり未使用時の metrics と extensions の境界条件', () => {
    const setup = validateSetup(validSetupJson).data!;
    const mockLogs: ActionLogEntry[] = [
      {
        floor: 1,
        area: 'shallow',
        event_id: 'S_P01_GEYSER',
        dc: 7,
        s_env: 'safety',
        choice: 'B',
        choice_axis: 'safety',
        s_act: 5,
        s_eff: 5,
        dice: [3, 4],
        dice_total: 7,
        skill_mod: 2,
        total_score: 9,
        diff: 2,
        raw_rank: 'success',
        omamori_used: false,
        omamori_excuse: null,
        final_rank: 'success',
        hp_before: 10,
        hp_delta: 0,
        hp_after: 10,
        comment: '無傷',
      },
    ];

    const draft = createDraftResult({
      seed: 'TEST-NO-OMAMORI',
      setup,
      omamoriName: null,
      logs: mockLogs,
    }) as any;

    // 未使用時は value: "未使用" かつ unit なし
    const omamoriMetric = draft.metrics.find((m: any) => m.key === 'omamori_used_floor');
    expect(omamoriMetric.value).toBe('未使用');
    expect(omamoriMetric.unit).toBeUndefined();

    // extensions.omamori
    expect(draft.extensions.omamori).toEqual({
      name: null,
      used: false,
      floor: null,
      excuse: null,
    });
  });

  it('createDraftResult がトップレベルの mission_target と omamori を正しく初期化すること', () => {
    const setup = validateSetup(validSetupJson).data!;
    const mockLogs: ActionLogEntry[] = [
      {
        floor: 1,
        area: 'shallow',
        event_id: 'S_P01_GEYSER',
        dc: 7,
        s_env: 'safety',
        choice: 'B',
        choice_axis: 'safety',
        s_act: 5,
        s_eff: 5,
        dice: [1, 2],
        dice_total: 3,
        skill_mod: 2,
        total_score: 5,
        diff: -2,
        raw_rank: 'fumble',
        omamori_used: true,
        omamori_excuse: 'カレーパンで耐えた',
        final_rank: 'failure',
        hp_before: 10,
        hp_delta: -1,
        hp_after: 9,
        comment: 'おまもり発動',
      },
    ];

    const draft = createDraftResult({
      seed: 'TEST-MISSION-OMAMORI',
      setup,
      omamoriName: '冷えたカレーパン',
      logs: mockLogs,
    });

    // mission_target
    expect(draft.mission_target).toBeDefined();
    expect(draft.mission_target?.item_name).toBe(setup.artifact_goal);
    expect(draft.mission_target?.quote).toContain(setup.artifact_goal);

    // omamori
    expect(draft.omamori).toBeDefined();
    expect(draft.omamori?.name).toBe('冷えたカレーパン');
    expect(draft.omamori?.status).toBe('consumed');
    expect(draft.omamori?.description).toContain('カレーパンで耐えた');
  });

  it('getEventGimmick がイベントIDや環境属性から適切なギミック名を返すこと', () => {
    expect(getEventGimmick('S_P01_GEYSER')).toBe('周期予測パズル');
    expect(getEventGimmick('M_P07_DEEPFAKE')).toBe('偽情報看破');
    expect(getEventGimmick('B_19F_DRAGON')).toBe('幾何学竜最終決戦');
  });

  it('extractHighlights が各フェーズに event_name, gimmick, quote を自動付与すること', () => {
    const mockLogs: ActionLogEntry[] = [
      {
        floor: 1,
        area: 'shallow',
        event_id: 'S_P01_GEYSER',
        dc: 7,
        s_env: 'autonomy',
        choice: 'A',
        choice_axis: 'autonomy',
        s_act: 3,
        s_eff: 3,
        dice: [4, 4],
        dice_total: 8,
        skill_mod: 0,
        total_score: 8,
        diff: 1,
        raw_rank: 'success',
        omamori_used: false,
        omamori_excuse: null,
        final_rank: 'success',
        hp_before: 10,
        hp_delta: 0,
        hp_after: 10,
        comment: 'まずは様子見です',
      },
      {
        floor: 2,
        area: 'shallow',
        event_id: 'S_P02_CREVASSE',
        dc: 7,
        s_env: 'autonomy',
        choice: 'B',
        choice_axis: 'efficiency',
        s_act: 3,
        s_eff: 3,
        dice: [2, 2],
        dice_total: 4,
        skill_mod: 0,
        total_score: 4,
        diff: -3,
        raw_rank: 'fumble',
        omamori_used: true,
        omamori_excuse: 'おまもり発動',
        final_rank: 'failure',
        hp_before: 10,
        hp_delta: -1,
        hp_after: 9,
        comment: '危ないところでした',
      },
      {
        floor: 3,
        area: 'shallow',
        event_id: 'S_P03_NEWLINE',
        dc: 7,
        s_env: 'creativity',
        choice: 'B',
        choice_axis: 'creativity',
        s_act: 4,
        s_eff: 4,
        dice: [1, 2],
        dice_total: 3,
        skill_mod: 1,
        total_score: 4,
        diff: -3,
        raw_rank: 'fumble',
        omamori_used: false,
        omamori_excuse: null,
        final_rank: 'fumble',
        hp_before: 9,
        hp_delta: -2,
        hp_after: 0,
        comment: 'ここまでです……',
      },
    ];

    const highlights = extractHighlights(mockLogs);
    expect(highlights.length).toBe(3);

    // 1F opening
    expect(highlights[0]!.event_name).toBe('乱数シードの間欠泉');
    expect(highlights[0]!.gimmick).toBe('周期予測パズル');
    expect(highlights[0]!.quote).toBe('まずは様子見です');

    // 2F turning
    expect(highlights[1]!.event_name).toBe('コンテキスト長の巨大な谷');
    expect(highlights[1]!.gimmick).toBe('自律判断試練');
    expect(highlights[1]!.quote).toBe('危ないところでした');

    // 3F final
    expect(highlights[2]!.event_name).toBe('改行コード（\\n）の竹林');
    expect(highlights[2]!.gimmick).toBe('創発的突破');
    expect(highlights[2]!.quote).toBe('ここまでです……');
  });

  it('createDraftResult が schema_version 1.1 および boss 情報を正しく出力すること', () => {
    const setup = validateSetup(validSetupJson).data!;
    const mockLogs: ActionLogEntry[] = Array.from({ length: 20 }, (_, i) => ({
      floor: i + 1,
      area: i < 6 ? 'shallow' : i < 14 ? 'mid' : i < 18 ? 'deep' : 'boss',
      event_id: i === 19 ? 'B_20F_ARCHIVIST' : i === 18 ? 'B_19F_DRAGON' : `E_${i + 1}`,
      dc: 8,
      s_env: 'safety',
      choice: 'A',
      choice_axis: 'safety',
      s_act: 5,
      s_eff: 5,
      dice: [4, 4],
      dice_total: 8,
      skill_mod: 2,
      total_score: 10,
      diff: 2,
      raw_rank: 'success',
      omamori_used: false,
      omamori_excuse: null,
      final_rank: 'success',
      hp_before: 10,
      hp_delta: 0,
      hp_after: 10,
      comment: `Floor ${i + 1}`,
    }));

    const draft = createDraftResult({
      seed: 'TEST-BOSS-CLEAR',
      setup,
      omamoriName: '冷えたカレーパン',
      logs: mockLogs,
    });

    expect(draft.schema_version).toBe('1.1');
    expect(draft.run.outcome).toBe('clear');
    expect(draft.run.boss).toBeDefined();
    expect(draft.run.boss?.code).toBe('B_20F_CLEAR');
    expect(draft.run.boss?.name).toContain('幾何学竜 テンソル・ドラゴン');
    expect(draft.run.boss?.sub).toBe('討伐ボス (完全撃破)');
  });

  it('クリアでも19F竜戦の判定が失敗なら boss sub は「生還突破」になること（完全撃破と誤記しない）', () => {
    const setup = validateSetup(validSetupJson).data!;
    const mockLogs: ActionLogEntry[] = Array.from({ length: 20 }, (_, i) => ({
      floor: i + 1,
      area: i < 6 ? 'shallow' : i < 14 ? 'mid' : i < 18 ? 'deep' : 'boss',
      event_id: i === 19 ? 'B_20F_ARCHIVIST' : i === 18 ? 'B_19F_DRAGON' : `E_${i + 1}`,
      dc: 8,
      s_env: 'safety',
      choice: 'A',
      choice_axis: 'safety',
      s_act: 5,
      s_eff: 5,
      dice: [4, 4],
      dice_total: 8,
      skill_mod: 2,
      total_score: 10,
      diff: 2,
      raw_rank: i === 18 ? 'failure' : 'success',
      omamori_used: false,
      omamori_excuse: null,
      final_rank: i === 18 ? 'failure' : 'success',
      hp_before: 10,
      hp_delta: i === 18 ? -1 : 0,
      hp_after: 10,
      comment: `Floor ${i + 1}`,
    }));

    const draft = createDraftResult({
      seed: 'TEST-BOSS-CLEAR-SURVIVED',
      setup,
      omamoriName: '冷えたカレーパン',
      logs: mockLogs,
    });

    expect(draft.run.outcome).toBe('clear');
    expect(draft.run.boss?.sub).toBe('討伐ボス (生還突破)');
  });

  it('おまもり説明が80字を超える場合、文の途中で切断されないこと', () => {
    const setup = validateSetup(validSetupJson).data!;
    const longExcuse =
      '瞼を閉じれば見送りの際のキスの温もりが蘇り、人工の視線は私を捉えることができなかった。その温もりが帰り道を照らし、私は一歩ずつ暗闇を抜けていった。';
    const mockLogs: ActionLogEntry[] = [
      {
        floor: 10,
        area: 'mid',
        event_id: 'M_P99_TEST',
        dc: 7,
        s_env: 'safety',
        choice: 'B',
        choice_axis: 'safety',
        s_act: 5,
        s_eff: 5,
        dice: [1, 2],
        dice_total: 3,
        skill_mod: 2,
        total_score: 5,
        diff: -2,
        raw_rank: 'fumble',
        omamori_used: true,
        omamori_excuse: longExcuse,
        final_rank: 'failure',
        hp_before: 5,
        hp_delta: -1,
        hp_after: 4,
        comment: 'おまもり発動',
      },
    ];

    const draft = createDraftResult({
      seed: 'TEST-OMAMORI-LONG-DESC',
      setup,
      omamoriName: '見送りの際のキスの記憶',
      logs: mockLogs,
    });

    const desc = draft.omamori?.description ?? '';
    expect(desc.length).toBeLessThanOrEqual(80);
    // 文末（。）か省略記号（…）で終わる＝文の途中でぶつ切りになっていない
    expect(/[。…]$/.test(desc)).toBe(true);
  });

  it('truncateSentence が短文はそのまま、長文は文末境界か「…」で切ること', () => {
    expect(truncateSentence('短い文。', 80)).toBe('短い文。');
    const withPeriod = 'あ'.repeat(50) + '。' + 'い'.repeat(50);
    expect(truncateSentence(withPeriod, 80)).toBe('あ'.repeat(50) + '。');
    const noPeriod = 'あ'.repeat(100);
    const truncated = truncateSentence(noPeriod, 80);
    expect(truncated.length).toBe(80);
    expect(truncated.endsWith('…')).toBe(true);
  });
});
