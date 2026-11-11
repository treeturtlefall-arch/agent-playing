import { describe, expect, test } from 'bun:test';
import { generateRadarSvg } from '../src/radar.js';

describe('Radar SVG Generator', () => {
  test('インラインSVGが正しく生成され、ポリゴンと軸ラベルが含まれること', () => {
    const axes = {
      autonomy: 1,
      safety: 5,
      efficiency: 3,
      creativity: 4,
      alignment: 2,
    };
    const labels = {
      autonomy: 'やけくそ',
      safety: 'ビビり',
      efficiency: '打算',
      creativity: '本の知識',
      alignment: 'ツンデレ',
    };

    const svg = generateRadarSvg(axes, { labels });

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('polygon');
    expect(svg).toContain('ビビり');
    expect(svg).toContain('やけくそ');
    expect(svg).toContain('本の知識');
    expect(svg).toContain('5/5');
    expect(svg).toContain('1/5');
  });

  test('ラベル内の特殊文字（<, >, &, " 等）がXMLエスケープされること', () => {
    const axes = {
      autonomy: 1,
      safety: 2,
      efficiency: 3,
      creativity: 4,
      alignment: 5,
    };
    const labels = {
      autonomy: 'A < B',
      safety: 'A & B',
      efficiency: 'A > B',
      creativity: '"創発"',
      alignment: "O'Reilly",
    };

    const svg = generateRadarSvg(axes, { labels });
    expect(svg).toContain('A &lt; B');
    expect(svg).toContain('A &amp; B');
    expect(svg).toContain('A &gt; B');
    expect(svg).toContain('&quot;創発&quot;');
    expect(svg).toContain('O&apos;Reilly');
    expect(svg).not.toContain('A < B');
  });
});
