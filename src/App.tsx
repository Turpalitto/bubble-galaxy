import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BUBBLE_RADIUS, BUBBLE_SPEED, LEVELS, ENDLESS_LEVEL_IDX, DAILY_LEVEL_IDX,
  MAX_GRID_ROWS, ENDLESS_SHOTS_PER_WAVE, TOP_OFFSET, SHOOTER_FROM_BOTTOM, INTRO_FRAMES,
  MIN_MATCH, POINTS_PER_BUBBLE, COMBO_MULTIPLIER, TUTORIAL_SHOOT_COLOR,
} from './game/constants';
import {
  generateGrid, repositionBubbles, getDangerY, getDangerProximity,
  pickShooterColor, getMaxShots, getLevelLabel, applySpecialEffect,
  addNewRowOnTop, getMaxRow, checkCollision, snapToGrid,
  findMatches, findFloating, spawnParticles,
  drawBubble, drawPopAnimation, drawParticle, drawSpecialTelegraph,
  getSpecialTelegraph, findAimedSpecialBubble, getAimPoints,
  drawDangerPulse, drawCannonNozzle, drawScreenFlash, drawTutorialAimGuide,
  easeOutBounce, isDailyCompleted, markDailyCompleted,
} from './game/engine';
import type { Bubble, Projectile, ParticleEffect, ScorePopup, PlayerProgress } from './game/types';
import {
  initYandexSdk, signalLoadingReady, gameplayStart, gameplayStop, getSdkLang,
  loadPlayerData, savePlayerData, subscribeToSdkEvents, unsubscribeFromSdkEvents,
  showFullscreenAd, showRewardedAd, setupPlatformGuards,
  showStickyBanner, hideStickyBanner,
} from './utils/yandexSdk';
import { sound } from './utils/sound';

// ─── i18n ──────────────────────────────────────────────────────────────────
type LangKey = 'ru' | 'en' | 'tr';
const T: Record<string, Record<LangKey, string>> = {
  play: { ru: 'Играть', en: 'Play', tr: 'Oyna' },
  endless: { ru: 'Бесконечный', en: 'Endless', tr: 'Sonsuz' },
  daily: { ru: 'Уровень дня', en: 'Daily Level', tr: 'Günlük Seviye' },
  dailyDone: { ru: 'Пройден ✓', en: 'Completed ✓', tr: 'Tamamlandı ✓' },
  level: { ru: 'Уровень', en: 'Level', tr: 'Seviye' },
  shots: { ru: 'Выстрелы', en: 'Shots', tr: 'Atışlar' },
  pause: { ru: 'Пауза', en: 'Pause', tr: 'Duraklat' },
  resume: { ru: 'Продолжить', en: 'Resume', tr: 'Devam' },
  menu: { ru: 'Меню', en: 'Menu', tr: 'Menü' },
  restart: { ru: 'Заново', en: 'Restart', tr: 'Yeniden' },
  gameOver: { ru: 'Игра окончена', en: 'Game Over', tr: 'Oyun Bitti' },
  levelComplete: { ru: 'Уровень пройден!', en: 'Level Complete!', tr: 'Seviye Tamamlandı!' },
  nextLevel: { ru: 'Далее', en: 'Next', tr: 'İleri' },
  watchAdForShots: { ru: '🎬 +5 за рекламу', en: '🎬 +5 for ad', tr: '🎬 Reklam için +5' },
  highScore: { ru: 'Рекорд', en: 'High Score', tr: 'En Yüksek Skor' },
  campaign: { ru: 'Кампания', en: 'Campaign', tr: 'Kampanya' },
  howToPlay: { ru: 'Стреляй пузырями, собирай 3+ в ряд!', en: 'Shoot bubbles, match 3+!', tr: 'Baloncuk fırlat, 3+ eşleştir!' },
  endlessDesc: { ru: 'Бесконечные волны пузырей', en: 'Endless bubble waves', tr: 'Sonsuz baloncuk dalgaları' },
  dailyDesc: { ru: 'Новый уровень каждый день', en: 'New level every day', tr: 'Her gün yeni seviye' },
  sound: { ru: 'Звук', en: 'Sound', tr: 'Ses' },
};
function t(key: string, lang: LangKey): string {
  return T[key]?.[lang] ?? T[key]?.['en'] ?? key;
}
function detectLang(): LangKey {
  const s = getSdkLang();
  if (s) { const l = s.toLowerCase(); if (l.startsWith('ru') || l.startsWith('uk') || l.startsWith('be')) return 'ru'; if (l.startsWith('tr')) return 'tr'; }
  const n = navigator.language?.toLowerCase() ?? '';
  if (n.startsWith('ru') || n.startsWith('uk') || n.startsWith('be')) return 'ru';
  if (n.startsWith('tr')) return 'tr';
  return 'en';
}

const DEFAULT_PROGRESS: PlayerProgress = {
  highScore: 0, unlockedLevels: 1, levelStars: [], totalBubblesPopped: 0,
  achievements: [], campaignComplete: false, endlessHighScore: 0,
};

type Overlay = 'none' | 'paused' | 'gameOver' | 'levelComplete';

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'playing'>('menu');
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [hud, setHud] = useState({ score: 0, shotsLeft: 20, combo: 0, levelLabel: '1', levelIdx: 0 });
  const [stars, setStars] = useState(0);
  const [progress, setProgress] = useState<PlayerProgress>(DEFAULT_PROGRESS);
  const [lang, setLang] = useState<LangKey>('en');
  const [isMuted, setIsMuted] = useState(false);
  const [gameTick, setGameTick] = useState(0);

  // ─── Refs — всё что нужно игровому циклу ────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const swapRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const screenRef = useRef<'menu' | 'playing'>('menu');
  const overlayRef = useRef<Overlay>('none');
  const loadingSignaledRef = useRef(false);
  const progressRef = useRef(progress);
  const sizeRef = useRef({ w: 400, h: 700 });

  // Вся игровая логика — в одном ref, чтобы не зависеть от замыканий React
  const gRef = useRef<{
    bubbles: Bubble[];
    projectile: Projectile | null;
    nextColor: string;
    reserveColor: string;
    angle: number;
    particles: ParticleEffect[];
    scorePopups: ScorePopup[];
    score: number;
    shotsLeft: number;
    combo: number;
    comboTimer: number;
    animFrame: number;
    canShoot: boolean;
    levelIdx: number;
    gameOverFired: boolean;
    levelCompleteFired: boolean;
    descentCounter: number;
    frozenShots: number;
    introProgress: number;
    introFrame: number;
    swapSpin: number;
    endlessShotsTotal: number;
    sessionMisses: number;
    sessionMaxCombo: number;
    consecutiveHits: number;
    shotsFired: number;
    hitStopFrames: number;
    flashAlpha: number;
    shakeIntensity: number;
  } | null>(null);

  // Синхронизируем refs
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { overlayRef.current = overlay; }, [overlay]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  useEffect(() => {
    if (loadingSignaledRef.current) return;
    loadingSignaledRef.current = true;
    requestAnimationFrame(() => signalLoadingReady());
  }, []);

  // ─── SDK Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    setupPlatformGuards();
    initYandexSdk().then(() => {
      showStickyBanner();
      setLang(detectLang());
      loadProgressFn();
    }).catch(() => {
      setLang(detectLang());
      loadProgressFn();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        sound.pause();
        gameplayStop();
      } else {
        if (!sound.isMuted()) sound.resume();
        if (screenRef.current === 'playing' && overlayRef.current === 'none') {
          gameplayStart();
        }
      }
    });

    subscribeToSdkEvents({
      onPause: () => {
        sound.pause();
        // п.4.7 — ВСЕГДА ставим физику на паузу при рекламе/сворачивании
        if (gRef.current) {
          pausedRef.current = true;
          gameplayStop();
        }
        // Показываем оверлей паузы только если игрок был в активной игре
        if (overlayRef.current === 'none') {
          setOverlay('paused');
        }
      },
      onResume: () => {
        if (!sound.isMuted()) sound.resume();
        // Снимаем паузу только если игрок сам не ставил на паузу
        if (overlayRef.current === 'paused' && gRef.current) {
          pausedRef.current = false;
          overlayRef.current = 'none';
          setOverlay('none');
          gameplayStart();
        }
      },
    });

    return () => { unsubscribeFromSdkEvents(); };
  }, []);

  // ─── Progress load / save ──────────────────────────────────────────────
  async function loadProgressFn() {
    const cloud = await loadPlayerData(['progress']);
    if (cloud?.progress) {
      try { const p = typeof cloud.progress === 'string' ? JSON.parse(cloud.progress) : cloud.progress; setProgress(p as PlayerProgress); } catch { /* */ }
    } else {
      const local = localStorage.getItem('bubbleGalaxyProgress');
      if (local) try { setProgress(JSON.parse(local)); } catch { /* */ }
    }
  }

  async function saveProgressFn(p: PlayerProgress) {
    setProgress(p);
    progressRef.current = p;
    localStorage.setItem('bubbleGalaxyProgress', JSON.stringify(p));
    savePlayerData({ progress: JSON.stringify(p) });
  }

  // ─── Start game ────────────────────────────────────────────────────────
  const startGame = useCallback((idx: number) => {
    hideStickyBanner();
    // Если уже есть запущенный цикл — останавливаем
    if (gRef.current) {
      cancelAnimationFrame(gRef.current.animFrame);
    }

    const g = {
      bubbles: [] as Bubble[],
      projectile: null as Projectile | null,
      nextColor: '',
      reserveColor: '',
      angle: -Math.PI / 2,
      particles: [] as ParticleEffect[],
      scorePopups: [] as ScorePopup[],
      score: 0,
      shotsLeft: getMaxShots(idx),
      combo: 0,
      comboTimer: 0,
      animFrame: 0 as ReturnType<typeof requestAnimationFrame>,
      canShoot: true,
      levelIdx: idx,
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
      shakeIntensity: 0,
    };
    gRef.current = g;
    pausedRef.current = false;
    overlayRef.current = 'none';

    setScreen('playing');
    setOverlay('none');
    setHud({ score: 0, shotsLeft: getMaxShots(idx), combo: 0, levelLabel: getLevelLabel(idx), levelIdx: idx });
    gameplayStart();
    setGameTick(k => k + 1);
  }, []);

  // ─── Swap bubbles ──────────────────────────────────────────────────────
  const swapBubble = useCallback(() => {
    const g = gRef.current;
    if (!g || !g.canShoot || g.projectile?.active || overlayRef.current !== 'none') return;
    const tmp = g.nextColor; g.nextColor = g.reserveColor; g.reserveColor = tmp;
    g.swapSpin = 1;
    sound.playClick();
  }, []);

  useEffect(() => { swapRef.current = swapBubble; }, [swapBubble]);

  // ─── Toggle sound ──────────────────────────────────────────────────────
  const toggleSound = useCallback(() => { setIsMuted(sound.toggleMute()); }, []);

  // ─── Pause / Resume / Menu ─────────────────────────────────────────────
  const handlePause = useCallback(() => {
    if (overlayRef.current !== 'none') return;
    pausedRef.current = true;
    overlayRef.current = 'paused';
    setOverlay('paused');
    gameplayStop();
    sound.pause();
  }, []);

  const handleResume = useCallback(() => {
    pausedRef.current = false;
    overlayRef.current = 'none';
    setOverlay('none');
    gameplayStart();
    if (!sound.isMuted()) sound.resume();
  }, []);

  const handleMenu = useCallback(() => {
    if (gRef.current) cancelAnimationFrame(gRef.current.animFrame);
    gRef.current = null;
    setScreen('menu');
    setOverlay('none');
    gameplayStop();
    loadProgressFn();
    showStickyBanner();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // ─── GAME LOOP — запускается один раз при screen='playing' ────────────
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (screen !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;

    // ─── Resize ──────────────────────────────────────────────────────
    const resize = () => {
      const area = gameAreaRef.current;
      const areaW = area?.clientWidth ?? window.innerWidth;
      const areaH = area?.clientHeight ?? window.innerHeight - 40;
      const maxW = Math.min(areaW, 480);
      const maxH = Math.min(Math.max(areaH, 300), 800);
      const ratio = Math.min(maxW / 400, maxH / 700);
      const newW = Math.floor(400 * ratio);
      const newH = Math.floor(700 * ratio);
      canvas.width = newW;
      canvas.height = newH;
      canvas.style.width = newW + 'px';
      canvas.style.height = newH + 'px';
      sizeRef.current = { w: newW, h: newH };
      const g = gRef.current;
      if (g && g.bubbles.length > 0) repositionBubbles(g.bubbles, newW, TOP_OFFSET);
    };
    resize();
    window.addEventListener('resize', resize);

    // ─── Helpers ─────────────────────────────────────────────────────
    const shooterPos = () => {
      const { w, h } = sizeRef.current;
      return { x: w / 2, y: h - SHOOTER_FROM_BOTTOM };
    };

    function updateHud(g: typeof gRef.current) {
      if (!g) return;
      setHud({
        score: g.score,
        shotsLeft: g.shotsLeft,
        combo: g.combo,
        levelLabel: getLevelLabel(g.levelIdx),
        levelIdx: g.levelIdx,
      });
    }

    function triggerGameOver() {
      const g = gRef.current;
      if (!g) return;
      gameplayStop();
      pausedRef.current = true;
      overlayRef.current = 'gameOver';
      setOverlay('gameOver');

      let p = { ...progressRef.current };
      if (g.levelIdx === ENDLESS_LEVEL_IDX && g.score > p.endlessHighScore) p.endlessHighScore = g.score;
      if (g.score > p.highScore) p.highScore = g.score;
      saveProgressFn(p);

      showFullscreenAd({
        onOpen: () => sound.pause(),
        onClose: () => { if (!sound.isMuted()) sound.resume(); },
      });
    }

    function triggerLevelComplete(earnedStars: number) {
      const g = gRef.current;
      if (!g) return;
      gameplayStop();
      pausedRef.current = true;
      overlayRef.current = 'levelComplete';
      setOverlay('levelComplete');
      setStars(earnedStars);

      let p = { ...progressRef.current };
      const lvl = g.levelIdx;
      if (lvl < LEVELS.length) {
        if (!p.levelStars[lvl] || earnedStars > p.levelStars[lvl]) p.levelStars[lvl] = earnedStars;
        if (lvl + 1 >= p.unlockedLevels && lvl + 1 < LEVELS.length) p.unlockedLevels = lvl + 2;
        if (lvl >= LEVELS.length - 1) p.campaignComplete = true;
      }
      if (g.levelIdx === DAILY_LEVEL_IDX) markDailyCompleted();
      if (g.score > p.highScore) p.highScore = g.score;
      saveProgressFn(p);

      // Interstitial ad каждые 2 уровня кампании (кроме endless/daily)
      if (lvl !== ENDLESS_LEVEL_IDX && lvl !== DAILY_LEVEL_IDX && (lvl + 1) % 2 === 0) {
        showFullscreenAd({
          onOpen: () => sound.pause(),
          onClose: () => { if (!sound.isMuted()) sound.resume(); },
          onError: () => { if (!sound.isMuted()) sound.resume(); },
        });
      }
    }

    function checkWin() {
      const g = gRef.current!;
      if (g.levelCompleteFired) return;
      const remaining = g.bubbles.filter(b => !b.popping && !b.falling).length;
      if (remaining === 0) {
        g.levelCompleteFired = true;
        const shotBonus = g.shotsLeft * 50;
        g.score += shotBonus;
        const maxShots = getMaxShots(g.levelIdx);
        const earnedStars = g.shotsLeft > Math.floor(maxShots * 0.5) ? 3
          : g.shotsLeft > Math.floor(maxShots * 0.25) ? 2 : 1;
        sound.playLevelComplete();
        updateHud(g);
        setTimeout(() => triggerLevelComplete(earnedStars), 700);
      }
    }

    function checkLoose() {
      const g = gRef.current!;
      if (g.gameOverFired) return;
      const { h } = sizeRef.current;
      const active = g.bubbles.filter(b => !b.popping && !b.falling);
      const lowest = active.reduce((max, b) => b.y > max ? b.y : max, 0);
      if (lowest > getDangerY(h)) {
        g.gameOverFired = true;
        sound.playGameOver();
        setTimeout(() => triggerGameOver(), 600);
      }
    }

    function popBubbles(bubbles: Bubble[], shooterColor: string) {
      const g = gRef.current!;
      let totalPopped = 0;
      bubbles.forEach(b => {
        b.popping = true; b.popFrame = 0;
        g.particles.push(...spawnParticles(b.x, b.y, b.color, 12));
        sound.playPop(b.color);
        if (b.special) {
          if (b.special === 'bomb') sound.playBombSpecial();
          else if (b.special === 'rainbow') sound.playRainbowSpecial();
          else if (b.special === 'lightning') sound.playLightningSpecial();
          else if (b.special === 'freeze') sound.playFreezeSpecial();
          const effect = applySpecialEffect(b, g.bubbles, shooterColor);
          if (effect.frozenShots) g.frozenShots += effect.frozenShots;
          effect.removed.forEach(eb => {
            if (!eb.popping) {
              eb.popping = true; eb.popFrame = 0;
              g.particles.push(...spawnParticles(eb.x, eb.y, eb.color, 8));
              sound.playPop(eb.color);
              totalPopped++;
            }
          });
        }
        totalPopped++;
      });
      return totalPopped;
    }

    function addBubbleToGrid(row: number, col: number, x: number, y: number, color: string) {
      const g = gRef.current!;
      const occupied = g.bubbles.some(b => !b.popping && !b.falling && b.row === row && b.col === col);
      if (occupied) return;
      g.bubbles.push({ x, y, color, row, col });

      const matches = findMatches(row, col, color, g.bubbles);
      if (matches.length >= MIN_MATCH) {
        popBubbles(matches, color);
        g.combo++; g.comboTimer = 180; g.consecutiveHits++;
        g.sessionMaxCombo = Math.max(g.sessionMaxCombo, g.combo);
        if (g.combo > 1) sound.playCombo(g.combo);
        // Juice
        if (matches.length >= 5 || g.combo >= 3) {
          g.hitStopFrames = Math.max(g.hitStopFrames, g.combo >= 5 ? 6 : 5);
          g.flashAlpha = Math.max(g.flashAlpha, g.combo >= 5 ? 0.5 : 0.38);
          g.shakeIntensity = Math.max(g.shakeIntensity, g.combo >= 5 ? 10 : 6);
        }
        const comboBonus = g.combo > 1 ? Math.pow(COMBO_MULTIPLIER, g.combo - 1) : 1;
        const earned = Math.floor(matches.length * POINTS_PER_BUBBLE * comboBonus);
        g.score += earned;
        const cx = matches.reduce((s, b) => s + b.x, 0) / matches.length;
        const cy = matches.reduce((s, b) => s + b.y, 0) / matches.length;
        g.scorePopups.push({ x: cx, y: cy, value: earned, life: 55, maxLife: 55, combo: g.combo });
        if (navigator.vibrate) navigator.vibrate(g.combo > 2 ? [50, 20, 50] : 30);

        setTimeout(() => {
          const gg = gRef.current;
          if (!gg) return;
          const floating = findFloating(gg.bubbles);
          if (floating.length > 0) {
            const floatScore = floating.length * POINTS_PER_BUBBLE;
            gg.score += floatScore;
            floating.forEach(b => { b.falling = true; b.vy = -1.5; b.alpha = 1; gg.particles.push(...spawnParticles(b.x, b.y, b.color, 6)); sound.playPop(b.color); });
            if (floating.length >= 5) { gg.hitStopFrames = Math.max(gg.hitStopFrames, 4); gg.flashAlpha = Math.max(gg.flashAlpha, 0.28); gg.shakeIntensity = Math.max(gg.shakeIntensity, 7); }
            if (floating.length >= 3) {
              const fcx = floating.reduce((s, b) => s + b.x, 0) / floating.length;
              const fcy = floating.reduce((s, b) => s + b.y, 0) / floating.length;
              gg.scorePopups.push({ x: fcx, y: fcy, value: floatScore, life: 55, maxLife: 55, combo: 0 });
            }
          }
          checkWin();
          updateHud(gg);
        }, 250);
      } else {
        g.combo = 0; g.sessionMisses++; g.consecutiveHits = 0;
      }
      checkLoose();
      updateHud(g);
    }

    function finishShot() {
      const g = gRef.current!;
      const { w } = sizeRef.current;
      g.descentCounter++; g.endlessShotsTotal++;
      const isEndless = g.levelIdx === ENDLESS_LEVEL_IDX;
      if (isEndless) {
        if (g.endlessShotsTotal % ENDLESS_SHOTS_PER_WAVE === 0) {
          g.bubbles = addNewRowOnTop(g.bubbles, g.levelIdx, w, TOP_OFFSET);
          if (getMaxRow(g.bubbles) >= MAX_GRID_ROWS) {
            g.gameOverFired = true; sound.playGameOver();
            setTimeout(() => triggerGameOver(), 600); return;
          }
          checkLoose();
        }
        g.shotsLeft = ENDLESS_SHOTS_PER_WAVE;
        setTimeout(() => { g.canShoot = true; }, 180);
        updateHud(g);
        return;
      }
      if (g.frozenShots > 0) { g.frozenShots--; }
      else if (g.descentCounter % 8 === 0) {
        const dy = BUBBLE_RADIUS * 1.73;
        g.bubbles.forEach(b => { if (!b.popping && !b.falling) b.y += dy; });
        checkLoose();
      }
      if (g.shotsLeft <= 0) {
        setTimeout(() => {
          const gg = gRef.current;
          if (!gg) return;
          const remaining = gg.bubbles.filter(b => !b.popping && !b.falling).length;
          if (remaining > 0 && !gg.gameOverFired && !gg.levelCompleteFired) {
            gg.gameOverFired = true; sound.playGameOver(); triggerGameOver();
          }
        }, 900);
        return;
      }
      setTimeout(() => { g.canShoot = true; }, 180);
    }

    function shoot() {
      const g = gRef.current;
      if (!g || !g.canShoot || g.shotsLeft <= 0 || pausedRef.current) return;
      const { x, y } = shooterPos();
      if (Math.sin(g.angle) > -0.05) return;
      g.projectile = { x, y, vx: Math.cos(g.angle) * BUBBLE_SPEED, vy: Math.sin(g.angle) * BUBBLE_SPEED, color: g.nextColor, active: true };
      g.shotsLeft--; g.shotsFired++; g.canShoot = false;
      g.nextColor = g.reserveColor;
      g.reserveColor = pickShooterColor(g.levelIdx, g.bubbles, g.nextColor);
      updateHud(g);
      sound.playShoot();
    }

    // ─── Keyboard ────────────────────────────────────────────────────
    const onKey = (e: KeyboardEvent) => {
      const g = gRef.current;
      if (!g) return;
      if (e.code === 'Space') { e.preventDefault(); swapBubble(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); g.angle = Math.max(-Math.PI + 0.12, g.angle - 0.087); }
      if (e.code === 'ArrowRight') { e.preventDefault(); g.angle = Math.min(-0.12, g.angle + 0.087); }
      if (e.code === 'Enter' || e.code === 'KeyZ') { e.preventDefault(); shoot(); }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (overlayRef.current === 'none') handlePause();
        else if (overlayRef.current === 'paused') handleResume();
      }
    };
    window.addEventListener('keydown', onKey);

    // ─── Pointer / Touch ─────────────────────────────────────────────
    const onPointerMove = (e: PointerEvent) => {
      const g = gRef.current;
      if (!g) return;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width; const sy = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * sx; const y = (e.clientY - rect.top) * sy;
      const sp = shooterPos();
      g.angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, Math.atan2(y - sp.y, x - sp.x)));
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const g = gRef.current;
      if (!g || e.touches.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width; const sy = canvas.height / rect.height;
      const x = (e.touches[0].clientX - rect.left) * sx; const y = (e.touches[0].clientY - rect.top) * sy;
      const sp = shooterPos();
      g.angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, Math.atan2(y - sp.y, x - sp.x)));
    };
    let touchJustFired = false;
    const onClick = () => { if (touchJustFired) { touchJustFired = false; return; } shoot(); };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); touchJustFired = true; shoot(); setTimeout(() => { touchJustFired = false; }, 400); };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    // ─── Init level ─────────────────────────────────────────────────
    {
      const g = gRef.current;
      if (g) {
        const w = canvas.width || 400;
        g.bubbles = generateGrid(g.levelIdx, w, TOP_OFFSET);
        if (g.levelIdx === 0) {
          g.nextColor = TUTORIAL_SHOOT_COLOR;
          g.reserveColor = pickShooterColor(g.levelIdx, g.bubbles, TUTORIAL_SHOOT_COLOR);
          const target = g.bubbles.find(b => b.row === 3 && b.col === 4);
          if (target) {
            const sp = shooterPos();
            let a = Math.atan2(target.y - sp.y, target.x - sp.x);
            g.angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, a));
          }
        } else {
          g.nextColor = pickShooterColor(g.levelIdx, g.bubbles);
          g.reserveColor = pickShooterColor(g.levelIdx, g.bubbles, g.nextColor);
        }
        updateHud(g);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ─── MAIN LOOP ───────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    const loop = () => {
      const g = gRef.current;
      if (g) {
        g.animFrame = requestAnimationFrame(loop);
        frame++;

        const { w, h } = sizeRef.current;

        // Intro
        if (g.introFrame < INTRO_FRAMES) { g.introFrame++; g.introProgress = g.introFrame / INTRO_FRAMES; }
        if (g.swapSpin > 0) g.swapSpin = Math.max(0, g.swapSpin - 0.08);
        if (g.flashAlpha > 0) g.flashAlpha *= 0.78;

        // Physics only when not paused
        const physicsActive = g.hitStopFrames <= 0 && !pausedRef.current;
        if (g.hitStopFrames > 0) g.hitStopFrames--;

        if (physicsActive) {
          // Projectile
          if (g.projectile?.active) {
            const p = g.projectile;
            p.x += p.vx; p.y += p.vy;
            if (p.x - BUBBLE_RADIUS < 0) { p.x = BUBBLE_RADIUS; p.vx = -p.vx; sound.playBounce(); }
            else if (p.x + BUBBLE_RADIUS > w) { p.x = w - BUBBLE_RADIUS; p.vx = -p.vx; sound.playBounce(); }
            if (p.y - BUBBLE_RADIUS < TOP_OFFSET) {
              p.y = TOP_OFFSET + BUBBLE_RADIUS;
              const snap = snapToGrid(p, null, g.bubbles, w, TOP_OFFSET);
              if (snap) addBubbleToGrid(snap.row, snap.col, snap.x, snap.y, p.color);
              p.active = false; finishShot();
            } else {
              const hit = checkCollision(p, g.bubbles);
              if (hit) {
                const snap = snapToGrid(p, hit, g.bubbles, w, TOP_OFFSET);
                if (snap) addBubbleToGrid(snap.row, snap.col, snap.x, snap.y, p.color);
                p.active = false; finishShot();
              } else if (p.y > h + 50) { p.active = false; finishShot(); }
            }
          }

          // Animate bubbles
          g.bubbles.forEach(b => {
            if (b.popping) b.popFrame = (b.popFrame || 0) + 1;
            if (b.falling) { b.vy = (b.vy || 0) + 0.45; b.y += b.vy!; b.alpha = Math.max(0, (b.alpha || 1) - 0.025); }
          });
          g.bubbles = g.bubbles.filter(b => !(b.popping && (b.popFrame || 0) > 14) && !(b.falling && b.y > h + 120));
          g.particles = g.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; return p.life > 0; });
          g.scorePopups = g.scorePopups.filter(sp => { sp.y -= 1.2; sp.life--; return sp.life > 0; });
          if (g.comboTimer > 0) g.comboTimer--;
          if (g.comboTimer === 0 && g.combo > 0) { g.combo = 0; updateHud(g); }
        }

        // ─── DRAW ──────────────────────────────────────────────────
        ctx.save();
        // Shake
        if (g.shakeIntensity > 0) {
          const sx = (Math.random() - 0.5) * g.shakeIntensity;
          const sy = (Math.random() - 0.5) * g.shakeIntensity;
          g.shakeIntensity *= 0.75;
          if (g.shakeIntensity < 0.1) g.shakeIntensity = 0;
          ctx.translate(sx, sy);
        }

        ctx.clearRect(0, 0, w, h);

        // Top line
        ctx.strokeStyle = 'rgba(180,100,255,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(0, TOP_OFFSET); ctx.lineTo(w, TOP_OFFSET); ctx.stroke(); ctx.setLineDash([]);

        drawDangerPulse(ctx, w, h, getDangerProximity(h, g.bubbles), frame);

        const { x: sx, y: sy } = shooterPos();
        const showTut = g.levelIdx === 0 && g.shotsFired < 2;
        let aimPts: { x: number; y: number }[] = [];

        if (g.canShoot && !g.projectile?.active) {
          aimPts = getAimPoints(sx, sy, g.angle, w, h, showTut ? 8 : 5);
          if (!showTut && aimPts.length > 0) {
            ctx.setLineDash([6, 10]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.moveTo(sx, sy - BUBBLE_RADIUS);
            aimPts.forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.stroke(); ctx.setLineDash([]);
          }
        }

        // Special telegraphs
        const aimedSpecial = g.canShoot && !g.projectile?.active
          ? findAimedSpecialBubble(sx, sy, g.angle, w, h, g.bubbles) : null;
        g.bubbles.forEach(b => {
          if (!b.special || b.popping || b.falling) return;
          drawSpecialTelegraph(ctx, getSpecialTelegraph(b, w, TOP_OFFSET), aimedSpecial === b ? 1 : 0.35, frame);
        });

        // Draw bubbles
        const sorted = [...g.bubbles].sort((a, b) => a.row - b.row);
        sorted.forEach((b, idx) => {
          const introA = g.introProgress < 1 ? Math.min(1, Math.max(0, g.introProgress * 2 - idx * 0.04)) : 1;
          const introOff = g.introProgress < 1 ? (1 - easeOutBounce(g.introProgress)) * -200 : 0;
          const dy = b.y + introOff;
          const a = (b.alpha ?? 1) * introA;
          if (b.popping) drawPopAnimation(ctx, b.x, dy, b.color, b.popFrame || 0, 12, b.special);
          else drawBubble(ctx, b.x, dy, b.color, BUBBLE_RADIUS, a, 0, b.special, frame);
        });

        // Projectile
        if (g.projectile?.active) {
          const p = g.projectile;
          drawBubble(ctx, p.x, p.y, p.color, BUBBLE_RADIUS, 1, 1.2);
          ctx.save(); ctx.globalAlpha = 0.25;
          for (let ti = 1; ti <= 3; ti++) drawBubble(ctx, p.x - p.vx * ti * 0.4, p.y - p.vy * ti * 0.4, p.color, BUBBLE_RADIUS * (1 - ti * 0.15), 1 - ti * 0.2);
          ctx.restore();
        }

        g.particles.forEach(p => drawParticle(ctx, p));

        // Score popups
        g.scorePopups.forEach(sp => {
          const a = sp.life / sp.maxLife;
          ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
          ctx.font = `bold ${Math.floor(w * 0.045)}px Arial`;
          if (sp.combo > 1) { ctx.fillStyle = '#FFCC00'; ctx.shadowColor = '#FF9500'; ctx.shadowBlur = 10; ctx.fillText(`🔥 +${sp.value.toLocaleString()}`, sp.x, sp.y); }
          else { ctx.fillStyle = '#fff'; ctx.shadowColor = '#AF52DE'; ctx.shadowBlur = 8; ctx.fillText(`+${sp.value.toLocaleString()}`, sp.x, sp.y); }
          ctx.restore();
        });

        // Shooter
        const platGrad = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
        platGrad.addColorStop(0, 'rgba(138,43,226,0)'); platGrad.addColorStop(0.5, 'rgba(138,43,226,0.4)'); platGrad.addColorStop(1, 'rgba(138,43,226,0)');
        ctx.fillStyle = platGrad; ctx.fillRect(sx - 60, sy + BUBBLE_RADIUS + 3, 120, 2);

        const glowP = 0.4 + 0.3 * Math.sin(frame * 0.08);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(g.swapSpin * Math.PI * 2);
        drawBubble(ctx, 0, 0, g.nextColor, BUBBLE_RADIUS * 1.1, 1, glowP);
        ctx.restore();
        drawCannonNozzle(ctx, sx, sy, g.angle, g.nextColor, glowP);

        // Reserve
        if (g.reserveColor) {
          ctx.save(); ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.arc(sx + 56, sy + 6, BUBBLE_RADIUS * 0.72 + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();
          drawBubble(ctx, sx + 56, sy + 6, g.reserveColor, BUBBLE_RADIUS * 0.72, 1, 0.35);
          ctx.restore();
        }

        if (showTut && aimPts.length > 0) drawTutorialAimGuide(ctx, sx, sy, aimPts, frame);

        if (g.frozenShots > 0) {
          ctx.font = `bold ${Math.floor(w * 0.03)}px Arial`; ctx.fillStyle = '#88ddff'; ctx.textAlign = 'center';
          ctx.fillText(`❄️ ${g.frozenShots}`, sx, sy - BUBBLE_RADIUS * 2);
        }

        // Shot bar
        const maxShots = getMaxShots(g.levelIdx);
        const barW = w * 0.45; const barH = 5; const barX = sx - barW / 2; const barY = h - 28;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = g.nextColor; ctx.shadowBlur = 6; ctx.shadowColor = g.nextColor;
        const shotRatio = g.levelIdx === ENDLESS_LEVEL_IDX
          ? (ENDLESS_SHOTS_PER_WAVE - (g.endlessShotsTotal % ENDLESS_SHOTS_PER_WAVE)) / ENDLESS_SHOTS_PER_WAVE
          : g.shotsLeft / maxShots;
        ctx.fillRect(barX, barY, barW * Math.max(0, shotRatio), barH);
        ctx.shadowBlur = 0;

        drawScreenFlash(ctx, w, h, g.flashAlpha);
        ctx.restore();
      }
    };

    // Стартуем цикл
    const g = gRef.current;
    if (g) g.animFrame = requestAnimationFrame(loop);

    return () => {
      const g2 = gRef.current;
      if (g2) cancelAnimationFrame(g2.animFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [screen, gameTick]);

  // ═══════════════════════════════════════════════════════════════════════
  // ─── RENDER ───────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  // ─── MENU ──────────────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#0d0221] via-[#1a0533] to-[#0d0221] p-4 overflow-hidden select-none">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white animate-float"
              style={{ width: 2 + (i * 7 % 3), height: 2 + (i * 5 % 4), left: `${i * 5}%`, top: `${i * 4.7}%`, animationDelay: `${i * 0.3}s`, animationDuration: `${3 + (i % 3)}s` }} />
          ))}
        </div>

        <div className="relative z-10 text-center mb-6 animate-scale-in">
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400">
            🫧 Bubble Galaxy
          </h1>
          <p className="text-purple-300/70 text-sm mt-2">{t('howToPlay', lang)}</p>
        </div>

        {progress.highScore > 0 && (
          <div className="relative z-10 mb-4 text-purple-300 text-sm animate-fade-in">
            🏆 {t('highScore', lang)}: <span className="text-yellow-400 font-bold">{progress.highScore.toLocaleString()}</span>
          </div>
        )}

        <div className="relative z-10 w-full max-w-xs mb-4 animate-slide-up">
          <h2 className="text-purple-300 text-center text-sm font-semibold mb-2">{t('campaign', lang)}</h2>
          <div className="grid grid-cols-4 gap-2">
            {LEVELS.slice(0, Math.min(progress.unlockedLevels, LEVELS.length)).map((lvl, i) => (
              <button key={i} onClick={() => startGame(i)}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-400/50 transition-all active:scale-95">
                <span className="text-white font-bold text-sm">{lvl.label}</span>
                {progress.levelStars[i] ? <span className="text-yellow-400 text-xs">{'⭐'.repeat(progress.levelStars[i])}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 w-full max-w-xs space-y-2 mb-4 animate-slide-up">
          <button onClick={() => startGame(ENDLESS_LEVEL_IDX)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600/40 to-pink-600/40 border border-purple-500/40 hover:border-purple-400/60 text-white font-semibold text-sm transition-all active:scale-95">
            ♾️ {t('endless', lang)}
            <span className="block text-xs text-purple-300/60">{t('endlessDesc', lang)}</span>
          </button>
          <button onClick={() => { if (!isDailyCompleted()) startGame(DAILY_LEVEL_IDX); }}
            disabled={isDailyCompleted()}
            className={`w-full py-3 px-4 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
              isDailyCompleted() ? 'bg-gray-800/40 border-gray-600/30 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-amber-600/40 to-orange-600/40 border-amber-500/40 hover:border-amber-400/60 text-white'
            }`}>
            📅 {isDailyCompleted() ? t('dailyDone', lang) : t('daily', lang)}
            {!isDailyCompleted() && <span className="block text-xs text-amber-300/60">{t('dailyDesc', lang)}</span>}
          </button>
        </div>

        <button onClick={toggleSound} className="relative z-10 text-purple-400/60 hover:text-purple-300 text-sm transition-colors">
          {isMuted ? '🔇' : '🔊'} {t('sound', lang)}
        </button>
      </div>
    );
  }

  // ─── GAME SCREEN ──────────────────────────────────────────────────────
  const isEndless = hud.levelIdx === ENDLESS_LEVEL_IDX;
  const isDaily = hud.levelIdx === DAILY_LEVEL_IDX;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d0221] overflow-hidden select-none" ref={gameAreaRef}>
      {/* HUD */}
      <div className="w-full max-w-[480px] flex items-center justify-between px-3 py-1.5 z-10">
        <button onClick={handlePause} className="text-white/70 hover:text-white text-lg transition-colors">⏸</button>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-purple-300">{t('level', lang)} {hud.levelLabel}</span>
          <span className="text-yellow-400 font-bold">⭐ {hud.score.toLocaleString()}</span>
          <span className="text-white/60">{t('shots', lang)}: {hud.shotsLeft}</span>
          {hud.shotsLeft <= 3 && overlay === 'none' && screen === 'playing' && (
            <button
              onClick={() => showRewardedAd(
                () => {
                  const g = gRef.current; if (!g) return;
                  g.shotsLeft += 5;
                  setHud(h => ({ ...h, shotsLeft: g.shotsLeft }));
                },
                {
                  onOpen: () => { pausedRef.current = true; sound.pause(); },
                  onClose: () => { pausedRef.current = false; if (!sound.isMuted()) sound.resume(); },
                  onError: () => { pausedRef.current = false; if (!sound.isMuted()) sound.resume(); },
                }
              )}
              className="ml-2 text-amber-400 text-xs font-semibold border border-amber-500/40 rounded-lg px-2 py-1 hover:bg-amber-500/10 transition"
              aria-label={t('watchAdForShots', lang)}
            >
              {t('watchAdForShots', lang)}
            </button>
          )}
          {hud.combo > 1 && <span className="text-orange-400 font-bold">🔥 x{hud.combo}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={swapBubble} className="text-white/50 hover:text-white/80 text-xs transition-colors">🔄</button>
          <button onClick={toggleSound} className="text-white/50 hover:text-white/80 text-xs transition-colors">{isMuted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      {/* Canvas + overlays */}
      <div className="relative flex items-center justify-center">
        <canvas ref={canvasRef} className="rounded-lg" />

        {/* PAUSE */}
        {overlay === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg z-20 animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">{t('pause', lang)}</h2>
            <div className="space-y-3 w-48">
              <button onClick={handleResume} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm active:scale-95">▶ {t('resume', lang)}</button>
              <button onClick={() => startGame(hud.levelIdx)} className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold text-sm active:scale-95">🔄 {t('restart', lang)}</button>
              <button onClick={handleMenu} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-semibold text-sm active:scale-95">🏠 {t('menu', lang)}</button>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {overlay === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-lg z-20 animate-fade-in">
            <h2 className="text-2xl font-bold text-red-400 mb-2 animate-scale-in">{t('gameOver', lang)}</h2>
            <p className="text-yellow-400 text-xl font-bold mb-1">⭐ {hud.score.toLocaleString()}</p>
            {hud.combo > 0 && <p className="text-orange-400 text-sm mb-4">🔥 Max Combo: x{hud.combo}</p>}
            <div className="space-y-3 w-52 mt-2">
              <button onClick={() => startGame(hud.levelIdx)} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm active:scale-95">🔄 {t('restart', lang)}</button>
              <button onClick={handleMenu} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-semibold text-sm active:scale-95">🏠 {t('menu', lang)}</button>
            </div>
          </div>
        )}

        {/* LEVEL COMPLETE */}
        {overlay === 'levelComplete' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg z-20 animate-fade-in">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2 animate-scale-in">{t('levelComplete', lang)}</h2>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3].map(i => (
                <span key={i} className="text-3xl animate-star-pop" style={{ animationDelay: `${i * 0.2}s` }}>{i <= stars ? '⭐' : '☆'}</span>
              ))}
            </div>
            <p className="text-yellow-400 text-lg font-bold mb-4">⭐ {hud.score.toLocaleString()}</p>
            <div className="space-y-3 w-48">
              {!isEndless && !isDaily && hud.levelIdx < LEVELS.length - 1 && (
                <button onClick={() => startGame(hud.levelIdx + 1)} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm active:scale-95">➡️ {t('nextLevel', lang)}</button>
              )}
              {isEndless && (
                <button onClick={() => startGame(ENDLESS_LEVEL_IDX)} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm active:scale-95">🔄 {t('restart', lang)}</button>
              )}
              {!isEndless && !isDaily && hud.levelIdx >= LEVELS.length - 1 && (
                <button onClick={() => startGame(ENDLESS_LEVEL_IDX)} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm active:scale-95">♾️ {t('endless', lang)}</button>
              )}
              <button onClick={handleMenu} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-semibold text-sm active:scale-95">🏠 {t('menu', lang)}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
