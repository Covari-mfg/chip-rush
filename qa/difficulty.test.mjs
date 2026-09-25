// These are reproducible balance bounds, not estimates of human completion
// rates. Every profile follows production click-to-walk routes. Expert runs
// add timed dashes on clear straight segments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Vector3, MathUtils } from '../dist/vendor/three.module.js';
import { SHIFTS } from '../dist/core.js';
import { Driver, simulateShift, navigation } from './balance.mjs';

test('a slow Operator can pass while handling one order at a time', () => {
  const result=simulateShift(0,{strategy:'serial',reaction:3});
  assert.ok(result.pass, 'Three seconds of hesitation per handoff still clears Operator');
  assert.equal(result.missed,0);
  assert.equal(result.dashes,0);
});

test('Operator mastery permits deliberate, serial play without dash', () => {
  const result=simulateShift(0,{strategy:'serial',reaction:1.5});
  assert.equal(result.stars,3);
  assert.equal(result.missed,0);
  assert.equal(result.dashes,0);
});

test('Operator keeps its final order available across normal no-dash play styles', () => {
  for (const strategy of ['serial','flow']) for (let tenth=0;tenth<=30;tenth++) {
    const driver=new Driver(0,strategy,'decline',{reaction:tenth/10});
    const result=driver.run(),label=`${strategy}, ${tenth/10}s handoff`;
    assert.equal(driver.game.spawnIndex,7,label+' keeps the existing seven-order opportunity');
    assert.equal(result.missed,0,label+' keeps generous order deadlines');
    assert.equal(result.stars,3,label+' can still earn Operator mastery without dash');
    if(result.unfinished===0)assert.ok(SHIFTS[0].duration-result.lastShipmentAt<20,label+' avoids the long empty ending');
  }
});

test('Production Manager rewards overlapping work instead of serial processing', () => {
  const serial=simulateShift(1,{strategy:'serial',reaction:.5});
  const flow=simulateShift(1,{strategy:'flow',reaction:.5});
  assert.ok(serial.pass);
  assert.ok(serial.stars<3, 'Completing each order in isolation must leave room for improvement');
  assert.equal(flow.stars,3);
  assert.equal(flow.missed,0);
  assert.equal(flow.dashes,0);
});

test('ordinary concurrent play clears Owner without earning its top tier', () => {
  for (const phonePolicy of ['decline','accept']) {
    const result=simulateShift(2,{reaction:.5,phonePolicy});
    assert.ok(result.pass, phonePolicy+' should allow a normal clear');
    assert.ok(result.stars<3, 'Owner mastery must exceed ordinary concurrent play');
    assert.equal(result.dashes,0);
  }
});

test('Owner three stars has a narrow legal route with either rush choice', () => {
  for (const phonePolicy of ['decline','accept']) {
    const result=simulateShift(2,{reaction:.1,dash:true,phonePolicy});
    assert.equal(result.stars,3, phonePolicy+' must have an attainable mastery route');
    assert.equal(result.missed,0);
    assert.equal(result.callsReceived,3,'Owner mastery includes all three interruptions');
    assert.equal(result.callsAnswered,3,'Every mandatory conversation is completed');
    assert.ok(result.lastShipmentAt<=SHIFTS[2].duration);
    assert.ok(SHIFTS[2].duration-result.lastShipmentAt<10, 'Expert execution should have little spare time');
    assert.ok(result.dashes>0);
    const dashes=result.log.filter(event=>event.action==='dash');
    for (const [index,dash] of dashes.entries()) {
      assert.ok(dash.straightRemaining>=2.2, 'Every dash has room to finish before a corner');
      if (index) assert.ok(dash.at-dashes[index-1].at>=1.29, 'No cooldown bypass, allowing 0.01s trace rounding');
    }
    if (phonePolicy==='decline') assert.equal(result.rushesAccepted,0, 'Three stars cannot require a rush bonus');
  }
});

test('dash alone does not grant Owner three stars at slower execution', () => {
  for (const reaction of [.3,.5]) {
    const result=simulateShift(2,{reaction,dash:true});
    assert.ok(result.pass);
    assert.ok(result.stars<3);
  }
});

test('expert proof is repeatable under the same shift and choices', () => {
  const options={reaction:.1,dash:true};
  assert.deepEqual(simulateShift(2,options),simulateShift(2,options));
});

test('simulated dash cooldown follows the production conversation lock', () => {
  const driver=new Driver(2,'flow','decline',{dash:true});
  driver.dashCooldown=1.3;
  driver.game.call={state:'answering',orderId:101,answerRemaining:3};
  driver.tick(.5);
  assert.equal(driver.dashCooldown,1.3, 'A conversation does not recharge dash');
  driver.game.call=null;
  driver.tick(.5);
  assert.ok(Math.abs(driver.dashCooldown-.8)<1e-9);
});

test('smoothed station routes preserve destinations and clear every collision boundary', () => {
  const starts={spawn:navigation.spawn,...navigation.accesses};
  for (const [from,origin] of Object.entries(starts)) for (const [to,target] of Object.entries(navigation.accesses)) {
    assert.ok(navigation.safe(origin.x,origin.z),from+' starts on an unobstructed floor position');
    assert.ok(navigation.safe(target.x,target.z),to+' access point is outside every collider');
    const path=navigation.route(origin,target);
    assert.ok(path.length, from+' to '+to+' is reachable');
    assert.ok(Math.hypot(path.at(-1).x-target.x,path.at(-1).z-target.z)<1e-9,from+' to '+to+' reaches the real access point');
    let previous=origin;
    for (const point of path) {
      assert.ok(navigation.clear(previous,point), from+' to '+to+' does not cut a machine or office corner');
      previous=point;
    }
  }
  assert.ok(navigation.route(navigation.accesses.ship,navigation.accesses.material).length<8, 'Open travel no longer retains every grid waypoint');
});

// Execute the production movement function, with only rendering and UI outputs
// stubbed. This catches frame-boundary and waypoint behavior a time-only balance
// model cannot establish on its own.
const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const section=(from,to)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)));
function movementProbe({position={...navigation.spawn},route=[],dash=.2,direction={x:1,z:0}}={}) {
  const ctx=vm.createContext({
    Math,THREE:{Vector3,MathUtils},keys:new Set(),touchVector:{x:0,y:0},
    game:{mode:'playing',call:null,office:{orderId:null},setOfficePresence(){},interact(){}},
    character:{userData:{},position:new Vector3(),rotation:{y:0},scale:{y:1}},
    playerRing:{position:new Vector3()},targetRing:{visible:true},
    right:new Vector3(17,0,-11).normalize(),down:new Vector3(11,0,17).normalize(),
    nearestStation:()=>null,processEvents(){},
  });
  vm.runInContext(`${section('const STATION_LAYOUT=','\nlet renderer')}
    ${section('const bounds=','\nfunction save')}
    const player=${JSON.stringify({...position,angle:0})};
    let path=${JSON.stringify(route)},pathStation=null,dashTime=${dash},dashCooldown=1.3,
      dashDirection=new THREE.Vector3(${direction.x},0,${direction.z}),walkPhase=0,clockTime=0,nearby=null;
    const stations=Object.fromEntries(STATION_LAYOUT.map(def=>[def.id,{def,access:def.access||{x:def.x,z:def.z+def.d/2+.63}}]));
    ${section('function safeSpot(','\n// A* routing')}
    ${section('function routeSegmentClear(','\nfunction goToStation(')}
    ${section('function updateMovement(','\nfunction animateShop(')}
    this.step=dt=>{updateMovement(dt);return {x:player.x,z:player.z,dashTime,pathLength:path.length};};`,ctx);
  return ctx;
}

test('production dash consumes exactly its remaining boost across uneven frames', () => {
  for (const frame of [1/60,.037,.05]) {
    const probe=movementProbe();let state;
    for (let elapsed=0;elapsed<.3;elapsed+=frame) state=probe.step(frame);
    assert.ok(Math.abs(state.x-navigation.spawn.x-2.2)<1e-8, 'A standing dash travels 11 × 0.2, without an extra boosted frame');
    assert.equal(state.dashTime,0);
  }
});

test('production click dash stops at a close corner and continues forward without reversal', () => {
  for (const frame of [1/60,.037,.05]) {
    const turn={x:navigation.spawn.x,z:navigation.spawn.z-1},target={...navigation.spawn};
    const origin={x:turn.x-.2,z:turn.z};
    const probe=movementProbe({position:origin,route:[turn,target]});
    let previous={...origin},state;
    for (let elapsed=0;elapsed<.8;elapsed+=frame) {
      state=probe.step(frame);
      assert.ok(state.x<=turn.x+1e-8, 'Dash never passes the first waypoint');
      assert.ok(state.x>=previous.x-1e-8&&state.z>=previous.z-1e-8, 'No backtracking to skipped waypoints');
      assert.ok(state.z<=target.z+1e-8, 'Route never overshoots its destination');
      previous=state;
    }
    assert.equal(state.pathLength,0);
    assert.ok(Math.hypot(state.x-target.x,state.z-target.z)<.13);
  }
});
