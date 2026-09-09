# Design QA — «Совет деда» + новый транспорт

> Historical narrow implementation review. The broader 2026-09-08 [consumer audit](CONSUMER_AUDIT_REPORT.md) supersedes the acceptance conclusion below: it found hidden yard progression, HUD readability and other actionable issues. Prior successful automated checks remain historical evidence, not proof of consumer readiness.

## Evidence

- Source visual truth: `/Users/turpal/.codex/generated_images/01a06c20-d899-7451-b867-19ed22539955/exec-d47ef742-96d4-4fda-a3e4-0ea994c07308.png` (1672 × 941 px, RGB).
- Menu implementation: `design-audit/2026-09-07/menu-1536.png` (1536 × 1024 px) and `design-audit/2026-09-07/menu-825.png` (825 × 970 px).
- Vehicle implementation: `design-audit/2026-09-08/level-3-truck-1280x720.png` (1280 × 720 px) and `design-audit/2026-09-08/level-4-tractor-1536x1024.png` (1536 × 1024 px).
- Implementation URL: `http://localhost:4173/?mock=1&lang=ru&season=none&daytime=evening`.
- State: Russian, evening yard, no seasonal event; existing local mock campaign progress. Browser captures use CSS viewport equal to the recorded pixel size and density 1; no density normalization was needed.

## Findings

- P0: none.
- P1: none.
- P2: none after pass 3.
- P3: the live title uses the project's existing heavy sans treatment instead of the reference's more dimensional hand-painted lettering. It remains readable and keeps the intended hierarchy; a dedicated Cyrillic display face could improve fidelity later.

## Required fidelity surfaces

- Fonts and typography: title, chapter, CTA, labels, and small metadata have clear weight and scale separation with no clipping or unintended wrapping at either menu viewport. The remaining display-face difference is recorded as P3.
- Spacing and layout rhythm: the wide view preserves the reference's left character/right action composition. At 825 × 970 the character now stays entirely above the cream action panel and no longer overlaps progress or CTA. Radii, elevation, and gaps remain internally consistent.
- Colors and visual tokens: warm sunset, cream surfaces, dark brown text, yellow chapter marker, and red primary CTA follow the selected direction with sufficient foreground separation.
- Image quality and asset fidelity: the yard and grandfather are real raster assets. Target car, regular cars, hay truck, and tractor render sharply with correct aspect ratios, clean transparent edges, and no visible halos, stretching, or clipping.
- Copy and content: title, chapter, progress, CTA, grandfather prompt, event labels, and level hints are coherent in Russian. Product-required secondary actions remain available.
- Icons and interaction states: settings, map, pause, undo, restart, and hint controls remain legible; disabled undo is visibly distinct. Browser console contained no errors or warnings during the vehicle checks.
- Accessibility and responsiveness: semantic buttons and labels remain present; focus navigation and reduced-motion behavior are covered by the existing e2e suite. The 825 × 970 overlap regression is resolved.

## Full-view comparison evidence

- At 1536 × 1024, the implementation keeps the same sunset yard, large grandfather on the left, title in the upper-left region, vehicle in the yard, and primary action surface on the right.
- The live product retains daily gift, achievements, quests, weekly goals, leaderboard, and garage access, so its right-side surface is denser than the concept. This is an intentional product constraint rather than unfinished fidelity work.
- At 825 × 970, the responsive composition keeps the yard and character visually dominant while moving all interaction into the lower cream panel; no persistent control is hidden.

## Focused-region comparison evidence

- Menu character/title region: the grandfather remains fully visible in both desktop layouts; the blue yard car stays subordinate to the title and CTA.
- Level 3: target car, regular car, and vertical hay truck fill their SVG piece bounds consistently without transparent-margin shrinkage.
- Level 4: target car, three regular-car colors, and horizontal tractor/hay trailer share a consistent top-down scale and lighting direction.

## Comparison history

### Pass 1

- P1: the wooden chapter surface showed only campaign progress, weakening the selected reference's chapter hierarchy.
- P2: the new desktop geometry changed spatial focus selection on Android TV.
- Fixes: added the chapter title to the wooden surface; scoped the cinematic desktop layout away from TV so the proven remote-control layout and focus graph remain intact.

### Pass 2

- No actionable P0/P1/P2 findings in the wide layout.
- Retained constraints: progression-aware SVG yard details remain as the semantic/testing layer; secondary product actions remain directly reachable; compact portrait, low-landscape, and TV layouts retain their existing structures.

### Pass 3

- P2: at 825 × 970 the grandfather overlapped the progress copy and primary CTA.
- Fix: changed the 700–1099 px menu layout to a two-row grid and anchored the character and hero to the artwork row above the action panel.
- Post-fix evidence: `design-audit/2026-09-07/menu-825.png`; the character ends at the panel boundary and both progress text and CTA are unobstructed.
- Vehicle evidence: levels 3 and 4 confirm correct live-board scale and transparent margins for all four new transport asset families.

## Interaction verification

- Settings opens and closes.
- Level map opens and returns to the menu.
- Primary CTA and level-map buttons start playable levels; the in-game back control returns to the menu.
- Levels 3 and 4 load with their normal HUD and controls.
- Android TV focus, Enter, back, and exit scenarios are covered by e2e.
- No browser runtime errors or warnings were observed during the final visual checks.

## Automated verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 543 passed.
- `npm run build`: passed.
- `npm run e2e`: 272 passed, 1 skipped.

final result: passed
