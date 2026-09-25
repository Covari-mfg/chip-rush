import * as THREE from '../vendor/three.module.js';

// Original, dimensionally modelled miniature workshop. All art is procedural.
// Units are metres-ish. Machines face +Z; model pivots sit on the floor.
const materialCache = new Map();
const geometryCache = new Map();
const C = {
  cream: 0xe5e2cd, creamLight: 0xf6f0db, creamDark: 0xa8b5ad,
  teal: 0x17787e, tealDark: 0x154c56, cyan: 0x69eee6,
  navy: 0x183441, dark: 0x102833, steel: 0x8daab2, shiny: 0xc8dedb,
  rubber: 0x142b31, gold: 0xeac16b, orange: 0xec8150, wood: 0xa87946,
};
function mat(color, roughness = .55, metalness = 0) {
  const key = `${color}/${roughness}/${metalness}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materialCache.get(key);
}
function glow(color, intensity = .6) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .28 });
}
function bevelGeom(w,h,d,r=.035) {
  r=Math.min(r,w/4,h/4,d/4);
  const key = `b/${w}/${h}/${d}/${r}`;
  if (!geometryCache.has(key)) {
    const shape = new THREE.Shape();
    const x=w/2-r,y=h/2-r;
    shape.moveTo(-x,-y); shape.lineTo(x,-y); shape.lineTo(x,y); shape.lineTo(-x,y); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d-2*r, bevelEnabled:r>0, bevelSegments:1, steps:1, bevelSize:r, bevelThickness:r, curveSegments:1 });
    geo.translate(0,0,-(d-2*r)/2);
    geometryCache.set(key,geo);
  }
  return geometryCache.get(key);
}
function box(parent,w,h,d,x,y,z,color=C.cream,r=.035,material) {
  const mesh = new THREE.Mesh(bevelGeom(w,h,d,r), material || mat(color));
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
  parent.add(mesh); return mesh;
}
function cyl(parent,rt,rb,height,x,y,z,color=C.steel,segments=16,material) {
  const key=`c/${rt}/${rb}/${height}/${segments}`;
  if(!geometryCache.has(key))geometryCache.set(key,new THREE.CylinderGeometry(rt,rb,height,segments));
  const m=new THREE.Mesh(geometryCache.get(key),material||mat(color,.35,.45));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function sphere(parent,r,x,y,z,color,scale=[1,1,1],material) {
  const key=`s/${r}`;
  if(!geometryCache.has(key))geometryCache.set(key,new THREE.SphereGeometry(r,12,8));
  const m=new THREE.Mesh(geometryCache.get(key),material||mat(color));
  m.position.set(x,y,z);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function tube(parent,points,r,color) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const m=new THREE.Mesh(new THREE.TubeGeometry(curve,12,r,6,false),mat(color,.6,.2));
  parent.add(m);m.castShadow=true;return m;
}
function textPlate(parent,text,w,h,x,y,z,{color='#dcfff4',bg='#164552',size=45}={}) {
  if(typeof document==='undefined') return box(parent,w,h,.018,x,y,z,C.tealDark,.002);
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle=color;ctx.font=`700 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,68,490);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex}));
  m.position.set(x,y,z);parent.add(m);return m;
}
function feet(g,w=2.25,d=1.25) {
  for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]) {
    cyl(g,.105,.125,.1,x,.07,z,C.rubber,12);
    cyl(g,.06,.065,.15,x,.16,z,C.steel,10);
  }
}
function vent(g,x,y,z,w=.48,h=.3,count=5) {
  box(g,w+.055,h+.055,.016,x,y,z,C.creamDark,.004);
  for(let i=0;i<count;i++)box(g,w,.02,.024,x,y-h/2+(i+.5)*h/count,z+.012,C.dark,.003);
}
function bolts(g,x,y,z,w,h) {
  for(const dx of [-w/2,w/2])for(const dy of [-h/2,h/2]){
    const b=cyl(g,.022,.022,.018,x+dx,y+dy,z,C.shiny,6);b.rotation.x=Math.PI/2;
  }
}
function beacon(g,x,y,z) {
  cyl(g,.09,.11,.08,x,y,z,C.dark,12);
  cyl(g,.035,.035,.14,x,y+.10,z,C.steel,10);
  const lamp=cyl(g,.07,.07,.15,x,y+.22,z,C.cyan,12,glow(C.cyan,.45));
  cyl(g,.076,.076,.026,x,y+.305,z,C.dark,12);
  g.userData.statusLight=lamp;return lamp;
}
function panel(g,x,y,z,w=.44,h=.70) {
  box(g,w,h,.1,x,y,z,C.navy,.025);
  box(g,w-.08,h*.37,.015,x,y+h*.19,z+.062,C.dark,.008);
  const screen=box(g,w-.12,h*.29,.021,x,y+h*.19,z+.076,C.cyan,.004,glow(0x38ced4,.7));
  for(let i=0;i<3;i++)box(g,w*.48,.015,.01,x-w*.06,y+h*.27-i*.045,z+.09,0xbffdf4,.001);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)box(g,.038,.03,.021,x+(i-1)*.073,y-h*.11-j*.055,z+.068, j===2?C.gold:C.creamDark,.006);
  const stop=cyl(g,.04,.04,.027,x+w*.29,y-h*.27,z+.075,0xe36559,12);stop.rotation.x=Math.PI/2;
  return screen;
}
function safetyMat(g,w=2.65,d=.66,z=1.04) {
  box(g,w,.027,d,0,.015,z,C.rubber,.018).castShadow=false;
  for(let i=0;i<14;i++) {
    const x=-w/2+.075+i*(w-.15)/13;
    const stripe=box(g,.08,.008,.13,x,.033,z+d/2-.07,C.gold,.001);stripe.rotation.y=.25;
  }
}
function bench(g,color=C.teal,w=2.35,d=1.4) {
  for(const x of [-w/2+.13,w/2-.13])for(const z of [-d/2+.12,d/2-.12])box(g,.095,.86,.095,x,.50,z,C.navy,.012);
  box(g,w,.15,d,0,.99,0,color,.05);
  box(g,w-.26,.07,d-.18,0,.38,0,C.tealDark,.025);
  box(g,w-.04,.055,d-.04,0,1.09,0,C.steel,.015,mat(C.steel,.42,.5));
}
function cabinet(g,x,z,w=.55,h=.80) {
  box(g,w,h,.58,x,h/2+.10,z,C.tealDark,.04);
  for(let i=0;i<4;i++) {
    box(g,w-.07,.15,.025,x,.2+i*.17,z+.303,C.teal,.012);
    box(g,w*.58,.024,.03,x,.23+i*.17,z+.325,C.steel,.006);
  }
}
function tool(g,x,y,z,angle=0) {
  const tg=new THREE.Group();tg.position.set(x,y,z);tg.rotation.y=angle;g.add(tg);
  box(tg,.045,.035,.28,0,0,0,C.steel,.01);
  const ring=cyl(tg,.065,.065,.03,0,0,-.16,C.steel,6);
  cyl(tg,.027,.027,.033,0,.002,-.16,C.dark,6);
  box(tg,.05,.035,.08,0,0,.18,C.steel,.008);
}
function hazard(g,x,y,z,scale=.15) {
  const shape=new THREE.Shape();shape.moveTo(0,scale);shape.lineTo(-scale*.9,-scale*.6);shape.lineTo(scale*.9,-scale*.6);shape.closePath();
  const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat(C.gold));m.position.set(x,y,z);g.add(m);
  box(g,.024,scale*.65,.004,x,y+scale*.06,z+.007,C.navy,.002);
  box(g,.022,.025,.004,x,y-scale*.36,z+.007,C.navy,.002);
}
function makeMill(g) {
  feet(g);safetyMat(g);
  box(g,2.5,.40,1.55,0,.36,0,C.navy,.07);
  box(g,2.43,.22,1.50,0,.64,0,C.creamDark,.045);
  box(g,1.35,1.41,.16,-.20,1.42,-.60,C.tealDark,.035);
  box(g,.45,1.72,1.44,-1.015,1.50,-.035,C.cream,.09);
  box(g,.54,1.72,1.44,1.0,1.50,-.035,C.cream,.09);
  box(g,1.69,.30,1.43,-.015,2.235,-.035,C.creamLight,.065);
  box(g,1.38,.12,1.21,-.16,.82,0,C.teal,.025);
  for(const x of [-.60,.23])box(g,.065,.62,.085,x,1.27,-.41,C.steel,.014);
  box(g,.83,.13,.69,-.20,1.07,.03,C.steel,.035,mat(C.steel,.28,.65));
  for(let i=0;i<4;i++)box(g,.71,.012,.022,-.20,1.143,-.19+i*.14,C.navy,.002);
  box(g,.36,.15,.32,-.20,1.20,.065,C.shiny,.016);
  box(g,.14,.075,.27,-.385,1.24,.065,C.navy,.01);
  box(g,.14,.075,.27,-.015,1.24,.065,C.navy,.01);
  const spindle=new THREE.Group();spindle.position.set(-.2,1.91,-.06);g.add(spindle);
  box(spindle,.42,.37,.38,0,0,0,C.teal,.045);
  cyl(spindle,.11,.08,.21,0,-.28,0,C.steel,20);
  cyl(spindle,.045,.025,.17,0,-.46,0,C.shiny,12);
  g.userData.spindle=spindle;
  const glowBar=box(g,1.1,.035,.065,-.17,2.067,.3,C.cyan,.005,glow(C.cyan,.7));
  panel(g,1.02,1.52,.739,.40,.76);
  box(g,.04,.34,.062,-.77,1.43,.714,C.gold,.015);
  box(g,.04,.34,.062,.645,1.43,.714,C.gold,.015);
  vent(g,-1.016,.96,.715,.25,.23,4);hazard(g,-1.02,1.50,.72,.10);
  bolts(g,-1.02,1.82,.721,.26,.53);
  textPlate(g,'VERTICAL CNC',.92,.12,-.12,2.24,.699,{size:38});
  beacon(g,1.0,2.42,-.36);
  tube(g,[[.62,1.98,-.11],[.50,1.89,.13],[.32,1.58,.15],[.09,1.40,.10]],.026,C.gold);
  cabinet(g,-1.51,.07,.42,.74);
  for(let i=0;i<4;i++)cyl(g,.023,.035,.15,-1.65+i*.085,.97,.11,C.shiny,10);
  g.userData.workPoint=new THREE.Vector3(-.20,1.34,.065);
  g.userData.animated=[spindle];
}
function makeLathe(g) {
  feet(g);safetyMat(g);
  box(g,2.66,.56,1.5,0,.45,0,C.navy,.085);
  box(g,2.54,.15,1.5,0,.79,0,C.creamDark,.025);
  box(g,2.48,1.06,.14,0,1.41,-.58,C.tealDark,.04);
  box(g,.47,1.55,1.42,-1.11,1.51,-.02,C.cream,.10);
  box(g,.49,1.55,1.42,1.08,1.51,-.02,C.cream,.10);
  box(g,1.89,.25,1.40,-.01,2.155,-.025,C.creamLight,.055);
  box(g,1.72,.17,.97,-.03,.97,-.035,C.teal,.035);
  for(const z of [-.23,.17]){
    const rail=cyl(g,.042,.042,1.63,-.02,1.15,z,C.steel,12);rail.rotation.z=Math.PI/2;
  }
  box(g,.43,.51,.76,-.66,1.41,-.13,C.teal,.06);
  const spindle=new THREE.Group();spindle.position.set(-.405,1.57,.01);g.add(spindle);
  const chuck=cyl(spindle,.245,.245,.17,0,0,0,C.steel,24,mat(C.steel,.25,.7));chuck.rotation.z=Math.PI/2;
  const ring=cyl(spindle,.184,.184,.19,0,0,0,C.dark,24);ring.rotation.z=Math.PI/2;
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;
    const jaw=box(spindle,.11,.095,.16,.10,Math.cos(a)*.126,Math.sin(a)*.126,C.shiny,.012);jaw.rotation.x=a;
  }
  const stock=cyl(spindle,.085,.085,.51,.33,0,0,C.shiny,20,mat(C.shiny,.26,.68));stock.rotation.z=Math.PI/2;
  g.userData.spindle=spindle;g.userData.animated=[spindle];
  box(g,.46,.16,.51,.37,1.29,.10,C.steel,.025);
  box(g,.21,.13,.26,.39,1.43,.10,C.navy,.018);
  box(g,.055,.10,.22,.22,1.5,.035,C.gold,.01);
  const wheel=cyl(g,.12,.12,.045,.4,1.20,.43,C.navy,16);wheel.rotation.x=Math.PI/2;
  const axle=cyl(g,.035,.035,.058,.4,1.20,.46,C.steel,10);axle.rotation.x=Math.PI/2;
  box(g,1.25,.032,.06,0,1.985,.24,C.cyan,.005,glow(C.cyan,.6));
  panel(g,1.08,1.47,.739,.40,.72);
  box(g,.032,.35,.063,-.805,1.50,.718,C.gold,.012);
  vent(g,-.88,.47,.773,.46,.19,4);
  vent(g,.18,.47,.773,.87,.19,4);
  hazard(g,-1.11,1.53,.718,.11);
  textPlate(g,'PRECISION LATHE',1.12,.12,0,2.16,.70,{size:36});
  beacon(g,1.11,2.35,-.35);
  tube(g,[[-.87,1.91,-.28],[-.51,1.93,-.14],[-.12,1.70,-.02]],.022,C.gold);
  g.userData.workPoint=new THREE.Vector3(-.06,1.57,.01);
}
function makeDeburr(g) {
  bench(g,C.teal,2.16,1.31);safetyMat(g,2.24,.44,.85);
  box(g,.65,.13,.73,-.47,1.20,-.10,C.navy,.035);
  box(g,.36,.35,.47,-.47,1.42,-.10,C.cream,.065);
  const spindle=new THREE.Group();spindle.position.set(-.47,1.56,.01);g.add(spindle);
  const axle=cyl(spindle,.065,.065,.78,0,0,0,C.steel,12);axle.rotation.z=Math.PI/2;
  for(const x of [-.45,.45]){
    const disk=cyl(spindle,.235,.235,.13,x,0,0, x<0?0x687980:0xb9ac89,24);disk.rotation.z=Math.PI/2;
    const hub=cyl(spindle,.074,.074,.15,x,0,0,C.gold,14);hub.rotation.z=Math.PI/2;
  }
  g.userData.spindle=spindle;g.userData.animated=[spindle];
  box(g,.46,.06,.42,.70,1.15,.12,C.dark,.02);
  tool(g,.69,1.195,.10,.3);tool(g,.86,1.195,.1,-.2);
  box(g,.15,.08,.06,-.46,1.29,.19,C.orange,.014);
  cabinet(g,.52,-.04,.80,.79);
  beacon(g,.82,1.20,-.47);
  textPlate(g,'DEBURR',.85,.13,0,.94,.685,{size:46});
  g.userData.workPoint=new THREE.Vector3(.40,1.22,.20);
}
function makeAnodize(g) {
  feet(g,1.9,1.08);safetyMat(g,2.27,.48,.90);
  box(g,2.21,.72,1.31,0,.62,0,C.teal,.065);
  box(g,2.18,.17,1.3,0,1.06,0,C.cream,.035);
  box(g,1.59,.04,.88,-.13,1.16,0,C.dark,.035);
  const bath=box(g,1.46,.025,.76,-.13,1.186,0,0x73c6e5,.015,glow(0x3da6c3,.28));
  g.userData.bath=bath;
  for(const x of [-.88,.70])box(g,.045,.84,.045,x,1.62,-.38,C.steel,.008);
  box(g,1.63,.045,.045,-.10,2.03,-.38,C.shiny,.008);
  const rack=new THREE.Group();rack.position.set(-.12,1.90,-.06);g.add(rack);
  box(rack,1.14,.035,.035,0,0,0,C.gold,.008);
  for(let i=0;i<4;i++){
    box(rack,.018,.41,.018,(i-1.5)*.25,-.21,0,C.steel,.003);
    cyl(rack,.075,.075,.12,(i-1.5)*.25,-.44,0,[0x5bbbd7,0xc985bc,0xefd17a,0x86ccb5][i],12);
  }
  g.userData.spindle=rack;g.userData.animated=[rack];
  panel(g,.91,1.40,.32,.32,.51);
  box(g,.044,.42,.09,-.83,.62,.71,C.gold,.012);
  vent(g,.51,.52,.672,.42,.25,5);
  hazard(g,-.42,.68,.672,.15);
  textPlate(g,'COLOR BATH',1.12,.14,-.12,.96,.672,{size:38});
  beacon(g,.91,1.75,-.44);
  g.userData.workPoint=new THREE.Vector3(-.1,1.37,.15);
}
function makeInspect(g) {
  bench(g,C.cream,2.3,1.35);safetyMat(g,2.4,.44,.88);
  box(g,1.16,.07,.87,-.22,1.15,.04,C.dark,.032);
  box(g,.51,.08,.49,-.58,1.23,-.16,C.cream,.035);
  cyl(g,.046,.046,.83,-.73,1.66,-.23,C.steel,12);
  box(g,.52,.085,.095,-.52,2.05,-.23,C.creamLight,.018);
  box(g,.12,.31,.16,-.28,1.92,-.23,C.navy,.035);
  cyl(g,.075,.085,.13,-.28,1.70,-.23,C.teal,16);
  const optic=cyl(g,.050,.050,.032,-.28,1.616,-.23,C.cyan,14,glow(C.cyan,.65));
  g.userData.spindle=optic;g.userData.animated=[optic];
  cyl(g,.16,.17,.04,-.29,1.27,-.19,C.shiny,20);
  box(g,.09,.43,.09,.75,1.39,-.41,C.navy,.012);
  box(g,.65,.49,.08,.75,1.81,-.37,C.navy,.035);
  box(g,.56,.39,.011,.75,1.81,-.320,C.cyan,.01,glow(0x79dfd2,.4));
  textPlate(g,'PASS / QC',.46,.105,.75,1.82,-.307,{color:'#defceb',bg:'#247b79',size:48});
  box(g,.49,.035,.19,.70,1.17,.31,C.creamDark,.012);
  for(let i=0;i<7;i++)box(g,.015,.009,.14,.51+i*.06,1.194,.31,C.navy,.001);
  tool(g,-.65,1.203,.35,1.0);
  box(g,.29,.015,.36,.18,1.16,.21,C.wood,.007);
  box(g,.25,.007,.30,.18,1.172,.21,C.creamLight,.002);
  for(let i=0;i<3;i++)box(g,.16,.003,.008,.18,1.177,.11+i*.065,C.tealDark,.001);
  beacon(g,1.00,1.18,-.46);
  textPlate(g,'INSPECTION',1.08,.13,0,.955,.694,{size:41});
  g.userData.workPoint=new THREE.Vector3(-.27,1.32,.13);
}
function makeMaterial(g) {
  feet(g,2.05,1.00);
  box(g,2.4,.19,1.32,0,.23,0,C.navy,.035);
  for(const x of [-1.08,1.08])for(const z of [-.52,.52])box(g,.11,1.96,.11,x,1.19,z,C.tealDark,.014);
  for(const y of [.44,1.11,1.79]) {
    box(g,2.30,.08,1.24,0,y,0,C.wood,.016);
    box(g,2.30,.085,.05,0,y+.01,.637,C.gold,.006);
  }
  for(let row=0;row<2;row++)for(let i=0;i<5-row;i++){
    const rod=cyl(g,.092,.092,.94,-.89+i*.195+row*.09,1.24+row*.17,.02,C.shiny,12);rod.rotation.x=Math.PI/2;
  }
  for(let i=0;i<3;i++)for(let j=0;j<2;j++)box(g,.33,.24,.38,.38+i*.20-j*.12,.62+j*.23,-.14+i*.1,C.steel,.025);
  for(let i=0;i<3;i++){
    box(g,.48,.30,.61,-.69+i*.64,1.96,-.03,C.creamDark,.018);
    box(g,.48,.035,.61,-.69+i*.64,2.08,-.03,C.shiny,.008);
  }
  textPlate(g,'RAW MATERIAL',1.30,.19,0,2.27,.08,{color:'#173b45',bg:'#e5c77e',size:44});
  box(g,1.40,.27,.075,0,2.26,.03,C.gold,.018);
  // Move label forward of its physical hanging placard.
  const label=g.children.find(c=>c.isMesh&&c.geometry?.type==='PlaneGeometry');if(label)label.position.z=.078;
  beacon(g,1.10,2.17,-.46);
  g.userData.workPoint=new THREE.Vector3(0,1.24,.40);
}
function carton(g,w,h,d,x,y,z,open=false) {
  box(g,w,h,d,x,y,z,0xba8a52,.015);
  box(g,w*.19,h+.007,d+.007,x,y,z,0xd3b176,.004);
  box(g,w*.31,h*.26,.009,x+w*.23,y+h*.04,z+d/2+.007,C.creamLight,.002);
  for(let i=0;i<5;i++)box(g,.014,h*.14,.012,x+w*.12+i*w*.042,y+h*.04,z+d/2+.013,C.navy,.001);
  if(open){
    box(g,w-.075,.022,d-.075,x,y+h/2+.006,z,C.dark,.003);
    const a=box(g,w,.02,d*.42,x,y+h*.55,z+d*.69,0xba8a52,.007);a.rotation.x=.28;
    const b=box(g,w,.02,d*.42,x,y+h*.55,z-d*.69,0xba8a52,.007);b.rotation.x=-.28;
  }
}
function makeShip(g) {
  bench(g,C.gold,2.4,1.30);safetyMat(g,2.46,.47,.92);
  box(g,2.26,.10,.89,0,1.18,.04,C.navy,.025);
  for(let i=0;i<11;i++) {
    const r=cyl(g,.052,.052,.76,-1.0+i*.2,1.263,.04,C.steel,12);r.rotation.x=Math.PI/2;
  }
  carton(g,.63,.47,.50,-.46,1.56,-.01,true);
  carton(g,.48,.34,.46,.45,.62,.02);
  box(g,.24,.15,.23,.85,1.31,-.36,C.cream,.025);
  box(g,.15,.012,.23,.85,1.395,-.29,C.creamLight,.003);
  box(g,.22,.07,.07,.85,1.46,-.19,C.teal,.008);
  textPlate(g,'SHIPPING',1.14,.15,0,.96,.674,{color:'#163b44',bg:'#eac16b',size:46});
  beacon(g,.99,1.19,-.47);
  g.userData.workPoint=new THREE.Vector3(-.46,1.68,0);
}
function makeBuffer(g) {
  bench(g,C.wood,1.8,1.2);
  box(g,1.05,.015,.72,-.18,1.135,0,C.tealDark,.025);
  box(g,.38,.055,.37,.65,1.15,-.18,C.creamLight,.02);
  tool(g,.64,1.199,.27,.5);
  textPlate(g,'WORK IN PROGRESS',1.34,.13,0,.96,.619,{color:'#efd99b',size:33});
  beacon(g,.74,1.18,-.42);
  g.userData.workPoint=new THREE.Vector3(-.18,1.19,0);
}
// Collapse immobile detail by material while retaining every declared animation pivot.
// This keeps the dense diorama inexpensive to render on integrated GPUs.
function batchStatic(root) {
  const protectedObjects=new Set();
  for(const value of Object.values(root.userData)) {
    if(value?.isObject3D)protectedObjects.add(value);
    else if(Array.isArray(value))for(const item of value)if(item?.isObject3D)protectedObjects.add(item);
  }
  const isProtected=node=>{
    for(let p=node;p&&p!==root;p=p.parent)if(protectedObjects.has(p))return true;
    return false;
  };
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets=new Map();
  root.traverse(node=>{
    if(!node.isMesh||Array.isArray(node.material)||isProtected(node))return;
    const key=`${node.material.uuid}/${node.castShadow}/${node.receiveShadow}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(node);
  });
  for(const meshes of buckets.values()) {
    if(meshes.length<2)continue;
    const transformed=meshes.map(mesh=>{
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
      return geometry;
    });
    const count=transformed.reduce((n,geo)=>n+geo.attributes.position.count,0);
    const merged=new THREE.BufferGeometry();
    for(const [name,size] of [['position',3],['normal',3],['uv',2]]) {
      if(!transformed.every(geo=>geo.attributes[name]))continue;
      const data=new Float32Array(count*size);let offset=0;
      for(const geometry of transformed){data.set(geometry.attributes[name].array,offset);offset+=geometry.attributes[name].array.length;}
      merged.setAttribute(name,new THREE.BufferAttribute(data,size));
    }
    merged.computeBoundingSphere();
    const mesh=new THREE.Mesh(merged,meshes[0].material);
    mesh.name='batched-shop-detail';mesh.castShadow=meshes[0].castShadow;mesh.receiveShadow=meshes[0].receiveShadow;
    for(const original of meshes)original.removeFromParent();
    for(const geometry of transformed)geometry.dispose();
    root.add(mesh);
  }
  return root;
}
export function createMachine(type) {
  const g=new THREE.Group();g.name=`station-${type}`;g.userData.type=type;
  ({lathe:makeLathe,mill:makeMill,deburr:makeDeburr,anodize:makeAnodize,inspect:makeInspect,material:makeMaterial,ship:makeShip,buffer:makeBuffer}[type]||makeBuffer)(g);
  return batchStatic(g);
}
export function createPart(stage=0,color=C.cyan,kind='shaft') {
  const g=new THREE.Group();g.name=`part-${kind}-${stage}`;
  const steel=mat(stage>=4?color:C.shiny,.27,.64);
  if(stage===0) {
    if(kind==='plate'||kind==='bracket'||kind==='block'||kind==='flange')box(g,.34,.19,.30,0,.11,0,C.steel,.017,steel);
    else {const b=cyl(g,.13,.13,.36,0,.145,0,C.steel,12,steel);b.rotation.z=Math.PI/2;}
  } else if(kind==='plate') {
    box(g,.40,.085,.31,0,.068,0,color,.012,steel);
    // Shallow recessed pocket with a machined rim and four drilled mounting holes.
    box(g,.20,.004,.125,0,.112,0,C.tealDark,.020,mat(stage>=4?color:0x68858d,.43,.55));
    box(g,.16,.004,.085,0,.115,0,C.steel,.015,steel);
    for(const x of [-.145,.145])for(const z of [-.10,.10]) {
      cyl(g,.031,.031,.004,x,.113,z,C.dark,12);
      cyl(g,.017,.017,.005,x,.117,z,C.rubber,12);
    }
  } else if(kind==='bracket'||kind==='block') {
    box(g,.37,.07,.31,0,.06,0,color,.013,steel);
    box(g,.10,.24,.31,-.135,.17,0,color,.016,steel);
    box(g,.13,.07,.09,.10,.11,-.105,color,.011,steel);
    for(const z of [-.09,.09])cyl(g,.035,.035,.003,.055,.10,z,C.dark,12);
    for(const z of [-.09,.09]){const hole=cyl(g,.03,.03,.006,-.078,.225,z,C.dark,12);hole.rotation.z=Math.PI/2;}
  } else if(kind==='flange'||kind==='hub') {
    cyl(g,.19,.19,.065,0,.057,0,color,24,steel);
    cyl(g,.108,.12,.18,0,.17,0,color,20,steel);
    cyl(g,.056,.056,.006,0,.264,0,C.dark,16);
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;cyl(g,.023,.023,.004,Math.cos(a)*.148,.092,Math.sin(a)*.148,C.dark,10);}
  } else {
    const p=new THREE.Group();p.rotation.z=Math.PI/2;p.position.y=.14;g.add(p);
    cyl(p,.075,.075,.43,0,0,0,color,20,steel);
    cyl(p,.13,.13,.09,0,-.09,0,color,20,steel);
    cyl(p,.105,.105,.06,0,.12,0,color,20,steel);
    for(let i=0;i<3;i++)cyl(p,.081,.081,.011,0,.166+i*.026,0,C.navy,16);
  }
  // Shipping-stage inspection seal is physically attached to the part.
  if(stage>=4)box(g,.055,.008,.055,.01,.31,.01,C.gold,.008);
  g.userData.stage=stage;return g;
}
export function createCharacter() {
  const g=new THREE.Group();g.name='machinist';
  const hips=box(g,.37,.24,.25,0,.48,0,C.orange,.08);
  const torso=box(g,.43,.44,.29,0,.76,0,C.orange,.10);
  box(g,.31,.16,.026,0,.79,.153,C.tealDark,.025);
  for(const x of [-.11,.11])box(g,.045,.27,.027,x,.88,.153,C.tealDark,.014);
  box(g,.15,.10,.025,0,.80,.18,C.teal,.014);
  box(g,.052,.016,.031,.046,.83,.199,C.gold,.004);
  box(g,.39,.055,.30,0,.54,0,C.navy,.014);
  box(g,.067,.063,.017,0,.54,.16,C.gold,.008);
  const limbs={};
  for(const side of [-1,1]) {
    // The hip and knee articulate independently. At zero rotation the two
    // trouser sections keep the original standing outline and ankle height.
    const leg=new THREE.Group();leg.name=side<0?'left-thigh':'right-thigh';leg.position.set(side*.105,.47,0);g.add(leg);
    box(leg,.15,.175,.18,0,-.0925,0,C.orange,.05);
    const knee=new THREE.Group();knee.name=side<0?'left-knee':'right-knee';knee.position.y=-.16;leg.add(knee);
    box(knee,.15,.125,.18,0,-.0525,0,C.orange,.038);
    const foot=new THREE.Group();foot.name=side<0?'left-foot':'right-foot';foot.position.set(0,-.18,.04);knee.add(foot);
    box(foot,.17,.105,.26,0,0,0,C.navy,.035);
    box(foot,.175,.025,.27,0,-.05,0,C.rubber,.008);
    limbs[side<0?'leftKnee':'rightKnee']=knee;limbs[side<0?'leftFoot':'rightFoot']=foot;
    const arm=new THREE.Group();arm.position.set(side*.245,.94,0);g.add(arm);
    box(arm,.14,.26,.16,side*.012,-.12,0,C.orange,.052);
    box(arm,.13,.08,.15,side*.012,-.255,0,C.tealDark,.024);
    sphere(arm,.081,side*.012,-.32,0,0xe5b88d,[.85,1,.85]);
    limbs[side<0?'leftLeg':'rightLeg']=leg;limbs[side<0?'leftArm':'rightArm']=arm;
  }
  cyl(g,.09,.10,.12,0,1.015,0,0xe5b88d,12);
  const head=new THREE.Group();head.position.set(0,1.20,0);g.add(head);
  sphere(head,.23,0,0,0,0xecc5a0,[.93,.96,.91]);
  sphere(head,.047,0,-.025,.207,0xe3b88e,[.8,.8,.7]);
  for(const x of [-.078,.078]){
    sphere(head,.021,x,.035,.192,C.navy,[.65,1,.40]);
    box(head,.05,.015,.015,x,.088,.18,C.tealDark,.005);
  }
  box(head,.056,.012,.012,0,-.079,.194,0x9d6753,.005);
  // Safety glasses sit in front of the eyes, with clear cyan-tinted lenses.
  const lensMat=new THREE.MeshPhysicalMaterial({color:0xaee8e7,transparent:true,opacity:.21,roughness:.1,metalness:.1,depthWrite:false});
  for(const x of [-.082,.082]){
    box(head,.145,.091,.022,x,.030,.206,C.cyan,.025,lensMat);
    box(head,.145,.012,.026,x,.080,.21,C.tealDark,.004);
  }
  box(head,.031,.014,.025,0,.030,.217,C.tealDark,.004);
  sphere(head,.236,0,.115,-.01,C.teal,[1,.56,1]);
  box(head,.40,.048,.24,0,.115,.12,C.teal,.035);
  box(head,.105,.065,.012,0,.177,.189,C.creamLight,.012);
  for(const side of [-1,1]){
    box(head,.07,.19,.15,side*.225,.032,-.01,C.navy,.035);
    box(head,.040,.13,.12,side*.267,.032,-.01,C.gold,.025);
  }
  tube(head,[[-.237,.085,-.035],[-.22,.28,-.035],[0,.32,-.035],[.22,.28,-.035],[.237,.085,-.035]],.021,C.navy);
  // A receiver at the right ear follows head motion during owner phone calls.
  // Its visibility is controlled by gameplay; the desk telephone remains separate.
  const callPhone=new THREE.Group();callPhone.name='machinist-call-phone';
  callPhone.position.set(.329,-.026,.056);head.add(callPhone);
  box(callPhone,.068,.244,.069,0,0,0,C.creamLight,.025);
  for(const y of [-.145,.145]) {
    box(callPhone,.110,.090,.117,-.006,y,-.005,C.creamLight,.034);
    box(callPhone,.012,.057,.072,-.063,y,-.005,C.tealDark,.017);
    for(let i=0;i<3;i++)box(callPhone,.015,.005,.036,-.071,y-.014+i*.014,-.005,C.navy,.002);
  }
  box(callPhone,.023,.12,.077,.039,0,0,C.gold,.011);
  callPhone.visible=false;
  callPhone.userData.restPosition=callPhone.position.clone();
  const carryAnchor=new THREE.Group();carryAnchor.position.set(0,.79,.42);g.add(carryAnchor);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.30,24),new THREE.MeshBasicMaterial({color:0x0a2330,transparent:true,opacity:.20,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;g.add(shadow);
  g.userData={...limbs,head,carryAnchor,torso,hips,callPhone,groundShadow:shadow};return g;
}
function plant(g,x,z,scale=1) {
  const p=new THREE.Group();p.position.set(x,0,z);p.scale.setScalar(scale);g.add(p);
  cyl(p,.24,.18,.38,0,.23,0,0xb78657,12);
  cyl(p,.249,.249,.055,0,.423,0,0xcdab74,12);
  cyl(p,.208,.208,.025,0,.43,0,C.dark,12);
  for(let i=0;i<7;i++){
    const a=i*2.399,r=.16+(i%2)*.10,h=.68+(i%3)*.16;
    tube(p,[[0,.43,0],[Math.cos(a)*r*.4,h*.80,Math.sin(a)*r*.4],[Math.cos(a)*r,h,Math.sin(a)*r]],.014,0x456f46);
    const leaf=sphere(p,.17,Math.cos(a)*r,h,Math.sin(a)*r,i%2?0x549360:0x79a663,[.42,1.55,.60]);leaf.rotation.z=-Math.cos(a)*.65;leaf.rotation.x=Math.sin(a)*.65;
  }
}
function office(parent) {
  const g=new THREE.Group();g.name='station-office';parent.add(g);
  // A walk-in office corner: low side partition, desk, glowing CAD terminal.
  box(g,3.26,.12,2.95,-7.09,.11,-4.44,0x52656b,.03);
  box(g,.14,1.14,2.54,-5.47,.71,-4.59,C.creamDark,.025);
  box(g,.19,.10,2.61,-5.47,1.33,-4.59,C.cream,.018);
  for(const x of [-8.18,-6.13])for(const z of [-5.11,-4.43])box(g,.11,.77,.11,x,.52,z,C.navy,.01);
  box(g,2.47,.12,1.10,-7.19,.965,-4.76,C.wood,.04);
  box(g,.58,.71,.73,-8.07,.56,-4.77,C.tealDark,.03);
  for(let i=0;i<3;i++){box(g,.51,.19,.028,-8.07,.34+i*.21,-4.384,C.teal,.008);box(g,.19,.025,.030,-8.07,.36+i*.21,-4.361,C.gold,.007);}
  box(g,.09,.38,.09,-7.14,1.19,-5.02,C.navy,.01);
  box(g,.98,.62,.09,-7.14,1.56,-5.04,C.navy,.036);
  const monitorScreen=box(g,.87,.51,.012,-7.14,1.56,-4.987,C.cyan,.012,glow(0x5bd5d0,.6));
  const monitorLight=box(g,.035,.014,.014,-6.75,1.278,-4.982,C.cyan,.004,glow(C.cyan,.7));
  textPlate(g,'CHIP / RUSH',.76,.17,-7.14,1.61,-4.976,{color:'#efffe8',bg:'#36a9af',size:49});
  box(g,.65,.04,.26,-7.15,1.058,-4.52,C.creamDark,.01);
  for(let i=0;i<8;i++)box(g,.019,.008,.20,-7.40+i*.073,1.083,-4.52,C.tealDark,.001);
  box(g,.33,.012,.43,-7.82,1.039,-4.60,C.creamLight,.003);
  for(let i=0;i<4;i++)box(g,.22,.004,.011,-7.82,1.048,-4.75+i*.07,C.tealDark,.001);
  cyl(g,.09,.075,.15,-6.40,1.11,-4.49,C.cream,16);
  cyl(g,.063,.063,.007,-6.40,1.189,-4.49,0x644627,16);
  tube(g,[[-6.37,1.10,-4.49],[-6.25,1.09,-4.49],[-6.25,1.18,-4.49],[-6.37,1.18,-4.49]],.018,C.cream);
  // A compact desk telephone: the whole phone and handset keep their own pivots.
  const phone=new THREE.Group();phone.name='office-telephone';phone.position.set(-7.91,1.052,-5.055);g.add(phone);
  box(phone,.43,.095,.36,0,.025,0,C.creamLight,.035);
  box(phone,.33,.021,.245,0,.082,.027,C.creamDark,.014);
  box(phone,.16,.013,.050,0,.099,-.042,C.teal,.008,glow(C.teal,.08));
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)
    box(phone,.044,.016,.031,(col-1)*.072,.104,.025+row*.047,row===2&&col===2?C.gold:C.navy,.007);
  for(const x of [-.148,.148])box(phone,.044,.075,.055,x,.119,-.112,C.cream,.012);
  const handset=new THREE.Group();handset.name='telephone-handset';handset.position.set(0,.166,-.107);phone.add(handset);
  box(handset,.35,.058,.069,0,.020,0,C.tealDark,.023);
  for(const x of [-.174,.174]) {
    box(handset,.09,.092,.134,x,-.008,0,C.navy,.031);
    for(let i=0;i<3;i++)box(handset,.035,.005,.008,x,-.055,-.027+i*.027,C.creamDark,.002);
  }
  tube(phone,[[.19,.146,-.10],[.268,.107,-.08],[.25,-.025,.013],[.269,-.070,.10],[.207,-.060,.135]],.014,C.navy);
  phone.userData.handset=handset;
  phone.userData.ringAnchor=handset;
  phone.userData.restPosition=phone.position.clone();
  // Task lamp and warm miniature pool.
  cyl(g,.14,.16,.04,-6.24,1.05,-5.03,C.gold,16);
  tube(g,[[-6.24,1.07,-5.03],[-6.18,1.63,-5.03],[-6.48,1.82,-4.94]],.025,C.gold);
  const shade=cyl(g,.06,.17,.15,-6.48,1.75,-4.94,C.gold,16);shade.rotation.z=-.2;
  cyl(g,.14,.14,.01,-6.465,1.679,-4.94,C.creamLight,16,glow(0xffdf9a,.7));
  // The swivel chair tucks under the desk. Cushion top is Y=.695; the
  // seated character root is Y=.335, placing its hips bottom on the cushion.
  // The low foot ring supports the miniature machinist's bent legs.
  const chairX=-7.11,chairZ=-4.00;
  cyl(g,.042,.048,.37,chairX,.39,chairZ,C.steel,10);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const b=box(g,.065,.04,.38,chairX+Math.sin(a)*.16,.20,chairZ+Math.cos(a)*.16,C.navy,.012);b.rotation.y=a;}
  box(g,.57,.13,.56,chairX,.63,chairZ,C.navy,.07);
  box(g,.55,.51,.11,chairX,.92,chairZ+.31,C.tealDark,.075);
  tube(g,Array.from({length:17},(_,i)=>[chairX+Math.sin(i*Math.PI/8)*.23,.541,chairZ+Math.cos(i*Math.PI/8)*.23]),.018,C.steel);
  // Corkboard and office sign on the back wall.
  box(g,1.40,.74,.07,-7.10,2.14,-5.82,C.wood,.018);
  box(g,1.27,.61,.016,-7.10,2.14,-5.775,0xbda678,.005);
  for(let i=0;i<4;i++){const sheet=box(g,.22,.30,.012,-7.54+i*.28,2.13+(i%2)*.05,-5.76,[C.creamLight,0xd8e2c1,0xd5a76d,C.cream][i],.003);sheet.rotation.z=(i-1.5)*.05;sphere(g,.02,-7.54+i*.28,2.25+(i%2)*.05,-5.745,C.teal,[1,1,.5]);}
  plant(g,-8.28,-3.39,.83);
  textPlate(g,'FRONT OFFICE',1.65,.19,-7.09,2.84,-5.86,{color:'#e8dcb5',bg:'#294c57',size:44});
  // Give the existing office a useful station-local origin, without moving its art.
  const origin=new THREE.Vector3(-7.1,0,-4.65);
  for(const child of g.children)child.position.sub(origin);
  g.position.copy(origin);
  phone.userData.restPosition.copy(phone.position);
  g.userData={
    type:'office',phone,handset,monitorScreen,screen:monitorScreen,
    screenMaterial:monitorScreen.material,statusLight:monitorLight,
    workPoint:new THREE.Vector3(-.05,1.08,0),
    accessPoint:new THREE.Vector3(-.7,0,1.47),
    // Station-local character root; world (-7.11,.335,-4.03). +Z faces the
    // desk after yaw PI. Seated pose: hip X=-PI/2, knee X=+PI/2.
    seatPoint:new THREE.Vector3(-.01,.335,.62),seatYaw:Math.PI,
  };
  batchStatic(g);
  return g;
}
export function createWorkshop() {
  const g=new THREE.Group();g.name='workshop-diorama';
  // A compact production cell: material and office to the left, machining at
  // the rear, then quality and outbound along the right-hand side.
  // Shell bounds: X [-9.25, 8.15], Z [-6.25, 3.85].
  box(g,17.40,.42,10.10,-.55,-.27,-1.20,C.navy,.16);
  box(g,17.0,.075,9.70,-.55,-.025,-1.20,0x4e6971,.02).castShadow=false;
  // Subtle concrete tiles with narrow recessed grout, not a drawn floor.
  const floorMats=[0x506b73,0x4d6971,0x526e75,0x4b676f].map(c=>mat(c,.93));
  for(let x=0;x<12;x++)for(let z=0;z<7;z++)
    box(g,1.397,.035,1.367,-8.305+x*1.41,.021,-5.34+z*1.38,0,.006,floorMats[(x*7+z*3)%4]).castShadow=false;
  // Back and left walls are cut away at the player-facing sides.
  box(g,17.20,3.08,.20,-.55,1.54,-6.12,C.tealDark,.035);
  box(g,.20,2.46,9.82,-9.12,1.23,-1.21,C.tealDark,.035);
  box(g,17.34,.12,.26,-.55,3.13,-6.12,C.navy,.015);
  box(g,.26,.12,9.91,-9.12,2.50,-1.205,C.navy,.015);
  box(g,17.15,.17,.11,-.55,.14,-5.968,C.navy,.008);
  box(g,.11,.17,9.70,-8.968,.14,-1.21,C.navy,.008);
  for(let i=0;i<9;i++) {
    const x=-8.10+i*1.8875;
    box(g,.071,2.81,.061,x,1.59,-5.99,0x36616a,.004);
    box(g,1.73,.86,.055,x,1.93,-5.993,0x265560,.004);
  }
  for(let i=0;i<5;i++) {
    const z=-5.02+i*1.94;
    box(g,.065,2.15,.065,-8.99,1.30,z,0x36616a,.004);
  }
  // Wall-mounted practical light fixtures make the scene feel like a small real shop.
  for(const x of [-7,-3.5,0,3.5,6.75]) {
    box(g,2.0,.19,.27,x,2.81,-5.87,C.navy,.023);
    box(g,1.80,.07,.29,x,2.755,-5.84,C.creamLight,.015,glow(0xd8f6e7,.8));
    box(g,.045,.35,.04,x-.77,2.63,-5.90,C.steel,.005);
    box(g,.045,.35,.04,x+.77,2.63,-5.90,C.steel,.005);
  }
  // Real pipes/conduit and breaker box, with measured, restrained detail.
  tube(g,[[-8.8,.66,-5.87],[-3.80,.66,-5.87],[-3.65,.82,-5.87],[-3.65,2.51,-5.87],[7.70,2.51,-5.87]],.037,C.navy);
  tube(g,[[7.52,.15,-5.86],[7.52,1.4,-5.86],[7.82,1.4,-5.86]],.034,C.steel);
  box(g,.69,.96,.19,-4.49,1.96,-5.84,C.navy,.033);
  box(g,.58,.79,.04,-4.49,1.96,-5.72,C.creamDark,.02);
  hazard(g,-4.49,2.03,-5.69,.13);
  box(g,.028,.20,.032,-4.27,1.98,-5.687,C.dark,.005);
  // Perimeter and right-hand quality/outbound bay. The broken inner edge
  // keeps station access clear and communicates one coherent work area.
  for(const z of [-5.47,3.26])box(g,16.20,.008,.055,-.55,.048,z,C.gold,.002).castShadow=false;
  for(const x of [-8.62,7.52])box(g,.055,.008,8.73,x,.048,-1.105,C.gold,.002).castShadow=false;
  for(const z of [-3.82,2.64])box(g,3.05,.008,.038,5.95,.053,z,C.creamDark,.002).castShadow=false;
  for(const z of [-3.55,-2.65,-1.75,-.85,.05,.95,1.85,2.40])
    box(g,.045,.008,.32,4.43,.053,z,C.creamDark,.002).castShadow=false;
  box(g,3.05,.008,.038,5.95,.053,-.52,C.creamDark,.002).castShadow=false;
  // Flush service drains stay against the walls rather than in the aisle.
  for(const [x,z] of [[-8.04,.44],[7.21,-1.14],[7.21,2.92]]) {
    box(g,.49,.014,.53,x,.047,z,C.navy,.015).castShadow=false;
    for(let i=0;i<5;i++)box(g,.36,.010,.023,x,.056,z-.17+i*.085,C.steel,.003).castShadow=false;
  }
  g.userData.office=office(g);
  g.userData.phone=g.userData.office.userData.phone;
  plant(g,7.48,-3.96,.90);plant(g,-8.31,2.88,.84);
  // Tool storage belongs beside the machining cell, rather than in outbound.
  box(g,1.42,.95,.055,2.73,1.97,-5.94,C.navy,.025);
  for(let x=0;x<7;x++)for(let y=0;y<4;y++){
    const hole=cyl(g,.011,.011,.008,2.14+x*.195,1.65+y*.19,-5.903,C.steel,6);hole.rotation.x=Math.PI/2;
  }
  for(let i=0;i<4;i++) {
    box(g,.030,.35+i*.035,.036,2.31+i*.25,1.99,-5.864,C.shiny,.01);
    const wrench=cyl(g,.065,.065,.032,2.31+i*.25,2.17+i*.018,-5.864,C.shiny,6);wrench.rotation.x=Math.PI/2;
    box(g,.054,.16,.06,2.31+i*.25,1.74,-5.856,i%2?C.gold:C.teal,.014);
  }
  // A few sealed cartons and their pallet make outbound feel occupied without
  // introducing another station or placing furniture in the central route.
  const packing=new THREE.Group();packing.name='outbound-packing';packing.position.set(6.95,0,-4.94);g.add(packing);
  for(const x of [-.48,.48])box(packing,.15,.12,.84,x,.10,0,C.wood,.014);
  for(const z of [-.29,0,.29])box(packing,1.35,.07,.22,0,.195,z,0xb78a56,.012);
  function carton(w,h,d,x,y,z) {
    box(packing,w,h,d,x,y,z,0xb99164,.035);
    box(packing,.065,.009,d+.006,x,y+h/2+.005,z,0xddc69d,.002);
    box(packing,.065,h-.018,.010,x,y,z+d/2+.008,0xddc69d,.002);
    box(packing,w*.29,h*.29,.013,x-w*.21,y+h*.04,z+d/2+.018,C.creamLight,.003);
    for(let i=0;i<3;i++)box(packing,w*.17,.009,.003,x-w*.21,y+h*.09-i*.028,z+d/2+.027,C.tealDark,.001);
  }
  carton(.59,.57,.69,-.34,.515,.005);
  carton(.59,.44,.69,.32,.45,.005);
  carton(.49,.36,.55,.31,.853,-.025);
  textPlate(g,'QUALITY  /  OUTBOUND',2.61,.25,5.85,2.17,-5.837,{color:'#e8dcb5',bg:'#294c57',size:34});
  // Safety cabinet and extinguisher live against walls rather than in circulation.
  box(g,.61,1.44,.35,7.50,.79,-5.70,C.cream,.045);
  box(g,.52,1.23,.027,7.50,.83,-5.507,C.creamLight,.018);
  textPlate(g,'FIRST AID',.43,.12,7.50,1.11,-5.482,{color:'#2e776d',bg:'#f4efdc',size:38});
  box(g,.20,.055,.015,7.50,.83,-5.479,C.teal,.004);box(g,.055,.20,.015,7.50,.83,-5.474,C.teal,.004);
  const extinguisher=new THREE.Group();extinguisher.position.set(-8.79,0,.96);g.add(extinguisher);
  cyl(extinguisher,.13,.13,.51,0,.69,0,0xcc6651,14);sphere(extinguisher,.13,0,.945,0,0xcc6651,[1,.58,1]);
  box(extinguisher,.07,.08,.07,0,1.04,0,C.navy,.006);box(extinguisher,.21,.033,.055,.035,1.09,0,C.navy,.006);
  tube(extinguisher,[[.055,1.05,.01],[.21,1.01,.04],[.21,.65,.05]],.022,C.rubber);
  // Office and workshop windows catch the daylight as dimensional frames.
  for(const z of [-4.55,-1.70,1.20]) {
    box(g,.075,.95,1.94,-8.985,1.78,z,C.navy,.015);
    box(g,.013,.83,1.79,-8.939,1.78,z,0x577e88,.003,mat(0x577e88,.20,.25));
    box(g,.025,.90,.044,-8.925,1.78,z,C.creamDark,.004);
    box(g,.025,.045,1.82,-8.924,1.78,z,C.creamDark,.004);
  }
  return batchStatic(g);
}
