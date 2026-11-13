import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { validateGuestAgent } from '../../games/mini-dungeon/src/guest.js';
import type { GuestAgentData, StyleAxis } from '../../games/mini-dungeon/src/types.js';
import type { ResultCardData, StyleAxes } from './types.js';

export interface GuestMetaInput {
  agent_id?: string;
  title: string;
  personality: string;
  speech_style: string;
  appearance_prompt: string;
  highlight_poses: {
    on_assist: string;
    on_clear?: string | null;
  };
  target_axis?: StyleAxis;
  dialogues: {
    on_join: string;
    on_assist: string;
    on_clear: string;
    on_retire?: string | null;
  };
  epitaph?: string;
  avatar_url?: string | null;
}

export interface ExportGuestOptions {
  resultPath: string;
  meta: GuestMetaInput;
  avatarPath?: string;
  outPath?: string;
  extraPrivateNames?: string[];
  exportedAtIso?: string;
}

export interface ExportGuestResult {
  ok: boolean;
  out_path?: string;
  agent_id?: string;
  target_axis?: StyleAxis;
  avatar_base64_length?: number;
  guest?: GuestAgentData;
  errors?: string[];
}

/**
 * アバター画像を 256x256 WebP (quality 82) に変換し Data URI を返す
 */
export async function encodeAvatarToWebpBase64(avatarFilePath: string): Promise<string> {
  if (!fs.existsSync(avatarFilePath)) {
    throw new Error(`Avatar file not found: ${avatarFilePath}`);
  }
  const buf = await sharp(avatarFilePath)
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 82 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

/**
 * 5軸の中で最も値が高い軸（同点時は autonomy -> safety -> efficiency -> creativity -> alignment 順）を返す
 */
export function pickDefaultTargetAxis(axes: StyleAxes): StyleAxis {
  const order: StyleAxis[] = ['autonomy', 'safety', 'efficiency', 'creativity', 'alignment'];
  let best: StyleAxis = 'safety';
  let maxVal = -1;
  for (const ax of order) {
    if (axes[ax] > maxVal) {
      maxVal = axes[ax];
      best = ax;
    }
  }
  return best;
}

function loadLocalSetupInfo(resultAbsPath: string): {
  agentId?: string;
  privateOwnerNames: string[];
} {
  try {
    const setupPath = path.join(path.dirname(resultAbsPath), 'setup.json');
    if (!fs.existsSync(setupPath)) {
      return { privateOwnerNames: [] };
    }
    const setup = JSON.parse(fs.readFileSync(setupPath, 'utf8')) as {
      agent_id?: unknown;
      private_owner_names?: unknown;
      agent?: { private_owner_names?: unknown };
    };
    const agentId =
      typeof setup.agent_id === 'string' && setup.agent_id.trim().length > 0
        ? setup.agent_id.trim()
        : undefined;
    const rawNames = setup.private_owner_names ?? setup.agent?.private_owner_names;
    const privateOwnerNames = Array.isArray(rawNames)
      ? rawNames.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      : [];
    return { agentId, privateOwnerNames };
  } catch {
    return { privateOwnerNames: [] };
  }
}

function extractReachedFloor(card: ResultCardData): number {
  const metric = card.metrics.find((m) => m.key === 'floor_reached');
  if (metric && typeof metric.value === 'number' && Number.isInteger(metric.value)) {
    return Math.min(20, Math.max(1, metric.value));
  }
  return 1;
}

function normalizeOutcome(outcome: ResultCardData['run']['outcome']): 'clear' | 'gameover' | 'retired' {
  if (outcome === 'clear' || outcome === 'gameover' || outcome === 'retired') {
    return outcome;
  }
  return 'clear';
}

/**
 * 完了済み result.json とアバター画像・メタ情報から共有用 guest.json を生成・検証する
 */
export async function exportGuestAgent(options: ExportGuestOptions): Promise<ExportGuestResult> {
  const resultAbsPath = path.resolve(options.resultPath);
  if (!fs.existsSync(resultAbsPath)) {
    return { ok: false, errors: [`Result file not found: ${resultAbsPath}`] };
  }

  let card: ResultCardData;
  try {
    card = JSON.parse(fs.readFileSync(resultAbsPath, 'utf8')) as ResultCardData;
  } catch (err) {
    return { ok: false, errors: [`Failed to parse result.json: ${(err as Error).message}`] };
  }

  const baseDir = path.dirname(resultAbsPath);
  const setupInfo = loadLocalSetupInfo(resultAbsPath);

  const resolvedAvatarPath = options.avatarPath
    ? path.resolve(options.avatarPath)
    : path.resolve(baseDir, card.agent?.avatar_ref || 'avatar.png');

  let avatarBase64: string;
  try {
    avatarBase64 = await encodeAvatarToWebpBase64(resolvedAvatarPath);
  } catch (err) {
    return { ok: false, errors: [(err as Error).message] };
  }

  const agentId = options.meta.agent_id?.trim() || setupInfo.agentId || 'guest-agent';
  const targetAxis = options.meta.target_axis ?? pickDefaultTargetAxis(card.style_axes);

  const defaultLabels = {
    autonomy: '自律性',
    safety: '安全性',
    efficiency: '効率性',
    creativity: '創発性',
    alignment: '親和性',
  };
  const styleAxisLabels = {
    autonomy: card.style_axis_labels?.autonomy ?? defaultLabels.autonomy,
    safety: card.style_axis_labels?.safety ?? defaultLabels.safety,
    efficiency: card.style_axis_labels?.efficiency ?? defaultLabels.efficiency,
    creativity: card.style_axis_labels?.creativity ?? defaultLabels.creativity,
    alignment: card.style_axis_labels?.alignment ?? defaultLabels.alignment,
  };

  const reachedFloor = extractReachedFloor(card);
  const epitaph = (options.meta.epitaph?.trim() || card.run.headline).slice(0, 100);

  const rawGuest: Record<string, unknown> = {
    schema_version: '1.0',
    exported_at: options.exportedAtIso ?? new Date().toISOString(),
    agent: {
      id: agentId,
      name: card.agent.name,
      title: options.meta.title,
      ...(card.agent.self_intro ? { self_intro: card.agent.self_intro } : {}),
      ...(card.agent.persona_tags && card.agent.persona_tags.length > 0
        ? { persona_tags: card.agent.persona_tags }
        : {}),
      personality: options.meta.personality,
      speech_style: options.meta.speech_style,
    },
    visuals: {
      ...(options.meta.avatar_url ? { avatar_url: options.meta.avatar_url } : {}),
      avatar_base64: avatarBase64,
      appearance_prompt: options.meta.appearance_prompt,
      highlight_poses: {
        on_assist: options.meta.highlight_poses?.on_assist,
        ...(options.meta.highlight_poses?.on_clear
          ? { on_clear: options.meta.highlight_poses.on_clear }
          : {}),
      },
    },
    gameplay: {
      style_axes: card.style_axes,
      style_axis_labels: styleAxisLabels,
      assist: {
        mode: 'v2o_axis_boost',
        target_axis: targetAxis,
        s_eff_modifier: 1,
      },
    },
    dialogues: {
      on_join: options.meta.dialogues?.on_join,
      on_assist: options.meta.dialogues?.on_assist,
      on_clear: options.meta.dialogues?.on_clear,
      ...(options.meta.dialogues?.on_retire
        ? { on_retire: options.meta.dialogues.on_retire }
        : {}),
    },
    footprint: {
      reached_floor: reachedFloor,
      outcome: normalizeOutcome(card.run.outcome),
      epitaph,
      seed: card.challenge.seed,
    },
  };

  const privateNames = [
    ...setupInfo.privateOwnerNames,
    ...(card.agent.private_owner_names ?? []),
    ...(options.extraPrivateNames ?? []),
  ];

  const validation = validateGuestAgent(rawGuest, privateNames);
  if (!validation.success || !validation.data) {
    return {
      ok: false,
      errors: validation.errors ?? ['Guest agent validation failed'],
    };
  }

  const outPath = path.resolve(options.outPath ?? path.join(baseDir, 'guest.json'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(validation.data, null, 2) + '\n', 'utf8');

  return {
    ok: true,
    out_path: outPath,
    agent_id: validation.data.agent.id,
    target_axis: validation.data.gameplay.assist.target_axis,
    avatar_base64_length: validation.data.visuals.avatar_base64.length,
    guest: validation.data,
  };
}
