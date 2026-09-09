# AGENTS.md

## Проект

«Переполох во дворе» — браузерная TypeScript-головоломка для Яндекс Игр. Vite, SVG/DOM UI, без игрового движка.

## Перед Любой Работой

Прочитай:

- `README.md`
- `PRODUCT_SPEC.md`
- `GAME_DESIGN.md`
- `TECHNICAL_DESIGN.md`

Код и тесты являются источником истины, если документация устарела.

## Главные Правила

- Не менять core-правила без прямого разрешения.
- Не ломать доказуемую проходимость уровней.
- Не добавлять случайность в головоломочную логику.
- Не добавлять агрессивную монетизацию.
- Не менять формат сохранения без миграции.
- Не переписывать проект на другой framework.
- Не коммитить без успешных проверок.
- Не обращаться к `YaGames` вне `src/platform/yandex.ts`.
- Перед правкой Яндекс SDK сверять актуальную официальную документацию Яндекс Игр.

## Обязательные Проверки

Для обычного изменения:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Для UI:

```bash
npm run e2e
```

Для уровней:

```bash
npm run solve
npm test
```

Перед релизом:

```bash
npm run verify:dist
```

## Навыки

Используй:

- `$parkovka-game-design` — для геймдизайна.
- `$parkovka-level-design` — для уровней.
- `$parkovka-playtest-analysis` — для тестов игроков.
- `$parkovka-game-feel` — для управления и обратной связи.
- `$parkovka-code-review` — для ревью.
- `$parkovka-yandex-release` — перед публикацией.

## Структура

- `src/core/` — чистые правила, solver, validator; без DOM.
- `src/levels/` — данные уровней.
- `src/platform/` — mock, fallback и Яндекс SDK.
- `src/ui/` — экраны, SVG-поле, ввод.
- `src/game/` — save, audio, i18n, progression, daily/weekly/endless/achievements/boss/elite.
- `tests/`, `e2e/`, `scripts/` — проверки, браузерные тесты, сборочные/solver scripts.

<!-- PROJECT-MEMORY-KIT:BEGIN -->
## Project Memory Protocol

`AGENTS.md` is the primary project instruction file. Project Memory is local to this repository and must never be mixed with another project. Never trust memory above executable behavior, current source/configuration, tests, and Git state. Unknown facts must be labeled `Unknown`, `Needs verification`, or `Inferred from code`. Never put secrets, full logs, full diffs, dependency folders, binaries, or generated caches in memory.

### Startup
1. Locate the project root and read this file.
2. If memory is absent and this is clearly a software project, run `pm-init --auto`.
3. Run `pm-doctor --fix --quiet` when safe, then read `PROJECT_STATE.md` and `memory/CURRENT_CONTEXT.md`.
4. Inspect `git status` and recent commits; load only relevant decisions, module memory, graph neighbors, and recent session notes.
5. Use `pm-context` for a compact working context before substantial work.

### During and after substantial work
Validate changes and review the diff. Update project state, current context, TODO, decisions, module memory, and graph only when the work changes their meaning. Use `pm-checkpoint` for a concise meaningful session summary, then run `pm-doctor --fix --quiet`. Small typo/readme-only changes do not require a checkpoint. Never commit, push, reset, or change production/business logic as memory maintenance.

The repository's code and tests are the source of truth; memory is a portable summary for continuity across agents.
<!-- PROJECT-MEMORY-KIT:END -->
