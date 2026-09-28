import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopGame, STOCK_TYPES, stockType} from '../dist/core.js';

function fresh(shift = 0) {
  const game = new ShopGame();
  game.reset(shift);
  game.nextArrival = Infinity;
  game.nextCallAt = Infinity;
  game.drain();
  return game;
}
function advance(game, seconds) {
  for (let left = seconds; left > 1e-8; left -= .05) game.tick(Math.min(.05, left));
}

test('stock types classify the three physical bins', () => {
  assert.deepEqual(STOCK_TYPES, {round:'Round stock', plate:'Plate stock', block:'Block stock'});
  assert.equal(stockType({kind:'shaft'}), 'round');
  assert.equal(stockType({kind:'plate'}), 'plate');
  assert.equal(stockType({kind:'bracket'}), 'plate');
  assert.equal(stockType({kind:'block'}), 'block');
});

test('material dispatch chooses earliest due matching programmed order, then lowest id', () => {
  const game = fresh();
  game.spawn();
  game.spawn();
  const [roundA, plate, roundB] = game.orders;
  for (const order of game.orders) { order.programmed = true; order.remaining = 50; }
  roundA.remaining = 30;
  roundB.remaining = 30;
  game.selectedId = plate.id;
  assert.equal(game.nextMaterial('round').id, roundA.id);
  assert.equal(game.interact('material-round'), true);
  assert.equal(game.hand.orderId, roundA.id);
});

test('material dispatch uses an earlier due higher-id job before a later lower-id job', () => {
  const game = fresh();
  game.spawn();
  game.spawn();
  const [roundA, , roundB] = game.orders;
  for (const order of game.orders) order.programmed = true;
  roundA.remaining = 40;
  roundB.remaining = 20;
  assert.ok(roundB.id > roundA.id);
  assert.equal(game.interact('material-round'), true);
  assert.equal(game.hand.orderId, roundB.id);
});

test('selected ticket is passive: bin dispatch ignores it and wrong or empty bins preserve state', () => {
  const game = fresh();
  game.spawn();
  const [round, plate] = game.orders;
  round.programmed = plate.programmed = true;
  game.selectedId = plate.id;
  const before = game.snapshot();
  assert.equal(game.interact('material-block'), false);
  assert.deepEqual(game.snapshot(), before);
  assert.equal(game.interact('material-round'), true);
  assert.equal(game.hand.orderId, round.id);
  const invalidBefore = game.snapshot();
  assert.equal(game.interact('material-bogus'), false);
  assert.deepEqual(game.snapshot(), invalidBefore);
  const held = game.hand;
  assert.equal(game.interact('material-plate'), true, 'a stock bin recycles any ordinary held part');
  assert.equal(game.hand, null);
  assert.equal(round.started, false);
  assert.equal(round.index, 0);
  assert.equal(round.location, 'material');
  assert.deepEqual(held, {orderId: round.id});
});

test('unprogrammed and sourced work are excluded from ordinary stock dispatch', () => {
  const game = fresh(1);
  game.spawn();
  const order = game.orders[0];
  order.programmed = false;
  assert.equal(game.nextMaterial('round'), undefined);
  assert.equal(game.interact('material-round'), false);
  assert.ok(game.drain().some(event => event.type === 'hint' && /Complete CAD first/.test(event.message)));
  assert.equal(game.hand, null);
  game.sourcing = {id:201, kind:'block', state:'delivered', programmed:true, remaining:1};
  assert.equal(game.nextMaterial('block'), undefined);
  assert.equal(game.interact('material-block'), false);
  assert.equal(game.sourcing.state, 'delivered');
});

test('CAD resumes partial office work before newly due tickets', () => {
  const game = fresh(1);
  game.spawn();
  const [first, second] = game.orders;
  first.remaining = 20;
  second.remaining = 80;
  game.setOfficePresence(true);
  assert.equal(game.interact('office'), true);
  advance(game, 1);
  const saved = first.programRemaining;
  second.remaining = 20;
  game.setOfficePresence(false);
  assert.equal(game.nextCAD().id, first.id);
  game.selectedId = second.id;
  game.setOfficePresence(true);
  assert.equal(game.interact('office'), true);
  assert.equal(game.office.orderId, first.id);
  advance(game, saved + .05);
  assert.equal(first.programmed, true);
  assert.equal(second.programmed, false);
});
