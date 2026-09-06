export const WEAPON_ORDER = ['carbine', 'pistol', 'shotgun'];

export const WEAPONS = {
  carbine: {
    id: 'carbine', name: 'VX-7 CARBINE', role: 'ASSAULT RIFLE', damage: 24,
    headMultiplier: 1.65, rate: 0.09, magSize: 30, reserve: 120, reload: 1.55,
    automatic: true, pellets: 1, rangeStart: 28, rangeEnd: 86, minDamage: 15,
    hipSpread: 0.014, moveSpread: 0.009, adsSpread: 0.0024, adsFov: 54, adsMoveScale: 0.72,
    recoil: { pitch: 0.021, yaw: 0.008, kick: 0.052, recovery: 15.5 },
    view: { x: 0.235, y: -0.205, z: -0.49, length: 0.94 },
    modelUrl: new URL('../../assets/guns/carbine.glb', import.meta.url).href,
    shotUrl: new URL('../../assets/sfx/shot_carbine.ogg', import.meta.url).href,
  },
  pistol: {
    id: 'pistol', name: 'P9 SIDEARM', role: 'SIDEARM', damage: 34,
    headMultiplier: 1.75, rate: 0.19, magSize: 12, reserve: 60, reload: 1.08,
    automatic: false, pellets: 1, rangeStart: 22, rangeEnd: 62, minDamage: 20,
    hipSpread: 0.010, moveSpread: 0.006, adsSpread: 0.0018, adsFov: 61, adsMoveScale: 0.82,
    recoil: { pitch: 0.032, yaw: 0.012, kick: 0.043, recovery: 17.5 },
    view: { x: 0.205, y: -0.22, z: -0.43, length: 0.36 },
    modelUrl: new URL('../../assets/guns/pistol.glb', import.meta.url).href,
    shotUrl: new URL('../../assets/sfx/shot_pistol.ogg', import.meta.url).href,
  },
  shotgun: {
    id: 'shotgun', name: 'BRUTE-12', role: 'COMBAT SHOTGUN', damage: 14,
    headMultiplier: 1.25, rate: 0.72, magSize: 6, reserve: 30, reload: 1.95,
    automatic: false, pellets: 8, rangeStart: 8, rangeEnd: 34, minDamage: 5,
    hipSpread: 0.060, moveSpread: 0.018, adsSpread: 0.032, adsFov: 64, adsMoveScale: 0.76,
    recoil: { pitch: 0.075, yaw: 0.020, kick: 0.095, recovery: 12.5 },
    view: { x: 0.25, y: -0.205, z: -0.53, length: 0.96 },
    modelUrl: new URL('../../assets/guns/shotgun.glb', import.meta.url).href,
    shotUrl: new URL('../../assets/sfx/shot_shotgun.ogg', import.meta.url).href,
  },
};

export const RELOAD_URL = new URL('../../assets/sfx/reload.ogg', import.meta.url).href;
export const HIT_URL = new URL('../../assets/sfx/hit.ogg', import.meta.url).href;
export const HEADSHOT_URL = new URL('../../assets/sfx/headshot.ogg', import.meta.url).href;

export function damageAtDistance(weapon, distance) {
  if (distance <= weapon.rangeStart) return weapon.damage;
  if (distance >= weapon.rangeEnd) return weapon.minDamage;
  const t = (distance - weapon.rangeStart) / (weapon.rangeEnd - weapon.rangeStart);
  return weapon.damage + (weapon.minDamage - weapon.damage) * t;
}
