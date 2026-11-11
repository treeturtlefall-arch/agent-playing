import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { generateShareText } from '../src/share.js';
import type { ResultCardData } from '../src/types.js';

describe('Share Text Generator', () => {
  const sampleJsonPath = path.resolve('examples/sample_ai_w46/result.json');
  const validData = JSON.parse(fs.readFileSync(sampleJsonPath, 'utf8')) as ResultCardData;

  test('厳格に7行以内のプレーンテキストが生成されること', () => {
    const text = generateShareText(validData);
    const lines = text.split('\n');

    expect(lines.length).toBe(7);
    expect(lines[0]).toContain('白銀 亜衣');
    expect(lines[1]).toContain('17階');
    expect(lines[2]).toContain('ビビり[5]');
    expect(lines[3]).toContain('名場面:');
    expect(lines[4]).toContain('一言:');
    expect(lines[5]).toContain('W46-8842');
    expect(lines[6]).toContain('#AIAgentArcade');
  });
});
