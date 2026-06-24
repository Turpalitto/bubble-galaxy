import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import {
  BUBBLE_RADIUS,
  BUBBLE_SPEED,
  MIN_MATCH,
  POINTS_PER_BUBBLE,
  COMBO_MULTIPLIER,
  ENDLESS_LEVEL_IDX,
  ENDLESS_SHOTS_PER_WAVE,
  MAX_GRID_ROWS,
} from '../game/constants';
import {
  generateGrid,
  randomColor,
  checkCollision,
  snapToGrid,
  findMatches,
  findFloating,
  spawnParticles,
  drawBubble,
  drawPopAnimation,
  drawParticle,
  getAimPoints,
  applySpecialEffect,
  addNewRowOnTop,
  getMaxShots,
  getMaxRow,
  easeOutBounce,
  TUTORIAL_SHOOT_COLOR,
  findAimedSpecialBubble,
  getSpecialTelegraph,
} from '../game/engine';
import { sound } from '../utils/sound';
import type { Bubble, Projectile, ParticleEffect, GameData, LevelSessionStats } from '../game/types';
import type { GameLang } from '../utils/i18n';
import { t } from '../utils/i18n';

interface ScorePopup {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
  combo: number;
}

interface GameCanvasProps {
  gameData: GameData;
  lang: GameLang;
  onScoreUpdate: (score: number, combo: number, shotsLeft: number) => void;
  onGameOver: () => void;
  onLevelComplete: (stars: number) => void;
  onBubblesPopped?: (count: number) => void;
  onLevelStats?: (stats: LevelSessionStats) => void;
  onConsecutiveHits?: (hits: number) => void;
  isPaused: boolean;
  onReserveColorChange?: (color: string) => void;
  swapRef?: MutableRefObject<(() => void) | null>;
}

const TOP_OFFSET = 80;
const SHOOTER_FROM_BOTTOM = 110;
const INTRO_FRAMES = 60;
const DANGER_MARGIN = 130;

function getDangerY(h: number): number {
  return h - SHOOTER_FROM_BOTTOM - BUBBLE_RADIUS * 2.5;
}

function getDangerProximity(h: number, bubbles: Bubble[]): number {
  const active = bubbles.filter((b) => !b.popping && !b.falling);
  if (active.length === 0) return 0;
  const lowest = active.reduce((max, b) => (b.y > max ? b.y : max), 0);
  const margin = getDangerY(h) - lowest;
  if (margin > DANGER_MARGIN) return 0;
  return 1 - Math.max(0, margin) / DANGER_MARGIN;
}

function drawDangerPulse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  proximity: number,
  frame: number
) {
  if (proximity <= 0) return;
  const dangerY = getDangerY(h);
  const pulse = 0.55 + 0.45 * Math.sin(frame * 0.14);
  const alpha = proximity * pulse * 0.55;

  ctx.save();
  const grad = ctx.createLinearGradient(0, dangerY - 50, 0, dangerY + 30);
  grad.addColorStop(0, 'rgba(255,0,0,0)');
  grad.addColorStop(0.55, `rgba(255,40,40,${alpha * 0.35})`);
  grad.addColorStop(1, `rgba(255,0,0,${alpha * 0.7})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, dangerY - 50, w, 80);

  ctx.strokeStyle = `rgba(255,80,80,${alpha})`;
  ctx.lineWidth = 2 + proximity * 2;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(0, dangerY);
  ctx.lineTo(w, dangerY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawScreenFlash(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,220,120,${alpha})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawSpecialTelegraph(
  ctx: CanvasRenderingContext2D,
  zones: { x: number; y: number; r: number; kind: string }[],
  intensity: number,
  frame: number
) {
  if (zones.length === 0) return;
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.18);
  const colors: Record<string, string> = {
    bomb: '255,100,0',
    rainbow: '200,100,255',
    lightning: '0,180,255',
    freeze: '136,221,255',
  };

  ctx.save();
  zones.forEach((z) => {
    const rgb = colors[z.kind] ?? '255,255,255';
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r * (0.92 + pulse * 0.08), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${0.08 * intensity + pulse * 0.06})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${0.25 * intensity + pulse * 0.35})`;
    ctx.lineWidth = 1.5 + intensity;
    ctx.setLineDash(z.kind === 'lightning' ? [4, 4] : []);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTutorialAimGuide(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  aimPts: { x: number; y: number }[],
  frame: number
) {
  if (aimPts.length === 0) return;
  const pulse = 0.45 + 0.55 * Math.sin(frame * 0.11);

  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = `rgba(255,220,80,${0.35 + pulse * 0.45})`;
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#FFCC00';
  ctx.beginPath();
  ctx.moveTo(sx, sy - BUBBLE_RADIUS);
  aimPts.forEach((pt) => ctx.lineTo(pt.x, pt.y));
  ctx.stroke();
  ctx.setLineDash([]);

  const tip = aimPts[Math.min(2, aimPts.length - 1)];
  const prev = aimPts[Math.min(1, aimPts.length - 1)] ?? { x: sx, y: sy };
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const arrowLen = 14 + pulse * 6;

  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const ax = tip.x - Math.cos(angle) * arrowLen * t;
    const ay = tip.y - Math.sin(angle) * arrowLen * t;
    ctx.globalAlpha = (1 - t) * pulse;
    ctx.fillStyle = '#FFCC00';
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(angle) * 10, ay + Math.sin(angle) * 10);
    ctx.lineTo(ax + Math.cos(angle + 2.6) * 7, ay + Math.sin(angle + 2.6) * 7);
    ctx.lineTo(ax + Math.cos(angle - 2.6) * 7, ay + Math.sin(angle - 2.6) * 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCannonNozzle(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  angle: number,
  color: string,
  glowPulse: number
) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const bubbleR = BUBBLE_RADIUS * 1.1;
  const barrelLen = 30;
  const startX = sx + cos * bubbleR * 0.75;
  const startY = sy + sin * bubbleR * 0.75;
  const endX = sx + cos * (bubbleR + barrelLen);
  const endY = sy + sin * (bubbleR + barrelLen);
  const tipX = sx + cos * (bubbleR + barrelLen + 10);
  const tipY = sy + sin * (bubbleR + barrelLen + 10);
  const perpX = -sin;
  const perpY = cos;

  ctx.save();

  // Корпус ствола
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 11;
  ctx.shadowBlur = 14 * glowPulse;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const barrelGrad = ctx.createLinearGradient(startX, startY, endX, endY);
  barrelGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
  barrelGrad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
  barrelGrad.addColorStop(1, color);
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 5;
  ctx.strokeStyle = barrelGrad;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Кольцо-муфта у основания наконечника
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = shadeHex(color, -30);
  ctx.beginPath();
  ctx.arc(endX, endY, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Воронкообразный наконечник
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  const nozzleW = 6.5;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(endX + perpX * nozzleW, endY + perpY * nozzleW);
  ctx.lineTo(endX - perpX * nozzleW, endY - perpY * nozzleW);
  ctx.closePath();
  const tipGrad = ctx.createLinearGradient(endX, endY, tipX, tipY);
  tipGrad.addColorStop(0, color);
  tipGrad.addColorStop(1, lightenHex(color, 40));
  ctx.fillStyle = tipGrad;
  ctx.fill();

  // Светящаяся точка на конце
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 6;
  ctx.shadowColor = '#fff';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function shadeHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function lightenHex(hex: string, amount: number): string {
  return shadeHex(hex, amount);
}

export default function GameCanvas({
  gameData,
  lang,
  onScoreUpdate,
  onGameOver,
  onLevelComplete,
  onBubblesPopped,
  onLevelStats,
  onConsecutiveHits,
  isPaused,
  onReserveColorChange,
  swapRef,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const stateRef = useRef({
    bubbles: [] as Bubble[],
    projectile: null as Projectile | null,
    nextColor: '',
    reserveColor: '',
    angle: -Math.PI / 2,
    particles: [] as ParticleEffect[],
    scorePopups: [] as ScorePopup[],
    score: 0,
    shotsLeft: getMaxShots(0),
    combo: 0,
    animFrame: 0 as ReturnType<typeof requestAnimationFrame>,
    canShoot: true,
    levelIdx: 0,
    comboTimer: 0,
    gameOverFired: false,
    levelCompleteFired: false,
    descentCounter: 0,
    frozenShots: 0,
    introProgress: 0,
    introFrame: 0,
    swapSpin: 0,
    endlessShotsTotal: 0,
    sessionMisses: 0,
    sessionMaxCombo: 0,
    consecutiveHits: 0,
    shotsFired: 0,
    hitStopFrames: 0,
    flashAlpha: 0,
  });
  const isPausedRef = useRef(isPaused);
  const gameSizeRef = useRef({ w: 400, h: 700 });

  const triggerShake = useCallback((intensity: number) => {
    shakeRef.current.intensity = Math.max(shakeRef.current.intensity, intensity);
  }, []);

  const triggerJuice = useCallback((combo: number, floatCount = 0) => {
    const s = stateRef.current;
    if (combo >= 3) {
      s.hitStopFrames = Math.max(s.hitStopFrames, combo >= 5 ? 6 : 5);
      s.flashAlpha = Math.max(s.flashAlpha, combo >= 5 ? 0.5 : 0.38);
      triggerShake(combo >= 5 ? 10 : 6);
    }
    if (floatCount >= 5) {
      s.hitStopFrames = Math.max(s.hitStopFrames, 4);
      s.flashAlpha = Math.max(s.flashAlpha, 0.28);
      triggerShake(7);
    }
  }, [triggerShake]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const initLevel = useCallback((canvasW: number, resetScore = true) => {
    const s = stateRef.current;
    s.levelIdx = gameData.level;
    if (resetScore) s.score = gameData.score;
    s.shotsLeft = getMaxShots(gameData.level);
    s.combo = 0;
    s.particles = [];
    s.scorePopups = [];
    s.projectile = null;
    s.canShoot = true;
    s.gameOverFired = false;
    s.levelCompleteFired = false;
    s.descentCounter = 0;
    s.frozenShots = 0;
    s.introProgress = 0;
    s.introFrame = 0;
    s.endlessShotsTotal = 0;
    s.sessionMisses = 0;
    s.sessionMaxCombo = 0;
    s.consecutiveHits = 0;
    s.shotsFired = 0;
    s.hitStopFrames = 0;
    s.flashAlpha = 0;
    s.bubbles = generateGrid(s.levelIdx, canvasW, TOP_OFFSET);
    if (s.levelIdx === 0) {
      s.nextColor = TUTORIAL_SHOOT_COLOR;
      s.reserveColor = '#007AFF';
      const target = s.bubbles.find((b) => b.row === 3 && b.col === 4);
      if (target) {
        const sy = gameSizeRef.current.h - SHOOTER_FROM_BOTTOM;
        const sx = gameSizeRef.current.w / 2;
        let angle = Math.atan2(target.y - sy, target.x - sx);
        angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, angle));
        s.angle = angle;
      }
    } else {
      s.nextColor = randomColor(s.levelIdx);
      s.reserveColor = randomColor(s.levelIdx);
    }
    onReserveColorChange?.(s.reserveColor);
  }, [gameData.level, onReserveColorChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width > 0 ? canvas.width : 400;
    initLevel(w, true);
  }, [gameData.level, initLevel]);

  const getShooterPos = useCallback(() => {
    const { w, h } = gameSizeRef.current;
    return { x: w / 2, y: h - SHOOTER_FROM_BOTTOM };
  }, []);

  const swapBubble = useCallback(() => {
    const s = stateRef.current;
    if (!s.canShoot || s.projectile?.active) return;
    const tmp = s.nextColor;
    s.nextColor = s.reserveColor;
    s.reserveColor = tmp;
    s.swapSpin = 1;
    onReserveColorChange?.(s.reserveColor);
  }, [onReserveColorChange]);

  useEffect(() => {
    if (swapRef) swapRef.current = swapBubble;
    return () => { if (swapRef) swapRef.current = null; };
  }, [swapRef, swapBubble]);

  const shoot = useCallback(() => {
    const s = stateRef.current;
    if (!s.canShoot || s.shotsLeft <= 0 || isPausedRef.current) return;

    const { x, y } = getShooterPos();
    const angle = s.angle;
    if (Math.sin(angle) > -0.05) return;

    s.projectile = {
      x,
      y,
      vx: Math.cos(angle) * BUBBLE_SPEED,
      vy: Math.sin(angle) * BUBBLE_SPEED,
      color: s.nextColor,
      active: true,
    };
    s.shotsLeft--;
    s.shotsFired++;
    s.canShoot = false;
    s.nextColor = s.reserveColor;
    s.reserveColor = randomColor(s.levelIdx);
    onReserveColorChange?.(s.reserveColor);
    sound.playShoot();
  }, [getShooterPos, onReserveColorChange]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        swapBubble();
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stateRef.current.angle = Math.max(-Math.PI + 0.12, stateRef.current.angle - 0.087);
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        stateRef.current.angle = Math.min(-0.12, stateRef.current.angle + 0.087);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [swapBubble]);

  const callbacksRef = useRef({
    onGameOver, onLevelComplete, onScoreUpdate, onBubblesPopped, onLevelStats, onConsecutiveHits,
  });
  useEffect(() => {
    callbacksRef.current = {
      onGameOver, onLevelComplete, onScoreUpdate, onBubblesPopped, onLevelStats, onConsecutiveHits,
    };
  }, [onGameOver, onLevelComplete, onScoreUpdate, onBubblesPopped, onLevelStats, onConsecutiveHits]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const area = canvas.closest('[data-game-area]') as HTMLElement | null;
      const areaW = area?.clientWidth ?? canvas.parentElement?.clientWidth ?? 400;
      const areaH = area?.clientHeight ?? window.innerHeight * 0.55;
      const maxW = Math.min(areaW, 480);
      const maxH = Math.min(Math.max(areaH - 50, 300), 780);
      const ratio = Math.min(maxW / 400, maxH / 700);
      const newW = Math.floor(400 * ratio);
      const newH = Math.floor(700 * ratio);
      canvas.width = newW;
      canvas.height = newH;
      canvas.style.width = newW + 'px';
      canvas.style.height = newH + 'px';
      gameSizeRef.current = { w: newW, h: newH };
      const s = stateRef.current;
      s.bubbles = generateGrid(s.levelIdx, newW, TOP_OFFSET);
    };

    resize();
    window.addEventListener('resize', resize);
    const ctx = canvas.getContext('2d')!;

    let frame = 0;

    function popBubbles(bubbles: Bubble[], w: number, shooterColor: string) {
      const s = stateRef.current;
      let totalPopped = 0;

      bubbles.forEach((b) => {
        b.popping = true;
        b.popFrame = 0;
        s.particles.push(...spawnParticles(b.x, b.y, b.color, 12));
        sound.playPop(b.color);

        if (b.special) {
          sound.playSpecial(b.special);
          const effect = applySpecialEffect(b, s.bubbles, shooterColor, w);
          if (effect.frozenShots) s.frozenShots += effect.frozenShots;
          effect.removed.forEach((eb) => {
            if (!eb.popping) {
              eb.popping = true;
              eb.popFrame = 0;
              s.particles.push(...spawnParticles(eb.x, eb.y, eb.color, 8));
              sound.playPop(eb.color);
              totalPopped++;
            }
          });
        }
        totalPopped++;
      });

      callbacksRef.current.onBubblesPopped?.(totalPopped);
      return totalPopped;
    }

    const loop = () => {
      stateRef.current.animFrame = requestAnimationFrame(loop);
      frame++;

      const s = stateRef.current;
      const { w, h } = gameSizeRef.current;

      if (s.introFrame < INTRO_FRAMES) {
        s.introFrame++;
        s.introProgress = s.introFrame / INTRO_FRAMES;
      }

      if (s.swapSpin > 0) s.swapSpin = Math.max(0, s.swapSpin - 0.08);

      if (s.flashAlpha > 0) s.flashAlpha *= 0.78;

      const physicsActive = s.hitStopFrames <= 0 && !isPausedRef.current;
      if (s.hitStopFrames > 0) s.hitStopFrames--;

      if (physicsActive) {
        if (s.projectile?.active) {
          const p = s.projectile;
          p.x += p.vx;
          p.y += p.vy;

          if (p.x - BUBBLE_RADIUS < 0) { p.x = BUBBLE_RADIUS; p.vx = -p.vx; }
          else if (p.x + BUBBLE_RADIUS > w) { p.x = w - BUBBLE_RADIUS; p.vx = -p.vx; }

          if (p.y - BUBBLE_RADIUS < TOP_OFFSET) {
            p.y = TOP_OFFSET + BUBBLE_RADIUS;
            const snap = snapToGrid(p, null, s.bubbles, w, TOP_OFFSET);
            if (snap) addBubbleToGrid(snap.row, snap.col, snap.x, snap.y, p.color, w, h);
            p.active = false;
            finishShot(w, h);
          } else {
            const hit = checkCollision(p, s.bubbles);
            if (hit) {
              const snap = snapToGrid(p, hit, s.bubbles, w, TOP_OFFSET);
              if (snap) addBubbleToGrid(snap.row, snap.col, snap.x, snap.y, p.color, w, h);
              p.active = false;
              finishShot(w, h);
            } else if (p.y > h + 50) {
              p.active = false;
              finishShot(w, h);
            }
          }
        }

        s.bubbles.forEach((b) => {
          if (b.popping) b.popFrame = (b.popFrame || 0) + 1;
          if (b.falling) {
            b.vy = (b.vy || 0) + 0.45;
            b.y += b.vy!;
            b.alpha = Math.max(0, (b.alpha || 1) - 0.025);
          }
        });
        s.bubbles = s.bubbles.filter(
          (b) => !(b.popping && (b.popFrame || 0) > 14) && !(b.falling && b.y > h + 120)
        );

        s.particles = s.particles.filter((p) => {
          p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
          return p.life > 0;
        });

        s.scorePopups = s.scorePopups.filter((sp) => {
          sp.y -= 1.2;
          sp.life--;
          return sp.life > 0;
        });

        if (s.comboTimer > 0) s.comboTimer--;
        if (s.comboTimer === 0 && s.combo > 0) s.combo = 0;
      }

      drawAll(ctx, w, h, s, frame);
    };

    function addBubbleToGrid(row: number, col: number, x: number, y: number, color: string, w: number, h: number) {
      const s = stateRef.current;
      const occupied = s.bubbles.some((b) => !b.popping && !b.falling && b.row === row && b.col === col);
      if (occupied) return;

      const newBubble: Bubble = { x, y, color, row, col };
      s.bubbles.push(newBubble);

      const matches = findMatches(row, col, color, s.bubbles);
      if (matches.length >= MIN_MATCH) {
        popBubbles(matches, w, color);

        s.combo++;
        s.comboTimer = 180;
        s.consecutiveHits++;
        s.sessionMaxCombo = Math.max(s.sessionMaxCombo, s.combo);
        callbacksRef.current.onConsecutiveHits?.(s.consecutiveHits);
        if (s.combo > 1) sound.playCombo(s.combo);
        if (matches.length >= 5) triggerJuice(3);
        else triggerJuice(s.combo);

        const comboBonus = s.combo > 1 ? Math.pow(COMBO_MULTIPLIER, s.combo - 1) : 1;
        const earned = Math.floor(matches.length * POINTS_PER_BUBBLE * comboBonus);
        s.score += earned;

        const cx = matches.reduce((sum, b) => sum + b.x, 0) / matches.length;
        const cy = matches.reduce((sum, b) => sum + b.y, 0) / matches.length;
        s.scorePopups.push({ x: cx, y: cy, value: earned, life: 55, maxLife: 55, combo: s.combo });

        if (matches.length >= MIN_MATCH && navigator.vibrate) {
          navigator.vibrate(s.combo > 2 ? [50, 20, 50] : 30);
        }

        setTimeout(() => {
          const floating = findFloating(stateRef.current.bubbles);
          if (floating.length > 0) {
            const floatScore = floating.length * POINTS_PER_BUBBLE;
            stateRef.current.score += floatScore;
            floating.forEach((b) => {
              b.falling = true; b.vy = -1.5; b.alpha = 1;
              stateRef.current.particles.push(...spawnParticles(b.x, b.y, b.color, 6));
              sound.playPop(b.color);
            });
            callbacksRef.current.onBubblesPopped?.(floating.length);
            triggerJuice(0, floating.length);
            if (floating.length >= 3) {
              const fcx = floating.reduce((sum, b) => sum + b.x, 0) / floating.length;
              const fcy = floating.reduce((sum, b) => sum + b.y, 0) / floating.length;
              stateRef.current.scorePopups.push({ x: fcx, y: fcy, value: floatScore, life: 55, maxLife: 55, combo: 0 });
            }
          }
          checkWin(w, h);
          callbacksRef.current.onScoreUpdate(stateRef.current.score, stateRef.current.combo, stateRef.current.shotsLeft);
        }, 250);
      } else {
        s.combo = 0;
        s.sessionMisses++;
        s.consecutiveHits = 0;
      }

      checkLoose(h);
      callbacksRef.current.onScoreUpdate(s.score, s.combo, s.shotsLeft);
    }

    function checkLoose(h: number) {
      const s = stateRef.current;
      if (s.gameOverFired) return;
      const active = s.bubbles.filter((b) => !b.popping && !b.falling);
      const lowest = active.reduce((max, b) => (b.y > max ? b.y : max), 0);
      if (lowest > getDangerY(h)) {
        s.gameOverFired = true;
        sound.playGameOver();
        setTimeout(() => callbacksRef.current.onGameOver(), 600);
      }
    }

    function checkWin(_w: number, _h: number) {
      const s = stateRef.current;
      if (s.levelCompleteFired) return;
      const remaining = s.bubbles.filter((b) => !b.popping && !b.falling).length;
      if (remaining === 0) {
        s.levelCompleteFired = true;
        const shotBonus = s.shotsLeft * 50;
        s.score += shotBonus;
        const maxShots = getMaxShots(s.levelIdx);
        const stars = s.shotsLeft > Math.floor(maxShots * 0.5)
          ? 3
          : s.shotsLeft > Math.floor(maxShots * 0.25)
          ? 2
          : 1;
        sound.playLevelComplete();
        callbacksRef.current.onLevelStats?.({
          misses: s.sessionMisses,
          maxCombo: s.sessionMaxCombo,
          consecutiveHits: s.consecutiveHits,
        });
        callbacksRef.current.onScoreUpdate(s.score, s.combo, s.shotsLeft);
        setTimeout(() => callbacksRef.current.onLevelComplete(stars), 700);
      }
    }

    function finishShot(w: number, h: number) {
      const s = stateRef.current;
      s.descentCounter++;
      s.endlessShotsTotal++;

      const isEndless = s.levelIdx === ENDLESS_LEVEL_IDX;

      if (isEndless) {
        if (s.endlessShotsTotal % ENDLESS_SHOTS_PER_WAVE === 0) {
          s.bubbles = addNewRowOnTop(s.bubbles, s.levelIdx, w, TOP_OFFSET);
          if (getMaxRow(s.bubbles) >= MAX_GRID_ROWS) {
            s.gameOverFired = true;
            sound.playGameOver();
            setTimeout(() => callbacksRef.current.onGameOver(), 600);
            return;
          }
          checkLoose(h);
        }
        s.shotsLeft = ENDLESS_SHOTS_PER_WAVE;
        setTimeout(() => { s.canShoot = true; }, 180);
        callbacksRef.current.onScoreUpdate(s.score, s.combo, s.shotsLeft);
        return;
      }

      if (s.frozenShots > 0) {
        s.frozenShots--;
      } else if (s.descentCounter % 8 === 0) {
        const descendY = BUBBLE_RADIUS * 1.73;
        s.bubbles.forEach((b) => {
          if (!b.popping && !b.falling) b.y += descendY;
        });
        checkLoose(h);
      }

      if (s.shotsLeft <= 0) {
        setTimeout(() => {
          const remaining = stateRef.current.bubbles.filter((b) => !b.popping && !b.falling).length;
          if (remaining > 0 && !stateRef.current.gameOverFired && !stateRef.current.levelCompleteFired) {
            stateRef.current.gameOverFired = true;
            sound.playGameOver();
            callbacksRef.current.onGameOver();
          }
        }, 900);
        return;
      }
      setTimeout(() => { s.canShoot = true; }, 180);
    }

    function drawAll(ctx: CanvasRenderingContext2D, w: number, h: number, s: typeof stateRef.current, frameNum: number) {
      ctx.save();

      const shake = shakeRef.current;
      if (shake.intensity > 0) {
        shake.x = (Math.random() - 0.5) * shake.intensity;
        shake.y = (Math.random() - 0.5) * shake.intensity;
        shake.intensity *= 0.75;
        if (shake.intensity < 0.1) shake.intensity = 0;
        ctx.translate(shake.x, shake.y);
      }

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(180,100,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, TOP_OFFSET);
      ctx.lineTo(w, TOP_OFFSET);
      ctx.stroke();
      ctx.setLineDash([]);

      const dangerProx = getDangerProximity(h, s.bubbles);
      drawDangerPulse(ctx, w, h, dangerProx, frameNum);

      const { x: sx, y: sy } = getShooterPos();
      const showTutorialAim = s.levelIdx === 0 && s.shotsFired < 2;
      let aimPts: { x: number; y: number }[] = [];

      if (s.canShoot && !s.projectile?.active) {
        aimPts = getAimPoints(sx, sy, s.angle, w, h, showTutorialAim ? 8 : 5);
        if (!showTutorialAim && aimPts.length > 0) {
          ctx.setLineDash([6, 10]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.moveTo(sx, sy - BUBBLE_RADIUS);
          aimPts.forEach((pt) => ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Телеграф спец-пузырей: слабый пульс всегда, яркий при наведении прицела
      const aimedSpecial = s.canShoot && !s.projectile?.active
        ? findAimedSpecialBubble(sx, sy, s.angle, w, h, s.bubbles)
        : null;
      s.bubbles.forEach((b) => {
        if (!b.special || b.popping || b.falling) return;
        const isTarget = aimedSpecial === b;
        const zones = getSpecialTelegraph(b, s.bubbles, s.nextColor, w, TOP_OFFSET);
        drawSpecialTelegraph(ctx, zones, isTarget ? 1 : 0.35, frameNum);
      });

      const sortedBubbles = [...s.bubbles].sort((a, b) => a.row - b.row);
      sortedBubbles.forEach((b, idx) => {
        const introAlpha = s.introProgress < 1
          ? Math.min(1, Math.max(0, s.introProgress * 2 - idx * 0.04))
          : 1;
        const introOffset = s.introProgress < 1
          ? (1 - easeOutBounce(s.introProgress)) * -200
          : 0;
        const drawY = b.y + introOffset;
        const alpha = (b.alpha ?? 1) * introAlpha;

        if (b.popping) {
          drawPopAnimation(ctx, b.x, drawY, b.color, b.popFrame || 0, 12, b.special);
        } else if (b.falling) {
          drawBubble(ctx, b.x, drawY, b.color, BUBBLE_RADIUS, alpha, 0, b.special, frameNum);
        } else {
          drawBubble(ctx, b.x, drawY, b.color, BUBBLE_RADIUS, alpha, 0, b.special, frameNum);
        }
      });

      if (s.projectile?.active) {
        const p = s.projectile;
        drawBubble(ctx, p.x, p.y, p.color, BUBBLE_RADIUS, 1, 1.2);
        ctx.save();
        ctx.globalAlpha = 0.25;
        for (let t = 1; t <= 3; t++) {
          drawBubble(ctx, p.x - p.vx * t * 0.4, p.y - p.vy * t * 0.4, p.color, BUBBLE_RADIUS * (1 - t * 0.15), 1 - t * 0.2);
        }
        ctx.restore();
      }

      s.particles.forEach((p) => drawParticle(ctx, p));

      s.scorePopups.forEach((sp) => {
        const alpha = sp.life / sp.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.floor(w * 0.045)}px Arial`;
        if (sp.combo > 1) {
          ctx.fillStyle = '#FFCC00';
          ctx.shadowColor = '#FF9500';
          ctx.shadowBlur = 10;
          ctx.fillText(`🔥 +${sp.value.toLocaleString()}`, sp.x, sp.y);
        } else {
          ctx.fillStyle = '#fff';
          ctx.shadowColor = '#AF52DE';
          ctx.shadowBlur = 8;
          ctx.fillText(`+${sp.value.toLocaleString()}`, sp.x, sp.y);
        }
        ctx.restore();
      });

      const { x: sx2, y: sy2 } = getShooterPos();
      const platGrad = ctx.createLinearGradient(sx2 - 60, 0, sx2 + 60, 0);
      platGrad.addColorStop(0, 'rgba(138,43,226,0)');
      platGrad.addColorStop(0.5, 'rgba(138,43,226,0.4)');
      platGrad.addColorStop(1, 'rgba(138,43,226,0)');
      ctx.fillStyle = platGrad;
      ctx.fillRect(sx2 - 60, sy2 + BUBBLE_RADIUS + 3, 120, 2);

      const glowPulse = 0.4 + 0.3 * Math.sin(frameNum * 0.08);
      const shooterSpin = s.swapSpin * Math.PI * 2;
      ctx.save();
      ctx.translate(sx2, sy2);
      ctx.rotate(shooterSpin);
      drawBubble(ctx, 0, 0, s.nextColor, BUBBLE_RADIUS * 1.1, 1, glowPulse);
      ctx.restore();

      drawCannonNozzle(ctx, sx2, sy2, s.angle, s.nextColor, glowPulse);

      if (showTutorialAim && aimPts.length > 0) {
        drawTutorialAimGuide(ctx, sx2, sy2, aimPts, frameNum);
      }

      if (s.frozenShots > 0) {
        ctx.font = `bold ${Math.floor(w * 0.03)}px Arial`;
        ctx.fillStyle = '#88ddff';
        ctx.textAlign = 'center';
        ctx.fillText(`❄️ ${s.frozenShots}`, sx2, sy2 - BUBBLE_RADIUS * 2);
      }

      const maxShots = getMaxShots(s.levelIdx);
      const barW = w * 0.45;
      const barH = 5;
      const barX = sx2 - barW / 2;
      const barY = h - 28;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();
      ctx.fillStyle = s.nextColor;
      ctx.shadowBlur = 6;
      ctx.shadowColor = s.nextColor;
      ctx.beginPath();
      const shotRatio = s.levelIdx === ENDLESS_LEVEL_IDX
        ? (ENDLESS_SHOTS_PER_WAVE - (s.endlessShotsTotal % ENDLESS_SHOTS_PER_WAVE)) / ENDLESS_SHOTS_PER_WAVE
        : s.shotsLeft / maxShots;
      ctx.roundRect(barX, barY, barW * shotRatio, barH, 3);
      ctx.fill();

      drawScreenFlash(ctx, w, h, s.flashAlpha);

      ctx.restore();
    }

    stateRef.current.animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(stateRef.current.animFrame);
      window.removeEventListener('resize', resize);
    };
  }, [getShooterPos, triggerShake, triggerJuice]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const { x: sx, y: sy } = getShooterPos();
    let angle = Math.atan2(y - sy, x - sx);
    angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, angle));
    stateRef.current.angle = angle;
  }, [getShooterPos]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.touches[0].clientX - rect.left) * scaleX;
    const y = (e.touches[0].clientY - rect.top) * scaleY;
    const { x: sx, y: sy } = getShooterPos();
    let angle = Math.atan2(y - sy, x - sx);
    angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, angle));
    stateRef.current.angle = angle;
  }, [getShooterPos]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center min-h-0">
      <canvas
        ref={canvasRef}
        className="touch-none cursor-crosshair rounded-2xl shadow-2xl"
        style={{ display: 'block', margin: '0 auto', boxShadow: '0 0 40px rgba(138,43,226,0.3)', background: 'transparent' }}
        onPointerMove={handlePointerMove}
        onClick={() => shoot()}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => { e.preventDefault(); shoot(); }}
      />
      <button
        type="button"
        onClick={() => shoot()}
        className="mt-2 w-full max-w-[200px] bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-2.5 rounded-xl border border-white/20 active:scale-95 transition-all text-sm md:hidden"
      >
        🎯 {t('shoot', lang)}
      </button>
    </div>
  );
}
