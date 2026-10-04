import * as THREE from './vendor/three.module.js';
import { createWorkshop, createMachine, createCharacter, createPart, createWorker, createAnnex } from './assets/models.js';
import { ShopGame, SHIFTS, OPS, PROGRAM_DURATION, stockType } from './core.js';
import { ShopAudio } from './audio.js';
import { createSocial } from './social.js';
import { technologyBadges, technologyIcon } from './technology.js';
import { orderWorkflow, stockIcon } from './workflow.js';
import { ManagerGame, MANAGER_ROLE, MANAGER_MODE, MACHINES, BAY_SIZES, UPGRADES, WING, STAFF, RUN_LENGTHS, DAY_SECONDS, COVARI_SLOTS, QUOTE_WINDOW, AD, START_CASH, RESALE, BIDS, SALES_DELAY, BREAK_FROM, SERVICE_FROM, rentFor, opInfo, boardId } from './manager.js';

const $=id=>document.getElementById(id);
// Shifts and Open for Business share one renderer; game points at the active rules.
const classicGame=new ShopGame(),managerGame=new ManagerGame(),audio=new ShopAudio();let game=classicGame;
let challengeRun=false;
const sourceCard=$('source-card');
const social=createSocial({onChallenge:role=>{challengeRun=role>unlocked;showBriefing(role);}});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys=new Set();let touchVector={x:0,y:0},selectedShift=0,unlocked=0,bests=SHIFTS.map(()=>0),grades=SHIFTS.map(()=>0);
const SAVE_KEY='chip-rush-roles-v8';
function readRoleSave(key){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}}
function readUnlocked(value){return Math.max(0,Math.min(SHIFTS.length-1,Math.trunc(Number(value))||0));}
// A level cleared before its successor existed unlocks that successor. Stars
// earned on a still-locked level (friend challenges) never unlock anything.
function unlockCleared(level,stars){for(let i=0;i<SHIFTS.length-1;i++)if(i<=level&&Number(stars?.[i])>0)level=Math.max(level,i+1);return level;}
// Open for Business keeps its own records beside the shift records in the same save:
// best net worth per run length ('0' is Endless), longest Endless run, last length.
let managerRecord={bests:{},days:0,length:5};
function readManagerRecord(value){if(!value||typeof value!=='object'||Array.isArray(value))value={};const record={bests:{},days:Math.max(0,Math.trunc(Number(value?.days))||0),length:RUN_LENGTHS.includes(value?.length)?value.length:5};for(const length of RUN_LENGTHS){const best=Math.trunc(Number(value?.bests?.[length]));if(best>0)record.bests[length]=best;}return record;}
const roleSave=readRoleSave(SAVE_KEY);
if(roleSave){
  unlocked=readUnlocked(roleSave.unlocked);
  bests=bests.map((_,i)=>Math.max(0,Number(roleSave.bests?.[i])||0));
  grades=grades.map((_,i)=>Math.max(0,Math.min(3,Math.trunc(Number(roleSave.grades?.[i]))||0)));
  unlocked=unlockCleared(unlocked,grades);
  managerRecord=readManagerRecord(roleSave.manager);
}else{
  const previousRoles=['v7','v6','v5','v4','v3','v2'].map(version=>readRoleSave('chip-rush-roles-'+version)).find(Boolean);
  if(previousRoles){
    // Preserve access and historical saves; changed workflows start fresh records.
    unlocked=unlockCleared(readUnlocked(previousRoles.unlocked),previousRoles.grades);
    save();
  }
}
const STATION_LAYOUT=[
  {id:'office',name:'OFFICE',x:-7.1,z:-4.65,height:2.2,w:2.6,d:1.3,access:{x:-7.8,z:-3.18},collidable:false},
  {id:'material-round',name:'ROUND',x:-6.6,z:-1.5,height:1.15,w:1.65,d:.8,access:{x:-5.1,z:-1.5},stock:'round'},
  {id:'material-plate',name:'PLATE',x:-6.6,z:-.55,height:1.15,w:1.65,d:.8,access:{x:-5.1,z:-.55},stock:'plate'},
  {id:'material-block',name:'BLOCK',x:-6.6,z:.4,height:1.15,w:1.65,d:.8,access:{x:-5.1,z:.4},stock:'block'},
  {id:'lathe',name:'LATHE',x:-2.55,z:-3.4,height:3.306,w:3.078,d:2.052,scale:1.14},
  {id:'mill',name:'MILL',x:1.3,z:-3.4,height:3.534,w:3.648,d:2.109,scale:1.14},
  {id:'inspect',name:'INSPECT',x:5.8,z:-2.25,height:2.05,w:1.6,d:2.4,rotationY:-Math.PI/2,access:{x:4.32,z:-2.25}},
  {id:'ship',name:'SHIPPING',x:5.8,z:1,height:1.85,w:1.8,d:2.7,rotationY:-Math.PI/2,access:{x:4.27,z:1}},
  {id:'receiving',name:'RECEIVING',x:-2.3,z:3.2,height:1.75,w:2,d:.8,access:{x:-2.3,z:2.05}},
  {id:'buffer',name:'HOLD BENCH',x:-6.4,z:1.7,height:1.4,w:2.35,d:1.45},
  {id:'deburr',name:'DEBURR',x:-.9,z:.85,height:2.05,w:2.16,d:1.31,map:'night-shop'},
  {id:'anodize',name:'ANODIZE',x:2.4,z:.85,height:2.2,w:2.27,d:1.31,map:'night-shop'},
  // Open for Business machine bays. Island and front-wall bays are in the
  // original room; the east wing adds four large bays and two small ones.
  {id:'bay-1',name:'BAY',bay:'compact',x:-.9,z:-.5,height:.7,w:2.3,d:1.35,map:['owner-shop','owner-wing']},
  {id:'bay-2',name:'BAY',bay:'compact',x:2.4,z:-.5,height:.7,w:2.3,d:1.35,map:['owner-shop','owner-wing']},
  {id:'bay-3',name:'BAY',bay:'small',x:1.2,z:2.95,height:.7,w:1.7,d:1.0,rotationY:Math.PI,access:{x:.75,z:1.95},map:['owner-shop','owner-wing']},
  {id:'bay-4',name:'BAY',bay:'small',x:3.6,z:2.95,height:.7,w:1.7,d:1.0,rotationY:Math.PI,access:{x:3.1,z:2.0},map:['owner-shop','owner-wing']},
  {id:'bay-5',name:'BAY',bay:'large',x:10,z:-4,height:.7,w:3.7,d:2.15,map:'owner-wing'},
  {id:'bay-6',name:'BAY',bay:'large',x:14.4,z:-4,height:.7,w:3.7,d:2.15,map:'owner-wing'},
  {id:'bay-7',name:'BAY',bay:'large',x:10,z:-.1,height:.7,w:3.7,d:2.15,map:'owner-wing'},
  {id:'bay-8',name:'BAY',bay:'large',x:14.4,z:-.1,height:.7,w:3.7,d:2.15,map:'owner-wing'},
  {id:'bay-9',name:'BAY',bay:'small',x:8.6,z:2.95,height:.7,w:1.7,d:1.0,rotationY:Math.PI,access:{x:8.6,z:2.0},map:'owner-wing'},
  {id:'bay-10',name:'BAY',bay:'small',x:15.8,z:2.95,height:.7,w:1.7,d:1.0,rotationY:Math.PI,access:{x:15.8,z:2.0},map:'owner-wing'},
];
// A map lists the stations it adds (def.map) and the shared ones it clears away.
const MAPS={
  'first-shop':{theme:'day'},
  'night-shop':{theme:'night'},
  // place moves a shared station for this map only. In the owner's shop QC and
  // Shipping part to leave a doorway east; the wing map also widens the room.
  'owner-shop':{theme:'morning',place:{inspect:{z:-2.6,access:{x:4.32,z:-2.6}},ship:{z:1.2,access:{x:4.27,z:1.2}}}},
  'owner-wing':{theme:'morning',place:{inspect:{z:-2.6,access:{x:4.32,z:-2.6}},ship:{z:1.2,access:{x:4.27,z:1.2}}},bounds:{maxX:16.65},
    obstacles:[{minX:16.0,maxX:16.75,minZ:-2.6,maxZ:-1.5}]},
};
const mapHas=(def,mapId)=>def.map?[].concat(def.map).includes(mapId):!MAPS[mapId].hide?.includes(def.id);
const placed=(def,mapId)=>({...def,...MAPS[mapId].place?.[def.id]});
const accessOf=def=>def.access||{x:def.x,z:def.z+def.d/2+.63};
const SPAWN={x:0,z:2.6};
let renderer,scene,camera,character,carryAnchor,playerRing,targetRing,world,annex,lighting,appliedTheme=null;
let path=[],pathStation=null,nearby=null,walkPhase=0,dashTime=0,dashCooldown=0,dashDirection=new THREE.Vector3(),clockTime=0,uiElapsed=0,last=performance.now(),toastUntil=0,shake=0;
let cameraBlend=0,menuMode=true,helpReturn=null,renderedTickets='',resultShown=false,stationPartSignature={};
let renderedSelection=null, nextPhoneRing=0;
const stations={},bays={},staffViews=new Map(),routeCache=new Map(),parts=new Map(),particles=[];const player={...SPAWN,angle:Math.PI};
let viewport={w:innerWidth,h:innerHeight};
// Align the floor with the screen and look down into the working aisles.
const cameraOffset=new THREE.Vector3(0,23,17);
const right=new THREE.Vector3(cameraOffset.z,0,-cameraOffset.x).normalize();
const down=new THREE.Vector3(cameraOffset.x,0,cameraOffset.z).normalize();
const cameraUp=new THREE.Vector3().crossVectors(cameraOffset.clone().normalize(),right).normalize();
let layoutDirty=true,shopFrame=null,playFrame=null;
const BASE_BOUNDS={minX:-8.55,maxX:7.65,minZ:-5.45,maxZ:3.35},bounds={...BASE_BOUNDS};
const fixedObstacles=[{minX:-8.55,maxX:-5.77,minZ:-5.5,maxZ:-4.02},{minX:-5.83,maxX:-5.12,minZ:-5.5,maxZ:-3.08},{minX:-7.62,maxX:-6.64,minZ:-4.12,maxZ:-3.26},
  // Perimeter packing and plants are physical props, outside the working aisle.
  {minX:6.05,maxX:7.85,minZ:-5.58,maxZ:-4.30},{minX:6.98,maxX:7.98,minZ:-4.46,maxZ:-3.46},{minX:-8.82,maxX:-7.80,minZ:2.37,maxZ:3.39}];
let obstacles=[];
function activateMap(mapId){
  Object.assign(bounds,BASE_BOUNDS,MAPS[mapId].bounds);
  obstacles=[...(MAPS[mapId].obstacles??[]),...STATION_LAYOUT.filter(s=>s.collidable!==false&&mapHas(s,mapId)).map(s=>placed(s,mapId)).map(s=>({minX:s.x-s.w/2-.25,maxX:s.x+s.w/2+.25,minZ:s.z-s.d/2-.25,maxZ:s.z+s.d/2+.25})),...fixedObstacles];
}
activateMap('first-shop');

function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({unlocked,bests,grades,manager:managerRecord}));}catch{}}
function toast(message,duration=2.6){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+duration*1000;}
function safeSpot(x,z){return x>bounds.minX&&x<bounds.maxX&&z>bounds.minZ&&z<bounds.maxZ&&!obstacles.some(o=>x>o.minX&&x<o.maxX&&z>o.minZ&&z<o.maxZ);}
function movePosition(position,dx,dz){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));for(let i=0;i<steps;i++){if(safeSpot(position.x+dx/steps,position.z))position.x+=dx/steps;if(safeSpot(position.x,position.z+dz/steps))position.z+=dz/steps;}}
function moveBy(dx,dz){movePosition(player,dx,dz);}

// A* routing uses the same collision boundary as keyboard movement.
function routeSegmentClear(a,b){
  const length=Math.hypot(b.x-a.x,b.z-a.z),samples=Math.ceil(length/.04);
  for(let i=1;i<=samples;i++)if(!safeSpot(a.x+(b.x-a.x)*i/samples,a.z+(b.z-a.z)*i/samples))return false;
  // Match the controller's separate X/Z collision steps at walk and dash speed.
  for(const speed of [4.4,11]){const probe={x:a.x,z:a.z},frames=Math.ceil(length/(speed/60));for(let i=0;i<frames;i++)movePosition(probe,(b.x-a.x)/frames,(b.z-a.z)/frames);if(Math.hypot(probe.x-b.x,probe.z-b.z)>1e-6)return false;}
  return true;
}
function smoothRoute(origin,points){
  const route=[];let from=0;
  while(from<points.length){let to=points.length-1;while(to>from&&!routeSegmentClear(origin,points[to]))to--;route.push(points[to]);origin=points[to];from=to+1;}
  return route;
}
function dashStep(dt,remaining,normalSpeed){const active=Math.min(dt,remaining);return {distance:11*active+normalSpeed*(dt-active),remaining:Math.max(0,remaining-active)};}
function findPath(tx,tz,from=player){
  const cell=.32,ox=-8.5,oz=-5.4,nx=Math.max(54,Math.ceil((bounds.maxX-ox)/cell)+2),nz=35,budget=nx>54?6000:2200;
  const point=(ix,iz)=>({x:ox+ix*cell,z:oz+iz*cell});
  const nearest=(x,z)=>{let best=null,dist=Infinity;for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const p=point(ix,iz);if(!safeSpot(p.x,p.z))continue;const d=(p.x-x)**2+(p.z-z)**2;if(d<dist){dist=d;best={ix,iz};}}return best;};
  const start=nearest(from.x,from.z),end=nearest(tx,tz);if(!start||!end)return [];
  const id=(x,z)=>z*nx+x,si=id(start.ix,start.iz),ei=id(end.ix,end.iz),open=[si],came=new Map(),cost=new Map([[si,0]]),closed=new Set();
  const h=i=>Math.hypot(i%nx-end.ix,Math.floor(i/nx)-end.iz);
  for(let runs=0;open.length&&runs<budget;runs++){
    let bi=0;for(let i=1;i<open.length;i++)if(cost.get(open[i])+h(open[i])<cost.get(open[bi])+h(open[bi]))bi=i;
    const cur=open.splice(bi,1)[0];if(cur===ei){const route=[];let c=ei;while(c!==si){route.push(point(c%nx,Math.floor(c/nx)));c=came.get(c);if(c===undefined)break;}route.reverse();if(safeSpot(tx,tz))route.push({x:tx,z:tz});return smoothRoute(from,route);}
    closed.add(cur);const x=cur%nx,z=Math.floor(cur/nx);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const ax=x+dx,az=z+dz;if(ax<0||ax>=nx||az<0||az>=nz)continue;const ni=id(ax,az);if(closed.has(ni))continue;const p=point(ax,az);if(!safeSpot(p.x,p.z))continue;
      if(dx&&dz){const a=point(x+dx,z),b=point(x,z+dz);if(!safeSpot(a.x,a.z)||!safeSpot(b.x,b.z))continue;}
      const g=cost.get(cur)+Math.hypot(dx,dz);if(g<(cost.get(ni)??Infinity)){came.set(ni,cur);cost.set(ni,g);if(!open.includes(ni))open.push(ni);}
    }
  }return [];
}
function onPhone(){return ['answering','offer'].includes(game.call?.state);}
function useStation(id){game.setOfficePresence(atOffice());game.interact(id==='office'&&game.call?.state==='ringing'?'phone':id);}
function atOffice(){const s=stations.office;return !!s&&Math.hypot(player.x-s.access.x,player.z-s.access.z)<.78;}
function goToStation(id){if(game.mode!=='playing')return;if(onPhone())return toast('Finish the customer call first.');const s=stations[id];if(!s||!s.model.visible||id==='receiving'&&!game.config.sourcing)return;path=findPath(s.access.x,s.access.z);pathStation=id;targetRing.position.set(s.access.x,.08,s.access.z);targetRing.visible=true;if(!path.length&&Math.hypot(player.x-s.access.x,player.z-s.access.z)<1.3){useStation(id);pathStation=null;processEvents();}}
function nearestStation(){let chosen=null,dist=1.32;for(const s of Object.values(stations)){if(!s.model.visible||s.def.id==='receiving'&&!game.config.sourcing)continue;const d=Math.hypot(player.x-s.access.x,player.z-s.access.z);if(d<dist&&d<(s.def.id==='office'?.78:1.32)){chosen=s;dist=d;}}return chosen;}
function interact(){if(game.mode!=='playing')return;if(onPhone())return toast('Finish the customer call first.');const s=nearestStation();if(s){path=[];pathStation=null;targetRing.visible=false;player.angle=Math.atan2(s.def.x-player.x,s.def.z-player.z);useStation(s.def.id);processEvents();syncParts();updateUI(true);}else toast('Move closer to a station, or click its label.');}
function dash(){if(game.mode!=='playing'||onPhone()||dashCooldown>0)return;dashCooldown=1.3;dashTime=.2;dashDirection.set(Math.sin(player.angle),0,Math.cos(player.angle));audio.event('dash');}
function screenPoint(v){const p=v.clone().project(camera);return {x:(p.x*.5+.5)*viewport.w,y:(-p.y*.5+.5)*viewport.h};}
function floatText(text,station,small=false){const d=stations[station]?.def;if(!d)return;const p=screenPoint(new THREE.Vector3(d.x,d.height+.3,d.z));const el=document.createElement('div');el.className=`float-text${small?' small':''}`;el.textContent=text;el.style.left=p.x+'px';el.style.top=p.y+'px';$('floating-text').appendChild(el);el.addEventListener('animationend',()=>el.remove(),{once:true});setTimeout(()=>el.remove(),1800);}
function createReceivingDock(){
  const g=new THREE.Group();g.name='receiving-dock';
  const steel=new THREE.MeshStandardMaterial({color:0x214a4b,roughness:.8});
  const top=new THREE.Mesh(new THREE.BoxGeometry(2,.13,.8),new THREE.MeshStandardMaterial({color:0xd9d9c4,roughness:.75}));top.position.y=.96;top.castShadow=true;top.receiveShadow=true;g.add(top);
  for(const x of [-.86,.86])for(const z of [-.29,.29]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.92,.1),steel);leg.position.set(x,.46,z);leg.castShadow=true;g.add(leg);}
  const shelf=new THREE.Mesh(new THREE.BoxGeometry(1.8,.07,.62),steel);shelf.position.y=.26;shelf.receiveShadow=true;g.add(shelf);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(2,.2,.06),steel);rail.position.set(0,1.06,.38);g.add(rail);
  const crate=new THREE.Mesh(new THREE.BoxGeometry(.58,.48,.52),new THREE.MeshStandardMaterial({color:0xb77845,roughness:.82}));crate.position.set(0,.3,0);crate.castShadow=true;const crateGroup=new THREE.Group();g.add(crateGroup);crateGroup.position.y=1.01;crateGroup.add(crate);
  for(const x of [-.19,.19]){const band=new THREE.Mesh(new THREE.BoxGeometry(.035,.5,.54),new THREE.MeshStandardMaterial({color:0xefd078,roughness:.6}));band.position.set(x,.31,0);crateGroup.add(band);}
  const mark=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.012),new THREE.MeshStandardMaterial({color:0x17333b,roughness:.7}));mark.position.set(0,.43,.267);crateGroup.add(mark);g.userData.brandMark=mark;
  g.userData.workPoint=new THREE.Vector3(0,1.63,0);g.userData.crate=crateGroup;return g;
}
function createMaterialBin(type){
  const g=new THREE.Group();g.name=`material-bin-${type}`;
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.62,.12,.76),new THREE.MeshStandardMaterial({color:0x214a4b,roughness:.85}));base.position.y=.06;g.add(base);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.42,.62,.58),new THREE.MeshStandardMaterial({color:type==='round'?0x276c69:type==='plate'?0x356684:0x70523f,roughness:.78}));body.position.y=.4;body.castShadow=true;g.add(body);
  const lip=new THREE.Mesh(new THREE.BoxGeometry(1.5,.08,.65),new THREE.MeshStandardMaterial({color:0x9fd0c6,roughness:.65}));lip.position.y=.75;g.add(lip);
  const metal=new THREE.MeshStandardMaterial({color:type==='round'?0x7cdeca:type==='plate'?0x8dc9f1:0xffbf7d,metalness:.35,roughness:.45});
  for(let i=0;i<3;i++){
    const geometry=type==='round'?new THREE.CylinderGeometry(.12,.12,1.05,16):type==='plate'?new THREE.BoxGeometry(1.08,.055,.42):new THREE.BoxGeometry(.32,.32,.35);
    const stock=new THREE.Mesh(geometry,metal);
    stock.position.set(type==='block'?(i-1)*.38:0,type==='plate'?.83+i*.07:type==='block'?.94:.9,type==='round'?(i-1)*.18:0);
    if(type==='round')stock.rotation.z=Math.PI/2;
    stock.castShadow=true;g.add(stock);
  }
  const sign=new THREE.Mesh(new THREE.BoxGeometry(.72,.18,.025),new THREE.MeshStandardMaterial({color:0x102a32,roughness:.7}));sign.position.set(0,.55,.305);g.add(sign);
  g.userData.workPoint=new THREE.Vector3(0,.8,0);g.userData.stock=type;return g;
}

// Both themes light the same shop. Night keeps every station readable.
const THEMES={
  day:{sky:0x102c38,backdrop:0x163845,hemi:[0xdafff3,0x466374,2.25],sun:[0xffe6b5,3.8],fill:[0x86d8ee,2],exposure:1.22},
  night:{sky:0x070f19,backdrop:0x0a1620,hemi:[0x9db8f4,0x22303f,1.55],sun:[0xffc98d,2.9],fill:[0x4f7fd6,1.5],exposure:1.16},
  // Open for Business runs a working day: morning light drifts to dusk by closing.
  morning:{sky:0x18394a,backdrop:0x1d4252,hemi:[0xfff1dc,0x4a6474,2.3],sun:[0xffe0a8,3.9],fill:[0x9fdcf0,1.9],exposure:1.24},
  dusk:{sky:0x2a2438,backdrop:0x2b2a3c,hemi:[0xffc9a6,0x3c3346,1.85],sun:[0xff9d62,3.2],fill:[0x7f86d8,1.6],exposure:1.18},
};
function activeMapId(){return menuMode?'first-shop':game.config.mapId;}
const themeColor=new THREE.Color(),themeOther=new THREE.Color();
function mixColor(target,a,b,t){target.set(themeColor.set(a).lerp(themeOther.set(b),t));}
function applyTheme(a,b=a,t=0){
  mixColor(scene.background,a.sky,b.sky,t);scene.fog.color.copy(scene.background);mixColor(lighting.backdrop.material.color,a.backdrop,b.backdrop,t);
  mixColor(lighting.hemi.color,a.hemi[0],b.hemi[0],t);mixColor(lighting.hemi.groundColor,a.hemi[1],b.hemi[1],t);lighting.hemi.intensity=THREE.MathUtils.lerp(a.hemi[2],b.hemi[2],t);
  mixColor(lighting.sun.color,a.sun[0],b.sun[0],t);lighting.sun.intensity=THREE.MathUtils.lerp(a.sun[1],b.sun[1],t);mixColor(lighting.fill.color,a.fill[0],b.fill[0],t);lighting.fill.intensity=THREE.MathUtils.lerp(a.fill[1],b.fill[1],t);
  renderer.toneMappingExposure=THREE.MathUtils.lerp(a.exposure,b.exposure,t);
}
function applyMap(){
  const mapId=activeMapId(),managing=!!game.manager&&!menuMode;
  if(appliedTheme!==mapId){
    appliedTheme=mapId;applyTheme(THEMES[MAPS[mapId].theme]);activateMap(mapId);routeCache.clear();
    for(const s of Object.values(stations)){s.def=placed(s.base,mapId);s.access=accessOf(s.def);if(s.def.id!=='office')s.model.position.set(s.def.x,0,s.def.z);}
    // The east wing widens the room: refit the camera and stretch the sun's shadows over it.
    const wing=mapId==='owner-wing';annex.visible=wing;lighting.sun.shadow.camera.right=wing?19.5:15;lighting.sun.shadow.camera.updateProjectionMatrix();
    shopFrame=measureShopFrame();layoutDirty=true;
  }
  if(managing){const t=game.mode==='evening'||game.mode==='results'?1:Math.min(1,game.elapsed/DAY_SECONDS);applyTheme(THEMES.morning,THEMES.dusk,t*t);}
  for(const s of Object.values(stations))s.model.visible=mapHas(s.def,mapId)&&(s.def.id!=='material-block'||menuMode||game.config.stock.includes('block'));
  for(const [id,bay] of Object.entries(bays)){const def=stations[id].def;bay.visible=managing&&mapHas(def,mapId)&&!game.stations[id];bay.position.set(def.x,0,def.z);bay.rotation.y=def.rotationY??0;}
}
function createBay(def){
  const g=new THREE.Group(),tape=new THREE.MeshStandardMaterial({color:0xeac16b,roughness:.7}),dark=new THREE.MeshStandardMaterial({color:0x183441,roughness:.8});
  const w=def.w,d=def.d,t=.07;
  for(const [x,z,sx,sz] of [[0,-d/2,w,t],[0,d/2,w,t],[-w/2,0,t,d],[w/2,0,t,d]]){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,.012,sz),tape);m.position.set(x,.03,z);m.receiveShadow=true;g.add(m);}
  for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.05,.013,w*.18),dark);m.position.set(-w*.3+i*w*.2,.032,0);m.rotation.y=.7;g.add(m);}
  g.visible=false;return g;
}
function boot(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x102c38);scene.fog=new THREE.Fog(0x102c38,35,70);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(viewport.w,viewport.h);renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;$('scene').appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(game.mode==='playing')pause();$('fatal-message').textContent='Your browser paused the 3D graphics. Reload the game to reopen the shop.';$('fatal').hidden=false;});
  camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,100);
  const hemi=new THREE.HemisphereLight(0xdafff3,0x466374,2.25);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe6b5,3.8);sun.position.set(-7,15,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=14;sun.shadow.camera.bottom=-13;sun.shadow.camera.near=.5;sun.shadow.camera.far=45;sun.shadow.bias=-.00045;sun.shadow.normalBias=.03;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight(0x86d8ee,2);fill.position.set(9,7,-6);scene.add(fill);
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x163845,roughness:1}));backdrop.rotation.x=-Math.PI/2;backdrop.position.y=-.53;backdrop.receiveShadow=true;scene.add(backdrop);lighting={hemi,sun,fill,backdrop};
  world=createWorkshop();scene.add(world);annex=createAnnex();annex.visible=false;scene.add(annex);
  const officeArt=world.userData.office.userData;officeArt.normalScreenMaterial=officeArt.monitorScreen.material;
  // Brand the delivered crate with its supplier.
  new THREE.TextureLoader().load($('covari-logo').src,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.repeat.set(.52,.52);texture.offset.set(.24,.24);const material=new THREE.MeshStandardMaterial({map:texture,color:0xffffff});stations.receiving.model.userData.brandMark.material=material;});
  for(const def of STATION_LAYOUT){
    const model=def.id==='office'?world.userData.office:def.id==='receiving'?createReceivingDock():def.stock?createMaterialBin(def.stock):def.bay?new THREE.Group():createMachine(def.id);if(def.id!=='office'){model.position.set(def.x,0,def.z);model.rotation.y=def.rotationY??0;model.scale.setScalar(def.scale??1);scene.add(model);}
    const label=document.createElement('button');label.className='station-label'+(def.stock?' stock-label':'');label.id='station-'+def.id;label.setAttribute('aria-label','Walk to '+def.name);const machine=def.bay||OPS[def.id]&&def.id!=='ship';label.innerHTML=`<span class="station-dot"></span>${def.stock?stockIcon(def.stock):['lathe','mill'].includes(def.id)?technologyIcon(def.id):''}<span class="station-name">${def.name}</span><span class="station-time"></span><i class="station-progress"></i>${machine?'<i class="station-wear" hidden></i>':''}${def.bay?'<span class="label-more" role="button" tabindex="-1" aria-label="Machine options" hidden>⋯</span>':''}`;label.onclick=e=>{if(e.target.closest('.label-more'))return openPopover('machine',def.id);stationClick(def.id);};$('station-labels').appendChild(label);
    stations[def.id]={def,base:def,model,label,access:accessOf(def),op:def.bay?null:def.id,height:def.height};if(def.bay){bays[def.id]=createBay(def);scene.add(bays[def.id]);}
    if(model.userData.spindle)model.userData.spindle.userData.baseY=model.userData.spindle.position.y;
  }
  character=createCharacter();scene.add(character);carryAnchor=character.userData.carryAnchor||character;
  const ringGeo=new THREE.RingGeometry(.36,.43,40);const ringMat=new THREE.MeshBasicMaterial({color:0xffda7b,side:THREE.DoubleSide,transparent:true,opacity:.8});playerRing=new THREE.Mesh(ringGeo,ringMat);playerRing.rotation.x=-Math.PI/2;playerRing.position.y=.075;scene.add(playerRing);
  targetRing=new THREE.Mesh(new THREE.RingGeometry(.25,.31,32),new THREE.MeshBasicMaterial({color:0x92f4db,side:THREE.DoubleSide,transparent:true,opacity:.7}));targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;scene.add(targetRing);
  shopFrame=measureShopFrame();
  const layoutObserver=new ResizeObserver(()=>{layoutDirty=true;});
  for(const id of ['live-hud','orders','game-footer','shop-sidebar'])layoutObserver.observe($(id));
  resize();buildShiftPicker();buildModeCard();bindControls();updateCamera(0,true);renderer.render(scene,camera);$('loading').hidden=true;
  requestAnimationFrame(frame);
  window.__chipRush={snapshot:()=>({...game.snapshot(),player:{...player},target:pathStation,pathLength:path.length,nearby:nearby?.def.id??null,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,stationsLayout:STATION_LAYOUT.map(s=>({...s,access:{...stations[s.id].access},screen:screenPoint(new THREE.Vector3(s.x,s.height,s.z))}))}),version:'2.5.0'};
  registerTools();social.refreshBoard();
}
function measureShopFrame(){
  // Fit the whole miniature shop, excluding the enormous backdrop. Keep
  // camera orientation identical to movement and pointer raycasting.
  const frame={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity};
  const include=p=>{const x=p.dot(right),y=p.dot(cameraUp);frame.left=Math.min(frame.left,x);frame.right=Math.max(frame.right,x);frame.bottom=Math.min(frame.bottom,y);frame.top=Math.max(frame.top,y);};
  for(const x of [bounds.minX,bounds.maxX])for(const z of [bounds.minZ,bounds.maxZ])include(new THREE.Vector3(x,0,z));
  for(const s of Object.values(stations)){
    if(s.def.map)continue;
    const box=new THREE.Box3().setFromObject(s.model);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])include(new THREE.Vector3(x,y,z));
    include(new THREE.Vector3(s.def.x,s.def.height+.1,s.def.z));
  }
  for(const shellObject of annex?.visible?[world,annex]:[world]){
    const shell=new THREE.Box3().setFromObject(shellObject);
    for(const x of [shell.min.x,shell.max.x])for(const y of [shell.min.y,shell.max.y])for(const z of [shell.min.z,shell.max.z])include(new THREE.Vector3(x,y,z));
  }
  return frame;
}
function measurePlayFrame(){
  const footer=$('game-footer').getBoundingClientRect(),orders=$('orders').getBoundingClientRect();
  const left=10,rightEdge=viewport.w-10;
  // Orders reserve the top edge; controls reserve the bottom. Fit the shop
  // across the full width, including after call controls change height.
  const top=orders.bottom+12,bottom=footer.top-12;
  const scale=Math.max((shopFrame.right-shopFrame.left)/Math.max(120,rightEdge-left),(shopFrame.top-shopFrame.bottom)/Math.max(100,bottom-top));
  const cx=(left+rightEdge)/2,cy=(top+bottom)/2;
  const look=right.clone().multiplyScalar((shopFrame.left+shopFrame.right)/2-(cx-viewport.w/2)*scale)
    .addScaledVector(cameraUp,(shopFrame.top+shopFrame.bottom)/2+(cy-viewport.h/2)*scale);
  return {halfHeight:viewport.h*scale/2,look};
}
function resize(){viewport={w:innerWidth,h:innerHeight};layoutDirty=true;renderer.setSize(viewport.w,viewport.h);if(!menuMode)revealSelectedTicket();updateCamera(0,true);}
function updateCamera(dt,instant=false){
  const desired=menuMode?0:1;cameraBlend=instant?desired:THREE.MathUtils.damp(cameraBlend,desired,4,dt);
  const aspect=viewport.w/viewport.h,mobile=aspect<.85;
  let halfHeight=mobile?12.8/Math.max(aspect,.48):9.1;
  if(!mobile&&aspect<1.45)halfHeight=11.8/aspect;
  // The title camera moves the little factory beside the clock-in card.
  const offset=mobile?0:-4.0;
  const look=new THREE.Vector3(right.x*offset,0,right.z*offset);
  look.y=mobile?-7.2:.25;
  if(!menuMode&&(layoutDirty||!playFrame)){playFrame=measurePlayFrame();layoutDirty=false;}
  if(playFrame){halfHeight=THREE.MathUtils.lerp(halfHeight,playFrame.halfHeight,cameraBlend);look.lerp(playFrame.look,cameraBlend);}
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
  camera.position.copy(look).add(cameraOffset);camera.lookAt(look);
  if(shake>0&&!reduced){camera.position.x+=(Math.random()-.5)*shake*.07;camera.position.y+=(Math.random()-.5)*shake*.04;}
  camera.updateMatrixWorld();
}
// Sparks share one geometry and one material per color instead of allocating each.
const particleGeometry=new THREE.BoxGeometry(.035,.035,.08),particleMaterials=new Map();
const particleMaterial=color=>{if(!particleMaterials.has(color))particleMaterials.set(color,new THREE.MeshBasicMaterial({color}));return particleMaterials.get(color);};
function spawnParticles(x,y,z,color=0xffd57b,count=12){for(let i=0;i<count;i++){const m=new THREE.Mesh(particleGeometry,particleMaterial(color));m.position.set(x,y,z);m.rotation.set(Math.random()*6,Math.random()*6,0);scene.add(m);particles.push({mesh:m,vx:(Math.random()-.5)*2.3,vy:1+Math.random()*1.7,vz:(Math.random()-.5)*2.3,life:.65+Math.random()*.6});}}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);continue;}p.vy-=4*dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.mesh.rotation.x+=dt*4;p.mesh.scale.setScalar(Math.min(1,p.life*3));}}
function processEvents(){for(const ev of game.drain()){
  if(game.manager&&managerEvent(ev))continue;
  audio.event(ev.type);
  if(ev.type==='hint')toast(ev.message);
  if(ev.type==='sourceDelivered'){audio.event('ready');spawnParticles(stations.receiving.def.x,1.6,stations.receiving.def.z,0x72e8cf,8);}
  if(ev.type==='sourceFulfilled'){audio.event('shipped');floatText(`+${ev.points} · ORDER FULFILLED`,'ship',true);spawnParticles(6,1.2,1.2,0x72e8cf,18);}
  if(ev.type==='programmed'){floatText('CAD READY ✓','office',true);}
  if(ev.type==='call'){nextPhoneRing=clockTime+2.2;}
  if(ev.type==='callAnswering'){clearMovement();player.angle=Math.atan2(stations.office.def.x-player.x,stations.office.def.z-player.z);}
  if(ev.type==='callAnswered'){floatText(`+${ev.points} · CALL HANDLED`,'office',true);$('call-accept').focus();}
  if(ev.type==='rushAccepted')toast('Rush accepted',1.5);
  if(ev.type==='rushExpired'){floatText(`−${ev.penalty} · RUSH MISSED`,'office',true);toast(`Rush missed · −${ev.penalty} points.`+(ev.reason==='timeout'?' The regular order is still good.':''),3);}
  if(ev.type==='rushWon'){floatText('RUSH DELIVERED ✓','ship',true);}
  if(ev.type==='recycle')toast(`#${ev.orderId} recycled`,3);
  if(ev.type==='ready'){floatText('READY ✓',ev.station,true);const s=stations[ev.station];spawnParticles(s.def.x,1.5,s.def.z,0x9effd4,5);}
  if(ev.type==='shipped'){floatText(`+${ev.points}${ev.combo>1?'  ×'+ev.combo+' streak':''}`,'ship');spawnParticles(6,1.2,1.2,0xffd76c,28);shake=.7;}
  if(ev.type==='expired')toast(`#${ev.orderId} expired`,3.3);
  if(ev.type==='finish')showResults();
  if(ev.type==='load'){const s=stations[ev.station];spawnParticles(s.def.x,1.15,s.def.z,0x7ff0e0,4);}
}}
function partSignature(o){return `${o.id}:${o.index}:${o.location}`;}
function syncParts(){
  const source=game.sourcing?.started?game.sourcing:null;
  const active=[...game.orders,...(source?[source]:[])];
  // Covari crates in transit or waiting at Receiving are drawn by the dock itself.
  const shown=o=>o.started&&o.location!=='supplier'&&o.location!=='receiving';
  if(game.manager)ensureStaffViews();
  const living=new Set(active.filter(shown).map(o=>o.id));
  for(const [id,entry] of parts){if(!living.has(id)){entry.mesh.removeFromParent();parts.delete(id);}}
  for(const o of active){if(!shown(o))continue;let entry=parts.get(o.id);const sig=partSignature(o);if(entry?.sig===sig)continue;
    if(entry)entry.mesh.removeFromParent();const stage=o.id===201||o.outsourced?Math.min(3,o.index+1):o.index===0?0:o.route.slice(0,o.index).includes('anodize')?4:Math.min(3,o.index);const mesh=createPart(stage,o.color,o.kind);entry={mesh,sig,order:o.id};parts.set(o.id,entry);
    const staffCarry=staffViews.get(o.location)?.anchor;
    if(o.location==='hands'||staffCarry){(staffCarry||carryAnchor).add(mesh);mesh.position.set(0,0,0);mesh.scale.setScalar(1.15);}
    else{const id=o.location==='buffer'?'buffer':o.location;const s=stations[id];if(s){s.model.add(mesh);mesh.position.copy(s.model.userData.workPoint||new THREE.Vector3(0,1.2,0));}}
  }
}
function updateMovement(dt){
  if(game.mode!=='playing'||onPhone())return;
  let sx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touchVector.x;
  let sy=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touchVector.y;
  const move=new THREE.Vector3();let speed=4.4,pathGoal=null;
  if(Math.hypot(sx,sy)>.1){path=[];pathStation=null;targetRing.visible=false;move.copy(right).multiplyScalar(sx).addScaledVector(down,sy);if(move.length()>1)move.normalize();}
  else if(path.length){
    let goal=path[0],dist=Math.hypot(goal.x-player.x,goal.z-player.z);
    while(path.length&&dist<.13){path.shift();dashTime=0;goal=path[0];if(goal)dist=Math.hypot(goal.x-player.x,goal.z-player.z);}
    if(goal){pathGoal=goal;move.set(goal.x-player.x,0,goal.z-player.z).normalize();speed=Math.min(speed,dist/Math.max(.001,dt));}
    else if(pathStation){const id=pathStation;pathStation=null;targetRing.visible=false;const s=stations[id];player.angle=Math.atan2(s.def.x-player.x,s.def.z-player.z);if(Math.hypot(player.x-s.access.x,player.z-s.access.z)<1.4){useStation(id);processEvents();}}
  }
  dashCooldown=Math.max(0,dashCooldown-dt);let distance=speed*dt;
  if(dashTime>0){const step=dashStep(dt,dashTime,speed*move.length());dashTime=step.remaining;distance=step.distance;if(!pathGoal)move.copy(dashDirection);}
  // A click route ends a dash at its next corner or station, never beyond it.
  if(pathGoal){const remaining=Math.hypot(pathGoal.x-player.x,pathGoal.z-player.z);if(distance>=remaining){distance=remaining;dashTime=0;}}
  const before={x:player.x,z:player.z};moveBy(move.x*distance,move.z*distance);const moving=Math.hypot(player.x-before.x,player.z-before.z)>.003;
  if(moving){player.angle=Math.atan2(move.x,move.z);walkPhase+=dt*(dashTime>0?23:15);}
  const u=character.userData;const swing=moving?Math.sin(walkPhase)*.65:Math.sin(clockTime*2)*.025;
  if(u.leftLeg)u.leftLeg.rotation.x=swing;if(u.rightLeg)u.rightLeg.rotation.x=-swing;
  const typing=(game.office?.orderId)&&atOffice();if(u.leftArm)u.leftArm.rotation.x=typing?-.75+Math.sin(clockTime*16)*.1:game.hand?-.8:-swing*.6;if(u.rightArm)u.rightArm.rotation.x=typing?-.75-Math.sin(clockTime*16)*.1:game.hand?-.8:swing*.6;
  character.position.set(player.x,moving?Math.abs(Math.sin(walkPhase))*.048:Math.sin(clockTime*2.4)*.012,player.z);
  let da=player.angle-character.rotation.y;da=Math.atan2(Math.sin(da),Math.cos(da));character.rotation.y+=da*Math.min(1,dt*18);
  character.scale.y=THREE.MathUtils.damp(character.scale.y,dashTime>0?.88:1,15,dt);playerRing.position.set(player.x,.075,player.z);
  nearby=nearestStation();
}
function animateOfficeSeat(dt){
  if(dt<=0)return;
  const u=character.userData,office=world.userData.office;
  if(!office?.userData.seatPoint)return;
  const directionalInput=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].some(key=>keys.has(key))||Math.hypot(touchVector.x,touchVector.y)>.1;
  const leaving=!onPhone()&&(path.length>0||directionalInput);
  if(menuMode||!atOffice()||leaving)u.officeSeated=false;
  else if(game.manager&&game.staff.some(m=>m.role==='programmer'&&m.seat===0))u.officeSeated=false;
  else if(onPhone()||game.office.orderId)u.officeSeated=true;
  u.seatBlend=THREE.MathUtils.damp(u.seatBlend||0,u.officeSeated?1:0,12,dt);
  const blend=u.seatBlend;
  for(const knee of [u.leftKnee,u.rightKnee])if(knee)knee.rotation.x=blend*Math.PI/2;
  if(u.groundShadow)u.groundShadow.visible=blend<.1;
  if(blend<.001)return;
  const seat=office.localToWorld(office.userData.seatPoint.clone());
  // Seat and stand are presentation only: normal movement, travel time and
  // office-presence rules continue to use the collision-safe approach point.
  character.position.set(player.x,0,player.z).lerp(seat,blend);
  const yaw=office.userData.seatYaw??Math.PI;
  const turn=Math.atan2(Math.sin(yaw-character.rotation.y),Math.cos(yaw-character.rotation.y));
  character.rotation.y+=turn*blend;
  character.scale.y=THREE.MathUtils.lerp(character.scale.y,1,blend);
  for(const leg of [u.leftLeg,u.rightLeg])if(leg)leg.rotation.x=THREE.MathUtils.lerp(leg.rotation.x,-Math.PI/2,blend);
  const typing=(game.office.orderId)&&!onPhone();
  if(u.leftArm)u.leftArm.rotation.x=THREE.MathUtils.lerp(u.leftArm.rotation.x,typing?-1.15+Math.sin(clockTime*16)*.055:-.65,blend);
  if(u.rightArm&&!onPhone())u.rightArm.rotation.x=THREE.MathUtils.lerp(u.rightArm.rotation.x,typing?-1.15-Math.sin(clockTime*16)*.055:-.65,blend);
  if(u.head)u.head.rotation.x=typing?.12*blend:0;
  playerRing.position.set(character.position.x,.19*blend+.075*(1-blend),character.position.z);
}
function animateShop(dt){
  const active=game.mode==='playing';
  applyMap();
  if(stations.receiving)stations.receiving.model.userData.crate.visible=!!game.receiving;
  for(const [id,s] of Object.entries(stations)){
    const state=game.stations[id],down=!!state?.down,busy=!!state?.part&&!state.ready&&!down&&!state?.service,ready=!!state?.ready,op=game.manager?state?.op:id;
    if(s.model.userData.statusLight){const m=s.model.userData.statusLight.material;m.color.set(down?0xff5a4a:ready?0x8bffbb:busy?0xffc458:0x55ddd2);m.emissive.copy(m.color);m.emissiveIntensity=down?(Math.sin(clockTime*9)>0?1.2:.15):busy?.55+Math.sin(clockTime*7)*.35:ready?1:.35;}
    if(down&&active&&!reduced&&Math.random()<dt*5)spawnParticles(s.def.x+(Math.random()-.5)*.6,(s.height??s.def.height)*.75,s.def.z,0x6f7b80,1);
    const spindle=s.model.userData.spindle;
    if(op==='heat')s.model.userData.heat.material.emissiveIntensity=busy&&active?.95+Math.sin(clockTime*5)*.3:ready?.6:.3;
    if(op==='laser')s.model.userData.beam.visible=busy&&active;
    if(spindle&&busy&&active){if(op==='lathe'||op==='deburr')spindle.rotation.x+=dt*15;else if(op==='mill'){spindle.rotation.y+=dt*11;spindle.position.y=spindle.userData.baseY+Math.sin(clockTime*4)*.09;}else if(op==='anodize')spindle.position.y=spindle.userData.baseY+Math.sin(clockTime*2)*.12;else if(op==='inspect')spindle.rotation.y=Math.sin(clockTime*3)*.15;else if(op==='laser')spindle.position.x=Math.sin(clockTime*7)*.24;
      if((op==='lathe'||op==='mill'||op==='deburr')&&Math.random()<dt*7&&!reduced){const p=s.model.localToWorld(s.model.userData.workPoint.clone());spawnParticles(p.x,p.y+.1,p.z,0xffd67b,1);}
    }
    if(state?.part){const mesh=parts.get(state.part.orderId)?.mesh;if(mesh){const wp=s.model.userData.workPoint;if(wp){mesh.position.y=wp.y+(ready&&!reduced?Math.sin(clockTime*3.5)*.055:0);if(ready)mesh.rotation.y+=dt*.8;}}}
  }
  const office=world.userData.office;
  if(office){const officeArt=office.userData;officeArt.monitorScreen.material=officeArt.normalScreenMaterial;const programming=active&&game.office?.present&&(game.office?.orderId)&&!['ringing','answering','offer'].includes(game.call?.state);const ringing=active&&game.call?.state==='ringing';
    if(office.userData.monitorScreen)office.userData.monitorScreen.material.emissiveIntensity=programming?.7+Math.sin(clockTime*12)*.15:.4;
    if(office.userData.phone)office.userData.phone.rotation.y=ringing&&!reduced?Math.sin(clockTime*24)*.09:0;
  }
  const calling=onPhone()&&game.mode!=='menu';
  if(character.userData.callPhone)character.userData.callPhone.visible=calling;
  if(calling){if(character.userData.rightArm)character.userData.rightArm.rotation.x=-2.85;if(character.userData.head)character.userData.head.rotation.z=-.09;}
  else if(character.userData.head)character.userData.head.rotation.z=0;
  animateOfficeSeat(dt);animateStaff(dt);
  if(active&&game.call?.state==='ringing'&&clockTime>=nextPhoneRing){audio.event('call');nextPhoneRing=clockTime+2.2;}
  if(menuMode){character.position.set(.1,Math.sin(clockTime*2)*.018,2.5);character.rotation.y=-.4;playerRing.position.set(.1,.07,2.5);const u=character.userData;if(u.head)u.head.rotation.y=Math.sin(clockTime*.5)*.12;}
  targetRing.scale.setScalar(1+Math.sin(clockTime*6)*.09);updateParticles(dt);shake=Math.max(0,shake-dt*2);
}
function ticketState(o){if(!o.programmed)return game.office.orderId===o.id?`CAD ${game.office.present&&!['ringing','answering','offer'].includes(game.call?.state)?'':'paused · '}${Math.ceil(o.programRemaining)}s`:'Complete CAD at the office';if(o.location==='material')return `Collect ${stockType(o)} stock`;if(o.location==='hands')return `In your hands · ${opInfo(o.route[o.index]).name} next`;if(o.location==='buffer')return 'Parked on Hold bench';const s=game.stations[o.location];return s?.ready?`${opInfo(o.location).name} ready · collect part`:`${opInfo(o.location)?.name||'Machine'} working…`;}
function revealSelectedTicket(){
  const selected=$('ticket-'+game.selectedId);if(!selected)return;
  const rail=$('orders'),area=rail.getBoundingClientRect(),card=selected.getBoundingClientRect(),gap=5;
  if(card.top<area.top+gap)rail.scrollTop-=area.top+gap-card.top;
  else if(card.bottom>area.bottom-gap)rail.scrollTop+=card.bottom-area.bottom+gap;
  if(card.left<area.left+gap)rail.scrollLeft-=area.left+gap-card.left;
  else if(card.right>area.right-gap)rail.scrollLeft+=card.right-area.right+gap;
}
function updateTickets(force){
  const signature=game.orders.map(o=>`${o.id}:${o.index}:${o.location}:${o.id===game.selectedId}:${game.stations[o.location]?.ready}:${o.programmed}:${game.office.orderId===o.id}:${game.office.present}:${game.call?.orderId===o.id?game.call.state:""}`).join('|');
  if(force||signature!==renderedTickets){const focused=document.activeElement?.id;const scroll={x:$('orders').scrollLeft,y:$('orders').scrollTop};renderedTickets=signature;$('orders').replaceChildren();if(!game.orders.length){$('orders').innerHTML='<div class="orders-empty">All caught up. Keep an eye on incoming orders.</div>';}
    for(const o of game.orders){const el=document.createElement('article');const stock=stockType(o);const active=game.heldOrder?.id===o.id,focus=!game.hand&&(game.office.orderId??game.selectedId)===o.id;el.className='order-ticket'+(o.route.length+1+(game.config.programming?1:0)>4?' long-route':'')+(active?' carried-job':focus?' passive-focus':'');el.id='ticket-'+o.id;el.setAttribute('aria-label',`Order ${o.id}, ${o.name}`);const route=orderWorkflow(o,game.config.programming).map(step=>`<span class="route-step${step.done?' done':step.active?' active':''}" title="${step.title}">${step.done?'✓ ':''}${step.label}</span>`).join('<span class="route-arrow">›</span>');el.innerHTML=`<div class="ticket-top"><span>Order #${o.id}</span><span class="due"></span></div><div class="ticket-heading"><h3>${o.name}</h3><span class="stock-icon" role="img" title="${stock} stock" aria-label="${stock} stock">${stockIcon(stock)}</span><span class="technology-badges">${technologyBadges([...new Set(o.route.filter(key=>key==='lathe'||key==='mill'))])}</span></div><div class="route">${route}</div><div class="ticket-status sr-only">${ticketState(o)}</div><div class="rush-status" hidden></div><div class="ticket-progress"><i></i></div>`;$('orders').appendChild(el);}
    $('orders').appendChild(sourceCard);if(focused)$(focused)?.focus({preventScroll:true});
    $('orders').scrollLeft=scroll.x;$('orders').scrollTop=scroll.y;
    if(renderedSelection!==game.selectedId){renderedSelection=game.selectedId;revealSelectedTicket();}
  }
  for(const o of game.orders){const el=$('ticket-'+o.id);if(!el)continue;el.classList.toggle('urgent',o.remaining<20);el.querySelector('.due').textContent=Math.ceil(o.remaining)+'s';el.querySelector('.due').classList.toggle('urgent',o.remaining<20);const rush=game.call?.orderId===o.id?game.call:null;const badge=el.querySelector('.rush-status');badge.hidden=!rush;badge.textContent=rush?(rush.state==='active'?`RUSH +${rush.bonus} · ${Math.ceil(rush.remaining)}s`:`CALL · +${rush.bonus} offer`):'';el.classList.toggle('rush-ticket',!!rush);el.querySelector('.ticket-status').textContent=ticketState(o);el.querySelector('.ticket-progress i').style.transform=`scaleX(${Math.max(0,o.remaining/o.deadline)})`;}
}
function nextTarget(){if(game.manager)return managerNextTarget();if(onPhone())return 'office';if(game.heldOrder&&!game.heldOrder.programmed)return 'office';if(game.hand)return game.heldOrder?.route[game.heldOrder.index];const ready=Object.entries(game.stations).find(([id,s])=>s.ready);if(ready)return ready[0];if(game.nextCAD?.())return 'office';const candidates=['round','plate','block'].map(type=>game.nextMaterial?.(type)).filter(Boolean);const next=candidates.sort((a,b)=>a.remaining-b.remaining)[0];if(next)return `material-${stockType(next)}`;const o=game.selected;return o?.location==='material'?`material-${stockType(o)}`:o?.location==='hands'?o.route[o.index]:o?.location||null;}
function stationAction(id){if(onPhone())return game.call.state==='answering'?`On the phone · ${Math.ceil(game.call.answerRemaining)}s`:'Choose your reply to the customer';const o=game.heldOrder,s=game.stations[id];if(id==='office')return !game.config.programming?'CAD prepared for this shift':game.call?.state==='ringing'?'Answer customer call':game.nextCAD?.()?'Auto CAD · stay at the desk':'CAD complete';if(id==='receiving')return game.receiving?(game.hand?`Free your hands to receive #${game.receiving.orderId}`:`Collect Order #${game.receiving.orderId}`):game.sourcing?.state==='sourcing'||game.manager&&game.covariOrders().length?'Delivery on the way':'No delivery waiting';
  if(game.manager){const action=managerStationAction(id);if(action)return action;}if(id.startsWith('material-')){const type=id.slice(9);const next=game.nextMaterial(type);return o?.id===201?'Inspect and ship this customer part':game.hand?`Recycle #${o.id} · restart route`:next?`Collect ${type} stock · #${next.id}`:game.orders.some(job=>stockType(job)===type&&!job.programmed)?'Complete CAD at the office first':`No ${type} job ready`;}if(id==='buffer')return game.hand&&game.buffer?'Swap carried and parked parts':game.hand?'Park carried part':game.buffer?'Collect parked part':'Hold a part here';if(id==='ship')return o?.route[o.index]==='ship'?`Ship #${o.id}`:'Bring an inspected part';if(s?.part)return s.ready?(game.hand?(o?.route[o.index]===id?`Swap for #${s.part.orderId}`:'Held part needs another operation'):`Collect #${s.part.orderId}`):`Working · ${Math.ceil(s.remaining)}s`;return o?.route[o.index]===id?`Start ${opInfo(id).name.toLowerCase()}`:`${opInfo(id)?.name||id} station`;}
function updateUI(force=false){
  if(game.manager)updateManagerHUD(force);else{
  $('score-label').textContent='SCORE';$('timer-label').textContent='SHIFT ENDS';$('score').classList.remove('negative');
  $('score').textContent=game.score.toLocaleString();
  const nextStar=game.config.stars.findIndex(target=>game.shipped<target);
  $('shipped-label').textContent=nextStar<0?'★★★ SHIPPED':`TO ${'★'.repeat(nextStar+1)}`;
  $('shipped').textContent=nextStar<0?String(game.shipped):`${game.shipped}/${game.config.stars[nextStar]}`;
  const shipmentGoal=`${game.shipped} orders shipped. Clear at ${game.config.passTarget}. ${nextStar<0?'All three stars earned.':`${nextStar+1} star${nextStar?'s':''} at ${game.config.stars[nextStar]} shipped.`}`;
  $('shipment-progress').title=shipmentGoal;$('shipment-progress').setAttribute('aria-label',shipmentGoal);
  $('order-count').textContent=`${game.orders.length} / 4`;}
  const t=Math.ceil(game.time);$('timer').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;$('timer').parentElement.classList.toggle('urgent',t<=30);if(game.manager)updateManagerTickets(force);else updateTickets(force);
  updateOfficeUI();updateSourceUI();
  const action=nearby?stationAction(nearby.def.id):'Move closer to a station';
  for(const id of ['action-interact','touch-interact']){$(id).title=action;$(id).setAttribute('aria-label',`Interact: ${action}`);}

}
function updateSourceUI(){
  const job=game.sourcing,visible=!!job&&!['declined','fulfilled'].includes(job.state);sourceCard.hidden=!visible;if(!visible)return;
  const offered=job.state==='offer',delivered=job.state==='delivered',qc=game.stations.inspect;
  $('source-title').textContent=job.name;
  $('source-capability').hidden=!offered;$('source-capability').textContent=job.gap??'Outside shop capability';
  const technology=$('source-technology');
  if(technology.dataset.technology!==job.technology){technology.innerHTML=technologyBadges([job.technology]);technology.dataset.technology=job.technology;}
  $('source-due').textContent=offered?`${Math.ceil(job.offerRemaining)}s`:'+300';
  $('source-partner').hidden=offered;
  $('source-detail').textContent=job.state==='sourcing'?`· Delivery ${Math.ceil(job.remaining)}s`:job.location==='receiving'?'· Delivered':job.location==='inspect'?(qc.ready?'· QC approved':`· QC ${Math.ceil(qc.remaining)}s`):job.location==='buffer'?'· On bench':job.index>0?'· Ready to ship':'· Ready for QC';
  const route=$('source-route');route.hidden=!delivered;
  if(delivered){const stage=job.location==='receiving'?0:job.index===0?1:2;const signature=String(stage);if(route.dataset.stage!==signature){route.dataset.stage=signature;route.innerHTML=['RECEIVE','QC','SHIP'].map((label,i)=>`<span class="route-step${i<stage?' done':i===stage?' active':''}">${i<stage?'✓ ':''}${label}</span>`).join('<span class="route-arrow">›</span>');}}
  $('source-accept').hidden=!offered;$('source-decline').hidden=!offered;
  $('source-accept').disabled=onPhone();
  const collect=$('source-collect');collect.hidden=!delivered;
  collect.textContent=job.location==='receiving'?'Collect delivery ↗':job.location==='buffer'?'Collect from bench ↗':job.location==='inspect'?(qc.ready?'Collect approved part ↗':'Inspecting…'):job.index>0?'Ship order ↗':'Inspect part ↗';
  collect.disabled=delivered&&job.location==='inspect'&&!qc.ready;
  sourceCard.classList.toggle('delivered',delivered);sourceCard.classList.toggle('chosen',!offered);
}
function updateOfficeUI(){
  const panel=$('office-panel'),call=game.call;
  const offer=call?.state==='offer',ringing=call?.state==='ringing',answering=call?.state==='answering';
  panel.hidden=!(offer||ringing||answering)||['menu','results'].includes(game.mode);
  if(panel.hidden)return;
  const title=$('office-title'),detail=$('office-detail');
  $('office-go').hidden=!ringing;$('call-accept').hidden=!offer;$('call-decline').hidden=!offer;
  $('call-accept').disabled=offer&&!atOffice();$('call-decline').disabled=offer&&!atOffice();
  panel.classList.add('calling');
  if(answering){title.textContent=`ON THE PHONE · ${Math.ceil(call.answerRemaining)}s`;detail.textContent='Stay at Office';}
  else if(offer){
    const o=game.order(call.orderId);title.textContent=`Rush #${call.orderId} · +${call.bonus} points`;
    detail.textContent=o?`Ship in ${Math.ceil(call.window)}s · +${call.bonus} / −${call.penalty} · Reply ${Math.ceil(call.ringRemaining)}s`:'This order is no longer active.';
  }
  else {title.textContent=`CUSTOMER CALL ${game.callsReceived}/3 · #${call.orderId}`;detail.textContent=`CAD waits · ${Math.ceil(call.ringRemaining)}s`;$('office-go').textContent='Answer at office ↗';}
}
function positionLabels(){
  const carried=$('carried-job'),held=game.heldOrder;
  carried.hidden=game.mode!=='playing'||!held;
  if(!carried.hidden){
    const label=`#${held.id}`;
    if(carried.textContent!==label){carried.textContent=label;carried.setAttribute('aria-label',`Carrying ${label}: ${held.name}`);}
    const anchor=carryAnchor.getWorldPosition(new THREE.Vector3());anchor.y+=.75;
    const point=screenPoint(anchor);carried.style.left=point.x+'px';carried.style.top=point.y+'px';
  }
  const target=nextTarget(),managing=!!game.manager&&!menuMode;for(const [id,s] of Object.entries(stations)){
  const p=screenPoint(new THREE.Vector3(s.def.x,(managing?s.height:s.def.height)+.1,s.def.z));s.label.style.left=p.x+'px';s.label.style.top=p.y+'px';
  if(managing){s.label.hidden=!mapHas(s.def,activeMapId())||id==='material-block'&&!game.config.stock.includes('block');s.label.classList.toggle('target',target===id||nearby?.def.id===id);s.label.style.opacity='';managerLabel(id,s);continue;}
  const st=game.stations[id],program=id==='office'?game.order(game.office.orderId):null,ready=id==='receiving'?!!game.receiving:!!st?.ready,busy=!!st?.part&&!ready||!!program&&game.office.present&&!['ringing','answering','offer'].includes(game.call?.state);
  for(const name of ['for-sale','installing','down','servicing'])s.label.classList.remove(name);
  const locked=id==='receiving'?!game.config.sourcing:id==='office'?!game.config.programming:id.startsWith('material-')?!game.config.stock.includes(id.slice(9)):!!opInfo(id)&&id!=='ship'&&!game.config.unlocks.includes(id);
  s.label.hidden=!mapHas(s.def,activeMapId())||(id==='receiving'?locked:!menuMode&&locked);s.label.classList.toggle('ready',ready);s.label.classList.toggle('busy',busy);s.label.classList.toggle('target',!menuMode&&(target===id||nearby?.def.id===id));s.label.classList.toggle('locked',!menuMode&&locked);
  s.label.querySelector('.station-time').textContent=menuMode?'':id==='office'&&game.call?.state==='ringing'?'☎ CALL':id==='office'&&onPhone()?'☎ ON CALL':id==='receiving'?'':program?`${Math.ceil(program.programRemaining)}s`:ready?'✓ READY':busy?Math.ceil(st.remaining)+'s':locked?'OFF':'';
  s.label.querySelector('.station-progress').style.width=program?`${100*(1-program.programRemaining/PROGRAM_DURATION)}%`:busy?`${100*(1-st.remaining/(st.duration||opInfo(id).duration))}%`:'0';s.label.style.opacity=menuMode?'.72':'';
}
  const sign=$('wing-sign');sign.hidden=!managing||game.expanded||!['playing','evening'].includes(game.mode);
  if(!sign.hidden){const p=screenPoint(new THREE.Vector3(7.25,1.6,-.78));sign.style.left=p.x+'px';sign.style.top=p.y+'px';sign.querySelector('.station-time').textContent=game.wingPending?'TONIGHT':money(WING.cost);}
  positionStaffTags();positionPopover();}
function updateMusic(){audio.update(!document.hidden&&(game.mode==='menu'||game.mode==='playing'),['ringing','answering','offer'].includes(game.call?.state));}
function unlockHomeMusic(){if(game.mode!=='menu'||document.hidden)return;audio.init();updateMusic();}
// Frame budget: high-refresh displays would otherwise redraw the whole shop,
// shadow map included, 120 times a second. Play needs 60; menus and evenings
// idle at 30; a paused, help or results screen behind its overlay needs 10.
const FRAME_BUDGET={playing:60,menu:30,evening:30};
function framesPerSecond(mode){return FRAME_BUDGET[mode]??10;}
let lastRender=-Infinity,shadowTick=0;
function frame(now){
  requestAnimationFrame(frame);
  if(now-lastRender<1000/framesPerSecond(game.mode)-2)return;
  lastRender=now;
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;clockTime+=dt;
  updateMovement(dt);if(game.manager)syncBays();if(game.mode==='playing'){game.setOfficePresence(atOffice());if(game.manager)game.setPlayerStation(nearby?.def.id??null);game.tick(dt);processEvents();syncParts();}
  animateShop(game.mode==='paused'||game.mode==='help'?0:dt);updateCamera(dt);positionLabels();updateMusic();
  uiElapsed+=dt;if(uiElapsed>.09){uiElapsed=0;if(!menuMode)updateUI();}
  if(toastUntil&&now>toastUntil){$('toast').classList.remove('visible');toastUntil=0;}
  // Shadows follow moving characters at up to 30 Hz; the slower modes redraw them every frame.
  if(game.mode!=='playing'||++shadowTick%2)renderer.shadowMap.needsUpdate=true;
  renderer.render(scene,camera);
}
const SHIFT_CREDIT={'first-shift':'Created with Codex + GPT 6 - Astra','mixed-orders':'Created with Codex + GPT 6 - Astra','rush-hour':'Created with Codex + GPT 6 - Astra','night-shift':'Created with Cursor + Sonnet 5.5'};
function buildShiftPicker(){const holder=$('shift-picker');holder.replaceChildren();SHIFTS.forEach((s,i)=>{const b=document.createElement('button');b.className='shift-choice'+(selectedShift===i?' selected':'');b.disabled=i>unlocked;b.dataset.levelId=s.id;b.title=`${s.author} - ${s.harness}`;b.setAttribute('aria-description',`Author: ${s.author}. Harness: ${s.harness}.`);b.setAttribute('aria-label',`${i+1}. ${s.name}${i>unlocked?', clear the previous shift to unlock':''}`);const credit=SHIFT_CREDIT[s.id];b.innerHTML=`<span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${s.name}</b><small>${s.subtitle}</small>${credit?`<small class="shift-credit">${credit}</small>`:''}</span><span class="pick-mark">${i>unlocked?'⌑':grades[i]?'★'.repeat(grades[i]):i===selectedShift?'↗':'·'}</span>`;b.onclick=()=>{selectedShift=i;buildShiftPicker();};holder.appendChild(b);});}
function hidePanels(){for(const id of ['welcome','pause-panel','help-panel','results-panel','briefing-panel','evening-panel'])$(id).hidden=true;}
function clearMovement(){keys.clear();touchVector={x:0,y:0};path=[];pathStation=null;dashTime=0;dashCooldown=0;if(targetRing)targetRing.visible=false;$('joystick-knob').style.transform='';}
function startShift(index){audio.init();game=classicGame;closePopover();resetBays();game.reset(index);social.start(index);selectedShift=index;enterFloor();$('shift-number').textContent=`SHIFT ${String(index+1).padStart(2,'0')} / SHIP ${SHIFTS[index].passTarget} TO CLEAR`;$('shift-name').textContent=SHIFTS[index].name;processEvents();updateUI(true);$('scene').focus();}
// Open for Business is its own mode: always available, outside the shift unlock chain.
function startManager(){audio.init();
  game=managerGame;for(const view of staffViews.values()){view.mesh.removeFromParent();view.tag.remove();}staffViews.clear();
  game.distance=(a,b)=>a===b?0:routeBetween(a,b).length;game.start({length:managerRecord.length});closePopover();resetBays();salesStrip=null;social.start(MANAGER_ROLE,boardId(managerRecord.length));
  enterFloor();$('shift-number').textContent=managerHeading();$('shift-name').textContent=MANAGER_MODE.name;processEvents();updateUI(true);$('scene').focus();}
function restartRun(){if(game.manager)startManager();else startShift(game.shiftIndex);}
function enterFloor(){closeStore();document.body.classList.toggle('manager-mode',!!game.manager);$('action-manage').hidden=!game.manager;$('touch-shop').hidden=!game.manager;resultShown=false;menuMode=false;applyMap();layoutDirty=true;clearMovement();player.x=SPAWN.x;player.z=SPAWN.z;player.angle=Math.PI;character.rotation.y=Math.PI;character.scale.setScalar(1);character.userData.officeSeated=false;character.userData.seatBlend=0;for(const p of parts.values())p.mesh.removeFromParent();parts.clear();$('floating-text').replaceChildren();$('toast').classList.remove('visible');toastUntil=0;hidePanels();$('overlay').hidden=true;$('overlay').classList.remove('centered');$('live-hud').hidden=false;$('shop-sidebar').hidden=false;$('game-footer').hidden=false;$('touch-controls').hidden=false;$('pause-button').hidden=false;document.querySelector('.shift-heading').hidden=false;document.body.classList.add('playing');document.body.classList.toggle('has-office',game.config.programming);document.body.classList.remove('paused');nearby=null;renderedTickets='';renderedManagerTickets='';}
function pause(){if(game.mode!=='playing')return;closeStore();closePopover();game.mode='paused';audio.update(false);clearMovement();hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('pause-panel').hidden=false;document.body.classList.add('paused');$('resume-button').focus();}
function resume(){if(game.mode!=='paused')return;audio.init();game.mode='playing';hidePanels();$('overlay').hidden=true;document.body.classList.remove('paused');last=performance.now();}
function showHelp(){
  if(!$('help-panel').hidden)return;
  helpReturn={mode:game.mode,panel:['welcome','pause-panel','results-panel','briefing-panel'].find(id=>!$(id).hidden),centered:$('overlay').classList.contains('centered')};
  if(game.mode==='playing'){game.mode='help';audio.update(false);clearMovement();}
  hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('help-panel').hidden=false;$('help-close').focus();
}
function closeHelp(){
  if(!helpReturn)return;const previous=helpReturn;helpReturn=null;game.mode=previous.mode;hidePanels();
  $('overlay').hidden=!previous.panel;$('overlay').classList.toggle('centered',previous.centered);if(previous.panel)$(previous.panel).hidden=false;
  document.body.classList.toggle('paused',game.mode==='paused');last=performance.now();
}
function showMenu(){challengeRun=false;closeStore();closePopover();$('overlay').classList.remove('evening');managerGame.mode='menu';game=classicGame;resetBays();document.body.classList.remove('manager-mode');selectedShift=Math.min(selectedShift,unlocked);game.mode='menu';updateMusic();menuMode=true;applyMap();clearMovement();hidePanels();$('welcome').hidden=false;$('overlay').hidden=false;$('overlay').classList.remove('centered');$('live-hud').hidden=true;$('shop-sidebar').hidden=true;$('game-footer').hidden=true;$('touch-controls').hidden=true;$('pause-button').hidden=true;document.querySelector('.shift-heading').hidden=true;document.body.classList.remove('playing','paused','has-office');buildShiftPicker();buildModeCard();social.refreshBoard();}
function showBriefing(index){
  briefingManager=false;selectedShift=index;const cfg=SHIFTS[index];hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('briefing-panel').hidden=false;
  $('briefing-lengths').hidden=true;$('briefing-start').innerHTML='CLOCK IN <span>↗</span>';
  $('briefing-role').textContent=cfg.name;$('briefing-goal').textContent=`Ship ${cfg.passTarget} orders in ${cfg.duration/60} minutes.`;
  $('briefing-targets').innerHTML=cfg.stars.map((target,i)=>`<div><span aria-label="${i+1} star${i?'s':''}">${'★'.repeat(i+1)}</span><strong>${target} <small>shipped</small></strong></div>`).join('');
  $('briefing-text').textContent=cfg.brief;$('briefing-tip').textContent=cfg.tip;$('briefing-panel').scrollTop=0;$('briefing-start').focus({preventScroll:true});
}
let briefingManager=false;
function showManagerBriefing(){
  briefingManager=true;const cfg=MANAGER_MODE;hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('briefing-panel').hidden=false;
  $('briefing-lengths').hidden=false;$('briefing-start').innerHTML='OPEN THE SHOP <span>↗</span>';renderRunLengths();
  $('briefing-role').textContent=cfg.name;$('briefing-goal').textContent=`Start with ${money(START_CASH)}, a lathe, a mill and QC. Each working day lasts 2½ minutes.`;
  $('briefing-targets').innerHTML=cfg.stars.map((target,i)=>`<div><span aria-label="${i+1} star${i?'s':''}">${'★'.repeat(i+1)}</span><strong>${target} <small>days survived</small></strong></div>`).join('');
  $('briefing-text').textContent=cfg.brief;$('briefing-tip').textContent=cfg.tip;$('briefing-panel').scrollTop=0;$('briefing-start').focus({preventScroll:true});
}
// The mode card on the welcome screen, beside (not inside) the shift list.
function buildModeCard(){
  const card=$('mode-manager'),best=Math.max(0,...Object.values(managerRecord.bests));
  card.querySelector('.mode-best').textContent=best?`Best ${money(best)}${managerRecord.days?` · Endless ${managerRecord.days} days`:''}`:'3, 5 or 7 days, or Endless';
}
function showResults(){
  if(resultShown)return;if(game.manager)return showManagerResults();resultShown=true;audio.update(false);clearMovement();const passed=game.passed();if(passed&&!challengeRun)unlocked=Math.max(unlocked,Math.min(SHIFTS.length-1,game.shiftIndex+1));
  const previous=bests[game.shiftIndex]||0;bests[game.shiftIndex]=Math.max(previous,game.score);grades[game.shiftIndex]=Math.max(grades[game.shiftIndex]||0,game.stars());save();hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('results-panel').hidden=false;$('office-panel').hidden=true;$('touch-controls').hidden=true;$('pause-button').hidden=true;document.body.classList.remove('playing');
  const stars=game.stars(),shiftMastery=stars===3;
  $('results-panel').classList.toggle('owner-mastery',shiftMastery);
  $('result-kicker').textContent=`${game.config.name.toUpperCase()} · ${shiftMastery?'THREE-STAR SHIFT':passed?'CLEARED':'SHIFT OVER'}`;$('result-stars').innerHTML=[1,2,3].map(i=>`<span class="${i>stars?'empty':''}">★</span>`).join(' ');$('result-stars').setAttribute('aria-label',`${stars} out of 3 stars`);
  $('result-title').textContent=shiftMastery?'Absolute machine.':passed?'That’s a good shift.':'One more shift?';
  $('result-message').textContent=`${game.shipped} orders shipped. Clear target: ${game.config.passTarget}. ${game.finishReason==='work-complete'?`${game.missed?'No jobs remaining':'All jobs finished'}. ${Math.ceil(game.time)}s to spare.`:`${game.unfinished} unfinished at closing.`} `+(passed?(challengeRun?'Challenge shift complete.':game.shiftIndex<SHIFTS.length-1?'Next shift unlocked.':'All available shifts cleared. More shifts coming.') : game.config.retryTip);
  const nextStar=game.config.stars.findIndex(target=>game.shipped<target);
  $('result-progress').textContent=nextStar<0?(shiftMastery?'Three stars. Exceptional precision under pressure.':'All three stars earned.'):`${game.config.stars[nextStar]-game.shipped} more shipped order${game.config.stars[nextStar]-game.shipped===1?'':'s'} for ${nextStar+1} star${nextStar?'s':''} (${game.config.stars[nextStar]} total).`;
  $('result-score-label').textContent='SCORE';$('result-shipped-label').textContent='SHIPPED';$('result-missed-label').textContent='MISSED';
  $('result-score').textContent=game.score.toLocaleString();$('result-shipped').textContent=game.shipped;$('result-missed').textContent=game.missed;
  const labels={base:'Parts',program:'CAD',speed:'Early shipping',streak:'Streak',rush:'Rush',rushPenalty:'Missed rushes',calls:'Calls',sourcing:'Covari'};
  $('result-breakdown').textContent=Object.entries(game.scoreDetails).filter(([,v])=>v!==0).map(([k,v])=>`${labels[k]} ${v.toLocaleString()}`).join(' · ')||'Ship a part to start earning points.';
  $('result-best').textContent=`${game.score>previous?'NEW PERSONAL BEST · ':''}BEST ${bests[game.shiftIndex].toLocaleString()} · STARS AT ${game.config.stars.join(' / ')} SHIPPED`;
  $('result-covari-message').textContent='More work than your shop can handle? Outsource with Covari. Keep the customer. Keep earning.';
  $('next-button').innerHTML=passed&&!challengeRun&&game.shiftIndex<SHIFTS.length-1?'NEXT SHIFT <span>↗</span>':'TRY AGAIN <span>↗</span>';$('results-panel').scrollTop=0;$('next-button').focus({preventScroll:true});
  social.finish({role:game.shiftIndex,score:game.score,shipped:game.shipped,missed:game.missed,sourced:game.sourced,calls:game.callsAnswered,elapsed:game.elapsed,finishReason:game.finishReason,spawned:game.spawnIndex});
}
function selectSourceJob(){
  if(game.mode!=='playing'||game.sourcing?.state!=='offer'||onPhone())return false;
  const accepted=game.requestSource();processEvents();updateUI(true);return accepted;
}
function selectSourceCard(){
  const job=game.sourcing;if(game.mode!=='playing'||job?.state!=='delivered')return;
  goToStation(job.location==='hands'?job.route[job.index]:job.location);
}
// Open for Business ---------------------------------------------------------
// Rule of the mode's UI: decisions happen on the floor (bays, labels, quote
// cards and the sales strip), not in menus that hide the shop.
const money=n=>`${n<0?'−':''}$${Math.abs(Math.round(n)).toLocaleString()}`;
const pct=n=>`${n>0?'+':n<0?'−':''}${Math.round(Math.abs(n)*100)}%`;
const lengthName=length=>length?`${length}-day run`:'Endless';
const OP_HEIGHT={lathe:3.306,mill:3.534,inspect:2.05,deburr:2.05,anodize:2.2,heat:2.65,laser:2.1};
const opAt=id=>game.manager?(game.stations[id]?.op??null):id;
function managerHeading(){return `OPEN FOR BUSINESS · DAY ${game.day}${game.length?' / '+game.length:''}${game.expanded?' · EAST WING':''}`;}
function renderRunLengths(){
  const holder=$('briefing-lengths');holder.replaceChildren();
  for(const length of RUN_LENGTHS){
    const b=document.createElement('button');b.type='button';b.setAttribute('role','radio');b.setAttribute('aria-checked',String(managerRecord.length===length));
    b.className='run-length'+(managerRecord.length===length?' selected':'');b.dataset.length=length;
    const best=managerRecord.bests[length];
    b.innerHTML=`<b>${length?length+' days':'Endless'}</b><small>${length?(best?'Best '+money(best):'Fixed run'):(managerRecord.days?`Best ${managerRecord.days} days`:'Until the rent wins')}</small>`;
    holder.appendChild(b);
  }
}
function updateManagerHUD(){
  $('score-label').textContent='CASH';$('score').textContent=money(game.cash);$('score').classList.toggle('negative',game.cash<0);
  $('shipped-label').textContent='REPUTATION';$('shipped').textContent='★'+game.reputation.toFixed(1);
  const goal=`Reputation ${game.reputation.toFixed(1)} of 5. Higher reputation brings more quotes and better prices.`;$('shipment-progress').title=goal;$('shipment-progress').setAttribute('aria-label',goal);
  $('timer-label').textContent=game.mode==='evening'?'CLOSED':`DAY ${game.day} ENDS`;
  $('order-count').textContent=`${game.boardLoad()} / ${game.orderLimit}`;
  $('shift-number').textContent=managerHeading();
  if(!$('store-panel').hidden)renderStore();
}
// Bays: the engine says what stands in each bay; the view swaps models to match.
function machineLabel(id){
  const op=game.stations[id]?.op;if(!op)return 'BAY';
  const same=Object.keys(game.stations).filter(key=>game.stations[key].op===op);
  const name=(MACHINES[op]?.name??opInfo(op).name).replace('Heat-treat ','').replace(' station','').replace(' bath','').replace(' marker','').replace('CNC ','').toUpperCase();
  return same.length>1?`${name} ${same.indexOf(id)+1}`:name;
}
let baySignature='';
function syncBays(){
  const signature=game.manager?Object.keys(game.stations).map(key=>key+':'+game.stations[key].op).join():'';
  if(signature===baySignature)return;baySignature=signature;
  for(const id of Object.keys(bays)){
    const s=stations[id],op=game.manager?game.stations[id]?.op??null:null;
    if(s.op!==op){
      s.model.removeFromParent();
      const model=op?createMachine(op):new THREE.Group();
      model.position.set(s.def.x,0,s.def.z);model.rotation.y=s.def.rotationY??0;model.scale.setScalar(op==='lathe'||op==='mill'?1.14:1);
      if(model.userData.spindle)model.userData.spindle.userData.baseY=model.userData.spindle.position.y;
      scene.add(model);s.model=model;s.op=op;s.height=op?OP_HEIGHT[op]:s.def.height;
    }
  }
  for(const [id,s] of Object.entries(stations)){
    if(!s.def.bay&&!['lathe','mill','inspect'].includes(id))continue;
    const text=game.manager&&!menuMode?machineLabel(id):s.def.name;
    const name=s.label.querySelector('.station-name');if(name.textContent!==text)name.textContent=text;
    s.label.setAttribute('aria-label',s.def.bay&&!game.stations?.[id]?`Empty ${BAY_SIZES[s.def.bay].toLowerCase()}: choose a machine`:`Walk to ${text}`);
  }
}
function resetBays(){baySignature='~';syncBays();}
function stationClick(id){
  const s=stations[id];
  if(game.manager&&!menuMode&&s.def.bay&&['playing','evening'].includes(game.mode)){
    if(!game.stations[id])return openPopover('bay',id);
    if(game.mode==='evening')return openPopover('machine',id);
  }
  goToStation(id);
}
// Floor popovers anchor to a station or point and keep the shop in view.
let popover=null;
function openPopover(kind,id){
  if(!game.manager||!['playing','evening'].includes(game.mode))return;
  popover={kind,id};renderPopover();$('floor-popover').hidden=false;positionPopover();
  $('floor-popover').querySelector('button:not([disabled])')?.focus({preventScroll:true});
}
function closePopover(){popover=null;$('floor-popover').hidden=true;}
function renderPopover(){
  if(!popover)return;
  const el=$('floor-popover'),evening=game.mode==='evening',note=evening?'Ready when you open tomorrow.':'Installs in 12 seconds.';
  const option=(attrs,title,sub,price,disabled)=>`<button ${attrs} ${disabled?'disabled':''}><span><b>${title}</b><small>${sub}</small></span>${price!==undefined?`<em>${money(price)}</em>`:''}</button>`;
  if(popover.kind==='bay'){
    const size=stations[popover.id].def.bay;
    el.innerHTML=`<header><small>${BAY_SIZES[size].toUpperCase()}</small><strong>Choose a machine</strong></header><div class="pop-list">${Object.entries(MACHINES).filter(([,m])=>m.sizes.includes(size)).map(([op,m])=>{
      const count=game.stationsFor(op).length;return option(`data-pop="buy" data-op="${op}"`,m.name,count?`${m.blurb} You have ${count}.`:`${m.blurb} Opens new jobs.`,m.cost,game.cash<m.cost);}).join('')}</div><p class="pop-note">${note} ${size==='large'?'Large bays take any machine.':'Lathes, mills and QC benches need a large bay.'}</p>`;
  }else if(popover.kind==='machine'){
    const st=game.stations[popover.id];if(!st)return closePopover();
    const refund=Math.round(MACHINES[st.op].cost*RESALE),idle=!st.part&&!st.service&&!st.down;
    el.innerHTML=`<header><small>${BAY_SIZES[stations[popover.id].def.bay].toUpperCase()} · WEAR ${Math.round(st.wear)}%</small><strong>${machineLabel(popover.id)}</strong></header><div class="pop-list">${option('data-pop="sell"','Sell and free the bay',idle?'Rearrange the floor or change what it can make.':'Empty and repair it first.',refund,!idle)}</div>`;
  }else if(popover.kind==='wing'){
    const pending=game.wingPending;
    el.innerHTML=`<header><small>EXPANSION</small><strong>${WING.name}</strong></header><p class="pop-note">${WING.blurb}</p><div class="pop-list">${option('data-pop="wing"',pending?'Builders arrive tonight':'Build overnight',`Rent becomes ${money(rentFor(game.day+1,true))}/day from tomorrow.`,pending?undefined:WING.cost,pending||game.cash<WING.cost)}</div>`;
  }
}
function popoverAnchor(){
  if(!popover)return null;
  if(popover.kind==='wing')return new THREE.Vector3(7.25,1.6,-.78);
  const s=stations[popover.id];return new THREE.Vector3(s.def.x,(s.height??s.def.height)+.1,s.def.z);
}
function positionPopover(){
  if(!popover)return;const anchor=popoverAnchor(),el=$('floor-popover');if(!anchor)return;
  const p=screenPoint(anchor),w=el.offsetWidth,h=el.offsetHeight;
  el.style.left=Math.max(8,Math.min(viewport.w-w-8,p.x-w/2))+'px';el.style.top=Math.max(8,Math.min(viewport.h-h-8,p.y-h-14))+'px';
}
function popoverAction(event){
  const b=event.target.closest('button[data-pop]');if(!b||b.disabled||!popover)return;
  const act=b.dataset.pop,id=popover.id;
  if(act==='buy')game.buyMachine(id,b.dataset.op);else if(act==='sell')game.sellMachine(id);else if(act==='wing')game.buildWing();
  closePopover();processEvents();syncBays();updateUI(true);if(game.mode==='evening')renderLedger();
}
// Station labels in the owner's shop show wear, breakdowns and service.
function managerLabel(id,s){
  const st=game.stations[id],bayEmpty=!!s.def.bay&&!st,installing=!!st&&id in game.installing;
  const ready=id==='receiving'?!!game.receiving:!!st?.ready,program=id==='office'?game.order(game.office.orderId):null;
  const busy=!!st?.part&&!st.ready&&!st.down||!!program&&game.office.present;
  s.label.classList.toggle('for-sale',bayEmpty);s.label.classList.toggle('installing',installing);
  s.label.classList.toggle('down',!!st?.down);s.label.classList.toggle('servicing',!!st?.service);
  s.label.classList.toggle('ready',ready&&!st?.down);s.label.classList.toggle('busy',busy);s.label.classList.toggle('locked',false);
  const wear=s.label.querySelector('.station-wear');
  if(wear){wear.hidden=!st||installing;if(st){wear.style.width=`${Math.round(st.wear)}%`;wear.dataset.level=st.wear>=BREAK_FROM?'high':st.wear>=35?'mid':'low';}}
  const more=s.label.querySelector('.label-more');if(more)more.hidden=!st||installing;
  const svc=st?.service;
  const time=bayEmpty?(game.mode==='evening'||game.mode==='playing'?'+ ADD':''):installing?`INSTALL ${Math.ceil(game.installing[id])}s`:st?.down&&!svc?'DOWN · FIX':svc?`${svc.kind==='repair'?'FIXING':'SERVICE'} ${Math.ceil(svc.remaining)}s`:
    id==='office'&&program?`${Math.ceil(program.programRemaining)}s`:ready?'✓ READY':busy?Math.ceil(st.remaining)+'s':'';
  s.label.querySelector('.station-time').textContent=time;
  s.label.querySelector('.station-progress').style.width=svc?`${100*(1-svc.remaining/svc.total)}%`:program?`${100*(1-program.programRemaining/program.programDuration)}%`:busy&&st?`${100*(1-st.remaining/(st.duration||1))}%`:'0';
}
function routeChips(order,{progress=false}={}){
  const missing=new Set(game.gapsFor(order.route));
  const steps=order.outsourced?[{label:'RECEIVE',done:order.location!=='supplier'&&order.location!=='receiving',active:order.location==='receiving'},...order.route.map((key,i)=>({label:opInfo(key).short,done:i<order.index,active:order.location!=='supplier'&&order.location!=='receiving'&&i===order.index}))]
    :[...(progress?[{label:'CAD',done:order.programmed,active:!order.programmed},{label:stockType(order).toUpperCase(),done:order.started,active:order.programmed&&!order.started}]:[]),
      ...order.route.map((key,i)=>({key,label:opInfo(key).short+(key==='inspect'&&order.tight?'+':''),done:progress&&i<order.index,active:progress&&order.started&&i===order.index,missing:missing.has(key)}))];
  return steps.map(step=>`<span class="route-step${step.done?' done':step.active?' active':''}${step.missing?' missing':''}" title="${step.missing?`No ${opInfo(step.key).name.toLowerCase()} on this floor`:step.label}">${step.done?'✓ ':step.missing?'✕ ':''}${step.label}</span>`).join('<span class="route-arrow">›</span>');
}
function gapText(order){const gaps=game.gapsFor(order.route);if(!gaps.length)return '';return gaps.map(key=>opInfo(key).external?`No ${opInfo(key).name.toLowerCase()} in this shop`:`No ${opInfo(key).name.toLowerCase()} yet`).join(' · ');}
function customerTag(index){const c=game.customers[index];if(!c)return '';const pips=Math.round(c.loyalty);return `<span class="customer" title="${c.name} · loyalty ${c.loyalty.toFixed(1)} of 3">${c.name}<i>${'♥'.repeat(pips)}${'♡'.repeat(3-pips)}</i></span>`;}
function quoteHTML(q){
  const stock=stockType(q),gap=gapText(q),technology=q.technology?technologyBadges([q.technology]):'',contract=q.type==='contract';
  const note=gap||(contract?`Contract · ${q.units} parts · due end of tomorrow · ${money(q.unitPrice)} each`:`${q.deadline}s to deliver · stock ${money(q.material)}${q.tight?' · tight tolerance':''}`);
  return `<div class="ticket-top">${customerTag(q.customer)}<span class="due"></span></div><div class="ticket-heading"><h3>${contract?`${q.units} × `:''}${q.name}</h3><span class="stock-icon" role="img" title="${stock} stock" aria-label="${stock} stock">${stockIcon(stock)}</span><span class="technology-badges">${technology}</span><b class="price"></b></div><div class="route">${routeChips(q)}</div><small class="quote-note${gap?' gap':''}">${note}</small><div class="quote-actions"><span class="bid" role="group" aria-label="Bid"><button data-act="bid-down" data-id="${q.id}" aria-label="Lower the bid">◀</button><output class="bid-value"></output><button data-act="bid-up" data-id="${q.id}" aria-label="Raise the bid">▶</button></span><button data-act="accept" data-id="${q.id}" class="${gap?'risky':''}"><span class="accept-label">Bid</span> <small class="chance"></small></button>${gap&&!contract?`<button data-act="covari" data-id="${q.id}" class="covari" aria-label="Outsource with Covari"><span class="source-logo"><img src="${$('covari-logo').src}" alt=""></span><span class="covari-keep"></span></button>`:''}<button data-act="decline" data-id="${q.id}" class="decline" aria-label="Turn quote ${q.id} away">No</button></div><div class="ticket-progress"><i></i></div>`;
}
function managerTicketState(o){
  if(o.outsourced)return o.location==='supplier'?`Covari delivery in ${Math.ceil(o.deliveryRemaining)}s`:o.location==='receiving'?'Waiting at Receiving':o.location==='hands'?`In your hands · ${opInfo(o.route[o.index]).name} next`:o.location.startsWith('staff-')?`${staffName(o.location)} is carrying it`:ticketState(o);
  if(o.location?.startsWith('staff-'))return `${staffName(o.location)} is carrying it`;
  const programmer=game.staff.find(m=>m.role==='programmer'&&m.orderId===o.id)??game.staff.find(m=>m.role==='programmer');
  if(!o.programmed&&programmer&&game.office.orderId!==o.id)return programmer.orderId===o.id?`${programmer.name} programming · ${Math.ceil(o.programRemaining)}s`:`Queued for ${programmer.name}'s CAD`;
  if(game.stations[o.location]?.down)return `${machineLabel(o.location)} is down · part stuck inside`;
  if(o.location&&game.stations[o.location])return game.stations[o.location].ready?`${machineLabel(o.location)} done · collect it`:`${machineLabel(o.location)} working…`;
  return ticketState(o);
}
function orderHTML(o){
  const stock=stockType(o);
  return `<div class="ticket-top"><span>${o.outsourced?'Covari':'Order'} #${o.id}</span><span class="due"></span></div><div class="ticket-heading"><h3>${o.name}</h3>${o.outsourced?`<span class="source-logo"><img src="${$('covari-logo').src}" alt="Covari"></span>`:`<span class="stock-icon" role="img" title="${stock} stock" aria-label="${stock} stock">${stockIcon(stock)}</span>`}<b class="price">${money(o.price)}</b></div><div class="route">${routeChips(o,{progress:true})}</div><div class="ticket-status">${managerTicketState(o)}</div><div class="ticket-progress"><i></i></div>`;
}
function contractHTML(c){
  const stock=stockType(c);
  return `<div class="ticket-top"><span>Contract #${c.id}</span><span class="due"></span></div><div class="ticket-heading"><h3>${c.units} × ${c.name}</h3><span class="stock-icon" role="img" title="${stock} stock" aria-label="${stock} stock">${stockIcon(stock)}</span><b class="price">${money(c.unitPrice*c.units)}</b></div><div class="route">${routeChips(c)}</div><div class="contract-units"></div><div class="ticket-status"></div><div class="ticket-progress"><i></i></div>`;
}
function contractState(c){
  const units=game.orders.filter(o=>o.contractId===c.id),floor=units.filter(o=>o.started).length;
  return {units,text:`${c.shipped}/${c.units} shipped${floor?` · ${floor} on the floor`:''}${c.failed?` · ${c.failed} missed`:''} · ${customerName(c.customer)}`};
}
const customerName=index=>game.customers[index]?.name??'';
function clock(seconds){const t=Math.max(0,Math.ceil(seconds));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;}
// The sales strip: the rules your sales manager follows, and your standing bid.
const POLICY_TEXT={gaps:{decline:'Turn away',covari:'Covari',accept:'Accept'},contracts:{true:'Take',false:'Skip'}};
function salesStripHTML(){
  return `<div class="sales-head"><small>SALES</small><strong class="sales-who"></strong></div>
  <div class="sales-row"><span>Standing bid</span><span class="bid"><button data-policy="markup" data-step="-1" aria-label="Lower the standing bid">◀</button><output data-show="markup"></output><button data-policy="markup" data-step="1" aria-label="Raise the standing bid">▶</button></span></div>
  <div class="sales-row"><span>Missing process</span><button data-policy="gaps" data-show="gaps"></button></div>
  <div class="sales-row"><span>Keep slots free</span><button data-policy="reserve" data-show="reserve"></button></div>
  <div class="sales-row"><span>Contracts</span><button data-policy="contracts" data-show="contracts"></button></div>`;
}
let salesStrip=null;
function updateSalesStrip(){
  if(!salesStrip){salesStrip=document.createElement('article');salesStrip.id='sales-strip';salesStrip.className='sales-strip';salesStrip.setAttribute('aria-label','Sales rules');salesStrip.innerHTML=salesStripHTML();}
  const seller=game.staff.find(m=>m.role==='sales'),p=game.policy;
  salesStrip.querySelector('.sales-who').textContent=seller?`${seller.name} answers quotes`:'You answer quotes';
  salesStrip.classList.toggle('automatic',!!seller);
  salesStrip.querySelector('[data-show="markup"]').textContent=pct(p.markup);
  salesStrip.querySelector('[data-show="gaps"]').textContent=POLICY_TEXT.gaps[p.gaps];
  salesStrip.querySelector('[data-show="reserve"]').textContent=String(p.reserve);
  salesStrip.querySelector('[data-show="contracts"]').textContent=POLICY_TEXT.contracts[p.contracts];
}
function policyAction(b){
  const key=b.dataset.policy,p=game.policy;
  const next=key==='markup'?BIDS[Math.max(0,Math.min(BIDS.length-1,BIDS.indexOf(p.markup)+Number(b.dataset.step)))]:key==='gaps'?{decline:'covari',covari:'accept',accept:'decline'}[p.gaps]:key==='reserve'?(p.reserve+1)%3:!p.contracts;
  game.setPolicy(key,next);processEvents();updateUI(true);
}
let renderedManagerTickets='';
function updateManagerTickets(force){
  const signature=[...game.quotes.map(q=>`q${q.id}:${game.gapsFor(q.route).join()}`),...game.contracts.map(c=>`c${c.id}`),...game.orders.filter(o=>!o.contractId).map(o=>`${o.id}:${o.index}:${o.location}:${o.programmed}:${o.started}:${o.id===game.selectedId}:${game.gapsFor(o.route).join()}`)].join('|');
  const rail=$('orders');
  updateSalesStrip();
  if(force||signature!==renderedManagerTickets){
    const focused=document.activeElement?.dataset?.act?`[data-act="${document.activeElement.dataset.act}"][data-id="${document.activeElement.dataset.id}"]`:null,scroll={x:rail.scrollLeft,y:rail.scrollTop};
    renderedManagerTickets=signature;rail.replaceChildren(salesStrip);
    for(const q of game.quotes){const el=document.createElement('article');el.className='order-ticket quote-ticket'+(q.type==='contract'?' contract-quote':'')+(game.gapsFor(q.route).length?' impossible':'');el.id='quote-'+q.id;el.setAttribute('aria-label',`Quote ${q.id}, ${q.name}`);el.innerHTML=quoteHTML(q);rail.appendChild(el);}
    for(const c of game.contracts){const el=document.createElement('article');el.className='order-ticket contract-ticket'+(c.gaps.length&&game.gapsFor(c.route).length?' impossible':'');el.id='contract-'+c.id;el.setAttribute('aria-label',`Contract ${c.id}, ${c.units} ${c.name}`);el.innerHTML=contractHTML(c);rail.appendChild(el);}
    for(const o of game.orders.filter(o=>!o.contractId)){const el=document.createElement('article');const active=game.heldOrder?.id===o.id;el.className='order-ticket manager-ticket'+(o.outsourced?' covari-ticket':'')+(active?' carried-job':o.id===game.selectedId&&!game.hand?' passive-focus':'')+(game.gapsFor(o.route).length?' impossible':'');el.id='ticket-'+o.id;el.setAttribute('aria-label',`Order ${o.id}, ${o.name}`);el.innerHTML=orderHTML(o);rail.appendChild(el);}
    if(!game.quotes.length&&!game.orders.length){const empty=document.createElement('div');empty.className='orders-empty';empty.textContent=game.mode==='evening'?'Closed for the night.':'Quiet for now. Quotes will come in.';rail.appendChild(empty);}
    if(focused)rail.querySelector(focused)?.focus({preventScroll:true});rail.scrollLeft=scroll.x;rail.scrollTop=scroll.y;
  }
  const full=game.boardFull(),covariFull=game.covariOrders().length>=COVARI_SLOTS,seller=game.staff.find(m=>m.role==='sales');
  for(const q of game.quotes){const el=$('quote-'+q.id);if(!el)continue;
    el.querySelector('.due').textContent=seller?`${seller.name} ${Math.max(0,Math.ceil(SALES_DELAY-q.age))}s`:Math.ceil(q.quoteRemaining)+'s';el.classList.toggle('urgent',q.quoteRemaining<6);
    el.querySelector('.ticket-progress i').style.transform=`scaleX(${Math.max(0,seller?1-q.age/SALES_DELAY:q.quoteRemaining/QUOTE_WINDOW)})`;
    el.querySelector('.price').textContent=money(q.price);el.querySelector('.price').classList.toggle('marked-up',q.markup>0);el.querySelector('.price').classList.toggle('discount',q.markup<0);
    el.querySelector('.bid-value').textContent=pct(q.markup);
    el.querySelector('[data-act="bid-down"]').disabled=q.markup<=BIDS[0];el.querySelector('[data-act="bid-up"]').disabled=q.markup>=BIDS.at(-1);
    const accept=el.querySelector('[data-act="accept"]'),gap=game.gapsFor(q.route).length;
    accept.querySelector('.accept-label').textContent=gap?'Risk it':q.markup>0?'Bid':'Accept';
    accept.querySelector('.chance').textContent=q.chance<1?`${Math.round(q.chance*100)}%`:'';
    accept.disabled=full;accept.title=full?`The order board is full (${game.orderLimit})`:q.chance<1?`${Math.round(q.chance*100)}% chance the customer takes this bid`:'';
    const covari=el.querySelector('[data-act="covari"]');if(covari){covari.querySelector('.covari-keep').textContent=`+${money(q.price-q.covariCost)}`;covari.disabled=covariFull||game.cash<q.covariCost;covari.title=covariFull?`Covari is already placing ${COVARI_SLOTS} jobs`:game.cash<q.covariCost?`Covari needs ${money(q.covariCost)} up front`:`Pay ${money(q.covariCost)} now, collect ${money(q.price)} on shipping`;}}
  for(const c of game.contracts){const el=$('contract-'+c.id);if(!el)continue;const state=contractState(c);
    el.querySelector('.due').textContent=c.remaining>game.time?`${clock(c.remaining-game.time)} tomorrow`:clock(c.remaining);el.classList.toggle('urgent',c.remaining<25);
    el.querySelector('.ticket-status').textContent=state.text;el.querySelector('.ticket-progress i').style.transform=`scaleX(${Math.max(0,c.remaining/c.deadline)})`;
    el.querySelector('.contract-units').innerHTML=Array.from({length:c.units},(_,i)=>{const u=state.units[i-c.shipped-c.failed];return `<i class="${i<c.shipped?'done':i<c.shipped+c.failed?'failed':u?.started?'active':''}"></i>`;}).join('');}
  for(const o of game.orders){if(o.contractId)continue;const el=$('ticket-'+o.id);if(!el)continue;el.classList.toggle('urgent',o.remaining<20);el.querySelector('.due').textContent=Math.ceil(o.remaining)+'s';el.querySelector('.ticket-status').textContent=managerTicketState(o);el.querySelector('.ticket-progress i').style.transform=`scaleX(${Math.max(0,o.remaining/o.deadline)})`;}
}
function quoteAction(act,id){
  if(game.mode!=='playing')return;
  if(act==='bid-up'||act==='bid-down'){game.bidQuote(id,act==='bid-up'?1:-1);processEvents();updateUI();return;}
  const done=act==='accept'?game.acceptQuote(id):act==='covari'?game.outsourceQuote(id):game.declineQuote(id);
  processEvents();updateUI(true);if(done)$('scene').focus({preventScroll:true});
}
// The shop panel: staff, upgrades, the wing and ads. Machines are bought on the floor.
function storeRows(){
  const can=game.canManage(),evening=game.mode==='evening',rows=[];
  const row=(title,blurb,control,extra='')=>`<div class="store-row${extra}"><div><b>${title}</b><small>${blurb}</small></div>${control}</div>`;
  const buy=(attr,label,cost,disabled)=>`<button ${attr} ${disabled?'disabled':''}>${label}${cost!==undefined?` <span>${money(cost)}</span>`:''}</button>`;
  rows.push('<p class="store-hint">Buy machines by clicking an empty bay on the floor. After closing, click a machine to sell it.</p>');
  rows.push('<h4>Staff <small>wages are paid every evening</small></h4>');
  for(const [role,info] of Object.entries(STAFF)){
    const team=game.staff.filter(member=>member.role===role),max=game.staffMax(role),more=!game.expanded&&info.maxWing>info.max;
    rows.push(row(`${info.name} <span class="wage">${money(info.wage)}/day</span>`,info.blurb+(team.length?` On staff: ${team.map(member=>member.name).join(', ')}.`:'')+(team.length>=max&&more?' The east wing makes room for more.':''),
      team.length>=max?`<span class="owned-tag">${team.length}/${max}</span>`:buy(`data-hire="${role}"`,'Hire',undefined,!can),` role-${role}`));
    if(evening)for(const member of team)rows.push(`<div class="store-row staff-row role-${role}"><div><b>${member.name}</b><small>${info.name}</small></div><button data-fire="${member.id}" class="decline">Let go</button></div>`);
  }
  rows.push('<h4>Upgrades</h4>');
  for(const [key,item] of Object.entries(UPGRADES)){
    const owned=game.upgrades.has(key);rows.push(row(item.name,item.blurb,owned?'<span class="owned-tag">INSTALLED</span>':buy(`data-buy="${key}"`,'Buy',item.cost,!can||game.cash<item.cost),owned?' owned':''));
  }
  rows.push('<h4>Room to grow</h4>');
  rows.push(row(WING.name,WING.blurb,game.expanded?'<span class="owned-tag">OPEN</span>':game.wingPending?'<span class="owned-tag">TONIGHT</span>':buy('data-wing="1"','Build',WING.cost,!can||game.cash<WING.cost)));
  rows.push(row('Local ad campaign',`+${AD.reputation} reputation. More quotes, better prices. Once a day.`,game.adDay===game.day?'<span class="owned-tag">BOOKED TODAY</span>':buy('data-ad="1"','Book',AD.cost,!can||game.cash<AD.cost||game.reputation>=5)));
  return rows.join('');
}
let storeSignature='';
function renderStore(force=false){
  const holder=game.mode==='evening'?$('evening-store'):$('store-list');
  const signature=[holder.id,Math.round(game.cash/10),[...game.upgrades].join(),game.expanded,game.wingPending,game.staff.map(m=>m.id).join(),game.adDay,game.mode].join('|');
  $('store-status').textContent=game.mode==='evening'?'AFTER HOURS':`CASH ${money(game.cash)}`;
  if(!force&&signature===storeSignature)return;storeSignature=signature;
  holder.innerHTML=storeRows();
}
function openStore(){
  if(!game.manager||game.mode!=='playing')return;closePopover();
  $('store-panel').hidden=false;document.body.classList.add('store-open');layoutDirty=true;renderStore(true);$('store-close').focus({preventScroll:true});
}
function closeStore(){if($('store-panel').hidden)return;$('store-panel').hidden=true;document.body.classList.remove('store-open');layoutDirty=true;$('scene').focus({preventScroll:true});}
function toggleStore(){if($('store-panel').hidden)openStore();else closeStore();}
function storeAction(event){
  const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.buy)game.purchase(b.dataset.buy);else if(b.dataset.hire)game.hire(b.dataset.hire);else if(b.dataset.fire)game.fire(b.dataset.fire);else if(b.dataset.ad)game.advertise();else if(b.dataset.wing)game.buildWing();else return;
  processEvents();renderStore(true);updateUI(true);if(game.mode==='evening')renderLedger();
}
function renderLedger(){
  const day=game.history.at(-1),net=day.revenue+day.tips-day.materials-day.covari-day.penalties-day.purchases-day.wages-day.rent;
  const lines=[['Jobs shipped',day.revenue,`${day.shipped} shipped`],['Early-delivery tips',day.tips],['Stock',-day.materials],['Paid to Covari',-day.covari],['Missed and cancelled',-day.penalties,day.missed?`${day.missed} missed`:''],['Equipment and ads',-day.purchases],['Wages',-day.wages],['Rent',-day.rent]].filter(([,value],i)=>value||i===0||i>=6);
  const tomorrow=rentFor(game.day+1,game.expanded||game.wingPending)+game.wages();
  $('evening-ledger').innerHTML=`<dl>${lines.map(([label,value,note])=>`<div><dt>${label}${note?` <small>${note}</small>`:''}</dt><dd class="${value<0?'cost':value>0?'gain':''}">${value>0?'+':''}${money(value)}</dd></div>`).join('')}<div class="ledger-total"><dt>Today${day.breakdowns?` <small>${day.breakdowns} breakdown${day.breakdowns===1?'':'s'}</small>`:''}</dt><dd class="${net<0?'cost':'gain'}">${net>0?'+':''}${money(net)}</dd></div></dl><div class="ledger-summary"><span><small>CASH</small><b>${money(game.cash)}</b></span><span><small>NET WORTH</small><b>${money(game.netWorth())}</b></span><span><small>REPUTATION</small><b>★${game.reputation.toFixed(1)}</b></span></div>`;
  const warn=$('evening-warning');warn.hidden=game.cash>=tomorrow;warn.textContent=`Tomorrow's rent and wages come to ${money(tomorrow)}. Earn that during the day, or the bank takes the keys.`;
  $('evening-open').innerHTML=`OPEN DAY ${game.day+1} <span>↗</span>`;
  $('evening-retire').hidden=!!game.length;$('evening-retire').textContent=`Retire and bank ${money(game.netWorth())}`;
}
// The evening ledger docks beside the floor so bays stay clickable after hours.
function showEvening(){
  closeStore();closePopover();clearMovement();audio.update(false);hidePanels();$('overlay').hidden=false;$('overlay').classList.remove('centered');$('overlay').classList.add('evening');$('evening-panel').hidden=false;
  const day=game.history.at(-1),net=day.revenue+day.tips-day.materials-day.covari-day.penalties-day.purchases-day.wages-day.rent;
  $('evening-kicker').textContent=`DAY ${game.day}${game.length?' OF '+game.length:''} CLOSED · ${lengthName(game.length).toUpperCase()}`;
  $('evening-title').textContent=net>=800?'Lights off. Good day.':net>=0?'Doors locked. Bills paid.':'A costly day. Regroup.';
  renderLedger();renderStore(true);$('evening-panel').scrollTop=0;$('evening-open').focus({preventScroll:true});
}
function openNextDay(){if(!game.manager||!game.openDay())return;closePopover();hidePanels();$('overlay').hidden=true;$('overlay').classList.remove('centered','evening');processEvents();updateUI(true);$('scene').focus();}
function staffName(id){return game.staff?.find(member=>member.id===id)?.name??'Staff';}
const STAFF_COLORS={runner:[0x4f8fd6,0x183441],programmer:[0x9b7fd8,0x2a2346],clerk:[0x5fc48a,0x183441],technician:[0xe0b33c,0x183441],sales:[0xe6e1d0,0x2a4f5a]};
function ensureStaffViews(){
  const hired=new Set(game.staff.map(member=>member.id));
  for(const [id,view] of staffViews)if(!hired.has(id)){view.mesh.removeFromParent();view.tag.remove();staffViews.delete(id);}
  for(const member of game.staff){if(staffViews.has(member.id))continue;
    const mesh=createWorker(...STAFF_COLORS[member.role]);scene.add(mesh);
    const tag=document.createElement('span');tag.className=`staff-tag role-${member.role}`;tag.textContent=member.name;$('staff-tags').appendChild(tag);
    const start=stations[member.at]?.access||SPAWN;staffViews.set(member.id,{mesh,tag,anchor:mesh.userData.carryAnchor||mesh,x:start.x,z:start.z,angle:Math.PI,phase:Math.random()*6,seat:0});}
}
function routeBetween(a,b){
  const key=a+'>'+b;if(routeCache.has(key))return routeCache.get(key);
  const from=stations[a].access,to=stations[b].access,points=[{x:from.x,z:from.z},...findPath(to.x,to.z,from)];
  if(points.length===1)points.push({x:to.x,z:to.z});
  let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
  const route={points,length};routeCache.set(key,route);return route;
}
// Programmers sit at a CAD desk: the office chair, or the wing's nook.
function seatFor(member){
  if(member.seat===1&&annex)return {x:annex.userData.nookSeat.x,y:annex.userData.nookSeat.y,z:annex.userData.nookSeat.z,angle:annex.userData.nookYaw};
  const office=world.userData.office,seat=office.localToWorld(office.userData.seatPoint.clone());
  return {x:seat.x,y:seat.y,z:seat.z,angle:office.userData.seatYaw??Math.PI};
}
const SALES_SPOT={x:-4.72,z:-4.95,angle:Math.PI};
function staffTarget(member,index){
  if(member.role==='programmer')return {...seatFor(member),moving:false,seated:true};
  if(member.role==='sales')return {...SALES_SPOT,moving:false};
  if(member.state==='walk'&&member.from&&member.to){
    const route=routeBetween(member.from,member.to),t=Math.min(1,(member.walkTotal-member.walkRemaining)/Math.max(.01,member.walkTotal-.5));
    let left=t*route.length;
    for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],seg=Math.hypot(b.x-a.x,b.z-a.z);if(left<=seg||i===route.points.length-1){const f=seg?Math.min(1,left/seg):1;return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,angle:Math.atan2(b.x-a.x,b.z-a.z),moving:t<1};}left-=seg;}
  }
  const id=member.at||member.to||'receiving',a=stations[id]?.access||SPAWN,def=stations[id]?.def,side=index%2?.55:-.55;
  return {x:a.x+side,z:a.z+.2,angle:def?Math.atan2(def.x-a.x-side,def.z-a.z-.2):Math.PI,moving:false};
}
function animateStaff(dt){
  const show=!!game.manager&&!menuMode&&game.mode!=='results';
  for(const view of staffViews.values())view.mesh.visible=show;
  if(!show)return;
  ensureStaffViews();
  game.staff.forEach((member,index)=>{
    const view=staffViews.get(member.id),target=staffTarget(member,index),u=view.mesh.userData;
    const k=target.moving?1:Math.min(1,dt*8);view.x+=(target.x-view.x)*k;view.z+=(target.z-view.z)*k;
    const moving=target.moving&&game.mode==='playing';if(moving)view.phase+=dt*13;
    let da=target.angle-view.angle;da=Math.atan2(Math.sin(da),Math.cos(da));view.angle+=da*Math.min(1,dt*12);
    view.seat=THREE.MathUtils.damp(view.seat,target.seated?1:0,10,dt);
    const swing=moving?Math.sin(view.phase)*.6:0,typing=(member.role==='programmer'||member.role==='sales')&&member.state==='work',fixing=member.state==='service';
    for(const knee of [u.leftKnee,u.rightKnee])if(knee)knee.rotation.x=view.seat*Math.PI/2;
    if(u.groundShadow)u.groundShadow.visible=view.seat<.1;
    if(u.leftLeg)u.leftLeg.rotation.x=THREE.MathUtils.lerp(swing,-Math.PI/2,view.seat);if(u.rightLeg)u.rightLeg.rotation.x=THREE.MathUtils.lerp(-swing,-Math.PI/2,view.seat);
    const armBase=target.seated?-1.15:-.8,wrench=fixing?Math.sin(clockTime*10)*.35:0;
    if(u.leftArm)u.leftArm.rotation.x=typing?armBase+Math.sin(clockTime*16)*.08:fixing?-1.1+wrench:member.carry?-.8:-swing*.6;
    if(u.rightArm)u.rightArm.rotation.x=member.role==='sales'&&typing?-2.85:typing?armBase-Math.sin(clockTime*16)*.08:fixing?-1.1-wrench:member.carry?-.8:swing*.6;
    if(u.callPhone)u.callPhone.visible=member.role==='sales'&&typing;
    view.mesh.position.set(view.x,target.seated?THREE.MathUtils.lerp(0,target.y,view.seat):moving?Math.abs(Math.sin(view.phase))*.045:0,view.z);view.mesh.rotation.y=view.angle;
  });
}
function positionStaffTags(){
  const show=!!game.manager&&!menuMode&&game.mode!=='results';
  for(const [id,view] of staffViews){view.tag.hidden=!show;if(!show)continue;const member=game.staff.find(m=>m.id===id);const p=screenPoint(new THREE.Vector3(view.x,view.seat>.5?1.75:2.05,view.z));view.tag.style.left=p.x+'px';view.tag.style.top=p.y+'px';view.tag.classList.toggle('waiting',member?.state==='wait');view.tag.classList.toggle('fixing',member?.state==='service');}
}
function managerNextTarget(){
  if(game.hand){const o=game.heldOrder,next=o?.route[o.index];if(!next||next==='ship')return next;const keys=game.stationsFor(next);return keys.find(key=>game.usable(key)&&!game.stations[key].part)??keys[0];}
  const down=Object.keys(game.stations).find(key=>game.stations[key].down&&!game.stations[key].service);if(down)return down;
  const ready=Object.entries(game.stations).find(([,s])=>s.ready&&!s.down);if(ready)return ready[0];
  if(game.receiving)return 'receiving';
  if(game.nextCAD()&&!game.staff.some(m=>m.role==='programmer'))return 'office';
  const next=['round','plate','block'].map(type=>game.nextMaterial(type)).filter(Boolean).sort((a,b)=>a.remaining-b.remaining)[0];
  return next?`material-${stockType(next)}`:null;
}
function managerStationAction(id){
  const st=game.stations[id],o=game.heldOrder;
  if(stations[id].def.bay&&!st)return 'Empty bay · click it to add a machine';
  if(!st)return null;
  if(id in game.installing)return `Installing · ${Math.ceil(game.installing[id])}s`;
  if(st.service)return st.service.by==='owner'?`${st.service.kind==='repair'?'Repairing':'Servicing'} · stay here ${Math.ceil(st.service.remaining)}s`:`${staffName(st.service.by)} is working on it`;
  if(st.down)return `Repair ${machineLabel(id).toLowerCase()} · stay ${5}s`;
  if(st.part)return st.ready?(o?(o.route[o.index]===st.op?`Swap for #${st.part.orderId}`:'Held part needs another operation'):`Collect #${st.part.orderId}`):`Working · ${Math.ceil(st.remaining)}s`;
  if(o)return o.route[o.index]===st.op?`Start ${opInfo(st.op).name.toLowerCase()}`:`#${o.id} needs ${opInfo(o.route[o.index]).name} next`;
  return st.wear>=SERVICE_FROM?`Service · wear ${Math.round(st.wear)}%`:`${machineLabel(id)} · wear ${Math.round(st.wear)}%`;
}
function managerEvent(ev){
  switch(ev.type){
    case 'quote':audio.event('arrival');if(ev.contract)toast('A contract offer just came in.',2.4);return true;
    case 'accepted':audio.event('select');if(ev.gaps.length)toast(`#${ev.orderId} accepted, but this floor has no ${ev.gaps.map(key=>opInfo(key).name.toLowerCase()).join(' or ')}. It will expire unless you add one.`,4);else if(ev.bySales)floatText(`${ev.contract?'CONTRACT ':''}WON${ev.markup>0?' AT '+pct(ev.markup):''}`,'office',true);else if(ev.contract)toast('Contract signed: one CAD program covers every part.',2.6);return true;
    case 'bidLost':audio.event('expired');toast(`${ev.customer} went elsewhere${ev.markup>0?` at ${pct(ev.markup)}`:''}.`,2.4);return true;
    case 'declined':case 'quoteLapsed':case 'dayStart':case 'staffCad':case 'expired':case 'fired':case 'bid':case 'policy':case 'serviceStart':return true;
    case 'outsourced':audio.event('programmed');floatText(`−${money(ev.cost)} · COVARI`,'receiving',true);return true;
    case 'purchase':audio.event('ready');floatText(`−${money(ev.cost)} · ${(MACHINES[ev.key]?.name??UPGRADES[ev.key]?.name??'').toUpperCase()}`,ev.station??'office',true);syncBays();return true;
    case 'installed':{audio.event('ready');syncBays();floatText('INSTALLED ✓',ev.station,true);const s=stations[ev.station];spawnParticles(s.def.x,1.4,s.def.z,0x9effd4,16);return true;}
    case 'sold':audio.event('park');syncBays();floatText(`+${money(ev.refund)} · SOLD`,ev.station,true);return true;
    case 'wingOrdered':audio.event('ready');toast('Builders start on the east wing tonight. It opens tomorrow morning.',3.2);return true;
    case 'wingOpened':audio.event('finish');toast('The east wing is open: four large bays, two small bays and a second CAD desk.',3.6);return true;
    case 'advertised':audio.event('programmed');floatText('REPUTATION ↑','office',true);return true;
    case 'hired':audio.event('programmed');toast(`${staffName(ev.staffId)} joins the shop as your ${STAFF[ev.role].name.toLowerCase()}.`,2.6);return true;
    case 'shipped':audio.event('shipped');floatText(`+${money(ev.points)}${ev.tip?' · EARLY TIP':''}`,'ship',!!ev.staffId);spawnParticles(6,1.2,1.2,0xffd76c,ev.staffId?12:28);if(!ev.staffId)shake=.7;return true;
    case 'contractDone':audio.event('rushWon');floatText('CONTRACT COMPLETE ✓','ship');toast(`${ev.customer} is delighted: contract delivered in full.`,3);return true;
    case 'contractClosed':return true;
    case 'penalty':audio.event('expired');toast(ev.contractId?`Contract part #${ev.orderId} missed its deadline · −${money(ev.penalty)}`:ev.impossible?`#${ev.orderId} expired: you never had the process for it · −${money(ev.penalty)}`:`#${ev.orderId} expired · −${money(ev.penalty)}`,3.6);return true;
    case 'breakdown':{audio.event('expired');const s=stations[ev.station];spawnParticles(s.def.x,1.8,s.def.z,0x7d8a8f,18);if(!reduced)shake=.5;toast(`${machineLabel(ev.station)} broke down${ev.orderId?` with #${ev.orderId} inside`:''}. Repair it on the floor.`,3.4);return true;}
    case 'serviced':audio.event(ev.kind==='repair'?'ready':'programmed');floatText(ev.kind==='repair'?'REPAIRED ✓':'SERVICED ✓',ev.station,true);return true;
    case 'sourceDelivered':audio.event('ready');spawnParticles(stations.receiving.def.x,1.6,stations.receiving.def.z,0x72e8cf,8);return true;
    case 'quoteLost':toast('A customer gave up: your quote inbox was full.',2.4);return true;
    case 'dayEnd':audio.event('finish');showEvening();return true;
    case 'pickup':case 'load':case 'park':if(!ev.staffId)return false;if(ev.type==='load'){const s=stations[ev.station];spawnParticles(s.def.x,1.15,s.def.z,0x7ff0e0,3);}return true;
  }
  return false;
}
function showManagerResults(){
  resultShown=true;audio.update(false);clearMovement();closeStore();closePopover();$('overlay').classList.remove('evening');
  const length=game.length,reason=game.finishReason,stars=game.stars(),key=String(length),previous=managerRecord.bests[key]||0;
  managerRecord.bests[key]=Math.max(previous,game.score);if(!length)managerRecord.days=Math.max(managerRecord.days,game.daysCompleted);save();
  hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('results-panel').hidden=false;$('office-panel').hidden=true;$('touch-controls').hidden=true;$('pause-button').hidden=true;document.body.classList.remove('playing');
  $('results-panel').classList.toggle('owner-mastery',stars===3&&reason!=='bankrupt');
  $('result-kicker').textContent=`OPEN FOR BUSINESS · ${lengthName(length).toUpperCase()} · ${reason==='bankrupt'?'BANKRUPT':reason==='retired'?'RETIRED':'BOOKS CLOSED'}`;
  $('result-stars').innerHTML=[1,2,3].map(i=>`<span class="${i>stars?'empty':''}">★</span>`).join(' ');$('result-stars').setAttribute('aria-label',`${stars} out of 3 stars`);
  $('result-title').textContent=reason==='bankrupt'?'The bank took the keys.':reason==='retired'?'Sold up. Well run.':game.score>=START_CASH*4?'A proper business.':'Books closed. Doors open tomorrow.';
  const turned=game.declined+game.lapsed;
  $('result-message').textContent=`${game.daysCompleted} day${game.daysCompleted===1?'':'s'} survived. ${game.shipped} jobs shipped${game.sourced?` (${game.sourced} through Covari)`:''}, ${game.missed} expired, ${turned} turned away${game.bidsLost?`, ${game.bidsLost} bids lost`:''}.${game.contractsDone||game.contractsFailed?` Contracts: ${game.contractsDone} delivered, ${game.contractsFailed} broken.`:''}${game.breakdowns?` ${game.breakdowns} breakdown${game.breakdowns===1?'':'s'}.`:''}${game.cancelled?` ${game.cancelled} unfinished at closing were cancelled.`:''}${reason==='bankrupt'?' Cash went below zero after rent and wages.':''}`;
  $('result-progress').textContent=stars<3?`Survive ${game.config.stars[stars]} days for ${stars+1} star${stars?'s':''}.`:'Three stars: seven days or more in business.';
  $('result-score-label').textContent='NET WORTH';$('result-shipped-label').textContent='SHIPPED';$('result-missed-label').textContent='DAYS';
  $('result-score').textContent=money(game.score);$('result-shipped').textContent=game.shipped;$('result-missed').textContent=game.daysCompleted;
  const t=game.totals;
  $('result-breakdown').textContent=`Cash ${money(game.cash)} · Equipment ${money(game.assetValue())} at resale · Earned ${money(t.revenue+t.tips)} · Covari ${money(t.covari)} · Stock ${money(t.materials)} · Wages ${money(t.wages)} · Rent ${money(t.rent)}${t.penalties?` · Missed and cancelled ${money(t.penalties)}`:''}`;
  $('result-best').textContent=`${game.score>previous?'NEW PERSONAL BEST · ':''}BEST ${money(managerRecord.bests[key])} · ${lengthName(length).toUpperCase()}${length?'':` · LONGEST ${managerRecord.days} DAYS`}`;
  $('result-covari-message').textContent='Turning work away costs customers. Covari places the jobs your floor cannot make, so you keep them.';
  $('next-button').innerHTML='NEW RUN <span>↗</span>';$('results-panel').scrollTop=0;$('next-button').focus({preventScroll:true});
  social.finish({role:MANAGER_ROLE,board:boardId(length),stars,score:game.score,shipped:game.shipped,missed:game.missed,sourced:game.sourced,days:game.daysCompleted,elapsed:game.totalElapsed,finishReason:reason});
}
function bindControls(){
  addEventListener('pointerdown',unlockHomeMusic);
  addEventListener('keydown',unlockHomeMusic);
  addEventListener('resize',resize);$('scene').tabIndex=-1;
  $('source-accept').onclick=()=>{selectSourceJob();};$('source-decline').onclick=()=>{game.declineSource();updateUI(true);};
  $('source-collect').onclick=selectSourceCard;
  $('briefing-start').onclick=()=>briefingManager?startManager():startShift(selectedShift);$('mode-manager').onclick=showManagerBriefing;$('briefing-back').onclick=showMenu;
  $('office-go').onclick=()=>{if(game.call?.state==='ringing')goToStation('office');};
  for(const [id,accept] of [['call-accept',true],['call-decline',false]])$(id).onclick=()=>{game.setOfficePresence(atOffice());const rushId=game.call?.orderId;const replied=game.respondCall(accept);if(replied&&accept)game.select(rushId);processEvents();updateUI(true);$('scene').focus();};
  $('start-button').onclick=()=>showBriefing(selectedShift);$('resume-button').onclick=resume;$('restart-button').onclick=restartRun;$('menu-button').onclick=showMenu;$('results-menu').onclick=showMenu;$('next-button').onclick=()=>game.manager?showManagerBriefing():showBriefing(game.passed()&&!challengeRun?Math.min(SHIFTS.length-1,game.shiftIndex+1):game.shiftIndex);$('replay-button').onclick=restartRun;$('help-button').onclick=showHelp;$('help-close').onclick=closeHelp;$('pause-button').onclick=pause;
  $('result-covari-link').onclick=()=>social.track('covari_clicked');
  $('orders').addEventListener('click',e=>{if(!game.manager)return;const policy=e.target.closest('button[data-policy]');if(policy)return policyAction(policy);const b=e.target.closest('button[data-act]');if(b)quoteAction(b.dataset.act,Number(b.dataset.id));});
  $('floor-popover').addEventListener('click',popoverAction);$('wing-sign').onclick=()=>openPopover('wing');
  addEventListener('pointerdown',e=>{if(popover&&!e.target.closest('#floor-popover,.station-label,#wing-sign'))closePopover();});
  $('action-manage').onclick=toggleStore;$('touch-shop').onclick=toggleStore;$('store-close').onclick=closeStore;
  $('store-list').addEventListener('click',storeAction);$('evening-store').addEventListener('click',storeAction);
  $('evening-open').onclick=openNextDay;$('evening-retire').onclick=()=>{if(game.manager&&game.retire())processEvents();};$('evening-leave').onclick=showMenu;
  $('briefing-lengths').addEventListener('click',e=>{const b=e.target.closest('[data-length]');if(!b)return;managerRecord.length=Number(b.dataset.length);save();renderRunLengths();$('briefing-lengths').querySelector(`[data-length="${b.dataset.length}"]`)?.focus();});
  addEventListener('keydown',e=>{
    if($('leaderboard-dialog').open||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(['Space','Enter'].includes(e.code)&&e.target.closest?.('button'))return;
    const controls=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','ShiftLeft','ShiftRight'];
    if(game.mode==='playing'&&!onPhone()&&controls.includes(e.code))e.preventDefault();if(e.repeat)return;
    if(e.code==='Escape'&&popover){e.preventDefault();closePopover();return;}
    if(e.code==='Escape'&&!$('store-panel').hidden){e.preventDefault();closeStore();return;}
    if(e.code==='KeyM'&&game.manager&&game.mode==='playing'){e.preventDefault();toggleStore();return;}
    if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!$('help-panel').hidden)closeHelp();else if(game.mode==='playing')pause();else if(game.mode==='paused')resume();return;}
    if(game.mode!=='playing'||onPhone())return;keys.add(e.code);
    if(e.code==='KeyE'||e.code==='Space')interact();
    if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash();
  });
  addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();touchVector={x:0,y:0};if(game.mode==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='playing')pause();updateMusic();});
  const raycaster=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  renderer.domElement.addEventListener('pointerdown',e=>{if(game.mode!=='playing'||e.button>0)return;const mouse=new THREE.Vector2(e.clientX/viewport.w*2-1,-e.clientY/viewport.h*2+1);raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(Object.values(stations).filter(s=>s.model.visible).map(s=>s.model),true);if(hits.length){let obj=hits[0].object;let chosen;while(obj){chosen=Object.values(stations).find(s=>s.model===obj);if(chosen)break;obj=obj.parent;}if(chosen){goToStation(chosen.def.id);return;}}const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(ground,p)&&p.x>bounds.minX&&p.x<bounds.maxX&&p.z>bounds.minZ&&p.z<bounds.maxZ){path=findPath(p.x,p.z);pathStation=null;targetRing.position.set(p.x,.08,p.z);targetRing.visible=true;}});
  const joystick=$('joystick');let joystickPointer=null;
  const joyMove=e=>{if(e.pointerId!==joystickPointer)return;const rect=joystick.getBoundingClientRect(),dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2;const len=Math.hypot(dx,dy),f=len>30?30/len:1;touchVector={x:dx*f/30,y:dy*f/30};$('joystick-knob').style.transform=`translate(${dx*f}px,${dy*f}px)`;};
  joystick.onpointerdown=e=>{e.preventDefault();joystickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);joyMove(e);};joystick.onpointermove=joyMove;joystick.onpointerup=joystick.onpointercancel=()=>{joystickPointer=null;touchVector={x:0,y:0};$('joystick-knob').style.transform='';};for(const [id,action] of [['touch-interact',interact],['touch-dash',dash],['action-interact',interact],['action-dash',dash]]){
    const button=$(id);
    button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();action();};
    // Pointer actions fire immediately; keyboard/assistive activation uses click.
    button.onclick=e=>{if(e.detail===0)action();};
  }
}
function registerTools(){
  // Progressive enhancement. The playable game never depends on this API.
  const mc=document.modelContext;if(!mc?.registerTool)return;
  const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const register=tool=>{try{Promise.resolve(mc.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'get_shop_state',title:'Read shop state',description:'Read the current Chip Rush shift, tickets, carried part, machines and player position.',annotations:{readOnlyHint:true,untrustedContentHint:false},inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async()=>window.__chipRush.snapshot()});
  register({name:'start_walk_to_station',title:'Walk to a station',description:'Start walking the machinist to a station. Automatically interacts on arrival using normal movement and collision rules. Read shop state to check arrival.',annotations:{readOnlyHint:false,untrustedContentHint:false},inputSchema:{type:'object',properties:{station:{type:'string',enum:STATION_LAYOUT.map(s=>s.id)}},required:['station'],additionalProperties:false},execute:async(input)=>{if(!input||typeof input.station!=='string'||!stations[input.station])throw new Error('Choose a valid workshop station.');if(game.mode!=='playing')throw new Error('Clock in or resume the shift first.');goToStation(input.station);return {walkingTo:input.station};}});
}
try{boot();}catch(error){console.error(error);$('loading').hidden=true;$('fatal').hidden=false;$('fatal-message').textContent='This game needs WebGL 2 in a current browser. Enable hardware acceleration, then reload. '+(error?.message||'');}
