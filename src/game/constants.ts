export const LOGICAL_W = 460;
export const LOGICAL_H = 760;
export const GRID_COLS = 11;
export const R = 20; // bubble radius
export const ROW_H = R * Math.sqrt(3);
export const TOP_Y = 64; // grid top (below HUD)
export const SHOOTER_Y = LOGICAL_H - 86;
export const DANGER_Y = SHOOTER_Y - R * 4.6;
export const PROJECTILE_SPEED = 1150; // px per second (logical)
export const MIN_ANGLE_DEG = 8;
export const MIN_MATCH = 3;
export const POINTS_PER_BUBBLE = 100;
export const FALL_BONUS_MULT = 2;
export const FEVER_COMBO = 5;
export const FEVER_DURATION = 8; // seconds
export const MAX_ROWS_VISIBLE = Math.floor((DANGER_Y - TOP_Y) / ROW_H);

export const COLORS = [
  "#FF3B5C", // red
  "#FF9F0A", // orange
  "#FFD60A", // yellow
  "#30D158", // green
  "#0A84FF", // blue
  "#BF5AF2", // purple
  "#64D2FF", // cyan
] as const;

export const COLOR_NAMES_RU = ["красный", "оранжевый", "жёлтый", "зелёный", "синий", "фиолетовый", "голубой"];
export const COLOR_NAMES_EN = ["red", "orange", "yellow", "green", "blue", "purple", "cyan"];

export const CAMPAIGN_LEVELS = 40;
export const ENDLESS_START_COLORS = 4;
export const DAILY_ROWS = 7;
export const DAILY_COLORS = 6;
export const DAILY_SHOTS = 40;

export const STAR_THRESHOLDS = { three: 0.4, two: 0.15 } as const;

export const SCORE_CAPS = {
  campaign: 250_000,
  endless: 2_000_000,
  daily: 300_000,
} as const;
