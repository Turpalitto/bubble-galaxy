export const BUBBLE_RADIUS = 22;
export const GRID_COLS = 11;
export const GRID_ROWS = 12;
export const SHOOTER_Y_OFFSET = 100;
export const BUBBLE_SPEED = 16;
export const MIN_MATCH = 3;
export const POINTS_PER_BUBBLE = 100;
export const COMBO_MULTIPLIER = 1.5;
export const SPECIAL_BUBBLE_CHANCE = 0.07;
export const ENDLESS_LEVEL_IDX = 999;
export const DAILY_LEVEL_IDX = 998;
export const ENDLESS_SHOTS_PER_WAVE = 30;
export const MAX_GRID_ROWS = 14;
export const TOP_OFFSET = 30;
export const SHOOTER_FROM_BOTTOM = 80;
export const INTRO_FRAMES = 40;

export const BUBBLE_COLORS = [
  '#FF3B5C',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#AF52DE',
  '#FF2D55',
] as const;

export const LEVELS = [
  { rows: 4, colors: 3, maxShots: 20, label: '1' },
  { rows: 4, colors: 4, maxShots: 22, label: '2' },
  { rows: 5, colors: 4, maxShots: 24, label: '3' },
  { rows: 5, colors: 4, maxShots: 26, label: '4' },
  { rows: 5, colors: 5, maxShots: 28, label: '5' },
  { rows: 6, colors: 5, maxShots: 30, label: '6' },
  { rows: 6, colors: 5, maxShots: 32, label: '7' },
  { rows: 7, colors: 6, maxShots: 34, label: '8' },
  { rows: 7, colors: 6, maxShots: 36, label: '9' },
  { rows: 7, colors: 6, maxShots: 38, label: '10' },
  { rows: 8, colors: 7, maxShots: 40, label: '11' },
  { rows: 8, colors: 7, maxShots: 42, label: '12' },
  { rows: 8, colors: 7, maxShots: 44, label: '13' },
  { rows: 9, colors: 7, maxShots: 46, label: '14' },
];

export const TUTORIAL_SHOOT_COLOR = '#34C759';
