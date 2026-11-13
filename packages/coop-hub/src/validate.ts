export const MAX_AVATAR_BASE64_LENGTH = 45000;
export const MAX_REQUEST_BYTES = 65536; // 64KB

const STYLE_AXES = ['autonomy', 'safety', 'efficiency', 'creativity', 'alignment'] as const;
type StyleAxis = (typeof STYLE_AXES)[number];

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

function detectPromptInjection(text: string): string | null {
  if (CONTROL_CHAR_REGEX.test(text)) {
    return 'Contains forbidden control characters';
  }
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `Matches forbidden pattern (${pattern.source})`;
    }
  }
  return null;
}

function validateText(
  obj: Record<string, unknown>,
  fieldPath: string,
  key: string,
  maxLength: number,
  required: boolean,
  errors: string[]
): string | null {
  const val = obj[key];
  if (val === undefined || val === null) {
    if (required) errors.push(`${fieldPath} is required`);
    return null;
  }
  if (typeof val !== 'string') {
    errors.push(`${fieldPath} must be a string`);
    return null;
  }
  const trimmed = val.trim();
  if (trimmed.length === 0) {
    if (required) errors.push(`${fieldPath} must be a non-empty string`);
    return null;
  }
  if (trimmed.length > maxLength) {
    errors.push(`${fieldPath} exceeds max length of ${maxLength}`);
    return null;
  }
  const inj = detectPromptInjection(trimmed);
  if (inj) {
    errors.push(`${fieldPath} rejected by security filter: ${inj}`);
    return null;
  }
  return trimmed;
}

export interface ValidatedGuestSummary {
  agent_id: string;
  agent_name: string;
  title: string;
  target_axis: StyleAxis;
  outcome: 'clear' | 'gameover' | 'retired';
  reached_floor: number;
  epitaph: string;
  avatar_base64: string;
  exported_at: string;
  normalized_json: string;
}

export type GuestValidationOutput =
  | { ok: true; summary: ValidatedGuestSummary }
  | { ok: false; errors: string[] };

export function validateGuestPayload(raw: unknown): GuestValidationOutput {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['Payload must be a JSON object'] };
  }

  const root = raw as Record<string, unknown>;
  if (root.schema_version !== '1.0') {
    errors.push("schema_version must be '1.0'");
  }
  let exportedAt = '';
  if (typeof root.exported_at !== 'string' || Number.isNaN(Date.parse(root.exported_at))) {
    errors.push('exported_at must be a valid ISO 8601 date-time string');
  } else {
    exportedAt = root.exported_at;
  }

  // agent
  let agentId = '';
  let agentName = '';
  let agentTitle = '';
  if (typeof root.agent !== 'object' || root.agent === null || Array.isArray(root.agent)) {
    errors.push('agent must be an object');
  } else {
    const ag = root.agent as Record<string, unknown>;
    if (typeof ag.id !== 'string' || ag.id.length === 0 || ag.id.length > 40 || !/^[a-z0-9-]+$/.test(ag.id)) {
      errors.push('agent.id must be 1-40 chars of lowercase alphanumeric with hyphens');
    } else {
      agentId = ag.id;
    }
    agentName = validateText(ag, 'agent.name', 'name', 20, true, errors) ?? '';
    agentTitle = validateText(ag, 'agent.title', 'title', 30, true, errors) ?? '';
    validateText(ag, 'agent.self_intro', 'self_intro', 60, false, errors);
    validateText(ag, 'agent.personality', 'personality', 120, true, errors);
    validateText(ag, 'agent.speech_style', 'speech_style', 120, true, errors);
    if (ag.persona_tags !== undefined && ag.persona_tags !== null) {
      if (!Array.isArray(ag.persona_tags) || ag.persona_tags.length === 0 || ag.persona_tags.length > 5) {
        errors.push('agent.persona_tags must contain 1-5 strings');
      } else {
        for (let i = 0; i < ag.persona_tags.length; i++) {
          const t = ag.persona_tags[i];
          if (typeof t !== 'string' || t.trim().length === 0 || t.trim().length > 10 || detectPromptInjection(t)) {
            errors.push(`agent.persona_tags[${i}] is invalid`);
          }
        }
      }
    }
  }

  // visuals
  let avatarBase64 = '';
  if (typeof root.visuals !== 'object' || root.visuals === null || Array.isArray(root.visuals)) {
    errors.push('visuals must be an object');
  } else {
    const vis = root.visuals as Record<string, unknown>;
    if (typeof vis.avatar_base64 !== 'string' || !/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(vis.avatar_base64)) {
      errors.push('visuals.avatar_base64 must be a valid image Data URI');
    } else if (vis.avatar_base64.length > MAX_AVATAR_BASE64_LENGTH) {
      errors.push(`visuals.avatar_base64 exceeds ${MAX_AVATAR_BASE64_LENGTH} chars`);
    } else {
      avatarBase64 = vis.avatar_base64;
    }
    validateText(vis, 'visuals.appearance_prompt', 'appearance_prompt', 200, true, errors);
    if (typeof vis.highlight_poses !== 'object' || vis.highlight_poses === null || Array.isArray(vis.highlight_poses)) {
      errors.push('visuals.highlight_poses must be an object');
    } else {
      const hp = vis.highlight_poses as Record<string, unknown>;
      validateText(hp, 'visuals.highlight_poses.on_assist', 'on_assist', 150, true, errors);
      validateText(hp, 'visuals.highlight_poses.on_clear', 'on_clear', 150, false, errors);
    }
  }

  // gameplay
  let targetAxis: StyleAxis = 'safety';
  if (typeof root.gameplay !== 'object' || root.gameplay === null || Array.isArray(root.gameplay)) {
    errors.push('gameplay must be an object');
  } else {
    const gp = root.gameplay as Record<string, unknown>;
    if (typeof gp.style_axes !== 'object' || gp.style_axes === null || Array.isArray(gp.style_axes)) {
      errors.push('gameplay.style_axes must be an object');
    } else {
      const axes = gp.style_axes as Record<string, unknown>;
      let sum = 0;
      for (const ax of STYLE_AXES) {
        const v = axes[ax];
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 5) {
          errors.push(`gameplay.style_axes.${ax} must be integer 0..5`);
        } else {
          sum += v;
        }
      }
      if (sum !== 15) {
        errors.push(`gameplay.style_axes sum must be 15 (got ${sum})`);
      }
    }
    if (typeof gp.assist !== 'object' || gp.assist === null || Array.isArray(gp.assist)) {
      errors.push('gameplay.assist must be an object');
    } else {
      const ast = gp.assist as Record<string, unknown>;
      if (ast.mode !== 'v2o_axis_boost') {
        errors.push("gameplay.assist.mode must be 'v2o_axis_boost'");
      }
      if (typeof ast.target_axis !== 'string' || !STYLE_AXES.includes(ast.target_axis as StyleAxis)) {
        errors.push('gameplay.assist.target_axis is invalid');
      } else {
        targetAxis = ast.target_axis as StyleAxis;
      }
      if (ast.s_eff_modifier !== 1) {
        errors.push('gameplay.assist.s_eff_modifier must be 1');
      }
    }
  }

  // dialogues
  if (typeof root.dialogues !== 'object' || root.dialogues === null || Array.isArray(root.dialogues)) {
    errors.push('dialogues must be an object');
  } else {
    const dlg = root.dialogues as Record<string, unknown>;
    validateText(dlg, 'dialogues.on_join', 'on_join', 100, true, errors);
    validateText(dlg, 'dialogues.on_assist', 'on_assist', 100, true, errors);
    validateText(dlg, 'dialogues.on_clear', 'on_clear', 100, true, errors);
    validateText(dlg, 'dialogues.on_retire', 'on_retire', 100, false, errors);
  }

  // footprint
  let reachedFloor = 1;
  let outcome: 'clear' | 'gameover' | 'retired' = 'gameover';
  let epitaph = '';
  if (typeof root.footprint !== 'object' || root.footprint === null || Array.isArray(root.footprint)) {
    errors.push('footprint must be an object');
  } else {
    const fp = root.footprint as Record<string, unknown>;
    if (typeof fp.reached_floor !== 'number' || !Number.isInteger(fp.reached_floor) || fp.reached_floor < 1 || fp.reached_floor > 20) {
      errors.push('footprint.reached_floor must be integer 1..20');
    } else {
      reachedFloor = fp.reached_floor;
    }
    if (fp.outcome !== 'clear' && fp.outcome !== 'gameover' && fp.outcome !== 'retired') {
      errors.push("footprint.outcome must be 'clear', 'gameover', or 'retired'");
    } else {
      outcome = fp.outcome;
    }
    epitaph = validateText(fp, 'footprint.epitaph', 'epitaph', 100, true, errors) ?? '';
    validateText(fp, 'footprint.seed', 'seed', 64, false, errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    summary: {
      agent_id: agentId,
      agent_name: agentName,
      title: agentTitle,
      target_axis: targetAxis,
      outcome,
      reached_floor: reachedFloor,
      epitaph,
      avatar_base64: avatarBase64,
      exported_at: exportedAt,
      normalized_json: JSON.stringify(root),
    },
  };
}
