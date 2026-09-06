# VOXSTRIKE 2.0 Development Track

Branch: `dev/voxstrike-2.0`

`main` remains the current working game and is intentionally untouched while 2.0 is developed.

## Foundation milestone

VOXSTRIKE 2.0 now has a reproducible Vite build and a separate `vx2.html` entry point. `/index.html` remains the classic monolithic game; `/vx2.html` is the modular 2.0 development runtime.

Run locally with Node 20.19+:

```bash
npm install
npm run dev
```

Open `/vx2.html` for the 2.0 vertical slice. `/index.html` remains the classic build.

Create a production build with:

```bash
npm run build
```

## Combat Slice 02 — Greenfield Deathmatch

The second pass moves beyond presentation and begins the real gameplay extraction.

### Extracted systems

- `src/gameplay/weapon-defs.js` owns weapon balance, damage falloff, spread, recoil and first-person weapon offsets.
- `src/gameplay/first-person-feel.js` owns recoil recovery, kickback, camera impulse, sway, bob, landing response, sprint FOV and ADS FOV.
- `src/vertical-slice/greenfield.js` is a standalone Deathmatch runtime using modern ES modules and npm Three.js instead of the r128 CDN monolith.
- `src/vertical-slice/greenfield.css` contains the focused slice HUD and mobile control layer.

### Current vertical-slice scope

- Greenfield only
- Deathmatch only
- VX-7 Carbine, P9 Sidearm and BRUTE-12 Shotgun
- Existing GLB weapon assets and recorded SFX reused through the Vite asset pipeline
- Acceleration/deceleration movement, sprint, jump, ADS and weapon switching
- Weapon-specific recoil, spread, fire rate, reload, damage falloff and handling
- Separate first-person viewmodel scene
- Authored Greenfield combat lanes and landmarks rather than randomized building placement
- Six combat bots with strafing, pursuit, line-of-sight fire, damage and respawns
- Headshots, hit feedback, tracers, impacts, kill feed, score, deaths and five-minute match flow
- Desktop pointer-lock input plus a mobile movement/look/fire/ADS/reload/swap layer

## Extraction order

1. Shared configuration and tuning — started
2. Renderer and scene lifecycle — started in the vertical slice
3. Input and player controller — started in the vertical slice
4. Weapons and first-person viewmodels — active milestone
5. Audio and combat feedback — active milestone
6. World generation and maps — Greenfield authored slice underway
7. Bots and AI
8. Game modes
9. Multiplayer
10. Progression and menus

The classic path stays available until the modular slice reaches feature parity and the quality target. No destructive rewrite is merged into `main`.

## 2.0 quality targets

- One polished Greenfield Deathmatch vertical slice before broad content expansion
- Stable 60 FPS target on capable mobile devices with graceful quality scaling
- Distinct recoil/handling identity per weapon
- Authored combat lanes, flanks, vertical routes, interiors and landmarks
- Smarter bots with navigation, memory, hearing, tactical cover and role behavior
- More authoritative online combat before competitive progression matters
- Modern Three.js runtime isolated from the classic r128 game until migration is safe

## Next pass

1. Browser playtest and frame-time profiling on desktop/mobile
2. Add crouch/slide/mantle to the modular controller
3. Improve bot navigation and cover selection
4. Add viewmodel reload/swap/muzzle animations and shell ejection
5. Add material-specific impact effects and stronger directional damage feedback
6. Refine Greenfield vertical routes and interior spaces from playtest results
