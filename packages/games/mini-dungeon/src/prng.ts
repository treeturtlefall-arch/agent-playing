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
