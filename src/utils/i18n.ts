export type GameLang = 'ru' | 'en';

const dict: Record<string, Record<GameLang, string>> = {
  score: { ru: 'Очки', en: 'Score' },
  level: { ru: 'Уровень', en: 'Level' },
  shots: { ru: 'Залпы', en: 'Shots' },
  campaign: { ru: 'Кампания', en: 'Campaign' },
  levels: { ru: 'Уровни', en: 'Levels' },
  endless: { ru: 'Бесконечный', en: 'Endless' },
  endlessMode: { ru: 'Бесконечный режим', en: 'Endless mode' },
  daily: { ru: 'День', en: 'Daily' },
  dailyDone: { ru: 'Сыграно сегодня', en: 'Played today' },
  dailyAvailable: { ru: 'Уровень дня доступен!', en: 'Daily challenge available!' },
  leaderboard: { ru: 'Таблица лидеров', en: 'Leaderboard' },
  records: { ru: 'Рекорды', en: 'Records' },
  record: { ru: 'Рекорд', en: 'Best' },
  stars: { ru: 'Звёзды', en: 'Stars' },
  trophies: { ru: 'Трофеи', en: 'Trophies' },
  shoot: { ru: 'Выстрел', en: 'Shoot' },
  pause: { ru: 'Пауза', en: 'Pause' },
  resume: { ru: 'Продолжить', en: 'Resume' },
  restart: { ru: 'Начать заново', en: 'Restart' },
  again: { ru: 'Снова', en: 'Again' },
  menu: { ru: 'Меню', en: 'Menu' },
  mainMenu: { ru: 'Главное меню', en: 'Main menu' },
  gameOver: { ru: 'Игра окончена', en: 'Game Over' },
  gameOverHint: { ru: 'Пузыри дошли до пушки!', en: 'Bubbles reached the cannon!' },
  result: { ru: 'Результат', en: 'Result' },
  newRecord: { ru: 'НОВЫЙ РЕКОРД!', en: 'NEW RECORD!' },
  watchAdReward: { ru: 'Смотри рекламу → +5 выстрелов', en: 'Watch ad → +5 shots' },
  levelComplete: { ru: 'Уровень пройден!', en: 'Level complete!' },
  campaignComplete: { ru: 'Галактика покорена!', en: 'Galaxy conquered!' },
  campaignCompleteHint: { ru: 'Все 14 уровней пройдены! Теперь — бесконечный режим.', en: 'All 14 levels cleared! Try endless mode.' },
  campaignCleared: { ru: 'Кампания пройдена!', en: 'Campaign complete!' },
  selectLevel: { ru: 'Выбор уровня', en: 'Select level' },
  back: { ru: 'Назад', en: 'Back' },
  combo: { ru: 'КОМБО', en: 'COMBO' },
  reserve: { ru: 'Запас', en: 'Reserve' },
  achievement: { ru: 'Достижение', en: 'Achievement' },
  next: { ru: 'Дальше', en: 'Next' },
  finalScore: { ru: 'Итоговый счёт', en: 'Final score' },
  notBad: { ru: 'Неплохо!', en: 'Not bad!' },
  great: { ru: 'Отлично!', en: 'Great!' },
  perfect: { ru: 'Идеально!', en: 'Perfect!' },
  loading: { ru: 'Загрузка…', en: 'Loading…' },
  yourRank: { ru: 'Ваше место', en: 'Your rank' },
  noEntries: { ru: 'Пока нет записей. Сыграй и займи первое место!', en: 'No entries yet. Play and take first place!' },
  lbCampaign: { ru: 'Кампания', en: 'Campaign' },
  lbEndless: { ru: 'Бесконечный', en: 'Endless' },
  lbDaily: { ru: 'День', en: 'Daily' },
  lbHint: { ru: 'Создайте лидерборд в консоли Яндекс Игр', en: 'Create leaderboard in Yandex Games console' },
  pauseTip: { ru: 'Совет: используй отражение от стен для сложных выстрелов!', en: 'Tip: use wall bounces for tricky shots!' },
  player: { ru: 'Игрок', en: 'Player' },
  subtitle: { ru: 'Пузырный шутер', en: 'Bubble shooter' },
  levelSelectComplete: { ru: 'Кампания завершена!', en: 'Campaign complete!' },
  levelSelectCompleteHint: {
    ru: 'Все уровни открыты. Попробуй бесконечный режим за новым рекордом.',
    en: 'All levels unlocked. Try endless mode for a new record.',
  },
  tapToPlay: { ru: 'Играть', en: 'Tap to Play' },
  levelMap: { ru: 'Карта уровней', en: 'Level map' },
  signInYandex: { ru: 'Войти через Яндекс', en: 'Sign in with Yandex' },
  signInHint: { ru: 'Войдите, чтобы сохранять рекорды в таблице', en: 'Sign in to save your scores to the leaderboard' },
  eightLevels: { ru: '14 уровней', en: '14 levels' },
  yandexGames: { ru: 'Яндекс Игры', en: 'Yandex Games' },
  muteOn: { ru: 'Включить звук', en: 'Unmute' },
  muteOff: { ru: 'Выключить звук', en: 'Mute' },
  swapBubbles: { ru: 'Поменять пузыри', en: 'Swap bubbles' },
  lbHintId: {
    ru: 'Создайте лидерборд «{id}» в консоли Яндекс Игр',
    en: 'Create leaderboard «{id}» in Yandex Games console',
  },
};

export function resolveLang(sdkLang?: string): GameLang {
  const code = (sdkLang || navigator.language || 'ru').toLowerCase();
  if (code.startsWith('en')) return 'en';
  return 'ru';
}

export function t(key: keyof typeof dict | string, lang: GameLang): string {
  const entry = dict[key as keyof typeof dict];
  if (!entry) return String(key);
  return entry[lang] ?? entry.ru;
}

export function applyDocumentLang(lang: GameLang) {
  document.documentElement.lang = lang;
}

export function localeOf(lang: GameLang): string {
  return lang === 'en' ? 'en-US' : 'ru-RU';
}
