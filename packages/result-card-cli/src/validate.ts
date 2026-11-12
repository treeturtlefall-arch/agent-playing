import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { PrivacyCheckResult, ResultCardData, ValidateResult } from './types.js';
import { checkPrivacyLeaks } from './privacy.js';

let cachedValidateFn: ReturnType<InstanceType<typeof Ajv2020>['compile']> | null = null;

export function getSchemaPath(): string {
  // 1. カレントディレクトリ基準
  const candidates = [
    path.resolve('specs/result-card-v1.schema.json'),
    path.resolve('../../specs/result-card-v1.schema.json'),
    path.resolve('../../../specs/result-card-v1.schema.json'),
    path.join(import.meta.dir, '../../../specs/result-card-v1.schema.json'),
    path.join(import.meta.dir, '../../specs/result-card-v1.schema.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Schema file result-card-v1.schema.json not found in candidate paths');
}

export function getValidator(): ReturnType<InstanceType<typeof Ajv2020>['compile']> {
  if (cachedValidateFn) {
    return cachedValidateFn;
  }

  const schemaPath = getSchemaPath();
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaContent);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv);

  cachedValidateFn = ajv.compile(schema);
  return cachedValidateFn;
}

export function formatAjvError(err: {
  keyword?: string;
  instancePath?: string;
  params?: Record<string, unknown>;
  message?: string;
}): string {
  const pathStr = err.instancePath || '/';
  if (err.keyword === 'maxLength') {
    const limit = err.params?.limit;
    return `${pathStr}: 文字数が上限（${limit}文字）を超えています。要約して${limit}文字以内に収めてください。`;
  }
  if (err.keyword === 'minLength') {
    const limit = err.params?.limit;
    return `${pathStr}: 文字数が不足しています（最小${limit}文字必要です）。`;
  }
  if (err.keyword === 'required') {
    const missing = err.params?.missingProperty;
    return `${pathStr}: 必須項目 '${missing}' が欠落しています。`;
  }
  if (err.keyword === 'enum') {
    const allowed = Array.isArray(err.params?.allowedValues)
      ? (err.params?.allowedValues as unknown[]).join(', ')
      : '';
    return `${pathStr}: 値が不正です。許可されている値: [${allowed}]`;
  }
  if (err.keyword === 'maximum') {
    const limit = err.params?.limit;
    return `${pathStr}: 値が上限（${limit}）を超過しています。`;
  }
  if (err.keyword === 'minimum') {
    const limit = err.params?.limit;
    return `${pathStr}: 値が下限（${limit}）未満です。`;
  }
  return `${pathStr}: ${err.message ?? 'validation failed'}`;
}

export function validateResultCard(raw: unknown, extraPrivateNames?: string[] | null): ValidateResult {
  const validate = getValidator();
  const valid = validate(raw);

  const errors: string[] = [];
  if (!valid) {
    errors.push(...(validate.errors ?? []).map((err) => formatAjvError(err)));
  }

  let privacyResult: PrivacyCheckResult | undefined = undefined;
  if (typeof raw === 'object' && raw !== null) {
    try {
      privacyResult = checkPrivacyLeaks(raw as ResultCardData, extraPrivateNames);
      if (privacyResult.hasLeak) {
        for (const leak of privacyResult.leaks) {
          errors.push(
            `[プライバシー違反] ${leak.field}: 非公開オーナー名「${leak.keyword}」の混入を検出しました (${leak.snippet})`
          );
        }
        if (privacyResult.suggestion) {
          errors.push(`[改善提案] ${privacyResult.suggestion}`);
        }
      }
    } catch {
      // ignore
    }
  }

  const isAllValid = valid && (!privacyResult || !privacyResult.hasLeak);

  return {
    valid: isAllValid,
    ...(errors.length > 0 ? { errors } : {}),
    ...(privacyResult ? { privacy: privacyResult } : {}),
  };
}
