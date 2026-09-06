export const VX2_BUILD = Object.freeze({
  name: 'VOXSTRIKE 2.0',
  channel: 'DEV',
  milestone: 'Foundation + Quality Pass 01',
  version: '2.0.0-dev.1',
});

export const FEEDBACK_TIMINGS = Object.freeze({
  shot: 72,
  hit: 110,
  kill: 280,
  damage: 180,
  objective: 360,
});

// This file is the first shared tuning module. As the monolith is extracted,
// weapon, movement, camera, AI and graphics values should move into modules
// like this instead of being duplicated inside UI or gameplay code.
