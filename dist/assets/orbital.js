import * as THREE from '../vendor/three.module.js';

// First Light: an original procedural orbital dock. The planet, the sky and
// every light are presentation; the mirror, the catch rings, the sunshield and
// the cargo capsule all follow FirstLightGame's state, never the other way.
const C={cream:0xe5e2cd,creamLight:0xf6f0db,plate:0xbcc6c1,teal:0x17787e,tealDark:0x154c56,cyan:0x69eee6,navy:0x183441,dark:0x0f222c,steel:0x8daab2,shiny:0xc8dedb,gold:0xeac16b,foil:0xd9a441,orange:0xec8150,panel:0x1c3272,white:0xf3f4ee};
// The walkway is a ring around the mirror well. main.js repeats these numbers
// in its map table (qa/first-light.test.mjs keeps the two in step).
// Inside the well there is no deck: the machinist floats across it, around the mirror.
export const DOCK={outer:{minX:-7.4,maxX:7.4,minZ:-3.15,maxZ:3.15},well:{minX:-6,maxX:6,minZ:-1.75,maxZ:1.75},mirror:{minX:-2.25,maxX:2.25,minZ:-1.75,maxZ:1.75}};
export const MIRROR={x:0,y:-.34,z:0,tilt:.31,radius:.425};
const SQ3=Math.sqrt(3);
// Pointy hexes in axial coordinates. The inner six flew on the rocket; the
// outer twelve are made here and fill clockwise from the top.
const INNER=[[0,-1],[1,-1],[1,0],[0,1],[-1,1],[-1,0]];
const OUTER=[[0,-2],[1,-2],[2,-2],[2,-1],[2,0],[1,1],[0,2],[-1,2],[-2,2],[-2,1],[-2,0],[-1,-1]];
const hexPoint=([q,r])=>new THREE.Vector3(SQ3*MIRROR.radius*(q+r/2),0,1.5*MIRROR.radius*r);
export const MIRROR_LAYOUT={inner:INNER.map(hexPoint),outer:OUTER.map(hexPoint)};

const materials=new Map();
function mat(color,roughness=.6,metalness=0){const key=`${color}/${roughness}/${metalness}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key);}
function glow(color,intensity=.8){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.35});}
const geometries=new Map();
function boxGeo(w,h,d){const key=`b/${w}/${h}/${d}`;if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));return geometries.get(key);}
function cylGeo(a,b,h,n=16){const key=`c/${a}/${b}/${h}/${n}`;if(!geometries.has(key))geometries.set(key,new THREE.CylinderGeometry(a,b,h,n));return geometries.get(key);}
function add(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const box=(parent,w,h,d,x,y,z,color,material)=>add(parent,boxGeo(w,h,d),material||mat(color),x,y,z);
const cyl=(parent,a,b,h,x,y,z,color,n=16,material)=>add(parent,cylGeo(a,b,h,n),material||mat(color,.4,.35),x,y,z);

// Static detail merges into one mesh per material; anything named in
// userData (or below it) keeps its own node so it can still move.
function batch(root){
  const keep=new Set();
  for(const value of Object.values(root.userData))for(const item of [].concat(value))if(item?.isObject3D)keep.add(item);
  const kept=node=>{for(let p=node;p&&p!==root;p=p.parent)if(keep.has(p))return true;return false;};
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),buckets=new Map();
  root.traverse(node=>{if(!node.isMesh||node.userData.loose||Array.isArray(node.material)||kept(node))return;const key=`${node.material.uuid}/${node.castShadow}/${node.receiveShadow}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(node);});
  for(const meshes of buckets.values()){
    if(meshes.length<2)continue;
    const parts=meshes.map(mesh=>{const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));return g;});
    const count=parts.reduce((n,g)=>n+g.attributes.position.count,0),merged=new THREE.BufferGeometry();
    for(const [name,size] of [['position',3],['normal',3]]){const data=new Float32Array(count*size);let offset=0;for(const g of parts){data.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}merged.setAttribute(name,new THREE.BufferAttribute(data,size));}
    merged.computeBoundingSphere();
    const mesh=new THREE.Mesh(merged,meshes[0].material);mesh.name='batched-dock-detail';mesh.castShadow=meshes[0].castShadow;mesh.receiveShadow=meshes[0].receiveShadow;
    for(const original of meshes)original.removeFromParent();for(const g of parts)g.dispose();root.add(mesh);
  }
  return root;
}

// A small sky for the gold to reflect: black above, a warm band at the
// horizon, the planet's blue below. Built from numbers, so it needs no DOM.
let reflection=null;
function skyReflection(){
  if(reflection)return reflection;
  const w=64,h=32,data=new Uint8Array(w*h*4);let seed=20261110;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const v=y/(h-1),u=x/w,i=(y*w+x)*4;let r,g,b;
    if(v>.56){const k=(v-.56)/.44;r=30+70*k;g=95+105*k;b=170+70*k;}
    else if(v>.46){const k=1-Math.abs(v-.51)/.05,sun=Math.max(0,1-Math.abs(u-.3)*5);r=70+185*k*(.5+.5*sun);g=90+130*k*(.4+.6*sun);b=150+60*k;}
    else{const k=v/.46,glint=random()>.9?40:0;r=150+90*k+glint*.3;g=130+78*k+glint*.3;b=112+50*k+glint;}
    data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;
  }
  reflection=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);reflection.mapping=THREE.EquirectangularReflectionMapping;reflection.colorSpace=THREE.SRGBColorSpace;reflection.needsUpdate=true;
  return reflection;
}
function mirrorGold(){return new THREE.MeshStandardMaterial({color:0xea9a2c,metalness:1,roughness:.24,envMap:skyReflection(),envMapIntensity:.95,emissive:0x8a4300,emissiveIntensity:.3});}
const silver=()=>new THREE.MeshStandardMaterial({color:0xdfe9ee,metalness:1,roughness:.12,envMap:skyReflection(),envMapIntensity:1.3});
let sharedGold=null,sharedSilver=null;
const hexGeo=(radius,height)=>{const key=`h/${radius}/${height}`;if(!geometries.has(key))geometries.set(key,new THREE.CylinderGeometry(radius,radius,height,6));return geometries.get(key);};

// The carried part: a hexagonal blank that turns from grey stock into a
// polished, then gold-coated, then tested mirror segment along its route.
export function createSegment(order){
  const g=new THREE.Group();g.name='mirror-segment-part';
  sharedGold??=mirrorGold();sharedSilver??=silver();
  if(order.id===201){
    // Covari's sunshield arrives folded: a banded roll of silver film.
    const roll=cyl(g,.11,.11,.44,0,.14,0,0xd9cbe6,14,new THREE.MeshStandardMaterial({color:0xd9cbe6,metalness:.85,roughness:.28,envMap:skyReflection()}));roll.rotation.z=Math.PI/2;
    for(const x of [-.15,0,.15]){const band=cyl(g,.116,.116,.03,x,.14,0,C.teal,14,mat(C.teal));band.rotation.z=Math.PI/2;}
    if(order.index>0)box(g,.06,.01,.06,0,.262,0,C.gold);
    return g;
  }
  const route=order.route,at=order.index,done=key=>route.indexOf(key)>=0&&at>route.indexOf(key);
  const cut=at>0,polished=done('polish'),gilded=done('gild'),tested=done('inspect');
  const r=.2,body=cut?.07:.11;
  add(g,hexGeo(r,body),cut?mat(0x9fb0b6,.45,.55):mat(order.kind==='block'?0x7d8a8f:order.kind==='plate'?0x8d9aa0:0x99a5a8,.7,.3),0,body/2+.02,0);
  if(order.kind==='block'&&!cut)for(const a of [0,2,4]){const rib=box(g,.03,.05,.3,0,.15,0,0x6c787d);rib.rotation.y=a*Math.PI/3;}
  if(cut&&!polished)add(g,hexGeo(r*.72,.012),mat(0xc5d2d6,.35,.6),0,body+.026,0);
  if(polished)add(g,hexGeo(r*.93,.014),gilded?sharedGold:sharedSilver,0,body+.027,0);
  if(tested)box(g,.05,.012,.05,0,body+.042,0,C.teal,mat(C.cyan,.4));
  return g;
}

// A bubble helmet and a small pack for the machinist. The overalls stay.
export function createSuit(){
  const g=new THREE.Group();g.name='orbital-suit';
  const bubble=new THREE.Mesh(new THREE.SphereGeometry(.335,20,14),new THREE.MeshStandardMaterial({color:0xbfe9f2,transparent:true,opacity:.2,roughness:.08,metalness:.2,depthWrite:false,envMap:skyReflection(),envMapIntensity:1.2}));
  bubble.position.set(0,1.235,.01);bubble.renderOrder=2;g.add(bubble);
  const collar=add(g,new THREE.TorusGeometry(.2,.045,8,20),mat(C.white,.5),0,1.0,0);collar.rotation.x=Math.PI/2;
  // The pack stands clear of the back and its trim stands proud of the pack:
  // faces that nearly touch shimmer as the machinist walks.
  box(g,.34,.4,.15,0,.8,-.27,C.white);box(g,.38,.08,.19,0,.9,-.27,C.foil,mat(C.foil,.35,.7));
  box(g,.2,.05,.06,0,.99,-.2,C.navy);
  for(const x of [-.1,.1])cyl(g,.035,.05,.07,x,.565,-.27,C.steel,10);
  cyl(g,.008,.008,.34,.13,1.17,-.3,C.steel,6);add(g,new THREE.SphereGeometry(.025,8,6),glow(0xff5a4a,1.2),.13,1.35,-.3);
  g.traverse(node=>{if(node.isMesh){node.receiveShadow=false;node.castShadow=false;}});
  return g;
}

function statusLight(g,x,y,z){
  cyl(g,.05,.06,.1,x,y,z,C.navy,10);
  const light=add(g,new THREE.SphereGeometry(.062,10,8),new THREE.MeshStandardMaterial({color:0x55ddd2,emissive:0x55ddd2,emissiveIntensity:.35,roughness:.3}),x,y+.09,z);
  light.castShadow=false;g.userData.statusLight=light;
}
function namePlate(g,text,w,h,x,y,z){
  if(typeof document==='undefined')return box(g,w,h,.018,x,y,z,C.tealDark);
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#164552';ctx.fillRect(0,0,512,128);ctx.fillStyle='#dcfff4';ctx.font='700 46px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,68,490);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  return add(g,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}),x,y,z);
}

// Polisher: a low lapping table. The platter turns and the arm strokes.
function makePolish(g){
  box(g,2.3,.72,1.3,0,.5,0,C.teal);box(g,2.34,.1,1.34,0,.91,0,C.cream);box(g,2.2,.14,1.2,0,.08,0,C.navy);
  box(g,1.02,.05,1.02,-.42,.985,0,C.dark);
  const platter=new THREE.Group();platter.position.set(-.42,1.03,0);g.add(platter);
  cyl(platter,.44,.44,.06,0,0,0,0x7f9299,28,mat(0x7f9299,.3,.7));
  for(let i=0;i<3;i++){const groove=box(platter,.8,.008,.03,0,.034,0,0x51646c);groove.rotation.y=i*Math.PI/3;}
  cyl(g,.07,.09,.5,.52,1.2,-.36,C.steel,12);
  const arm=new THREE.Group();arm.position.set(.52,1.43,-.36);g.add(arm);
  box(arm,1.02,.07,.11,-.47,0,0,C.creamLight);cyl(arm,.1,.1,.12,0,0,0,C.navy,12);
  cyl(arm,.035,.035,.24,-.9,-.14,0,C.steel,8);cyl(arm,.15,.15,.07,-.9,-.28,0,C.gold,18,mat(C.gold,.45,.2));
  box(g,.46,.34,.4,.72,1.13,.22,C.navy);box(g,.32,.2,.02,.72,1.16,.43,C.cyan,glow(0x4fd8d0,.5));
  cyl(g,.12,.12,.3,.98,1.11,-.3,0xb9d7e2,12,mat(0xb9d7e2,.3,.1));
  namePlate(g,'POLISH',.8,.13,-.1,.56,.656);
  statusLight(g,1.02,1.32,.38);
  g.userData.platter=platter;g.userData.arm=arm;g.userData.workPoint=new THREE.Vector3(-.42,1.07,0);
}
// Gold chamber: a bell jar lowers over the part and glows while it coats.
function makeGild(g){
  box(g,2.2,.86,1.5,0,.57,0,C.cream);box(g,2.24,.14,1.54,0,.08,0,C.navy);box(g,2.24,.08,1.54,0,1.04,0,C.tealDark);
  cyl(g,.5,.5,.05,-.3,1.105,.08,C.dark,28);cyl(g,.4,.4,.03,-.3,1.14,.08,0x8fa3aa,28,mat(0x8fa3aa,.25,.8));
  for(const x of [-.95,.35])box(g,.09,1.56,.09,x,1.86,-.52,C.steel);
  box(g,1.5,.1,.14,-.3,2.62,-.52,C.navy);box(g,.12,.1,.6,-.3,2.62,-.22,C.navy);
  const jar=new THREE.Group();jar.position.set(-.3,2.0,.08);g.add(jar);
  const glass=new THREE.MeshStandardMaterial({color:0xcfeaf0,transparent:true,opacity:.26,roughness:.08,metalness:.1,emissive:0xf2b53a,emissiveIntensity:0,depthWrite:false,side:THREE.DoubleSide});
  const dome=add(jar,new THREE.CylinderGeometry(.46,.46,.5,24,1,true),glass,0,.02,0);dome.castShadow=false;dome.renderOrder=2;
  const cap=add(jar,new THREE.SphereGeometry(.46,24,10,0,Math.PI*2,0,Math.PI/2),glass,0,.27,0);cap.castShadow=false;cap.renderOrder=2;
  add(jar,new THREE.TorusGeometry(.47,.035,8,28),mat(C.gold,.4,.5),0,-.23,0).rotation.x=Math.PI/2;
  cyl(jar,.04,.04,.5,0,.95,0,C.steel,8);
  const ember=add(jar,new THREE.SphereGeometry(.07,10,8),glow(0xffd36b,0),0,.3,0);ember.castShadow=false;
  for(const [x,color] of [[.7,C.gold],[.95,C.white]]){cyl(g,.11,.11,.72,x,1.44,-.4,color,14,mat(color,.4,.3));cyl(g,.05,.05,.1,x,1.85,-.4,C.steel,8);}
  box(g,.5,.5,.06,.82,1.42,.44,C.navy);box(g,.36,.22,.02,.82,1.5,.48,C.gold,glow(0xf2c14e,.45));
  for(let i=0;i<3;i++)box(g,.08,.05,.03,.7+i*.12,1.28,.48,[C.cyan,C.gold,C.orange][i]);
  namePlate(g,'GOLD COAT',1.0,.14,-.3,.62,.756);
  statusLight(g,.98,1.72,.3);
  g.userData.jar=jar;g.userData.jarGlass=glass;g.userData.ember=ember;g.userData.workPoint=new THREE.Vector3(-.3,1.17,.08);
}
export function createOrbitStation(type){
  const g=new THREE.Group();g.name=`station-${type}`;g.userData.type=type;
  (type==='gild'?makeGild:makePolish)(g);
  return batch(g);
}

// The telescope's primary mirror, tilted toward the camera in the well.
function createMirror(){
  const g=new THREE.Group();g.name='telescope-mirror';g.position.set(MIRROR.x,MIRROR.y,MIRROR.z);g.rotation.x=MIRROR.tilt;
  const r=MIRROR.radius,frame=mat(0x16202a,.55,.4),strut=mat(0x1d2b36,.5,.5);
  const structure=new THREE.Group();g.add(structure);
  for(const p of [...MIRROR_LAYOUT.inner,...MIRROR_LAYOUT.outer])add(structure,hexGeo(r*.99,.1),frame,p.x,-.09,p.z).castShadow=false;
  add(structure,hexGeo(r*.9,.16),frame,0,-.1,0);
  box(structure,12.2,.12,.16,0,-.22,0,0,strut);box(structure,.16,.12,3.5,0,-.22,0,0,strut);
  for(const side of [-1,1])for(const z of [-1,1]){const boom=box(structure,3.6,.1,.1,side*3.5,-.24,z*.8,0,strut);boom.rotation.y=side*z*.42;}
  // Secondary mirror on its tripod.
  const apex=new THREE.Vector3(0,1.55,0);
  for(const a of [Math.PI/2,Math.PI*7/6,Math.PI*11/6]){
    const foot=new THREE.Vector3(Math.cos(a)*1.72,-.02,Math.sin(a)*1.5),mid=foot.clone().lerp(apex,.5),length=foot.distanceTo(apex);
    const leg=add(structure,cylGeo(.028,.028,length,6),strut,mid.x,mid.y,mid.z);leg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),apex.clone().sub(foot).normalize());
  }
  cyl(structure,.16,.12,.1,0,1.55,0,0x16202a,18,frame);
  const gold=mirrorGold();
  add(structure,cylGeo(.13,.13,.02,18),gold,0,1.49,0);
  batch(structure);
  const jitter=i=>{const s=Math.sin(i*12.9898+4.1)*43758.5453;return (s-Math.floor(s)-.5)*2;};
  const segment=(p,i)=>{
    const pivot=new THREE.Group();pivot.position.copy(p);pivot.userData.tilt={x:jitter(i)*.05,z:jitter(i+31)*.05};
    const face=add(pivot,hexGeo(r*.955,.05),gold,0,0,0);face.castShadow=false;
    g.add(pivot);return pivot;
  };
  const flown=MIRROR_LAYOUT.inner.map(segment),made=MIRROR_LAYOUT.outer.map((p,i)=>segment(p,i+6));
  // Empty slots show as thin outlines until a segment lands in them.
  const ghostMaterial=new THREE.MeshBasicMaterial({color:0x8fe8dc,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide});
  const ghostGeo=new THREE.RingGeometry(r*.74,r*.9,6,1);ghostGeo.rotateX(-Math.PI/2);ghostGeo.rotateY(Math.PI/2);
  const ghosts=MIRROR_LAYOUT.outer.map(p=>{const line=new THREE.Mesh(ghostGeo,ghostMaterial);line.position.set(p.x,.012,p.z);g.add(line);return line;});
  // The mirror's own catch ring, above the secondary: where a finished segment is sent.
  const port=new THREE.Mesh(new THREE.TorusGeometry(.62,.055,10,48),new THREE.MeshStandardMaterial({color:0xffd98a,emissive:0xffb93a,emissiveIntensity:.6,roughness:.4}));
  port.rotation.x=Math.PI/2;port.position.set(0,1.95,0);port.castShadow=false;port.receiveShadow=false;g.add(port);
  const flash=new THREE.Mesh(hexGeo(r*1.05,.02),new THREE.MeshBasicMaterial({color:0xfff2c0,transparent:true,opacity:0,depthWrite:false}));flash.visible=false;g.add(flash);
  g.userData={flown,made,ghosts,ghostMaterial,flash,gold,port,shown:0,pop:[]};
  return g;
}

// Five film layers, stacked like a kite under the mirror.
function createSunshield(){
  const g=new THREE.Group();g.name='sunshield';
  const shape=new THREE.Shape();shape.moveTo(-3.95,0);shape.lineTo(-1.3,-1.42);shape.lineTo(1.3,-1.42);shape.lineTo(3.95,0);shape.lineTo(1.3,1.42);shape.lineTo(-1.3,1.42);shape.closePath();
  const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);
  const layers=[];
  for(let i=0;i<5;i++){
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:[0xe9dff2,0xdccfe9,0xd3c4e3,0xc9b9dc,0xbfaed5][i],metalness:.9,roughness:.26,side:THREE.DoubleSide,envMap:skyReflection(),envMapIntensity:1.25}));
    m.position.y=-1.02-i*.1;m.scale.set(1-i*.035,1,1-i*.05);m.receiveShadow=true;g.add(m);layers.push(m);
  }
  g.visible=false;g.userData={layers,open:0};
  return g;
}

function createCapsule(){
  const g=new THREE.Group();g.name='covari-capsule';
  const body=cyl(g,.36,.36,.9,0,0,0,C.creamLight,18,mat(C.creamLight,.5,.1));body.rotation.z=Math.PI/2;
  const nose=cyl(g,.2,.36,.3,-.6,0,0,C.white,18,mat(C.white,.5));nose.rotation.z=Math.PI/2;
  const band=cyl(g,.367,.367,.2,.05,0,0,0x1fb6a6,18,mat(0x1fb6a6,.5));band.rotation.z=Math.PI/2;
  const skirt=cyl(g,.36,.3,.22,.56,0,0,C.foil,18,mat(C.foil,.35,.7));skirt.rotation.z=Math.PI/2;
  for(const side of [-1,1]){box(g,.5,.02,.3,.1,0,side*.62,C.panel,mat(C.panel,.35,.4));box(g,.04,.03,.3,.1,0,side*.42,C.steel);}
  const lamp=add(g,new THREE.SphereGeometry(.05,8,6),glow(0x7df7e4,1.4),-.72,.16,0);lamp.castShadow=false;
  g.traverse(node=>{if(node.isMesh)node.receiveShadow=false;});
  g.visible=false;g.userData={lamp,progress:0,leaving:0};
  return g;
}

// A full-screen backdrop drawn behind everything: the planet's limb across
// the top of the view, its surface sliding under the dock, stars above.
const SKY_VERTEX='varying vec2 vUv;void main(){vUv=position.xy;gl_Position=vec4(position.xy,1.0,1.0);}';
const SKY_FRAGMENT=`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;uniform float uTime;uniform float uSpin;uniform vec3 uSun;uniform vec3 uLight;uniform float uBlink;
const vec2 CENTER=vec2(0.0,-2.02);const float RADIUS=2.44;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float hash2(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec3(7.1,3.7,1.3);a*=.5;}return v*1.04;}
float fbm3(vec3 p){float v=0.0,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.11+vec3(2.3,9.1,4.7);a*=.5;}return v;}
vec3 stars(vec2 p,float night){
  vec3 c=vec3(0.0);
  for(int layer=0;layer<2;layer++){
    float scale=layer==0?70.0:150.0;vec2 g=p*scale,id=floor(g),f=fract(g)-.5;
    float h=hash2(id+float(layer)*17.0);
    if(h>.86){vec2 o=(vec2(hash2(id+3.1),hash2(id+7.7))-.5)*.6;float d=length(f-o);
      float twinkle=.75+.25*sin(uTime*(1.0+h*3.0)+h*40.0);
      c+=mix(vec3(.75,.85,1.0),vec3(1.0,.9,.75),hash2(id+1.3))*smoothstep(.09,0.0,d)*(h-.86)*7.0*twinkle*(layer==0?1.0:.55);}
  }
  float band=smoothstep(.34,0.0,abs(p.y-.42-p.x*.22));
  if(band>.01)c+=vec3(.16,.2,.34)*band*fbm3(vec3(p*5.0,1.7))*.5;
  return c*(.3+.7*night);
}
void main(){
  vec2 p=vUv*vec2(uRes.x/uRes.y,1.0)*.5;
  vec2 d=(p-CENTER)/RADIUS;float rr=dot(d,d);
  float sunUp=clamp(uSun.z*1.6+.25,0.0,1.0);
  float night=1.0-clamp(uSun.z*2.2+.9,0.0,1.0);
  float low=smoothstep(.75,.05,abs(uSun.z))*step(0.0,uSun.y);
  vec3 col=vec3(.012,.018,.035);
  // The sun as it meets the limb, to the right of the order rail.
  vec2 sunAt=vec2(.36,CENTER.y+sqrt(max(0.0,RADIUS*RADIUS-.36*.36))+uSun.z*.3);
  float sd=length(p-sunAt);
  vec3 sunCol=mix(vec3(1.0,.5,.2),vec3(1.0,.96,.86),clamp(uSun.z*2.0,0.0,1.0));
  if(rr>=1.0){
    col+=stars(p,night);
    float visible=smoothstep(-.42,-.1,uSun.z)*step(0.0,uSun.y);
    col+=sunCol*(smoothstep(.034,.026,sd)*1.5+exp(-sd*9.0)*.6+exp(-sd*2.6)*.16)*visible;
    float alt=(sqrt(rr)-1.0)*RADIUS;
    vec3 air=mix(vec3(.25,.6,1.0),vec3(1.0,.5,.22),low*exp(-abs(p.x-sunAt.x)*1.6));
    col+=air*exp(-alt*46.0)*(.2+.8*max(sunUp,low))*.95+air*exp(-alt*11.0)*.16*max(sunUp,low*.8);
  }else{
    vec3 n=vec3(d,sqrt(1.0-rr));
    float cs=cos(uSpin),sn=sin(uSpin);
    vec3 q=vec3(n.x,n.y*cs+n.z*sn,-n.y*sn+n.z*cs);
    float h=fbm(q*2.1+vec3(1.7,4.2,.6))+.2*smoothstep(.9965,.9996,dot(q,normalize(uLight+vec3(-.035,.012,.02))));
    float land=smoothstep(.535,.56,h);
    // Only the lit side needs its colours and only the dark side its lights.
    float clouds=smoothstep(.5,.76,fbm3(q*3.4+vec3(uTime*.004,2.0,h*1.6)));
    float ndl=dot(n,uSun),day=smoothstep(-.1,.22,ndl);
    vec3 lit=vec3(0.0),dark=vec3(0.0);
    if(day>.01){
      vec3 ocean=mix(vec3(.02,.13,.3),vec3(.07,.36,.5),smoothstep(.4,.535,h));
      float detail=noise(q*9.0);
      vec3 ground=mix(vec3(.2,.42,.24),vec3(.62,.54,.34),smoothstep(.56,.72,h+.12*detail));
      ground=mix(ground,vec3(.9,.93,.95),smoothstep(.8,.9,abs(q.y)+.06*detail));
      vec3 surface=mix(ocean,ground,land);
      vec3 r=reflect(-uSun,n);
      surface+=vec3(1.0,.9,.7)*pow(max(r.z,0.0),60.0)*.55*(1.0-land)*(1.0-clouds);
      surface=mix(surface,vec3(.96,.97,.98),clouds*.92);
      lit=surface*(.3+.8*max(ndl,0.0));
    }
    if(day<.99){
      // Night side: city lights on land, the faint shape of cloud, one lighthouse.
      vec3 g=q*150.0;float cityHash=hash(floor(g));
      float town=smoothstep(.42,.66,noise(q*7.0+3.0))*land;
      float city=step(.72,cityHash)*smoothstep(.34,.05,length(fract(g)-.5))*town;
      dark=vec3(.012,.026,.06)+vec3(.02,.05,.1)*land*.35+vec3(.04,.055,.09)*clouds*.6+vec3(1.0,.72,.38)*city*(1.0-clouds*.8)*.9;
      float beam=smoothstep(.999955,.999992,dot(q,uLight));
      dark+=vec3(1.0,.9,.62)*beam*uBlink*2.2+vec3(1.0,.8,.5)*smoothstep(.99965,.99999,dot(q,uLight))*.22*uBlink;
    }
    col=mix(dark,lit,day);
    col+=vec3(1.0,.42,.14)*smoothstep(.2,0.0,abs(ndl-.03))*.16*(1.0-clouds*.5);
    float rim=pow(1.0-n.z,3.0);
    vec3 air=mix(vec3(.3,.62,1.0),vec3(1.0,.5,.25),low*exp(-abs(p.x-sunAt.x)*1.4));
    col+=air*rim*(.1+.9*max(day,low*.7))*.75;
    col+=sunCol*exp(-sd*5.0)*.22*low;
  }
  gl_FragColor=vec4(col,1.0);
}`;
function createSky(){
  const material=new THREE.ShaderMaterial({vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT,depthWrite:false,depthTest:true,
    uniforms:{uRes:{value:new THREE.Vector2(1280,720)},uTime:{value:0},uSpin:{value:0},uSun:{value:new THREE.Vector3(-.28,.5,.8)},uLight:{value:new THREE.Vector3(0,1,0)},uBlink:{value:0}}});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.name='orbital-sky';mesh.frustumCulled=false;mesh.renderOrder=900;mesh.castShadow=false;mesh.receiveShadow=false;
  return mesh;
}

// Where the day is in the shift. One pass from noon into the planet's shadow.
export const ORBIT_SPIN=.012,LIGHTHOUSE_AT=118;
export function orbitSun(fraction){
  const keys=[[0,35],[.28,35],[.42,96],[.52,140],[.62,186],[1,186]];
  let angle=keys.at(-1)[1];
  for(let i=1;i<keys.length;i++)if(fraction<=keys[i][0]){const [a0,v0]=keys[i-1],[a1,v1]=keys[i],t=(fraction-a0)/Math.max(1e-6,a1-a0);angle=v0+(v1-v0)*t*t*(3-2*t);break;}
  const a=angle*Math.PI/180,v=new THREE.Vector3(-.28,Math.sin(a),Math.cos(a)).normalize();
  // 1 in full sun, 0 in shadow; the dock's own lamps take over as it falls.
  return {direction:v,angle,daylight:THREE.MathUtils.clamp((150-angle)/45,0,1),warmth:THREE.MathUtils.clamp(1-Math.abs(angle-100)/45,0,1)};
}
// The lighthouse from the last level, a fixed point on the planet's coast.
const LIGHT_X=.32,LIGHT_RHO=Math.sqrt(1-LIGHT_X*LIGHT_X),LIGHT_PHI=-ORBIT_SPIN*LIGHTHOUSE_AT;
const LIGHTHOUSE=new THREE.Vector3(LIGHT_X,LIGHT_RHO*Math.cos(LIGHT_PHI),LIGHT_RHO*Math.sin(LIGHT_PHI));

export function createOrbitalDock(){
  const root=new THREE.Group();root.name='orbital-dock';
  const g=new THREE.Group();root.add(g);
  const {outer,well}=DOCK,plate=mat(C.plate,.72),edge=mat(C.teal,.6),foil=new THREE.MeshStandardMaterial({color:C.foil,metalness:.85,roughness:.32,envMap:skyReflection(),envMapIntensity:.9});
  const truss=mat(0x2a3d49,.6,.3),pad=mat(0x23404d,.7);
  // Walkway: four runs of plates around the well.
  const tile=(x0,x1,z0,z1)=>{
    const nx=Math.max(1,Math.round((x1-x0)/1.4)),nz=Math.max(1,Math.round((z1-z0)/1.4)),w=(x1-x0)/nx,d=(z1-z0)/nz;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)box(g,w-.04,.12,d-.04,x0+w*(i+.5),-.06,z0+d*(j+.5),0,plate);
    box(g,x1-x0,.06,z1-z0,(x0+x1)/2,-.15,(z0+z1)/2,0,truss);
  };
  tile(outer.minX,outer.maxX,outer.minZ,well.minZ);tile(outer.minX,outer.maxX,well.maxZ,outer.maxZ);
  tile(outer.minX,well.minX,well.minZ,well.maxZ);tile(well.maxX,outer.maxX,well.minZ,well.maxZ);
  // Lit edges: gold around the well, teal along the outside.
  const wellGlow=glow(0xffd98a,.9),rimGlow=glow(0x5fe6d6,.7);
  const edgeStrip=(x0,x1,z0,z1,material)=>{const m=box(g,Math.max(.05,x1-x0),.03,Math.max(.05,z1-z0),(x0+x1)/2,.012,(z0+z1)/2,0,material);m.castShadow=false;return m;};
  for(const [x0,x1,z0,z1] of [[well.minX,well.maxX,well.minZ-.05,well.minZ],[well.minX,well.maxX,well.maxZ,well.maxZ+.05],[well.minX-.05,well.minX,well.minZ,well.maxZ],[well.maxX,well.maxX+.05,well.minZ,well.maxZ]])edgeStrip(x0,x1,z0,z1,wellGlow);
  for(const [x0,x1,z0,z1] of [[outer.minX,outer.maxX,outer.minZ,outer.minZ+.05],[outer.minX,outer.maxX,outer.maxZ-.05,outer.maxZ],[outer.minX,outer.minX+.05,outer.minZ,outer.maxZ],[outer.maxX-.05,outer.maxX,outer.minZ,outer.maxZ]])edgeStrip(x0,x1,z0,z1,rimGlow);
  // The well has no rail: its lit edge is where walking ends and floating begins.
  // Station pads hang outboard of the ring; the corners between them are open.
  const pads=[[-6.95,1.2,-5.75,-3.15],[3.55,6.25,-5.2,-3.15],[-9.55,-7.4,-1.6,1.6],[7.4,10.3,-1.25,1.25],[-6.4,-3.6,3.15,5.05],[-1.0,1.6,3.15,4.9],[3.8,6.2,3.15,4.4]];
  for(const [x0,x1,z0,z1] of pads){
    box(g,x1-x0,.14,z1-z0,(x0+x1)/2,-.07,(z0+z1)/2,0,pad);
    box(g,x1-x0+.1,.2,z1-z0+.1,(x0+x1)/2,-.26,(z0+z1)/2,0,foil);
  }
  // Truss under the ring and gold-wrapped tanks under the pads.
  for(const z of [outer.minZ+.7,outer.maxZ-.7])box(g,outer.maxX-outer.minX+.6,.18,.18,0,-.36,z,0,truss);
  for(const x of [outer.minX+.7,outer.maxX-.7])box(g,.18,.18,outer.maxZ-outer.minZ+.6,x,-.36,0,0,truss);
  for(let i=0;i<8;i++){const x=outer.minX+.7+(outer.maxX-outer.minX-1.4)*i/7;for(const z of [outer.minZ+.7,outer.maxZ-.7]){const brace=box(g,.07,.07,1.1,x,-.52,z,0,truss);brace.rotation.x=i%2?.6:-.6;}}
  for(const [x,z] of [[-5.0,-4.6],[-.8,-4.7],[-8.5,0],[8.85,0]]){const tank=cyl(g,.34,.34,1.5,x,-.72,z,0,14,foil);tank.rotation.z=Math.PI/2;}
  // Lamp posts at the ring's corners.
  const lampGlow=glow(0xfff0c8,1.2);
  for(const [x,z] of [[outer.minX+.12,outer.minZ+.12],[outer.maxX-.12,outer.minZ+.12],[outer.minX+.12,outer.maxZ-.12],[outer.maxX-.12,outer.maxZ-.12]]){
    box(g,.07,1.7,.07,x,.85,z,0,truss);box(g,.34,.06,.16,x-Math.sign(x)*.12,1.72,z,0,truss);
    const head=box(g,.26,.03,.12,x-Math.sign(x)*.14,1.68,z,0,lampGlow);head.castShadow=false;
  }
  // Solar arrays off the back corners, tipped toward the camera.
  for(const side of [-1,1]){
    const wing=new THREE.Group();wing.position.set(side*11.6,-.2,-5.6);wing.rotation.set(.62,side*-.28,0);g.add(wing);
    box(wing,4.4,.1,.1,0,0,0,0,foil);
    for(let i=0;i<4;i++)for(const row of [-1,1]){box(wing,.98,.03,.92,-1.6+i*1.07,0,row*.56,0,mat(C.panel,.3,.5));box(wing,.98,.034,.02,-1.6+i*1.07,0,row*.56,0,mat(0x7fa0e8,.4,.3));}
    box(g,2.6,.1,.1,side*8.5,-.3,-5.0,0,truss).rotation.y=side*.2;
  }
  // Radiator fins on the east side and a tracking dish on a mast.
  for(let i=0;i<3;i++){const fin=box(g,1.5,.04,.6,-10.6,-.25+i*.02,2.5+i*.72,C.white);fin.rotation.z=.5;}
  box(g,.1,.1,2.4,-9.9,-.3,3.2,0,truss);box(g,.9,.1,.1,-9.5,-.3,2.2,0,truss);
  box(g,.9,.1,.1,6.7,-.2,-4.6,0,truss);box(g,.09,2.1,.09,7.1,.85,-4.6,0,truss);
  const dish=new THREE.Group();dish.position.set(7.1,2.0,-4.6);g.add(dish);
  const bowl=add(dish,new THREE.SphereGeometry(.56,20,8,0,Math.PI*2,0,.9),mat(C.white,.5,.1),0,-.42,0);bowl.rotation.x=Math.PI;bowl.position.y=.42;
  cyl(dish,.012,.012,.5,0,.36,0,C.steel,6);add(dish,new THREE.SphereGeometry(.045,8,6),glow(0xff5a4a,1),0,.62,0);
  // Docking collar for Covari's capsule, beside Receiving.
  box(g,.9,.12,.5,6.6,-.07,3.75,0,pad);cyl(g,.2,.2,.24,6.95,.22,3.75,C.steel,14).rotation.z=Math.PI/2;
  // Navigation lights.
  const nav=[];for(const [x,z,color] of [[outer.minX-2.1,0,0xff5a4a],[outer.maxX+2.9,0,0x6dff9a],[0,-5.9,0xffffff]]){const light=add(g,new THREE.SphereGeometry(.07,8,6),glow(color,1.5),x,.1,z);light.castShadow=false;light.userData.loose=true;nav.push(light);}
  namePlateSign(g);
  g.userData.dish=dish;
  batch(g);

  // The mirror is this map's shipping station: main.js swaps it in for the
  // conveyor, so clicks on it and its label work like any other station.
  const mirror=createMirror(),mirrorStation=new THREE.Group();mirrorStation.name='station-mirror';mirrorStation.add(mirror);root.add(mirrorStation);
  const shield=createSunshield();root.add(shield);
  const capsule=createCapsule();root.add(capsule);
  const sky=createSky();root.add(sky);
  // Warm work lamps for the night side. They sit dark in full sun.
  const lamps=[[-5,2.6,-2.4],[1,2.6,-2.4],[5.6,2.4,-.6],[0,2.4,2.5],[-5.6,2.4,1.2]].map(([x,y,z])=>{const light=new THREE.PointLight(0xffdfae,0,11,1.7);light.position.set(x,y,z);root.add(light);return light;});
  const mirrorLamp=new THREE.PointLight(0xffe2a0,0,6,1.6);mirrorLamp.position.set(0,1.6,1.0);root.add(mirrorLamp);

  // Catch rings and flight guides are built once the stations are placed.
  const rings=new Map(),ringGeo=new THREE.TorusGeometry(.38,.045,10,40),mastGeo=new THREE.CylinderGeometry(.022,.022,.5,6),mastMaterial=mat(0x2a3d49,.6,.3),guides=[];
  const guideMaterial=new THREE.LineDashedMaterial({color:0x9ff5e8,transparent:true,opacity:.55,dashSize:.14,gapSize:.12});
  function setStations(list){
    for(const ring of rings.values()){ring.mesh.removeFromParent();ring.mesh.material.dispose();ring.mast.removeFromParent();}rings.clear();
    for(const {id,x,z,height,w=2} of list){
      const mesh=new THREE.Mesh(ringGeo,new THREE.MeshStandardMaterial({color:0x7df0e2,emissive:0x45d8c8,emissiveIntensity:.5,roughness:.4}));
      mesh.castShadow=false;mesh.receiveShadow=false;mesh.rotation.x=Math.PI/2-.62;
      mesh.position.set(x+w/2-.05,height+.62,z-.1);root.add(mesh);
      const mast=new THREE.Mesh(mastGeo,mastMaterial);mast.position.set(mesh.position.x,height+.02,z-.1);root.add(mast);
      rings.set(id,{mesh,mast,point:mesh.position.clone(),pulse:0});
    }
  }
  function setGuides(pairs){
    while(guides.length<pairs.length){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(1,0,0)]),guideMaterial);line.frustumCulled=false;root.add(line);guides.push(line);}
    guides.forEach((line,i)=>{
      const pair=pairs[i];line.visible=!!pair;if(!pair)return;
      const position=line.geometry.attributes.position;position.setXYZ(0,pair.from.x,pair.from.y,pair.from.z);position.setXYZ(1,pair.to.x,pair.to.y,pair.to.z);position.needsUpdate=true;line.computeLineDistances();
    });
  }
  // Where the held part would go: a line from the hands and a mark at the far end.
  const aimMaterial=new THREE.LineDashedMaterial({color:0xfff2c0,transparent:true,opacity:.9,dashSize:.22,gapSize:.16});
  const aimLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(1,0,0)]),aimMaterial);aimLine.frustumCulled=false;aimLine.visible=false;aimLine.renderOrder=5;root.add(aimLine);
  const aimMark=new THREE.Mesh(new THREE.TorusGeometry(.26,.03,8,28),new THREE.MeshBasicMaterial({color:0xfff2c0,transparent:true,opacity:.9,depthTest:false}));aimMark.rotation.x=Math.PI/2-.62;aimMark.visible=false;aimMark.renderOrder=6;root.add(aimMark);
  function setAim(aim,clock=0){
    aimLine.visible=aimMark.visible=!!aim;if(!aim)return;
    const position=aimLine.geometry.attributes.position;position.setXYZ(0,aim.from.x,aim.from.y,aim.from.z);position.setXYZ(1,aim.to.x,aim.to.y,aim.to.z);position.needsUpdate=true;aimLine.computeLineDistances();
    const color=aim.ok?0xfff2c0:0xff8a6b;aimMaterial.color.set(color);aimMaterial.opacity=aim.ok?.9:.5;aimMark.material.color.set(color);
    aimMark.position.copy(aim.to);aimMark.scale.setScalar(1+.18*Math.sin(clock*7));
  }
  const slotWorld=index=>mirror.localToWorld(MIRROR_LAYOUT.outer[Math.max(0,Math.min(MIRROR_LAYOUT.outer.length-1,index))].clone().setY(.06));
  const ringPoint=id=>rings.get(id)?.point??null;
  const stationModels={};
  let spin=0,lastInstalled=0;

  function update({game,dt=0,clock=0,playing=false,finale=0,reduced=false,width=1280,height=720,aim=null}){
    const duration=game?.config?.duration||210,elapsed=game?.elapsed||0,fraction=Math.min(1,elapsed/duration);
    const sun=orbitSun(fraction),night=1-sun.daylight;
    spin=playing?ORBIT_SPIN*elapsed:spin+ORBIT_SPIN*dt;
    const u=sky.material.uniforms;u.uRes.value.set(width,height);u.uTime.value=clock;u.uSpin.value=spin;u.uSun.value.copy(sun.direction);u.uLight.value.copy(LIGHTHOUSE);
    // Two quick flashes every four seconds, like the beacon the shop rebuilt.
    const beat=clock%4;u.uBlink.value=reduced?.7:Math.max(Math.exp(-beat*5),beat>.7?Math.exp(-(beat-.7)*5):0);
    const dim=finale>0?Math.max(.25,1-finale/3):1;
    lamps.forEach(light=>{light.intensity=night*22*dim;});mirrorLamp.intensity=(night*9+(finale>0?Math.min(1,finale/2)*16:0));
    wellGlow.emissiveIntensity=.5+night*1.3;rimGlow.emissiveIntensity=.35+night*1.1;lampGlow.emissiveIntensity=.3+night*2.2;
    const env=.5+.45*sun.daylight+sun.warmth*.25;mirror.userData.gold.envMapIntensity=env+(finale>0?Math.min(1.2,finale*.4):0);
    nav.forEach((light,i)=>{light.material.emissiveIntensity=reduced?1:(Math.sin(clock*2.2+i*2.1)>.55?2.4:.25);});
    dish.rotation.y=reduced?.6:.6+Math.sin(clock*.12)*.9;dish.rotation.z=.5;

    // Mirror: segments appear as they are installed, with a short settle.
    const m=mirror.userData,count=Math.min(m.made.length,game?.installed?.length??0);
    if(count<lastInstalled){m.pop.length=0;}
    for(let i=0;i<m.made.length;i++){
      const on=i<count,pivot=m.made[i];
      if(on&&!pivot.visible&&i>=lastInstalled)m.pop.push({index:i,t:0});
      pivot.visible=on;m.ghosts[i].visible=!on;
    }
    lastInstalled=count;
    m.ghostMaterial.opacity=reduced?.5:.38+.2*Math.sin(clock*2.4);
    for(let i=m.pop.length-1;i>=0;i--){
      const pop=m.pop[i];pop.t+=dt;const k=Math.min(1,pop.t/.7),pivot=m.made[pop.index];
      pivot.position.y=(1-k)*(1-k)*.35;pivot.scale.setScalar(.6+.4*Math.min(1,k*1.6));
      m.flash.visible=k<1;m.flash.position.copy(MIRROR_LAYOUT.outer[pop.index]).setY(.08);m.flash.material.opacity=(1-k)*.9;
      if(k>=1){pivot.position.y=0;pivot.scale.setScalar(1);m.pop.splice(i,1);}
    }
    // Holding a finished segment: its slot and the mirror's ring call for it.
    const calling=aim?.to==='ship',arriving=!!game?.flights?.some(flight=>flight.to==='ship');
    if(!m.pop.length){m.flash.visible=calling&&count<m.made.length;if(m.flash.visible){m.flash.position.copy(MIRROR_LAYOUT.outer[count]).setY(.03);m.flash.material.opacity=reduced?.5:.35+.3*Math.sin(clock*7);}}
    m.port.material.emissiveIntensity=calling||arriving?(reduced?1.6:1.5+.7*Math.sin(clock*8)):.45+night*.5;m.port.scale.setScalar(calling?1.12:1);m.port.visible=finale<=0;
    // First light: every segment eases from its own small tilt into one surface.
    const phase=finale>0?Math.min(1,Math.max(0,(finale-1)/4)):0,settle=1-phase*phase*(3-2*phase);
    for(const pivot of [...m.flown,...m.made]){pivot.rotation.x=pivot.userData.tilt.x*settle;pivot.rotation.z=pivot.userData.tilt.z*settle;}

    // Sunshield: unfolds once Covari's membrane reaches the mirror.
    const s=shield.userData,want=game?.shield?1:0;
    s.open=want?Math.min(1,s.open+dt/2.6):0;shield.visible=s.open>0;
    if(shield.visible){const k=s.open*s.open*(3-2*s.open);s.layers.forEach((layer,i)=>{const spread=Math.min(1,Math.max(0,k*1.3-i*.06));layer.scale.x=(1-i*.035)*Math.max(.02,spread);layer.position.y=-1.02-i*.1*k;});}

    // Capsule: approaches while the order is on its way, waits docked, leaves.
    const job=game?.sourcing,c=capsule.userData,dockAt=new THREE.Vector3(7.5,.22,3.75);
    const coming=job?.state==='sourcing',docked=job?.state==='delivered'&&!!game?.receiving;
    if(coming){c.progress=1-Math.max(0,job.remaining)/22;c.leaving=0;}
    else if(docked){c.progress=1;c.leaving=0;}
    else if(c.progress>0){c.leaving+=dt;if(c.leaving>7){c.progress=0;c.leaving=0;}}
    capsule.visible=c.progress>0;
    if(capsule.visible){
      const k=1-Math.pow(1-Math.min(1,c.progress),2.4),away=c.leaving>0?Math.pow(c.leaving/7,2):0;
      capsule.position.set(dockAt.x+(1-k)*9+away*11,dockAt.y-(1-k)*2.6+away*2,dockAt.z+(1-k)*6.5+away*4);
      capsule.rotation.y=(1-k)*.9-away*1.2;c.lamp.material.emissiveIntensity=Math.sin(clock*6)>0?2:.3;
    }

    // Catch rings: brighter with a part inbound, gold while holding one.
    for(const [id,ring] of rings){
      const holding=game?.rings?.[id]!=null,inbound=!!game?.flights?.some(flight=>flight.to===id);
      const material=ring.mesh.material;material.emissive.set(holding?0xffc14a:0x45d8c8);material.color.set(holding?0xffd98a:0x7df0e2);
      const aimed=aim?.to===id;if(aimed&&!holding)material.emissive.set(aim.ok?0xfff2c0:0xff6a4a);
      material.emissiveIntensity=holding?1.5:aimed?(reduced?1.6:1.5+.6*Math.sin(clock*8)):inbound?(reduced?1.2:1.0+.6*Math.sin(clock*9)):.35+night*.35;
      ring.mesh.scale.setScalar(holding?1.08:aimed?1.15:1);
    }
    // Polisher and gold chamber.
    const polish=stationModels.polish,gild=stationModels.gild,busy=id=>{const station=game?.stations?.[id];return !!station?.part&&!station.ready;};
    if(polish){const on=playing&&busy('polish');if(on&&!reduced)polish.userData.platter.rotation.y+=dt*7;polish.userData.arm.rotation.y=on&&!reduced?Math.sin(clock*4.2)*.32:THREE.MathUtils.damp(polish.userData.arm.rotation.y,.55,6,dt);}
    if(gild){
      const station=game?.stations?.gild,on=busy('gild'),down=!!station?.part&&!station.ready,jar=gild.userData.jar;
      jar.position.y=THREE.MathUtils.damp(jar.position.y,down?1.4:2.0,7,dt||.016);
      const glowing=on?(reduced?.8:.65+.3*Math.sin(clock*7)):0;
      gild.userData.jarGlass.emissiveIntensity=THREE.MathUtils.damp(gild.userData.jarGlass.emissiveIntensity,glowing,8,dt||.016);
      gild.userData.ember.material.emissiveIntensity=glowing*3;gild.userData.ember.visible=on;
    }
  }
  root.userData={update,setStations,setGuides,setAim,slotWorld,ringPoint,stationModels,mirror,mirrorStation,shield,capsule,sky,rings,
    // The play camera frames the working dock, not the arrays or the sky.
    framePoints:[new THREE.Vector3(-9.55,0,-5.75),new THREE.Vector3(10.3,0,-5.2),new THREE.Vector3(-9.55,0,5.05),new THREE.Vector3(10.3,0,4.9),new THREE.Vector3(4.9,2.75,-4.25),new THREE.Vector3(-5.1,3.4,-5.4)]};
  return root;
}
function namePlateSign(g){
  if(typeof document==='undefined')return;
  const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#10262f';ctx.fillRect(0,0,1024,160);ctx.fillStyle='#f2d08a';ctx.font='700 74px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('ORBITAL DOCK 7 · FIRST LIGHT',512,86,980);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=add(g,new THREE.PlaneGeometry(3.6,.5),new THREE.MeshBasicMaterial({map:texture}),0,-.08,5.02);sign.rotation.x=-.5;sign.castShadow=false;sign.userData.loose=true;
}
