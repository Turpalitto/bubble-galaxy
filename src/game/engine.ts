import {
  BUBBLE_RADIUS,
  GRID_COLS,
  BUBBLE_COLORS,
  BUBBLE_SPEED,
  LEVELS,
  SPECIAL_BUBBLE_CHANCE,
  ENDLESS_LEVEL_IDX,
  DAILY_LEVEL_IDX,
  MAX_GRID_ROWS,
  ENDLESS_SHOTS_PER_WAVE,
} from './constants';
import { generateDailyGrid, getDailySeed } from '../utils/dailyChallenge';
import type { Bubble, Projectile, ParticleEffect, BubbleSpecial } from './types';

// ─── Grid helpers ──────────────────────────────────────────────────────────────

export function getBubbleX(col: number, row: number, canvasWidth: number): number {
  const gridWidth = GRID_COLS * (BUBBLE_RADIUS * 2);
  const startX = (canvasWidth - gridWidth) / 2 + BUBBLE_RADIUS;
  const offset = row % 2 === 0 ? 0 : BUBBLE_RADIUS;
  return startX + col * (BUBBLE_RADIUS * 2) + offset;
}

export function getBubbleY(row: number, topOffset: number): number {
  return topOffset + row * (BUBBLE_RADIUS * 1.73) + BUBBLE_RADIUS;
}

export function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) {
    t -= 1.5 / 2.75;
    return 7.5625 * t * t + 0.75;
  }
  if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75;
    return 7.5625 * t * t + 0.9375;
  }
  t -= 2.625 / 2.75;
  return 7.5625 * t * t + 0.984375;
}

const SPECIAL_TYPES: BubbleSpecial[] = ['bomb', 'rainbow', 'lightning', 'freeze'];

export const TUTORIAL_SHOOT_COLOR = '#FF3B5C';

function pickSpecialType(): BubbleSpecial {
  return SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)];
}

function buildBubble(
  row: number,
  col: number,
  color: string,
  canvasWidth: number,
  topOffset: number,
  special?: BubbleSpecial
): Bubble {
  return {
    x: getBubbleX(col, row, canvasWidth),
    y: getBubbleY(row, topOffset),
    color,
    row,
    col,
    special,
  };
}

/** Level 1 — гарантированный «вау»: 1–2 выстрела → крупный обвал через findFloating */
export function generateTutorialGrid(canvasWidth: number, topOffset: number): Bubble[] {
  const R = TUTORIAL_SHOOT_COLOR;
  const Y = '#FFCC00';
  const G = '#34C759';
  const B = '#007AFF';
  const O = '#FF9500';
  const P = '#AF52DE';

  type Cell = { row: number; col: number; color: string };
  const cells: Cell[] = [
  // Ряд 0 — якорь (связь с верхом)
    ...([R, Y, G, B, O, P, R, Y, G, B, R] as const).map((c, col) => ({ row: 0, col, color: c })),
    // Красный массив в центре
    { row: 1, col: 3, color: R }, { row: 1, col: 4, color: R }, { row: 1, col: 5, color: R },
    { row: 1, col: 6, color: R }, { row: 1, col: 7, color: R },
    { row: 2, col: 4, color: R }, { row: 2, col: 5, color: R }, { row: 2, col: 6, color: R },
    { row: 3, col: 3, color: R }, { row: 3, col: 4, color: R }, { row: 3, col: 5, color: R },
    { row: 3, col: 6, color: R }, { row: 3, col: 7, color: R },
    // Мостик
    { row: 4, col: 5, color: R },
    // Висячие острова (отвалятся после обвала красного)
    { row: 5, col: 1, color: B }, { row: 5, col: 2, color: B },
    { row: 5, col: 3, color: Y }, { row: 5, col: 4, color: Y }, { row: 5, col: 5, color: Y },
    { row: 5, col: 6, color: G }, { row: 5, col: 7, color: G },
  ];

  return cells.map((c) => buildBubble(c.row, c.col, c.color, canvasWidth, topOffset));
}

/** Зона поражения спец-пузыря для телеграфа при прицеливании */
export function getSpecialTelegraph(
  bubble: Bubble,
  _bubbles: Bubble[],
  _shooterColor: string,
  canvasWidth: number,
  topOffset: number
): { x: number; y: number; r: number; kind: BubbleSpecial }[] {
  if (!bubble.special) return [];

  const zones: { x: number; y: number; r: number; kind: BubbleSpecial }[] = [];

  switch (bubble.special) {
    case 'bomb': {
      const r = BUBBLE_RADIUS * 4.2;
      zones.push({ x: bubble.x, y: bubble.y, r, kind: 'bomb' });
      break;
    }
    case 'lightning': {
      for (let row = 0; row < MAX_GRID_ROWS; row++) {
        const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
        for (let dc = -1; dc <= 1; dc++) {
          const col = bubble.col + dc;
          if (col < 0 || col >= cols) continue;
          zones.push({
            x: getBubbleX(col, row, canvasWidth),
            y: getBubbleY(row, topOffset),
            r: BUBBLE_RADIUS * 0.95,
            kind: 'lightning',
          });
        }
      }
      break;
    }
    case 'rainbow': {
      getNeighborCells(bubble.row, bubble.col).forEach((n) => {
        if (n.row < 0) return;
        zones.push({
          x: getBubbleX(n.col, n.row, canvasWidth),
          y: getBubbleY(n.row, topOffset),
          r: BUBBLE_RADIUS * 1.05,
          kind: 'rainbow',
        });
      });
      zones.push({ x: bubble.x, y: bubble.y, r: BUBBLE_RADIUS, kind: 'rainbow' });
      break;
    }
    case 'freeze':
      zones.push({ x: bubble.x, y: bubble.y, r: BUBBLE_RADIUS * 1.8, kind: 'freeze' });
      break;
  }

  return zones;
}

/** Ближайший спец-пузырь к линии прицела */
export function findAimedSpecialBubble(
  startX: number,
  startY: number,
  angle: number,
  canvasWidth: number,
  canvasHeight: number,
  bubbles: Bubble[]
): Bubble | null {
  const aimPts = getAimPoints(startX, startY, angle, canvasWidth, canvasHeight, 8);
  const specials = bubbles.filter((b) => b.special && !b.popping && !b.falling);
  if (specials.length === 0 || aimPts.length === 0) return null;

  let best: Bubble | null = null;
  let bestDist = Infinity;

  for (const sp of specials) {
    for (const pt of aimPts) {
      const dx = sp.x - pt.x;
      const dy = sp.y - pt.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < BUBBLE_RADIUS * 2.5 && d < bestDist) {
        bestDist = d;
        best = sp;
      }
    }
  }
  return best;
}

export function generateGrid(
  levelIdx: number,
  canvasWidth: number,
  topOffset: number
): Bubble[] {
  if (levelIdx === DAILY_LEVEL_IDX) {
    return generateDailyGrid(getDailySeed(), canvasWidth, topOffset);
  }

  if (levelIdx === 0) {
    return generateTutorialGrid(canvasWidth, topOffset);
  }

  let rows: number;
  let usedColors: readonly string[];

  if (levelIdx === ENDLESS_LEVEL_IDX) {
    rows = 7;
    usedColors = BUBBLE_COLORS;
  } else {
    const lvl = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];
    rows = lvl.rows;
    usedColors = BUBBLE_COLORS.slice(0, lvl.colors);
  }

  const bubbles: Bubble[] = [];

  for (let row = 0; row < rows; row++) {
    const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
    for (let col = 0; col < cols; col++) {
      const color = usedColors[Math.floor(Math.random() * usedColors.length)];
      const bubble: Bubble = {
        x: getBubbleX(col, row, canvasWidth),
        y: getBubbleY(row, topOffset),
        color,
        row,
        col,
      };
      if (Math.random() < SPECIAL_BUBBLE_CHANCE) {
        bubble.special = pickSpecialType();
      }
      bubbles.push(bubble);
    }
  }
  return bubbles;
}

/** Пересчёт координат пузырей при изменении размера canvas (без сброса поля) */
export function repositionBubbles(
  bubbles: Bubble[],
  canvasWidth: number,
  topOffset: number
): void {
  for (const b of bubbles) {
    if (b.popping || b.falling) continue;
    b.x = getBubbleX(b.col, b.row, canvasWidth);
    b.y = getBubbleY(b.row, topOffset);
  }
}

export function randomColor(levelIdx: number): string {
  return pickShooterColor(levelIdx, []);
}

/** Цвет следующего пузыря — из палитры уровня, предпочтительно с поля */
export function pickShooterColor(
  levelIdx: number,
  bubbles: Bubble[],
  preferExclude?: string
): string {
  const pool = getLevelColorPool(levelIdx);
  const active = bubbles.filter((b) => !b.popping && !b.falling);
  const onGrid = [...new Set(active.map((b) => b.color))];
  const source = onGrid.length > 0 ? onGrid : [...pool];
  let choices = preferExclude ? source.filter((c) => c !== preferExclude) : [...source];
  if (choices.length === 0) choices = [...source];
  if (choices.length === 0) choices = [...pool];
  return choices[Math.floor(Math.random() * choices.length)];
}

function getLevelColorPool(levelIdx: number): readonly string[] {
  if (levelIdx === ENDLESS_LEVEL_IDX) return BUBBLE_COLORS;
  if (levelIdx === DAILY_LEVEL_IDX) return BUBBLE_COLORS.slice(0, 6);
  const lvl = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];
  return BUBBLE_COLORS.slice(0, lvl.colors);
}

export function getMaxShots(levelIdx: number): number {
  if (levelIdx === ENDLESS_LEVEL_IDX) return ENDLESS_SHOTS_PER_WAVE;
  if (levelIdx === DAILY_LEVEL_IDX) return LEVELS[4].maxShots;
  return LEVELS[Math.min(levelIdx, LEVELS.length - 1)].maxShots;
}

export function getLevelLabel(levelIdx: number): string {
  if (levelIdx === ENDLESS_LEVEL_IDX) return 'Бесконечный';
  if (levelIdx === DAILY_LEVEL_IDX) return 'Уровень дня';
  return LEVELS[Math.min(levelIdx, LEVELS.length - 1)].label;
}

// ─── Special bubble effects ───────────────────────────────────────────────────

function cellDistance(a: Bubble, b: Bubble): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function applySpecialEffect(
  bubble: Bubble,
  bubbles: Bubble[],
  shooterColor: string,
  _canvasW: number
): { removed: Bubble[]; score: number; frozenShots?: number } {
  const active = bubbles.filter((b) => !b.popping && !b.falling);
  const removed: Bubble[] = [];
  let frozenShots: number | undefined;

  switch (bubble.special) {
    case 'bomb': {
      for (const b of active) {
        if (cellDistance(bubble, b) <= 2) removed.push(b);
      }
      break;
    }
    case 'rainbow': {
      const neighbors = getNeighborCells(bubble.row, bubble.col);
      for (const n of neighbors) {
        const nb = active.find((b) => b.row === n.row && b.col === n.col);
        if (nb && nb.color !== shooterColor) {
          nb.color = shooterColor;
          removed.push(nb);
        }
      }
      if (!removed.includes(bubble)) removed.push(bubble);
      break;
    }
    case 'lightning': {
      for (const b of active) {
        if (Math.abs(b.col - bubble.col) <= 1) removed.push(b);
      }
      break;
    }
    case 'freeze': {
      frozenShots = 5;
      removed.push(bubble);
      break;
    }
    default:
      break;
  }

  const unique = [...new Map(removed.map((b) => [`${b.row},${b.col}`, b])).values()];
  return { removed: unique, score: unique.length * 100, frozenShots };
}

export function addNewRowOnTop(
  bubbles: Bubble[],
  levelIdx: number,
  canvasWidth: number,
  topOffset: number
): Bubble[] {
  const shifted = bubbles
    .filter((b) => !b.popping && !b.falling)
    .map((b) => ({
      ...b,
      row: b.row + 1,
      y: getBubbleY(b.row + 1, topOffset),
    }));

  const usedColors =
    levelIdx === ENDLESS_LEVEL_IDX
      ? BUBBLE_COLORS
      : BUBBLE_COLORS.slice(0, LEVELS[Math.min(levelIdx, LEVELS.length - 1)].colors);

  const newRow: Bubble[] = [];
  const cols = GRID_COLS;
  for (let col = 0; col < cols; col++) {
    const color = usedColors[Math.floor(Math.random() * usedColors.length)];
    const bubble: Bubble = {
      x: getBubbleX(col, 0, canvasWidth),
      y: getBubbleY(0, topOffset),
      color,
      row: 0,
      col,
    };
    if (Math.random() < SPECIAL_BUBBLE_CHANCE) {
      bubble.special = pickSpecialType();
    }
    newRow.push(bubble);
  }

  return [...newRow, ...shifted];
}

export function getMaxRow(bubbles: Bubble[]): number {
  const active = bubbles.filter((b) => !b.popping && !b.falling);
  if (active.length === 0) return 0;
  return Math.max(...active.map((b) => b.row));
}

// ─── Collision ─────────────────────────────────────────────────────────────────

export function checkCollision(proj: Projectile, bubbles: Bubble[]): Bubble | null {
  for (const b of bubbles) {
    if (b.popping || b.falling) continue;
    const dx = proj.x - b.x;
    const dy = proj.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < BUBBLE_RADIUS * 1.9) {
      return b;
    }
  }
  return null;
}

// ─── Snap projectile to nearest grid cell ──────────────────────────────────────

export function snapToGrid(
  proj: Projectile,
  hitBubble: Bubble | null,
  bubbles: Bubble[],
  canvasWidth: number,
  topOffset: number
): { row: number; col: number; x: number; y: number } | null {
  let minDist = Infinity;

  if (hitBubble) {
    const candidates = getNeighborCells(hitBubble.row, hitBubble.col);
    for (const c of candidates) {
      if (c.row < 0) continue;
      const cx = getBubbleX(c.col, c.row, canvasWidth);
      const cy = getBubbleY(c.row, topOffset);
      const occupied = bubbles.some(
        (b) => !b.popping && !b.falling && b.row === c.row && b.col === c.col
      );
      if (occupied) continue;
      const dx = proj.x - cx;
      const dy = proj.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        minDist = d;
        const cols = c.row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
        if (c.col >= 0 && c.col < cols) {
          return { row: c.row, col: c.col, x: cx, y: cy };
        }
      }
    }
  }

  for (let row = 0; row < MAX_GRID_ROWS; row++) {
    const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
    for (let col = 0; col < cols; col++) {
      const cx = getBubbleX(col, row, canvasWidth);
      const cy = getBubbleY(row, topOffset);
      const occupied = bubbles.some(
        (b) => !b.popping && !b.falling && b.row === row && b.col === col
      );
      if (occupied) continue;
      const dx = proj.x - cx;
      const dy = proj.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        minDist = d;
        return { row, col, x: cx, y: cy };
      }
    }
  }

  return null;
}

export function getNeighborCells(row: number, col: number): { row: number; col: number }[] {
  const isEven = row % 2 === 0;
  return [
    { row: row - 1, col: isEven ? col - 1 : col },
    { row: row - 1, col: isEven ? col : col + 1 },
    { row: row, col: col - 1 },
    { row: row, col: col + 1 },
    { row: row + 1, col: isEven ? col - 1 : col },
    { row: row + 1, col: isEven ? col : col + 1 },
  ];
}

// ─── Find matching cluster ──────────────────────────────────────────────────────

export function findMatches(
  targetRow: number,
  targetCol: number,
  color: string,
  bubbles: Bubble[]
): Bubble[] {
  const visited = new Set<string>();
  const result: Bubble[] = [];

  function dfs(row: number, col: number) {
    const key = `${row},${col}`;
    if (visited.has(key)) return;
    visited.add(key);

    const bubble = bubbles.find(
      (b) => !b.popping && !b.falling && b.row === row && b.col === col && b.color === color
    );
    if (!bubble) return;
    result.push(bubble);

    const neighbors = getNeighborCells(row, col);
    for (const n of neighbors) {
      dfs(n.row, n.col);
    }
  }

  dfs(targetRow, targetCol);
  return result;
}

// ─── Find floating bubbles (not connected to top) ──────────────────────────────

export function findFloating(bubbles: Bubble[]): Bubble[] {
  const active = bubbles.filter((b) => !b.popping && !b.falling);
  const connected = new Set<string>();

  for (const b of active) {
    if (b.row === 0) connected.add(`${b.row},${b.col}`);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const b of active) {
      const key = `${b.row},${b.col}`;
      if (connected.has(key)) {
        const neighbors = getNeighborCells(b.row, b.col);
        for (const n of neighbors) {
          const nKey = `${n.row},${n.col}`;
          if (!connected.has(nKey)) {
            const nb = active.find((ab) => ab.row === n.row && ab.col === n.col);
            if (nb) {
              connected.add(nKey);
              changed = true;
            }
          }
        }
      }
    }
  }

  return active.filter((b) => !connected.has(`${b.row},${b.col}`));
}

// ─── Particles ─────────────────────────────────────────────────────────────────

export function spawnParticles(
  x: number,
  y: number,
  color: string,
  count: number = 12
): ParticleEffect[] {
  const particles: ParticleEffect[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 40 + Math.random() * 20,
      maxLife: 60,
      size: 3 + Math.random() * 4,
    });
  }
  return particles;
}

// ─── Draw functions ────────────────────────────────────────────────────────────

export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius: number = BUBBLE_RADIUS,
  alpha: number = 1,
  glowIntensity: number = 0,
  special?: BubbleSpecial,
  frame: number = 0
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (special === 'bomb') {
    drawBombBubble(ctx, x, y, radius, frame, glowIntensity);
    ctx.restore();
    return;
  }
  if (special === 'rainbow') {
    drawRainbowBubble(ctx, x, y, radius, frame, glowIntensity);
    ctx.restore();
    return;
  }
  if (special === 'lightning') {
    drawLightningBubble(ctx, x, y, radius, frame, glowIntensity);
    ctx.restore();
    return;
  }
  if (special === 'freeze') {
    drawFreezeBubble(ctx, x, y, radius, frame, glowIntensity);
    ctx.restore();
    return;
  }

  drawStandardBubble(ctx, x, y, color, radius, glowIntensity);
  ctx.restore();
}

function drawStandardBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius: number,
  glowIntensity: number
) {
  if (glowIntensity > 0) {
    ctx.shadowBlur = 20 * glowIntensity;
    ctx.shadowColor = color;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = shadeColor(color, -40);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.3,
    radius * 0.05,
    x,
    y,
    radius
  );
  grad.addColorStop(0, lightenColor(color, 60));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, shadeColor(color, -30));
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - radius * 0.28, y - radius * 0.3, radius * 0.28, 0, Math.PI * 2);
  const shineGrad = ctx.createRadialGradient(
    x - radius * 0.28,
    y - radius * 0.32,
    0,
    x - radius * 0.28,
    y - radius * 0.3,
    radius * 0.28
  );
  shineGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad;
  ctx.fill();
}

function drawBombBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  frame: number,
  glowIntensity: number
) {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.15);
  ctx.shadowBlur = 15 + glowIntensity * 10;
  ctx.shadowColor = '#ff6600';

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(255,100,0,${0.3 + pulse * 0.4})`);
  grad.addColorStop(1, '#111');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius * 0.25 * pulse, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,150,0,${0.6 + pulse * 0.4})`;
  ctx.fill();
}

function drawRainbowBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  frame: number,
  glowIntensity: number
) {
  const hue = (frame * 2) % 360;
  if (glowIntensity > 0) {
    ctx.shadowBlur = 20 * glowIntensity;
    ctx.shadowColor = `hsl(${hue},100%,60%)`;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.2, 0, x, y, radius);
  grad.addColorStop(0, `hsl(${hue},100%,75%)`);
  grad.addColorStop(0.5, `hsl(${(hue + 60) % 360},100%,55%)`);
  grad.addColorStop(1, `hsl(${(hue + 120) % 360},100%,40%)`);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - radius * 0.25, y - radius * 0.28, radius * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}

function drawLightningBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  frame: number,
  glowIntensity: number
) {
  ctx.shadowBlur = 12 + glowIntensity * 8;
  ctx.shadowColor = '#00aaff';

  drawStandardBubble(ctx, x, y, '#007AFF', radius, 0);

  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const angle = (frame * 0.1 + i * Math.PI / 2) % (Math.PI * 2);
    const sx = x + Math.cos(angle) * radius * 0.7;
    const sy = y + Math.sin(angle) * radius * 0.7;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle + 0.5) * 4, sy + Math.sin(angle + 0.5) * 4);
    ctx.stroke();
  }
}

function drawFreezeBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  _frame: number,
  glowIntensity: number
) {
  ctx.shadowBlur = 10 + glowIntensity * 8;
  ctx.shadowColor = '#88ddff';

  drawStandardBubble(ctx, x, y, '#a8e6ff', radius, 0);

  ctx.strokeStyle = 'rgba(200,240,255,0.6)';
  ctx.lineWidth = 1;
  const hexR = radius * 0.35;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = x + Math.cos(angle) * hexR;
    const hy = y + Math.sin(angle) * hexR;
    if (i === 0) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
    } else {
      ctx.lineTo(hx, hy);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

export function drawPopAnimation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  frame: number,
  maxFrame: number = 12,
  special?: BubbleSpecial
) {
  const progress = frame / maxFrame;
  const radius = BUBBLE_RADIUS * (1 + progress * 0.5);
  const alpha = 1 - progress;
  drawBubble(ctx, x, y, color, radius, alpha, 0, special, frame);

  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `rgb(${r},${g},${b})`;
}

function lightenColor(color: string, percent: number): string {
  return shadeColor(color, percent);
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: ParticleEffect) {
  const alpha = p.life / p.maxLife;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.shadowBlur = 8;
  ctx.shadowColor = p.color;
  ctx.fill();
  ctx.restore();
}

// ─── Aim line ──────────────────────────────────────────────────────────────────

export function getAimPoints(
  startX: number,
  startY: number,
  angle: number,
  canvasWidth: number,
  _canvasHeight: number,
  steps: number = 8
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x = startX;
  let y = startY;
  let vx = Math.cos(angle) * BUBBLE_SPEED;
  let vy = Math.sin(angle) * BUBBLE_SPEED;
  const stepSize = 15;

  for (let i = 0; i < steps * stepSize; i++) {
    x += vx / BUBBLE_SPEED;
    y += vy / BUBBLE_SPEED;

    if (x - BUBBLE_RADIUS < 0) {
      x = BUBBLE_RADIUS;
      vx = -vx;
    } else if (x + BUBBLE_RADIUS > canvasWidth) {
      x = canvasWidth - BUBBLE_RADIUS;
      vx = -vx;
    }

    if (i % stepSize === 0) {
      points.push({ x, y });
    }

    if (y < 0) break;
  }

  return points;
}
