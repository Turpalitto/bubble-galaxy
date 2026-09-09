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
