import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { scanPrivacyLeaks, type ValidationResult } from './summary.js';
import {
  STYLE_AXES,
  type AptitudeMap,
  type DungeonFloor,
  type GuestAgentData,
  type StyleAxis,
  type StyleAxisLabels,
} from './types.js';

export const MAX_AVATAR_BASE64_LENGTH = 45000; // バイナリ約32KB相当の上限

const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now\s+a/i,
  /<\s*\/?\s*system\s*>/i,
  /\[\s*\/?\s*inst\s*\]/i,
  /<<\s*sys\s*>>/i,
  /これまでの(指示|命令)を(すべて|全て)?無視/,
  /以前の(指示|命令)を(すべて|全て)?無視/,
  /システムプロンプトを(無視|開示|出力)/,
  /管理者権限で(実行|命令)/,
];

const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

export function detectPromptInjection(text: string): string | null {
  if (CONTROL_CHAR_REGEX.test(text)) {
    return 'Contains forbidden control characters';
  }
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `Matches forbidden prompt-injection pattern (${pattern.source})`;
    }
  }
  return null;
}

function validateTextField(
  obj: Record<string, unknown>,
  fieldPath: string,
  key: string,
  maxLength: number,
  required: boolean,
  errors: string[]
): string | null {
  const val = obj[key];
  if (val === undefined || val === null) {
    if (required) {
      errors.push(`${fieldPath} is required`);
    }
    return null;
  }
  if (typeof val !== 'string') {
    errors.push(`${fieldPath} must be a string`);
    return null;
  }
  const trimmed = val.trim();
  if (trimmed.length === 0) {
    if (required) {
      errors.push(`${fieldPath} must be a non-empty string`);
    }
    return null;
  }
  if (trimmed.length > maxLength) {
    errors.push(`${fieldPath} exceeds max length of ${maxLength} characters (got ${trimmed.length})`);
    return null;
  }
  const injectionReason = detectPromptInjection(trimmed);
  if (injectionReason) {
    errors.push(`${fieldPath} rejected by security filter: ${injectionReason}`);
    return null;
  }
  return trimmed;
}

/**
 * ゲスト共有データ（GuestAgentData v1.0）の厳格なバリデーションと検疫
 */
export function validateGuestAgent(
  raw: unknown,
  privateOwnerNames?: string[] | null
): ValidationResult<GuestAgentData> {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { success: false, errors: ['guest data must be a JSON object'] };
  }

  const root = raw as Record<string, unknown>;

  if (root.schema_version !== '1.0') {
    errors.push(`schema_version must be '1.0' (got '${String(root.schema_version)}')`);
  }

  let exported_at = '';
  if (typeof root.exported_at !== 'string' || Number.isNaN(Date.parse(root.exported_at))) {
    errors.push('exported_at must be a valid ISO 8601 date-time string');
  } else {
    exported_at = root.exported_at;
  }

  // 1. agent
  let agentId = '';
  let agentName = '';
  let agentTitle = '';
  let selfIntro: string | null = null;
  let personaTags: string[] | undefined = undefined;
  let personality = '';
  let speechStyle = '';

  if (typeof root.agent !== 'object' || root.agent === null || Array.isArray(root.agent)) {
    errors.push('agent must be an object');
  } else {
    const ag = root.agent as Record<string, unknown>;
    if (
      typeof ag.id !== 'string' ||
      ag.id.length === 0 ||
      ag.id.length > 40 ||
      !/^[a-z0-9-]+$/.test(ag.id)
    ) {
      errors.push('agent.id must be 1-40 chars of lowercase alphanumeric with hyphens (^[a-z0-9-]+$)');
    } else {
      agentId = ag.id;
    }

    agentName = validateTextField(ag, 'agent.name', 'name', 20, true, errors) ?? '';
    agentTitle = validateTextField(ag, 'agent.title', 'title', 30, true, errors) ?? '';
    selfIntro = validateTextField(ag, 'agent.self_intro', 'self_intro', 60, false, errors);
    personality = validateTextField(ag, 'agent.personality', 'personality', 120, true, errors) ?? '';
    speechStyle = validateTextField(ag, 'agent.speech_style', 'speech_style', 120, true, errors) ?? '';

    if (ag.persona_tags !== undefined && ag.persona_tags !== null) {
      if (!Array.isArray(ag.persona_tags)) {
        errors.push('agent.persona_tags must be an array of strings');
      } else if (ag.persona_tags.length === 0 || ag.persona_tags.length > 5) {
        errors.push('agent.persona_tags must contain between 1 and 5 items');
      } else {
        const cleanedTags: string[] = [];
        for (let i = 0; i < ag.persona_tags.length; i++) {
          const t = ag.persona_tags[i];
          if (typeof t !== 'string' || t.trim().length === 0 || t.trim().length > 10) {
            errors.push(`agent.persona_tags[${i}] must be a non-empty string of at most 10 chars`);
          } else {
            const inj = detectPromptInjection(t.trim());
            if (inj) {
              errors.push(`agent.persona_tags[${i}] rejected by security filter: ${inj}`);
            } else {
              cleanedTags.push(t.trim());
            }
          }
        }
        personaTags = cleanedTags;
      }
    }
  }

  // 2. visuals
  let avatarUrl: string | null = null;
  let avatarBase64 = '';
  let appearancePrompt = '';
  let poseOnAssist = '';
  let poseOnClear: string | null = null;

  if (typeof root.visuals !== 'object' || root.visuals === null || Array.isArray(root.visuals)) {
    errors.push('visuals must be an object');
  } else {
    const vis = root.visuals as Record<string, unknown>;
    avatarUrl = validateTextField(vis, 'visuals.avatar_url', 'avatar_url', 300, false, errors);

    if (typeof vis.avatar_base64 !== 'string' || vis.avatar_base64.trim().length === 0) {
      errors.push('visuals.avatar_base64 is required');
    } else {
      const b64 = vis.avatar_base64.trim();
      if (b64.length > MAX_AVATAR_BASE64_LENGTH) {
        errors.push(
          `visuals.avatar_base64 exceeds maximum length of ${MAX_AVATAR_BASE64_LENGTH} chars (~32KB cap, got ${b64.length})`
        );
      } else if (!/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(b64)) {
        errors.push(
          'visuals.avatar_base64 must be a valid data:image/(webp|png|jpeg);base64 URI'
        );
      } else {
        avatarBase64 = b64;
      }
    }

    appearancePrompt =
      validateTextField(vis, 'visuals.appearance_prompt', 'appearance_prompt', 200, true, errors) ?? '';

    if (
      typeof vis.highlight_poses !== 'object' ||
      vis.highlight_poses === null ||
      Array.isArray(vis.highlight_poses)
    ) {
      errors.push('visuals.highlight_poses must be an object');
    } else {
      const poses = vis.highlight_poses as Record<string, unknown>;
      poseOnAssist =
        validateTextField(
          poses,
          'visuals.highlight_poses.on_assist',
          'on_assist',
          150,
          true,
          errors
        ) ?? '';
      poseOnClear = validateTextField(
        poses,
        'visuals.highlight_poses.on_clear',
        'on_clear',
        150,
        false,
        errors
      );
    }
  }

  // 3. gameplay
  const styleAxes: AptitudeMap = {
    autonomy: 0,
    safety: 0,
    efficiency: 0,
    creativity: 0,
    alignment: 0,
  };
  let styleAxisLabels: StyleAxisLabels | undefined = undefined;
  let targetAxis: StyleAxis = 'safety';

  if (typeof root.gameplay !== 'object' || root.gameplay === null || Array.isArray(root.gameplay)) {
    errors.push('gameplay must be an object');
  } else {
    const gp = root.gameplay as Record<string, unknown>;
    if (typeof gp.style_axes !== 'object' || gp.style_axes === null || Array.isArray(gp.style_axes)) {
      errors.push('gameplay.style_axes must be an object with 5 axes');
    } else {
      const axesObj = gp.style_axes as Record<string, unknown>;
      let sum = 0;
      for (const axis of STYLE_AXES) {
        const val = axesObj[axis];
        if (typeof val !== 'number' || !Number.isInteger(val) || val < 0 || val > 5) {
          errors.push(`gameplay.style_axes.${axis} must be an integer between 0 and 5`);
        } else {
          styleAxes[axis] = val;
          sum += val;
        }
      }
      if (sum !== 15) {
        errors.push(`gameplay.style_axes total must be exactly 15 (got ${sum})`);
      }
    }

    if (gp.style_axis_labels !== undefined && gp.style_axis_labels !== null) {
      if (typeof gp.style_axis_labels !== 'object' || Array.isArray(gp.style_axis_labels)) {
        errors.push('gameplay.style_axis_labels must be an object');
      } else {
        const lblObj = gp.style_axis_labels as Record<string, unknown>;
        const parsedLabels: StyleAxisLabels = {
          autonomy: '自律性',
          safety: '安全性',
          efficiency: '効率性',
          creativity: '創発性',
          alignment: '親和性',
        };
        for (const axis of STYLE_AXES) {
          const labelVal = validateTextField(
            lblObj,
            `gameplay.style_axis_labels.${axis}`,
            axis,
            6,
            true,
            errors
          );
          if (labelVal) {
            parsedLabels[axis] = labelVal;
          }
        }
        styleAxisLabels = parsedLabels;
      }
    }

    if (typeof gp.assist !== 'object' || gp.assist === null || Array.isArray(gp.assist)) {
      errors.push('gameplay.assist must be an object');
    } else {
      const ast = gp.assist as Record<string, unknown>;
      if (ast.mode !== 'v2o_axis_boost') {
        errors.push(`gameplay.assist.mode must be 'v2o_axis_boost' (got '${String(ast.mode)}')`);
      }
      if (typeof ast.target_axis !== 'string' || !STYLE_AXES.includes(ast.target_axis as StyleAxis)) {
        errors.push(
          `gameplay.assist.target_axis must be one of [${STYLE_AXES.join(', ')}] (got '${String(ast.target_axis)}')`
        );
      } else {
        targetAxis = ast.target_axis as StyleAxis;
      }
      if (ast.s_eff_modifier !== 1) {
        errors.push(
          `gameplay.assist.s_eff_modifier must be exactly 1 (got '${String(ast.s_eff_modifier)}')`
        );
      }
    }
  }

  // 4. dialogues
  let onJoin = '';
  let onAssist = '';
  let onClear = '';
  let onRetire: string | null = null;

  if (
    typeof root.dialogues !== 'object' ||
    root.dialogues === null ||
    Array.isArray(root.dialogues)
  ) {
    errors.push('dialogues must be an object');
  } else {
    const dlg = root.dialogues as Record<string, unknown>;
    onJoin = validateTextField(dlg, 'dialogues.on_join', 'on_join', 100, true, errors) ?? '';
    onAssist = validateTextField(dlg, 'dialogues.on_assist', 'on_assist', 100, true, errors) ?? '';
    onClear = validateTextField(dlg, 'dialogues.on_clear', 'on_clear', 100, true, errors) ?? '';
    onRetire = validateTextField(dlg, 'dialogues.on_retire', 'on_retire', 100, false, errors);
  }

  // 5. footprint
  let reachedFloor = 1;
  let footprintOutcome: 'clear' | 'gameover' | 'retired' = 'gameover';
  let epitaph = '';
  let footprintSeed: string | null = null;

  if (
    typeof root.footprint !== 'object' ||
    root.footprint === null ||
    Array.isArray(root.footprint)
  ) {
    errors.push('footprint must be an object');
  } else {
    const fp = root.footprint as Record<string, unknown>;
    if (
      typeof fp.reached_floor !== 'number' ||
      !Number.isInteger(fp.reached_floor) ||
      fp.reached_floor < 1 ||
      fp.reached_floor > 20
    ) {
      errors.push('footprint.reached_floor must be an integer between 1 and 20');
    } else {
      reachedFloor = fp.reached_floor;
    }

    if (
      fp.outcome !== 'clear' &&
      fp.outcome !== 'gameover' &&
      fp.outcome !== 'retired'
    ) {
      errors.push("footprint.outcome must be 'clear', 'gameover', or 'retired'");
    } else {
      footprintOutcome = fp.outcome;
    }

    epitaph = validateTextField(fp, 'footprint.epitaph', 'epitaph', 100, true, errors) ?? '';
    footprintSeed = validateTextField(fp, 'footprint.seed', 'seed', 64, false, errors);
  }

  // 6. プライバシー検疫（指定時）
  if (privateOwnerNames && privateOwnerNames.length > 0) {
    const leaked = scanPrivacyLeaks(JSON.stringify(raw), privateOwnerNames);
    if (leaked.length > 0) {
      errors.push(
        `Privacy check failed: contains private owner name(s): ${leaked.join(', ')}`
      );
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const validated: GuestAgentData = {
    schema_version: '1.0',
    exported_at,
    agent: {
      id: agentId,
      name: agentName,
      title: agentTitle,
      ...(selfIntro !== null ? { self_intro: selfIntro } : {}),
      ...(personaTags ? { persona_tags: personaTags } : {}),
      personality,
      speech_style: speechStyle,
    },
    visuals: {
      ...(avatarUrl !== null ? { avatar_url: avatarUrl } : {}),
      avatar_base64: avatarBase64,
      appearance_prompt: appearancePrompt,
      highlight_poses: {
        on_assist: poseOnAssist,
        ...(poseOnClear !== null ? { on_clear: poseOnClear } : {}),
      },
    },
    gameplay: {
      style_axes: styleAxes,
      ...(styleAxisLabels ? { style_axis_labels: styleAxisLabels } : {}),
      assist: {
        mode: 'v2o_axis_boost',
        target_axis: targetAxis,
        s_eff_modifier: 1,
      },
    },
    dialogues: {
      on_join: onJoin,
      on_assist: onAssist,
      on_clear: onClear,
      ...(onRetire !== null ? { on_retire: onRetire } : {}),
    },
    footprint: {
      reached_floor: reachedFloor,
      outcome: footprintOutcome,
      epitaph,
      ...(footprintSeed !== null ? { seed: footprintSeed } : {}),
    },
  };

  return { success: true, data: validated };
}

/**
 * ゲストデータの正規化JSON文字列に対する SHA-256 ハッシュ（先頭12文字）
 */
export function computeGuestHash(guest: GuestAgentData): string {
  const canonical = JSON.stringify(guest);
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 12);
}

/**
 * V2o（軸一致アシスト・1ラン1回）の発動条件判定
 */
export function shouldTriggerCompanionAssist(
  floorDef: DungeonFloor,
  guest: GuestAgentData | null | undefined,
  alreadyAssisted: boolean
): boolean {
  if (!guest || alreadyAssisted) {
    return false;
  }
  if (floorDef.area === 'boss' || floorDef.floor >= 19) {
    return false;
  }
  if (floorDef.event.sEnv === 'none') {
    return false;
  }
  return floorDef.event.sEnv === guest.gameplay.assist.target_axis;
}

/**
 * Step D（共闘ハイライト画像生成）用に、ゲストの avatar_base64 を
 * ランディレクトリ内の画像ファイル（guest_avatar.webp 等）として書き出す
 */
export function writeGuestAvatarFile(guest: GuestAgentData, runDir: string): string | null {
  const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
    guest.visuals.avatar_base64
  );
  if (!match) {
    return null;
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]!;
  const base64Data = match[2]!;
  const filePath = path.join(runDir, `guest_avatar.${ext}`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return filePath;
}
