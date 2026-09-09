export type Special = "bomb" | "lightning" | "rainbow" | "stone";
export type Mode = "campaign" | "endless" | "daily";
export type Booster = "bomb" | "rainbow" | "laser";

export interface GridBubble {
  row: number;
  col: number;
  color: number; // index into COLORS, -1 for stone
  special?: Special;
  wobble?: number; // seconds of wobble anim left
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  special?: Special;
  bounces: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 0 | 1 | 2; // 0 circle, 1 spark, 2 ring
}

export interface FallingBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  color: number;
  special?: Special;
  life: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

export type EngineStatus = "intro" | "ready" | "flying" | "resolving" | "won" | "lost";

export interface EngineSnapshot {
  status: EngineStatus;
  score: number;
  combo: number;
  maxCombo: number;
  shotsLeft: number;
  maxShots: number;
  wave: number;
  shotsToNextWave: number;
  popped: number;
  fever: boolean;
  feverTime: number;
  laserShots: number;
  currentColor: number;
  currentSpecial?: Special;
  nextColor: number;
  bubblesLeft: number;
  stars: number;
  danger: number; // 0..1 proximity
}

export type EngineEvent =
  | { type: "shoot" }
  | { type: "bounce" }
  | { type: "stick" }
  | { type: "pop"; count: number; combo: number; special?: Special; x: number; y: number }
  | { type: "fall"; count: number }
  | { type: "miss" }
  | { type: "fever" }
  | { type: "wave"; wave: number }
  | { type: "won"; stars: number; score: number }
  | { type: "lost"; score: number }
  | { type: "shake"; power: number };

export interface LevelConfig {
  mode: Mode;
  level: number; // 1-based campaign level, wave for endless, day index for daily
  seed: number;
  rows: number;
  colors: number;
  maxShots: number; // 0 = infinite (endless)
  pattern: PatternKind;
  stoneChance: number;
  specialChance: number;
  tutorial?: boolean;
}

export type PatternKind =
  | "full"
  | "checker"
  | "pyramid"
  | "diamond"
  | "columns"
  | "holes"
  | "stonewall"
  | "zigzag";
