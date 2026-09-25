import test from 'node:test';
import assert from 'node:assert/strict';
import { OPS, RECIPES, RULESET, ShopGame, scoreShipment } from '../dist/core.js';

function fresh(role=0) {
  const game=new ShopGame();game.reset(role);
  game.nextArrival=Infinity;game.nextCallAt=Infinity;game.drain();return game;
}
function advance(game,seconds) {
  for(let left=seconds;left>1e-8;left-=.05)game.tick(Math.min(.05,left));
}
function finishSelected(game) {
  const order=game.selected;
  if(!order.programmed) {
    game.setOfficePresence(true);assert.equal(game.interact('office'),true);
    advance(game,4.05);assert.equal(order.programmed,true);game.setOfficePresence(false);
  }
  assert.equal(game.interact('material'),true);
  for(const station of order.route.slice(0,-1)) {
    assert.equal(game.interact(station),true);advance(game,OPS[station].duration+.05);
    assert.equal(game.interact(station),true);
  }
  const before=game.score;
  assert.equal(game.interact('ship'),true);
  const shipment=game.drain().find(event=>event.type==='shipped');
  assert.equal(game.score-before,shipment.points);
  return shipment;
}
function ring(game) {
  game.nextCallAt=game.elapsed;game.maybeCall();game.nextCallAt=Infinity;
  assert.equal(game.call?.state,'ringing');
}
function answer(game) {
  game.setOfficePresence(true);assert.equal(game.interact('phone'),true);
  advance(game,3.05);assert.equal(game.call.state,'offer');
}

test('performance scoring has its own ruleset and a transparent additive breakdown',()=>{
  assert.equal(RULESET,'roles-v5-performance');
  assert.deepEqual(scoreShipment({value:120,remaining:10.25},1,{programming:true,rushBonus:100}),
    {base:120,program:60,speed:41,streak:0,rush:100,total:321});
});

test('shipping faster awards more points at quarter-second resolution',()=>{
  let previous=-1;
  for(let quarter=0;quarter<=400;quarter++) {
    const breakdown=scoreShipment({value:120,remaining:quarter/4},1);
    assert.equal(breakdown.speed,quarter);
    assert.ok(breakdown.total>previous);
    previous=breakdown.total;
  }
  assert.equal(scoreShipment({value:120,remaining:10.12},1).speed,40);
  assert.equal(scoreShipment({value:120,remaining:10.13},1).speed,41);
  assert.equal(scoreShipment({value:120,remaining:-1},1).speed,0);
});

test('recipe complexity earns the original part value at equal speed and streak',()=>{
  for(const recipe of RECIPES) {
    const breakdown=scoreShipment({...recipe,remaining:20},1);
    assert.equal(breakdown.base,recipe.value);
    assert.equal(breakdown.total,recipe.value+80);
  }
  assert.ok(scoreShipment({...RECIPES[6],remaining:20},1).total>
    scoreShipment({...RECIPES[0],remaining:20},1).total);
});

test('CAM contributes sixty points before streak multiplication',()=>{
  const order={value:140,remaining:25};
  for(const combo of [1,2,5]) {
    const plain=scoreShipment(order,combo);
    const programmed=scoreShipment(order,combo,{programming:true});
    assert.equal(plain.program,0);assert.equal(programmed.program,60);
    assert.equal(programmed.total-plain.total,Math.round(60*(1+(combo-1)*.15)));
  }
});

test('streak bonus stops at 1.6 times subtotal and rush remains a flat bonus',()=>{
  const order={value:120,remaining:10.25};
  for(const [combo,subtotalWithStreak] of [[1,221],[2,254],[5,354],[20,354]]) {
    const normal=scoreShipment(order,combo,{programming:true});
    const rush=scoreShipment(order,combo,{programming:true,rushBonus:100});
    assert.equal(normal.total,subtotalWithStreak);
    assert.equal(normal.streak,subtotalWithStreak-221);
    assert.equal(rush.rush,100);assert.equal(rush.total-normal.total,100);
    assert.equal(Object.entries(rush).filter(([key])=>key!=='total').reduce((sum,[,value])=>sum+value,0),rush.total);
  }
});

test('shipment calculation leaves the order and role timing untouched',()=>{
  const game=fresh(2),before=structuredClone(game);
  for(let n=0;n<3;n++)scoreShipment(game.selected,5,{programming:true,rushBonus:100});
  assert.deepEqual(structuredClone(game),before);
});

test('programming earns points only when its finished part ships and cannot be paid twice',()=>{
  for(const role of [1,2]) {
    const game=fresh(role);
    game.setOfficePresence(true);game.interact('office');advance(game,4.05);
    assert.equal(game.score,0);assert.equal(game.scoreDetails.program,0);
    const shipment=finishSelected(game);
    assert.equal(shipment.breakdown.program,60);assert.equal(game.scoreDetails.program,60);
    assert.equal(game.score,shipment.breakdown.total);
    const points=game.score;assert.equal(game.interact('ship'),false);
    assert.equal(game.score,points);assert.equal(game.scoreDetails.program,60);
  }
});

test('multiple deliveries continue increasing the full score beyond former role caps',()=>{
  for(const role of [0,1,2]) {
    const game=fresh(role);let total=0;
    for(let index=0;index<5;index++) {
      if(index)assert.equal(game.spawn(),true);
      const before=game.score,shipment=finishSelected(game);
      total+=shipment.points;
      assert.ok(game.score>before);assert.equal(game.score,total);
    }
    assert.ok(game.score>1500,'No artificial cap replaces earned shipment points');
    assert.equal(game.shipped,5);
    assert.equal(Object.values(game.scoreDetails).reduce((sum,value)=>sum+value,0),game.score);
  }
});

test('a completed phone conversation earns twenty-five points once even when the rush is declined',()=>{
  for(const accept of [false,true]) {
    const game=fresh(2);ring(game);
    assert.equal(game.score,0);answer(game);
    assert.equal(game.score,25);assert.equal(game.scoreDetails.calls,25);
    assert.equal(game.callsAnswered,1);advance(game,1);
    assert.equal(game.score,25,'Waiting on the offer cannot repeat the award');
    assert.equal(game.respondCall(accept),true);assert.equal(game.respondCall(accept),false);
    advance(game,1);assert.equal(game.score,25);
    assert.equal(game.shipped,0);assert.equal(game.stars(),0);assert.equal(game.combo,0);
    const events=game.drain().filter(event=>event.type==='callAnswered');
    assert.equal(events.length,1);assert.equal(events[0].points,25);
  }
});

test('ringing, ignored, and paused incomplete conversations earn no phone points',()=>{
  const ignored=fresh(2);ring(ignored);advance(ignored,22.05);
  assert.equal(ignored.call,null);assert.equal(ignored.score,0);assert.equal(ignored.callsAnswered,0);
  const game=fresh(2);ring(game);game.setOfficePresence(true);game.interact('phone');
  advance(game,2.5);assert.equal(game.score,0);game.mode='paused';advance(game,5);
  assert.equal(game.score,0);assert.equal(game.callsAnswered,0);
  game.mode='playing';advance(game,.55);assert.equal(game.score,25);
  game.respondCall(false);advance(game,1);assert.equal(game.score,25);
});

test('three separate completed calls earn seventy-five points and reset clears their accounting',()=>{
  const game=fresh(2);
  for(let number=1;number<=3;number++) {
    ring(game);answer(game);assert.equal(game.respondCall(false),true);
    assert.equal(game.score,number*25);assert.equal(game.scoreDetails.calls,number*25);
    if(number<3)advance(game,10.05);
  }
  assert.equal(game.callsAnswered,3);assert.equal(game.shipped,0);assert.equal(game.stars(),0);
  game.reset(2);assert.equal(game.score,0);assert.equal(game.scoreDetails.calls,0);
  assert.equal(game.callsAnswered,0);
});
