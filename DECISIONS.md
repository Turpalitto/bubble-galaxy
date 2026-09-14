# Decisions

<!-- PROJECT-MEMORY-KIT:GENERATED -->
Record only important decisions using the ADR format in `memory/decisions/` or below.

## ADR-001 — Project Memory protocol

Status: Accepted
Date: 2026-09-07

### Context
Agents need a portable, project-local continuity layer.

### Decision
Use Markdown, JSON, Git, and the local stdlib-only Project Memory Kit.

### Why
Readable, portable, dependency-light, and independent of external LLM APIs.

### Alternatives considered
External vector/database memory; rejected for the initial implementation.

### Consequences
Agents must follow the repository protocol and keep summaries concise.

## ADR-09092302 — Recorded decision

Status: Accepted
Date: 2026-09-09

### Decision

Core rules, levels and save format preserved; source PNG and silent audio archived outside public; production uses WebP plus non-silent victory WAV.

## ADR-09101817 — Recorded decision

Status: Accepted
Date: 2026-09-10

### Decision

Rejected the full stale patch: excluded broken season prestige loop, replayable custom-level rewards, nonfunctional cosmetics/ghost replay, incorrect Yandex SDK URL, save debounce, static i18n split, and legacy-plugin removal.

## ADR-09101827 — Recorded decision

Status: Accepted
Date: 2026-09-10

### Decision

Keep runtime art/audio, current promo PNGs and submission screenshots; exclude generated audit evidence and release ZIPs

## ADR-09110001 — Recorded decision

Status: Accepted
Date: 2026-09-10

### Decision

Use existing SVG/WebAudio instead of new assets; keep the cat decorative and outside puzzle core; constrain its desktop/landscape route away from menu controls; respect reduced-motion globally.

## ADR-09110029 — Recorded decision

Status: Accepted
Date: 2026-09-10

### Decision

Keep synthesized WebAudio with no new asset download; await unlock only for the rare cat interaction while preserving existing sound preference.

## ADR-09140852 — Recorded decision

Status: Accepted
Date: 2026-09-14

### Decision

Audit remains manual because it is intentionally heavy. Artifact publication is delegated to actions/upload-artifact and the local script never invokes Git. The broken thumbnail screenshot was caused by the dev server being unavailable; assets were verified healthy and no thumbnail fallback was added.

## ADR-09141346 — Recorded decision

Status: Accepted
Date: 2026-09-14

### Decision

Уровни 129–130 остаются бонусным продолжением главы 10 после сюжетного финала; специальные клетки сохраняются при ремиксе sourceId

## ADR-09141826 — Recorded decision

Status: Accepted
Date: 2026-09-14

### Decision

Санитизация save — защита целостности P1, не античит; sandbox Яндекс Игр обязателен перед публичным релизом, не перед каждым коммитом

## ADR-09141839 — Recorded decision

Status: Accepted
Date: 2026-09-14

### Decision

Сохраняем актуальные дизайн-, релизные, маркетинговые материалы и Project Memory; удаляем только неподдерживаемые дубли и сессионные черновики
