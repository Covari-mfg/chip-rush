import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { Vector3, MathUtils } from '../dist/vendor/three.module.js';
import { ShopGame } from '../dist/core.js';
import { createOwnerDemo, createShopDemo, parseWatchMode, nextWatchRole } from '../dist/demo.js';

const main = await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const section = (from,to) => {
  const start=main.indexOf(from),end=main.indexOf(to,start);
  assert.ok(start>=0 && end>start,'Production movement section exists');
  return main.slice(start,end);
};

test('watch links select their requested role and ignore unknown modes',()=>{
  for(const [name,role] of [['operator',0],['manager',1],['owner',2]]) {
    assert.deepEqual(parseWatchMode(`?watch=${name}`),{enabled:true,sequence:false,role});
    assert.equal(nextWatchRole(parseWatchMode(`?watch=${name}`),role),role);
  }
  for(const search of ['', '?watch=', '?watch=all', '?watch=Owner', '?other=owner']) {
    assert.equal(parseWatchMode(search).enabled,false);
    assert.equal(parseWatchMode(search).sequence,false);
  }
});

test('the review sequence starts at Operator, advances each role, and restarts after Owner',()=>{
  const mode=parseWatchMode('?watch=sequence');
  assert.deepEqual(mode,{enabled:true,sequence:true,role:0});
  assert.equal(nextWatchRole(mode,0),1);
  assert.equal(nextWatchRole(mode,1),2);
  assert.equal(nextWatchRole(mode,2),0);
});

// Run the real movement, collision, dash, station and simulation code. Only
// rendering/audio/DOM outputs are stubbed; the controller must walk to every
// station and let the normal game clock complete all operations.
function runtime(frames,{role=2,sourcing=false}={}) {
  const game=new ShopGame();
  game.reset(role);
  const shipments=[],inputs=[],events=[],phoneStates=new Set(),sourceStates=new Set();
  let attendedApproval=0;
  const context=vm.createContext({
    Math,THREE:{Vector3,MathUtils},keys:new Set(),touchVector:{x:0,y:0},game,
    character:{userData:{},position:new Vector3(),rotation:{y:0},scale:{y:1}},
    playerRing:{position:new Vector3()},targetRing:{visible:true,position:new Vector3()},
    right:new Vector3(17,0,-11).normalize(),down:new Vector3(11,0,17).normalize(),
    toast(){},syncParts(){},updateUI(){},audio:{event(){}},
    createOwnerDemo,createShopDemo,role,sourcing,input:(kind)=>inputs.push({kind,at:game.elapsed}),
    processEvents(){for(const event of game.drain()){
      const entry={at:game.elapsed,...event};events.push(entry);
      if(event.type==='shipped')shipments.push(entry);
    }},
  });
  vm.runInContext(`
    ${section('const STATION_LAYOUT=','\nlet renderer')}
    ${section('const bounds=','\nfunction save')}
    const player={...SPAWN,angle:Math.PI};
    let path=[],pathStation=null,dashTime=0,dashCooldown=0,
      dashDirection=new THREE.Vector3(),walkPhase=0,clockTime=0,nearby=null,pendingSource=false;
    const stations=Object.fromEntries(STATION_LAYOUT.map(def=>[def.id,
      {def,access:def.access||{x:def.x,z:def.z+def.d/2+.63}}]));
    ${section('function safeSpot(','\n// A* routing')}
    ${section('function routeSegmentClear(','\nfunction screenPoint(')}
    ${section('function updateMovement(','\nfunction animateShop(')}
    const api={game,
      goToStation:station=>{input('station');goToStation(station);},
      selectOrder:id=>{input('select');pendingSource=false;game.select(id);},
      selectSource:()=>{input('source');pendingSource=game.sourcing?.state==='offer';return pendingSource;},
      respondCall:accept=>{input('phone');game.setOfficePresence(atOffice());return game.respondCall(accept);},
      dash:()=>{input('dash');dash();},
      navigation:()=>({x:player.x,z:player.z,path,pathStation,dashCooldown}),
      distanceTo:station=>{let previous=player,total=0;const target=stations[station].access;
        for(const point of findPath(target.x,target.z)){
          total+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;
        }return total;}
    };
    const demonstration=role===2&&!sourcing?createOwnerDemo(api):createShopDemo(api,{sourcing});
    this.step=dt=>{
      demonstration.tick(dt);updateMovement(dt);
      if(game.mode==='playing'){game.setOfficePresence(atOffice());game.tick(dt);processEvents();}
      clockTime+=dt;return safeSpot(player.x,player.z);
    };
    this.status=demonstration.status;
    this.position=()=>({x:player.x,z:player.z});
  `,context);
  for(let count=0;game.mode==='playing';count++){
    assert.ok(count<20000,'The demonstration must finish naturally');
    const dt=frames[count%frames.length],beforeTime=game.time,beforeElapsed=game.elapsed;
    const beforePosition=context.position();
    const beforeApproval=game.sourcing?.approvalRemaining;
    assert.ok(context.step(dt),'Player remains inside legal movement space');
    const afterPosition=context.position();
    assert.ok(Math.hypot(afterPosition.x-beforePosition.x,afterPosition.z-beforePosition.z)<=11*dt+1e-8,
      'The controller cannot move faster than the production dash speed');
    assert.ok(Math.abs(game.elapsed-beforeElapsed-Math.min(dt,.1,beforeTime))<1e-8,
      'Every frame advances only the normal game clock');
    assert.ok(Math.abs(game.time+game.elapsed-game.config.duration)<1e-8);
    if(beforeApproval!==undefined && game.sourcing?.approvalRemaining<beforeApproval) {
      assert.equal(game.office.present,true,'Source approval progresses only at the office');
      attendedApproval+=beforeApproval-game.sourcing.approvalRemaining;
    }
    if(game.call)phoneStates.add(game.call.state);
    if(game.sourcing)sourceStates.add(game.sourcing.state);
  }
  assert.equal(game.shipped,shipments.length);
  assert.equal(game.score,events.filter(event=>['shipped','callAnswered','sourceDelivered'].includes(event.type))
    .reduce((total,event)=>total+event.points,0),'Only normal game events contribute points');
  return {game,shipments,inputs,events,phoneStates,sourceStates,attendedApproval,status:context.status()};
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

for(const [role,name] of [[0,'Operator'],[1,'Production Manager']])
test(`${name} demonstration completes a normal shift with production movement`,()=>{
  const {game,shipments,inputs}=runtime([1/30],{role});
  assert.equal(game.mode,'results');assert.equal(game.shiftIndex,role);
  assert.ok(Math.abs(game.elapsed-game.config.duration)<1e-8);
  assert.equal(game.passed(),true);assert.equal(game.stars(),3);assert.equal(game.missed,0);
  assert.equal(game.callsReceived,0);assert.equal(game.callsAnswered,0);
  assert.equal(game.sourced,0);assert.equal(inputs.filter(input=>input.kind==='source').length,0);
  assert.ok(shipments.at(-1).at<game.config.duration);
});

for(const [role,name] of [[0,'Operator'],[1,'Production Manager'],[2,'Owner']])
test(`${name} review visibly selects and completes Covari sourcing through normal office inputs`,t=>{
  const {game,inputs,events,sourceStates,attendedApproval}=runtime([1/30],{role,sourcing:true});
  assert.equal(game.mode,'results');assert.equal(game.passed(),true);assert.equal(game.missed,0);
  assert.equal(game.sourced,1);assert.equal(game.sourcePoints,60);
  assert.equal(game.sourcing.state,'delivered');
  assert.ok(['offer','approving','sourcing','delivered'].every(state=>sourceStates.has(state)));
  const selection=inputs.find(input=>input.kind==='source');
  const offers=events.filter(event=>event.type==='sourceOffer');
  const approvals=events.filter(event=>event.type==='sourcePlaced');
  const deliveries=events.filter(event=>event.type==='sourceDelivered');
  assert.equal(offers.length,1);assert.equal(approvals.length,1);assert.equal(deliveries.length,1);
  assert.ok(selection,'The demonstration selects the source offer before requesting approval');
  assert.ok(selection.at>=offers[0].at+3-1/30,'The source offer stays visible before being selected');
  assert.ok(Math.abs(attendedApproval-2)<1e-8,'Approval receives two attended office seconds');
  assert.ok(approvals[0].at>=selection.at+2-1/30);
  assert.ok(deliveries[0].at>=approvals[0].at+22-1e-8,'Partner delivery uses its real timer');
  assert.equal(deliveries[0].points,60);
  assert.ok(inputs.some(input=>input.kind==='station'&&input.at>approvals[0].at&&input.at<deliveries[0].at),
    'Regular station work continues while the partner manufactures the sourced job');
  assert.equal(game.callsReceived,role===2?3:0);assert.equal(game.callsAnswered,role===2?3:0);
  t.diagnostic(`${name}: ${game.shipped} shipped, ${game.stars()} stars, ${game.score} points, ${game.callsAnswered} calls, source delivered at ${deliveries[0].at.toFixed(2)}s`);
});
