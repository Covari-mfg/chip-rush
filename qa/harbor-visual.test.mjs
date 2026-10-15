import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createHarbor, tenderPose, fishingBoatPose } from '../dist/assets/harbor.js';

test('every boat has separated hull/deck surfaces and avoids receiving self-shadows',()=>{
  const harbor=createHarbor();let boats=0;
  harbor.traverse(node=>{
    if(node.name!=='boat-hull')return;
    boats++;
    const deck=node.parent.getObjectByName('boat-deck');
    node.geometry.computeBoundingBox();deck.geometry.computeBoundingBox();
    assert.ok(node.position.y+node.geometry.boundingBox.max.y<deck.position.y+deck.geometry.boundingBox.min.y);
    node.parent.traverse(part=>{if(part.isMesh)assert.equal(part.receiveShadow,false);});
  });
  assert.equal(boats,13);
});

test('an installed part sends a fishing boat past the quay during play',()=>{
  const harbor=createHarbor(),fleet=harbor.userData.fleet;
  const game={elapsed:32,shipped:1,installed:[{arrived:32}],config:{duration:220,passTarget:6},window:{open:false},quay:[],tender:{phase:'docked',remaining:0,cargo:[]}};
  harbor.userData.update(game,.1,32);
  const before=fleet[0].mesh.position.clone(),waiting=fleet[1].mesh.position.clone();
  game.elapsed=47;harbor.userData.update(game,.1,32);
  assert.ok(before.distanceTo(fleet[0].mesh.position)>5);
  assert.equal(waiting.distanceTo(fleet[1].mesh.position),0);
  assert.ok(fleet[0].mesh.visible);
  game.elapsed=90;harbor.userData.update(game,.1,32);
  assert.equal(fleet[0].mesh.visible,false);
  assert.ok(new THREE.Box3().setFromObject(harbor).isEmpty()===false);
});

test('the pointed bow faces local -Z, with its wake behind the stern',()=>{
  const boat=createHarbor().userData.tender,hull=boat.getObjectByName('boat-hull');
  hull.geometry.computeBoundingBox();
  assert.ok(hull.geometry.boundingBox.min.z<-1.2,'The pointed end is the forward end');
  assert.ok(hull.geometry.boundingBox.max.z<1.15,'The wider stern is aft');
  const wake=boat.userData.wake.geometry.attributes.position;
  for(let i=0;i<wake.count;i++)assert.ok(wake.getZ(i)>1);
});


const headingDifference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
test('the tender sails bow-first on both legs and follows continuous turns at each dock',()=>{
  for(const phase of ['outbound','returning'])for(let t=.01;t<12;t+=.05){
    const a=tenderPose({phase,remaining:12-t}),b=tenderPose({phase,remaining:12-t-.001});
    const dx=b.x-a.x,dz=b.z-a.z,speed=Math.hypot(dx,dz);
    assert.ok((-Math.sin(a.heading)*dx-Math.cos(a.heading)*dz)/speed>.999,'Bow follows actual travel');
  }
  for(const [a,b] of [[tenderPose({phase:'outbound',remaining:0}),tenderPose({phase:'returning',remaining:12})],[tenderPose({phase:'returning',remaining:0}),tenderPose()]]){
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-6);
    assert.ok(headingDifference(a.heading,b.heading)<.002,'No heading flip at delivery or return');
  }
});

function hullPolygon(pose,bounds,scale=1){
  const c=Math.cos(pose.heading),s=Math.sin(pose.heading);
  return [[bounds.min.x,bounds.min.z],[bounds.max.x,bounds.min.z],[bounds.max.x,bounds.max.z],[bounds.min.x,bounds.max.z]].map(([x,z])=>({x:pose.x+(c*x+s*z)*scale,z:pose.z+(-s*x+c*z)*scale}));
}
function polygonsOverlap(a,b){
  for(const polygon of [a,b])for(let i=0;i<4;i++){
    const p=polygon[i],q=polygon[(i+1)%4],axis={x:-(q.z-p.z),z:q.x-p.x};
    const aa=a.map(v=>v.x*axis.x+v.z*axis.z),bb=b.map(v=>v.x*axis.x+v.z*axis.z);
    if(Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa))return false;
  }
  return true;
}
test('simultaneous fleet arrivals keep their hulls apart from each other and the tender',()=>{
  const harbor=createHarbor(),hull=harbor.userData.tender.getObjectByName('boat-hull');
  hull.geometry.computeBoundingBox();const bounds=hull.geometry.boundingBox;
  const buoys=harbor.userData.channelBuoys.map(b=>({center:b.position,box:new THREE.Box3().setFromObject(b)}));
  // Full three-part batches, plus an all-at-once stress fixture for the route.
  for(const arrivals of [Array.from({length:12},(_,i)=>32+Math.floor(i/3)*36),Array(12).fill(32)])for(let t=0;t<270;t+=.2){
    const cycle=((t-20)%36+36)%36;
    const state=t<20||cycle>=24?{phase:'docked',remaining:0}:cycle<12?{phase:'outbound',remaining:12-cycle}:{phase:'returning',remaining:24-cycle};
    const tender=tenderPose(state),boats=[{pose:tender,scale:1}];
    const installed=arrivals.filter(at=>at<=t).map(arrived=>({arrived}));
    for(let i=0;i<12;i++){const pose=fishingBoatPose(i,installed,t);if(pose.visible)boats.push({pose,scale:.8});}
    const polygons=boats.map(({pose,scale})=>hullPolygon(pose,bounds,scale));
    for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++)assert.equal(polygonsOverlap(polygons[i],polygons[j]),false,`Hull overlap at ${t.toFixed(1)}s: ${i}/${j}`);
    for(const polygon of polygons)for(const {center,box} of buoys){
      const radius=(box.max.x-box.min.x)/2;
      const distances=polygon.map((p,i)=>{
        const q=polygon[(i+1)%4],dx=q.x-p.x,dz=q.z-p.z;
        const along=Math.max(0,Math.min(1,((center.x-p.x)*dx+(center.z-p.z)*dz)/(dx*dx+dz*dz)));
        return Math.hypot(center.x-p.x-along*dx,center.z-p.z-along*dz);
      });
      assert.ok(Math.min(...distances)>radius,`A hull clears the channel marker at ${t.toFixed(1)}s`);
    }
    assert.ok(polygons[0].every(p=>p.x>8.6),`Tender clears the pier at ${t.toFixed(1)}s`);
  }
});

test('fishing boats face their direction of travel through bends and only moving boats leave wakes',()=>{
  const installed=[{arrived:0}];
  for(let t=.1;t<45;t+=.1){
    const a=fishingBoatPose(0,installed,t),b=fishingBoatPose(0,installed,t+.001);
    const dx=b.x-a.x,dz=b.z-a.z;
    assert.ok((-Math.sin(a.heading)*dx-Math.cos(a.heading)*dz)/Math.hypot(dx,dz)>.995);
  }
  const harbor=createHarbor();harbor.userData.update(null,.1,0);
  assert.equal(harbor.userData.tender.userData.wake.visible,false);
  assert.ok(harbor.userData.fleet.every(b=>!b.mesh.userData.wake.visible));
  harbor.userData.update({elapsed:12,shipped:1,installed:[{arrived:12}],quay:[],tender:{phase:'returning',remaining:12,cargo:[]}},.1,12);
  assert.equal(harbor.userData.tender.userData.wake.visible,true);
  assert.equal(harbor.userData.fleet[0].mesh.userData.wake.visible,true);
});


test('the channel uses spare camera width while preserving shop scale and floor bounds',async()=>{
  const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
  const source=main.slice(main.indexOf('function measurePlayFrame()'),main.indexOf('// Browsers on iPhone'));
  for(const width of [640,860,1280]){
    const nodes={'game-footer':{getBoundingClientRect:()=>({top:680})},orders:{getBoundingClientRect:()=>({bottom:130})},'evening-panel':{hidden:true}};
    let harbor=false;
    const context=vm.createContext({THREE,$:id=>nodes[id],viewport:{w:width,h:720},phoneDevice:false,interfaceMode:'desktop',shopFrame:{left:-10,right:10,top:6,bottom:-6},right:new THREE.Vector3(1,0,0),cameraUp:new THREE.Vector3(0,.8,-.6),beaconing:()=>harbor});
    vm.runInContext(source,context);
    const before=context.measurePlayFrame();harbor=true;const after=context.measurePlayFrame();
    assert.equal(after.halfHeight,before.halfHeight,'Sailing never zooms the shop out');
    assert.ok(after.look.x>=before.look.x);
    const scale=after.halfHeight*2/720;
    for(const x of [-10,10])assert.ok(width/2+(x-after.look.x)/scale>=9.99&&width/2+(x-after.look.x)/scale<=width-9.99,'Both floor edges remain in view');
    if(width===1280)assert.ok(after.look.x>before.look.x,'The channel receives existing spare space');
  }
});
