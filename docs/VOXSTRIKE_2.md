# VOXSTRIKE 2.0 Development Track

Branch: `dev/voxstrike-2.0`

`main` remains the current working game and is intentionally untouched while 2.0 is developed.

## Foundation milestone

VOXSTRIKE 2.0 has a reproducible Vite build and a separate `vx2.html` entry point. `/index.html` remains the classic monolithic game; `/vx2.html` is the modular 2.0 development runtime.

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

## Combat Slice 03 — Greenfield traversal, tactics and verticality

This pass deepens the Greenfield Deathmatch reference slice before Battle Royale or multiplayer are ported.

### Extracted systems

- `src/gameplay/weapon-defs.js` owns weapon balance, damage falloff, spread, recoil and first-person weapon offsets.
- `src/gameplay/first-person-feel.js` owns recoil recovery, kickback, camera impulse, sway, bob, landing response, sprint/ADS FOV, reload motion and weapon-swap motion.
- `src/gameplay/bot-tactics.js` owns reusable route-node, cover-node, target-memory and tactical-state decisions.
- `src/vertical-slice/greenfield-v3.js` is the current Greenfield Deathmatch runtime.
- `src/vertical-slice/greenfield.css` and `greenfield-v3.css` provide the HUD, mobile controls, traversal state and directional damage presentation.

### Current vertical-slice scope

- Greenfield only
- Deathmatch only
- VX-7 Carbine, P9 Sidearm and BRUTE-12 Shotgun
- Existing GLB weapon assets and recorded SFX reused through the Vite asset pipeline
- Acceleration/deceleration movement, sprint, jump, crouch, sprint-slide and contextual mantle
- Height-aware collision, step-up handling and walkable elevated surfaces
- Weapon-specific recoil, spread, fire rate, reload, damage falloff and handling
- Animated reload and swap motion rather than instantaneous viewmodel changes
- Muzzle flash and light impulse on shots
- Physical shell ejection with gravity/bounce/fade lifecycle
- Directional incoming-damage indicator based on attacker position
- Authored Greenfield combat lanes and landmarks rather than randomized building placement
- A walkable warehouse interior with mezzanine/stairs, an exterior tower route and an elevated catwalk route
- Six combat bots with target memory, route selection, cover selection, cover peeking, pursuit, disengage behavior and line-of-sight fire
- Headshots, hit feedback, tracers, impacts, kill feed, score, deaths and five-minute match flow
- Desktop pointer-lock controls plus mobile movement/look/fire/ADS/reload/swap/jump/crouch controls

## Extraction order

1. Shared configuration and tuning — started
2. Renderer and scene lifecycle — active in vertical slice
3. Input and player controller — active; traversal foundation added
4. Weapons and first-person viewmodels — active; action animation added
5. Audio and combat feedback — active; directional damage and shell/muzzle feedback added
6. World generation and maps — Greenfield authored vertical slice active
7. Bots and AI — active; routing/memory/cover foundation added
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
2. Fix any traversal collision or mantle edge cases found in playtest
3. Add material-specific impacts, footsteps and richer weapon audio layering
4. Improve bot vertical navigation and coordinated roles
5. Add richer character animation and hit reactions
6. Refine Greenfield routes from actual combat flow before porting Battle Royale or multiplayer
