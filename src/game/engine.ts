import {
  COLORS, DANGER_Y, FALL_BONUS_MULT, FEVER_COMBO, FEVER_DURATION, GRID_COLS, LOGICAL_H, LOGICAL_W,
  MIN_ANGLE_DEG, MIN_MATCH, POINTS_PER_BUBBLE, PROJECTILE_SPEED, R, ROW_H, SHOOTER_Y, STAR_THRESHOLDS, TOP_Y,
} from "./constants";
import { colsInRow, generateEndlessRow, generateGrid, neighbors, pruneFloating } from "./levels";
import { createRng, type Rng } from "./rng";
import type {
  Booster, EngineEvent, EngineSnapshot, EngineStatus, FallingBubble, GridBubble, LevelConfig, Particle, Popup, Projectile, Special,
} from "./types";

const key = (r: number, c: number) => r * 32 + c;
export const cellX = (row: number, col: number, parity: number) => R + col * 2 * R + ((row + parity) % 2 === 1 ? R : 0);
export const cellY = (row: number) => TOP_Y + R + row * ROW_H;
const SHOOTER_X = LOGICAL_W / 2;
const MIN_ANGLE = (MIN_ANGLE_DEG * Math.PI) / 180;

export class BubbleEngine {
  cfg: LevelConfig;
  grid = new Map<number, GridBubble>();
  parity = 0;
  status: EngineStatus = "intro";
  introT = 0;
  time = 0;
  cooldown = 0;

  score = 0;
  combo = 0;
  maxCombo = 0;
  shotsLeft = 0;
  shotsFired = 0;
  wave = 1;
  shotsToNextWave = 8;
  popped = 0;
  fever = false;
  feverTime = 0;
  laserShots = 0;
  stars = 0;

  current: { color: number; special?: Special } = { color: 0 };
  next: { color: number } = { color: 0 };
  projectile: Projectile | null = null;
  trail: { x: number; y: number }[] = [];
  aimAngle = Math.PI / 2;
  guide: { x: number; y: number }[] = [];
  guideCell: { row: number; col: number } | null = null;

  particles: Particle[] = [];
  falling: FallingBubble[] = [];
  popups: Popup[] = [];
  shake = 0;
  dropAnim = 0;
  flashColor: string | null = null;
  flashT = 0;

  private rng: Rng;
  private listeners: ((e: EngineEvent) => void)[] = [];
  private colorsAvailable: number;

  constructor(cfg: LevelConfig) {
    this.cfg = cfg;
    this.rng = createRng(cfg.seed ^ 0x9e3779b9);
    this.colorsAvailable = cfg.colors;
    this.shotsLeft = cfg.maxShots;
    generateGrid(cfg).forEach((b) => this.grid.set(key(b.row, b.col), b));
    this.current = { color: this.pickColor(-1) };
    this.next = { color: this.pickColor(this.current.color) };
    this.computeGuide();
  }

  on(fn: (e: EngineEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  private emit(e: EngineEvent) {
    for (const l of this.listeners) l(e);
  }

  // ───────────── Input ─────────────
  setAim(x: number, y: number) {
    let a = Math.atan2(SHOOTER_Y - y, x - SHOOTER_X);
    if (a < MIN_ANGLE) a = MIN_ANGLE;
    if (a > Math.PI - MIN_ANGLE) a = Math.PI - MIN_ANGLE;
    if (y > SHOOTER_Y + 30) a = x < SHOOTER_X ? Math.PI - MIN_ANGLE : MIN_ANGLE;
    this.aimAngle = a;
    this.computeGuide();
  }

  swap() {
    if (this.status !== "ready") return;
    const c = this.current.color;
    this.current.color = this.next.color;
    this.next.color = c;
  }

  applyBooster(kind: Booster): boolean {
    if (this.status !== "ready") return false;
    if (kind === "laser") {
      if (this.laserShots > 0) return false;
      this.laserShots = 3;
      this.computeGuide();
      return true;
    }
    if (this.current.special === kind) return false;
    this.current.special = kind;
    return true;
  }

  shoot(): boolean {
    if (this.status !== "ready" || this.cooldown > 0) return false;
    if (this.cfg.maxShots > 0 && this.shotsLeft <= 0) return false;
    const a = this.aimAngle;
    this.projectile = {
      x: SHOOTER_X,
      y: SHOOTER_Y,
      vx: Math.cos(a) * PROJECTILE_SPEED,
      vy: -Math.sin(a) * PROJECTILE_SPEED,
      color: this.current.color,
      special: this.current.special,
      bounces: 0,
    };
    this.trail.length = 0;
    this.status = "flying";
    this.shotsFired++;
    if (this.cfg.maxShots > 0) this.shotsLeft--;
    if (this.laserShots > 0) this.laserShots--;
    this.emit({ type: "shoot" });
    return true;
  }

  // ───────────── Update ─────────────
  update(dt: number) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    if (this.dropAnim < 0) this.dropAnim = Math.min(0, this.dropAnim + dt * ROW_H * 4);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.fever) {
      this.feverTime -= dt;
      if (this.feverTime <= 0) {
        this.fever = false;
        this.feverTime = 0;
      }
    }

    if (this.status === "intro") {
      this.introT += dt;
      if (this.introT >= 0.7) this.status = "ready";
    }

    if (this.status === "flying" && this.projectile) {
      const p = this.projectile;
      const steps = Math.ceil((PROJECTILE_SPEED * dt) / (R * 0.5));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        p.x += p.vx * sdt;
        p.y += p.vy * sdt;
        if (p.x - R < 0) {
          p.x = R;
          p.vx = -p.vx;
          p.bounces++;
          this.emit({ type: "bounce" });
        } else if (p.x + R > LOGICAL_W) {
          p.x = LOGICAL_W - R;
          p.vx = -p.vx;
          p.bounces++;
          this.emit({ type: "bounce" });
        }
        const hit = this.findHit(p.x, p.y);
        if (hit !== undefined) {
          this.land(p, hit);
          break;
        }
        if (p.y < -R * 2 || p.y > LOGICAL_H + R * 2) {
          this.projectile = null;
          this.status = "ready";
          break;
        }
      }
      if (this.projectile) {
        this.trail.push({ x: p.x, y: p.y });
        if (this.trail.length > 10) this.trail.shift();
      }
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += (q.kind === 2 ? 0 : 520) * dt;
      q.vx *= 0.985;
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.life += dt;
      f.vy += 1400 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vx * 0.01 * dt;
      if (f.y > LOGICAL_H + R * 2) {
        this.falling.splice(i, 1);
      }
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const u = this.popups[i];
      u.life -= dt;
      u.y -= 40 * dt;
      if (u.life <= 0) this.popups.splice(i, 1);
    }
  }

  private findHit(px: number, py: number): GridBubble | null | undefined {
    if (py - R <= TOP_Y + this.dropAnim) return null; // ceiling
    const hitR2 = (2 * R - 3) ** 2;
    for (const b of this.grid.values()) {
      const dx = cellX(b.row, b.col, this.parity) - px;
      const dy = cellY(b.row) - py;
      if (dx * dx + dy * dy < hitR2) return b;
    }
    return undefined;
  }

  private findSnapCell(px: number, py: number): { row: number; col: number } {
    const rowF = (py - TOP_Y - R) / ROW_H;
    let best: { row: number; col: number; d: number; ok: boolean } | null = null;
    for (let row = Math.max(0, Math.floor(rowF) - 1); row <= Math.ceil(rowF) + 1; row++) {
      const cols = colsInRow(row, this.parity);
      for (let col = 0; col < cols; col++) {
        if (this.grid.has(key(row, col))) continue;
        const dx = cellX(row, col, this.parity) - px;
        const dy = cellY(row) - py;
        const d = dx * dx + dy * dy;
        const ok = row === 0 || neighbors(row, col, this.parity).some(([r, c]) => this.grid.has(key(r, c)));
        if (!ok) continue;
        if (!best || d < best.d) best = { row, col, d, ok };
      }
    }
    if (best) return { row: best.row, col: best.col };
    const row = Math.max(0, Math.round(rowF));
    const cols = colsInRow(row, this.parity);
    return { row, col: Math.max(0, Math.min(cols - 1, Math.round((px - R - ((row + this.parity) % 2 ? R : 0)) / (2 * R)))) };
  }

  // ───────────── Landing & resolution ─────────────
  private land(p: Projectile, hit: GridBubble | null) {
    const cell = this.findSnapCell(p.x, p.y);
    const placed: GridBubble = { row: cell.row, col: cell.col, color: p.color, special: p.special === "bomb" || p.special === "rainbow" ? p.special : undefined };
    this.grid.set(key(cell.row, cell.col), placed);
    this.projectile = null;
    this.current.special = undefined;
    this.status = "resolving";

    const px = cellX(placed.row, placed.col, this.parity);
    const py = cellY(placed.row);
    const toRemove = new Map<number, GridBubble>();
    const queue: GridBubble[] = [];
    let triggeredSpecial: Special | undefined;

    const enqueueSpecial = (b: GridBubble) => {
      if (b.special === "bomb") {
        triggeredSpecial = triggeredSpecial ?? "bomb";
        const bx = cellX(b.row, b.col, this.parity), by = cellY(b.row);
        const rad2 = (4 * R + 2) ** 2;
        for (const o of this.grid.values()) {
          const dx = cellX(o.row, o.col, this.parity) - bx, dy = cellY(o.row) - by;
          if (dx * dx + dy * dy <= rad2 && !toRemove.has(key(o.row, o.col))) {
            toRemove.set(key(o.row, o.col), o);
            queue.push(o);
          }
        }
        this.shake = Math.max(this.shake, 1);
        this.flash("#ffb347");
        this.emit({ type: "shake", power: 1 });
      } else if (b.special === "lightning") {
        triggeredSpecial = triggeredSpecial ?? "lightning";
        for (const o of this.grid.values()) {
          if (o.row === b.row && !toRemove.has(key(o.row, o.col))) {
            toRemove.set(key(o.row, o.col), o);
            queue.push(o);
          }
        }
        this.shake = Math.max(this.shake, 0.6);
        this.flash("#9be7ff");
        this.emit({ type: "shake", power: 0.6 });
      }
    };

    // Direct hit on a bomb / lightning triggers it regardless of colour
    if (hit && (hit.special === "bomb" || hit.special === "lightning")) {
      toRemove.set(key(hit.row, hit.col), hit);
      toRemove.set(key(placed.row, placed.col), placed);
      queue.push(hit);
    }
    if (placed.special === "bomb") {
      toRemove.set(key(placed.row, placed.col), placed);
      queue.push(placed);
    }

    // Colour matching
    let matchColor = placed.color;
    if (placed.special === "rainbow") {
      // choose the neighbour colour that produces the biggest group
      let bestSize = 0;
      const seenColors = new Set<number>();
      for (const [r, c] of neighbors(placed.row, placed.col, this.parity)) {
        const n = this.grid.get(key(r, c));
        if (!n || n.color < 0 || seenColors.has(n.color)) continue;
        seenColors.add(n.color);
        const size = this.floodMatch(placed, n.color).size;
        if (size > bestSize) {
          bestSize = size;
          matchColor = n.color;
        }
      }
      if (bestSize < MIN_MATCH) matchColor = -2; // stays as rainbow on grid
      else placed.color = matchColor;
    }
    if (matchColor >= 0) {
      const group = this.floodMatch(placed, matchColor);
      if (group.size >= MIN_MATCH) {
        for (const g of group.values()) {
          if (!toRemove.has(key(g.row, g.col))) {
            toRemove.set(key(g.row, g.col), g);
            queue.push(g);
          }
        }
      }
    }

    // chain specials
    while (queue.length) {
      const b = queue.pop()!;
      enqueueSpecial(b);
    }

    if (toRemove.size === 0) {
      this.combo = 0;
      placed.wobble = 0.35;
      this.emit({ type: "stick" });
      this.emit({ type: "miss" });
      this.afterShot();
      return;
    }

    // Remove + score
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (!this.fever && this.combo >= FEVER_COMBO) {
      this.fever = true;
      this.feverTime = FEVER_DURATION;
      this.emit({ type: "fever" });
    }
    const mult = this.multiplier();
    let gained = 0;
    for (const b of toRemove.values()) {
      this.grid.delete(key(b.row, b.col));
      this.spawnPop(cellX(b.row, b.col, this.parity), cellY(b.row), b.color < 0 ? "#9aa3b2" : COLORS[b.color], b.special);
      gained += POINTS_PER_BUBBLE;
    }
    gained = Math.round(gained * mult);
    this.popped += toRemove.size;
    this.score += gained;
    this.addPopup(px, py, `+${gained}`, this.combo > 1 ? "#FFD60A" : "#ffffff", this.combo > 1 ? 1.2 : 1);
    if (this.combo > 1) this.addPopup(px, py - 26, `COMBO x${this.combo}`, "#FF9F0A", 0.9);
    this.emit({ type: "pop", count: toRemove.size, combo: this.combo, special: triggeredSpecial, x: px, y: py });

    // Floating clusters fall
    const remaining = Array.from(this.grid.values());
    const kept = new Set(pruneFloating(remaining, this.parity).map((b) => key(b.row, b.col)));
    let fell = 0;
    for (const b of remaining) {
      if (kept.has(key(b.row, b.col))) continue;
      this.grid.delete(key(b.row, b.col));
      fell++;
      this.falling.push({
        x: cellX(b.row, b.col, this.parity),
        y: cellY(b.row),
        vx: (this.rng.next() - 0.5) * 240,
        vy: -120 - this.rng.next() * 160,
        rot: 0,
        color: b.color,
        special: b.special,
        life: 0,
      });
    }
    if (fell > 0) {
      const bonus = Math.round(fell * POINTS_PER_BUBBLE * FALL_BONUS_MULT * mult);
      this.score += bonus;
      this.popped += fell;
      this.addPopup(LOGICAL_W / 2, DANGER_Y - 60, `DROP +${bonus}`, "#64D2FF", 1.25);
      this.emit({ type: "fall", count: fell });
    }
    this.afterShot();
  }

  private floodMatch(start: GridBubble, color: number): Map<number, GridBubble> {
    const out = new Map<number, GridBubble>();
    const stack = [start];
    out.set(key(start.row, start.col), start);
    while (stack.length) {
      const b = stack.pop()!;
      for (const [r, c] of neighbors(b.row, b.col, this.parity)) {
        const k = key(r, c);
        const n = this.grid.get(k);
        if (!n || out.has(k)) continue;
        if (n.color === color || n.special === "rainbow") {
          out.set(k, n);
          stack.push(n);
        }
      }
    }
    return out;
  }

  private afterShot() {
    // Endless waves
    if (this.cfg.mode === "endless") {
      if (this.grid.size === 0) {
        this.score += 5000;
        this.addPopup(LOGICAL_W / 2, LOGICAL_H / 2, "CLEAR! +5000", "#30D158", 1.5);
        for (let i = 0; i < 3; i++) this.pushRow();
      }
      this.shotsToNextWave--;
      if (this.shotsToNextWave <= 0) {
        this.wave++;
        this.colorsAvailable = Math.min(COLORS.length, 4 + Math.floor(this.wave / 4));
        this.shotsToNextWave = Math.max(4, 8 - Math.floor(this.wave / 3));
        this.pushRow();
        this.emit({ type: "wave", wave: this.wave });
      }
    }

    // Lose by danger line
    for (const b of this.grid.values()) {
      if (cellY(b.row) + R >= DANGER_Y) {
        this.finish("lost");
        return;
      }
    }
    // Win
    if (this.cfg.mode !== "endless" && this.grid.size === 0) {
      const ratio = this.cfg.maxShots > 0 ? this.shotsLeft / this.cfg.maxShots : 1;
      this.stars = ratio >= STAR_THRESHOLDS.three ? 3 : ratio >= STAR_THRESHOLDS.two ? 2 : 1;
      const bonus = this.shotsLeft * 50;
      this.score += bonus;
      if (bonus > 0) this.addPopup(LOGICAL_W / 2, LOGICAL_H / 2, `BONUS +${bonus}`, "#FFD60A", 1.4);
      this.finish("won");
      return;
    }
    if (this.cfg.maxShots > 0 && this.shotsLeft <= 0) {
      this.finish("lost");
      return;
    }

    this.current = { color: this.next.color };
    this.next = { color: this.pickColor(this.current.color) };
    this.status = "ready";
    this.cooldown = 0.1;
    this.computeGuide();
  }

  private finish(s: "won" | "lost") {
    this.status = s;
    if (s === "won") this.emit({ type: "won", stars: this.stars, score: this.score });
    else this.emit({ type: "lost", score: this.score });
  }

  private pushRow() {
    const moved: GridBubble[] = [];
    for (const b of this.grid.values()) {
      b.row += 1;
      moved.push(b);
    }
    this.grid.clear();
    this.parity ^= 1;
    for (const b of moved) this.grid.set(key(b.row, b.col), b);
    for (const b of generateEndlessRow(0, this.parity, this.colorsAvailable, this.rng, 0.06)) this.grid.set(key(0, b.col), b);
    this.dropAnim = -ROW_H;
  }

  private pickColor(exclude: number): number {
    const onGrid = new Set<number>();
    for (const b of this.grid.values()) if (b.color >= 0) onGrid.add(b.color);
    let pool = onGrid.size > 0 ? Array.from(onGrid) : Array.from({ length: this.colorsAvailable }, (_, i) => i);
    if (pool.length > 1 && exclude >= 0 && this.rng.chance(0.6)) pool = pool.filter((c) => c !== exclude);
    return pool[Math.floor(this.rng.next() * pool.length)];
  }

  private multiplier(): number {
    const m = Math.min(5, 1 + (this.combo - 1) * 0.5);
    return this.fever ? m * 2 : m;
  }

  private flash(color: string) {
    this.flashColor = color;
    this.flashT = 0.25;
  }

  private spawnPop(x: number, y: number, color: string, special?: Special) {
    const n = special ? 18 : 9;
    for (let i = 0; i < n; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const sp = 90 + this.rng.next() * (special ? 320 : 200);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.45 + this.rng.next() * 0.4,
        maxLife: 0.85,
        size: 2 + this.rng.next() * 4,
        color,
        kind: this.rng.chance(0.3) ? 1 : 0,
      });
    }
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.35, maxLife: 0.35, size: R, color, kind: 2 });
  }

  private addPopup(x: number, y: number, text: string, color: string, scale: number) {
    this.popups.push({ x, y, text, life: 1, maxLife: 1, color, scale });
  }

  // ───────────── Aim guide ─────────────
  computeGuide() {
    const pts: { x: number; y: number }[] = [{ x: SHOOTER_X, y: SHOOTER_Y }];
    let x = SHOOTER_X, y = SHOOTER_Y;
    let vx = Math.cos(this.aimAngle), vy = -Math.sin(this.aimAngle);
    const maxBounces = this.laserShots > 0 ? 4 : 1;
    let bounces = 0;
    const step = 5;
    let travelled = 0;
    const maxTravel = this.laserShots > 0 ? 4000 : 1500;
    this.guideCell = null;
    while (travelled < maxTravel) {
      x += vx * step;
      y += vy * step;
      travelled += step;
      if (x - R < 0 || x + R > LOGICAL_W) {
        x = x - R < 0 ? R : LOGICAL_W - R;
        vx = -vx;
        bounces++;
        pts.push({ x, y });
        if (bounces > maxBounces) break;
      }
      const hit = this.findHit(x, y);
      if (hit !== undefined) {
        pts.push({ x, y });
        if (this.laserShots > 0) this.guideCell = this.findSnapCell(x, y);
        break;
      }
    }
    if (pts.length === 1) pts.push({ x, y });
    this.guide = pts;
  }

  get danger(): number {
    let lowest = TOP_Y;
    for (const b of this.grid.values()) lowest = Math.max(lowest, cellY(b.row) + R);
    return Math.max(0, Math.min(1, (lowest - TOP_Y) / (DANGER_Y - TOP_Y)));
  }

  snapshot(): EngineSnapshot {
    return {
      status: this.status,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      shotsLeft: this.shotsLeft,
      maxShots: this.cfg.maxShots,
      wave: this.wave,
      shotsToNextWave: this.shotsToNextWave,
      popped: this.popped,
      fever: this.fever,
      feverTime: this.feverTime,
      laserShots: this.laserShots,
      currentColor: this.current.color,
      currentSpecial: this.current.special,
      nextColor: this.next.color,
      bubblesLeft: this.grid.size,
      stars: this.stars,
      danger: this.danger,
    };
  }
}

export { GRID_COLS };
