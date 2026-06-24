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
3. Create leaderboards: `bubbleGalaxy`, `bubbleGalaxyEndless`, `bubbleGalaxyDaily`
4. Promo assets: `promo/*.svg` (convert to PNG for console)

## Game modes

- Campaign — 8 levels with stars
- Endless — infinite waves
- Daily — daily challenge
