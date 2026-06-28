import {
  BUBBLE_RADIUS, GRID_COLS, BUBBLE_COLORS, BUBBLE_SPEED,
  LEVELS, SPECIAL_BUBBLE_CHANCE, ENDLESS_LEVEL_IDX, DAILY_LEVEL_IDX,
  MAX_GRID_ROWS, ENDLESS_SHOTS_PER_WAVE, TOP_OFFSET, SHOOTER_FROM_BOTTOM,
} from './constants';
import type { Bubble, Projectile, ParticleEffect, BubbleSpecial } from './types';

// ─── Grid helpers ──────────────────────────────────────────────────────────
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
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

function getNeighborCells(row: number, col: number): { row: number; col: number }[] {
  const even = row % 2 === 0;
  return (even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
  ).map(([dr, dc]) => ({ row: row + dr, col: col + dc }));
}

// ─── Grid generation ───────────────────────────────────────────────────────
export function generateGrid(levelIdx: number, canvasWidth: number, topOffset: number): Bubble[] {
  if (levelIdx === DAILY_LEVEL_IDX) return generateDailyGrid(canvasWidth, topOffset);

  const bubbles: Bubble[] = [];
  if (levelIdx === ENDLESS_LEVEL_IDX) {
    const rows = 4;
    const usedColors = BUBBLE_COLORS.slice(0, 5);
    for (let row = 0; row < rows; row++) {
      const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let col = 0; col < cols; col++) {
        const color = usedColors[Math.floor(Math.random() * usedColors.length)];
        bubbles.push(buildBubble(row, col, color, canvasWidth, topOffset));
      }
    }
    return bubbles;
  }

  const lvl = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];
  const usedColors = BUBBLE_COLORS.slice(0, lvl.colors);

  if (levelIdx === 0) {
    return generateTutorialGrid(canvasWidth, topOffset);
  }

  for (let row = 0; row < lvl.rows; row++) {
    const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
    for (let col = 0; col < cols; col++) {
      const color = usedColors[Math.floor(Math.random() * usedColors.length)];
      const bubble = buildBubble(row, col, color, canvasWidth, topOffset);
      if (row > 1 && Math.random() < SPECIAL_BUBBLE_CHANCE) {
        bubble.special = pickSpecial();
      }
      bubbles.push(bubble);
    }
  }
  return bubbles;
}

function generateTutorialGrid(canvasWidth: number, topOffset: number): Bubble[] {
  const G = '#34C759'; const R = '#FF3B5C'; const B = '#007AFF'; const Y = '#FFCC00';
  const cells = [
    { row: 0, col: 3, color: G }, { row: 0, col: 4, color: G }, { row: 0, col: 5, color: G },
    { row: 0, col: 6, color: G }, { row: 0, col: 7, color: G },
    { row: 1, col: 3, color: R }, { row: 1, col: 4, color: R }, { row: 1, col: 5, color: R },
    { row: 1, col: 6, color: R }, { row: 1, col: 7, color: R },
    { row: 2, col: 4, color: R }, { row: 2, col: 5, color: R }, { row: 2, col: 6, color: R },
    { row: 3, col: 3, color: R }, { row: 3, col: 4, color: R }, { row: 3, col: 5, color: R },
    { row: 3, col: 6, color: R }, { row: 3, col: 7, color: R },
    { row: 4, col: 5, color: R },
    { row: 5, col: 1, color: B }, { row: 5, col: 2, color: B },
    { row: 5, col: 3, color: Y }, { row: 5, col: 4, color: Y }, { row: 5, col: 5, color: Y },
    { row: 5, col: 6, color: G }, { row: 5, col: 7, color: G },
  ];
  return cells.map(c => buildBubble(c.row, c.col, c.color, canvasWidth, topOffset));
}

function generateDailyGrid(canvasWidth: number, topOffset: number): Bubble[] {
  const seed = getDailySeed();
  const rng = seededRandom(seed);
  const rows = 7;
  const usedColors = BUBBLE_COLORS.slice(0, 6);
  const bubbles: Bubble[] = [];
  for (let row = 0; row < rows; row++) {
    const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
    for (let col = 0; col < cols; col++) {
      const color = usedColors[Math.floor(rng() * usedColors.length)];
      const bubble = buildBubble(row, col, color, canvasWidth, topOffset);
      if (rng() < SPECIAL_BUBBLE_CHANCE) bubble.special = pickSpecial();
      bubbles.push(bubble);
    }
  }
  return bubbles;
}

function seededRandom(seed: number) {
  const m = 2 ** 31 - 1;
  let state = seed % m;
  if (state <= 0) state = 1;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) & m;
    return state / m;
  };
}

export function getDailySeed(): number {
  const iso = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return Number(iso);
}

const SPECIALS: BubbleSpecial[] = ['bomb', 'rainbow', 'lightning', 'freeze'];
function pickSpecial(): BubbleSpecial {
  return SPECIALS[Math.floor(Math.random() * SPECIALS.length)];
}

function buildBubble(row: number, col: number, color: string, canvasW: number, topOffset: number): Bubble {
  return {
    x: getBubbleX(col, row, canvasW),
    y: getBubbleY(row, topOffset),
    color, row, col,
  };
}

export function repositionBubbles(bubbles: Bubble[], canvasWidth: number, topOffset: number): void {
  bubbles.forEach(b => {
    b.x = getBubbleX(b.col, b.row, canvasWidth);
    b.y = getBubbleY(b.row, topOffset);
  });
}

// ─── Danger line ───────────────────────────────────────────────────────────
export function getDangerY(h: number): number {
  return h - SHOOTER_FROM_BOTTOM - BUBBLE_RADIUS * 4;
}

export function getDangerProximity(h: number, bubbles: Bubble[]): number {
  const active = bubbles.filter(b => !b.popping && !b.falling);
  if (active.length === 0) return 0;
  const lowest = Math.max(...active.map(b => b.y));
  const dangerY = getDangerY(h);
  return Math.max(0, Math.min(1, (lowest - TOP_OFFSET) / (dangerY - TOP_OFFSET)));
}

// ─── Color picking ─────────────────────────────────────────────────────────
export function pickShooterColor(levelIdx: number, bubbles: Bubble[], preferExclude?: string): string {
  const pool = getLevelColorPool(levelIdx);
  const active = bubbles.filter(b => !b.popping && !b.falling);
  const onGrid = [...new Set(active.map(b => b.color))];
  const source = onGrid.length > 0 ? onGrid : [...pool];
  let choices = preferExclude ? source.filter(c => c !== preferExclude) : [...source];
  if (choices.length === 0) choices = [...source];
  if (choices.length === 0) choices = [...pool];
  return choices[Math.floor(Math.random() * choices.length)];
}

function getLevelColorPool(levelIdx: number): readonly string[] {
  if (levelIdx === ENDLESS_LEVEL_IDX || levelIdx === DAILY_LEVEL_IDX) return BUBBLE_COLORS;
  return BUBBLE_COLORS.slice(0, LEVELS[Math.min(levelIdx, LEVELS.length - 1)].colors);
}

export function getMaxShots(levelIdx: number): number {
  if (levelIdx === ENDLESS_LEVEL_IDX) return ENDLESS_SHOTS_PER_WAVE;
  if (levelIdx === DAILY_LEVEL_IDX) return LEVELS[4].maxShots;
  return LEVELS[Math.min(levelIdx, LEVELS.length - 1)].maxShots;
}

export function getLevelLabel(levelIdx: number): string {
  if (levelIdx === ENDLESS_LEVEL_IDX) return 'Бесконечный';
  if (levelIdx === DAILY_LEVEL_IDX) return 'День';
  return LEVELS[Math.min(levelIdx, LEVELS.length - 1)].label;
}

// ─── Special effects ───────────────────────────────────────────────────────
function cellDistance(a: Bubble, b: Bubble): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function applySpecialEffect(
  bubble: Bubble, bubbles: Bubble[], shooterColor: string
): { removed: Bubble[]; score: number; frozenShots?: number } {
  const active = bubbles.filter(b => !b.popping && !b.falling);
  const removed: Bubble[] = [];
  let frozenShots: number | undefined;

  switch (bubble.special) {
    case 'bomb':
      for (const b of active) {
        if (cellDistance(bubble, b) <= 3) removed.push(b);
      }
      break;
    case 'rainbow':
      getNeighborCells(bubble.row, bubble.col).forEach(n => {
        const nb = active.find(b => b.row === n.row && b.col === n.col);
        if (nb && nb.color !== shooterColor) { nb.color = shooterColor; removed.push(nb); }
      });
      if (!removed.includes(bubble)) removed.push(bubble);
      break;
    case 'lightning':
      for (const b of active) {
        if (Math.abs(b.col - bubble.col) <= 1) removed.push(b);
      }
      break;
    case 'freeze':
      frozenShots = 5;
      getNeighborCells(bubble.row, bubble.col).forEach(n => {
        const nb = active.find(b => b.row === n.row && b.col === n.col);
        if (nb) removed.push(nb);
      });
      if (!removed.includes(bubble)) removed.push(bubble);
      break;
  }

  const unique = [...new Map(removed.map(b => [`${b.row},${b.col}`, b])).values()];
  return { removed: unique, score: unique.length * 100, frozenShots };
}

export function addNewRowOnTop(
  bubbles: Bubble[], levelIdx: number, canvasWidth: number, topOffset: number
): Bubble[] {
  const shifted = bubbles.filter(b => !b.popping && !b.falling).map(b => ({
    ...b, row: b.row + 1, y: getBubbleY(b.row + 1, topOffset),
  }));
  const usedColors = levelIdx === ENDLESS_LEVEL_IDX ? BUBBLE_COLORS : BUBBLE_COLORS.slice(0, LEVELS[Math.min(levelIdx, LEVELS.length - 1)].colors);
  const newRow: Bubble[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    newRow.push(buildBubble(0, col, usedColors[Math.floor(Math.random() * usedColors.length)], canvasWidth, topOffset));
  }
  return [...shifted, ...newRow];
}

export function getMaxRow(bubbles: Bubble[]): number {
  const active = bubbles.filter(b => !b.popping && !b.falling);
  if (active.length === 0) return 0;
  return Math.max(...active.map(b => b.row));
}

// ─── Collision ─────────────────────────────────────────────────────────────
export function checkCollision(proj: Projectile, bubbles: Bubble[]): Bubble | null {
  for (const b of bubbles) {
    if (b.popping || b.falling) continue;
    const dx = proj.x - b.x;
    const dy = proj.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < BUBBLE_RADIUS * 2) return b;
  }
  return null;
}

export function snapToGrid(
  proj: Projectile, hit: Bubble | null, bubbles: Bubble[], canvasWidth: number, topOffset: number
): { row: number; col: number; x: number; y: number } | null {
  const candidates: { row: number; col: number; x: number; y: number; dist: number }[] = [];
  const searchBubbles = hit ? [hit, ...bubbles] : bubbles;

  for (const b of searchBubbles) {
    if (b.popping || b.falling) continue;
    for (const n of getNeighborCells(b.row, b.col)) {
      if (n.row < 0 || n.col < 0 || n.col >= GRID_COLS) continue;
      const occupied = bubbles.some(ob => !ob.popping && !ob.falling && ob.row === n.row && ob.col === n.col);
      if (occupied) continue;
      const cx = getBubbleX(n.col, n.row, canvasWidth);
      const cy = getBubbleY(n.row, topOffset);
      const dx = proj.x - cx;
      const dy = proj.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      candidates.push({ row: n.row, col: n.col, x: cx, y: cy, dist: d });
    }
  }

  if (candidates.length === 0) {
    const col = Math.round((proj.x - getBubbleX(0, 0, canvasWidth)) / (BUBBLE_RADIUS * 2));
    const clampedCol = Math.max(0, Math.min(GRID_COLS - 1, col));
    return { row: 0, col: clampedCol, x: getBubbleX(clampedCol, 0, canvasWidth), y: getBubbleY(0, topOffset) };
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0];
}

// ─── Match finding ─────────────────────────────────────────────────────────
export function findMatches(row: number, col: number, color: string, bubbles: Bubble[]): Bubble[] {
  const visited = new Set<string>();
  const result: Bubble[] = [];
  function dfs(r: number, c: number) {
    const key = `${r},${c}`;
    if (visited.has(key)) return;
    visited.add(key);
    const bubble = bubbles.find(b => !b.popping && !b.falling && b.row === r && b.col === c && b.color === color);
    if (!bubble) return;
    result.push(bubble);
    getNeighborCells(r, c).forEach(n => dfs(n.row, n.col));
  }
  dfs(row, col);
  return result;
}

export function findFloating(bubbles: Bubble[]): Bubble[] {
  const active = bubbles.filter(b => !b.popping && !b.falling);
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
        for (const n of getNeighborCells(b.row, b.col)) {
          const nKey = `${n.row},${n.col}`;
          if (!connected.has(nKey) && active.some(ab => ab.row === n.row && ab.col === n.col)) {
            connected.add(nKey);
            changed = true;
          }
        }
      }
    }
  }
  return active.filter(b => !connected.has(`${b.row},${b.col}`));
}

// ─── Particles ─────────────────────────────────────────────────────────────
export function spawnParticles(x: number, y: number, color: string, count = 12): ParticleEffect[] {
  const particles: ParticleEffect[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      color, life: 25 + Math.floor(Math.random() * 15), maxLife: 40, size: 3 + Math.random() * 3,
    });
  }
  return particles;
}

// ─── Drawing ───────────────────────────────────────────────────────────────
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
}

export function drawBubble(
  ctx: CanvasRenderingContext2D, x: number, y: number, color: string,
  radius: number, alpha = 1, glowIntensity = 0, special?: BubbleSpecial, frame = 0
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (special === 'bomb') { drawBombBubble(ctx, x, y, radius, frame, glowIntensity); ctx.restore(); return; }
  if (special === 'rainbow') { drawRainbowBubble(ctx, x, y, radius, frame, glowIntensity); ctx.restore(); return; }
  if (special === 'lightning') { drawLightningBubble(ctx, x, y, radius, frame, glowIntensity); ctx.restore(); return; }
  if (special === 'freeze') { drawFreezeBubble(ctx, x, y, radius, frame, glowIntensity); ctx.restore(); return; }

  drawStandardBubble(ctx, x, y, color, radius, glowIntensity);
  ctx.restore();
}

function drawStandardBubble(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius: number, glowIntensity: number) {
  if (glowIntensity > 0) { ctx.shadowBlur = 20 * glowIntensity; ctx.shadowColor = color; }
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = shadeColor(color, -40); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.05, x, y, radius);
  grad.addColorStop(0, shadeColor(color, 60));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, shadeColor(color, -30));
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(x - radius * 0.28, y - radius * 0.3, radius * 0.28, 0, Math.PI * 2);
  const shineGrad = ctx.createRadialGradient(x - radius * 0.28, y - radius * 0.32, 0, x - radius * 0.28, y - radius * 0.3, radius * 0.28);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad; ctx.fill();
}

function drawBombBubble(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, frame: number, glowIntensity: number) {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.15);
  ctx.shadowBlur = 15 + glowIntensity * 10; ctx.shadowColor = '#ff6600';
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = '#1a1a1a'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(255,100,0,${0.3 + pulse * 0.4})`);
  grad.addColorStop(1, '#111');
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, radius * 0.25 * pulse, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,150,0,${0.6 + pulse * 0.4})`; ctx.fill();
}

function drawRainbowBubble(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, frame: number, glowIntensity: number) {
  const hue = (frame * 2) % 360;
  if (glowIntensity > 0) { ctx.shadowBlur = 20 * glowIntensity; ctx.shadowColor = `hsl(${hue},100%,60%)`; }
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.2, 0, x, y, radius);
  grad.addColorStop(0, `hsl(${hue},100%,75%)`);
  grad.addColorStop(0.5, `hsl(${(hue + 60) % 360},100%,55%)`);
  grad.addColorStop(1, `hsl(${(hue + 120) % 360},100%,40%)`);
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.arc(x - radius * 0.25, y - radius * 0.28, radius * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
}

function drawLightningBubble(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, frame: number, glowIntensity: number) {
  ctx.shadowBlur = 12 + glowIntensity * 8; ctx.shadowColor = '#00aaff';
  drawStandardBubble(ctx, x, y, '#007AFF', radius, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const offset = Math.sin(frame * 0.2 + i) * 4;
    ctx.beginPath(); ctx.moveTo(x - 5 + offset, y - 8); ctx.lineTo(x + 3 + offset, y - 1);
    ctx.lineTo(x - 2 + offset, y + 1); ctx.lineTo(x + 6 + offset, y + 8); ctx.stroke();
  }
}

function drawFreezeBubble(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, frame: number, glowIntensity: number) {
  ctx.shadowBlur = 10 + glowIntensity * 8; ctx.shadowColor = '#88ddff';
  drawStandardBubble(ctx, x, y, '#88ddff', radius, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  const rot = frame * 0.02;
  for (let i = 0; i < 6; i++) {
    const a = rot + (Math.PI * 2 * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * radius * 0.7, y + Math.sin(a) * radius * 0.7);
    ctx.stroke();
  }
}

export function drawPopAnimation(
  ctx: CanvasRenderingContext2D, x: number, y: number, color: string,
  popFrame: number, totalFrames: number, special?: BubbleSpecial
): void {
  const progress = popFrame / totalFrames;
  const alpha = 1 - progress;
  const scale = 1 + progress * 0.5;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawBubble(ctx, 0, 0, color, BUBBLE_RADIUS * (1 - progress * 0.5), 1, 0, special);
  ctx.restore();
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: ParticleEffect) {
  const alpha = p.life / p.maxLife;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
  ctx.fillStyle = p.color; ctx.shadowBlur = 8; ctx.shadowColor = p.color; ctx.fill();
  ctx.restore();
}

export function drawSpecialTelegraph(
  ctx: CanvasRenderingContext2D,
  zones: { x: number; y: number; r: number; kind: BubbleSpecial }[],
  intensity: number, frame: number
): void {
  zones.forEach(z => {
    ctx.save();
    ctx.globalAlpha = 0.15 * intensity + 0.05 * Math.sin(frame * 0.1);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    const color = z.kind === 'bomb' ? '#ff6600' : z.kind === 'lightning' ? '#00aaff' : z.kind === 'rainbow' ? '#ff00ff' : '#88ddff';
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = color; ctx.globalAlpha = 0.3 * intensity; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  });
}

export function getSpecialTelegraph(
  bubble: Bubble, canvasWidth: number, topOffset: number
): { x: number; y: number; r: number; kind: BubbleSpecial }[] {
  if (!bubble.special) return [];
  const zones: { x: number; y: number; r: number; kind: BubbleSpecial }[] = [];
  switch (bubble.special) {
    case 'bomb': zones.push({ x: bubble.x, y: bubble.y, r: BUBBLE_RADIUS * 4.2, kind: 'bomb' }); break;
    case 'lightning':
      for (let row = 0; row < MAX_GRID_ROWS; row++) {
        const cols = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
        for (let col = 0; col < cols; col++) {
          if (Math.abs(col - bubble.col) <= 1) {
            zones.push({ x: getBubbleX(col, row, canvasWidth), y: getBubbleY(row, topOffset), r: BUBBLE_RADIUS * 0.95, kind: 'lightning' });
          }
        }
      }
      break;
    case 'rainbow':
      getNeighborCells(bubble.row, bubble.col).forEach(n => {
        zones.push({ x: getBubbleX(n.col, n.row, canvasWidth), y: getBubbleY(n.row, topOffset), r: BUBBLE_RADIUS * 1.2, kind: 'rainbow' });
      });
      break;
    case 'freeze':
      getNeighborCells(bubble.row, bubble.col).forEach(n => {
        zones.push({ x: getBubbleX(n.col, n.row, canvasWidth), y: getBubbleY(n.row, topOffset), r: BUBBLE_RADIUS * 1.2, kind: 'freeze' });
      });
      break;
  }
  return zones;
}

export function findAimedSpecialBubble(
  startX: number, startY: number, angle: number,
  canvasWidth: number, canvasHeight: number, bubbles: Bubble[]
): Bubble | null {
  const aimPts = getAimPoints(startX, startY, angle, canvasWidth, canvasHeight, 8);
  const specials = bubbles.filter(b => b.special && !b.popping && !b.falling);
  if (specials.length === 0 || aimPts.length === 0) return null;
  let best: Bubble | null = null;
  let bestDist = Infinity;
  for (const sp of specials) {
    for (const pt of aimPts) {
      const dx = sp.x - pt.x; const dy = sp.y - pt.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist && d < BUBBLE_RADIUS * 5) { bestDist = d; best = sp; }
    }
  }
  return best;
}

export function getAimPoints(
  startX: number, startY: number, angle: number,
  canvasWidth: number, _canvasHeight: number, _steps = 5
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x = startX, y = startY;
  let vx = Math.cos(angle) * BUBBLE_SPEED;
  let vy = Math.sin(angle) * BUBBLE_SPEED;
  const stepSize = 15;
  for (let i = 0; i < 300; i++) {
    x += vx; y += vy;
    if (x - BUBBLE_RADIUS < 0) { x = BUBBLE_RADIUS; vx = -vx; }
    else if (x + BUBBLE_RADIUS > canvasWidth) { x = canvasWidth - BUBBLE_RADIUS; vx = -vx; }
    if (i % stepSize === 0) points.push({ x, y });
    if (y < 0) break;
  }
  return points;
}

export function drawDangerPulse(ctx: CanvasRenderingContext2D, w: number, h: number, proximity: number, frame: number): void {
  if (proximity < 0.5) return;
  const intensity = (proximity - 0.5) * 2;
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.1);
  const dangerY = getDangerY(h);
  ctx.save();
  ctx.globalAlpha = intensity * 0.15 * pulse;
  const grad = ctx.createLinearGradient(0, dangerY - 40, 0, dangerY + 20);
  grad.addColorStop(0, 'rgba(255,0,0,0)');
  grad.addColorStop(0.5, 'rgba(255,0,0,1)');
  grad.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, dangerY - 40, w, 60);
  ctx.restore();
}

export function drawCannonNozzle(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  angle: number, color: string, glowPulse: number
): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle + Math.PI / 2);
  const w = 12; const h = 28;
  ctx.fillStyle = 'rgba(100,50,150,0.8)';
  ctx.fillRect(-w / 2, -h, w, h);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.3 + glowPulse * 0.3;
  ctx.fillRect(-w / 2 - 2, -h - 4, w + 4, 6);
  ctx.restore();
}

export function drawScreenFlash(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawTutorialAimGuide(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  aimPts: { x: number; y: number }[], frame: number
): void {
  if (aimPts.length === 0) return;
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.1);
  ctx.save();
  ctx.globalAlpha = 0.6 + pulse * 0.3;
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#34C759';
  ctx.shadowColor = '#34C759';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(sx, sy - BUBBLE_RADIUS);
  aimPts.forEach(pt => ctx.lineTo(pt.x, pt.y));
  ctx.stroke();
  ctx.setLineDash([]);

  const lastPt = aimPts[aimPts.length - 1];
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, BUBBLE_RADIUS + 4 + pulse * 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(52,199,89,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function isDailyCompleted(): boolean {
  const today = new Date().toDateString();
  return localStorage.getItem('dailyCompleted') === today;
}

export function markDailyCompleted(): void {
  localStorage.setItem('dailyCompleted', new Date().toDateString());
}
