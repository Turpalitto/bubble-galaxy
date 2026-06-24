import type { PlayerProgress } from '../game/types';
import { LEVELS } from '../game/constants';

const LS_KEY = 'bubbleGalaxy_hs';
const LS_PROGRESS_KEY = 'bubbleGalaxy_progress';

export function loadHighScore(): number {
  try { return parseInt(localStorage.getItem(LS_KEY) || '0', 10) || 0; } catch { return 0; }
}

export function saveHighScore(s: number) {
  try { localStorage.setItem(LS_KEY, String(s)); } catch {}
}

export function createDefaultProgress(): PlayerProgress {
  return {
    highScore: loadHighScore(),
    unlockedLevels: 0,
    levelStars: Array(LEVELS.length).fill(0),
    totalBubblesPopped: 0,
    achievements: [],
    campaignComplete: false,
    endlessHighScore: 0,
  };
}

export function normalizeProgress(raw: Partial<PlayerProgress> | null | undefined): PlayerProgress {
  const base = createDefaultProgress();
  if (!raw) return base;
  const stars = raw.levelStars ?? base.levelStars;
  return {
    highScore: raw.highScore ?? base.highScore,
    unlockedLevels: raw.unlockedLevels ?? base.unlockedLevels,
    levelStars: Array.from({ length: LEVELS.length }, (_, i) => stars[i] ?? 0),
    totalBubblesPopped: raw.totalBubblesPopped ?? base.totalBubblesPopped,
    achievements: raw.achievements ?? base.achievements,
    campaignComplete: raw.campaignComplete ?? base.campaignComplete,
    endlessHighScore: raw.endlessHighScore ?? base.endlessHighScore,
  };
}

export function loadLocalProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(LS_PROGRESS_KEY);
    if (raw) return normalizeProgress(JSON.parse(raw) as Partial<PlayerProgress>);
  } catch {}
  return createDefaultProgress();
}

export function saveLocalProgress(progress: PlayerProgress) {
  try { localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify(progress)); } catch {}
  saveHighScore(progress.highScore);
}

export function isLevelUnlocked(levelIdx: number, unlockedLevels: number): boolean {
  return levelIdx <= unlockedLevels;
}
