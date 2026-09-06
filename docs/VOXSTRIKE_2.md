# VOXSTRIKE 2.0 Development Track

Branch: `dev/voxstrike-2.0`

`main` remains the current working game and is intentionally untouched while 2.0 is developed.

## Foundation milestone

The first milestone introduces a reproducible Vite build, a separate `vx2.html` development entry point, shared tuning modules, and a non-destructive quality layer that runs the existing game underneath it. This lets us improve and test presentation while the 221 KB monolithic `index.html` is gradually extracted.

Run locally with Node 20.19+:

```bash
npm install
npm run dev
```

Open `/vx2.html` for the 2.0 preview. `/index.html` remains the classic build.

Create a production build with:

```bash
npm run build
```

## Quality Pass 01

The first playable pass deliberately avoids changing game rules. It upgrades the lobby/HUD visual hierarchy, reduces UI heaviness, improves contrast and glass treatment, adds subtle shot/hit/kill/damage feedback, and preserves desktop/mobile input because the original game remains the gameplay host.

## Extraction order

1. Shared configuration and tuning
2. Renderer and scene lifecycle
3. Input and player controller
4. Weapons and first-person viewmodels
5. Audio and combat feedback
6. World generation and maps
7. Bots and AI
8. Game modes
9. Multiplayer
10. Progression and menus

Each extraction must keep the previous playable path working. No large engine migration should be combined with a gameplay rewrite.

## 2.0 quality targets

- One polished Greenfield Deathmatch vertical slice before broad content expansion
- Stable 60 FPS target on capable mobile devices with graceful quality scaling
- Distinct recoil/handling identity per weapon
- Authored combat lanes, flanks, vertical routes, interiors and landmarks
- Smarter bots with navigation, memory, hearing, tactical cover and role behavior
- More authoritative online combat before competitive progression matters
- Modern Three.js migration only after systems are isolated enough to test safely
