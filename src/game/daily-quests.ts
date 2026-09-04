/**
 * «Задания дня» — три коротких цели на календарный день (по образцу
 * `weekly.ts`): детерминированно выбираются из пула по дате, прогресс
 * копится из фактов игры (победа, ★★★, канистра, без подсказки, повтор,
 * уровень дня, ходы, отмена), награда — подсказка за каждое.
 *
 * Зачем: у игры была мотивация «сегодня» только в виде одного уровня дня и
 * подарка. Задания дают 2–3 понятные микро-цели на сессию 5–10 минут и
 * причину сыграть «ещё один уровень» — без таймеров, энергии и наказаний:
 * невыполненное задание просто сгорает, серий по заданиям нет.
 *
 * Чистый модуль без DOM: состояние сериализуемо, живёт в `SaveData.quests`,
 * смена дня вытесняет прошлый день (как у weekly).
 */
import { hashDate } from './daily';

export type DailyQuestKind =
  | 'win'
  | 'perfect'
  | 'canister'
  | 'nohint'
  | 'replay'
  | 'daily'
  | 'moves'
  | 'undo';

export interface DailyQuestDef {
  key: string;
  kind: DailyQuestKind;
  goal: number;
  icon: string;
  /** С какой позиции кампании задание имеет смысл (иначе оно невыполнимо для новичка). */
  minPosition?: number;
}

export interface DailyQuestState {
  day: string;
  progress: Partial<Record<DailyQuestKind, number>>;
  claimed: string[];
}

export const DAILY_QUEST_REWARD_HINTS = 1;
export const DAILY_QUESTS_PER_DAY = 3;

const POOL: DailyQuestDef[] = [
  { key: 'win2', kind: 'win', goal: 2, icon: '🚗' },
  { key: 'win3', kind: 'win', goal: 3, icon: '🚙' },
  { key: 'perfect1', kind: 'perfect', goal: 1, icon: '⭐' },
  { key: 'perfect2', kind: 'perfect', goal: 2, icon: '🌟', minPosition: 6 },
  { key: 'canister2', kind: 'canister', goal: 2, icon: '🛢️', minPosition: 4 },
  { key: 'nohint2', kind: 'nohint', goal: 2, icon: '🧠' },
  { key: 'replay1', kind: 'replay', goal: 1, icon: '🔁', minPosition: 5 },
  { key: 'daily1', kind: 'daily', goal: 1, icon: '🔥', minPosition: 3 },
  { key: 'moves20', kind: 'moves', goal: 20, icon: '🕹️' },
  { key: 'undo1', kind: 'undo', goal: 1, icon: '↩️' }
];

/**
 * Три задания дня: по одному на «вид», чтобы не выпадали два задания «пройти
 * N уровней». Порядок и выбор фиксированы датой — у всех игроков одинаковый
 * набор (тема для обсуждения), но доступный новичку: задания с `minPosition`
 * выше текущего прогресса не выпадают.
 */
export function selectDailyQuests(dayKey: string, campaignPosition = 999): DailyQuestDef[] {
  const rng = mulberry32(hashDate(`${dayKey}:quests`));
  const available = POOL.filter((q) => (q.minPosition ?? 0) <= campaignPosition);
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  const out: DailyQuestDef[] = [];
  const kinds = new Set<DailyQuestKind>();
  for (const q of available) {
    if (kinds.has(q.kind)) continue;
    kinds.add(q.kind);
    out.push(q);
    if (out.length === DAILY_QUESTS_PER_DAY) break;
  }
  return out;
}

export function dailyQuestProgress(state: DailyQuestState | undefined, day: string, quest: DailyQuestDef): number {
  if (!state || state.day !== day) return 0;
  return Math.min(quest.goal, state.progress[quest.kind] ?? 0);
}

export function isDailyQuestClaimed(state: DailyQuestState | undefined, day: string, key: string): boolean {
  return !!state && state.day === day && state.claimed.includes(key);
}

export function applyDailyQuestEvent(
  state: DailyQuestState | undefined,
  day: string,
  kind: DailyQuestKind,
  amount = 1
): DailyQuestState {
  const base: DailyQuestState = state && state.day === day ? state : { day, progress: {}, claimed: [] };
  const current = base.progress[kind] ?? 0;
  return { ...base, progress: { ...base.progress, [kind]: Math.min(9999, current + Math.max(0, amount)) } };
}

export function applyDailyQuestClaim(
  state: DailyQuestState | undefined,
  day: string,
  key: string
): DailyQuestState | null {
  if (!state || state.day !== day || state.claimed.includes(key)) return null;
  return { ...state, claimed: [...state.claimed, key] };
}

/** Сколько заданий дня готовы к получению (выполнены, но не забраны). */
export function readyDailyQuests(state: DailyQuestState | undefined, day: string, quests: DailyQuestDef[]): number {
  return quests.filter((q) => dailyQuestProgress(state, day, q) >= q.goal && !isDailyQuestClaimed(state, day, q.key))
    .length;
}

export function sanitizeDailyQuests(raw: unknown): DailyQuestState | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as { day?: unknown; progress?: unknown; claimed?: unknown };
  if (typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return undefined;
  const progress: DailyQuestState['progress'] = {};
  if (typeof r.progress === 'object' && r.progress !== null) {
    for (const [k, v] of Object.entries(r.progress as Record<string, unknown>)) {
      const n = Number(v);
      if (POOL.some((q) => q.kind === k) && Number.isInteger(n) && n >= 0) {
        progress[k as DailyQuestKind] = Math.min(9999, n);
      }
    }
  }
  const claimed = Array.isArray(r.claimed)
    ? [...new Set(r.claimed.filter((k): k is string => typeof k === 'string'))].slice(0, 10)
    : [];
  return { day: r.day, progress, claimed };
}

/** Merge локального и облачного состояния: один день — максимум по каждому виду и объединение claimed; разные дни — более свежий. */
export function mergeDailyQuests(
  a: DailyQuestState | undefined,
  b: DailyQuestState | undefined
): DailyQuestState | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.day !== b.day) return a.day > b.day ? a : b;
  const progress: DailyQuestState['progress'] = { ...a.progress };
  for (const [k, v] of Object.entries(b.progress) as [DailyQuestKind, number][]) {
    progress[k] = Math.max(progress[k] ?? 0, v);
  }
  return { day: a.day, progress, claimed: [...new Set([...a.claimed, ...b.claimed])] };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
