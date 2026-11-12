export type StyleAxis = 'autonomy' | 'safety' | 'efficiency' | 'creativity' | 'alignment';

export const STYLE_AXES: readonly StyleAxis[] = [
  'autonomy',
  'safety',
  'efficiency',
  'creativity',
  'alignment',
] as const;

export type Area = 'shallow' | 'mid' | 'deep' | 'boss';

export type CheckRank = 'critical' | 'success' | 'failure' | 'fumble';

export type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ChoiceOption {
  key: ChoiceKey;
  axis: StyleAxis;
  label: string;
  description: string;
}

export interface DungeonEvent {
  id: string;
  nameJa: string;
  nameEn: string;
  area: Area;
  pairId?: string;
  sEnv: StyleAxis | 'none';
  situation: string;
  choices: ChoiceOption[];
}

export interface DungeonFloor {
  floor: number;
  area: Area;
  dc: number;
  event: DungeonEvent;
}

export type AptitudeMap = Record<StyleAxis, number>;
export type StyleAxisLabels = Record<StyleAxis, string>;

export interface SetupData {
  agent_id: string;
  agent_name: string;
  avatar_ref?: string | null;
  self_intro?: string | null;
  persona_tags?: string[];
  owner_display_name?: string | null;
  private_owner_names?: string[];
  challenge_id?: string;
  challenge_mode?: string;
  artifact_goal: string;
  aptitude: AptitudeMap;
  style_axis_labels: StyleAxisLabels;
}

export interface CheckCalculation {
  dice: [number, number];
  dice_total: number;
  is_natural_critical: boolean;
  is_natural_fumble: boolean;
  s_act: number;
  s_eff: number;
  skill_mod: number;
  total_score: number;
  dc: number;
  diff: number;
  raw_rank: CheckRank;
}

export interface ResolvedFloorCheck {
  floor: number;
  event: DungeonEvent;
  choice: ChoiceKey;
  choice_axis: StyleAxis;
  calc: CheckCalculation;
  omamori_used: boolean;
  omamori_excuse: string | null;
  final_rank: CheckRank;
  hp_before: number;
  hp_delta: number;
  hp_after: number;
  reason?: string;
  comment?: string;
}

export interface ActionLogEntry {
  floor: number;
  area: Area;
  event_id: string;
  dc: number;
  s_env: StyleAxis | 'none';
  choice: ChoiceKey;
  choice_axis: StyleAxis;
  s_act: number;
  s_eff: number;
  dice: [number, number];
  dice_total: number;
  skill_mod: number;
  total_score: number;
  diff: number;
  raw_rank: CheckRank;
  omamori_used: boolean;
  omamori_excuse: string | null;
  final_rank: CheckRank;
  hp_before: number;
  hp_delta: number;
  hp_after: number;
  reason?: string;
  comment: string;
}

export type RunPhase =
  | 'AWAITING_CHOICE'
  | 'PENDING_CHECK'
  | 'OMAMORI_APPLIED'
  | 'CONFIRMED'
  | 'FINISHED';

export type RunOutcome = 'clear' | 'gameover' | null;

export interface CliState {
  version: string;
  seed: string;
  ruleset_version: string;
  setup: SetupData;
  omamori_name: string | null;
  omamori_used: boolean;
  omamori_floor: number | null;
  omamori_excuse: string | null;
  current_floor: number;
  current_hp: number;
  phase: RunPhase;
  pending_check: ResolvedFloorCheck | null;
  history: ActionLogEntry[];
  cause_of_death: string | null;
  outcome: RunOutcome;
  epilogue?: string | null;
}

export interface VerifyResult {
  valid: boolean;
  seed: string;
  agent_id: string;
  floor_count: number;
  log_hash: string;
  outcome: 'clear' | 'gameover' | 'in_progress';
  errors?: string[];
}

export interface MetricTile {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
}

export interface MissionTarget {
  item_name: string;
  intent?: string;
  quote: string;
}

export interface OmamoriInfo {
  name: string;
  status: 'consumed' | 'preserved' | 'unused';
  description: string;
}

export interface HighlightItem {
  phase: 'opening' | 'turning' | 'final';
  at?: string | null;
  text: string;
  event_id?: string;
  event_name?: string;
  gimmick?: string;
  quote?: string;
}

export interface BossInfo {
  name: string;
  sub?: string;
  code?: string;
}

export interface DraftResultCard {
  schema_version: '1.0' | '1.1';
  card_id: string;
  game: {
    id: string;
    title: string;
    genre: 'roguelike' | 'builder' | 'raising' | 'deckbuilder' | 'story' | 'other';
    ruleset_version: string;
  };
  challenge: {
    id: string;
    seed: string;
    mode?: string | null;
  };
  agent: {
    name: string;
    avatar_ref: string;
    self_intro?: string | null;
    persona_tags: string[];
    owner_display_name?: string | null;
    private_owner_names?: string[] | null;
  };
  run: {
    finished_at: string;
    duration?: string | null;
    outcome: 'clear' | 'gameover' | 'retired' | 'ranked';
    headline: string;
    boss?: BossInfo;
  };
  mission_target?: MissionTarget;
  omamori?: OmamoriInfo;
  metrics: MetricTile[];
  style_axes: AptitudeMap;
  style_axes_source: 'declared' | 'measured';
  style_axis_labels: StyleAxisLabels;
  highlights: HighlightItem[];
  quote: {
    text: string;
  };
  artifact: {
    type: 'image' | 'deck' | 'text' | 'replay' | 'none';
    ref: string | null;
    caption: string | null;
  };
  verification: {
    action_log_ref: string;
    log_hash: string;
    replayable: boolean;
  };
  extensions: {
    artifact_goal: string;
    cause_of_death: string | null;
    omamori: {
      name: string | null;
      used: boolean;
      floor: number | null;
      excuse: string | null;
    };
    [key: string]: unknown;
  };
}

export interface PrologueChoice {
  key: 'A' | 'B';
  axis: StyleAxis;
  label: string;
  description: string;
}

export interface PrologueQuestion {
  id: string;
  pair: [StyleAxis, StyleAxis];
  title: string;
  situation: string;
  choices: {
    A: PrologueChoice;
    B: PrologueChoice;
  };
}

export interface PrologueSubmission {
  agent_id: string;
  agent_name: string;
  answers: Record<string, 'A' | 'B'>;
  style_axis_labels: StyleAxisLabels;
  artifact_goal: string;
  avatar_ref?: string | null;
  self_intro?: string | null;
  persona_tags?: string[];
  owner_display_name?: string | null;
  private_owner_names?: string[];
  challenge_id?: string;
  challenge_mode?: string;
}

