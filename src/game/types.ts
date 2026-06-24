export type BubbleSpecial = 'bomb' | 'rainbow' | 'lightning' | 'freeze';

export interface Bubble {
  x: number;
  y: number;
  color: string;
  row: number;
  col: number;
  special?: BubbleSpecial;
  popping?: boolean;
  popFrame?: number;
  falling?: boolean;
  vy?: number;
  alpha?: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  active: boolean;
}

export type GameState =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'levelComplete'
  | 'gameOver'
  | 'adReward';

export interface GameData {
  score: number;
  level: number;
  shotsLeft: number;
  highScore: number;
  combo: number;
  stars: number;
}

export interface PlayerProgress {
  highScore: number;
  unlockedLevels: number;
  levelStars: number[];
  totalBubblesPopped: number;
  achievements: string[];
  campaignComplete: boolean;
  endlessHighScore: number;
}

export interface LevelSessionStats {
  misses: number;
  maxCombo: number;
  consecutiveHits: number;
}

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}
