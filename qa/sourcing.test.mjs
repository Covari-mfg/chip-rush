import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopGame, SOURCE_JOBS, OPS, stockType} from '../dist/core.js';

function advance(game, seconds) { for (let left = seconds; left > 1e-8; left -= .05) game.tick(Math.min(.05, left)); }
function ready(role = 1) {
  const game = new ShopGame(); game.reset(role); game.nextArrival = Infinity; game.nextCallAt = Infinity; game.shipped = 2;
  advance(game, 35.05); assert.equal(game.sourcing?.state, 'offer'); return game;
}
function delivered(role = 1) { const game = ready(role); assert.equal(game.requestSource(), true); advance(game, 22.05); assert.equal(game.sourcing.state, 'delivered'); return game; }

function shipOrdinary(game) {
  const order = game.orders.find(candidate => !candidate.started); game.select(order.id);
  game.setOfficePresence(true);
  let guard=0;
  while(!order.programmed){
    assert.ok(guard++<game.orders.length+2);
    assert.equal(game.interact('office'),true);
    advance(game,game.order(game.office.orderId)?.programRemaining+.05);
  }
  game.setOfficePresence(false);
  assert.equal(game.interact(`material-${stockType(order)}`), true);
  for (const station of order.route.slice(0, -1)) { assert.equal(game.interact(station), true); advance(game, OPS[station].duration + .05); assert.equal(game.interact(station), true); }
  assert.equal(game.interact('ship'), true);
}

test('two real ordinary shipments unlock sourcing naturally', () => {
  const game = new ShopGame(); game.reset(1); game.nextArrival = Infinity; game.nextCallAt = Infinity;
  shipOrdinary(game); game.spawn(); shipOrdinary(game); assert.equal(game.shipped, 2); assert.equal(game.sourcing, null);
  advance(game, 8.8); assert.equal(game.sourcing?.state, 'offer');
});

test('Operator never receives sourcing, while Manager and Owner require shipped and timing gates', () => {
  const operator = new ShopGame(); operator.reset(0); operator.nextArrival = Infinity; operator.shipped = 99; advance(operator, 100); assert.equal(operator.sourcing, null);
  for (const role of [1, 2]) { const game = new ShopGame(); game.reset(role); game.nextArrival = Infinity; advance(game, 35.1); assert.equal(game.sourcing, null); game.shipped = 2; advance(game, .1); assert.equal(game.sourcing.state, 'offer'); }
  const late = new ShopGame(); late.reset(1); late.nextArrival = Infinity; late.shipped = 1; late.time = 44; advance(late, 35); assert.equal(late.sourcing, null); late.shipped = 2; advance(late, .1); assert.equal(late.sourcing, null);
});

test('offer timeout and decline have no penalty and do not consume ordinary capacity', () => {
  const game = ready(); const ordinaryIds = game.orders.map(order => order.id); assert.equal(game.declineSource(), true); assert.equal(game.sourcing.state, 'declined'); advance(game, 40);
  assert.equal(game.score, 0); assert.equal(game.missed, 0); assert.equal(game.shipped, 2); assert.deepEqual(game.orders.map(order => order.id), ordinaryIds);
  const ignored = ready(); advance(ignored, 30.1); assert.equal(ignored.sourcing.state, 'declined'); assert.equal(ignored.score, 0);
});

test('source acceptance is one click from anywhere, leaves CAD untouched, and respects pause and phone guards', () => {
  const game = ready(1); game.setOfficePresence(false); assert.equal(game.requestSource(), true); assert.equal(game.sourcing.state, 'sourcing'); assert.equal(game.sourcing.programmed, true); assert.equal(game.sourcing.programRemaining, 0);
  const paused = ready(); paused.mode = 'paused'; const before = paused.snapshot(); assert.equal(paused.requestSource(), false); advance(paused, 10); assert.deepEqual(paused.snapshot(), before);
  const phone = ready(2); phone.nextCallAt = phone.elapsed; phone.maybeCall(); assert.ok(phone.call); assert.equal(phone.requestSource(), true); assert.equal(phone.sourcing.state, 'sourcing');
  const answering = ready(2); answering.nextCallAt = answering.elapsed; answering.maybeCall(); answering.setOfficePresence(true); answering.interact('office'); assert.equal(answering.call.state, 'answering'); assert.equal(answering.requestSource(), false); assert.equal(answering.sourcing.state, 'offer');
});

test('delivery sets receiving and awards no points or ordinary shipment credit', () => {
  const game = delivered(); assert.deepEqual(game.receiving, {orderId: 201}); assert.equal(game.sourcing.started, true); assert.equal(game.sourcing.location, 'receiving');
  assert.equal(game.score, 0); assert.equal(game.sourcePoints, 0); assert.equal(game.sourced, 0); assert.equal(game.shipped, 2); assert.equal(game.combo, 0); assert.equal(game.bestCombo, 0);
  assert.ok(game.drain().some(event => event.type === 'sourceDelivered' && event.orderId === 201));
});

test('receiving preserves a delivered crate when hands are full', () => {
  const game = delivered(); const ordinary = game.orders[0]; ordinary.programmed = true; game.selectedId = ordinary.id; assert.equal(game.interact('material'), true); const held = game.hand;
  assert.equal(game.interact('receiving'), false); assert.deepEqual(game.receiving, {orderId: 201}); assert.deepEqual(game.hand, held);
});

test('sourced part must be inspected, then ships once for exactly 300 without ordinary bonuses', () => {
  const game = delivered(); assert.equal(game.interact('receiving'), true); assert.equal(game.interact('ship'), false); assert.equal(game.interact('material'), false); assert.equal(game.interact('inspect'), true);
  advance(game, 4.05); assert.equal(game.sourcing.index, 1); assert.equal(game.interact('inspect'), true); assert.equal(game.interact('ship'), true); assert.equal(game.sourcing.state, 'fulfilled');
  assert.equal(game.score, 300); assert.equal(game.sourcePoints, 300); assert.equal(game.scoreDetails.sourcing, 300); assert.equal(game.sourced, 1); assert.equal(game.shipped, 2); assert.equal(game.combo, 0); assert.equal(game.bestCombo, 0); assert.equal(game.interact('ship'), false);
});

test('sourced parts use normal station exchange rules', () => {
  const game = delivered(); assert.equal(game.interact('receiving'), true); assert.equal(game.interact('inspect'), true); advance(game, 4.05); const ordinary = game.orders[0]; ordinary.programmed = true; ordinary.route = ['inspect', 'ship']; ordinary.index = 0; game.select(ordinary.id);
  assert.equal(game.interact('material'), true); assert.equal(game.interact('inspect'), true); assert.equal(game.hand.orderId, 201); assert.equal(game.sourcing.location, 'hands'); assert.equal(game.stations.inspect.part.orderId, ordinary.id);
});

test('reset and finish do not leak receiving or create a late payout', () => {
  const game = ready(); game.requestSource(); game.time = .05; advance(game, .1); assert.equal(game.mode, 'results'); assert.equal(game.score, 0); assert.equal(game.receiving, null); game.reset(1); assert.equal(game.sourcing, null); assert.equal(game.receiving, null);
});

test('source variants retain capability and technology while sharing the same mechanics', () => {
  assert.deepEqual(SOURCE_JOBS, [
    {name:'Molded cover', capability:'Injection molding', technology:'im'},
    {name:'Wire EDM insert', capability:'Wire EDM', technology:'edm'},
    {name:'Sheet-metal bracket', capability:'Sheet metal fabrication', technology:'sm'},
  ]);
  for (const role of [1, 2]) { const game = ready(role); assert.deepEqual({name:game.sourcing.name, capability:game.sourcing.capability, technology:game.sourcing.technology}, SOURCE_JOBS[role]); assert.equal(game.sourcing.id, 201); assert.deepEqual(game.sourcing.route, ['inspect', 'ship']); assert.equal(game.sourcing.value, 300); assert.equal(game.sourcing.points, 300); }
});

test('accepting outsourcing preserves active CAD and accepted rush work',()=>{
  const game=ready(2),order=game.orders[0];
  game.setOfficePresence(true);assert.equal(game.interact('office'),true);advance(game,1);
  const remaining=order.programRemaining,officeId=game.office.orderId;
  game.call={state:'active',orderId:order.id,remaining:40};
  assert.equal(game.requestSource(),true);assert.equal(game.office.orderId,officeId);
  assert.equal(order.programRemaining,remaining);advance(game,.5);
  assert.ok(order.programRemaining<remaining);assert.equal(game.sourcing.state,'sourcing');
});

for(const stage of ['offer','sourcing','receiving','hands','buffer','inspect','ready'])test('pause and shift end preserve then clear source ownership at '+stage,()=>{
  const game=ready();
  if(stage!=='offer')game.requestSource();
  if(!['offer','sourcing'].includes(stage))advance(game,22.05);
  if(['hands','buffer','inspect','ready'].includes(stage))game.interact('receiving');
  if(stage==='buffer')game.interact('buffer');
  if(['inspect','ready'].includes(stage))game.interact('inspect');
  if(stage==='ready')advance(game,4.05);
  game.mode='paused';const before=game.snapshot();advance(game,10);assert.deepEqual(game.snapshot(),before);
  assert.equal(game.interact('receiving'),false);assert.equal(game.interact('ship'),false);
  game.mode='playing';game.time=.05;advance(game,.1);
  assert.equal(game.mode,'results');assert.equal(game.receiving,null);assert.notEqual(game.hand?.orderId,201);assert.notEqual(game.buffer?.orderId,201);
  assert.ok(Object.values(game.stations).every(station=>station.part?.orderId!==201));
  assert.equal(game.sourcing.started,false);assert.equal(game.sourced,0);assert.equal(game.sourcePoints,0);
  advance(game,30);assert.equal(game.sourcePoints,0);game.reset(1);assert.equal(game.sourcing,null);
});

test('sourced and ordinary parts retain ownership through bench and QC exchanges',()=>{
  const game=delivered(),ordinary=game.orders[0];
  ordinary.programmed=true;game.select(ordinary.id);assert.equal(game.interact('material'),true);
  assert.equal(game.interact('lathe'),true);advance(game,8.05);assert.equal(game.interact('lathe'),true);
  assert.equal(game.interact('inspect'),true);advance(game,4.05);
  assert.equal(game.interact('receiving'),true);assert.equal(game.interact('buffer'),true);
  assert.equal(game.interact('inspect'),true);assert.equal(game.interact('buffer'),true);
  assert.equal(game.hand.orderId,201);assert.equal(game.buffer.orderId,ordinary.id);
  assert.equal(game.sourcing.index,0);assert.equal(ordinary.index,2);
  assert.equal(game.interact('buffer'),true);assert.equal(game.hand.orderId,ordinary.id);
  assert.equal(game.interact('ship'),true);assert.equal(game.interact('buffer'),true);
  assert.equal(game.interact('inspect'),true);advance(game,4.05);assert.equal(game.interact('inspect'),true);
  const score=game.score,shipped=game.shipped,combo=game.combo;
  assert.equal(game.interact('ship'),true);assert.equal(game.score,score+300);assert.equal(game.shipped,shipped);assert.equal(game.combo,combo);
  assert.equal(game.drain().filter(event=>event.type==='sourceFulfilled').length,1);
});
