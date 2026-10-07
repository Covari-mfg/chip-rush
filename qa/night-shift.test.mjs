// Night Shift is the fourth level. These checks cover its catalog entry, the
// finishing stations, the per-map layout, save/score compatibility, and
// reproducible balance bounds. Balance rows are simulations, not player data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ShopGame, SHIFTS, RECIPES, OPS, RULESET, SOURCE_JOBS, FINISHING_SOURCE_JOBS, scoreShipment, stockType } from '../dist/core.js';
import { TECHNOLOGIES } from '../dist/technology.js';
import { challengeURL, parseChallenge } from '../dist/social.js';
import { validateResult } from '../server/worker.js';
import { Driver, simulateShift, navigation } from './balance.mjs';

const NIGHT = 3;
const START = 1_800_000_000_000;
const night = SHIFTS[NIGHT];

function advance(game, seconds) {
  for (let left = seconds; left > 1e-8; left -= .05) game.tick(Math.min(.05, left));
}
function fresh(shift = NIGHT) {
  const game = new ShopGame();
  game.reset(shift);
  game.nextArrival = Infinity;
  game.drain();
  return game;
}
function program(game, id) {
  game.setOfficePresence(true);
  let guard = 0;
  while (!game.order(id).programmed) {
    assert.ok(guard++ < 8, 'CAD fixture reaches its target');
    assert.equal(game.interact('office'), true);
    advance(game, game.order(game.office.orderId).programRemaining + .05);
  }
  game.setOfficePresence(false);
}
function run(game, station, seconds) {
  assert.equal(game.interact(station), true, `load ${station}`);
  advance(game, seconds + .05);
}

test('Night Shift is appended with a stable identity and its own credit', () => {
  assert.equal(SHIFTS.length, 4);
  assert.equal(night.id, 'night-shift');
  assert.equal(night.mapId, 'night-shop');
  assert.ok(night.author && night.harness);
  assert.notEqual(night.author, SHIFTS[0].author, 'The new level does not copy an earlier credit');
  assert.equal(new Set(SHIFTS.map(shift => shift.id)).size, SHIFTS.length);
});

test('the three released levels keep their configuration', () => {
  const legacy = SHIFTS.slice(0, 3).map(({ id, mapId, duration, firstArrival, interval, deadline, maxOrders, recipes, unlocks, stock, programming, sourcing, calls, callTimes, passTarget, stars }) =>
    ({ id, mapId, duration, firstArrival, interval, deadline, maxOrders, recipes, unlocks, stock, programming, sourcing, calls, callTimes, passTarget, stars }));
  assert.deepEqual(legacy, [
    { id:'first-shift', mapId:'first-shop', duration:150, firstArrival:18, interval:19, deadline:82, maxOrders:undefined, recipes:[0,1,0,1,0,1,0,1], unlocks:['lathe','mill','inspect'], stock:['round','plate'], programming:false, sourcing:false, calls:false, callTimes:[], passTarget:3, stars:[3,4,5] },
    { id:'mixed-orders', mapId:'first-shop', duration:180, firstArrival:16, interval:25, deadline:105, maxOrders:6, recipes:[0,1,6,0,1,6], unlocks:['lathe','mill','inspect'], stock:['round','plate','block'], programming:true, sourcing:true, calls:false, callTimes:[], passTarget:4, stars:[4,5,6] },
    { id:'rush-hour', mapId:'first-shop', duration:180, firstArrival:12, interval:18, deadline:105, maxOrders:8, recipes:[0,1,6,0,6,1,6,1], unlocks:['lathe','mill','inspect'], stock:['round','plate','block'], programming:true, sourcing:true, calls:true, callTimes:[27,77,127], passTarget:5, stars:[5,6,8] },
  ]);
});

test('Night Shift adds finishing routes and a Covari offer, without customer calls', () => {
  assert.deepEqual(night.unlocks, ['lathe', 'mill', 'deburr', 'anodize', 'inspect']);
  assert.equal(night.programming, true);
  assert.equal(night.calls, false);
  assert.equal(night.sourcing, true);
  assert.equal(night.sourceJobs, FINISHING_SOURCE_JOBS);
  const operations = new Set(night.recipes.flatMap(index => RECIPES[index].route));
  for (const key of ['lathe', 'mill', 'deburr', 'anodize', 'inspect']) assert.ok(operations.has(key), `${key} is used by an order`);
  for (const index of night.recipes) {
    const recipe = RECIPES[index];
    assert.ok(recipe.route.every(key => night.unlocks.includes(key)), `${recipe.name} only needs stations this level provides`);
    assert.ok(night.stock.includes(stockType(recipe)), `${recipe.name} has a stock bin`);
  }
  const game = fresh();
  game.nextArrival = 1;
  advance(game, night.duration);
  assert.equal(game.callsReceived, 0);
  assert.equal(game.sourcing, null, 'No Covari offer until two normal shipments');
  assert.equal(game.finishReason, 'time-up');
});

test('the Covari offer is a finishing capability with no station on the floor', () => {
  assert.equal(FINISHING_SOURCE_JOBS.length, SOURCE_JOBS.length);
  const stations = new Set([...Object.keys(OPS), ...Object.values(OPS).map(op => op.name.toLowerCase())]);
  for (const job of FINISHING_SOURCE_JOBS) {
    assert.ok(job.name && job.capability && job.gap, `${job.name} names its process and why the floor lacks it`);
    assert.ok(TECHNOLOGIES[job.technology], `${job.name} has a technology badge`);
    assert.equal(stations.has(job.technology) || stations.has(job.capability.toLowerCase()), false, `${job.capability} has no station`);
    assert.ok(!night.recipes.some(index => RECIPES[index].name === job.name), 'The shop never makes it itself');
  }
  assert.equal(new Set(FINISHING_SOURCE_JOBS.map(job => job.technology)).size, FINISHING_SOURCE_JOBS.length);
  assert.deepEqual(SOURCE_JOBS.map(job => job.technology), ['im', 'edm', 'sm'], 'Earlier levels keep their pool');
  for (const shift of [1, 2]) assert.equal(SHIFTS[shift].sourceJobs, undefined);
});

function offered(level = NIGHT) {
  const game = fresh(level);
  game.shipped = 2;
  advance(game, 35.05);
  assert.equal(game.sourcing?.state, 'offer');
  return game;
}

test('Night Shift offers one finishing job after two shipments, on the shared timing gates', () => {
  const game = fresh();
  game.shipped = 1;
  advance(game, 60);
  assert.equal(game.sourcing, null, 'Two shipments come first');
  game.shipped = 2;
  advance(game, .1);
  assert.equal(game.sourcing?.state, 'offer');
  assert.ok(FINISHING_SOURCE_JOBS.some(job => job.name === game.sourcing.name));
  assert.equal(game.sourcing.gap, FINISHING_SOURCE_JOBS.find(job => job.name === game.sourcing.name).gap);
  const late = fresh();
  late.shipped = 2;
  late.time = 44;
  advance(late, 35);
  assert.equal(late.sourcing, null, 'No offer with under 45 seconds left');
  for (const shift of [1, 2]) assert.ok(SOURCE_JOBS.some(job => job.name === offered(shift).sourcing.name), 'Earlier levels still offer the original pool');
});

test('accepting Covari delivers a crate to Receiving, then QC and shipping earn 300 without a shipment', () => {
  const game = offered();
  const orders = game.orders.map(order => order.id);
  assert.equal(game.requestSource(), true);
  advance(game, 22.05);
  assert.equal(game.sourcing.state, 'delivered');
  assert.equal(game.interact('receiving'), true);
  assert.equal(game.hand.orderId, 201);
  run(game, 'inspect', OPS.inspect.duration);
  assert.equal(game.interact('inspect'), true);
  const before = game.score, shipped = game.shipped;
  assert.equal(game.interact('ship'), true);
  assert.equal(game.score - before, 300);
  assert.equal(game.sourced, 1);
  assert.equal(game.shipped, shipped, 'Covari work earns no shipment or star credit');
  assert.deepEqual(game.orders.map(order => order.id), orders, 'It never used an order slot');
  assert.equal(game.scoreDetails.sourcing, 300);
});

test('a carried Covari crate swaps with a finished part waiting at QC', () => {
  const game = offered();
  game.requestSource();
  advance(game, 22.05);
  assert.equal(game.interact('receiving'), true);
  const waiting = game.orders[0];
  Object.assign(waiting, { programmed: true, started: true, index: 1, location: 'inspect' });
  waiting.route = ['lathe', 'inspect', 'ship'];
  game.stations.inspect = { part: { orderId: waiting.id }, remaining: 0, ready: true };
  assert.equal(game.interact('inspect'), true);
  assert.equal(game.hand.orderId, waiting.id, 'The finished part comes out');
  assert.equal(game.stations.inspect.part.orderId, 201, 'The crate goes into QC');
  assert.equal(game.stations.inspect.ready, false);
  assert.equal(game.stations.inspect.remaining, OPS.inspect.duration);
});

test('declining or ignoring the Covari offer costs nothing and never blocks the finish', () => {
  const declined = offered();
  assert.equal(declined.declineSource(), true);
  const before = declined.score;
  advance(declined, 40);
  assert.equal(declined.score, before);
  assert.equal(declined.sourced, 0);
  const ignored = offered();
  advance(ignored, 31);
  assert.equal(ignored.sourcing.state, 'declined');
});

test('deburr and anodize stay unavailable in the released levels', () => {
  for (const shift of [0, 1, 2]) {
    const game = fresh(shift);
    for (const station of ['deburr', 'anodize']) {
      assert.equal(game.interact(station), false);
      assert.match(game.drain().find(event => event.type === 'hint').message, /not needed in this shift/);
    }
  }
});

test('the color bath is one shared station that swaps a finished part for the next', () => {
  const game = fresh();
  for (let i = 0; i < 3; i++) assert.equal(game.spawn(), true);
  const collar = game.orders.find(order => order.name === 'Ocean collar');
  const bracket = game.orders.find(order => order.name === 'Satin bracket');
  program(game, collar.id);
  program(game, bracket.id);

  assert.equal(game.interact('material-round'), true);
  assert.equal(game.hand.orderId, collar.id);
  run(game, 'lathe', OPS.lathe.duration);
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.interact('buffer'), true, 'Park the turned collar');

  assert.equal(game.interact('material-plate'), true);
  assert.equal(game.hand.orderId, bracket.id);
  run(game, 'mill', OPS.mill.duration);
  assert.equal(game.interact('mill'), true);
  run(game, 'deburr', OPS.deburr.duration);
  assert.equal(game.interact('deburr'), true);
  assert.equal(game.heldOrder.route[game.heldOrder.index], 'anodize');

  assert.equal(game.interact('buffer'), true, 'Swap the deburred bracket for the parked collar');
  assert.equal(game.hand.orderId, collar.id);
  assert.equal(game.interact('anodize'), true);
  assert.equal(game.stations.anodize.part.orderId, collar.id);
  assert.equal(game.interact('buffer'), true);
  assert.equal(game.hand.orderId, bracket.id);

  game.drain();
  assert.equal(game.interact('anodize'), false, 'A running bath cannot take another part');
  assert.match(game.drain().find(event => event.type === 'hint').message, /working/);
  assert.equal(game.hand.orderId, bracket.id);

  advance(game, OPS.anodize.duration + .05);
  assert.equal(game.stations.anodize.ready, true);
  assert.equal(game.interact('anodize'), true, 'The ready collar swaps out for the bracket');
  assert.equal(game.stations.anodize.part.orderId, bracket.id);
  assert.equal(game.hand.orderId, collar.id);
  assert.equal(game.heldOrder.route[game.heldOrder.index], 'inspect');
});

test('every map is registered and offers the stations its levels use', () => {
  const ids = mapId => Array.from(navigation.layout.filter(def => navigation.has(def, mapId)), def => def.id).sort();
  const original = ['buffer', 'inspect', 'lathe', 'material-block', 'material-plate', 'material-round', 'mill', 'office', 'receiving', 'ship'];
  assert.deepEqual(ids('first-shop'), original, 'Released levels keep exactly their original stations');
  assert.deepEqual(ids('night-shop'), [...original, 'anodize', 'deburr'].sort(), 'Night Shift keeps Receiving for its Covari deliveries');
  for (const shift of SHIFTS) {
    const available = ids(shift.mapId);
    assert.ok(navigation.maps[shift.mapId], `${shift.id} has a registered map`);
    for (const id of [...shift.unlocks, 'ship', 'buffer', ...shift.stock.map(type => `material-${type}`), ...(shift.programming ? ['office'] : []), ...(shift.sourcing ? ['receiving'] : [])]) {
      assert.ok(available.includes(id), `${shift.id} can reach ${id}`);
    }
  }
});

test('each map keeps every station reachable, uncluttered and collision-safe', () => {
  for (const [mapId, map] of Object.entries(navigation.maps)) {
    navigation.activate(mapId);
    const defs = navigation.layoutFor(mapId), accesses = navigation.accessesFor(mapId);
    assert.ok(navigation.safe(navigation.spawn.x, navigation.spawn.z), `${mapId}: spawn is on open floor`);
    const solid = defs.filter(def => def.collidable !== false);
    for (const [index, a] of solid.entries()) for (const b of solid.slice(index + 1)) {
      const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2, overlapZ = Math.abs(a.z - b.z) < (a.d + b.d) / 2;
      assert.equal(overlapX && overlapZ, false, `${mapId}: ${a.id} and ${b.id} do not overlap`);
    }
    const starts = { spawn: navigation.spawn, ...accesses };
    for (const [from, origin] of Object.entries(starts)) for (const def of defs) {
      const target = accesses[def.id];
      assert.ok(navigation.safe(target.x, target.z), `${mapId}: ${def.id} access is outside every collider`);
      const path = navigation.route(origin, target);
      assert.ok(path.length || Math.hypot(origin.x - target.x, origin.z - target.z) < 1.4, `${mapId}: ${from} reaches ${def.id}`);
      let previous = origin;
      for (const point of path) { assert.ok(navigation.clear(previous, point), `${mapId}: ${from} to ${def.id} avoids corners`); previous = point; }
    }
    assert.ok(map.theme, `${mapId} names a theme`);
    for (const def of defs) for (const other of defs) {
      if (def.id === other.id || !(['deburr', 'anodize', 'receiving'].includes(def.id) || def.bay)) continue;
      const a = accesses[def.id], b = accesses[other.id];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 1.3, `${mapId}: ${def.id} and ${other.id} have distinct access points`);
    }
  }
});

test('Night Shift finishing stations are not obstacles in the released map', () => {
  navigation.activate('first-shop');
  for (const id of ['deburr', 'anodize']) {
    const { x, z } = navigation.accesses[id];
    assert.ok(navigation.safe(x, z));
    const def = navigation.layout.find(station => station.id === id);
    assert.ok(navigation.safe(def.x, def.z), `${id} leaves the released floor walkable`);
  }
  navigation.activate('night-shop');
  const receiving = navigation.layout.find(station => station.id === 'receiving');
  assert.equal(navigation.safe(receiving.x, receiving.z), false, 'Receiving is a solid bench on the night map');
  for (const id of ['deburr', 'anodize']) {
    const def = navigation.layout.find(station => station.id === id);
    assert.equal(navigation.safe(def.x, def.z), false, `${id} is solid on the night map`);
  }
  navigation.activate('first-shop');
});

test('every theme is defined and the night look is darker than the day look', async () => {
  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('const THEMES='), end = main.indexOf('\nfunction activeMapId');
  assert.ok(start > 0 && end > start);
  const themes = vm.runInNewContext(`(${main.slice(start + 'const THEMES='.length, end).replace(/;\s*$/, '')})`);
  for (const map of Object.values(navigation.maps)) assert.ok(themes[map.theme], `${map.theme} theme exists`);
  const luminance = hex => ((hex >> 16) & 255) * .2126 + ((hex >> 8) & 255) * .7152 + (hex & 255) * .0722;
  assert.ok(luminance(themes.night.sky) < luminance(themes.day.sky));
  assert.ok(themes.night.hemi[2] < themes.day.hemi[2]);
});

test('an ordinary concurrent player earns Night Shift mastery; serial play clears without it', () => {
  const serial = simulateShift(NIGHT, { strategy: 'serial', reaction: .5 });
  assert.ok(serial.pass, 'Deliberate one-at-a-time play clears the level');
  assert.ok(serial.stars < 3, 'Overlapping the bath, CAD and machines is what earns mastery');
  for (const reaction of [.5, 1]) {
    const flow = simulateShift(NIGHT, { strategy: 'flow', reaction });
    assert.equal(flow.stars, 3, `${reaction}s decisions reach three stars`);
    assert.equal(flow.shipped, night.maxOrders);
    assert.equal(flow.missed, 0);
    assert.equal(flow.unfinished, 0);
    assert.equal(flow.dashes, 0);
  }
  assert.ok(simulateShift(NIGHT, { strategy: 'flow', reaction: 1.5 }).pass, 'Slower hands still clear it');
  assert.ok(simulateShift(NIGHT, { strategy: 'serial', reaction: 1.5 }).pass);
});

test('Night Shift expert routes are legal, repeatable and finish inside the clock', () => {
  const options = { reaction: .1, dash: true };
  const result = simulateShift(NIGHT, options);
  assert.deepEqual(result, simulateShift(NIGHT, options));
  assert.equal(result.stars, 3);
  assert.equal(result.spawned, night.maxOrders);
  assert.equal(result.callsReceived, 0);
  assert.equal(result.finishReason, 'work-complete');
  assert.ok(result.lastShipmentAt <= night.duration);
  assert.equal(result.scoreDetails.calls, 0);
  assert.equal(result.scoreDetails.sourcing, 0, 'The default profile declines Covari');
  assert.equal(result.score, Object.values(result.scoreDetails).reduce((total, points) => total + points, 0));
});

test('every Night Shift part follows CAD, stock, its route and shipping in order', () => {
  const result = simulateShift(NIGHT, { reaction: .5 });
  assert.equal(result.cadSeconds, result.shipped * 6);
  assert.equal(result.scoreDetails.program, result.shipped * 120);
  assert.deepEqual(result.orders.map(order => order.name), night.recipes.map(index => RECIPES[index].name));
  const stations = new Set();
  for (const order of result.orders) {
    const steps = order.steps.filter(step => ['programmed', 'load', 'shipped', 'pickup'].includes(step.action) && (step.action !== 'pickup' || step.station?.startsWith('material-')))
      .map(step => step.action === 'programmed' ? 'CAD' : step.action === 'shipped' ? 'ship' : step.station?.startsWith('material-') ? 'material' : step.station);
    assert.deepEqual(steps, ['CAD', 'material', ...order.route], `#${order.id} ${order.name}`);
    order.route.forEach(key => stations.add(key));
  }
  assert.ok(stations.has('deburr') && stations.has('anodize'));
});

test('accepting the Covari job is an optional trade that keeps mastery for ordinary concurrent play', () => {
  for (const reaction of [.5, 1]) {
    const declined = simulateShift(NIGHT, { strategy: 'flow', reaction });
    const accepted = simulateShift(NIGHT, { strategy: 'flow', reaction, covari: 'accept' });
    assert.equal(accepted.sourced, 1);
    assert.equal(accepted.scoreDetails.sourcing, 300);
    assert.equal(accepted.stars, 3, `${reaction}s handoffs keep three stars while outsourcing`);
    assert.equal(accepted.shipped, declined.shipped, 'Covari work adds no shipment');
    assert.equal(accepted.missed, 0);
    assert.equal(accepted.unfinished, 0);
    assert.ok(accepted.score > declined.score);
    assert.equal(accepted.score, Object.values(accepted.scoreDetails).reduce((total, points) => total + points, 0));
    const steps = accepted.log.filter(event => ['source-accept', 'sourceDelivered', 'sourceFulfilled'].includes(event.action)).map(event => event.action);
    assert.deepEqual(steps, ['source-accept', 'sourceDelivered', 'sourceFulfilled']);
  }
  assert.equal(simulateShift(NIGHT, { strategy: 'flow', reaction: .5 }).sourced, 0, 'Declining is the default and earns nothing');
  const expert = simulateShift(NIGHT, { reaction: .1, dash: true, covari: 'accept' });
  assert.equal(expert.stars, 3);
  assert.equal(expert.sourced, 1);
  assert.deepEqual(expert, simulateShift(NIGHT, { reaction: .1, dash: true, covari: 'accept' }));
  assert.ok(simulateShift(NIGHT, { strategy: 'flow', reaction: 1.5, covari: 'accept' }).stars >= 1, 'A slow player who outsources can still clear');
});

test('a stalled shift still ends at the clock without extra income', () => {
  const idle = new Driver(NIGHT, 'flow');
  idle.game.nextArrival = Infinity;
  idle.tick(night.duration + 1);
  assert.equal(idle.game.mode, 'results');
  assert.equal(idle.game.score, 0);
  assert.equal(idle.game.shipped, 0);
});

test('shipment points stay under the shared per-shipment score ceiling for every level', () => {
  for (const shift of SHIFTS) {
    const richest = Math.max(...shift.recipes.map(index => RECIPES[index].value));
    const best = scoreShipment({ value: richest, remaining: shift.deadline + 14 }, 5, { programming: shift.programming, rushBonus: shift.calls ? 100 : 0 });
    assert.ok(best.total <= 1600, `${shift.id} tops out at ${best.total}`);
  }
});

test('the hosted score board and challenge links accept Night Shift results with no support points', () => {
  const result = simulateShift(NIGHT, { reaction: .1, dash: true });
  const value = { role: NIGHT, score: result.score, shipped: result.shipped, missed: result.missed, sourced: 0, calls: 0, elapsed: result.elapsed, finishReason: result.finishReason, spawned: result.spawned };
  const run = { role: NIGHT, ruleset: RULESET, started_at: START };
  const now = START + result.elapsed * 1000;
  assert.equal(validateResult(value, run, now), null);
  const outsourced = simulateShift(NIGHT, { reaction: .1, dash: true, covari: 'accept' });
  const withCovari = { ...value, score: outsourced.score, shipped: outsourced.shipped, sourced: 1, elapsed: outsourced.elapsed, spawned: outsourced.spawned };
  assert.equal(validateResult(withCovari, run, START + outsourced.elapsed * 1000), null, 'One Covari job is a valid Night Shift result');
  assert.ok(validateResult({ ...withCovari, score: 200 }, run, START + outsourced.elapsed * 1000), 'The 300 Covari points cannot be missing');
  assert.ok(validateResult({ ...value, calls: 1 }, run, now), 'No customer calls on this level');
  assert.ok(validateResult({ ...value, sourced: 2 }, run, now), 'At most one Covari job per shift');
  assert.ok(validateResult({ ...value, shipped: night.maxOrders + 1 }, run, now));
  assert.ok(validateResult({ ...value, role: 2 }, run, now), 'A run cannot be posted as another level');
  assert.match(validateResult({ ...value, finishReason: 'time-up', elapsed: night.duration - 30 }, run, START + night.duration * 1000), /full shift/);

  const challenge = { role: NIGHT, score: result.score, shipped: result.shipped };
  assert.deepEqual(parseChallenge(new URL(challengeURL(challenge, 'https://play.example/')).search), { ...challenge, stars: 3 });
  assert.equal(parseChallenge(new URL(challengeURL({ ...challenge, shipped: night.maxOrders + 1 }, 'https://play.example/')).search), null);
  assert.equal(parseChallenge(new URL(challengeURL({ ...challenge, role: SHIFTS.length }, 'https://play.example/')).search), null);
});
