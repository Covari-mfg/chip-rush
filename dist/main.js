import * as THREE from './vendor/three.module.js';
import { createWorkshop, createMachine, createCharacter, createPart } from './assets/models.js';
import { ShopGame, SHIFTS, OPS, PROGRAM_DURATION } from './core.js';
import { ShopAudio } from './audio.js';
import { createSocial } from './social.js';
import { technologyBadges, technologyIcon } from './technology.js';
import { orderWorkflow } from './workflow.js';

const $=id=>document.getElementById(id);
const game=new ShopGame(),audio=new ShopAudio();
let challengeRun=false;
const sourceCard=$('source-card');
const social=createSocial({onChallenge:role=>{challengeRun=role>unlocked;showBriefing(role);}});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys=new Set();let touchVector={x:0,y:0},selectedShift=0,unlocked=0,bests=[0,0,0],grades=[0,0,0];
const SAVE_KEY='chip-rush-roles-v6';
let migrationNotice=false;
function readRoleSave(key){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}}
function readUnlocked(value){return Math.max(0,Math.min(2,Math.trunc(Number(value))||0));}
const roleSave=readRoleSave(SAVE_KEY);
if(roleSave){
  unlocked=readUnlocked(roleSave.unlocked);
  bests=bests.map((_,i)=>Math.max(0,Number(roleSave.bests?.[i])||0));
  grades=grades.map((_,i)=>Math.max(0,Math.min(3,Math.trunc(Number(roleSave.grades?.[i]))||0)));
}else{
  const oldScores=readRoleSave('chip-rush-roles-v5');
  const previousRoles=oldScores||readRoleSave('chip-rush-roles-v4')||readRoleSave('chip-rush-roles-v3')||readRoleSave('chip-rush-roles-v2');
  if(previousRoles){
    unlocked=readUnlocked(previousRoles.unlocked);migrationNotice=true;
    // Operator is unchanged. Keep its records and all unlocked roles. Old
    // advanced-role results remain in the previous save under their own rules.
    if(oldScores){bests[0]=Math.max(0,Number(oldScores.bests?.[0])||0);grades[0]=Math.max(0,Math.min(3,Math.trunc(Number(oldScores.grades?.[0]))||0));}
    save();
  }
}
const STATION_LAYOUT=[
  {id:'office',name:'OFFICE',x:-7.1,z:-4.65,height:2.2,w:2.6,d:1.3,access:{x:-7.8,z:-3.18},collidable:false},
  {id:'material',name:'MATERIAL',x:-6.6,z:-.6,height:2.25,w:1.65,d:2.65,rotationY:Math.PI/2,access:{x:-5.145,z:-.6}},
  {id:'lathe',name:'LATHE',x:-2.55,z:-3.4,height:3.306,w:3.078,d:2.052,scale:1.14},
  {id:'mill',name:'MILL',x:1.3,z:-3.4,height:3.534,w:3.648,d:2.109,scale:1.14},
  {id:'inspect',name:'INSPECT',x:5.8,z:-2.25,height:2.05,w:1.6,d:2.4,rotationY:-Math.PI/2,access:{x:4.32,z:-2.25}},
  {id:'ship',name:'SHIPPING',x:5.8,z:1,height:1.85,w:1.8,d:2.7,rotationY:-Math.PI/2,access:{x:4.27,z:1}},
  {id:'receiving',name:'RECEIVING',x:-2.3,z:1.8,height:1.35,w:1.5,d:1.0,access:{x:-2.3,z:3.0},collidable:false},
  {id:'buffer',name:'HOLD BENCH',x:-6.4,z:1.7,height:1.4,w:2.35,d:1.45},
];
const SPAWN={x:0,z:2.6};
let renderer,scene,camera,character,carryAnchor,playerRing,targetRing,world,deliveryVan;
let path=[],pathStation=null,nearby=null,walkPhase=0,dashTime=0,dashCooldown=0,dashDirection=new THREE.Vector3(),clockTime=0,uiElapsed=0,last=performance.now(),toastUntil=0,shake=0;
let cameraBlend=0,menuMode=true,helpReturn=null,renderedTickets='',resultShown=false,stationPartSignature={};
let renderedSelection=null, nextPhoneRing=0;
const stations={},parts=new Map(),particles=[];const player={...SPAWN,angle:Math.PI};
let viewport={w:innerWidth,h:innerHeight};
// Align the floor with the screen and look down into the working aisles.
const cameraOffset=new THREE.Vector3(0,23,17);
const right=new THREE.Vector3(cameraOffset.z,0,-cameraOffset.x).normalize();
const down=new THREE.Vector3(cameraOffset.x,0,cameraOffset.z).normalize();
const cameraUp=new THREE.Vector3().crossVectors(cameraOffset.clone().normalize(),right).normalize();
let layoutDirty=true,shopFrame=null,playFrame=null;
const bounds={minX:-8.55,maxX:7.65,minZ:-5.45,maxZ:3.35};
const obstacles=STATION_LAYOUT.filter(s=>s.collidable!==false).map(s=>({minX:s.x-s.w/2-.25,maxX:s.x+s.w/2+.25,minZ:s.z-s.d/2-.25,maxZ:s.z+s.d/2+.25}));
obstacles.push({minX:-8.55,maxX:-5.77,minZ:-5.5,maxZ:-4.02},{minX:-5.83,maxX:-5.12,minZ:-5.5,maxZ:-3.08},{minX:-7.62,maxX:-6.64,minZ:-4.12,maxZ:-3.26});
// Perimeter packing and plants are physical props, outside the working aisle.
obstacles.push({minX:6.05,maxX:7.85,minZ:-5.58,maxZ:-4.30},{minX:6.98,maxX:7.98,minZ:-4.46,maxZ:-3.46},{minX:-8.82,maxX:-7.80,minZ:2.37,maxZ:3.39});

function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({unlocked,bests,grades}));}catch{}}
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
function findPath(tx,tz){
  const cell=.32,ox=-8.5,oz=-5.4,nx=54,nz=35;
  const point=(ix,iz)=>({x:ox+ix*cell,z:oz+iz*cell});
  const nearest=(x,z)=>{let best=null,dist=Infinity;for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const p=point(ix,iz);if(!safeSpot(p.x,p.z))continue;const d=(p.x-x)**2+(p.z-z)**2;if(d<dist){dist=d;best={ix,iz};}}return best;};
  const start=nearest(player.x,player.z),end=nearest(tx,tz);if(!start||!end)return [];
  const id=(x,z)=>z*nx+x,si=id(start.ix,start.iz),ei=id(end.ix,end.iz),open=[si],came=new Map(),cost=new Map([[si,0]]),closed=new Set();
  const h=i=>Math.hypot(i%nx-end.ix,Math.floor(i/nx)-end.iz);
  for(let runs=0;open.length&&runs<2200;runs++){
    let bi=0;for(let i=1;i<open.length;i++)if(cost.get(open[i])+h(open[i])<cost.get(open[bi])+h(open[bi]))bi=i;
    const cur=open.splice(bi,1)[0];if(cur===ei){const route=[];let c=ei;while(c!==si){route.push(point(c%nx,Math.floor(c/nx)));c=came.get(c);if(c===undefined)break;}route.reverse();if(safeSpot(tx,tz))route.push({x:tx,z:tz});return smoothRoute(player,route);}
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
function goToStation(id){if(game.mode!=='playing')return;if(onPhone())return toast('Finish the customer call first.');const s=stations[id];if(!s||!s.model.visible)return;path=findPath(s.access.x,s.access.z);pathStation=id;targetRing.position.set(s.access.x,.08,s.access.z);targetRing.visible=true;if(!path.length&&Math.hypot(player.x-s.access.x,player.z-s.access.z)<1.3){useStation(id);pathStation=null;processEvents();}}
function nearestStation(){let chosen=null,dist=1.32;for(const s of Object.values(stations)){if(!s.model.visible)continue;const d=Math.hypot(player.x-s.access.x,player.z-s.access.z);if(d<dist&&d<(s.def.id==='office'?.78:1.32)){chosen=s;dist=d;}}return chosen;}
function interact(){if(game.mode!=='playing')return;if(onPhone())return toast('Finish the customer call first.');const s=nearestStation();if(s){path=[];pathStation=null;targetRing.visible=false;player.angle=Math.atan2(s.def.x-player.x,s.def.z-player.z);useStation(s.def.id);processEvents();syncParts();updateUI(true);}else toast('Move closer to a station, or click its label.');}
function dash(){if(game.mode!=='playing'||onPhone()||dashCooldown>0)return;dashCooldown=1.3;dashTime=.2;dashDirection.set(Math.sin(player.angle),0,Math.cos(player.angle));audio.event('dash');}
function screenPoint(v){const p=v.clone().project(camera);return {x:(p.x*.5+.5)*viewport.w,y:(-p.y*.5+.5)*viewport.h};}
function floatText(text,station,small=false){const d=stations[station]?.def;if(!d)return;const p=screenPoint(new THREE.Vector3(d.x,d.height+.3,d.z));const el=document.createElement('div');el.className=`float-text${small?' small':''}`;el.textContent=text;el.style.left=p.x+'px';el.style.top=p.y+'px';$('floating-text').appendChild(el);el.addEventListener('animationend',()=>el.remove(),{once:true});setTimeout(()=>el.remove(),1800);}
function createReceivingDock(){
  const g=new THREE.Group();g.name='receiving-dock';
  const floor=new THREE.Mesh(new THREE.BoxGeometry(1.5,.06,1),new THREE.MeshStandardMaterial({color:0x214a4b,roughness:.85}));floor.position.y=.03;g.add(floor);
  const crate=new THREE.Mesh(new THREE.BoxGeometry(.58,.48,.52),new THREE.MeshStandardMaterial({color:0xb77845,roughness:.82}));crate.position.set(0,.3,0);crate.castShadow=true;const crateGroup=new THREE.Group();g.add(crateGroup);crateGroup.add(crate);
  for(const x of [-.19,.19]){const band=new THREE.Mesh(new THREE.BoxGeometry(.035,.5,.54),new THREE.MeshStandardMaterial({color:0xefd078,roughness:.6}));band.position.set(x,.31,0);crateGroup.add(band);}
  const mark=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.012),new THREE.MeshStandardMaterial({color:0x17333b,roughness:.7}));mark.position.set(0,.43,.267);crateGroup.add(mark);g.userData.brandMark=mark;
  g.userData.workPoint=new THREE.Vector3(0,.62,0);g.userData.crate=crateGroup;return g;
}
function createDeliveryVan(){
  const g=new THREE.Group();g.name='covari-delivery-van';
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.25,.48,.62),new THREE.MeshStandardMaterial({color:0xe7f0e4,roughness:.72}));body.position.y=.38;body.castShadow=true;g.add(body);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(.42,.36,.58),new THREE.MeshStandardMaterial({color:0x1dbcae,roughness:.65}));cab.position.set(.42,.76,0);cab.castShadow=true;g.add(cab);
  const mark=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,.012),new THREE.MeshStandardMaterial({color:0x102a32,roughness:.6}));mark.position.set(-.18,.5,.316);g.add(mark);g.userData.brandMark=mark;
  for(const x of [-.4,.42]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.07,16),new THREE.MeshStandardMaterial({color:0x15333b,roughness:1}));wheel.rotation.x=Math.PI/2;wheel.position.set(x,.14,.32);g.add(wheel);const other=wheel.clone();other.position.z=-.32;g.add(other);}
  g.visible=false;g.userData.arrival=0;return g;
}

function boot(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x102c38);scene.fog=new THREE.Fog(0x102c38,35,70);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(viewport.w,viewport.h);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;$('scene').appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(game.mode==='playing')pause();$('fatal-message').textContent='Your browser paused the 3D graphics. Reload the game to reopen the shop.';$('fatal').hidden=false;});
  camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,100);
  scene.add(new THREE.HemisphereLight(0xdafff3,0x466374,2.25));
  const sun=new THREE.DirectionalLight(0xffe6b5,3.8);sun.position.set(-7,15,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=14;sun.shadow.camera.bottom=-13;sun.shadow.camera.near=.5;sun.shadow.camera.far=45;sun.shadow.bias=-.00045;sun.shadow.normalBias=.03;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight(0x86d8ee,2);fill.position.set(9,7,-6);scene.add(fill);
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x163845,roughness:1}));backdrop.rotation.x=-Math.PI/2;backdrop.position.y=-.53;backdrop.receiveShadow=true;scene.add(backdrop);
  world=createWorkshop();scene.add(world);
  deliveryVan=createDeliveryVan();deliveryVan.position.set(-4.2,.0,1.8);scene.add(deliveryVan);
  const officeArt=world.userData.office.userData;officeArt.normalScreenMaterial=officeArt.monitorScreen.material;
  // Brand the supplier's vehicle and crate, not the incoming customer order.
  new THREE.TextureLoader().load($('covari-logo').src,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.repeat.set(.52,.52);texture.offset.set(.24,.24);const material=new THREE.MeshStandardMaterial({map:texture,color:0xffffff});deliveryVan.userData.brandMark.material=material;stations.receiving.model.userData.brandMark.material=material;});
  for(const def of STATION_LAYOUT){
    const model=def.id==='office'?world.userData.office:def.id==='receiving'?createReceivingDock():createMachine(def.id);if(def.id!=='office'){model.position.set(def.x,0,def.z);model.rotation.y=def.rotationY??0;model.scale.setScalar(def.scale??1);scene.add(model);}
    const label=document.createElement('button');label.className='station-label';label.id='station-'+def.id;label.setAttribute('aria-label','Walk to '+def.name);label.innerHTML=`<span class="station-dot"></span>${['lathe','mill'].includes(def.id)?technologyIcon(def.id):''}<span>${def.name}</span><span class="station-time"></span><i class="station-progress"></i>`;label.onclick=()=>{goToStation(def.id);};$('station-labels').appendChild(label);
    const access=def.access||{x:def.x,z:def.z+def.d/2+.63};stations[def.id]={def,model,label,access};
    if(model.userData.spindle)model.userData.spindle.userData.baseY=model.userData.spindle.position.y;
  }
  character=createCharacter();scene.add(character);carryAnchor=character.userData.carryAnchor||character;
  const ringGeo=new THREE.RingGeometry(.36,.43,40);const ringMat=new THREE.MeshBasicMaterial({color:0xffda7b,side:THREE.DoubleSide,transparent:true,opacity:.8});playerRing=new THREE.Mesh(ringGeo,ringMat);playerRing.rotation.x=-Math.PI/2;playerRing.position.y=.075;scene.add(playerRing);
  targetRing=new THREE.Mesh(new THREE.RingGeometry(.25,.31,32),new THREE.MeshBasicMaterial({color:0x92f4db,side:THREE.DoubleSide,transparent:true,opacity:.7}));targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;scene.add(targetRing);
  shopFrame=measureShopFrame();
  const layoutObserver=new ResizeObserver(()=>{layoutDirty=true;});
  for(const id of ['live-hud','orders','game-footer','shop-sidebar'])layoutObserver.observe($(id));
  resize();buildShiftPicker();bindControls();updateCamera(0,true);renderer.render(scene,camera);$('loading').hidden=true;
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
    const box=new THREE.Box3().setFromObject(s.model);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])include(new THREE.Vector3(x,y,z));
    include(new THREE.Vector3(s.def.x,s.def.height+.1,s.def.z));
  }
  const shell=new THREE.Box3().setFromObject(world);
  for(const x of [shell.min.x,shell.max.x])for(const y of [shell.min.y,shell.max.y])for(const z of [shell.min.z,shell.max.z])include(new THREE.Vector3(x,y,z));
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
function spawnParticles(x,y,z,color=0xffd57b,count=12){for(let i=0;i<count;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.08),new THREE.MeshBasicMaterial({color}));m.position.set(x,y,z);m.rotation.set(Math.random()*6,Math.random()*6,0);scene.add(m);particles.push({mesh:m,vx:(Math.random()-.5)*2.3,vy:1+Math.random()*1.7,vz:(Math.random()-.5)*2.3,life:.65+Math.random()*.6});}}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);continue;}p.vy-=4*dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.mesh.rotation.x+=dt*4;p.mesh.scale.setScalar(Math.min(1,p.life*3));}}
function processEvents(){for(const ev of game.drain()){
  audio.event(ev.type);
  if(ev.type==='hint')toast(ev.message);
  if(ev.type==='sourceDelivered'){audio.event('ready');spawnParticles(-2.3,1.05,1.8,0x72e8cf,12);if(deliveryVan){deliveryVan.visible=true;deliveryVan.userData.arrival=3;deliveryVan.position.x=reduced?-3.15:-5;}}
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
  const living=new Set(active.filter(o=>o.started).map(o=>o.id));
  for(const [id,entry] of parts){if(!living.has(id)){entry.mesh.removeFromParent();parts.delete(id);}}
  for(const o of active){if(!o.started)continue;let entry=parts.get(o.id);const sig=partSignature(o);if(entry?.sig===sig)continue;
    if(entry)entry.mesh.removeFromParent();const stage=o.id===201?Math.min(3,o.index+1):o.index===0?0:o.route.slice(0,o.index).includes('anodize')?4:Math.min(3,o.index);const mesh=createPart(stage,o.color,o.kind);entry={mesh,sig,order:o.id};parts.set(o.id,entry);
    if(o.location==='hands'){carryAnchor.add(mesh);mesh.position.set(0,0,0);mesh.scale.setScalar(1.15);}
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
  if(deliveryVan?.userData.arrival>0){
    deliveryVan.userData.arrival=Math.max(0,deliveryVan.userData.arrival-dt);
    const t=3-deliveryVan.userData.arrival;
    deliveryVan.position.x=reduced?-3.15:t<1?THREE.MathUtils.lerp(-5,-3.15,t):t<2?-3.15:THREE.MathUtils.lerp(-3.15,-5,t-2);
    deliveryVan.visible=deliveryVan.userData.arrival>0&&!menuMode;
  }
  if(stations.receiving){stations.receiving.model.visible=!menuMode&&game.shiftIndex>0&&['sourcing','delivered'].includes(game.sourcing?.state);stations.receiving.model.userData.crate.visible=!!game.receiving;}
  for(const [id,s] of Object.entries(stations)){
    const state=game.stations[id],busy=!!state?.part&&!state.ready,ready=!!state?.ready;
    if(s.model.userData.statusLight){const m=s.model.userData.statusLight.material;m.color.set(ready?0x8bffbb:busy?0xffc458:0x55ddd2);m.emissive.copy(m.color);m.emissiveIntensity=busy?.55+Math.sin(clockTime*7)*.35:ready?1:.35;}
    const spindle=s.model.userData.spindle;
    if(spindle&&busy&&active){if(id==='lathe'||id==='deburr')spindle.rotation.x+=dt*15;else if(id==='mill'){spindle.rotation.y+=dt*11;spindle.position.y=spindle.userData.baseY+Math.sin(clockTime*4)*.09;}else if(id==='anodize')spindle.position.y=spindle.userData.baseY+Math.sin(clockTime*2)*.12;else if(id==='inspect')spindle.rotation.y=Math.sin(clockTime*3)*.15;
      if((id==='lathe'||id==='mill'||id==='deburr')&&Math.random()<dt*7&&!reduced){const p=s.model.localToWorld(s.model.userData.workPoint.clone());spawnParticles(p.x,p.y+.1,p.z,0xffd67b,1);}
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
  animateOfficeSeat(dt);
  if(active&&game.call?.state==='ringing'&&clockTime>=nextPhoneRing){audio.event('call');nextPhoneRing=clockTime+2.2;}
  if(menuMode){character.position.set(.1,Math.sin(clockTime*2)*.018,2.5);character.rotation.y=-.4;playerRing.position.set(.1,.07,2.5);const u=character.userData;if(u.head)u.head.rotation.y=Math.sin(clockTime*.5)*.12;}
  targetRing.scale.setScalar(1+Math.sin(clockTime*6)*.09);updateParticles(dt);shake=Math.max(0,shake-dt*2);
}
function ticketState(o){if(!o.programmed)return game.office.orderId===o.id?`CAD ${game.office.present&&!['ringing','answering','offer'].includes(game.call?.state)?'':'paused · '}${Math.ceil(o.programRemaining)}s`:'Complete CAD at the office, then collect material';if(o.location==='material')return 'Pick up material';if(o.location==='hands')return `In your hands · ${OPS[o.route[o.index]].name} next`;if(o.location==='buffer')return 'Parked on Hold bench';const s=game.stations[o.location];return s?.ready?`${OPS[o.location].name} ready · collect part`:`${OPS[o.location]?.name||'Machine'} working…`;}
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
    for(const o of game.orders){const el=document.createElement('button');el.className='order-ticket'+(o.route.length+1+(game.config.programming?1:0)>4?' long-route':'')+(o.id===game.selectedId?' selected':'');el.id='ticket-'+o.id;el.setAttribute('aria-label',`Select Order ${o.id}, ${o.name}`);el.setAttribute('aria-pressed',o.id===game.selectedId?'true':'false');const route=orderWorkflow(o,game.config.programming).map(step=>`<span class="route-step${step.done?' done':step.active?' active':''}" title="${step.title}">${step.done?'✓ ':''}${step.label}</span>`).join('<span class="route-arrow">›</span>');el.innerHTML=`<div class="ticket-top"><span>Order #${o.id}</span><span class="due"></span></div><div class="ticket-heading"><h3>${o.name}</h3><span class="technology-badges">${technologyBadges([...new Set(o.route.filter(key=>key==='lathe'||key==='mill'))])}</span></div><div class="route">${route}</div><div class="ticket-status sr-only">${ticketState(o)}</div><div class="rush-status" hidden></div><div class="ticket-progress"><i></i></div>`;el.onclick=()=>{game.select(o.id);processEvents();updateUI(true);};$('orders').appendChild(el);}
    $('orders').appendChild(sourceCard);if(focused)$(focused)?.focus({preventScroll:true});
    $('orders').scrollLeft=scroll.x;$('orders').scrollTop=scroll.y;
    if(renderedSelection!==game.selectedId){renderedSelection=game.selectedId;revealSelectedTicket();}
  }
  for(const o of game.orders){const el=$('ticket-'+o.id);if(!el)continue;el.classList.toggle('urgent',o.remaining<20);el.querySelector('.due').textContent=Math.ceil(o.remaining)+'s';el.querySelector('.due').classList.toggle('urgent',o.remaining<20);const rush=game.call?.orderId===o.id?game.call:null;const badge=el.querySelector('.rush-status');badge.hidden=!rush;badge.textContent=rush?(rush.state==='active'?`RUSH +${rush.bonus} · ${Math.ceil(rush.remaining)}s`:`CALL · +${rush.bonus} offer`):'';el.classList.toggle('rush-ticket',!!rush);el.querySelector('.ticket-status').textContent=ticketState(o);el.querySelector('.ticket-progress i').style.transform=`scaleX(${Math.max(0,o.remaining/o.deadline)})`;}
}
function nextTarget(){if(['ringing','answering','offer'].includes(game.call?.state))return 'office';if(game.heldOrder&&!game.heldOrder.programmed)return 'office';if(!game.hand&&game.selected&&!game.selected.programmed)return 'office';if(game.hand)return game.heldOrder?.route[game.heldOrder.index];const o=game.selected;if(!o)return null;return o.location==='hands'?o.route[o.index]:o.location;}
function stationAction(id){if(onPhone())return game.call.state==='answering'?`On the phone · ${Math.ceil(game.call.answerRemaining)}s`:'Choose your reply to the customer';if(game.call?.state==='ringing'&&id!=='office')return 'Customer waiting. Answer at the office.';const o=game.heldOrder,s=game.stations[id];if(id==='office')return !game.config.programming?'CAD prepared for this shift':game.call?.state==='ringing'?'Answer customer call':game.selected?.programmed?'Select a job that needs CAD':`CAD #${game.selectedId} · stay at the desk`;if(id==='receiving')return game.receiving?(game.hand?'Free your hands to receive #201':'Collect Order #201'):'Delivery on the way';if(id==='material'&&o?.id===201)return 'Inspect and ship this customer part';if(id==='material')return game.hand?`Recycle #${game.hand.orderId} · restart route`:game.selected?.started?'Select an unstarted Order':game.selected&&!game.selected.programmed?'Complete CAD at the office first':`Collect billet #${game.selectedId||'—'}`;if(id==='buffer')return game.hand&&game.buffer?'Swap carried and parked parts':game.hand?'Park carried part':game.buffer?'Collect parked part':'Hold a part here';if(id==='ship')return o?.route[o.index]==='ship'?`Ship #${o.id}`:'Bring an inspected part';if(s?.part)return s.ready?(game.hand?(o?.route[o.index]===id?`Swap for #${s.part.orderId}`:'Held part needs another operation'):`Collect #${s.part.orderId}`):`Working · ${Math.ceil(s.remaining)}s`;return o?.route[o.index]===id?`Start ${OPS[id].name.toLowerCase()}`:`${OPS[id]?.name||id} station`;}
function updateUI(force=false){
  $('score').textContent=game.score.toLocaleString();
  const nextStar=game.config.stars.findIndex(target=>game.shipped<target);
  $('shipped-label').textContent=nextStar<0?'★★★ SHIPPED':`TO ${'★'.repeat(nextStar+1)}`;
  $('shipped').textContent=nextStar<0?String(game.shipped):`${game.shipped}/${game.config.stars[nextStar]}`;
  const shipmentGoal=`${game.shipped} orders shipped. Clear at ${game.config.passTarget}. ${nextStar<0?'All three stars earned.':`${nextStar+1} star${nextStar?'s':''} at ${game.config.stars[nextStar]} shipped.`}`;
  $('shipment-progress').title=shipmentGoal;$('shipment-progress').setAttribute('aria-label',shipmentGoal);
  $('order-count').textContent=`${game.orders.length} / 4`;
  const t=Math.ceil(game.time);$('timer').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;$('timer').parentElement.classList.toggle('urgent',t<=30);updateTickets(force);
  updateOfficeUI();updateSourceUI();
  const action=nearby?stationAction(nearby.def.id):'Move closer to a station';
  for(const id of ['action-interact','touch-interact']){$(id).title=action;$(id).setAttribute('aria-label',`Interact: ${action}`);}

}
function updateSourceUI(){
  const job=game.sourcing,visible=!!job&&!['declined','fulfilled'].includes(job.state);sourceCard.hidden=!visible;if(!visible)return;
  const offered=job.state==='offer',delivered=job.state==='delivered',qc=game.stations.inspect;
  $('source-title').textContent=job.name;
  $('source-capability').hidden=!offered;$('source-capability').textContent='Outside shop capability';
  const technology=$('source-technology');
  if(technology.dataset.technology!==job.technology){technology.innerHTML=technologyBadges([job.technology]);technology.dataset.technology=job.technology;}
  $('source-due').textContent=offered?`${Math.ceil(job.offerRemaining)}s`:'+300';
  $('source-partner').hidden=offered;
  $('source-detail').textContent=job.state==='sourcing'?`· Delivery ${Math.ceil(job.remaining)}s`:job.location==='receiving'?'· Delivered':job.location==='inspect'?(qc.ready?'· QC approved':`· QC ${Math.ceil(qc.remaining)}s`):job.location==='buffer'?'· On bench':job.index>0?'· Ready to ship':'· Ready for QC';
  const route=$('source-route');route.hidden=!delivered;
  if(delivered){const stage=job.location==='receiving'?0:job.index===0?1:2;const signature=String(stage);if(route.dataset.stage!==signature){route.dataset.stage=signature;route.innerHTML=['RECEIVE','QC','SHIP'].map((label,i)=>`<span class="route-step${i<stage?' done':i===stage?' active':''}">${i<stage?'✓ ':''}${label}</span>`).join('<span class="route-arrow">›</span>');}}
  $('source-accept').hidden=!offered;$('source-decline').hidden=!offered;
  $('source-accept').disabled=['ringing','answering','offer'].includes(game.call?.state);
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
  else {title.textContent=`CUSTOMER CALL ${game.callsReceived}/3 · #${call.orderId}`;detail.textContent=`Handoffs paused · ${Math.ceil(call.ringRemaining)}s`;$('office-go').textContent='Answer at office ↗';}
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
  const target=nextTarget();for(const [id,s] of Object.entries(stations)){
  const p=screenPoint(new THREE.Vector3(s.def.x,s.def.height+.1,s.def.z));s.label.style.left=p.x+'px';s.label.style.top=p.y+'px';
  const st=game.stations[id],program=id==='office'?game.order(game.office.orderId):null,ready=id==='receiving'?!!game.receiving:!!st?.ready,busy=!!st?.part&&!ready||!!program&&game.office.present&&!['ringing','answering','offer'].includes(game.call?.state);
  const locked=id==='receiving'?!s.model.visible:id==='office'?!game.config.programming:!!OPS[id]&&id!=='ship'&&!game.config.unlocks.includes(id);
  s.label.hidden=id==='receiving'?locked:!menuMode&&locked;s.label.classList.toggle('ready',ready);s.label.classList.toggle('busy',busy);s.label.classList.toggle('target',!menuMode&&(target===id||nearby?.def.id===id));s.label.classList.toggle('locked',!menuMode&&locked);
  s.label.querySelector('.station-time').textContent=menuMode?'':id==='office'&&game.call?.state==='ringing'?'☎ CALL':id==='office'&&onPhone()?'☎ ON CALL':id==='receiving'?'':program?`${Math.ceil(program.programRemaining)}s`:ready?'✓ READY':busy?Math.ceil(st.remaining)+'s':locked?'OFF':'';
  s.label.querySelector('.station-progress').style.width=program?`${100*(1-program.programRemaining/PROGRAM_DURATION)}%`:busy?`${100*(1-st.remaining/OPS[id].duration)}%`:'0';s.label.style.opacity=menuMode?'.72':'';
}}
function updateMusic(){audio.update(!document.hidden&&(game.mode==='menu'||game.mode==='playing'),['ringing','answering','offer'].includes(game.call?.state));}
function unlockHomeMusic(){if(game.mode!=='menu'||document.hidden)return;audio.init();updateMusic();}
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;clockTime+=dt;
  updateMovement(dt);if(game.mode==='playing'){game.setOfficePresence(atOffice());game.tick(dt);processEvents();syncParts();}
  animateShop(game.mode==='paused'||game.mode==='help'?0:dt);updateCamera(dt);positionLabels();updateMusic();
  uiElapsed+=dt;if(uiElapsed>.09){uiElapsed=0;if(!menuMode)updateUI();}
  if(toastUntil&&now>toastUntil){$('toast').classList.remove('visible');toastUntil=0;}
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
function buildShiftPicker(){const holder=$('shift-picker');holder.replaceChildren();SHIFTS.forEach((s,i)=>{const b=document.createElement('button');b.className='shift-choice'+(selectedShift===i?' selected':'');b.disabled=i>unlocked;b.setAttribute('aria-label',`${i+1}. ${s.name}${i>unlocked?', clear the previous role to unlock':''}`);b.innerHTML=`<span class="num">0${i+1}</span><span><b>${s.name}</b><small>${i>unlocked?'Clear the previous role to unlock':s.subtitle}</small></span><span class="pick-mark">${i>unlocked?'⌑':grades[i]?'★'.repeat(grades[i]):i===selectedShift?'↗':'·'}</span>`;b.onclick=()=>{selectedShift=i;buildShiftPicker();};holder.appendChild(b);});$('migration-note').hidden=!migrationNotice;}
function hidePanels(){for(const id of ['welcome','pause-panel','help-panel','results-panel','briefing-panel'])$(id).hidden=true;}
function clearMovement(){keys.clear();touchVector={x:0,y:0};path=[];pathStation=null;dashTime=0;dashCooldown=0;if(targetRing)targetRing.visible=false;$('joystick-knob').style.transform='';}
function startShift(index){if(deliveryVan){deliveryVan.visible=false;deliveryVan.userData.arrival=0;}audio.init();game.reset(index);social.start(index);selectedShift=index;resultShown=false;menuMode=false;layoutDirty=true;clearMovement();player.x=SPAWN.x;player.z=SPAWN.z;player.angle=Math.PI;character.rotation.y=Math.PI;character.scale.setScalar(1);character.userData.officeSeated=false;character.userData.seatBlend=0;for(const p of parts.values())p.mesh.removeFromParent();parts.clear();$('floating-text').replaceChildren();$('toast').classList.remove('visible');toastUntil=0;hidePanels();$('overlay').hidden=true;$('overlay').classList.remove('centered');$('live-hud').hidden=false;$('shop-sidebar').hidden=false;$('game-footer').hidden=false;$('touch-controls').hidden=false;$('pause-button').hidden=false;document.querySelector('.shift-heading').hidden=false;document.body.classList.add('playing');document.body.classList.toggle('has-office',game.config.programming);document.body.classList.remove('paused');$('shift-number').textContent=`ROLE 0${index+1} / SHIP ${SHIFTS[index].passTarget} TO CLEAR`;$('shift-name').textContent=SHIFTS[index].name;nearby=null;renderedTickets='';processEvents();updateUI(true);$('scene').focus();}
function pause(){if(game.mode!=='playing')return;game.mode='paused';audio.update(false);clearMovement();hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('pause-panel').hidden=false;document.body.classList.add('paused');$('resume-button').focus();}
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
function showMenu(){challengeRun=false;selectedShift=Math.min(selectedShift,unlocked);game.mode='menu';updateMusic();menuMode=true;clearMovement();hidePanels();$('welcome').hidden=false;$('overlay').hidden=false;$('overlay').classList.remove('centered');$('live-hud').hidden=true;$('shop-sidebar').hidden=true;$('game-footer').hidden=true;$('touch-controls').hidden=true;$('pause-button').hidden=true;document.querySelector('.shift-heading').hidden=true;document.body.classList.remove('playing','paused','has-office');buildShiftPicker();social.refreshBoard();}
function showBriefing(index){
  selectedShift=index;migrationNotice=false;const cfg=SHIFTS[index];hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('briefing-panel').hidden=false;
  $('briefing-role').textContent=cfg.name;$('briefing-goal').textContent=`Ship ${cfg.passTarget} orders in ${cfg.duration/60} minutes.`;
  $('briefing-targets').innerHTML=cfg.stars.map((target,i)=>`<div><span aria-label="${i+1} star${i?'s':''}">${'★'.repeat(i+1)}</span><strong>${target} <small>shipped</small></strong></div>`).join('');
  const lessons=[
    ['Select an order, then follow Material → Turn or Mill → QC → Ship.','Click a station to move and interact. Machines run while you work elsewhere.'],
    ['Complete CAD at the office before collecting material. Follow each order’s route.','Stay for CAD; leaving pauses it. Machines keep running.'],
    ['Complete CAD, then follow each order’s route. Some parts need both machines.','Answer 3 customer calls at the office (3 seconds each). Calls interrupt handoffs; machines keep running. Rushes are optional: +100 on time, −25 if missed.']
  ][index];
  $('briefing-text').textContent=lessons[0];$('briefing-tip').textContent=lessons[1];$('briefing-panel').scrollTop=0;$('briefing-start').focus({preventScroll:true});
}
function showResults(){
  if(resultShown)return;resultShown=true;audio.update(false);clearMovement();const passed=game.passed();if(passed&&!challengeRun)unlocked=Math.max(unlocked,Math.min(2,game.shiftIndex+1));
  const previous=bests[game.shiftIndex]||0;bests[game.shiftIndex]=Math.max(previous,game.score);grades[game.shiftIndex]=Math.max(grades[game.shiftIndex]||0,game.stars());save();hidePanels();$('overlay').hidden=false;$('overlay').classList.add('centered');$('results-panel').hidden=false;$('office-panel').hidden=true;$('touch-controls').hidden=true;$('pause-button').hidden=true;document.body.classList.remove('playing');
  const stars=game.stars(),ownerMastery=game.shiftIndex===2&&stars===3;
  $('results-panel').classList.toggle('owner-mastery',ownerMastery);
  $('result-kicker').textContent=`${game.config.name.toUpperCase()} · ${ownerMastery?'THREE-STAR SHIFT':passed?'CLEARED':'SHIFT OVER'}`;$('result-stars').innerHTML=[1,2,3].map(i=>`<span class="${i>stars?'empty':''}">★</span>`).join(' ');$('result-stars').setAttribute('aria-label',`${stars} out of 3 stars`);
  $('result-title').textContent=ownerMastery?'You run this shop.':passed?(game.shiftIndex===2?'You kept the doors open.':stars===3?'Absolute machine.':'That’s a good shift.'):'One more shift?';
  $('result-message').textContent=`${game.shipped} orders shipped. Clear target: ${game.config.passTarget}. ${game.unfinished} unfinished at closing. `+(passed?(game.shiftIndex===2?`Owner cleared. ${game.callsAnswered} calls answered. ${game.rushesWon} rush bonus${game.rushesWon===1?'':'es'} delivered.`:challengeRun?'Challenge shift complete.':'Next role unlocked.'):(game.shiftIndex===0?'Load both machines before waiting for either.':game.shiftIndex===1?'Complete the next CAD job while a machine is cutting.':'Keep both machines cutting. Clear inspection before collecting another part.'));
  const nextStar=game.config.stars.findIndex(target=>game.shipped<target);
  $('result-progress').textContent=nextStar<0?(ownerMastery?'Three stars. Exceptional precision under pressure.':'All three stars earned.'):`${game.config.stars[nextStar]-game.shipped} more shipped order${game.config.stars[nextStar]-game.shipped===1?'':'s'} for ${nextStar+1} star${nextStar?'s':''} (${game.config.stars[nextStar]} total).`;
  $('result-score').textContent=game.score.toLocaleString();$('result-shipped').textContent=game.shipped;$('result-missed').textContent=game.missed;
  const labels={base:'Parts',program:'CAD',speed:'Early shipping',streak:'Streak',rush:'Rush',rushPenalty:'Missed rushes',calls:'Calls',sourcing:'Covari'};
  $('result-breakdown').textContent=Object.entries(game.scoreDetails).filter(([,v])=>v!==0).map(([k,v])=>`${labels[k]} ${v.toLocaleString()}`).join(' · ')||'Ship a part to start earning points.';
  $('result-best').textContent=`${game.score>previous?'NEW PERSONAL BEST · ':''}BEST ${bests[game.shiftIndex].toLocaleString()} · STARS AT ${game.config.stars.join(' / ')} SHIPPED`;
  $('next-button').innerHTML=passed&&!challengeRun&&game.shiftIndex<2?'NEXT ROLE <span>↗</span>':'TRY AGAIN <span>↗</span>';$('results-panel').scrollTop=0;$('next-button').focus({preventScroll:true});
  social.finish({role:game.shiftIndex,score:game.score,shipped:game.shipped,missed:game.missed,sourced:game.sourced,calls:game.callsAnswered});
}
function selectSourceJob(){
  if(game.mode!=='playing'||game.sourcing?.state!=='offer'||['ringing','answering','offer'].includes(game.call?.state))return false;
  const accepted=game.requestSource();processEvents();updateUI(true);return accepted;
}
function selectSourceCard(){
  const job=game.sourcing;if(game.mode!=='playing'||job?.state!=='delivered')return;
  goToStation(job.location==='hands'?job.route[job.index]:job.location);
}
function bindControls(){
  addEventListener('pointerdown',unlockHomeMusic);
  addEventListener('keydown',unlockHomeMusic);
  addEventListener('resize',resize);$('scene').tabIndex=-1;
  $('source-accept').onclick=()=>{selectSourceJob();};$('source-decline').onclick=()=>{game.declineSource();updateUI(true);};
  $('source-collect').onclick=selectSourceCard;
  $('briefing-start').onclick=()=>startShift(selectedShift);$('briefing-back').onclick=showMenu;
  $('office-go').onclick=()=>{if(game.office.orderId&&game.call?.state!=='ringing')game.select(game.office.orderId);goToStation('office');};
  for(const [id,accept] of [['call-accept',true],['call-decline',false]])$(id).onclick=()=>{game.setOfficePresence(atOffice());const rushId=game.call?.orderId;const replied=game.respondCall(accept);if(replied&&accept)game.select(rushId);processEvents();updateUI(true);$('scene').focus();};
  $('start-button').onclick=()=>showBriefing(selectedShift);$('resume-button').onclick=resume;$('restart-button').onclick=()=>startShift(game.shiftIndex);$('menu-button').onclick=showMenu;$('results-menu').onclick=showMenu;$('next-button').onclick=()=>showBriefing(game.passed()&&!challengeRun?Math.min(2,game.shiftIndex+1):game.shiftIndex);$('replay-button').onclick=()=>startShift(game.shiftIndex);$('help-button').onclick=showHelp;$('help-close').onclick=closeHelp;$('pause-button').onclick=pause;
  addEventListener('keydown',e=>{
    if($('leaderboard-dialog').open||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(['Space','Enter'].includes(e.code)&&e.target.closest?.('button'))return;
    const controls=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab','KeyE','ShiftLeft','ShiftRight'];
    if(game.mode==='playing'&&!onPhone()&&controls.includes(e.code))e.preventDefault();if(e.repeat)return;
    if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!$('help-panel').hidden)closeHelp();else if(game.mode==='playing')pause();else if(game.mode==='paused')resume();return;}
    if(game.mode!=='playing'||onPhone())return;keys.add(e.code);
    if(e.code==='KeyE'||e.code==='Space')interact();if(e.code==='Tab'){game.cycle();processEvents();updateUI(true);}
    if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash();if(/^Digit[1-4]$/.test(e.code)){const o=game.orders[Number(e.code.slice(-1))-1];if(o){game.select(o.id);processEvents();updateUI(true);}}
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
