import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { validateResultCard } from '../src/validate.js';

describe('Result Card Schema Validation', () => {
  const sampleJsonPath = path.resolve('examples/sample_ai_w46/result.json');
  const validData = JSON.parse(fs.readFileSync(sampleJsonPath, 'utf8'));

  test('公式サンプル result.json がスキーマ検証に合格すること', () => {
    const res = validateResultCard(validData);
    expect(res.valid).toBe(true);
    expect(res.errors).toBeUndefined();
  });

  test('必須プロパティ（quote等）が欠落している場合に検証失敗すること', () => {
    const invalid = { ...validData };
    delete (invalid as Record<string, unknown>).quote;

    const res = validateResultCard(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
    expect(res.errors!.some((e) => e.includes('quote'))).toBe(true);
  });

  test('作風5軸の値が0〜5の範囲外なら検証失敗すること', () => {
    const invalid = {
      ...validData,
      style_axes: {
        ...validData.style_axes,
        safety: 6, // 上限オーバー
      },
    };

    const res = validateResultCard(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
    expect(res.errors!.some((e) => e.includes('style_axes/safety'))).toBe(true);
  });

  test('不正な outcome（例: "win"）で検証失敗すること', () => {
    const invalid = {
      ...validData,
      run: {
        ...validData.run,
        outcome: 'win',
      },
    };

    const res = validateResultCard(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
  });

  test('quote が40文字を超過した場合に親切な要約指示メッセージが返ること', () => {
    const invalid = {
      ...validData,
      quote: {
        text: 'これはあらかじめ定められた上限文字数である40文字を大幅に超過して感情豊かに語りすぎてしまった場合のテスト文章です。',
      },
    };

    const res = validateResultCard(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
    expect(res.errors!.some((e) => e.includes('/quote/text') && e.includes('上限（40文字）') && e.includes('要約'))).toBe(true);
  });

  test('agent.self_intro が60文字を超過した場合に検証失敗すること', () => {
    const invalid = {
      ...validData,
      agent: {
        ...validData.agent,
        self_intro: 'これはあらかじめ定められた上限文字数である60文字を大幅に超過してしまい自己紹介をあまりにも長く語りすぎてしまった場合のテスト用文章です。',
      },
    };

    const res = validateResultCard(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
    expect(res.errors!.some((e) => e.includes('/agent/self_intro') && e.includes('上限（60文字）'))).toBe(true);
  });

  test('agent.self_intro が正常な文字列または null または未定義の場合に検証合格すること', () => {
    const withNull = {
      ...validData,
      agent: {
        ...validData.agent,
        self_intro: null,
      },
    };
    expect(validateResultCard(withNull).valid).toBe(true);

    const withoutProp = {
      ...validData,
      agent: {
        name: validData.agent.name,
        avatar_ref: validData.agent.avatar_ref,
        persona_tags: validData.agent.persona_tags,
      },
    };
    expect(validateResultCard(withoutProp).valid).toBe(true);
  });
});
