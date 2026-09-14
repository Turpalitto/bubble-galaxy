/**
 * Аудит-плейтрун: вся кампания (130 уровней + все фазы 5 боссов) играется
 * через реальный UI реальными drag-жестами по оптимальному маршруту решателя.
 *
 * Назначение: независимый аудит «играбельность + целостность UI-пути» и
 * заготовка кадров для визуального аудита. Это НЕ замена e2e-тестам, а
 * тяжёлый инструмент аудита/контент-регрессии (поэтому вне `npm test`).
 *
 * Запуск: `npm run playthrough` (сначала собирает свежий e2e-бандл).
 * Артефакты: audit-artifacts/playthrough.json + audit-artifacts/screenshots/.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import levelsJson from '../src/levels/levels.json';
import type { LevelDef } from '../src/core/types';
import { createState, applyMove } from '../src/core/game';
import { solve, type SolveMove } from '../src/core/solver';
import { bossFor, bossPhaseLevel, type BossLevelDef, type BossPhase } from '../src/game/boss';

const LEVELS = levelsJson as LevelDef[];
const byId = new Map(LEVELS.map((l) => [l.id, l]));
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(root, 'audit-artifacts');
const SHOTS = join(OUT, 'screenshots');
const PREVIEW_PORT = 42_000 + (process.pid % 1000);
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;

/* ------------------------------------------------------------------ */
/* Планировщик: оптимальные маршруты решателя для каждого уровня/фазы  */
/* ------------------------------------------------------------------ */

interface PlannedMove {
  pieceId: string;
  dx: number;
  dy: number;
  steps: number;
  exits: boolean;
}

interface Plan {
  levelId: number;
  boss: BossLevelDef | null;
  phases: {
    name: string;
    level: LevelDef;
    requireStar: boolean;
    moves: PlannedMove[];
    optimal: number;
    usedStarRoute: boolean;
  }[];
}

function planMoves(level: LevelDef, path: SolveMove[]): PlannedMove[] {
  let state = createState(level);
  const out: PlannedMove[] = [];
  for (const move of path) {
    const def = level.pieces[move.piece];
    const res = applyMove(level, state, move.piece, move.dx, move.dy, move.steps);
    if (!res) throw new Error(`invalid move in solution of level ${level.id}`);
    out.push({ pieceId: def.id, dx: move.dx, dy: move.dy, steps: move.steps, exits: res.exited });
    state = res.state;
  }
  return out;
}

function bestRoute(level: LevelDef): { moves: PlannedMove[]; optimal: number; usedStarRoute: boolean } {
  let usedStarRoute = false;
  if (level.star) {
    const starRes = solve(level, { requireStar: true });
    if (starRes.solvable && starRes.path.length <= level.par2) {
      usedStarRoute = true;
      return { moves: planMoves(level, starRes.path), optimal: starRes.optimal, usedStarRoute };
    }
  }
  const res = solve(level);
  if (!res.solvable) throw new Error(`level ${level.id} is not solvable`);
  return { moves: planMoves(level, res.path), optimal: res.optimal, usedStarRoute };
}

function buildPlans(): Plan[] {
  return LEVELS.map((level) => {
    const boss = bossFor(level.id) ?? null;
    if (!boss) {
      const route = bestRoute(level);
      return {
        levelId: level.id,
        boss: null,
        phases: [{ name: `level ${level.id}`, level, requireStar: false, ...route }]
      } satisfies Plan;
    }
    const phases = boss.phases.map((phase: BossPhase, i: number) => {
      const source = byId.get(phase.sourceLevelId);
      if (!source) throw new Error(`boss ${boss.id}: source level ${phase.sourceLevelId} missing`);
      const phaseLevel = bossPhaseLevel(phase, source, boss.id, i);
      // Цель «собери звезду» обязывает звёздный маршрут; иначе — как у обычных
      // уровней (звезда предпочтительна, если не дороже par2).
      if (phase.objective.requireStar) {
        const starRes = solve(phaseLevel, { requireStar: true });
        if (!starRes.solvable) throw new Error(`boss ${boss.id} phase ${i}: star route unsolvable`);
        return {
          name: `boss ${boss.id} phase ${i + 1}/${boss.phases.length}`,
          level: phaseLevel,
          requireStar: true,
          moves: planMoves(phaseLevel, starRes.path),
          optimal: starRes.optimal,
          usedStarRoute: true
        };
      }
      return {
        name: `boss ${boss.id} phase ${i + 1}/${boss.phases.length}`,
        level: phaseLevel,
        requireStar: false,
        ...bestRoute(phaseLevel)
      };
    });
    return { levelId: level.id, boss, phases } satisfies Plan;
  });
}

/* ------------------------------------------------------------------ */
/* UI-драйвер                                                          */
/* ------------------------------------------------------------------ */

const errors: string[] = [];
/** Общий журнал: пишется инкрементально, чтобы отменённый ран оставлял лог. */
const LOG_LINES: string[] = [];

function trackPageErrors(page: Page, scope: string): void {
  page.on('pageerror', (error) => errors.push(`${scope} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${scope} console: ${message.text()}`);
  });
}

async function waitForVisible(page: Page, testid: string, timeout = 10_000): Promise<boolean> {
  try {
    await page.getByTestId(testid).waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function cellSize(page: Page): Promise<number> {
  const vb = ((await page.getByTestId('board').getAttribute('viewBox')) ?? '0 0 800 800').split(' ').map(Number);
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('board has no bounding box');
  return 100 * Math.min(box.width / vb[2], box.height / vb[3]);
}

async function drag(page: Page, pieceId: string, dx: number, dy: number, cells: number): Promise<void> {
  const piece = page.locator(`[data-piece="${pieceId}"]`);
  const box = await piece.boundingBox();
  if (!box) throw new Error(`piece ${pieceId} not visible`);
  const cell = await cellSize(page);
  const sx = box.x + Math.min(box.width, cell) / 2;
  const sy = box.y + Math.min(box.height, cell) / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  const steps = 7;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + (dx * cells * cell * i) / steps, sy + (dy * cells * cell * i) / steps);
  }
  await page.mouse.up();
}

/** Закрытие всего, что может встать между уровнями: интро глав, босс-интро, реклама. */
async function settleOnBoard(page: Page): Promise<'board' | 'lost'> {
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('board').isVisible().catch(() => false)) {
      // chapter-intro может лежать поверх уже готовой доски
      if (await page.getByTestId('chapter-intro').isVisible().catch(() => false)) {
        await page.getByTestId('chapter-intro-go').click();
        await page.waitForTimeout(300);
        continue;
      }
      return 'board';
    }
    if (await page.getByTestId('chapter-intro').isVisible().catch(() => false)) {
      await page.getByTestId('chapter-intro-go').click();
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.getByTestId('screen-boss-intro').isVisible().catch(() => false)) {
      return 'board'; // интро босса обрабатывает вызывающий код
    }
    if (await page.getByTestId('mock-ad').isVisible().catch(() => false)) {
      const close = page.getByTestId('mock-ad-close');
      await close.waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const b = document.querySelector<HTMLButtonElement>('[data-testid="mock-ad-close"]');
        return b && !b.disabled;
      }, undefined, { timeout: 6000 }).catch(() => undefined);
      await close.click();
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(250);
  }
  return 'lost';
}

interface LevelOutcome {
  levelId: number;
  boss: boolean;
  phasesPlayed: number;
  movesTotal: number;
  par: number;
  stars: number | null;
  ok: boolean;
  error?: string;
}

const outcomes: LevelOutcome[] = [];
let shotIndex = 0;
async function shot(page: Page, name: string): Promise<void> {
  shotIndex += 1;
  await page.screenshot({ path: join(SHOTS, `${String(shotIndex).padStart(2, '0')}-${name}.jpg`), type: 'jpeg', quality: 72 });
}

async function movesHud(page: Page): Promise<number> {
  const text = (await page.getByTestId('hud-moves').textContent()) ?? '0';
  return Number(text.replace(/\D/g, '')) || 0;
}

/**
 * После «Дальше» победный оверлей дорабатывает фейд, а доска предыдущего
 * уровня ещё видна: без этой синхронизации драги уходят в старую доску
 * (систематический провал со 2-го уровня в CI-прогоне 2026-09-13).
 * Новая доска = ходы 0 и отсутствие оверлеев.
 */
async function awaitFreshBoard(page: Page): Promise<void> {
  await page.getByTestId('win-overlay').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
  await page.getByTestId('boss-victory').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => undefined);
  await page
    .waitForFunction(() => document.querySelector('[data-testid="hud-moves"]')?.textContent?.trim() === '0', undefined, {
      timeout: 8000
    })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

async function playPhase(page: Page, phase: Plan['phases'][number], log: (s: string) => void): Promise<number> {
  await awaitFreshBoard(page);
  let expectedMoves = 0;
  for (const move of phase.moves) {
    const cells = move.exits ? move.steps + 4 : move.steps;
    await drag(page, move.pieceId, move.dx, move.dy, cells);
    if (!move.exits) {
      expectedMoves += 1;
      // синхронизация со счётчиком ходов: ход засчитан, когда HUD обновился
      await page
        .waitForFunction((n) => Number((document.querySelector('[data-testid="hud-moves"]')?.textContent ?? '').replace(/\D/g, '')) >= n, expectedMoves, { timeout: 5000 })
        .catch(() => undefined);
      const actual = await movesHud(page);
      if (actual !== expectedMoves) log(`  ⚠ hud sync drift: expected ${expectedMoves}, got ${actual}`);
      await page.waitForTimeout(60);
    }
  }
  return expectedMoves;
}

/** Ждём любой исход после последнего хода фазы/уровня. */
async function waitOutcome(page: Page): Promise<string> {
  const candidates = ['win-overlay', 'boss-transition', 'boss-victory', 'campaign-ending', 'boss-objective-unmet', 'deadlock-toast'];
  for (let i = 0; i < 60; i++) {
    for (const id of candidates) {
      if (await page.getByTestId(id).isVisible().catch(() => false)) return id;
    }
    await page.waitForTimeout(250);
  }
  return 'timeout';
}

async function playCampaign(page: Page, log: (s: string) => void): Promise<void> {
  const plans = buildPlans();
  log(`plans ready: ${plans.length} campaign entries, ${plans.reduce((n, p) => n + p.phases.length, 0)} playable boards`);

  await page.goto(`${BASE}/?mock=1&lang=ru&daytime=day`);
  if (!(await waitForVisible(page, 'menu-play'))) throw new Error('main menu did not appear');
  // меню появляется фейдом: без паузы кадр ловил полупрозрачную сцену
  await page.waitForTimeout(900);
  await shot(page, 'menu-fresh');

  for (const plan of plans) {
    const outcome: LevelOutcome = {
      levelId: plan.levelId,
      boss: plan.boss !== null,
      phasesPlayed: 0,
      movesTotal: 0,
      par: plan.phases[plan.phases.length - 1].level.par,
      stars: null,
      ok: false
    };
    try {
      // Адаптивный вход: после «Дальше» следующий уровень уже запущен (иногда
      // сразу как босс-интро). Иначе — через сетку: после финала кампании
      // «Продолжить» ведёт в лигу, глава 10 доступна только из сетки.
      const onBoard = await page.getByTestId('board').isVisible().catch(() => false);
      const onBossIntro = await page.getByTestId('screen-boss-intro').isVisible().catch(() => false);
      if (!onBoard && !onBossIntro) {
        if (await page.getByTestId('win-overlay').isVisible().catch(() => false)) {
          const exit = page.getByTestId('btn-win-menu').or(page.getByTestId('btn-final-menu'));
          await exit.first().click();
          await waitForVisible(page, 'menu-play');
        }
        if (!(await page.getByTestId('menu-play').isVisible().catch(() => false))) {
          await page.goto(`${BASE}/?mock=1&lang=ru&daytime=day`);
          await waitForVisible(page, 'menu-play');
        }
        await page.getByTestId('menu-levels').click();
        const card = page.getByTestId(`level-card-${plan.levelId}`);
        await card.waitFor({ state: 'visible', timeout: 5000 });
        await card.click();
      }

      if (plan.boss) {
        if (!(await waitForVisible(page, 'screen-boss-intro'))) throw new Error('boss intro did not appear');
        if (plan.levelId === 10) await shot(page, 'boss10-intro');
        if (plan.levelId === 50) await shot(page, 'boss50-intro');
        if (plan.levelId === 75) await shot(page, 'boss75-intro');
        if (plan.levelId === 100) await shot(page, 'boss100-intro');
        await page.getByTestId('boss-start').click();
      }

      for (let pi = 0; pi < plan.phases.length; pi++) {
        const phase = plan.phases[pi];
        if ((await settleOnBoard(page)) === 'lost') throw new Error(`board not reached for ${phase.name}`);
        if (plan.boss && plan.levelId === 100 && pi === plan.phases.length - 1) await shot(page, 'boss100-final-board');
        const moves = await playPhase(page, phase, log);
        outcome.movesTotal += moves;
        outcome.phasesPlayed += 1;
        const res = await waitOutcome(page);
        // оверлеи победы появляются фейдом — кадрам и чтению звёзд нужна
        // стабильная сцена
        if (res === 'win-overlay' || res === 'boss-victory') await page.waitForTimeout(650);
        if (res === 'boss-objective-unmet') throw new Error(`objective unmet on ${phase.name}`);
        if (res === 'timeout') throw new Error(`no outcome after ${phase.name}`);
        if (res === 'boss-transition') {
          await page.getByTestId('boss-continue').click();
          await page.waitForTimeout(250);
          continue;
        }
        if (res === 'campaign-ending') {
          // биты финальной сцены идут по таймеру (~1.6с каждый) — ждём кнопку
          await page.waitForTimeout(2600);
          await shot(page, 'campaign-ending');
          await waitForVisible(page, 'ending-return', 20_000);
          await shot(page, 'campaign-ending-buttons');
          await page.getByTestId('ending-return').click();
          await waitForVisible(page, 'menu-play');
          await shot(page, 'menu-after-campaign');
          break;
        }
        if (res === 'boss-victory') {
          if (plan.levelId === 10 || plan.levelId === 100) await shot(page, `boss${plan.levelId}-victory`);
          const stars = await page.getByTestId('win-stars').getAttribute('data-stars').catch(() => null);
          outcome.stars = stars ? Number(stars) : null;
          const next = page.getByTestId('btn-next');
          if (await next.isVisible().catch(() => false)) await next.click();
          else await page.getByTestId('btn-win-menu').click();
          break;
        }
        // win-overlay обычного уровня
        const stars = await page.getByTestId('win-stars').getAttribute('data-stars').catch(() => null);
        outcome.stars = stars ? Number(stars) : null;
        if (plan.levelId === 1) await shot(page, 'win-level1');
        if (plan.levelId === 17) await shot(page, 'win-level17-button');
        if (plan.levelId === 105) await shot(page, 'win-level105-ice');
        if (plan.levelId === 130) await shot(page, 'win-level130-final');
        const next = page.getByTestId('btn-next');
        if (await next.isVisible().catch(() => false)) await next.click();
        else {
          const alt = page.getByTestId('btn-win-menu').or(page.getByTestId('btn-final-menu'));
          await alt.first().click();
        }
      }
      outcome.ok = true;
      log(`✓ ${plan.boss ? `BOSS ${plan.levelId}` : `level ${plan.levelId}`}: ${outcome.movesTotal} ходов, ★${outcome.stars ?? '?'}`);
    } catch (e) {
      outcome.error = e instanceof Error ? e.message : String(e);
      log(`✗ level ${plan.levelId}: ${outcome.error}`);
      await shot(page, `fail-${plan.levelId}`);
      // восстановление: жёсткая перезагрузка на меню
      await page.goto(`${BASE}/?mock=1&lang=ru&daytime=day`).catch(() => undefined);
      await waitForVisible(page, 'menu-play', 15_000).catch(() => undefined);
    }
    outcomes.push(outcome);
    // Инкрементальные лог и json: даже отменённый ран оставляет читаемый результат.
    writeFileSync(join(OUT, 'playthrough.log'), LOG_LINES.join('\n'));
    writeFileSync(join(OUT, 'playthrough.json'), JSON.stringify({ partial: true, outcomes }, null, 2));
  }
}

/* ------------------------------------------------------------------ */
/* Визуальная батарея: меню, двор, режимы, локали, форм-факторы        */
/* ------------------------------------------------------------------ */

async function visualBattery(browser: Browser, log: (s: string) => void): Promise<void> {
  const qa = (extra = '') => `${BASE}/?mock=1&qaTools=1&lang=ru${extra}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  trackPageErrors(page, 'visual desktop');

  // стадии двора 0/4/10 (широкий экран)
  for (const stage of [0, 4, 10]) {
    await page.goto(qa(`&qaYard=${stage * 10}&daytime=day`));
    await page.getByTestId('menu-play').waitFor({ state: 'visible' });
    await page.waitForTimeout(600);
    await shot(page, `yard-stage-${stage}-wide`);
  }
  // ночь и вечер: тонировка
  await page.goto(qa('&qaYard=100&daytime=night'));
  await page.getByTestId('menu-play').waitFor({ state: 'visible' });
  await page.waitForTimeout(600);
  await shot(page, 'yard-night-wide');
  await page.goto(qa('&qaYard=100&daytime=evening'));
  await page.getByTestId('menu-play').waitFor({ state: 'visible' });
  await page.waitForTimeout(600);
  await shot(page, 'yard-evening-wide');

  // сетка уровней (глава 10) и ночной уровень
  await page.goto(qa('&qaYard=100'));
  await page.getByTestId('menu-play').waitFor({ state: 'visible' });
  await page.getByTestId('menu-levels').click();
  await page.waitForTimeout(400);
  await shot(page, 'levels-grid-wide');

  // элита, бесконечный двор, ежедневные события
  const eliteTab = page.getByTestId('menu-elite');
  if (await eliteTab.isVisible().catch(() => false)) {
    await eliteTab.click();
    await page.waitForTimeout(400);
    await shot(page, 'elite-hub');
  }
  await page.goto(qa('&qaYard=100&daytime=day'));
  await page.getByTestId('menu-play').waitFor({ state: 'visible' });
  await shot(page, 'menu-events-row');
  await page.getByTestId('menu-achievements').click();
  await page.waitForTimeout(300);
  await shot(page, 'achievements');
  await page.getByTestId('btn-back').click();
  await page.getByTestId('menu-garage').click();
  await page.waitForTimeout(300);
  await shot(page, 'garage');
  await page.getByTestId('garage-close').click();
  await page.getByTestId('menu-weekly').click();
  await page.waitForTimeout(300);
  await shot(page, 'weekly-quests');
  await page.getByTestId('weekly-close').click();
  await page.getByTestId('menu-rules').click();
  await page.waitForTimeout(300);
  await shot(page, 'rules');
  await page.getByTestId('btn-rules-close').click();
  await page.getByTestId('menu-settings').click();
  await page.waitForTimeout(300);
  await shot(page, 'settings-open');

  // ночной уровень в игре
  await page.goto(qa('&daytime=night'));
  await page.getByTestId('menu-levels').click();
  await page.getByTestId('level-card-60').click();
  await page.waitForTimeout(900);
  await shot(page, 'game-night-60');
  await page.getByTestId('btn-game-back').click().catch(() => undefined);
  await page.waitForTimeout(400);
  // пауза
  await page.getByTestId('level-card-60').click().catch(() => undefined);
  await page.waitForTimeout(700);
  await page.getByTestId('btn-pause').click().catch(() => undefined);
  await page.waitForTimeout(300);
  await shot(page, 'pause-overlay').catch(() => undefined);
  await ctx.close();

  // локали en/tr
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p2 = await ctx2.newPage();
  trackPageErrors(p2, 'visual locale');
  for (const lang of ['en', 'tr']) {
    await p2.goto(`${BASE}/?mock=1&qaTools=1&lang=${lang}&daytime=day`);
    await p2.getByTestId('menu-play').waitFor({ state: 'visible' });
    await p2.waitForTimeout(400);
    await shot(p2, `menu-${lang}`);
  }
  await ctx2.close();

  // мобильный портрет 360×800
  const mobile = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  const pm = await mobile.newPage();
  trackPageErrors(pm, 'visual mobile');
  await pm.goto(`${BASE}/?mock=1&lang=ru&daytime=day`);
  await pm.getByTestId('menu-play').waitFor({ state: 'visible' });
  await pm.waitForTimeout(500);
  await shot(pm, 'mobile-menu-fresh');
  await pm.getByTestId('menu-play').click();
  await pm.waitForTimeout(900);
  await shot(pm, 'mobile-game-level1');
  await pm.getByTestId('btn-pause').click();
  await pm.waitForTimeout(300);
  await shot(pm, 'mobile-pause');
  await mobile.close();

  // альбом 844×390
  const land = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const pl = await land.newPage();
  trackPageErrors(pl, 'visual landscape');
  await pl.goto(`${BASE}/?mock=1&lang=ru&daytime=day`);
  await pl.getByTestId('menu-play').waitFor({ state: 'visible' });
  await pl.waitForTimeout(400);
  await shot(pl, 'landscape-menu');
  await pl.getByTestId('menu-play').click();
  await pl.waitForTimeout(900);
  await shot(pl, 'landscape-game');
  await land.close();

  // TV-эмуляция
  const tv = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const pt = await tv.newPage();
  trackPageErrors(pt, 'visual tv');
  await pt.goto(`${BASE}/?mock=1&tv=1&lang=ru&daytime=day`);
  await pt.getByTestId('menu-play').waitFor({ state: 'visible' });
  await pt.waitForTimeout(400);
  await shot(pt, 'tv-menu-focus');
  await tv.close();
  log('visual battery done');
}

/* ------------------------------------------------------------------ */

async function ensurePreview(): Promise<() => void> {
  // Всегда поднимаем собственный сервер на отдельном порту: случайный HTTP 200
  // от уже запущенного Vite не должен подменить проверяемую сборку.
  const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [viteBin, 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode !== null) throw new Error(`vite preview exited with code ${child.exitCode}`);
    if (await fetch(BASE).then((r) => r.ok).catch(() => false)) {
      return () => {
        if (child.exitCode === null) child.kill('SIGTERM');
      };
    }
  }
  child.kill('SIGTERM');
  throw new Error('vite preview did not start');
}

async function main(): Promise<void> {
  const log = (s: string): void => {
    LOG_LINES.push(s);
    console.log(s);
  };
  // Без браузера: только проверка, что решатель строит маршрут для каждой
  // постановки (уровни + все фазы боссов). Полезно после правок данных.
  if (process.env.PLAYTHROUGH_PLAN_ONLY === '1') {
    const plans = buildPlans();
    const boards = plans.reduce((n, p) => n + p.phases.length, 0);
    const moves = plans.reduce((n, p) => n + p.phases.reduce((m, ph) => m + ph.moves.length, 0), 0);
    log(`plan ok: ${plans.length} записей кампании, ${boards} досок, ${moves} ходов суммарно`);
    return;
  }
  // Каждый полный аудит создаёт самодостаточный набор артефактов.
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  const stopPreview = await ensurePreview();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  trackPageErrors(page, 'playthrough');

  const startedAt = Date.now();
  try {
    await playCampaign(page, log);
    await ctx.close();
    await visualBattery(browser, log);
  } finally {
    await browser.close();
    stopPreview();
  }

  const failed = outcomes.filter((o) => !o.ok);
  const starsSum = outcomes.reduce((n, o) => n + (o.stars ?? 0), 0);
  const summary = {
    date: new Date().toISOString(),
    durationSec: Math.round((Date.now() - startedAt) / 1000),
    levelsTotal: LEVELS.length,
    levelsOk: outcomes.filter((o) => o.ok).length,
    levelsFailed: failed.map((f) => ({ levelId: f.levelId, error: f.error })),
    starsSum,
    maxStars: LEVELS.length * 3,
    pageErrors: errors
  };
  log(`\n=== ИТОГ: ${summary.levelsOk}/${summary.levelsTotal} уровней, ★${starsSum}/${summary.maxStars}, page errors: ${errors.length} ===`);
  if (failed.length) log(`провалы: ${failed.map((f) => f.levelId).join(', ')}`);
  writeFileSync(join(OUT, 'playthrough.json'), JSON.stringify({ summary, outcomes }, null, 2));
  writeFileSync(join(OUT, 'playthrough.log'), LOG_LINES.join('\n'));
  if (failed.length || errors.length) {
    throw new Error(`playthrough failed: ${failed.length} level failures, ${errors.length} page errors`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
