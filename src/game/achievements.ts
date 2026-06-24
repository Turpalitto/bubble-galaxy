import type { GameLang } from '../utils/i18n';

export interface AchievementDef {
  id: string;
  title: Record<GameLang, string>;
  description: Record<GameLang, string>;
  icon: string;
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  combo_3: {
    id: 'combo_3',
    title: { ru: 'Первое комбо ×3!', en: 'First combo ×3!' },
    description: { ru: 'Собери цепочку из трёх комбо', en: 'Chain three combos' },
    icon: '🔥',
  },
  combo_5: {
    id: 'combo_5',
    title: { ru: 'Мега-комбо ×5!', en: 'Mega combo ×5!' },
    description: { ru: 'Достигни комбо ×5 за один уровень', en: 'Reach combo ×5 in one level' },
    icon: '💥',
  },
  sniper_10: {
    id: 'sniper_10',
    title: { ru: 'Снайпер', en: 'Sniper' },
    description: { ru: '10 точных попаданий подряд', en: '10 consecutive hits' },
    icon: '🎯',
  },
  perfect_level: {
    id: 'perfect_level',
    title: { ru: 'Чистилище', en: 'Flawless' },
    description: { ru: 'Пройди уровень без промахов', en: 'Clear a level with no misses' },
    icon: '✨',
  },
  campaign_clear: {
    id: 'campaign_clear',
    title: { ru: 'Покоритель галактики', en: 'Galaxy conqueror' },
    description: { ru: 'Пройди все 8 уровней кампании', en: 'Clear all 8 campaign levels' },
    icon: '🌌',
  },
  daily_done: {
    id: 'daily_done',
    title: { ru: 'День за днём', en: 'Day by day' },
    description: { ru: 'Пройди уровень дня', en: 'Complete the daily challenge' },
    icon: '📅',
  },
  endless_10k: {
    id: 'endless_10k',
    title: { ru: 'Бесконечность', en: 'Infinity' },
    description: { ru: 'Набери 10 000 очков в бесконечном режиме', en: 'Score 10,000 in endless mode' },
    icon: '♾️',
  },
  bubbles_100: {
    id: 'bubbles_100',
    title: { ru: 'Поп-машина', en: 'Pop machine' },
    description: { ru: 'Лопни 100 пузырей за всё время', en: 'Pop 100 bubbles total' },
    icon: '💫',
  },
  bubbles_1000: {
    id: 'bubbles_1000',
    title: { ru: 'Пузырный мастер', en: 'Bubble master' },
    description: { ru: 'Лопни 1000 пузырей за всё время', en: 'Pop 1000 bubbles total' },
    icon: '🌈',
  },
};

export function getAchievement(id: string, lang: GameLang = 'ru'): {
  id: string;
  title: string;
  description: string;
  icon: string;
} | undefined {
  const def = ACHIEVEMENTS[id];
  if (!def) return undefined;
  return {
    id: def.id,
    title: def.title[lang] ?? def.title.ru,
    description: def.description[lang] ?? def.description.ru,
    icon: def.icon,
  };
}
