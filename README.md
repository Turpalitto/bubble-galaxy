# Bubble Galaxy

Browser bubble shooter built for [Yandex Games](https://yandex.ru/games/).

## Stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS 4
- Canvas 2D game engine
- Yandex Games SDK v2 (cloud saves, ads, leaderboards)

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/index.html (single file for Yandex upload)
```

## Yandex Games setup

1. Build: `npm run build`
2. Upload `dist/index.html` to the Yandex Games console
3. Create leaderboards (see [Настройка лидербордов в Консоли Яндекс.Игр](#настройка-лидербордов-в-консоли-яндексигр) below)
4. Promo assets: `promo/*.svg` (convert to PNG for console)

## Настройка лидербордов в Консоли Яндекс.Игр

Лидерборды создаются вручную в [Консоли Яндекс.Игр](https://console.yandex.ru/games/) → выберите игру → вкладка **Лидерборды** → **Добавить лидерборд**.

Технические имена должны **точно совпадать** с кодом (`src/App.tsx`, `src/utils/yandexSdk.ts`). Иначе SDK вернёт ошибку 404.

### Когда отправляются очки

| Техническое имя | Когда вызывается `submitLeaderboardScore` | Тип очков |
|---|---|---|
| `bubbleGalaxy` | Победа на уровне кампании (`triggerLevelComplete`); поражение в кампании (`triggerGameOver`); победа в «Уровне дня» | Целое число (`g.score`) |
| `bubbleGalaxyEndless` | Поражение в бесконечном режиме (`triggerGameOver`, `levelIdx === 999`) | Целое число (`g.score`) |
| `bubbleGalaxyDaily` | Поражение в «Уровне дня» (`triggerGameOver`, `levelIdx === 998`) | Целое число (`g.score`) |

Чтение таблицы в игре: `getLeaderboardEntries('bubbleGalaxy', 10, true)` — только кампания (кнопка «Рейтинг» в меню). Остальные два лидерборда используются только для записи результата.

### Лидерборд 1 — кампания

| Поле в консоли | Значение |
|---|---|
| **Техническое имя лидерборда** | `bubbleGalaxy` |
| **Отображаемое имя (ru)** | Рекорд кампании |
| **Основной лидерборд** | Да (отображается на карточке игры) |
| **Тип лидерборда** | Числовой (`numeric`) |
| **Порядок сортировки** | По убыванию (Descending) |
| **Размер дробной части** | `0` |

### Лидерборд 2 — бесконечный режим

| Поле в консоли | Значение |
|---|---|
| **Техническое имя лидерборда** | `bubbleGalaxyEndless` |
| **Отображаемое имя (ru)** | Бесконечный режим |
| **Основной лидерборд** | Нет |
| **Тип лидерборда** | Числовой (`numeric`) |
| **Порядок сортировки** | По убыванию (Descending) |
| **Размер дробной части** | `0` |

### Лидерборд 3 — уровень дня

| Поле в консоли | Значение |
|---|---|
| **Техническое имя лидерборда** | `bubbleGalaxyDaily` |
| **Отображаемое имя (ru)** | Уровень дня |
| **Основной лидерборд** | Нет |
| **Тип лидерборда** | Числовой (`numeric`) |
| **Порядок сортировки** | По убыванию (Descending) |
| **Размер дробной части** | `0` |

### Пошагово для каждого лидерборда

1. Откройте [console.yandex.ru/games](https://console.yandex.ru/games/) → ваша игра → **Лидерборды**.
2. Нажмите **Добавить лидерборд**.
3. Вставьте **техническое имя** из таблицы выше (без пробелов, регистр важен).
4. В поле **Отображаемое имя лидерборда** укажите русское название.
5. Для `bubbleGalaxy` включите **Основной лидерборд**; для остальных — выключите.
6. **Тип** → Числовой.
7. **Порядок сортировки** → По убыванию.
8. **Размер дробной части очков** → `0`.
9. Нажмите **Отправить**.
10. Повторите шаги 2–9 для `bubbleGalaxyEndless` и `bubbleGalaxyDaily`.

## Game modes

- Campaign — 14 levels with stars
- Endless — infinite waves
- Daily — daily challenge
