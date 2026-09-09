/**
 * «Живой двор»: дед-комментатор реагирует на события хода. Визуальные реакции
 * окружения (пыль, куры, скрип ворот, искры звезды) уже живут в BoardView —
 * здесь добавляется ПЕРСОНАЖ: маленький портрет деда со сменой настроения и
 * авто-скрывающийся пузырь реплики. Всё декоративно: на логику хода не влияет.
 *
 * Уважает паузу/рекламу/скрытую вкладку (реакции замолкают), prefers-reduced-
 * motion (без прыжков, только текст), и работает как субтитр — реплика видна,
 * даже когда звук выключен (доступность).
 */
import type { GameAudio } from '../game/audio';
import { t } from '../game/i18n';
import {
  type GrandpaEvent,
  type GrandpaMood,
  type GrandpaState,
  commitLine,
  createGrandpaState,
  pickLineVerbose,
  textKeyOf
} from '../game/grandpa';

const GRANDPA_ART_URL = `${import.meta.env.BASE_URL}art/grandpa-menu-v1.webp`;

/** Тот же дед, что и в меню: на поле больше нет плоской пиктограммы-двойника. */
function grandpaPortrait(mood: GrandpaMood): string {
  return `<img class="gp-face gp-${mood}" src="${GRANDPA_ART_URL}" alt="" aria-hidden="true" />`;
}

export interface YardDirectorOptions {
  level: number;
  reducedMotion: boolean;
  /** «Живой двор» включён игроком. */
  enabled: boolean;
  /** Уже показанные однократные/сюжетные реплики (из сейва). */
  seen: Iterable<string>;
  /** Вызывается, когда набор seen пополнился (для персиста в сейв). */
  onSeen(id: string): void;
  /**
   * `?grandpaDebug=1` в dev/e2e: логирует в консоль выбранную реплику и причины
   * отсева остальных кандидатов. Никогда не включается в production независимо
   * от query-параметра — гейт по MODE делает вызывающий код (см. app.ts).
   */
  debug?: boolean;
}

export class YardDirector {
  private readonly bubble: HTMLElement;
  private readonly portrait: HTMLElement;
  private readonly state: GrandpaState;
  private paused = false;
  private hideTimer = 0;

  constructor(
    host: HTMLElement,
    private readonly audio: GameAudio,
    private readonly opts: YardDirectorOptions
  ) {
    this.state = createGrandpaState(opts.seen);
    const wrap = document.createElement('div');
    wrap.className = 'grandpa';
    wrap.setAttribute('data-testid', 'grandpa');
    if (!opts.enabled) wrap.classList.add('grandpa-off');
    wrap.innerHTML = `
      <div class="grandpa-portrait" data-testid="grandpa-portrait">${grandpaPortrait('neutral')}</div>
      <div class="grandpa-bubble" data-testid="grandpa-bubble" role="status" aria-live="polite" hidden></div>`;
    host.appendChild(wrap);
    this.portrait = wrap.querySelector('.grandpa-portrait')!;
    this.bubble = wrap.querySelector('.grandpa-bubble')!;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.hide();
  }

  /** Событие двора → возможная реплика деда. Тихо игнорируется, если выключено. */
  react(event: GrandpaEvent, now: number = performance.now()): void {
    if (!this.opts.enabled || this.paused) {
      if (this.opts.debug) console.debug(`[grandpa] ${event}: skipped (director disabled/paused)`);
      return;
    }
    const info = pickLineVerbose(this.state, event, { now, level: this.opts.level });
    if (this.opts.debug) this.logDebug(event, info);
    if (!info.line) return;
    commitLine(this.state, info.line, now);
    if (this.state.seen.has(info.line.id)) this.opts.onSeen(info.line.id);
    this.show(t(textKeyOf(info.line)), info.line.mood, (info.line.priority ?? 0) >= 3);
  }

  private logDebug(event: GrandpaEvent, info: ReturnType<typeof pickLineVerbose>): void {
    if (info.line) {
      console.debug(
        `[grandpa] ${event} -> "${info.line.id}" mood=${info.line.mood} cooldownMs=${info.line.cooldownMs ?? '—'} priority=${info.line.priority ?? 0}`
      );
    } else if (info.blockedByGlobalCooldown !== undefined) {
      console.debug(`[grandpa] ${event} -> none: global cooldown, ${Math.round(info.blockedByGlobalCooldown)}ms left`);
    } else {
      console.debug(`[grandpa] ${event} -> none: no eligible line`, info.skipped);
    }
  }

  private show(text: string, mood: GrandpaMood, sticky: boolean): void {
    this.portrait.innerHTML = grandpaPortrait(mood);
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    this.bubble.classList.toggle('reduced', this.opts.reducedMotion);
    this.bubble.classList.remove('pop');
    if (!this.opts.reducedMotion) {
      void this.bubble.offsetWidth;
      this.bubble.classList.add('pop');
    }
    // «Голос» деда — короткое добродушное бормотание (варьируется в audio).
    this.audio.play('grandpa');
    // Пока дед говорит, фоновая музыка приглушается, чтобы реплика не тонула.
    this.audio.duckMusicFor(sticky ? 5200 : 3200);
    window.clearTimeout(this.hideTimer);
    // Сюжетные реплики висят дольше; обычные — коротко и авто-исчезают.
    this.hideTimer = window.setTimeout(() => this.hide(), sticky ? 5200 : 3200);
  }

  private hide(): void {
    window.clearTimeout(this.hideTimer);
    this.bubble.hidden = true;
    this.bubble.classList.remove('pop');
  }

  destroy(): void {
    window.clearTimeout(this.hideTimer);
  }
}
