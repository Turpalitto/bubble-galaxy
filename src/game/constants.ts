// =================== GAME CONSTANTS ===================

export const BUBBLE_RADIUS = 22;
export const GRID_COLS = 11;
export const GRID_ROWS = 12;
export const SHOOTER_Y_OFFSET = 100; // from bottom

export const BUBBLE_COLORS = [
  '#FF3B5C', // red
  '#FF9500', // orange
  '#FFCC00', // yellow
  '#34C759', // green
  '#007AFF', // blue
  '#AF52DE', // purple
  '#FF2D55', // pink
] as const;

export const COLOR_NAMES: Record<string, string> = {
  '#FF3B5C': 'red',
  '#FF9500': 'orange',
  '#FFCC00': 'yellow',
  '#34C759': 'green',
  '#007AFF': 'blue',
  '#AF52DE': 'purple',
  '#FF2D55': 'pink',
};

export const BUBBLE_SPEED = 16;
export const MIN_MATCH = 3;

export const POINTS_PER_BUBBLE = 100;
export const COMBO_MULTIPLIER = 1.5;

export const SPECIAL_BUBBLE_CHANCE = 0.07;
export const ENDLESS_LEVEL_IDX = 999;
export const DAILY_LEVEL_IDX = 998;
export const ENDLESS_SHOTS_PER_WAVE = 30;
export const MAX_GRID_ROWS = 14;

export const LEVELS = [
  { rows: 5, colors: 4, maxShots: 25, label: 'Уровень 1' },
  { rows: 6, colors: 4, maxShots: 28, label: 'Уровень 2' },
  { rows: 6, colors: 5, maxShots: 30, label: 'Уровень 3' },
  { rows: 7, colors: 5, maxShots: 32, label: 'Уровень 4' },
  { rows: 7, colors: 6, maxShots: 35, label: 'Уровень 5' },
  { rows: 8, colors: 6, maxShots: 38, label: 'Уровень 6' },
  { rows: 8, colors: 7, maxShots: 40, label: 'Уровень 7' },
  { rows: 9, colors: 7, maxShots: 45, label: 'Уровень 8' },
];
