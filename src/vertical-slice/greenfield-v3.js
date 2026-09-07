import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './greenfield.css';
import { WEAPONS, WEAPON_ORDER, RELOAD_URL, HIT_URL, HEADSHOT_URL, damageAtDistance } from '../gameplay/weapon-defs.js';
import { FirstPersonFeel } from '../gameplay/first-person-feel.js';
import { chooseCoverNode, chooseRouteNode, tacticalState, updateTargetMemory } from '../gameplay/bot-tactics.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const hud = $('hud');
const start = $('start');
const death = $('death');
const end = $('end');
const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const clamp = THREE.MathUtils.clamp;
const damp = (a,b,k,dt) => THREE.MathUtils.lerp(a,b,1-Math.exp(-k*dt));

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.4 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86b9e4);
scene.fog = new THREE.Fog(0x9bc5e8, 68, 190);
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, .08, 280);
camera.rotation.order = 'YXZ';

const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .01, 10);
const weaponRig = new THREE.Group();
const weaponModelMount = new THREE.Group();
weaponRig.add(weaponModelMount);
weaponScene.add(weaponRig);
weaponScene.add(new THREE.HemisphereLight(0xffffff,0x314055,1.3));
const weaponLight = new THREE.DirectionalLight(0xffe6c7,2.0); weaponLight.position.set(2,3,2); weaponScene.add(weaponLight);
const feel = new FirstPersonFeel(camera,weaponRig);

scene.add(new THREE.HemisphereLight(0xdff2ff,0x496642,1.22));
const sun = new THREE.DirectionalLight(0xffe4b8,2.15); sun.position.set(72,48,34); sun.castShadow=true;
sun.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048); sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90; scene.add(sun);

const colliders=[], worldMeshes=[], botHitMeshes=[], tracers=[], impacts=[], shells=[];
const raycaster = new THREE.Raycaster();
const loader = new GLTFLoader();
const navNodes=[], coverNodes=[];

function mat(color,rough=.82,metal=.03){ return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal}); }
function addBox(x,z,w,h,d,color,y=0,options={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,options.roughness??.82,options.metalness??.03));
  mesh.position.set(x,y+h/2,z); mesh.castShadow=options.castShadow!==false; mesh.receiveShadow=true; scene.add(mesh); worldMeshes.push(mesh);
  if(options.collider!==false) colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:y,maxY:y+h,walkable:options.walkable!==false,tag:options.tag||'solid'});
  return mesh;
}
function addTree(x,z,s=1){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.3*s,2.2*s,6),mat(0x6f4a2d)); trunk.position.set(x,1.1*s,z); trunk.castShadow=true; scene.add(trunk); worldMeshes.push(trunk);
  const crown=new THREE.Mesh(new THREE.ConeGeometry(1.35*s,3.2*s,7),mat(0x2c9c64)); crown.position.set(x,3.1*s,z); crown.castShadow=true; scene.add(crown); worldMeshes.push(crown);
}
function addNav(x,z,y=0){ navNodes.push(new THREE.Vector3(x,y,z)); }
function addCover(x,z,y=0){ coverNodes.push(new THREE.Vector3(x,y,z)); }
function wallX(cx,z,w,h,color,y=0){ return addBox(cx,z,w,h,.45,color,y,{walkable:false}); }
function wallZ(x,cz,d,h,color,y=0){ return addBox(x,cz,.45,h,d,color,y,{walkable:false}); }

function buildWarehouse(cx,cz){
  const c=0x67737f, trim=0x44515d, floor=0x8b755d;
  wallX(cx-7,cz-9,10,4.6,c); wallX(cx+8,cz-9,8,4.6,c); wallX(cx-8,cz+9,8,4.6,c); wallX(cx+7,cz+9,10,4.6,c);
  wallZ(cx-12,cz,18,4.6,c); wallZ(cx+12,cz-5.5,7,4.6,c); wallZ(cx+12,cz+5.5,7,4.6,c);
  addBox(cx-5,cz,9,.28,16,floor,2.55,{metalness:.12});
  addBox(cx-5,cz-7.6,9,.35,1.2,trim,2.83); addBox(cx-5,cz+7.6,9,.35,1.2,trim,2.83);
  for(let i=0;i<6;i++) addBox(cx+8.7,cz+6.4-i*1.15,2.4,.42*(i+1),1.1,0x7f6b54,0,{tag:'stairs'});
  addBox(cx+4,cz-1.2,9.5,.28,3.2,floor,2.55,{metalness:.12,tag:'mezzanine-bridge'});
  addBox(cx-5,cz-4,2.2,1.1,2.2,0x866f55); addBox(cx+3,cz+3,2.2,1.1,2.2,0x866f55); addBox(cx+6,cz-3,2.2,1.1,2.2,0x866f55);
  addBox(cx-7.5,cz-6,4,.22,4,0x59636f,4.6); addBox(cx+6,cz+5,7,.22,5,0x59636f,4.6);
  addNav(cx,cz-11); addNav(cx+10,cz); addNav(cx,cz+11); addNav(cx-8,cz+4); addNav(cx+6,cz-5);
  addCover(cx-7,cz-4); addCover(cx+5,cz+5); addCover(cx+8,cz-4); addCover(cx-10,cz+7);
}
function buildTower(cx,cz){
  const c=0x5e6671;
  wallX(cx,cz-5.5,11,5.8,c); wallX(cx-3.5,cz+5.5,4,5.8,c); wallX(cx+4,cz+5.5,3,5.8,c); wallZ(cx-5.5,cz,11,5.8,c); wallZ(cx+5.5,cz,11,5.8,c);
  addBox(cx,cz,12,.35,12,0x69727d,6.0,{metalness:.15});
  for(let i=0;i<12;i++) addBox(cx+8.2,cz-7.2+i*1.05,2.4,.5*(i+1),1.0,0x7d746b,0,{tag:'stairs'});
  addBox(cx+5.8,cz+5.2,6,.25,2.2,0x69727d,5.75); addBox(cx+2,cz+3,2,1.1,2,0x806c55);
  addNav(cx+8,cz-10); addNav(cx+8,cz+8); addNav(cx,cz+8); addCover(cx+8,cz-3); addCover(cx-7,cz+3);
}
function buildCatwalk(cx,cz){
  addBox(cx,cz,18,.3,3.2,0x626d78,2.35,{metalness:.18});
  addBox(cx-7,cz,1.1,2.35,1.1,0x4f5863); addBox(cx+7,cz,1.1,2.35,1.1,0x4f5863);
  for(let i=0;i<5;i++) addBox(cx-10.2,cz-2.3+i*1.05,2.2,.48*(i+1),1,0x87725d,0,{tag:'stairs'});
  addBox(cx+8.2,cz,2.4,1.1,2.4,0x826d54); addCover(cx+9,cz+3); addCover(cx-8,cz-3); addNav(cx-11,cz); addNav(cx+11,cz);
}
function buildGreenfield(){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(220,220),new THREE.MeshStandardMaterial({color:0x66a769,roughness:1})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground); worldMeshes.push(ground);
  const roadMat=new THREE.MeshStandardMaterial({color:0x8b765e,roughness:1});
  for(const [x,z,w,d,r=0] of [[0,0,10,196,0],[0,0,196,8,0],[-42,34,60,6,-.4],[46,-30,48,6,.45]]){ const road=new THREE.Mesh(new THREE.PlaneGeometry(w,d),roadMat); road.rotation.x=-Math.PI/2; road.rotation.z=r; road.position.set(x,.012,z); road.receiveShadow=true; scene.add(road); }
  const water=new THREE.Mesh(new THREE.CircleGeometry(16,40),new THREE.MeshStandardMaterial({color:0x2b86b5,transparent:true,opacity:.76,roughness:.25,metalness:.08})); water.rotation.x=-Math.PI/2; water.position.set(67,.025,34); scene.add(water);

  addBox(0,0,5,4.6,5,0xc9744f); addBox(-10,-7,7,1.15,2.5,0x6b7785); addBox(10,7,7,1.15,2.5,0x6b7785); addBox(-10,8,2.5,1.15,7,0x6b7785); addBox(10,-8,2.5,1.15,7,0x6b7785);
  addCover(-12,-7); addCover(12,7); addCover(-10,11); addCover(10,-11); addNav(-18,0); addNav(18,0); addNav(0,-18); addNav(0,18);

  addBox(-43,31,14,6.5,11,0xd06e4e); addBox(-58,42,11,5.5,10,0xef9b54); addBox(-31,48,10,5,14,0xb85d49);
  addBox(-48,16,8,1.15,3,0x9b744d); addBox(-24,27,7,1.15,3,0x9b744d); addCover(-48,13); addCover(-24,24); addNav(-42,22); addNav(-52,34); addNav(-28,38);

  buildTower(52,-25); buildWarehouse(-30,-55); buildCatwalk(18,-23);
  addBox(31,-50,12,4.8,10,0x8b755d); addBox(8,-58,10,4.2,8,0x7b8392); addBox(-12,-38,8,1.15,2.5,0x7a746d); addBox(17,-35,8,1.15,2.5,0x7a746d); addCover(-12,-35); addCover(17,-32);
  for(const z of [-52,-41,-12,4]){ const x=42+(z%3)*2; addBox(x,z,8,1.15,2.4,0x7a746d); addCover(x+5,z); }
  for(const [x,z,s] of [[-76,-25,1.2],[-70,7,1],[-78,57,1.25],[-19,72,1],[22,67,1.15],[75,-52,1.2],[78,-4,1.1],[52,62,1.05],[25,28,.9],[-16,29,.9]]) addTree(x,z,s);
  for(const [x,z] of [[-75,-35],[-72,10],[-64,52],[-32,70],[0,65],[35,55],[70,12],[78,-38],[42,-68],[0,-72],[-55,-70]]) addNav(x,z);
}
buildGreenfield();

const spawns=[[-82,-72],[82,72],[-82,70],[82,-70],[-65,-5],[65,4],[-18,78],[20,-78],[-68,48],[70,-35]];
const player={pos:new THREE.Vector3(-12,0,-42),vel:new THREE.Vector3(),yaw:0,pitch:0,hp:100,grounded:true,alive:true,eye:1.72,crouched:false,slideT:0,slideDir:new THREE.Vector3(),mantleT:0,mantleDur:.46,mantleFrom:new THREE.Vector3(),mantleTo:new THREE.Vector3()};
const input={forward:0,strafe:0,sprint:false,jump:false,fire:false,firePressed:false,ads:false,crouchHold:false,crouchToggle:false,crouchPressed:false};
const keys=new Set();
let running=false,matchTime=300,kills=0,score=0,deaths=0,cooldown=0,reloadT=0,reloading=false,ads=0,currentWeapon='carbine',switchT=0,flashT=0,damageDirTimer=0;
const ammo=Object.fromEntries(WEAPON_ORDER.map(id=>[id,{mag:WEAPONS[id].magSize,reserve:WEAPONS[id].reserve}]));
const audioCache=new Map();

function playAudio(url,volume=.7,rate=1){ if(!url)return; let base=audioCache.get(url); if(!base){base=new Audio(url);base.preload='auto';audioCache.set(url,base);} const a=base.cloneNode();a.volume=volume;a.playbackRate=rate;a.play().catch(()=>{}); }
function pulseBody(cls,ms){ document.body.classList.remove(cls); requestAnimationFrame(()=>{document.body.classList.add(cls);setTimeout(()=>document.body.classList.remove(cls),ms);}); }
function killFeed(text,head=false){ const e=document.createElement('div');e.className='kill'+(head?' head':'');e.textContent=text;$('killfeed').append(e);setTimeout(()=>e.remove(),3000);while($('killfeed').children.length>5)$('killfeed').firstChild.remove(); }
function hitMarker(head=false){ const c=$('crosshair');c.classList.add('hit');setTimeout(()=>c.classList.remove('hit'),head?145:95);playAudio(head?HEADSHOT_URL:HIT_URL,head?.8:.55,head?1.04:1); }

function overlapsXZ(c,x,z,r=.42){ return x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ; }
function floorAt(x,z,currentY,maxRise=.6,radius=.18){ let floor=0; for(const c of colliders){ if(!c.walkable||!overlapsXZ(c,x,z,radius))continue; if(c.maxY<=currentY+maxRise&&c.maxY>floor)floor=c.maxY; } return floor; }
function blockedAt(x,z,feetY,height,radius=.42){ if(Math.abs(x)>105||Math.abs(z)>105)return true; for(const c of colliders){ if(!overlapsXZ(c,x,z,radius))continue; if(c.maxY<=feetY+.06)continue; if(c.minY>=feetY+height-.05)continue; return true; } return false; }
function canOccupyGround(x,z,r=.45){ const y=floorAt(x,z,.1,.55); return !blockedAt(x,z,y,1.86,r); }
function moveEntity(entity,dx,dz,radius=.43,height=1.72,step=.55){
  const tryAxis=(axis,delta)=>{ if(!delta)return; const nx=axis==='x'?entity.pos.x+delta:entity.pos.x, nz=axis==='z'?entity.pos.z+delta:entity.pos.z; const f=floorAt(nx,nz,entity.pos.y,step,Math.max(.18,radius-.04)); let feet=entity.pos.y; if(entity.grounded&&f-entity.pos.y<=step&&f-entity.pos.y>=-.42)feet=f; if(!blockedAt(nx,nz,feet,height,radius)){ entity.pos[axis]+=delta; if(entity.grounded&&Math.abs(f-entity.pos.y)<=step)entity.pos.y=f; } };
  tryAxis('x',dx);tryAxis('z',dz);
}
function randomSpawn(away=player.pos,minDist=25){ const choices=spawns.map(([x,z])=>new THREE.Vector3(x,0,z)).filter(p=>p.distanceTo(away)>=minDist&&canOccupyGround(p.x,p.z,.6)); return (choices[Math.floor(Math.random()*choices.length)]||new THREE.Vector3(0,0,-75)).clone(); }
function pathReachable(from,to){ const dist=from.distanceTo(to),steps=Math.max(2,Math.ceil(dist/2.4));let y=from.y||0;for(let i=1;i<=steps;i++){const t=i/steps,x=THREE.MathUtils.lerp(from.x,to.x,t),z=THREE.MathUtils.lerp(from.z,to.z,t),f=floorAt(x,z,y,.56,.44);if(f-y>.56||f-y<-.5||blockedAt(x,z,f,1.86,.44))return false;y=f;}return true; }
function lineOfSight(from,to){ const dir=to.clone().sub(from),dist=dir.length();dir.normalize();raycaster.set(from,dir);raycaster.far=Math.max(.1,dist-.3);return raycaster.intersectObjects(worldMeshes,false).length===0; }

function findMantle(){ const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));const probe=player.pos.clone().addScaledVector(fwd,.78); for(const c of colliders){ if(!overlapsXZ(c,probe.x,probe.z,.18))continue; const rise=c.maxY-player.pos.y; if(rise<.58||rise>1.82)continue; const target=player.pos.clone().addScaledVector(fwd,1.75);target.y=c.maxY;if(!blockedAt(target.x,target.z,target.y,1.7,.38))return target;} return null; }
function startMantle(target){ player.mantleFrom.copy(player.pos);player.mantleTo.copy(target);player.mantleDur=target.y-player.pos.y>1.25?.58:.42;player.mantleT=player.mantleDur;player.vel.set(0,0,0);player.slideT=0;player.crouched=false;input.ads=false;ads=0;if(reloading){reloading=false;reloadT=0;} }
function updateMantle(dt){ player.mantleT=Math.max(0,player.mantleT-dt);const p=1-player.mantleT/player.mantleDur;const s=p*p*(3-2*p);player.pos.lerpVectors(player.mantleFrom,player.mantleTo,s);player.pos.y+=Math.sin(p*Math.PI)*.16;if(player.mantleT<=0){player.pos.copy(player.mantleTo);player.grounded=true;feel.onLand(.5);} }

function makeBot(i){
  const group=new THREE.Group(), body=new THREE.Mesh(new THREE.BoxGeometry(.72,.92,.42),mat([0xcf5f58,0x4f83cc,0xc99543,0x7d62c7,0x3ba878,0xbc658f][i%6])), head=new THREE.Mesh(new THREE.BoxGeometry(.48,.48,.48),mat(0xf0c36a)), legs=new THREE.Mesh(new THREE.BoxGeometry(.62,.72,.38),mat(0x35475f));
  body.position.y=1.18;head.position.y=1.88;legs.position.y=.4;for(const m of [body,head,legs])m.castShadow=true;group.add(legs,body,head);scene.add(group);
  const bot={id:i,name:['Brick','Nova','Rook','Hex','Mako','Vex'][i],group,body,head,hp:100,alive:true,pos:randomSpawn(player.pos,35),grounded:true,shootCd:.7+Math.random(),strafe:i%2?1:-1,respawn:0,lastSeen:new THREE.Vector3(),memoryT:0,cover:null,route:null,decisionT:0,peekT:0,peekOut:false,patrol:navNodes[i%navNodes.length].clone(),state:'patrol'};
  group.position.copy(bot.pos);for(const [mesh,part] of [[body,'body'],[head,'head'],[legs,'legs']]){mesh.userData.bot=bot;mesh.userData.part=part;botHitMeshes.push(mesh);}return bot;
}
const bots=Array.from({length:6},(_,i)=>makeBot(i));
if(new URLSearchParams(location.search).has('qa')){
  window.__VX2_QA__={
    teleportPlayer(x,y,z,yaw=0,pitch=0){player.pos.set(x,y,z);player.vel.set(0,0,0);player.yaw=yaw;player.pitch=pitch;player.hp=100;player.alive=true;player.grounded=true;player.eye=1.72;player.crouched=false;player.slideT=0;player.mantleT=0;switchT=0;reloading=false;reloadT=0;cooldown=0;input.fire=false;input.firePressed=false;input.ads=false;input.crouchHold=false;input.crouchToggle=false;input.crouchPressed=false;ads=0;feel.cancelActions();death.classList.add('hidden');updateHud();},
    parkBots(){for(const b of bots){b.alive=false;b.respawn=999;b.group.visible=false;b.cover=null;b.route=null;b.memoryT=0;b.decisionT=999;}},
    activateBot(index,x,y,z,hp=100){const b=bots[index];if(!b)return false;b.pos.set(x,y,z);b.group.position.copy(b.pos);b.alive=true;b.group.visible=true;b.hp=hp;b.grounded=true;b.respawn=0;b.shootCd=.8;b.decisionT=0;b.peekT=0;b.peekOut=false;b.cover=null;b.route=null;b.memoryT=0;b.lastSeen.set(0,0,0);return true;},
    setBotHealth(index,hp){const b=bots[index];if(!b)return false;b.hp=hp;b.decisionT=0;return true;},
    playerState(){return {x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch,hp:player.hp,grounded:player.grounded,crouched:player.crouched,slideT:player.slideT,mantleT:player.mantleT,stance:$('stance').textContent};},
    botStates(){return bots.map(b=>({id:b.id,x:b.pos.x,y:b.pos.y,z:b.pos.z,hp:b.hp,alive:b.alive,state:b.state,cover:b.cover?{x:b.cover.x,y:b.cover.y,z:b.cover.z}:null,route:b.route?{x:b.route.x,y:b.route.y,z:b.route.z}:null,memoryT:b.memoryT}));},
    coverCandidate(index){const b=bots[index];if(!b)return null;const n=chooseCoverNode(b.pos,player.pos,coverNodes,{isHidden:(node,p)=>!lineOfSight(node.clone().setY(node.y+.92),p.clone().setY(p.y+1.45)),isReachable:pathReachable,occupied:node=>coverOccupied(node,b)});return n?{x:n.x,y:n.y,z:n.z}:null;},
    coverNodes(){return coverNodes.map(n=>({x:n.x,y:n.y,z:n.z}));},
    navNodes(){return navNodes.map(n=>({x:n.x,y:n.y,z:n.z}));}
  };
}
function coverOccupied(node,bot){ return bots.some(b=>b!==bot&&b.alive&&b.cover&&b.cover.distanceToSquared(node)<4); }
function respawnBot(bot){bot.hp=100;bot.alive=true;bot.pos.copy(randomSpawn(player.pos,34));bot.group.position.copy(bot.pos);bot.group.visible=true;bot.shootCd=.7+Math.random()*.8;bot.cover=null;bot.route=null;bot.memoryT=0;bot.decisionT=0;}
function botShoot(bot,dist){ bot.shootCd=.58+Math.random()*.72;const hit=Math.random()<clamp(.76-dist/105,.3,.7);const target=camera.position.clone();if(!hit)target.add(new THREE.Vector3((Math.random()-.5)*3,(Math.random()-.5)*2,(Math.random()-.5)*3));spawnTracer(bot.pos.clone().setY(bot.pos.y+1.45),target,0xff6b68,.08);if(hit)damagePlayer(7+Math.floor(Math.random()*5),bot.pos); }
function updateBots(dt){
  for(const bot of bots){
    if(!bot.alive){bot.respawn-=dt;if(bot.respawn<=0)respawnBot(bot);continue;}
    const botEye=bot.pos.clone().setY(bot.pos.y+1.55), dist=bot.pos.distanceTo(player.pos), visible=player.alive&&dist<60&&lineOfSight(botEye,camera.position), hasMemory=updateTargetMemory(bot,visible,player.pos,dt,4.4);
    bot.decisionT-=dt;bot.peekT-=dt;
    if(bot.decisionT<=0){
      bot.decisionT=.55+Math.random()*.45;
      if(visible&&(bot.hp<68||Math.random()<.2)) bot.cover=chooseCoverNode(bot.pos,player.pos,coverNodes,{isHidden:(n,p)=>!lineOfSight(n.clone().setY(n.y+.92),p.clone().setY(p.y+1.45)),isReachable:pathReachable,occupied:n=>coverOccupied(n,bot)});
      if(bot.cover&&bot.pos.distanceTo(bot.cover)<1.2&&bot.peekT<=0){bot.peekOut=!bot.peekOut;bot.peekT=bot.peekOut?.65:1.05+Math.random()*.7;}
      const goal=bot.cover||(visible?player.pos:(hasMemory?bot.lastSeen:bot.patrol));bot.route=pathReachable(bot.pos,goal)?null:chooseRouteNode(bot.pos,goal,navNodes,pathReachable);
      if(!hasMemory&&!visible&&bot.pos.distanceTo(bot.patrol)<2)bot.patrol=navNodes[Math.floor(Math.random()*navNodes.length)].clone();
    }
    const atCover=!!bot.cover&&bot.pos.distanceTo(bot.cover)<1.3;bot.state=tacticalState(bot,{visible,distance:dist,lowHealth:bot.hp<68,atCover,hasMemory});
    let goal=bot.route||bot.cover||(visible?player.pos:(hasMemory?bot.lastSeen:bot.patrol));
    if(atCover&&bot.peekOut){const toP=player.pos.clone().sub(bot.pos).normalize(),side=new THREE.Vector3(toP.z,0,-toP.x).multiplyScalar(bot.strafe*1.35);goal=bot.cover.clone().add(side);}
    let dir=goal.clone().sub(bot.pos);dir.y=0;if(dir.lengthSq()>.04){dir.normalize();let speed=bot.state==='pressure'?3.7:3.0;if(bot.state==='disengage')dir.multiplyScalar(-1);moveEntity(bot,dir.x*speed*dt,dir.z*speed*dt,.46,1.86,.52);}
    bot.group.position.set(bot.pos.x,bot.pos.y+(atCover&&!bot.peekOut?-.48:0),bot.pos.z);bot.group.rotation.y=Math.atan2(player.pos.x-bot.pos.x,player.pos.z-bot.pos.z);bot.shootCd-=dt;
    const canShoot=visible&&(!atCover||bot.peekOut);if(canShoot&&bot.shootCd<=0)botShoot(bot,dist);
  }
}

function showDamageDirection(source){ if(!source)return;const dir=source.clone().sub(player.pos);dir.y=0;if(dir.lengthSq()<.01)return;dir.normalize();const f=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)),r=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));const angle=Math.atan2(dir.dot(r),dir.dot(f));const el=$('damageDir');el.style.setProperty('--damage-angle',`${angle}rad`);el.classList.remove('active');void el.offsetWidth;el.classList.add('active');damageDirTimer=.72;}
function damagePlayer(amount,source){ if(!player.alive)return;player.hp=Math.max(0,player.hp-amount);pulseBody('damaged',150);showDamageDirection(source);updateHud();if(player.hp<=0){player.alive=false;deaths++;input.fire=false;death.classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();} }
function respawnPlayer(){player.pos.copy(randomSpawn(new THREE.Vector3(),0));player.vel.set(0,0,0);player.hp=100;player.alive=true;player.grounded=true;player.eye=1.72;player.crouched=false;player.slideT=0;player.mantleT=0;switchT=0;reloading=false;reloadT=0;cooldown=0;input.fire=false;input.firePressed=false;input.ads=false;input.crouchHold=false;input.crouchToggle=false;input.crouchPressed=false;ads=0;feel.cancelActions();death.classList.add('hidden');updateHud();if(!coarse&&running)canvas.requestPointerLock();}

const weaponModels=new Map();
function fallbackGun(w){const g=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.07,.09,w.id==='pistol'?.3:.65),new THREE.MeshStandardMaterial({color:0x29313d,metalness:.45,roughness:.48}));body.position.z=-.12;g.add(body);return g;}
const muzzleMat=new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
const muzzleFx=new THREE.Group();const mf1=new THREE.Mesh(new THREE.PlaneGeometry(.2,.2),muzzleMat),mf2=mf1.clone();mf2.rotation.z=Math.PI/4;muzzleFx.add(mf1,mf2);const muzzleLight=new THREE.PointLight(0xffc36a,0,2);muzzleFx.add(muzzleLight);weaponRig.add(muzzleFx);
async function loadWeaponModel(id){const w=WEAPONS[id];weaponModelMount.clear();let holder=weaponModels.get(id);if(!holder){try{const gltf=await loader.loadAsync(w.modelUrl),model=gltf.scene,box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());model.position.sub(center);holder=new THREE.Group();holder.add(model);if(size.x>size.z)holder.rotation.y=Math.PI/2;holder.scale.setScalar(w.view.length/Math.max(size.x,size.z));model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.roughness=.46;o.material.metalness=.3;}});weaponModels.set(id,holder);}catch{holder=fallbackGun(w);weaponModels.set(id,holder);}}weaponModelMount.add(holder.clone(true));muzzleFx.position.set(0,.015,-Math.max(.26,w.view.length*.62));weaponRig.position.set(w.view.x,w.view.y,w.view.z);weaponRig.rotation.set(0,.035,0);updateHud();}
function showMuzzle(){muzzleMat.opacity=1;muzzleLight.intensity=2.8;const s=.75+Math.random()*.75;mf1.scale.set(s,s,1);mf2.scale.set(s,s,1);mf1.rotation.z=Math.random()*Math.PI;flashT=.045;}
function spawnShell(){const w=WEAPONS[currentWeapon];const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw)),forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));const m=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.06,6),new THREE.MeshStandardMaterial({color:0xc99b3d,metalness:.7,roughness:.35}));m.rotation.z=Math.PI/2;m.position.copy(camera.position).addScaledVector(right,.22).addScaledVector(forward,.28).add(new THREE.Vector3(0,-.13,0));scene.add(m);shells.push({mesh:m,vel:right.multiplyScalar(1.9+Math.random()*1.3).add(new THREE.Vector3(0,1.5+Math.random(),0)).addScaledVector(forward,.4),t:1.15,spin:10+Math.random()*8});if(w.id==='shotgun')shells.at(-1).vel.multiplyScalar(.8);}
function switchWeapon(id){if(!WEAPONS[id]||id===currentWeapon||switchT>0)return;currentWeapon=id;reloading=false;reloadT=0;switchT=.34;cooldown=.22;feel.cancelActions();feel.onSwitch(.34);loadWeaponModel(id);updateHud();}
function cycleWeapon(){const i=WEAPON_ORDER.indexOf(currentWeapon);switchWeapon(WEAPON_ORDER[(i+1)%WEAPON_ORDER.length]);}
function reload(){const w=WEAPONS[currentWeapon],a=ammo[currentWeapon];if(reloading||switchT>0||a.mag>=w.magSize||a.reserve<=0||!player.alive||player.mantleT>0)return;reloading=true;reloadT=w.reload;feel.onReload(w.reload);playAudio(RELOAD_URL,.55,1);}
function finishReload(){const w=WEAPONS[currentWeapon],a=ammo[currentWeapon],need=w.magSize-a.mag,take=Math.min(need,a.reserve);a.mag+=take;a.reserve-=take;reloading=false;reloadT=0;updateHud();}
function spawnTracer(from,to,color=0xffd078,life=.055){const g=new THREE.BufferGeometry().setFromPoints([from,to]),l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));scene.add(l);tracers.push({mesh:l,t:life,life});}
function spawnImpact(p){const m=new THREE.Mesh(new THREE.SphereGeometry(.055,6,6),new THREE.MeshBasicMaterial({color:0xffdf9e,transparent:true,opacity:.9}));m.position.copy(p);scene.add(m);impacts.push({mesh:m,t:.18});}
function fire(){
  const w=WEAPONS[currentWeapon],a=ammo[currentWeapon];if(!player.alive||reloading||switchT>0||cooldown>0||player.mantleT>0)return;if(a.mag<=0){reload();return;}a.mag--;cooldown=w.rate;feel.onShot(w,ads);playAudio(w.shotUrl,currentWeapon==='shotgun'?.85:.68,.96+Math.random()*.08);pulseBody('shot',70);showMuzzle();spawnShell();updateHud();
  for(let i=0;i<(w.pellets||1);i++){raycaster.setFromCamera({x:0,y:0},camera);const dir=raycaster.ray.direction.clone(),spread=THREE.MathUtils.lerp(w.hipSpread+(player.vel.length()>1?w.moveSpread:0),w.adsSpread,ads);dir.x+=(Math.random()-.5)*spread*2;dir.y+=(Math.random()-.5)*spread*2;dir.z+=(Math.random()-.5)*spread*2;dir.normalize();raycaster.set(camera.position,dir);raycaster.far=170;const hits=raycaster.intersectObjects([...botHitMeshes,...worldMeshes],false);let endPoint=camera.position.clone().addScaledVector(dir,145);
    for(const h of hits){const bot=h.object.userData.bot;if(bot&&!bot.alive)continue;endPoint=h.point.clone();if(bot){const part=h.object.userData.part,head=part==='head',base=damageAtDistance(w,h.distance),mult=head?w.headMultiplier:part==='legs'?.75:1;bot.hp-=Math.round(base*mult);hitMarker(head);bot.decisionT=0;if(bot.hp<=0){bot.alive=false;bot.group.visible=false;bot.respawn=3.2;kills++;score+=head?150:100;killFeed(`You eliminated ${bot.name}`,head);}}else spawnImpact(h.point);break;}spawnTracer(camera.position.clone().addScaledVector(dir,.6),endPoint);}
  if(a.mag===0&&a.reserve>0)setTimeout(()=>{if(ammo[currentWeapon].mag===0)reload();},180);
}

const touchMove={active:false,id:null,x:0,y:0};
function updateInput(){input.forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);input.strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);if(touchMove.active){input.forward=-touchMove.y;input.strafe=touchMove.x;}input.sprint=keys.has('ShiftLeft')||(touchMove.active&&-touchMove.y>.78);}
function updatePlayer(dt){
  updateInput();const w=WEAPONS[currentWeapon];
  if(player.mantleT>0){updateMantle(dt);}else{
    const moveLen=Math.hypot(input.forward,input.strafe),sprintIntent=input.sprint&&input.forward>.15&&ads<.15&&!player.crouched;
    if(input.crouchPressed&&sprintIntent&&player.grounded&&Math.hypot(player.vel.x,player.vel.z)>5.4){player.slideT=.72;player.slideDir.set(player.vel.x,0,player.vel.z).normalize();player.crouched=true;input.ads=false;}input.crouchPressed=false;
    const wantsCrouch=input.crouchHold||input.crouchToggle||player.slideT>0;if(wantsCrouch)player.crouched=true;else if(!blockedAt(player.pos.x,player.pos.z,player.pos.y,1.72,.4))player.crouched=false;
    const h=player.crouched?1.12:1.72;
    if(player.slideT>0){player.slideT=Math.max(0,player.slideT-dt);const slideSpeed=5.2+6.5*(player.slideT/.72);moveEntity(player,player.slideDir.x*slideSpeed*dt,player.slideDir.z*slideSpeed*dt,.42,h,.2);player.vel.x=player.slideDir.x*slideSpeed;player.vel.z=player.slideDir.z*slideSpeed;if(player.slideT<=0&&!input.crouchHold&&!input.crouchToggle&&!blockedAt(player.pos.x,player.pos.z,player.pos.y,1.72,.4))player.crouched=false;}else{
      const sprinting=sprintIntent,maxSpeed=(player.crouched?3.45:(sprinting?9.2:6.1))*THREE.MathUtils.lerp(1,w.adsMoveScale,ads),forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)),right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw)),desired=forward.multiplyScalar(input.forward).add(right.multiplyScalar(input.strafe));if(desired.lengthSq()>1)desired.normalize();desired.multiplyScalar(maxSpeed);const accel=moveLen>.01?(player.grounded?18:7):14;player.vel.x=damp(player.vel.x,desired.x,accel,dt);player.vel.z=damp(player.vel.z,desired.z,accel,dt);
      if(input.jump&&player.grounded){const mantle=findMantle();if(mantle)startMantle(mantle);else{player.vel.y=7.2;player.grounded=false;}input.jump=false;}
      if(player.mantleT<=0)moveEntity(player,player.vel.x*dt,player.vel.z*dt,.42,h,.56);
    }
    if(player.mantleT<=0){const wasGrounded=player.grounded;player.vel.y-=20*dt;player.pos.y+=player.vel.y*dt;const floor=floorAt(player.pos.x,player.pos.z,player.pos.y,.16);if(player.vel.y<=0&&player.pos.y<=floor+.05){player.pos.y=floor;player.vel.y=0;player.grounded=true;if(!wasGrounded)feel.onLand(1);}else player.grounded=false;}
  }
  const moving=Math.hypot(player.vel.x,player.vel.z)>.25,sprinting=input.sprint&&input.forward>.15&&!player.crouched&&player.slideT<=0,eyeTarget=player.mantleT>0?1.35:(player.crouched||player.slideT>0?1.08:1.72);player.eye=damp(player.eye,eyeTarget,12,dt);ads=damp(ads,input.ads&&!sprinting&&!reloading&&switchT<=0&&player.mantleT<=0?1:0,14,dt);const offsets=feel.update(dt,{weapon:w,ads,moving,sprinting,grounded:player.grounded,speed01:clamp(Math.hypot(player.vel.x,player.vel.z)/9.2,0,1),strafing:input.strafe});camera.position.set(player.pos.x,player.pos.y+player.eye,player.pos.z);camera.rotation.y=player.yaw+offsets.yaw;camera.rotation.x=player.pitch+offsets.pitch;camera.rotation.z=offsets.roll;const spreadPx=5+(moving?5:0)+(sprinting?5:0)+(player.slideT>0?3:0);$('crosshair').style.setProperty('--gap',`${THREE.MathUtils.lerp(spreadPx,3,ads)}px`);$('stance').textContent=player.mantleT>0?'MANTLE':player.slideT>0?'SLIDE':player.crouched?'CROUCH':sprinting?'SPRINT':'READY';
}
function updateCombat(dt){cooldown-=dt;switchT=Math.max(0,switchT-dt);if(reloading){reloadT-=dt;if(reloadT<=0)finishReload();}const w=WEAPONS[currentWeapon];if(input.fire&&(w.automatic||input.firePressed)){fire();input.firePressed=false;}if(!input.fire)input.firePressed=false;if(flashT>0){flashT-=dt;if(flashT<=0){muzzleMat.opacity=0;muzzleLight.intensity=0;}}}
function updateFx(dt){for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.t-=dt;t.mesh.material.opacity=Math.max(0,t.t/t.life);if(t.t<=0){scene.remove(t.mesh);t.mesh.geometry.dispose();t.mesh.material.dispose();tracers.splice(i,1);}}for(let i=impacts.length-1;i>=0;i--){const p=impacts[i];p.t-=dt;p.mesh.scale.multiplyScalar(1+dt*7);p.mesh.material.opacity=Math.max(0,p.t/.18);if(p.t<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();impacts.splice(i,1);}}for(let i=shells.length-1;i>=0;i--){const s=shells[i];s.t-=dt;s.vel.y-=16*dt;s.mesh.position.addScaledVector(s.vel,dt);s.mesh.rotation.x+=s.spin*dt;s.mesh.rotation.z+=s.spin*.7*dt;const floor=floorAt(s.mesh.position.x,s.mesh.position.z,s.mesh.position.y,.08);if(s.mesh.position.y<floor+.03){s.mesh.position.y=floor+.03;s.vel.y=Math.abs(s.vel.y)*.22;s.vel.x*=.65;s.vel.z*=.65;}if(s.t<=0){scene.remove(s.mesh);s.mesh.geometry.dispose();s.mesh.material.dispose();shells.splice(i,1);}}if(damageDirTimer>0){damageDirTimer-=dt;if(damageDirTimer<=0)$('damageDir').classList.remove('active');}}
function updateHud(){const w=WEAPONS[currentWeapon],a=ammo[currentWeapon];$('kills').textContent=kills;$('score').textContent=score;$('hpLabel').textContent=Math.ceil(player.hp);$('hpFill').style.width=`${player.hp}%`;$('weaponRole').textContent=w.role;$('weaponName').textContent=w.name;$('ammo').innerHTML=`${a.mag} <small>/ ${a.reserve}${reloading?' · RLD':''}</small>`;$('weaponStrip').innerHTML=WEAPON_ORDER.map((id,i)=>`<div class="wslot ${id===currentWeapon?'active':''}">${i+1} ${WEAPONS[id].name}</div>`).join('');}
function formatTime(t){const m=Math.floor(Math.max(0,t)/60),s=Math.floor(Math.max(0,t)%60);return `${m}:${String(s).padStart(2,'0')}`;}
function endMatch(){running=false;hud.classList.add('hidden');end.classList.remove('hidden');$('endStats').textContent=`${kills} eliminations · ${score} score · ${deaths} deaths`;$('endTitle').textContent=kills>=12?'DOMINANT':'GREENFIELD COMPLETE';if(document.pointerLockElement)document.exitPointerLock();}
function resetMatch(){matchTime=300;kills=0;score=0;deaths=0;for(const id of WEAPON_ORDER){ammo[id].mag=WEAPONS[id].magSize;ammo[id].reserve=WEAPONS[id].reserve;}currentWeapon='carbine';switchT=0;reloading=false;feel.cancelActions();respawnPlayer();for(const b of bots)respawnBot(b);loadWeaponModel(currentWeapon);updateHud();}
function startMatch(){start.classList.add('hidden');end.classList.add('hidden');death.classList.add('hidden');hud.classList.remove('hidden');running=true;resetMatch();if(!coarse)canvas.requestPointerLock();else document.documentElement.requestFullscreen?.({navigationUI:'hide'}).catch(()=>{});}

$('deploy').addEventListener('click',startMatch);$('respawn').addEventListener('click',respawnPlayer);$('again').addEventListener('click',startMatch);
addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='Space'){input.jump=true;e.preventDefault();}if(e.code==='KeyR')reload();if(e.code==='Digit1')switchWeapon('carbine');if(e.code==='Digit2')switchWeapon('pistol');if(e.code==='Digit3')switchWeapon('shotgun');if((e.code==='KeyC'||e.code==='ControlLeft')&&!e.repeat){input.crouchHold=true;input.crouchPressed=true;}});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyC'||e.code==='ControlLeft')input.crouchHold=false;});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||!player.alive)return;const sens=.0022*(ads>.5?.72:1);player.yaw-=e.movementX*sens;player.pitch=clamp(player.pitch-e.movementY*sens,-1.45,1.45);feel.onLook(e.movementX,e.movementY);});
canvas.addEventListener('mousedown',e=>{if(!running||!player.alive)return;if(document.pointerLockElement!==canvas&&!coarse){canvas.requestPointerLock();return;}if(e.button===0){input.fire=true;input.firePressed=true;}if(e.button===2)input.ads=true;});addEventListener('mouseup',e=>{if(e.button===0)input.fire=false;if(e.button===2)input.ads=false;});addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('click',()=>{if(running&&!coarse&&player.alive&&document.pointerLockElement!==canvas)canvas.requestPointerLock();});

const movePad=$('movePad'),moveKnob=$('moveKnob'),lookPad=$('lookPad');let lookId=null,lastLookX=0,lastLookY=0;movePad.addEventListener('pointerdown',e=>{touchMove.active=true;touchMove.id=e.pointerId;movePad.setPointerCapture(e.pointerId);});movePad.addEventListener('pointermove',e=>{if(!touchMove.active||e.pointerId!==touchMove.id)return;const r=movePad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.34,len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}touchMove.x=dx/max;touchMove.y=dy/max;moveKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;});function endMove(e){if(e.pointerId!==touchMove.id)return;touchMove.active=false;touchMove.id=null;touchMove.x=touchMove.y=0;moveKnob.style.transform='translate(-50%,-50%)';}movePad.addEventListener('pointerup',endMove);movePad.addEventListener('pointercancel',endMove);
lookPad.addEventListener('pointerdown',e=>{lookId=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;lookPad.setPointerCapture(e.pointerId);});lookPad.addEventListener('pointermove',e=>{if(e.pointerId!==lookId||!player.alive)return;const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;player.yaw-=dx*.0044;player.pitch=clamp(player.pitch-dy*.0044,-1.45,1.45);feel.onLook(dx,dy);lastLookX=e.clientX;lastLookY=e.clientY;});lookPad.addEventListener('pointerup',e=>{if(e.pointerId===lookId)lookId=null;});
function bindHold(el,on,off){el?.addEventListener('pointerdown',e=>{e.stopPropagation();el.setPointerCapture(e.pointerId);on();});el?.addEventListener('pointerup',e=>{e.stopPropagation();off?.();});el?.addEventListener('pointercancel',()=>off?.());}
bindHold($('fireBtn'),()=>{input.fire=true;input.firePressed=true;},()=>input.fire=false);bindHold($('adsBtn'),()=>input.ads=true,()=>input.ads=false);$('reloadBtn')?.addEventListener('pointerdown',e=>{e.stopPropagation();reload();});$('swapBtn')?.addEventListener('pointerdown',e=>{e.stopPropagation();cycleWeapon();});$('jumpBtn')?.addEventListener('pointerdown',e=>{e.stopPropagation();input.jump=true;});$('crouchBtn')?.addEventListener('pointerdown',e=>{e.stopPropagation();input.crouchToggle=!input.crouchToggle;input.crouchPressed=true;e.currentTarget.classList.toggle('active',input.crouchToggle);});

addEventListener('resize',()=>{renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.4:2));renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();weaponCamera.aspect=innerWidth/innerHeight;weaponCamera.updateProjectionMatrix();});
loadWeaponModel(currentWeapon);updateHud();let last=performance.now();function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.045);last=now;if(running){if(player.alive){updatePlayer(dt);updateCombat(dt);updateBots(dt);}matchTime-=dt;$('timer').textContent=formatTime(matchTime);if(matchTime<=0)endMatch();}updateFx(dt);renderer.clear();renderer.render(scene,camera);if(running&&player.alive){renderer.clearDepth();renderer.render(weaponScene,weaponCamera);}}requestAnimationFrame(loop);
