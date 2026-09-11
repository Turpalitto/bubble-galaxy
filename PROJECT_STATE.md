# Project State

<!-- PROJECT-MEMORY-KIT:GENERATED -->
## Current status

The 128-level game is release-ready locally. Runtime art and audio remain in `public/`; historical audit captures and obsolete release archives are intentionally excluded from the repository.

## Working features

- Responsive illustrated menu with visible live yard progression on desktop, tablet, portrait phones, 320×568 and low landscape.
- Readable puzzle HUD, visible target identity, stronger grid, painted obstacles, safe onboarding overlays and enlarged landscape board.
- Explicit daily mechanics, garage car preview, labelled secondary actions and exact reward/hint amounts.
- Complete local sound registry: 20 files, including three grandpa mumbles and the gate sound in AAC/M4A.

## Verification

- Typecheck, lint, 546 unit tests and production build pass.
- Full Playwright: 274 passed, 1 expected desktop touch-only skip; desktop, mobile touch and WebKit projects covered.
- Solver shards and `npm run solve` confirm all 128 campaign levels; `verify:dist` accepts 41 production files (2390.3 KiB).
- New AAC files decode in Chromium through `AudioContext.decodeAudioData` as mono 48 kHz without errors.
- Submission screenshots remain in `screenshots/`; generated QA captures belong in ignored `test-results/` or `design-audit/` directories.

## Known limits

- Human listening approval for the synthesized effects is still separate from technical decode verification.
- Real-device touch and real Yandex ads/cloud remain external integration checks.
- Full subjective balance of all 128 levels was not re-rated; level data and core rules were not changed.

## Important constraints

- Preserve core rules, level solvability, save compatibility, Yandex SDK isolation, mobile/TV layouts, and direct access to secondary menu features.

## Recent significant changes

- 2026-09-11: Added body gait, alternating paws, breathing, blinking, ear twitches, looking around, stripes, bristling angry posture and a more expressive turn; made GameAudio.unlock await Safari resume; changed meow to a louder three-formant two-syllable sound; added suspended-context audio regression coverage.
- 2026-09-11: Turned the static yard cat into a lightweight animated SVG character on a dedicated responsive overlay; added walking route, stepping paws, direction changes, angry turn reaction, existing meow sound, pointer and keyboard activation, localized accessible labels, and regression tests.
- 2026-09-10: Removed historical audit media, obsolete reports and the 100-level release archive; added current async solver, Endless worker, audio and accessibility improvements
- 2026-09-10: Enabled viewport zoom and selectable form fields; added browser-safe async hints without a low state cap; moved endless generation to a worker with fallback; derived tutorial free-hint IDs from campaign metadata; added touchend audio unlock; extended regression tests.
- 2026-09-10: Prepared a clean primary-branch snapshot, removed historical audit media and obsolete release archives, and retained only current runtime/publishing assets.
- 2026-09-10: Added non-blocking Endless generation and hints, per-vehicle engine profiles, safer audio lifecycle handling, and browser accessibility fixes.
- 2026-09-09: Completed responsive visual, audio and gameplay polish for the current campaign.
