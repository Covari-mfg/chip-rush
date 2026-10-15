import * as THREE from '../vendor/three.module.js';

// Last Light: original procedural diorama. The sea is presentation; the quay,
// cargo and tender all follow BeaconGame's state, never the other way around.
const C={ink:0x183745,navy:0x163343,teal:0x2a7b7c,cream:0xeee1c1,wood:0xb18a62,gold:0xf5ce84,rust:0xbc6a51};
const materials=new Map(),shapes=new Map();
function mat(color,metal=0){const key=`${color}/${metal}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.3:.7,metalness:metal}));return materials.get(key);}
function mesh(g,geometry,color,x,y,z,material){const m=new THREE.Mesh(geometry,material||mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function box(g,w,h,d,x,y,z,c){const key=`${w},${h},${d}`;if(!shapes.has(key))shapes.set(key,new THREE.BoxGeometry(w,h,d));return mesh(g,shapes.get(key),c,x,y,z);}
function cyl(g,a,b,h,x,y,z,c,n=24){return mesh(g,new THREE.CylinderGeometry(a,b,h,n),c,x,y,z);}
function ring(g,r,t,x,y,z,c){const m=mesh(g,new THREE.TorusGeometry(r,t,6,32),c,x,y,z);m.rotation.x=Math.PI/2;return m;}
function glow(color,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1});}
function line(g,points,c,opacity=.5){const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Line(geo,new THREE.LineBasicMaterial({color:c,transparent:true,opacity}));g.add(m);return m;}
function sign(g,text,w,h,x,y,z,color='#f2d6a0',bg='#1d4550'){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,192);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 80px sans-serif';ctx.fillText(text,512,101,990);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return mesh(g,new THREE.PlaneGeometry(w,h),C.cream,x,y,z,new THREE.MeshBasicMaterial({map:texture}));
}
function lantern(g,x,y,z){cyl(g,.12,.15,.07,x,y-.16,z,C.ink,12);mesh(g,new THREE.CylinderGeometry(.105,.105,.25,12),C.gold,x,y,z,glow(C.gold));cyl(g,0,.18,.12,x,y+.19,z,C.ink,12);}
function boat(color=0xdfaa6e,small=false){
  const g=new THREE.Group(),hull=new THREE.Shape();hull.moveTo(0,-1.2);hull.quadraticCurveTo(.68,-.75,.56,.8);hull.quadraticCurveTo(0,1.12,-.56,.8);hull.quadraticCurveTo(-.68,-.75,0,-1.2);
  const geo=new THREE.ExtrudeGeometry(hull,{depth:.29,bevelEnabled:true,bevelSize:.07,bevelThickness:.035,bevelSegments:1,steps:1,curveSegments:8});geo.rotateX(-Math.PI/2);
  const hullMesh=mesh(g,geo,color,0,0,0);hullMesh.name='boat-hull';const deck=box(g,.88,.1,1.6,0,.43,.05,C.wood);deck.name='boat-deck';box(g,.7,.54,.58,0,.75,.35,C.cream);box(g,.76,.08,.65,0,1.06,.35,C.teal);box(g,.43,.21,.015,0,.84,.047,C.navy);cyl(g,.025,.025,.9,-.35,.95,.35,C.ink,8);lantern(g,-.35,1.31,.35);ring(g,.15,.045,.45,.48,.3,C.cream);
  const cargo=new THREE.Group();cargo.position.set(0,.48,-.45);g.add(cargo);g.userData.cargo=cargo;
  for(let i=0;i<3;i++){const crate=box(cargo,.28,.24,.28,(i-1)*.29,0,0,C.gold);crate.visible=false;}
  line(g,[[-.52,-.16,1.1],[-.24,-.16,1.65],[0,-.16,1.9],[.24,-.16,1.65],[.52,-.16,1.1]],0xc7e2de,.5);
  g.traverse(node=>{if(node.isMesh)node.receiveShadow=false;});
  if(small)g.scale.setScalar(.8);return g;
}

export function createHarbor(){
  const g=new THREE.Group();g.name='last-light-harbor';
  const shell=new THREE.Group();g.add(shell);
  // A working pier on piles. The edges are physical visual boundaries.
  box(shell,18.6,.48,12,-.7,-.3,-.7,C.ink);
  for(let i=0;i<48;i++)box(shell,18.4,.08,.235,-.7,-.015,-6.5+i*.245,i%4?0xa98964:0x9b7958);
  for(const x of [-9.25,-5,0,5,8.55])for(const z of [-6.2,4.9]){cyl(shell,.22,.27,2,x,-1,z,C.wood,12);cyl(shell,.27,.27,.12,x,-.35,z,C.ink,12);}
  // Open-front corrugated workshop; no roof to hide the work.
  box(shell,18.5,.3,.25,-.7,2.85,-6.55,C.cream);box(shell,18.5,.22,.18,-.7,.8,-6.55,C.teal);
  for(let i=0;i<60;i++)box(shell,.25,2.35,.12,-9.55+i*.307,1.52,-6.62,i%2?0x638b88:0x779d94);
  for(const x of [-9.6,-.5,8.55]){box(shell,.18,3.2,.2,x,1.6,-6.35,C.ink);box(shell,.13,3.2,.2,x,1.6,4.9,C.teal);}
  for(const x of [-9.6,8.55]){box(shell,.13,.12,11.4,x,3.2,-.7,C.teal);box(shell,.08,.1,11.4,x,1.03,-.7,C.ink);}
  // Rope fence and brass bollards along the open quay.
  for(const x of [-8.9,-5.5,-2,1.4,4.8]){cyl(shell,.09,.12,1,x,.5,4.85,C.teal,12);cyl(shell,.13,.13,.08,x,1.02,4.85,C.gold,12);}
  line(shell,[[-8.9,.83,4.85],[-5.5,.68,4.85],[-2,.83,4.85],[1.4,.68,4.85],[4.8,.83,4.85]],C.cream,.9);
  sign(shell,'HARBOR WORKS',4.7,.58,-3.2,2.3,-6.43);
  sign(shell,'LIGHTHOUSE · 6 PARTS',4.2,.45,4.4,2.3,-6.43,'#ffda8a');
  const progressLamps=[];for(let i=0;i<6;i++){const lamp=mesh(shell,new THREE.SphereGeometry(.11,12,8),C.gold,2.85+i*.6,1.8,-6.38,glow(0x37545b));progressLamps.push(lamp);}
  // Catenary lamps, copper pipework, reels, float rings and dock furniture.
  const cable=[];for(let i=0;i<=30;i++){const x=-9.5+i*.6,y=3.6-.65*Math.sin(i/30*Math.PI);cable.push([x,y,-3.9]);if(i%3===1)lantern(shell,x,y-.19,-3.9);}line(shell,cable,C.ink,1);
  for(const x of [-8.8,7.4]){const hoop=ring(shell,.36,.09,x,1.32,-6.38,C.rust);hoop.rotation.x=0;for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const band=box(hoop,.14,.1,.19,Math.sin(a)*.36,Math.cos(a)*.36,0,C.cream);band.rotation.z=-a;}}
  for(let i=0;i<4;i++){cyl(shell,.32,.32,.55,-8.5+i*.7,.3,-5.4,i%2?C.teal:C.cream,16);}
  for(let i=0;i<7;i++)box(shell,.085,.018,7,-4.4+i*1.55,.045,-.25,0xd8bb84);
  // The water has low-poly swell and scattered warm reflections.
  const seaGeo=new THREE.PlaneGeometry(80,70,40,35);seaGeo.rotateX(-Math.PI/2);
  const sea=mesh(g,seaGeo,0x277f87,3,-.72,-7,new THREE.MeshStandardMaterial({color:0x276e7d,roughness:.32,metalness:.32,flatShading:true}));sea.castShadow=false;
  const duskSea=new THREE.Color(0x163952);
  const positions=seaGeo.attributes.position,baseline=Float32Array.from(positions.array);
  const glints=new THREE.Group();g.add(glints);
  for(let i=0;i<115;i++){const x=Math.sin(i*127.1)*27+6,z=Math.cos(i*73.7)*21-6;const m=box(glints,.18+(i%8)*.18,.008,.025,x,-.55,z,i%4?0x60acaa:C.gold);m.castShadow=m.receiveShadow=false;}
  // A lighthouse on a basalt island, just across from the shop.
  const island=new THREE.Group();island.position.set(11,-.3,-6.2);island.scale.setScalar(.76);g.add(island);
  for(let i=0;i<11;i++){const a=i*2.4,r=1.4+(i%3)*.5;const rock=mesh(island,new THREE.DodecahedronGeometry(.8+(i%4)*.2,0),i%2?0x426573:0x355362,Math.cos(a)*r,-.1,Math.sin(a)*r);rock.scale.y=.6;}
  cyl(island,2.1,2.8,.4,0,.1,0,0x809894,32);cyl(island,1.48,1.65,.25,0,.45,0,C.cream,32);
  cyl(island,.77,1.14,5.5,0,3.25,0,C.cream,32);cyl(island,1.073,1.12,.68,0,1.5,0,C.rust,32);cyl(island,.95,1.00,.68,0,3.6,0,C.rust,32);
  for(const y of [1.1,2.6,4.4]){box(island,.23,.4,.07,0,y,1.02-y*.05,C.ink);}
  cyl(island,1.25,1.15,.2,0,6.05,0,C.teal,32);ring(island,1.17,.035,0,6.5,0,C.cream);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;cyl(island,.025,.025,.48,Math.cos(a)*1.17,6.28,Math.sin(a)*1.17,C.cream,6);}
  const glass=mesh(island,new THREE.CylinderGeometry(.77,.77,1.18,16,1,true),C.gold,0,6.73,0,new THREE.MeshStandardMaterial({color:0x9ebfb7,transparent:true,opacity:.25,roughness:.2,metalness:.35,side:THREE.DoubleSide,depthWrite:false}));
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(island,.035,.035,1.25,Math.cos(a)*.79,6.72,Math.sin(a)*.79,C.ink,8);}
  cyl(island,0,1.06,.9,0,7.77,0,C.teal,16);cyl(island,.05,.05,.8,0,8.48,0,C.gold,8);
  const lens=new THREE.Group();lens.position.y=6.7;island.add(lens);
  const panels=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,material=glow(0xffdb94,.55),m=mesh(lens,new THREE.BoxGeometry(.39,.74,.04),C.gold,Math.sin(a)*.7,0,Math.cos(a)*.7,material);m.rotation.y=a;m.visible=false;panels.push(m);}
  const ribs=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,m=mesh(lens,new THREE.TorusGeometry(.49,.045,6,24,Math.PI),C.gold,Math.cos(a)*.08,0,Math.sin(a)*.08);m.rotation.y=a;m.rotation.z=Math.PI/2;m.visible=false;ribs.push(m);}
  const lamp=mesh(lens,new THREE.SphereGeometry(.29,16,12),C.gold,0,0,0,glow(0xffe4ab));lamp.visible=false;
  const beamRoot=new THREE.Group();beamRoot.position.y=6.7;island.add(beamRoot);
  const beamMaterial=new THREE.MeshBasicMaterial({color:0xffdca0,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  for(const angle of [0,Math.PI]){const beam=new THREE.Mesh(new THREE.ConeGeometry(3.6,21,32,1,true),beamMaterial);beam.rotation.x=-Math.PI/2;beam.position.z=10.6;const arm=new THREE.Group();arm.rotation.y=angle;arm.add(beam);beamRoot.add(arm);}beamRoot.visible=false;
  const beaconLight=new THREE.PointLight(0xffd89a,0,15,2);beaconLight.position.set(0,6.7,0);island.add(beaconLight);
  const workLight=new THREE.PointLight(0xffd1a0,7,17,2);workLight.position.set(-2,4,-2.7);g.add(workLight);
  const halo=mesh(lens,new THREE.SphereGeometry(.58,16,12),C.gold,0,0,0,glow(C.gold,.14));halo.visible=false;
  const docked={x:9.5,z:1.15},destination={x:10.3,z:-4.3};
  const tender=boat();tender.position.set(docked.x,-.38,docked.z);tender.rotation.y=Math.PI/2;g.add(tender);
  const quayCargo=new THREE.Group();g.add(quayCargo);for(let i=0;i<3;i++)box(quayCargo,.48,.48,.5,7.9,.34,1.1+(i-1)*.64,i%2?C.teal:C.gold);
  // Each installed part guides a fishing boat past the working quay.
  const fleet=[];for(let i=0;i<12;i++){const b=boat([0xc17b59,0x5a9991,0xd2b76f,0x628aab,0xc5c7af][i%5],true);b.position.set(-12+(i%5)*4.5,-.38,-11.5-Math.floor(i/5)*3);b.rotation.y=1.0;g.add(b);fleet.push({mesh:b,x:b.position.x,z:b.position.z});}
  // Distant headlands and the last copper sliver of sun.
  for(let i=0;i<13;i++){const rock=mesh(g,new THREE.ConeGeometry(2.9+(i%4),1.9+(i%3),5),0x315467,-27+i*4.6,-.7,-24-(i%3));rock.rotation.y=i;rock.castShadow=false;}
  const sun=mesh(g,new THREE.SphereGeometry(1.8,24,16),0xffc78a,-12,2.7,-25,glow(0xf0ba83));sun.scale.z=.15;
  const gulls=[];for(let i=0;i<5;i++){const b=new THREE.Group();const wings=[line(b,[[-.28,0,0],[0,.08,0],[.28,0,0]],0xe7e4cd,.8)];b.position.set(-8+i*4,5+i*.2,-9-i);g.add(b);gulls.push(b);}
  g.userData.framePoints=[new THREE.Vector3(-10,0,5),new THREE.Vector3(16,0,4),new THREE.Vector3(14,8.7,-10),new THREE.Vector3(-10,3.7,-7)];
  g.userData.tender=tender;g.userData.lens=lens;g.userData.ribs=ribs;g.userData.fleet=fleet;
  const buoys=[];for(const z of [-.7,2.5]){const buoy=new THREE.Group();buoy.position.set(9.2,-.42,z);cyl(buoy,.19,.27,.3,0,.15,0,C.ink,12);const light=mesh(buoy,new THREE.SphereGeometry(.12,10,8),C.gold,0,.55,0,glow(0xefa16d));g.add(buoy);buoys.push(light);}
  g.userData.update=(game,dt,time,finale=0)=>{
    const installed=game?.shipped??0,lit=installed>=(game?.config?.passTarget??6);
    ribs.forEach((m,i)=>m.visible=i<installed);panels.forEach((m,i)=>m.visible=i<installed);progressLamps.forEach((lamp,i)=>lamp.material.color.set(i<installed?0xffd789:0x37545b));beaconLight.intensity=installed?2+installed:0;beamMaterial.opacity=.03+installed*.005;sea.material.color.set(0x276e7d).lerp(duskSea,Math.min(1,(game?.elapsed??0)/(game?.config?.duration??220)));lamp.visible=halo.visible=beamRoot.visible=installed>0;beamRoot.rotation.y=lit?time*.3:-1.2;buoys.forEach(light=>light.material.color.set(game?.window?.open?0x9ff0cb:0xeb936b));lens.rotation.y=time*.08;
    for(let i=0;i<positions.count;i++){const x=baseline[i*3],z=baseline[i*3+2];positions.setY(i,Math.sin(x*.5+time*.55)*.09+Math.sin(z*.65-time*.42)*.055);}positions.needsUpdate=true;
    glints.children.forEach((m,i)=>{m.scale.x=.7+Math.sin(time*.7+i)*.4;m.visible=Math.sin(i+time*.35)>-.45;});
    const state=game?.tender??{phase:'docked',remaining:0,cargo:[]},f=state.phase==='outbound'?1-state.remaining/12:state.phase==='returning'?state.remaining/12:0;
    const bend=Math.sin(f*Math.PI)*1.5;tender.position.set(THREE.MathUtils.lerp(docked.x,destination.x,f)+bend,-.37+Math.sin(time*2.1)*.035,THREE.MathUtils.lerp(docked.z,destination.z,f));const direction=state.phase==='returning'?-1:1;tender.rotation.y=Math.atan2(-(destination.x-docked.x+Math.cos(f*Math.PI)*Math.PI*1.5)*direction,-(destination.z-docked.z)*direction);tender.rotation.z=Math.sin(time*1.4)*.025;
    tender.userData.cargo.children.forEach((m,i)=>m.visible=i<state.cargo.length);quayCargo.children.forEach((m,i)=>m.visible=i<(game?.quay?.length??0));
    for(const [i,b] of fleet.entries()){
      const arrival=game?.installed?.[i]?.arrived,age=arrival===undefined?0:Math.max(0,(game.elapsed-arrival)+finale),lane=9.1+(i%3)*.5;
      let x=b.x+Math.sin(time*.04+i)*.18,z=b.z,dx=0,dz=0;
      if(arrival!==undefined){
        if(age<10){const t=age/10;x=THREE.MathUtils.lerp(b.x,lane,t);z=THREE.MathUtils.lerp(b.z,-7,t);dx=lane-b.x;dz=-7-b.z;}
        else if(age<28){x=lane;z=-7+(age-10)/18*13;dz=1;}
        else{x=lane-(age-28)*1.25;z=6+(age-28)*.14;dx=-1.25;dz=.14;}
      }
      b.mesh.visible=age<54;b.mesh.position.set(x,-.38+Math.sin(time*1.7+i)*.03,z);if(dx||dz)b.mesh.rotation.y=Math.atan2(-dx,-dz);b.mesh.rotation.z=Math.sin(time+i)*.018;
    }
    gulls.forEach((b,i)=>{b.position.x=-8+i*4+Math.sin(time*.07+i)*2;b.position.y=5+i*.2+Math.sin(time*.8+i)*.15;});
  };
  return g;
}
