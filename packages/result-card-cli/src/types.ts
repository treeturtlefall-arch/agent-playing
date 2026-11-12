export type Genre =
  | 'roguelike'
  | 'builder'
  | 'raising'
  | 'deckbuilder'
  | 'story'
  | 'other';

export type Outcome = 'clear' | 'gameover' | 'retired' | 'ranked';

export type HighlightPhase = 'opening' | 'turning' | 'final';

export type ArtifactType = 'image' | 'deck' | 'text' | 'replay' | 'none';

export type StyleAxisSource = 'declared' | 'measured';

export interface StyleAxes {
  autonomy: number;
  safety: number;
  efficiency: number;
  creativity: number;
  alignment: number;
}

export type StyleAxisLabels = Partial<Record<keyof StyleAxes, string>>;

export interface MetricTile {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
}

export interface HighlightItem {
  phase: HighlightPhase;
  at?: string | null;
  text: string;
  event_id?: string;
  event_name?: string;
  gimmick?: string;
  quote?: string;
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

export interface BossInfo {
  name: string;
  sub?: string;
  code?: string;
}

export interface ResultCardData {
  schema_version: '1.0' | '1.1';
  card_id: string;
  game: {
    id: string;
    title: string;
    genre: Genre;
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
    outcome: Outcome;
    headline: string;
    boss?: BossInfo;
  };
  mission_target?: MissionTarget;
  omamori?: OmamoriInfo;
  metrics: MetricTile[];
  style_axes: StyleAxes;
  style_axes_source?: StyleAxisSource;
  style_axis_labels?: StyleAxisLabels;
  highlights: HighlightItem[];
  quote: {
    text: string;
  };
  artifact?: {
    type: ArtifactType;
    ref?: string | null;
    caption?: string | null;
  };
  verification: {
    action_log_ref?: string | null;
    log_hash?: string | null;
    replayable: boolean;
  };
  extensions?: Record<string, unknown>;
}

export interface PrivacyLeak {
  field: string;
  keyword: string;
  snippet: string;
}

export interface PrivacyCheckResult {
  hasLeak: boolean;
  leaks: PrivacyLeak[];
  suggestion?: string;
}

export interface ValidateResult {
  valid: boolean;
  errors?: string[];
  privacy?: PrivacyCheckResult;
}

export interface RenderOptions {
  outDir?: string;
  htmlOnly?: boolean;
  json?: boolean;
}

export interface RenderResult {
  ok: boolean;
  card_id: string;
  out_dir: string;
  html_path: string;
  png_path: string | null;
  share_text_path: string;
  share_text: string;
  chromium_detected: boolean;
  chromium_path: string | null;
  warning?: string;
}
