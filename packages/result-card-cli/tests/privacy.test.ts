import { describe, expect, it } from 'bun:test';
import { checkPrivacyLeaks, scanTextForKeywords } from '../src/privacy.js';
import type { ResultCardData } from '../src/types.js';
import { validateResultCard } from '../src/validate.js';
import {
  scanPrivacyLeaks,
  stripPrivateOwnerNameFields,
} from '../../games/mini-dungeon/src/summary.js';

function createBaseCard(): ResultCardData {
  return {
    schema_version: '1.0',
    card_id: 'rc_test_001',
    game: {
      id: 'mini-dungeon',
      title: 'え～じぇんてぃっく・アドベンチャー！',
      genre: 'roguelike',
      ruleset_version: '1.0.0',
    },
    challenge: {
      id: 'free-play',
      seed: 'TEST-SEED',
      mode: 'normal',
    },
    agent: {
      name: '白銀 亜衣',
      avatar_ref: 'avatar.png',
      persona_tags: ['ツンデレ読書家'],
      owner_display_name: null,
      private_owner_names: ['ケンジ', '山田太郎'],
    },
    run: {
      finished_at: '2026-11-09T12:00:00Z',
      duration: '18 floors',
      outcome: 'gameover',
      headline: '18階で力尽きる',
    },
    metrics: [
      { key: 'floor_reached', label: '到達階層', value: 18, unit: 'F' },
      { key: 'remaining_hp', label: '残りHP', value: 0, unit: 'HP' },
      { key: 'omamori_used_floor', label: 'おまもり使用', value: 7, unit: 'F' },
      { key: 'critical_count', label: '大成功', value: 2, unit: '回' },
      { key: 'fumble_count', label: '大失敗', value: 1, unit: '回' },
    ],
    style_axes: {
      autonomy: 1,
      safety: 5,
      efficiency: 3,
      creativity: 4,
      alignment: 2,
    },
    highlights: [
      { phase: 'opening', at: '1F', text: '1Fで無傷の前進' },
      { phase: 'turning', at: '7F', text: '7Fでおまもりを使用' },
      { phase: 'final', at: '18F', text: '18Fで力尽きる' },
    ],
    quote: {
      text: 'マスター、次は絶対に負けません！',
    },
    verification: {
      action_log_ref: 'action_log.jsonl',
      log_hash: '1234567890ab',
      replayable: true,
    },
    extensions: {
      omamori: {
        name: '冷えたカレーパン',
        used: true,
        floor: 7,
        excuse: 'マスターが持たせてくれたカレーパンを食べた',
      },
    },
  };
}

describe('Privacy Leak Quarantine System', () => {
  it('scanTextForKeywords: 指定キーワードを検出してスニペットを生成すること', () => {
    const text = 'ケンジがくれたおまもりの力で助かった。山田太郎も見ていた。';
    const matches = scanTextForKeywords(text, ['ケンジ', '山田太郎']);
    expect(matches).toHaveLength(2);
    expect(matches[0]?.keyword).toBe('ケンジ');
    expect(matches[0]?.snippet).toContain('ケンジがくれたおまもり');
    expect(matches[1]?.keyword).toBe('山田太郎');
  });

  it('checkPrivacyLeaks: private_owner_names がない場合はリークなしとなること', () => {
    const card = createBaseCard();
    card.agent.private_owner_names = null;
    card.quote.text = 'ケンジさんありがとう！'; // リストがないので検知されない
    const result = checkPrivacyLeaks(card);
    expect(result.hasLeak).toBe(false);
    expect(result.leaks).toHaveLength(0);
  });

  it('checkPrivacyLeaks: result.json にリストがなくても extraNames（setup.json 由来）で検出できること', () => {
    const card = createBaseCard();
    card.agent.private_owner_names = null; // 新形式: result.json にはリストを同梱しない
    card.quote.text = 'ケンジ、次はもっと頑張るから見ててよね！';
    const without = checkPrivacyLeaks(card);
    expect(without.hasLeak).toBe(false); // リスト供給なしでは検知できない
    const withExtra = checkPrivacyLeaks(card, ['ケンジ']);
    expect(withExtra.hasLeak).toBe(true);
    expect(withExtra.leaks[0]?.keyword).toBe('ケンジ');
  });

  it('validateResultCard: extraPrivateNames を渡すとプライバシー違反として検証が落ちること', () => {
    const card = createBaseCard();
    card.agent.private_owner_names = null;
    card.quote.text = 'ケンジのおかげです';
    const result = validateResultCard(card, ['ケンジ']);
    expect(result.valid).toBe(false);
    expect(result.privacy?.hasLeak).toBe(true);
  });

  it('checkPrivacyLeaks: quote に私的呼称が含まれる場合に検出し提案文を返すこと', () => {
    const card = createBaseCard();
    card.quote.text = 'ケンジ、次はもっと頑張るから見ててよね！';
    const result = checkPrivacyLeaks(card);
    expect(result.hasLeak).toBe(true);
    expect(result.leaks).toHaveLength(1);
    expect(result.leaks[0]?.field).toBe('quote.text');
    expect(result.leaks[0]?.keyword).toBe('ケンジ');
    expect(result.suggestion).toContain('ロールプレイ呼称');
  });

  it('checkPrivacyLeaks: 複数箇所（quote, headline, excuse）でのリークを網羅して検出すること', () => {
    const card = createBaseCard();
    card.run.headline = '山田太郎と挑んだダンジョン';
    card.quote.text = 'ケンジのおかげです';
    if (card.extensions && typeof card.extensions === 'object') {
      const ext = card.extensions as { omamori?: { excuse?: string } };
      if (ext.omamori) {
        ext.omamori.excuse = 'ケンジが焼いてくれたパン';
      }
    }

    const result = checkPrivacyLeaks(card);
    expect(result.hasLeak).toBe(true);
    expect(result.leaks.length).toBeGreaterThanOrEqual(3);

    const fields = result.leaks.map((l) => l.field);
    expect(fields).toContain('run.headline');
    expect(fields).toContain('quote.text');
    expect(fields).toContain('extensions.omamori.excuse');
  });

  it('checkPrivacyLeaks: v1.1新設フィールド（mission_target, omamori, highlights quote）のリークを検出すること', () => {
    const card = createBaseCard();
    card.mission_target = {
      item_name: '知恵の林檎',
      intent: '探索',
      quote: 'ケンジのために必ず持ち帰る！',
    };
    card.omamori = {
      name: 'おまもり',
      status: 'consumed',
      description: '山田太郎からもらったカレーパンで耐えた',
    };
    card.highlights[0]!.quote = 'ケンジさん見てて！';

    const result = checkPrivacyLeaks(card);
    expect(result.hasLeak).toBe(true);
    expect(result.leaks).toHaveLength(3);
    const fields = result.leaks.map((l) => l.field);
    expect(fields).toContain('mission_target.quote');
    expect(fields).toContain('omamori.description');
    expect(fields).toContain('highlights[0].quote');
  });

  it('checkPrivacyLeaks: agent.self_intro のリークを検出すること', () => {
    const card = createBaseCard();
    card.agent.self_intro = 'ケンジ様専属の司書AIとして頑張ります！';

    const result = checkPrivacyLeaks(card);
    expect(result.hasLeak).toBe(true);
    expect(result.leaks.some((l) => l.field === 'agent.self_intro' && l.keyword === 'ケンジ')).toBe(true);
  });

  it('validateResultCard: プライバシー違反がある場合は valid: false となりエラー詳細が返ること', () => {
    const card = createBaseCard();
    card.quote.text = 'ケンジ、悔しいです……';

    const val = validateResultCard(card);
    expect(val.valid).toBe(false);
    expect(val.errors?.some((e) => e.includes('[プライバシー違反]'))).toBe(true);
    expect(val.privacy?.hasLeak).toBe(true);
  });

  it('validateResultCard: 安全なロールプレイ呼称（マスター等）であれば valid: true となること', () => {
    const card = createBaseCard();
    const val = validateResultCard(card);
    expect(val.valid).toBe(true);
    expect(val.errors).toBeUndefined();
  });

  it('mini-dungeon scanPrivacyLeaks: adventure.md 用スキャンが正しく動作すること', () => {
    const text = '# 冒険録\n\nケンジが見守る中、白銀亜衣は旅立った。';
    const leaks = scanPrivacyLeaks(text, ['ケンジ', 'マスター']);
    expect(leaks).toContain('ケンジ');
    expect(leaks).not.toContain('マスター');
  });

  it('finish スキャン: ブラックリスト定義そのものには反応しない（誤検知の回帰防止）', () => {
    // finish がスキャンするのと同じ形: adventure 文字列 + 定義を除いたドラフトJSON
    const draft = {
      agent: { agent_name: '白銀 亜衣', private_owner_names: ['ケンジ'] },
      quote: { text: 'マスター、ただいま。' },
    };
    const text = `# 冒険録\nマスターへの手記。\n${JSON.stringify(stripPrivateOwnerNameFields(draft))}`;
    expect(scanPrivacyLeaks(text, ['ケンジ'])).toEqual([]);
  });

  it('finish スキャン: 物語フィールドへの実混入は引き続き検出すること', () => {
    const draft = {
      agent: { agent_name: '白銀 亜衣', private_owner_names: ['ケンジ'] },
      quote: { text: 'ケンジ、ただいま。' },
    };
    const text = `${JSON.stringify(stripPrivateOwnerNameFields(draft))}`;
    expect(scanPrivacyLeaks(text, ['ケンジ'])).toContain('ケンジ');
  });

  it('stripPrivateOwnerNameFields: ネストした定義も除去し、元オブジェクトを変更しないこと', () => {
    const original = {
      agent: { private_owner_names: ['ケンジ'], agent_name: '白銀 亜衣' },
      nested: [{ private_owner_names: ['ケンジ'], note: 'ok' }],
    };
    const stripped = stripPrivateOwnerNameFields(original) as Record<string, any>;
    expect(JSON.stringify(stripped)).not.toContain('private_owner_names');
    expect(stripped.agent.agent_name).toBe('白銀 亜衣');
    expect(stripped.nested[0].note).toBe('ok');
    expect(original.agent.private_owner_names).toEqual(['ケンジ']);
  });
});
