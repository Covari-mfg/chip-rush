// Night Shift is the fourth level. These checks cover its catalog entry, the
// finishing stations, the per-map layout, save/score compatibility, and
// reproducible balance bounds. Balance rows are simulations, not player data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ShopGame, SHIFTS, RECIPES, OPS, RULESET, scoreShipment, stockType } from '../dist/core.js';
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

test('Night Shift adds finishing routes without calls or Covari offers', () => {
  assert.deepEqual(night.unlocks, ['lathe', 'mill', 'deburr', 'anodize', 'inspect']);
  assert.equal(night.programming, true);
  assert.equal(night.calls, false);
  assert.equal(night.sourcing, false);
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
  assert.equal(game.sourcing, null);
  assert.equal(game.finishReason, 'time-up');
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
  assert.deepEqual(ids('night-shop'), [...original.filter(id => id !== 'receiving'), 'anodize', 'deburr'].sort());
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
    const defs = navigation.layout.filter(def => navigation.has(def, mapId));
    assert.ok(navigation.safe(navigation.spawn.x, navigation.spawn.z), `${mapId}: spawn is on open floor`);
    const solid = defs.filter(def => def.collidable !== false);
    for (const [index, a] of solid.entries()) for (const b of solid.slice(index + 1)) {
      const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2, overlapZ = Math.abs(a.z - b.z) < (a.d + b.d) / 2;
      assert.equal(overlapX && overlapZ, false, `${mapId}: ${a.id} and ${b.id} do not overlap`);
    }
    const starts = { spawn: navigation.spawn, ...Object.fromEntries(defs.map(def => [def.id, navigation.accesses[def.id]])) };
    for (const [from, origin] of Object.entries(starts)) for (const def of defs) {
      const target = navigation.accesses[def.id];
      assert.ok(navigation.safe(target.x, target.z), `${mapId}: ${def.id} access is outside every collider`);
      const path = navigation.route(origin, target);
      assert.ok(path.length || Math.hypot(origin.x - target.x, origin.z - target.z) < 1.4, `${mapId}: ${from} reaches ${def.id}`);
      let previous = origin;
      for (const point of path) { assert.ok(navigation.clear(previous, point), `${mapId}: ${from} to ${def.id} avoids corners`); previous = point; }
    }
    assert.ok(map.theme, `${mapId} names a theme`);
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
  assert.ok(navigation.safe(receiving.x, receiving.z), 'The unused receiving bench is cleared away in the night map');
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
  assert.equal(result.scoreDetails.sourcing, 0);
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
  assert.ok(validateResult({ ...value, calls: 1 }, run, now), 'No customer calls on this level');
  assert.ok(validateResult({ ...value, sourced: 1 }, run, now), 'No Covari offer on this level');
  assert.ok(validateResult({ ...value, shipped: night.maxOrders + 1 }, run, now));
  assert.ok(validateResult({ ...value, role: 2 }, run, now), 'A run cannot be posted as another level');
  assert.match(validateResult({ ...value, finishReason: 'time-up', elapsed: night.duration - 30 }, run, START + night.duration * 1000), /full shift/);

  const challenge = { role: NIGHT, score: result.score, shipped: result.shipped };
  assert.deepEqual(parseChallenge(new URL(challengeURL(challenge, 'https://play.example/')).search), { ...challenge, stars: 3 });
  assert.equal(parseChallenge(new URL(challengeURL({ ...challenge, shipped: night.maxOrders + 1 }, 'https://play.example/')).search), null);
  assert.equal(parseChallenge(new URL(challengeURL({ ...challenge, role: SHIFTS.length }, 'https://play.example/')).search), null);
});
