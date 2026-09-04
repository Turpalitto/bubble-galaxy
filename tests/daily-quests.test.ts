import { describe, expect, it } from 'vitest';
import {
  DAILY_QUESTS_PER_DAY,
  applyDailyQuestClaim,
  applyDailyQuestEvent,
  dailyQuestProgress,
  isDailyQuestClaimed,
  mergeDailyQuests,
  readyDailyQuests,
  sanitizeDailyQuests,
  selectDailyQuests
} from '../src/game/daily-quests';

describe('задания дня', () => {
  it('детерминированно выбирает три разные доступные цели', () => {
    const first = selectDailyQuests('2026-09-04', 0);
    const second = selectDailyQuests('2026-09-04', 0);
    expect(second).toEqual(first);
    expect(first).toHaveLength(DAILY_QUESTS_PER_DAY);
    expect(new Set(first.map((quest) => quest.kind)).size).toBe(DAILY_QUESTS_PER_DAY);
    expect(first.every((quest) => (quest.minPosition ?? 0) <= 0)).toBe(true);
  });

  it('копит прогресс только в текущем дне и ограничивает его сверху', () => {
    const quest = { key: 'win2', kind: 'win' as const, goal: 2, icon: '🚗' };
    let state = applyDailyQuestEvent(undefined, '2026-09-04', 'win');
    state = applyDailyQuestEvent(state, '2026-09-04', 'win', 10_000);
    expect(dailyQuestProgress(state, '2026-09-04', quest)).toBe(2);
    expect(state.progress.win).toBe(9999);
    const nextDay = applyDailyQuestEvent(state, '2026-09-05', 'undo');
    expect(nextDay).toEqual({ day: '2026-09-05', progress: { undo: 1 }, claimed: [] });
  });

  it('выдаёт награду один раз и считает готовые цели', () => {
    const quests = selectDailyQuests('2026-09-04');
    const quest = quests[0];
    const state = applyDailyQuestEvent(undefined, '2026-09-04', quest.kind, quest.goal);
    expect(readyDailyQuests(state, '2026-09-04', quests)).toBe(1);
    const claimed = applyDailyQuestClaim(state, '2026-09-04', quest.key);
    expect(claimed).not.toBeNull();
    expect(isDailyQuestClaimed(claimed ?? undefined, '2026-09-04', quest.key)).toBe(true);
    expect(applyDailyQuestClaim(claimed ?? undefined, '2026-09-04', quest.key)).toBeNull();
    expect(readyDailyQuests(claimed ?? undefined, '2026-09-04', quests)).toBe(0);
  });

  it('санитизирует и идемпотентно сливает прогресс одного дня', () => {
    const clean = sanitizeDailyQuests({
      day: '2026-09-04',
      progress: { win: 2, undo: -1, unknown: 7 },
      claimed: ['win2', 'win2', 4]
    });
    expect(clean).toEqual({ day: '2026-09-04', progress: { win: 2 }, claimed: ['win2'] });
    const merged = mergeDailyQuests(
      { day: '2026-09-04', progress: { win: 1, moves: 20 }, claimed: ['win2'] },
      { day: '2026-09-04', progress: { win: 3, undo: 1 }, claimed: ['undo1'] }
    );
    expect(merged).toEqual({
      day: '2026-09-04',
      progress: { win: 3, moves: 20, undo: 1 },
      claimed: ['win2', 'undo1']
    });
    expect(mergeDailyQuests(merged, merged)).toEqual(merged);
  });
});
