# 🫧 Bubble Galaxy

Космический bubble shooter, готовый к публикации: Next.js (App Router) + Canvas 2D движок + PostgreSQL (Drizzle) для мировых лидербордов.

Полное ТЗ, по которому собрана игра — в [PROMPT.md](./PROMPT.md).

## Возможности
- **Кампания** — 40 детерминированных уровней, звёзды, бустеры за 3★
- **Бесконечный режим** — волны, растущая сложность, рекорд волны
- **Дейли-челлендж** — одно поле для всех (seed = дата UTC), одна официальная попытка, стрик 🔥, шаринг в стиле Wordle
- Спец-пузыри: 💣 бомба, ⚡ молния, 🌈 радуга, 🪨 камень; комбо и режим FEVER ×2
- Бустеры: бомба-выстрел, радуга-выстрел, лазерный прицел
- Мировые таблицы лидеров (топ-50 + твоё место), глобальный счётчик лопнутых пузырей
- Web Audio синтезированный звук и музыка, haptics, RU/EN, PWA-манифест, OG-превью
- Анти-чит на сервере: токен игрока, лимиты счёта, проверка правдоподобности, троттлинг, 1 дейли-результат в день

## Запуск
```bash
npm install
npx drizzle-kit push      # применить схему к PostgreSQL из .env (DATABASE_URL)
npm run dev
```

## API
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/players` | создать игрока → `{id, nickname, token}` |
| PATCH | `/api/players` | сменить ник (по токену) |
| POST | `/api/scores` | отправить результат `{token, mode, score, level, maxCombo, popped, dailyDate?}` |
| GET | `/api/leaderboard?mode=&level=&date=&playerId=` | топ-50 + позиция игрока |
| GET | `/api/stats` | глобальная статистика |
| GET | `/api/health` | healthcheck |

## Публикация на порталах
`src/game/platform.ts` — адаптер платформы. Для Yandex Games / Poki / CrazyGames реализуйте `PlatformAdapter` (реклама, готовность, gameplay start/stop) и подмените экспорт `platform`.
