// Shop staff: each hire does the work on their card and leaves the rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ManagerGame, JOBS, MACHINES, BAYS, DAY_SECONDS, QUOTE_WINDOW, MAX_QUOTES, COVARI_SLOTS, INSTALL_SECONDS, TECH_SERVICE_AT,
  covariPriceFor, deadlineFor,
} from '../dist/manager.js';

function fresh({length = 5, seed = 7} = {}) {
  const game = new ManagerGame();
  game.start({length, seed});
  game.nextQuoteAt = Infinity;
  game.drain();
  return game;
}
function quoteFor(game, jobId, {contract = false, customer = 0, markup = 0} = {}) {
  const job = JOBS.find(candidate => candidate.id === jobId);
  const basePrice = Math.round(job.price * (job.tight ? 1.15 : 1) / 10) * 10;
  const quote = {id:game.nextId++, type:contract ? 'contract' : 'job', customer, jobId, name:job.name, kind:job.kind, color:job.color, tight:Boolean(job.tight),
    technology:null, route:[...job.route, 'ship'], basePrice, markup, deadline:contract ? Math.round(game.time + DAY_SECONDS) : deadlineFor(job),
    quoteRemaining:QUOTE_WINDOW, age:0, material:30, covariCost:covariPriceFor(job.route)};
  game.priceQuote(quote);
  game.quotes.push(quote);
  return quote;
}
const evening = (game, fn) => { const mode = game.mode; game.mode = 'evening'; try { return fn(); } finally { game.mode = mode; } };
function assertIntegrity(game) {
  const places = new Map();
  const put = (id, where) => { assert.ok(!places.has(id), `#${id} is in ${places.get(id)} and ${where}`); places.set(id, where); };
  if (game.hand) put(game.hand.orderId, 'hands');
  if (game.buffer) put(game.buffer.orderId, 'buffer');
  for (const [key, station] of Object.entries(game.stations)) if (station.part) put(station.part.orderId, key);
  for (const member of game.staff) if (member.carry) put(member.carry, member.id);
  for (const id of game.receivingQueue) put(id, 'receiving');
  for (const order of game.orders) {
    const where = places.get(order.id);
    if (order.location === 'material') { assert.equal(order.started, false); assert.equal(where, undefined); continue; }
    if (order.location === 'supplier') { assert.equal(order.outsourced, true); assert.equal(where, undefined); continue; }
    assert.equal(where, order.location, `#${order.id} says ${order.location}`);
  }
  for (const id of places.keys()) assert.ok(game.order(id), `#${id} still exists`);
  assert.ok(game.quotes.length <= MAX_QUOTES);
  assert.ok(game.covariOrders().length <= COVARI_SLOTS);
  for (const [key, station] of Object.entries(game.stations)) {
    if (key.startsWith('bay-')) assert.ok(MACHINES[station.op].sizes.includes(BAYS.find(bay => bay.id === key).size), `${station.op} fits ${key}`);
  }
}
function untilShipStep(game, id) {
  for (let t = 0; t < 120 && game.order(id)?.route[game.order(id).index] !== 'ship'; t += .05) { game.tick(.05); assertIntegrity(game); }
  const order = game.order(id);
  assert.ok(order, 'The job is still on the floor');
  assert.equal(order.route[order.index], 'ship');
  assert.equal(game.missed, 0);
  assert.equal(game.shipped, 0, 'Shipping waits for a clerk or the owner');
}

test('a maintenance tech repairs breakdowns and services worn machines on their own', () => {
  const game = fresh();
  evening(game, () => game.hire('technician'));
  game.stations.lathe.down = true;
  game.stations.mill.wear = TECH_SERVICE_AT + 5;
  for (let t = 0; t < 60 && (game.stations.lathe.down || game.stations.mill.wear); t += .05) { game.tick(.05); assertIntegrity(game); }
  assert.equal(game.stations.lathe.down, false);
  assert.equal(game.stations.mill.wear, 0);
  assert.ok(game.drain().filter(e => e.type === 'serviced' && e.by.startsWith('staff-')).length >= 2);
});

test('a runner waiting at a broken machine does not keep the technician away', () => {
  const game = fresh();
  evening(game, () => { game.hire('programmer'); game.hire('runner'); game.hire('technician'); });
  const quote = quoteFor(game, 'spacer');game.acceptQuote(quote.id);
  game.stations.lathe.down = true;
  for (let t = 0; t < 40 && game.stations.lathe.down; t += .05) { game.tick(.05); assertIntegrity(game); }
  assert.equal(game.stations.lathe.down, false);
  assert.ok(game.drain().some(e => e.type === 'serviced' && e.station === 'lathe' && e.kind === 'repair'));
  untilShipStep(game, quote.id);
});

test('runners route around a broken machine to a working one of the same kind', () => {
  const game = fresh();game.cash = 30000;
  game.buildWing();
  for (let t = 0; t < DAY_SECONDS + .1 && game.mode === 'playing'; t += .05) game.tick(.05);
  game.openDay();
  game.buyMachine('bay-5', 'lathe');
  for (let t = 0; t < INSTALL_SECONDS + .1; t += .05) game.tick(.05);
  game.hire('programmer'); game.hire('runner');
  game.stations.lathe.down = true;
  const quote = quoteFor(game, 'spacer');game.acceptQuote(quote.id);
  untilShipStep(game, quote.id);
  assert.equal(game.stations.lathe.wear, 0, 'The broken lathe was never used');
  assert.ok(game.stations['bay-5'].wear > 0, 'The second lathe did the turning');
});

test('a programmer and runner machine a job and leave shipping to the clerk', () => {
  const game = fresh();
  evening(game, () => { game.hire('programmer'); game.hire('runner'); });
  assert.equal(game.staff[0].seat, 0, 'The first programmer takes the office chair');
  const quote = quoteFor(game, 'housing');
  game.acceptQuote(quote.id);
  untilShipStep(game, quote.id);
  assert.equal(game.order(quote.id).location, 'inspect');
  assert.ok(game.staff.filter(member => member.role === 'runner').every(member => !member.task?.steps.some(step => step.action === 'ship' || step.action === 'receive')));
  evening(game, () => game.hire('clerk'));
  for (let t = 0; t < 40 && game.order(quote.id); t += .05) game.tick(.05);
  assert.equal(game.order(quote.id), undefined);
  assert.equal(game.shipped, 1);
});

test('a clerk ships inspected parts and carries Covari crates to QC', () => {
  const game = fresh();
  evening(game, () => game.hire('clerk'));
  assert.equal(game.partnerCovari(), true);
  const panel = quoteFor(game, 'panel');
  game.outsourceQuote(panel.id);
  for (let t = 0; t < 80 && game.order(panel.id); t += .05) { game.tick(.05); assertIntegrity(game); }
  assert.equal(game.order(panel.id), undefined);
  assert.equal(game.sourced, 1);
});

test('a runner carries a part to its next machine and does not take the clerk’s work', () => {
  const game = fresh();
  game.cash = 5000;
  evening(game, () => { game.hire('runner'); assert.equal(game.buyMachine('bay-1', 'anodize'), true); });
  const collar = quoteFor(game, 'collar');
  assert.equal(game.acceptQuote(collar.id), true);
  const order = game.order(collar.id);
  order.programmed = true; order.started = true; order.materialPaid = true;
  order.index = order.route.indexOf('anodize');
  order.location = 'lathe';
  game.stations.lathe.part = {orderId:order.id};
  game.stations.lathe.ready = true;
  game.partnerCovari();
  const panel = quoteFor(game, 'panel');
  assert.equal(game.outsourceQuote(panel.id), true);
  game.orders.find(candidate => candidate.id === panel.id).deliveryRemaining = 0;
  game.tick(.05);
  const runner = game.staff.find(member => member.role === 'runner');
  assert.deepEqual(runner.task.steps.map(step => step.action), ['collect', 'load']);
  assert.equal(runner.task.steps[1].station, 'bay-1', 'The route’s next machine is the anodize bath');
  assert.ok(game.receivingQueue.includes(panel.id), 'A Covari crate waits for a clerk');
  assert.equal(game.shipped, 0);
});

test('a runner loads the next job while a clerk ships the finished one', () => {
  const game = fresh();
  evening(game, () => { game.hire('programmer'); game.hire('runner'); game.hire('clerk'); });
  const waiting = quoteFor(game, 'spacer');
  const finished = quoteFor(game, 'spacer');
  assert.equal(game.acceptQuote(waiting.id), true);
  assert.equal(game.acceptQuote(finished.id), true);
  for (const order of [game.order(waiting.id), game.order(finished.id)]) order.programmed = true;
  const done = game.order(finished.id);
  done.started = true;
  done.materialPaid = true;
  done.index = done.route.indexOf('ship');
  done.location = 'inspect';
  game.stations.inspect.part = {orderId:done.id};
  game.stations.inspect.ready = true;
  game.tick(.05);
  const runner = game.staff.find(member => member.role === 'runner');
  const clerk = game.staff.find(member => member.role === 'clerk');
  assert.deepEqual(runner.task.steps.map(step => step.action), ['pickup', 'load']);
  assert.equal(runner.task.orderId, waiting.id);
  assert.deepEqual(clerk.task.steps.map(step => step.action), ['collect', 'ship']);
  assert.equal(clerk.task.orderId, finished.id);
  assertIntegrity(game);
});
