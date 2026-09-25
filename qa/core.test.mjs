import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopGame, OPS, RECIPES, SHIFTS } from '../dist/core.js';

function fresh(shift=0) {
  const game=new ShopGame();game.reset(shift);
  game.nextArrival=Infinity;game.nextCallAt=Infinity;game.drain();return game;
}
function advance(game,seconds) {
  for(let left=seconds;left>1e-8;left-=.05)game.tick(Math.min(.05,left));
}
function assertOwnership(game) {
  const locations=[['hands',game.hand],['buffer',game.buffer],...Object.entries(game.stations).map(([id,s])=>[id,s.part])];
  for(const [location,part] of locations)if(part){const order=game.order(part.orderId);assert.ok(order,'No orphaned part at '+location);assert.equal(order.location,location);}
  for(const order of game.orders){
    assert.equal(locations.filter(([,part])=>part?.orderId===order.id).length,order.started?1:0,'One owner for RFQ '+order.id);
    if(!order.started){assert.equal(order.location,'material');assert.equal(order.index,0);}
  }
  for(const station of Object.values(game.stations))if(!station.part){assert.equal(station.ready,false);assert.equal(station.remaining,0);}
}
function fixtureForRecipe(shift,recipeIndex) {
  const game=fresh(shift);let guard=0;
  while(game.selected.name!==RECIPES[recipeIndex].name){assert.ok(guard++<SHIFTS[shift].recipes.length,'Recipe belongs to role');game.expire(game.selected.id);assert.equal(game.spawn(),true);}
  game.drain();return game;
}
function program(game,id=game.selectedId) {
  const order=game.order(id);if(order.programmed)return;
  game.select(id);game.setOfficePresence(true);
  assert.equal(game.interact('office'),true);
  advance(game,order.programRemaining+.05);
  assert.equal(order.programmed,true);game.setOfficePresence(false);
}
function processHeldPart(game,key) {
  const id=game.hand.orderId;assert.equal(game.interact(key),true);assert.equal(game.hand,null);
  assert.equal(game.stations[key].part.orderId,id);assertOwnership(game);
  advance(game,OPS[key].duration+.05);assert.equal(game.stations[key].ready,true);
  assert.equal(game.interact(key),true);assert.equal(game.hand.orderId,id);assertOwnership(game);
}
function finishOrder(game,id=game.selectedId) {
  program(game,id);game.select(id);assert.equal(game.interact('material'),true);
  for(const key of game.heldOrder.route.slice(0,-1))processHeldPart(game,key);
  assert.equal(game.interact('ship'),true);
}
function incomingCall() {
  const game=fresh(2);while(game.spawnIndex<3)assert.equal(game.spawn(),true);
  ringScheduledCall(game);
  assert.equal(game.call?.state,'ringing');return game;
}
function ringScheduledCall(game) {
  game.nextCallAt=game.elapsed;game.maybeCall();game.nextCallAt=Infinity;
}
function answerCall(game) {
  game.setOfficePresence(true);assert.equal(game.interact('phone'),true);
  assert.equal(game.call.state,'answering');advance(game,3.05);assert.equal(game.call.state,'offer');
}
function acceptedCall() {
  const game=incomingCall();answerCall(game);
  assert.equal(game.respondCall(true),true);assert.equal(game.call.state,'active');
  game.setOfficePresence(false);return game;
}

test('menu rejects interactions and leaves all clocks untouched',()=>{
  const game=new ShopGame(),before=game.snapshot();
  assert.equal(game.interact('material'),false);assert.equal(game.interact('office'),false);assert.equal(game.interact('phone'),false);
  advance(game,2);assert.deepEqual(game.snapshot(),before);
});

test('roles share intuitive routes and introduce programming before optional rush calls',()=>{
  assert.equal(SHIFTS.length,3);
  for(const shift of SHIFTS)for(const index of shift.recipes){assert.ok([0,1,6].includes(index));assert.ok(RECIPES[index].route.every(key=>['lathe','mill','inspect'].includes(key)));}
  const operator=fresh(0),manager=fresh(1),owner=fresh(2);
  assert.equal(operator.selected.programmed,true);assert.equal(operator.selected.programRemaining,0);
  assert.equal(manager.selected.programmed,false);assert.equal(manager.selected.programRemaining,4);
  assert.equal(owner.selected.programmed,false);assert.equal(owner.selected.programRemaining,4);
});

for(let shift=0;shift<SHIFTS.length;shift++)for(const recipeIndex of new Set(SHIFTS[shift].recipes)){
  const recipe=RECIPES[recipeIndex];
  test('role '+(shift+1)+': complete '+recipe.name+' through dispatch exactly once',()=>{
    const game=fixtureForRecipe(shift,recipeIndex),id=game.selected.id;
    program(game);assert.equal(game.interact('material'),true);assert.equal(game.interact('ship'),false);
    for(const key of recipe.route)processHeldPart(game,key);
    assert.equal(game.heldOrder.route[game.heldOrder.index],'ship');assert.equal(game.interact('ship'),true);
    assert.equal(game.shipped,1);assert.ok(game.score>=recipe.value);assert.equal(game.order(id),undefined);assert.equal(game.hand,null);
    const score=game.score;assert.equal(game.interact('ship'),false);assert.equal(game.score,score);assert.equal(game.shipped,1);
    assert.equal(game.drain().filter(event=>event.type==='shipped').length,1);assertOwnership(game);
  });
}

test('programming requires presence and an explicit start, then pauses and resumes',()=>{
  const game=fresh(1),order=game.selected;
  assert.equal(game.interact('office'),false,'Cannot program remotely');advance(game,1);assert.equal(order.programRemaining,4);
  game.setOfficePresence(true);advance(game,1);assert.equal(order.programRemaining,4,'Walking into office does not start work');
  assert.equal(game.interact('office'),true);advance(game,1.25);assert.ok(Math.abs(order.programRemaining-2.75)<1e-6);
  game.setOfficePresence(false);advance(game,2);assert.ok(Math.abs(order.programRemaining-2.75)<1e-6,'Leaving preserves progress');
  game.setOfficePresence(true);assert.equal(game.interact('office'),true);advance(game,2.8);
  assert.equal(order.programmed,true);assert.equal(order.programRemaining,0);
  const programEvents=game.drain().filter(event=>event.type==='programmed');
  advance(game,1);assert.equal(game.drain().filter(event=>event.type==='programmed').length,0,'Completion cannot repeat');
  assert.equal(programEvents.length,1);
});

test('office tracks the explicitly started RFQ; changing tickets cannot transfer work',()=>{
  const game=fresh(1);game.spawn();const [first,second]=game.orders;
  game.setOfficePresence(true);game.select(first.id);game.interact('office');advance(game,1);
  game.select(second.id);assert.ok(Math.abs(first.programRemaining-3)<1e-6);assert.equal(second.programRemaining,4);
  assert.equal(game.interact('office'),true);advance(game,1);
  assert.ok(Math.abs(first.programRemaining-3)<1e-6);assert.ok(Math.abs(second.programRemaining-3)<1e-6);
  game.select(first.id);game.interact('office');advance(game,3.05);
  assert.equal(first.programmed,true);assert.equal(second.programmed,false);assert.ok(Math.abs(second.programRemaining-3)<1e-6);
});

test('raw stock can be carried before programming but cannot start its first cut',()=>{
  const game=fresh(1),id=game.selected.id;
  assert.equal(game.interact('material'),true);const first=game.heldOrder.route[0];
  assert.equal(game.interact(first),false);assert.equal(game.hand.orderId,id);assert.equal(game.heldOrder.index,0);
  assert.equal(game.interact('inspect'),false);assert.equal(game.interact('ship'),false);
  program(game,id);assert.equal(game.hand.orderId,id);assert.equal(game.interact(first),true);assertOwnership(game);
});

test('recycling preserves partial and completed programs without extending the deadline',()=>{
  const game=fresh(1),order=game.selected;
  game.setOfficePresence(true);game.interact('office');advance(game,1.4);game.setOfficePresence(false);
  const remaining=order.remaining,programRemaining=order.programRemaining;
  game.interact('material');game.interact('material');assert.equal(order.programRemaining,programRemaining);assert.equal(order.remaining,remaining);
  program(game);game.interact('material');processHeldPart(game,order.route[0]);game.interact('material');
  assert.equal(order.programmed,true);assert.equal(order.programRemaining,0);assert.equal(order.index,0);assertOwnership(game);
});

test('wrong operation, locked station, and repeat collection preserve the part',()=>{
  const game=fresh();game.interact('material');const id=game.hand.orderId;
  for(const key of ['mill','anodize','unknown'])assert.equal(game.interact(key),false);
  assert.equal(game.hand.orderId,id);assert.equal(game.heldOrder.index,0);game.interact('lathe');
  assert.equal(game.interact('lathe'),false);advance(game,OPS.lathe.duration+.05);game.interact('lathe');
  assert.equal(game.interact('lathe'),false);assert.equal(game.hand.orderId,id);assert.equal(game.heldOrder.index,1);assertOwnership(game);
});

test('selection never relabels a carried or buffered part',()=>{
  const game=fresh();game.spawn();const [first,second]=game.orders;
  game.select(first.id);game.interact('material');game.select(second.id);assert.equal(game.hand.orderId,first.id);
  game.interact('buffer');game.interact('material');assert.equal(game.hand.orderId,second.id);assert.equal(game.interact('buffer'),false);
  game.interact(second.route[0]);game.interact('buffer');assert.equal(game.hand.orderId,first.id);assert.equal(game.stations[second.route[0]].part.orderId,second.id);assertOwnership(game);
});

test('pause freezes shift, deadlines, machines, programming, and arrivals',()=>{
  const game=fresh(1);game.spawn();const first=game.orders[0],second=game.orders[1];
  program(game,first.id);game.select(first.id);game.interact('material');game.interact(first.route[0]);
  game.select(second.id);game.setOfficePresence(true);game.interact('office');advance(game,.5);game.nextArrival=0;game.mode='paused';
  const before=game.snapshot(),elapsed=game.elapsed;game.drain();advance(game,20);
  assert.deepEqual(game.snapshot(),before);assert.equal(game.elapsed,elapsed);assert.equal(game.drain().length,0);assert.equal(game.interact('material'),false);
  game.mode='playing';game.tick(.05);assert.ok(game.stations[first.route[0]].remaining<OPS[first.route[0]].duration);assert.equal(game.orders.length,3);
});

for(const location of ['material','hands','buffer','processing','ready'])test('expiration clears '+location+' exactly once and preserves unrelated work',()=>{
  const game=fresh(),id=game.selected.id;game.spawn();const survivor=game.orders[1];
  if(location!=='material')game.interact('material');if(location==='buffer')game.interact('buffer');
  if(location==='processing'||location==='ready')game.interact('lathe');if(location==='ready')advance(game,OPS.lathe.duration+.05);
  game.order(id).remaining=.01;game.combo=3;game.drain();advance(game,.1);
  assert.equal(game.order(id),undefined);assert.equal(game.missed,1);assert.equal(game.combo,0);assert.equal(game.selectedId,survivor.id);
  assert.equal(game.orders.length,1);assert.equal(game.hand,null);assert.equal(game.buffer,null);assertOwnership(game);
  assert.equal(game.drain().filter(event=>event.type==='expired').length,1);advance(game,.1);assert.equal(game.missed,1);assert.equal(game.drain().length,0);
});

for(let stages=0;stages<=RECIPES[6].route.length;stages++)test('recycle recovers a carried compound part after '+stages+' operations',()=>{
  const game=fixtureForRecipe(2,6),id=game.selected.id;program(game);game.interact('material');
  for(const key of RECIPES[6].route.slice(0,stages))processHeldPart(game,key);
  const remaining=game.heldOrder.remaining;game.interact('material');const order=game.order(id);
  assert.equal(order.started,false);assert.equal(order.index,0);assert.equal(order.remaining,remaining);assert.equal(order.location,'material');assert.equal(order.programmed,true);
  assert.equal(game.interact('material'),true);assert.equal(game.hand.orderId,id);assertOwnership(game);
});

test('recycling frees hands with an occupied buffer and ready machine',()=>{
  const game=fresh();game.spawn();game.spawn();const [first,second,third]=game.orders;
  game.select(first.id);game.interact('material');game.interact('lathe');advance(game,OPS.lathe.duration+.05);
  game.select(second.id);game.interact('material');game.interact('buffer');game.select(third.id);game.interact('material');
  assert.equal(game.interact('lathe'),false);assert.equal(game.interact('buffer'),false);assert.equal(game.interact('material'),true);assert.equal(game.interact('lathe'),true);
  assert.equal(game.hand.orderId,first.id);assert.equal(game.buffer.orderId,second.id);assert.equal(game.order(third.id).started,false);assertOwnership(game);
});

test('closing-time arrivals fall back to a short route and stop with too little time',()=>{
  const game=fresh(2);const compoundIndex=SHIFTS[2].recipes.indexOf(6);assert.ok(compoundIndex>=0);
  game.spawnIndex=compoundIndex;game.time=40;assert.equal(game.spawn(),true);assert.equal(game.orders.at(-1).name,RECIPES[0].name);
  game.time=31.99;const count=game.orders.length,index=game.spawnIndex;assert.equal(game.spawn(),false);assert.equal(game.orders.length,count);assert.equal(game.spawnIndex,index);
});

test('arrival capacity is four and blocked arrivals do not age before appearing',()=>{
  const game=fresh();while(game.orders.length<4)assert.equal(game.spawn(),true);const index=game.spawnIndex;
  assert.equal(game.spawn(),false);assert.equal(game.spawnIndex,index);game.nextArrival=0;game.tick(.05);game.expire(game.orders[0].id);advance(game,2.1);
  assert.equal(game.orders.length,4);assert.equal(game.spawnIndex,index+1);assert.ok(game.orders.at(-1).remaining>game.orders.at(-1).deadline-.2);assertOwnership(game);
});

test('phone requires office presence and explicit acceptance; decline preserves normal order and streak',()=>{
  const game=incomingCall(),id=game.call.orderId,order=game.order(id),remaining=order.remaining;
  game.combo=3;assert.equal(game.interact('phone'),false);assert.equal(game.respondCall(true),false);
  game.setOfficePresence(true);assert.equal(game.respondCall(true),false,'Cannot accept an unanswered invitation');answerCall(game);
  assert.equal(game.respondCall(false),true);assert.equal(game.order(id),order);assert.ok(Math.abs(order.remaining-(remaining-3.05))<1e-6);assert.equal(game.combo,3);assert.equal(game.rushesAccepted,0);assert.equal(game.score,25);
});

test('accepted rush uses a separate 45-second promise and fixed 100-point bonus exactly once',()=>{
  const game=acceptedCall(),id=game.call.orderId,order=game.order(id),normalDeadline=order.remaining;
  assert.equal(game.call.remaining,45);assert.equal(order.remaining,normalDeadline);assert.equal(game.rushesAccepted,1);
  game.drain();finishOrder(game,id);const events=game.drain(),shipment=events.find(event=>event.type==='shipped');
  assert.equal(game.rushesWon,1);assert.equal(shipment.rushBonus,100);assert.equal(game.score,shipment.points+25);
  const baseline=incomingCall();answerCall(baseline);baseline.respondCall(false);baseline.setOfficePresence(false);finishOrder(baseline,id);
  assert.equal(game.score,baseline.score+100,'Rush adds exactly 100, independent of the normal shipment formula');
  const score=game.score;assert.equal(game.interact('ship'),false);assert.equal(game.respondCall(true),false);advance(game,.2);
  assert.equal(game.score,score);assert.equal(game.rushesWon,1);assert.equal(game.rushesAccepted,1);assertOwnership(game);
});

test('missing a rush promise preserves normal deadline, order, score, and shipping streak',()=>{
  const game=acceptedCall(),id=game.call.orderId,order=game.order(id),remaining=order.remaining;
  game.combo=3;game.score=300;advance(game,45.05);
  assert.equal(game.order(id),order);assert.ok(Math.abs(order.remaining-(remaining-45.05))<1e-5);
  assert.equal(game.combo,3);assert.equal(game.score,300);assert.equal(game.missed,0);assert.equal(game.rushesWon,0);
  finishOrder(game,id);const shipment=game.drain().filter(event=>event.type==='shipped').at(-1);
  assert.equal(shipment.rushBonus??0,0);assert.equal(game.shipped,1);assert.equal(game.rushesWon,0);
});

test('shipping an unrelated order cannot erase an accepted rush promise',()=>{
  const game=acceptedCall(),id=game.call.orderId,other=game.orders.find(order=>order.id!==id);
  finishOrder(game,other.id);assert.equal(game.call?.state,'active');assert.equal(game.call.orderId,id);assert.ok(game.call.remaining<45);assert.equal(game.rushesWon,0);
});

test('ringing and offer use one invitation timeout; unanswered calls carry no penalty',()=>{
  const game=incomingCall(),id=game.call.orderId;game.combo=2;advance(game,20);
  answerCall(game);advance(game,2.1);
  assert.notEqual(game.call?.state,'offer');assert.equal(game.respondCall(true),false);assert.ok(game.order(id));assert.equal(game.combo,2);assert.equal(game.missed,0);assert.equal(game.rushesAccepted,0);
  const ignored=incomingCall();advance(ignored,22.1);assert.notEqual(ignored.call?.state,'ringing');assert.equal(ignored.rushesAccepted,0);
});

test('pause freezes ringing, offer, and active rush timers',()=>{
  for(const stage of ['ringing','answering','offer','active']){
    const game=incomingCall();if(stage!=='ringing'){game.setOfficePresence(true);game.interact('phone');}if(['offer','active'].includes(stage))advance(game,3.05);if(stage==='active')game.respondCall(true);
    game.mode='paused';const before=game.snapshot();advance(game,50);assert.deepEqual(game.snapshot(),before);
  }
});

test('expiry clears a targeted call and active programming without orphaned work',()=>{
  const game=acceptedCall(),id=game.call.orderId;game.select(id);game.setOfficePresence(true);game.interact('office');advance(game,.5);
  game.order(id).remaining=.01;advance(game,.1);assert.equal(game.order(id),undefined);assert.notEqual(game.call?.state,'active');assert.notEqual(game.office.orderId,id);
  assert.equal(game.missed,1);assert.equal(game.rushesWon,0);assertOwnership(game);
});

test('closing a shift reports unfinished work once and ends calls and programming',()=>{
  const game=acceptedCall();game.select(game.call.orderId);game.setOfficePresence(true);game.interact('office');game.time=.05;const count=game.orders.length;game.drain();game.tick(.1);
  assert.equal(game.mode,'results');assert.equal(game.time,0);assert.equal(game.unfinished,count);assert.notEqual(game.call?.state,'active');assert.equal(game.office.orderId,null);
  assert.equal(game.drain().filter(event=>event.type==='finish').length,1);const before=game.snapshot();advance(game,2);
  assert.equal(game.interact('office'),false);assert.equal(game.interact('material'),false);assert.equal(game.respondCall(true),false);assert.deepEqual(game.snapshot(),before);
});

test('new shift clears prior machines, calls, programs, counters, and clocks',()=>{
  const game=acceptedCall();game.select(game.call.orderId);game.setOfficePresence(true);game.interact('office');advance(game,1);game.score=800;game.shipped=3;game.missed=2;game.combo=2;
  game.reset(1);assert.equal(game.mode,'playing');assert.equal(game.shiftIndex,1);assert.equal(game.time,SHIFTS[1].duration);assert.equal(game.elapsed,0);assert.equal(game.nextArrival,12);
  for(const key of ['score','shipped','missed','unfinished','combo','bestCombo','rushesAccepted','rushesWon','callsReceived','callsAnswered','callIndex'])assert.equal(game[key],0,key+' resets');
  assert.equal(game.hand,null);assert.equal(game.buffer,null);assert.equal(game.orders.length,1);assert.equal(game.selected.programRemaining,4);assert.equal(game.office.orderId,null);assert.equal(game.office.present,false);assert.equal(game.call,null);
  assertOwnership(game);program(game);finishOrder(game);assert.equal(game.shipped,1);
});

test('pass thresholds require role-specific shipment counts independently of bonus points',()=>{
  for(const [shift,target] of [[0,3],[1,4],[2,6]]){
    const game=fresh(shift);game.score=100000;game.shipped=target-1;assert.equal(game.passed(),false);assert.equal(game.stars(),0);
    game.shipped=target;assert.equal(game.passed(),true);assert.equal(game.stars(),1);
    for(let index=0;index<SHIFTS[shift].stars.length;index++){game.shipped=SHIFTS[shift].stars[index];assert.equal(game.stars(),index+1);}
  }
});


test('scheduled calls interrupt congested shops but unavailable rush promises remain blocked',()=>{
  const congested=fresh(2);program(congested);congested.interact('material');congested.interact('lathe');
  congested.spawn();congested.spawn();ringScheduledCall(congested);assert.equal(congested.orders.at(-1).id,103);assert.equal(congested.call.state,'ringing');assert.equal(congested.call.rushAvailable,false);
  const overdue=fresh(2);overdue.selected.remaining=52;overdue.spawn();overdue.spawn();ringScheduledCall(overdue);answerCall(overdue);assert.equal(overdue.call.rushAvailable,false);assert.equal(overdue.respondCall(true),false);assert.equal(overdue.rushesAccepted,0);
  const closing=fresh(2);closing.time=48;closing.spawn();closing.spawn();ringScheduledCall(closing);answerCall(closing);assert.equal(closing.call.rushAvailable,false);assert.equal(closing.respondCall(true),false);
});

test('rush acceptance rechecks whether the invited order can still be promised',()=>{
  const game=incomingCall(),id=game.call.orderId;game.orders[0].remaining=53.1;answerCall(game);
  assert.equal(game.respondCall(true),false,'An older order is now too close to its deadline');
  assert.equal(game.call,null);assert.equal(game.rushesAccepted,0);assert.ok(game.order(id));assert.equal(game.order(id).started,false);assertOwnership(game);
});


test('a ringing call blocks every handoff without changing carried work or machine ownership',()=>{
  const game=fresh(2),id=game.selectedId;program(game);game.interact('material');
  for(const key of game.heldOrder.route.slice(0,-1))processHeldPart(game,key);
  game.spawn();game.spawn();ringScheduledCall(game);assert.equal(game.call.state,'ringing');
  const hand=game.hand,order=game.heldOrder,index=order.index;
  for(const key of ['material','buffer','lathe','mill','inspect','ship'])assert.equal(game.interact(key),false,key+' waits for the phone');
  assert.equal(game.hand,hand);assert.equal(game.heldOrder,order);assert.equal(order.index,index);assert.equal(game.shipped,0);assertOwnership(game);
  answerCall(game);game.respondCall(false);assert.equal(game.interact('ship'),true);assert.equal(game.shipped,1);assert.equal(game.order(id),undefined);
});

test('answering takes three uninterrupted seconds, freezes invitation time, and rejects work and early replies',()=>{
  const game=incomingCall();advance(game,2);game.setOfficePresence(true);const invite=game.call.ringRemaining;
  assert.equal(game.interact('office'),true,'Office interaction answers a ringing phone');assert.equal(game.call.state,'answering');assert.equal(game.call.answerRemaining,3);
  advance(game,1);assert.ok(Math.abs(game.call.answerRemaining-2)<1e-6);assert.equal(game.call.ringRemaining,invite);
  for(const key of ['office','phone','material','buffer','lathe','mill','inspect','ship'])assert.equal(game.interact(key),false);
  assert.equal(game.respondCall(true),false);assert.equal(game.respondCall(false),false);
  game.setOfficePresence(false);advance(game,1.95);assert.equal(game.call.state,'answering');
  advance(game,.1);assert.equal(game.call.state,'offer','Leaving presence cannot cancel an answered conversation');
  assert.ok(game.call.ringRemaining>=invite-.051,'Answering does not consume the invitation budget');
  assert.equal(game.drain().filter(event=>event.type==='callAnswered').length,1);advance(game,.1);assert.equal(game.drain().filter(event=>event.type==='callAnswered').length,0);
  assert.equal(game.respondCall(false),false,'Offer responses still require office presence');game.setOfficePresence(true);assert.equal(game.respondCall(false),true);
});

test('ringing, answering, and the offer suspend programming while machines and deadlines keep running',()=>{
  const game=fresh(2),first=game.selected;program(game);game.interact('material');game.interact('lathe');advance(game,5);
  game.spawn();const second=game.orders[1];game.select(second.id);game.setOfficePresence(true);game.interact('office');advance(game,1);
  game.spawn();ringScheduledCall(game);assert.equal(game.call.state,'ringing');const programLeft=second.programRemaining,deadline=second.remaining,time=game.time,machineLeft=game.stations.lathe.remaining;
  advance(game,1);assert.equal(second.programRemaining,programLeft);assert.ok(game.stations.lathe.remaining<machineLeft);assert.ok(second.remaining<deadline);assert.ok(game.time<time);
  answerCall(game);assert.equal(second.programRemaining,programLeft);assert.equal(game.stations.lathe.ready,true,'Machine finishes during the conversation');
  advance(game,.5);assert.equal(second.programRemaining,programLeft);assert.equal(game.interact('lathe'),false,'Offer must be resolved before collection');
  game.respondCall(false);advance(game,.5);assert.ok(second.programRemaining<programLeft);assert.equal(game.stations.lathe.part.orderId,first.id);assertOwnership(game);
});

test('unanswered ring or unresolved offer times out and restores ordinary handoffs',()=>{
  for(const state of ['ringing','offer']){
    const game=incomingCall();if(state==='offer')answerCall(game);
    assert.equal(game.interact('material'),false);advance(game,22.1);assert.equal(game.call,null);
    assert.equal(game.interact('material'),true);assert.equal(game.rushesAccepted,0);assert.equal(game.rushesWon,0);assertOwnership(game);
  }
});

test('accepting a rush preserves an interrupted partial program but clears its active office target',()=>{
  const game=fresh(2),older=game.selected;game.setOfficePresence(true);game.interact('office');advance(game,1);
  const saved=older.programRemaining;game.spawn();game.spawn();ringScheduledCall(game);const rushId=game.call.orderId;answerCall(game);
  assert.equal(game.office.orderId,older.id);assert.equal(older.programRemaining,saved);assert.equal(game.respondCall(true),true);
  assert.equal(game.office.orderId,null);advance(game,1);assert.equal(older.programRemaining,saved);assert.equal(older.programmed,false);
  game.select(rushId);assert.equal(game.interact('office'),true);advance(game,4.05);assert.equal(game.order(rushId).programmed,true);assert.equal(older.programRemaining,saved);
});

test('a complete Owner shift has three predictable conversations without requiring rush acceptance',()=>{
  const game=new ShopGame();game.reset(2);const ringingAt=[];
  while(game.mode==='playing'){
    if(game.call?.state==='ringing'){
      ringingAt.push(game.elapsed);game.setOfficePresence(true);assert.equal(game.interact('phone'),true);
    }else if(game.call?.state==='offer'){
      const before={score:game.score,combo:game.combo,deadlines:game.orders.map(order=>order.remaining)};
      assert.equal(game.respondCall(false),true);
      assert.deepEqual({score:game.score,combo:game.combo,deadlines:game.orders.map(order=>order.remaining)},before,'Keeping the original promise adds no punishment');
    }else if(!game.call){
      if(game.hand){game.setOfficePresence(false);game.interact(game.heldOrder.route[game.heldOrder.index]);}
      else {
        const output=Object.entries(game.stations).find(([,station])=>{
          if(!station.ready)return false;
          const part=game.order(station.part.orderId),next=part.route[part.index];
          return next==='ship'||!game.stations[next]?.part;
        });
        const order=game.orders.find(candidate=>!candidate.started&&!game.stations[candidate.route[0]]?.part);
        if(output){game.setOfficePresence(false);game.interact(output[0]);}
        else if(order){
          game.select(order.id);game.setOfficePresence(!order.programmed);
          game.interact(order.programmed?'material':'office');
        }else game.setOfficePresence(false);
      }
    }
    game.tick(.05);game.drain();
  }
  assert.equal(game.callsReceived,3);assert.equal(game.callsAnswered,3);
  for(const [index,expected] of [27,77,127].entries())assert.ok(Math.abs(ringingAt[index]-expected)<.051,'Repeatable call '+(index+1));
  assert.equal(game.rushesAccepted,0);assert.equal(game.rushesWon,0);assert.equal(game.missed,0);assert.ok(game.passed());
  assert.equal(game.snapshot().callsAnswered,3);assert.equal(game.nextCallAt,Infinity);
});

test('rush availability updates while the customer waits, but acceptance still rechecks capacity',()=>{
  const game=fresh(2);program(game);game.interact('material');game.interact('lathe');game.spawn();game.spawn();ringScheduledCall(game);
  assert.equal(game.call.rushAvailable,false);answerCall(game);
  advance(game,3);assert.equal(game.call.rushAvailable,true,'Finishing cutting time can make the rush feasible');
  game.orders[0].remaining=40;game.tick(.05);assert.equal(game.call.rushAvailable,false);assert.equal(game.respondCall(true),false);assert.equal(game.rushesAccepted,0);
});

test('pending calls never overwrite a rush and give ten seconds recovery after it ends',()=>{
  const game=acceptedCall(),original=game.call;game.nextCallAt=game.elapsed;
  advance(game,1);assert.equal(game.call,original);assert.equal(game.callsReceived,1);
  original.remaining=.01;advance(game,.05);assert.equal(game.call,null);
  advance(game,9.9);assert.equal(game.call,null);advance(game,.15);
  assert.equal(game.call.state,'ringing');assert.equal(game.callsReceived,2);
});

test('Owner call schedule waits for live work and never affects the first two roles',()=>{
  for(const shift of [0,1]){const game=new ShopGame();game.reset(shift);advance(game,150);assert.equal(game.call,null);assert.equal(game.callsReceived,0);assert.equal(game.callsAnswered,0);}
  const game=fresh(2);game.orders=[];game.nextCallAt=0;advance(game,30);assert.equal(game.callsReceived,0);
  game.spawn();game.tick(.05);assert.equal(game.call.state,'ringing');assert.equal(game.callsReceived,1);
  const closing=fresh(2);closing.time=25;closing.nextCallAt=0;closing.tick(.05);assert.equal(closing.call,null,'No new call at closing');
});
