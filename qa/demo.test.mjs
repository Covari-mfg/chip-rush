import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { Vector3, MathUtils } from '../dist/vendor/three.module.js';
import { ShopGame } from '../dist/core.js';
import { createOwnerDemo } from '../dist/demo.js';

const main = await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const section = (from,to) => {
  const start=main.indexOf(from),end=main.indexOf(to,start);
  assert.ok(start>=0 && end>start,'Production movement section exists');
  return main.slice(start,end);
};

// Run the real movement, collision, dash, station and simulation code. Only
// rendering/audio/DOM outputs are stubbed; the controller must walk to every
// station and let the normal game clock complete all operations.
function runtime(frames) {
  const game=new ShopGame();
  game.reset(2);
  const shipments=[],inputs=[],phoneStates=new Set();
  const context=vm.createContext({
    Math,THREE:{Vector3,MathUtils},keys:new Set(),touchVector:{x:0,y:0},game,
    character:{userData:{},position:new Vector3(),rotation:{y:0},scale:{y:1}},
    playerRing:{position:new Vector3()},targetRing:{visible:true,position:new Vector3()},
    right:new Vector3(17,0,-11).normalize(),down:new Vector3(11,0,17).normalize(),
    toast(){},syncParts(){},updateUI(){},audio:{event(){}},
    createOwnerDemo,input:(kind)=>inputs.push({kind,at:game.elapsed}),
    processEvents(){for(const event of game.drain())if(event.type==='shipped')shipments.push({at:game.elapsed,...event});},
  });
  vm.runInContext(`
    ${section('const STATION_LAYOUT=','\nlet renderer')}
    ${section('const bounds=','\nfunction save')}
    const player={...SPAWN,angle:Math.PI};
    let path=[],pathStation=null,dashTime=0,dashCooldown=0,
      dashDirection=new THREE.Vector3(),walkPhase=0,clockTime=0,nearby=null;
    const stations=Object.fromEntries(STATION_LAYOUT.map(def=>[def.id,
      {def,access:def.access||{x:def.x,z:def.z+def.d/2+.63}}]));
    ${section('function safeSpot(','\n// A* routing')}
    ${section('function routeSegmentClear(','\nfunction screenPoint(')}
    ${section('function updateMovement(','\nfunction animateShop(')}
    const demonstration=createOwnerDemo({game,
      goToStation:station=>{input('station');goToStation(station);},
      selectOrder:id=>{input('select');game.select(id);},
      respondCall:accept=>{input('phone');game.setOfficePresence(atOffice());return game.respondCall(accept);},
      dash:()=>{input('dash');dash();},
      navigation:()=>({x:player.x,z:player.z,path,pathStation,dashCooldown}),
      distanceTo:station=>{let previous=player,total=0;const target=stations[station].access;
        for(const point of findPath(target.x,target.z)){
          total+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;
        }return total;}
    });
    this.step=dt=>{
      demonstration.tick(dt);updateMovement(dt);
      if(game.mode==='playing'){game.setOfficePresence(atOffice());game.tick(dt);processEvents();}
      clockTime+=dt;return safeSpot(player.x,player.z);
    };
    this.status=demonstration.status;
  `,context);
  for(let count=0;game.mode==='playing';count++){
    assert.ok(count<20000,'The demonstration must finish naturally');
    assert.ok(context.step(frames[count%frames.length]),'Player remains inside legal movement space');
    if(game.call)phoneStates.add(game.call.state);
  }
  return {game,shipments,inputs,phoneStates,status:context.status()};
}

for (const [name,frames] of [
  ['60 fps',[1/60]],
  ['30 fps',[1/30]],
  ['20 fps',[.05]],
  ['uneven rendering frames',[.012,.026,.018,.035,.016,.022]],
]) test(`Owner demonstration earns three stars with actual runtime movement at ${name}`,()=>{
  const {game,shipments,inputs,phoneStates,status}=runtime(frames);
  assert.equal(game.mode,'results');
  assert.ok(Math.abs(game.elapsed-180)<1e-8);
  assert.equal(game.shipped,10);
  assert.equal(game.stars(),3);
  assert.equal(game.missed,0);
  assert.equal(game.callsReceived,3,'Three separate customers interrupt the Owner shift');
  assert.equal(game.callsAnswered,3,'The demonstration completes every phone conversation');
  assert.ok(game.rushesWon>=1,'The customer expedite is visibly completed');
  assert.ok(shipments.at(-1).at<180,'The tenth order ships before the real shift ends');
  assert.ok(['ringing','answering','offer','active'].every(state=>phoneStates.has(state)));
  const dashes=inputs.filter(input=>input.kind==='dash');
  assert.ok(dashes.length>0);
  for(let index=1;index<dashes.length;index++){
    assert.ok(dashes[index].at-dashes[index-1].at>=1.3-1e-8,'Dashes respect their production cooldown');
  }
  assert.equal(status.dashes,dashes.length);
});
