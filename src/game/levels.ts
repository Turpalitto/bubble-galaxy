import { CAMPAIGN_LEVELS, DAILY_COLORS, DAILY_ROWS, DAILY_SHOTS, GRID_COLS } from "./constants";
import { createRng, hashString, dailyIndex, todayKey } from "./rng";
import type { GridBubble, LevelConfig, PatternKind, Special } from "./types";

const PATTERNS: PatternKind[] = ["full", "checker", "pyramid", "diamond", "columns", "holes", "zigzag", "stonewall"];

export function campaignConfig(level: number): LevelConfig {
  const L = Math.max(1, Math.min(CAMPAIGN_LEVELS, level));
  const t = (L - 1) / (CAMPAIGN_LEVELS - 1); // 0..1
  const rows = Math.min(9, 4 + Math.round(t * 5));
  const colors = Math.min(7, 3 + Math.round(t * 4));
  const rng = createRng(hashString(`bg-campaign-${L}`));
  let pattern: PatternKind = "full";
  if (L === 1) pattern = "full";
  else if (L === 2) pattern = "checker";
  else pattern = PATTERNS[rng.int(0, L < 8 ? 4 : PATTERNS.length - 1)];
  const density = rows * (GRID_COLS - 0.5);
  const stoneChance = L < 6 ? 0 : Math.min(0.12, 0.02 + t * 0.12);
  const maxShots =
    Math.round(density * (0.64 - t * 0.17) + 6) +
    (pattern === "stonewall" ? 4 : 0) +
    Math.round(stoneChance * density);
  return {
    mode: "campaign",
    level: L,
    seed: hashString(`bg-level-${L}`),
    rows,
    colors,
    maxShots,
    pattern,
    stoneChance,
    specialChance: L < 3 ? 0 : Math.min(0.09, 0.03 + t * 0.07),
    tutorial: L === 1,
  };
}

export function endlessConfig(): LevelConfig {
  return {
    mode: "endless",
    level: 1,
    seed: (Math.random() * 2 ** 32) >>> 0,
    rows: 5,
    colors: 4,
    maxShots: 0,
    pattern: "full",
    stoneChance: 0,
    specialChance: 0.05,
  };
}

export function dailyConfig(date = new Date()): LevelConfig {
  const key = todayKey(date);
  const rng = createRng(hashString(`bg-daily-${key}`));
  return {
    mode: "daily",
    level: dailyIndex(date),
    seed: hashString(`bg-daily-seed-${key}`),
    rows: DAILY_ROWS,
    colors: DAILY_COLORS,
    maxShots: DAILY_SHOTS,
    pattern: PATTERNS[rng.int(0, PATTERNS.length - 1)],
    stoneChance: 0.06,
    specialChance: 0.08,
  };
}

export function colsInRow(row: number, parity: number): number {
  return (row + parity) % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
}

function inPattern(kind: PatternKind, row: number, col: number, rows: number, cols: number, rng: ReturnType<typeof createRng>): boolean {
  const cx = (cols - 1) / 2;
  switch (kind) {
    case "full":
      return true;
    case "checker":
      return row < 2 || (row + col) % 2 === 0 || rng.chance(0.25);
    case "pyramid": {
      const half = (rows - row) * (cx / rows) + 1.2;
      return Math.abs(col - cx) <= half;
    }
    case "diamond": {
      const mid = rows / 2;
      const half = (mid - Math.abs(row - mid)) * (cx / mid) + 1.5;
      return row < 1 || Math.abs(col - cx) <= half;
    }
    case "columns":
      return row < 1 || col % 3 !== 1 || rng.chance(0.2);
    case "holes":
      return row < 1 || !rng.chance(0.28);
    case "zigzag": {
      const phase = Math.floor(row / 2) % 2;
      return row < 1 || (phase === 0 ? col < cols - 3 : col > 2);
    }
    case "stonewall":
      return true;
  }
}

function pickSpecial(rng: ReturnType<typeof createRng>): Special {
  const r = rng.next();
  if (r < 0.4) return "bomb";
  if (r < 0.7) return "lightning";
  return "rainbow";
}

export function generateGrid(cfg: LevelConfig): GridBubble[] {
  if (cfg.tutorial) return tutorialGrid();
  const rng = createRng(cfg.seed);
  const out: GridBubble[] = [];
  for (let row = 0; row < cfg.rows; row++) {
    const cols = colsInRow(row, 0);
    for (let col = 0; col < cols; col++) {
      if (!inPattern(cfg.pattern, row, col, cfg.rows, cols, rng)) continue;
      const b: GridBubble = { row, col, color: rng.int(0, cfg.colors - 1) };
      const isStoneWallRow = cfg.pattern === "stonewall" && row === Math.floor(cfg.rows / 2);
      if (row > 0 && (isStoneWallRow ? rng.chance(0.6) : rng.chance(cfg.stoneChance))) {
        b.color = -1;
        b.special = "stone";
      } else if (row > 0 && rng.chance(cfg.specialChance)) {
        b.special = pickSpecial(rng);
      }
      out.push(b);
    }
  }
  // Make sure nothing floats disconnected from ceiling.
  return pruneFloating(out, 0);
}

export function generateEndlessRow(row: number, parity: number, colors: number, rng: ReturnType<typeof createRng>, specialChance: number): GridBubble[] {
  const cols = colsInRow(row, parity);
  const out: GridBubble[] = [];
  for (let col = 0; col < cols; col++) {
    const b: GridBubble = { row, col, color: rng.int(0, colors - 1) };
    if (rng.chance(specialChance)) b.special = pickSpecial(rng);
    out.push(b);
  }
  return out;
}

function tutorialGrid(): GridBubble[] {
  const G = 3, Rd = 0, B = 4, Y = 2;
  const cells: [number, number, number][] = [
    [0, 3, G], [0, 4, G], [0, 5, G], [0, 6, G], [0, 7, G],
    [1, 3, Rd], [1, 4, Rd], [1, 5, Rd], [1, 6, Rd],
    [2, 4, Rd], [2, 5, Rd], [2, 6, Rd],
    [3, 3, B], [3, 4, B], [3, 5, Y], [3, 6, Y],
    [4, 4, G], [4, 5, G],
  ];
  return cells.map(([row, col, color]) => ({ row, col, color }));
}

export function neighbors(row: number, col: number, parity: number): [number, number][] {
  const shifted = (row + parity) % 2 === 1;
  return shifted
    ? [[row - 1, col], [row - 1, col + 1], [row, col - 1], [row, col + 1], [row + 1, col], [row + 1, col + 1]]
    : [[row - 1, col - 1], [row - 1, col], [row, col - 1], [row, col + 1], [row + 1, col - 1], [row + 1, col]];
}

export function pruneFloating(bubbles: GridBubble[], parity: number): GridBubble[] {
  const map = new Map<string, GridBubble>();
  bubbles.forEach((b) => map.set(`${b.row},${b.col}`, b));
  const seen = new Set<string>();
  const stack = bubbles.filter((b) => b.row === 0).map((b) => `${b.row},${b.col}`);
  stack.forEach((k) => seen.add(k));
  while (stack.length) {
    const k = stack.pop()!;
    const [r, c] = k.split(",").map(Number);
    for (const [nr, nc] of neighbors(r, c, parity)) {
      const nk = `${nr},${nc}`;
      if (map.has(nk) && !seen.has(nk)) {
        seen.add(nk);
        stack.push(nk);
      }
    }
  }
  return bubbles.filter((b) => seen.has(`${b.row},${b.col}`));
}
