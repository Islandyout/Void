import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './greenfield.css';
import { WEAPONS, WEAPON_ORDER, RELOAD_URL, HIT_URL, HEADSHOT_URL, damageAtDistance } from '../gameplay/weapon-defs.js';
import { FirstPersonFeel } from '../gameplay/first-person-feel.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const hud = $('hud');
const start = $('start');
const death = $('death');
const end = $('end');
const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.45 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86b9e4);
scene.fog = new THREE.Fog(0x9bc5e8, 62, 180);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 260);
camera.rotation.order = 'YXZ';

const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 10);
const weaponRig = new THREE.Group();
weaponScene.add(weaponRig);
weaponScene.add(new THREE.HemisphereLight(0xffffff, 0x314055, 1.3));
const weaponLight = new THREE.DirectionalLight(0xffe6c7, 2.0);
weaponLight.position.set(2, 3, 2);
weaponScene.add(weaponLight);
const feel = new FirstPersonFeel(camera, weaponRig);

scene.add(new THREE.HemisphereLight(0xdff2ff, 0x496642, 1.22));
const sun = new THREE.DirectionalLight(0xffe4b8, 2.15);
sun.position.set(72, 48, 34);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
sun.shadow.camera.left = -85;
sun.shadow.camera.right = 85;
sun.shadow.camera.top = 85;
sun.shadow.camera.bottom = -85;
scene.add(sun);

const colliders = [];
const worldMeshes = [];
const botHitMeshes = [];
const tracers = [];
const impacts = [];
const raycaster = new THREE.Raycaster();
const loader = new GLTFLoader();

function mat(color, roughness = .82, metalness = .03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function addBox(x, z, w, h, d, color, y = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  worldMeshes.push(mesh);
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY: y + h });
  return mesh;
}
function addTree(x, z, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22 * scale, .3 * scale, 2.2 * scale, 6), mat(0x6f4a2d));
  trunk.position.set(x, 1.1 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.35 * scale, 3.2 * scale, 7), mat(0x2c9c64));
  crown.position.set(x, 3.1 * scale, z);
  crown.castShadow = true;
  scene.add(crown);
}
function buildGreenfield() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: 0x66a769, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  worldMeshes.push(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x8b765e, roughness: 1 });
  for (const [x, z, w, d, r = 0] of [[0,0,10,196,0],[0,0,196,8,0],[-42,34,60,6,-.4],[46,-30,48,6,.45]]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = r;
    road.position.set(x, .012, z);
    road.receiveShadow = true;
    scene.add(road);
  }
  const water = new THREE.Mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshStandardMaterial({ color: 0x2b86b5, transparent: true, opacity: .76, roughness: .25, metalness: .08 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(67, .025, 34);
  scene.add(water);

  addBox(0, 0, 5, 4.6, 5, 0xc9744f);
  addBox(-10, -7, 7, 2.2, 2.5, 0x6b7785);
  addBox(10, 7, 7, 2.2, 2.5, 0x6b7785);
  addBox(-10, 8, 2.5, 2.2, 7, 0x6b7785);
  addBox(10, -8, 2.5, 2.2, 7, 0x6b7785);

  addBox(-43, 31, 14, 6.5, 11, 0xd06e4e);
  addBox(-58, 42, 11, 5.5, 10, 0xef9b54);
  addBox(-31, 48, 10, 5, 14, 0xb85d49);
  addBox(-48, 16, 8, 2.2, 3, 0x9b744d);
  addBox(-24, 27, 7, 2.2, 3, 0x9b744d);

  addBox(52, -25, 8, 7, 8, 0x5e6671);
  addBox(52, -25, 15, 1.2, 15, 0x69727d, 7);
  for (const z of [-52,-41,-12,4]) addBox(42 + (z % 3) * 2, z, 8, 1.8, 2.4, 0x7a746d);

  addBox(-30, -55, 16, 4.5, 9, 0x6b8b87);
  addBox(8, -58, 13, 4.2, 8, 0x7b8392);
  addBox(31, -50, 12, 4.8, 10, 0x8b755d);
  addBox(-12, -38, 8, 1.7, 2.5, 0x7a746d);
  addBox(17, -35, 8, 1.7, 2.5, 0x7a746d);

  for (const [x,z,s] of [[-76,-25,1.2],[-70,7,1],[-78,57,1.25],[-19,72,1],[22,67,1.15],[75,-52,1.2],[78,-4,1.1],[52,62,1.05],[25,28,.9],[-16,29,.9]]) addTree(x,z,s);
}
buildGreenfield();

const spawns = [[-82,-72],[82,72],[-82,70],[82,-70],[-65,-5],[65,4],[-18,78],[20,-78],[-68,48],[70,-35]];
const player = { pos: new THREE.Vector3(-12,0,-42), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, grounded: true, alive: true, eye: 1.72 };
const input = { forward: 0, strafe: 0, sprint: false, jump: false, fire: false, firePressed: false, ads: false };
const keys = new Set();
let running = false;
let matchTime = 300;
let kills = 0;
let score = 0;
let deaths = 0;
let cooldown = 0;
let reloadT = 0;
let reloading = false;
let ads = 0;
let currentWeapon = 'carbine';
const ammo = Object.fromEntries(WEAPON_ORDER.map(id => [id, { mag: WEAPONS[id].magSize, reserve: WEAPONS[id].reserve }]));
const audioCache = new Map();

function playAudio(url, volume = .7, rate = 1) {
  if (!url) return;
  let base = audioCache.get(url);
  if (!base) {
    base = new Audio(url);
    base.preload = 'auto';
    audioCache.set(url, base);
  }
  const a = base.cloneNode();
  a.volume = volume;
  a.playbackRate = rate;
  a.play().catch(() => {});
}
function pulseBody(cls, ms) {
  document.body.classList.remove(cls);
  requestAnimationFrame(() => {
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), ms);
  });
}
function killFeed(text, head = false) {
  const e = document.createElement('div');
  e.className = 'kill' + (head ? ' head' : '');
  e.textContent = text;
  $('killfeed').append(e);
  setTimeout(() => e.remove(), 3000);
  while ($('killfeed').children.length > 5) $('killfeed').firstChild.remove();
}
function hitMarker(head = false) {
  const c = $('crosshair');
  c.classList.add('hit');
  setTimeout(() => c.classList.remove('hit'), head ? 145 : 95);
  playAudio(head ? HEADSHOT_URL : HIT_URL, head ? .8 : .55, head ? 1.04 : 1);
}

function canOccupy(x, z, radius = .43) {
  if (Math.abs(x) > 105 || Math.abs(z) > 105) return false;
  for (const c of colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ && c.maxY > .15) return false;
  }
  return true;
}
function moveEntity(pos, dx, dz, radius = .43) {
  if (canOccupy(pos.x + dx, pos.z, radius)) pos.x += dx;
  if (canOccupy(pos.x, pos.z + dz, radius)) pos.z += dz;
}
function randomSpawn(awayFrom = player.pos, minDist = 25) {
  const choices = spawns.map(([x,z]) => new THREE.Vector3(x,0,z)).filter(p => p.distanceTo(awayFrom) >= minDist && canOccupy(p.x,p.z,.6));
  return (choices[Math.floor(Math.random() * choices.length)] || new THREE.Vector3(0,0,-75)).clone();
}

function makeBot(i) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.72,.92,.42), mat([0xcf5f58,0x4f83cc,0xc99543,0x7d62c7,0x3ba878,0xbc658f][i%6]));
  body.position.y = 1.18;
  const head = new THREE.Mesh(new THREE.BoxGeometry(.48,.48,.48), mat(0xf0c36a));
  head.position.y = 1.88;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.62,.72,.38), mat(0x35475f));
  legs.position.y = .4;
  for (const m of [body,head,legs]) m.castShadow = true;
  group.add(legs, body, head);
  scene.add(group);
  const bot = { id:i, name:['Brick','Nova','Rook','Hex','Mako','Vex'][i], group, body, head, hp:100, alive:true, pos:randomSpawn(player.pos,35), shootCd:.7+Math.random(), strafe:i%2?1:-1, respawn:0 };
  group.position.copy(bot.pos);
  for (const [mesh, part] of [[body,'body'],[head,'head'],[legs,'legs']]) {
    mesh.userData.bot = bot;
    mesh.userData.part = part;
    botHitMeshes.push(mesh);
  }
  return bot;
}
const bots = Array.from({ length: 6 }, (_, i) => makeBot(i));

function lineOfSight(from, to) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  raycaster.set(from, dir);
  raycaster.far = Math.max(.1, dist - .3);
  return raycaster.intersectObjects(worldMeshes, false).length === 0;
}
function respawnBot(bot) {
  bot.hp = 100;
  bot.alive = true;
  bot.pos.copy(randomSpawn(player.pos,34));
  bot.group.position.copy(bot.pos);
  bot.group.visible = true;
  bot.shootCd = .7 + Math.random() * .8;
}
function updateBots(dt) {
  for (const bot of bots) {
    if (!bot.alive) {
      bot.respawn -= dt;
      if (bot.respawn <= 0) respawnBot(bot);
      continue;
    }
    const toPlayer = player.pos.clone().sub(bot.pos);
    const dist = toPlayer.length();
    const dir = toPlayer.normalize();
    const side = new THREE.Vector3(dir.z,0,-dir.x).multiplyScalar(bot.strafe);
    let mx = 0, mz = 0;
    if (dist > 16) { mx += dir.x * 2.8 * dt; mz += dir.z * 2.8 * dt; }
    if (dist < 42 && dist > 7) { mx += side.x * 1.35 * dt; mz += side.z * 1.35 * dt; }
    moveEntity(bot.pos, mx, mz, .48);
    bot.group.position.copy(bot.pos);
    bot.group.rotation.y = Math.atan2(player.pos.x - bot.pos.x, player.pos.z - bot.pos.z);
    if (Math.random() < dt * .3) bot.strafe *= -1;
    bot.shootCd -= dt;
    if (player.alive && dist < 48 && bot.shootCd <= 0 && lineOfSight(bot.pos.clone().setY(1.6), camera.position)) {
      bot.shootCd = .65 + Math.random() * .7;
      const hit = Math.random() < THREE.MathUtils.clamp(.72 - dist / 100, .28, .68);
      const target = camera.position.clone();
      if (!hit) target.add(new THREE.Vector3((Math.random()-.5)*3,(Math.random()-.5)*2,(Math.random()-.5)*3));
      spawnTracer(bot.pos.clone().setY(1.45), target, 0xff6b68, .08);
      if (hit) damagePlayer(7 + Math.floor(Math.random()*5));
    }
  }
}

function damagePlayer(amount) {
  if (!player.alive) return;
  player.hp = Math.max(0, player.hp - amount);
  pulseBody('damaged',150);
  updateHud();
  if (player.hp <= 0) {
    player.alive = false;
    deaths++;
    input.fire = false;
    death.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
function respawnPlayer() {
  player.pos.copy(randomSpawn(new THREE.Vector3(0,0,0),0));
  player.vel.set(0,0,0);
  player.hp = 100;
  player.alive = true;
  death.classList.add('hidden');
  updateHud();
  if (!coarse && running) canvas.requestPointerLock();
}

const weaponModels = new Map();
function fallbackGun(weapon) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.07,.09,weapon.id==='pistol'?.3:.65), new THREE.MeshStandardMaterial({ color:0x29313d, metalness:.45, roughness:.48 }));
  body.position.z = -.12;
  g.add(body);
  const accent = new THREE.Mesh(new THREE.BoxGeometry(.045,.055,.08), new THREE.MeshStandardMaterial({ color:0xffb020, metalness:.25, roughness:.5 }));
  accent.position.set(0,-.07,.03);
  g.add(accent);
  return g;
}
async function loadWeaponModel(id) {
  const weapon = WEAPONS[id];
  weaponRig.clear();
  let holder = weaponModels.get(id);
  if (!holder) {
    try {
      const gltf = await loader.loadAsync(weapon.modelUrl);
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      holder = new THREE.Group();
      holder.add(model);
      if (size.x > size.z) holder.rotation.y = Math.PI / 2;
      holder.scale.setScalar(weapon.view.length / Math.max(size.x,size.z));
      model.traverse(o => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.roughness = .46;
          o.material.metalness = .3;
        }
      });
      weaponModels.set(id, holder);
    } catch {
      holder = fallbackGun(weapon);
      weaponModels.set(id, holder);
    }
  }
  weaponRig.add(holder.clone(true));
  weaponRig.position.set(weapon.view.x, weapon.view.y, weapon.view.z);
  weaponRig.rotation.set(0,.035,0);
  updateHud();
}

function switchWeapon(id) {
  if (!WEAPONS[id] || id === currentWeapon) return;
  currentWeapon = id;
  reloading = false;
  reloadT = 0;
  cooldown = .16;
  loadWeaponModel(id);
  updateHud();
}
function cycleWeapon() {
  const i = WEAPON_ORDER.indexOf(currentWeapon);
  switchWeapon(WEAPON_ORDER[(i+1)%WEAPON_ORDER.length]);
}
function reload() {
  const w = WEAPONS[currentWeapon], a = ammo[currentWeapon];
  if (reloading || a.mag >= w.magSize || a.reserve <= 0 || !player.alive) return;
  reloading = true;
  reloadT = w.reload;
  playAudio(RELOAD_URL,.55,1);
}
function finishReload() {
  const w = WEAPONS[currentWeapon], a = ammo[currentWeapon];
  const need = w.magSize - a.mag;
  const take = Math.min(need,a.reserve);
  a.mag += take;
  a.reserve -= take;
  reloading = false;
  reloadT = 0;
  updateHud();
}
function spawnTracer(from,to,color=0xffd078,life=.055) {
  const g = new THREE.BufferGeometry().setFromPoints([from,to]);
  const l = new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));
  scene.add(l);
  tracers.push({mesh:l,t:life,life});
}
function spawnImpact(p) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.055,6,6),new THREE.MeshBasicMaterial({color:0xffdf9e,transparent:true,opacity:.9}));
  m.position.copy(p);
  scene.add(m);
  impacts.push({mesh:m,t:.18});
}
function fire() {
  const w = WEAPONS[currentWeapon], a = ammo[currentWeapon];
  if (!player.alive || reloading || cooldown > 0) return;
  if (a.mag <= 0) { reload(); return; }
  a.mag--;
  cooldown = w.rate;
  feel.onShot(w,ads);
  playAudio(w.shotUrl,currentWeapon==='shotgun'?.85:.68,.96+Math.random()*.08);
  pulseBody('shot',70);
  updateHud();
  const shots = w.pellets || 1;
  for (let i=0;i<shots;i++) {
    raycaster.setFromCamera({x:0,y:0},camera);
    const dir = raycaster.ray.direction.clone();
    const spread = THREE.MathUtils.lerp(w.hipSpread + (player.vel.length()>1?w.moveSpread:0),w.adsSpread,ads);
    dir.x += (Math.random()-.5)*spread*2;
    dir.y += (Math.random()-.5)*spread*2;
    dir.z += (Math.random()-.5)*spread*2;
    dir.normalize();
    raycaster.set(camera.position,dir);
    raycaster.far = 170;
    const hits = raycaster.intersectObjects([...botHitMeshes,...worldMeshes],false);
    let endPoint = camera.position.clone().addScaledVector(dir,145);
    for (const h of hits) {
      const bot = h.object.userData.bot;
      if (bot && !bot.alive) continue;
      endPoint = h.point.clone();
      if (bot) {
        const part = h.object.userData.part;
        const head = part === 'head';
        const base = damageAtDistance(w,h.distance);
        const mult = head ? w.headMultiplier : part === 'legs' ? .75 : 1;
        bot.hp -= Math.round(base * mult);
        hitMarker(head);
        if (bot.hp <= 0) {
          bot.alive = false;
          bot.group.visible = false;
          bot.respawn = 3.2;
          kills++;
          score += head ? 150 : 100;
          killFeed(`You eliminated ${bot.name}`,head);
        }
      } else spawnImpact(h.point);
      break;
    }
    spawnTracer(camera.position.clone().addScaledVector(dir,.6),endPoint);
  }
  if (a.mag === 0 && a.reserve > 0) setTimeout(() => { if (ammo[currentWeapon].mag === 0) reload(); },180);
}

const touchMove = { active:false, id:null, x:0, y:0 };
function updateInput() {
  input.forward = (keys.has('KeyW')?1:0) - (keys.has('KeyS')?1:0);
  input.strafe = (keys.has('KeyD')?1:0) - (keys.has('KeyA')?1:0);
  if (touchMove.active) { input.forward = -touchMove.y; input.strafe = touchMove.x; }
  input.sprint = keys.has('ShiftLeft') || (touchMove.active && -touchMove.y > .78);
}
function updatePlayer(dt) {
  updateInput();
  const w = WEAPONS[currentWeapon];
  const moveLen = Math.hypot(input.forward,input.strafe);
  const sprinting = input.sprint && input.forward > .15 && ads < .15;
  const maxSpeed = (sprinting?9.2:6.1) * THREE.MathUtils.lerp(1,w.adsMoveScale,ads);
  const forward = new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const desired = forward.multiplyScalar(input.forward).add(right.multiplyScalar(input.strafe));
  if (desired.lengthSq()>1) desired.normalize();
  desired.multiplyScalar(maxSpeed);
  const accel = moveLen>.01 ? (player.grounded?18:7) : 14;
  player.vel.x = THREE.MathUtils.lerp(player.vel.x,desired.x,1-Math.exp(-accel*dt));
  player.vel.z = THREE.MathUtils.lerp(player.vel.z,desired.z,1-Math.exp(-accel*dt));
  if (input.jump && player.grounded) { player.vel.y=7.2; player.grounded=false; input.jump=false; }
  player.vel.y -= 20*dt;
  const wasGrounded = player.grounded;
  moveEntity(player.pos,player.vel.x*dt,player.vel.z*dt,.43);
  player.pos.y += player.vel.y*dt;
  if (player.pos.y<=0) {
    player.pos.y=0;
    player.vel.y=0;
    player.grounded=true;
    if (!wasGrounded) feel.onLand(1);
  } else player.grounded=false;
  ads = THREE.MathUtils.lerp(ads,input.ads?1:0,1-Math.exp(-14*dt));
  const offsets = feel.update(dt,{weapon:w,ads,moving:moveLen>.05,sprinting,grounded:player.grounded,speed01:THREE.MathUtils.clamp(player.vel.length()/9.2,0,1),strafing:input.strafe});
  camera.position.set(player.pos.x,player.pos.y+player.eye,player.pos.z);
  camera.rotation.y = player.yaw + offsets.yaw;
  camera.rotation.x = player.pitch + offsets.pitch;
  camera.rotation.z = offsets.roll;
  const spreadPx = 5 + (moveLen>.05?5:0) + (sprinting?5:0);
  $('crosshair').style.setProperty('--gap',`${THREE.MathUtils.lerp(spreadPx,3,ads)}px`);
}
function updateCombat(dt) {
  cooldown -= dt;
  if (reloading) { reloadT -= dt; if (reloadT<=0) finishReload(); }
  const w = WEAPONS[currentWeapon];
  if (input.fire && (w.automatic || input.firePressed)) { fire(); input.firePressed=false; }
  if (!input.fire) input.firePressed=false;
}
function updateFx(dt) {
  for (let i=tracers.length-1;i>=0;i--) {
    const t=tracers[i];
    t.t-=dt;
    t.mesh.material.opacity=Math.max(0,t.t/t.life);
    if (t.t<=0) { scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); tracers.splice(i,1); }
  }
  for (let i=impacts.length-1;i>=0;i--) {
    const p=impacts[i];
    p.t-=dt;
    p.mesh.scale.multiplyScalar(1+dt*7);
    p.mesh.material.opacity=Math.max(0,p.t/.18);
    if (p.t<=0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); impacts.splice(i,1); }
  }
}
function updateHud() {
  const w=WEAPONS[currentWeapon], a=ammo[currentWeapon];
  $('kills').textContent=kills;
  $('score').textContent=score;
  $('hpLabel').textContent=Math.ceil(player.hp);
  $('hpFill').style.width=`${player.hp}%`;
  $('weaponRole').textContent=w.role;
  $('weaponName').textContent=w.name;
  $('ammo').innerHTML=`${a.mag} <small>/ ${a.reserve}${reloading?' · RLD':''}</small>`;
  $('weaponStrip').innerHTML=WEAPON_ORDER.map((id,i)=>`<div class="wslot ${id===currentWeapon?'active':''}">${i+1} ${WEAPONS[id].name}</div>`).join('');
}
function formatTime(t) {
  const m=Math.floor(Math.max(0,t)/60), s=Math.floor(Math.max(0,t)%60);
  return `${m}:${String(s).padStart(2,'0')}`;
}
function endMatch() {
  running=false;
  hud.classList.add('hidden');
  end.classList.remove('hidden');
  $('endStats').textContent=`${kills} eliminations · ${score} score · ${deaths} deaths`;
  $('endTitle').textContent=kills>=12?'DOMINANT':'GREENFIELD COMPLETE';
  if(document.pointerLockElement) document.exitPointerLock();
}
function resetMatch() {
  matchTime=300;
  kills=0;
  score=0;
  deaths=0;
  for(const id of WEAPON_ORDER) { ammo[id].mag=WEAPONS[id].magSize; ammo[id].reserve=WEAPONS[id].reserve; }
  currentWeapon='carbine';
  for(const b of bots) respawnBot(b);
  respawnPlayer();
  loadWeaponModel(currentWeapon);
  updateHud();
}
function startMatch() {
  start.classList.add('hidden');
  end.classList.add('hidden');
  death.classList.add('hidden');
  hud.classList.remove('hidden');
  running=true;
  resetMatch();
  if(!coarse) canvas.requestPointerLock();
  else document.documentElement.requestFullscreen?.({navigationUI:'hide'}).catch(()=>{});
}

$('deploy').addEventListener('click',startMatch);
$('respawn').addEventListener('click',respawnPlayer);
$('again').addEventListener('click',startMatch);
addEventListener('keydown',e=>{
  keys.add(e.code);
  if(e.code==='Space'){input.jump=true;e.preventDefault();}
  if(e.code==='KeyR')reload();
  if(e.code==='Digit1')switchWeapon('carbine');
  if(e.code==='Digit2')switchWeapon('pistol');
  if(e.code==='Digit3')switchWeapon('shotgun');
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==canvas||!player.alive)return;
  const sens=.0022*(ads>.5?.72:1);
  player.yaw-=e.movementX*sens;
  player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*sens,-1.45,1.45);
  feel.onLook(e.movementX,e.movementY);
});
canvas.addEventListener('mousedown',e=>{
  if(!running||!player.alive)return;
  if(document.pointerLockElement!==canvas&&!coarse){canvas.requestPointerLock();return;}
  if(e.button===0){input.fire=true;input.firePressed=true;}
  if(e.button===2)input.ads=true;
});
addEventListener('mouseup',e=>{if(e.button===0)input.fire=false;if(e.button===2)input.ads=false;});
addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('click',()=>{if(running&&!coarse&&player.alive&&document.pointerLockElement!==canvas)canvas.requestPointerLock();});

const movePad=$('movePad'), moveKnob=$('moveKnob'), lookPad=$('lookPad');
let lookId=null,lastLookX=0,lastLookY=0;
movePad.addEventListener('pointerdown',e=>{touchMove.active=true;touchMove.id=e.pointerId;movePad.setPointerCapture(e.pointerId);});
movePad.addEventListener('pointermove',e=>{
  if(!touchMove.active||e.pointerId!==touchMove.id)return;
  const r=movePad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=e.clientX-cx,dy=e.clientY-cy;
  const max=r.width*.34,len=Math.hypot(dx,dy);
  if(len>max){dx=dx/len*max;dy=dy/len*max;}
  touchMove.x=dx/max;touchMove.y=dy/max;
  moveKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
});
function endMove(e){
  if(e.pointerId!==touchMove.id)return;
  touchMove.active=false;touchMove.id=null;touchMove.x=touchMove.y=0;
  moveKnob.style.transform='translate(-50%,-50%)';
}
movePad.addEventListener('pointerup',endMove);
movePad.addEventListener('pointercancel',endMove);
lookPad.addEventListener('pointerdown',e=>{lookId=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;lookPad.setPointerCapture(e.pointerId);});
lookPad.addEventListener('pointermove',e=>{
  if(e.pointerId!==lookId||!player.alive)return;
  const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;
  player.yaw-=dx*.0044;
  player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.0044,-1.45,1.45);
  feel.onLook(dx,dy);
  lastLookX=e.clientX;lastLookY=e.clientY;
});
lookPad.addEventListener('pointerup',e=>{if(e.pointerId===lookId)lookId=null;});
function bindHold(el,on,off){
  el.addEventListener('pointerdown',e=>{e.stopPropagation();el.setPointerCapture(e.pointerId);on();});
  el.addEventListener('pointerup',e=>{e.stopPropagation();off?.();});
  el.addEventListener('pointercancel',()=>off?.());
}
bindHold($('fireBtn'),()=>{input.fire=true;input.firePressed=true;},()=>input.fire=false);
bindHold($('adsBtn'),()=>input.ads=true,()=>input.ads=false);
$('reloadBtn').addEventListener('pointerdown',e=>{e.stopPropagation();reload();});
$('swapBtn').addEventListener('pointerdown',e=>{e.stopPropagation();cycleWeapon();});

addEventListener('resize',()=>{
  renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.45:2));
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  weaponCamera.aspect=innerWidth/innerHeight;weaponCamera.updateProjectionMatrix();
});

loadWeaponModel(currentWeapon);
updateHud();
let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min((now-last)/1000,.045);
  last=now;
  if(running){
    if(player.alive){updatePlayer(dt);updateCombat(dt);updateBots(dt);}
    matchTime-=dt;
    $('timer').textContent=formatTime(matchTime);
    if(matchTime<=0)endMatch();
  }
  updateFx(dt);
  renderer.clear();
  renderer.render(scene,camera);
  if(running&&player.alive){renderer.clearDepth();renderer.render(weaponScene,weaponCamera);}
}
requestAnimationFrame(loop);
