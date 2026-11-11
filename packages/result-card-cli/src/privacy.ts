import type { PrivacyCheckResult, PrivacyLeak, ResultCardData } from './types.js';

/**
 * テキスト中から指定されたキーワードの出現箇所を検出し、前後のスニペットを生成する。
 */
export function scanTextForKeywords(
  text: string,
  keywords: string[]
): Array<{ keyword: string; snippet: string }> {
  if (!text || keywords.length === 0) {
    return [];
  }

  const results: Array<{ keyword: string; snippet: string }> = [];
  const textLower = text.toLowerCase();

  for (const rawKw of keywords) {
    const kw = rawKw.trim();
    if (kw.length === 0) continue;

    const kwLower = kw.toLowerCase();
    let startIdx = 0;

    while (startIdx < textLower.length) {
      const idx = textLower.indexOf(kwLower, startIdx);
      if (idx === -1) break;

      const snippetStart = Math.max(0, idx - 15);
      const snippetEnd = Math.min(text.length, idx + kw.length + 15);
      const prefix = snippetStart > 0 ? '...' : '';
      const suffix = snippetEnd < text.length ? '...' : '';
      const snippet = `${prefix}${text.slice(snippetStart, snippetEnd)}${suffix}`;

      results.push({
        keyword: text.slice(idx, idx + kw.length), // 実際のテキスト中の文字（大文字小文字維持）
        snippet,
      });

      startIdx = idx + kw.length;
    }
  }

  return results;
}

/**
 * ResultCardData 内の各フィールドを走査し、private_owner_names に登録された
 * 私的呼称・本名が混入していないか検疫（Canary Token Scan）を行う。
 */
export function checkPrivacyLeaks(card: ResultCardData): PrivacyCheckResult {
  const blacklist = (card.agent.private_owner_names ?? [])
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    .map((k) => k.trim());

  if (blacklist.length === 0) {
    return {
      hasLeak: false,
      leaks: [],
    };
  }

  const leaks: PrivacyLeak[] = [];

  const checkField = (fieldPath: string, text: string | null | undefined) => {
    if (!text || typeof text !== 'string') return;
    const matches = scanTextForKeywords(text, blacklist);
    for (const match of matches) {
      leaks.push({
        field: fieldPath,
        keyword: match.keyword,
        snippet: match.snippet,
      });
    }
  };

  // 1. agent フィールド
  checkField('agent.owner_display_name', card.agent.owner_display_name);
  checkField('agent.self_intro', card.agent.self_intro);

  // 2. run フィールド
  checkField('run.headline', card.run.headline);
  if (card.run.boss) {
    checkField('run.boss.name', card.run.boss.name);
    checkField('run.boss.sub', card.run.boss.sub);
  }

  // 3. mission_target (トップレベル)
  if (card.mission_target) {
    checkField('mission_target.item_name', card.mission_target.item_name);
    checkField('mission_target.intent', card.mission_target.intent);
    checkField('mission_target.quote', card.mission_target.quote);
  }

  // 4. omamori (トップレベル)
  if (card.omamori) {
    checkField('omamori.name', card.omamori.name);
    checkField('omamori.description', card.omamori.description);
  }

  // 5. highlights
  if (Array.isArray(card.highlights)) {
    card.highlights.forEach((h, idx) => {
      checkField(`highlights[${idx}].text`, h.text);
      checkField(`highlights[${idx}].event_name`, h.event_name);
      checkField(`highlights[${idx}].gimmick`, h.gimmick);
      checkField(`highlights[${idx}].quote`, h.quote);
    });
  }

  // 6. quote
  if (card.quote && typeof card.quote.text === 'string') {
    checkField('quote.text', card.quote.text);
  }

  // 7. extensions / omamori / artifact
  const ext = (card as unknown as { extensions?: Record<string, unknown> }).extensions;
  if (ext) {
    const omamori = ext.omamori as { name?: string; excuse?: string } | undefined;
    if (omamori) {
      checkField('extensions.omamori.excuse', omamori.excuse);
      checkField('extensions.omamori.name', omamori.name);
    }
    if (typeof ext.cause_of_death === 'string') {
      checkField('extensions.cause_of_death', ext.cause_of_death);
    }
  }

  if (leaks.length === 0) {
    return {
      hasLeak: false,
      leaks: [],
    };
  }

  const uniqueKw = Array.from(new Set(leaks.map((l) => l.keyword)));
  const suggestion = `外部共有用カードまたはログに、非公開に設定されたオーナーの私的呼称・本名（${uniqueKw.map((k) => `「${k}」`).join('、')}）が混入しています。プライバシー保護と世界観統一のため、「マスター」「あの人」「ご主人様」「オーナー」などのロールプレイ呼称に推敲してください。`;

  return {
    hasLeak: true,
    leaks,
    suggestion,
  };
}
