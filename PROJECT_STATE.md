# Project State

<!-- PROJECT-MEMORY-KIT:GENERATED -->
## Current status

The consumer-audit remediation is implemented and locally accepted. All findings A01–A15 are addressed; see `CONSUMER_AUDIT_REMEDIATION.md` and `design-audit/remediation-2026-09-09/`.

## Working features

- Responsive illustrated menu with visible live yard progression on desktop, tablet, portrait phones, 320×568 and low landscape.
- Readable puzzle HUD, visible target identity, stronger grid, painted obstacles, safe onboarding overlays and enlarged landscape board.
- Explicit daily mechanics, garage car preview, labelled secondary actions and exact reward/hint amounts.
- Complete local sound registry: 20 files, including three grandpa mumbles and the gate sound in AAC/M4A.

## Verification

- Typecheck, lint, 543 unit tests and production build pass.
- Full Playwright: 274 passed, 1 expected desktop touch-only skip; desktop, mobile touch and WebKit projects covered.
- New AAC files decode in Chromium through `AudioContext.decodeAudioData` as mono 48 kHz without errors.
- Visual evidence covers menu, level 3, daily, garage, league and the 320 px HUD.

## Known limits

- Human listening approval for the synthesized effects is still separate from technical decode verification.
- Real-device touch and real Yandex ads/cloud remain external integration checks.
- Full subjective balance of all 128 levels was not re-rated; level data and core rules were not changed.

## Important constraints

- Preserve core rules, level solvability, save compatibility, Yandex SDK isolation, mobile/TV layouts, and direct access to secondary menu features.

## Recent significant changes

- 2026-09-09: Закрыты A01-A20: переработаны menu/board окружение и responsive HUD, PNG runtime-art переведён в WebP, исправлены пути ассетов, беззвучный victory audio заменён WAV, выровнен микс эффектов, обновлены audit/e2e материалы.
- 2026-09-09: Fixed asset URL resolution for CSS custom-property backgrounds so production loads /art instead of the nonexistent /assets/art path. Wide game gutters now show a dim illustrated yard with house, bushes, flowers, shed and path.
- 2026-09-09: Moved the wide-desktop title into open sky, softened the portrait crop, restyled the live yard as a framed map, replaced flat game-screen grass with a dim illustrated yard backdrop, and cropped the painted board ground to its textured edge.
- 2026-09-09: Unified responsive visuals; readable HUD and landscape; clarified onboarding, rewards and garage; painted board objects; complete audio registry; remediation report and screenshots
- 2026-09-09: Resolved consumer-audit findings A01–A15; added harmonized board art and missing audio; completed fresh visual QA and full e2e acceptance.
- 2026-09-08: Completed the consumer audit with reusable prompt, evidence captures and 15 findings.
