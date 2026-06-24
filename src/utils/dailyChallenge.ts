import { BUBBLE_COLORS, GRID_COLS, SPECIAL_BUBBLE_CHANCE } from '../game/constants';
import { getBubbleX, getBubbleY } from '../game/engine';
import type { Bubble, BubbleSpecial } from '../game/types';

function seededRandom(seed: number) {
  const m = 2 ** 31 - 1;
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & m;
    return state / m;
  };
}

const SPECIALS: BubbleSpecial[] = ['bomb', 'rainbow', 'lightning', 'freeze'];

function pickSpecial(rng: () => number): BubbleSpecial {
  return SPECIALS[Math.floor(rng() * SPECIALS.length)];
}

export function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function generateDailyGrid(
  seed: number,
  canvasWidth: number,
  topOffset: number
): Bubble[] {
  const rng = seededRandom(seed);
  const rows = 7;
  const usedColors = BUBBLE_COLORS.slice(0, 6);
  const bubbles: Bubble[] = [];

  for (let row = 0; row < rows; row++) {
    const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
    for (let col = 0; col < cols; col++) {
      const color = usedColors[Math.floor(rng() * usedColors.length)];
      const bubble: Bubble = {
        x: getBubbleX(col, row, canvasWidth),
        y: getBubbleY(row, topOffset),
        color,
        row,
        col,
      };
      if (rng() < SPECIAL_BUBBLE_CHANCE) {
        bubble.special = pickSpecial(rng);
      }
      bubbles.push(bubble);
    }
  }
  return bubbles;
}

export function isDailyCompleted(): boolean {
  const today = new Date().toDateString();
  return localStorage.getItem('dailyCompleted') === today;
}

export function markDailyCompleted() {
  localStorage.setItem('dailyCompleted', new Date().toDateString());
}
