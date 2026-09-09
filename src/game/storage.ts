import type { Booster } from "./types";
import type { Lang } from "./i18n";

export type AchievementId = "combo5" | "pop1000" | "stars10" | "wave10" | "streak7" | "fever";
export const ACHIEVEMENTS: AchievementId[] = ["combo5", "pop1000", "stars10", "wave10", "streak7", "fever"];

export interface Progress {
  unlocked: number;
  stars: Record<number, number>;
  bestLevelScore: Record<number, number>;
  bestEndless: number;
  bestEndlessWave: number;
  totalPopped: number;
  gamesPlayed: number;
  boosters: Record<Booster, number>;
  achievements: AchievementId[];
  daily: Record<string, { score: number; combo: number; popped: number }>;
  streak: number;
  lastDaily: string | null;
  playerId: string | null;
  token: string | null;
  nickname: string | null;
  settings: { sound: boolean; music: boolean; haptics: boolean; lang: Lang | null };
  tutorialSeen: boolean;
}

const KEY = "bubble-galaxy:v1";

export const defaultProgress = (): Progress => ({
  unlocked: 1,
  stars: {},
  bestLevelScore: {},
  bestEndless: 0,
  bestEndlessWave: 0,
  totalPopped: 0,
  gamesPlayed: 0,
  boosters: { bomb: 2, rainbow: 2, laser: 2 },
  achievements: [],
  daily: {},
  streak: 0,
  lastDaily: null,
  playerId: null,
  token: null,
  nickname: null,
  settings: { sound: true, music: true, haptics: true, lang: null },
  tutorialSeen: false,
});

export function loadProgress(): Progress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const d = defaultProgress();
    return { ...d, ...parsed, boosters: { ...d.boosters, ...(parsed.boosters ?? {}) }, settings: { ...d.settings, ...(parsed.settings ?? {}) } };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

export function totalStars(p: Progress): number {
  return Object.values(p.stars).reduce((a, b) => a + b, 0);
}
