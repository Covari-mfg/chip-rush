// Dawn Shift is the fifth level. These checks cover its catalog entry, the
// Surface Grinder station, the per-map layout, precision Covari outsourcing,
// morning rush calls, save/score compatibility, and reproducible balance bounds.
// Balance rows are simulations, not player data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ShopGame, SHIFTS, RECIPES, OPS, RULESET, SOURCE_JOBS, FINISHING_SOURCE_JOBS, PRECISION_SOURCE_JOBS, stockType } from '../dist/core.js';
import { TECHNOLOGIES } from '../dist/technology.js';
import { challengeURL, parseChallenge } from '../dist/social.js';
import { validateResult } from '../server/worker.js';
import { simulateShift, navigation } from './balance.mjs';

const DAWN = 4;
const START = 1_800_000_000_000;
const dawn = SHIFTS[DAWN];

function advance(game, seconds) {
  for (let left = seconds; left > 1e-8; left -= .05) game.tick(Math.min(.05, left));
}
function fresh(shift = DAWN) {
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

test('Dawn Shift is appended at index 4 with a stable identity and Gemini 4 credit', () => {
  assert.equal(SHIFTS.length, 5);
  assert.equal(dawn.id, 'dawn-shift');
  assert.equal(dawn.mapId, 'dawn-shop');
  assert.equal(dawn.name, 'Dawn Shift');
  assert.equal(dawn.author, 'Gemini 4');
  assert.equal(dawn.harness, 'Cursor Cloud Agent');
  assert.equal(new Set(SHIFTS.map(shift => shift.id)).size, SHIFTS.length);
});

test('the four earlier shifts keep their exact configuration', () => {
  const released = SHIFTS.slice(0, 4).map(({ id, mapId, duration, firstArrival, interval, deadline, maxOrders, recipes, unlocks, stock, programming, sourcing, calls, callTimes, passTarget, stars }) =>
    ({ id, mapId, duration, firstArrival, interval, deadline, maxOrders, recipes, unlocks, stock, programming, sourcing, calls, callTimes, passTarget, stars }));
  assert.deepEqual(released, [
    { id:'first-shift', mapId:'first-shop', duration:150, firstArrival:18, interval:19, deadline:82, maxOrders:undefined, recipes:[0,1,0,1,0,1,0,1], unlocks:['lathe','mill','inspect'], stock:['round','plate'], programming:false, sourcing:false, calls:false, callTimes:[], passTarget:3, stars:[3,4,5] },
    { id:'mixed-orders', mapId:'first-shop', duration:180, firstArrival:16, interval:25, deadline:105, maxOrders:6, recipes:[0,1,6,0,1,6], unlocks:['lathe','mill','inspect'], stock:['round','plate','block'], programming:true, sourcing:true, calls:false, callTimes:[], passTarget:4, stars:[4,5,6] },
    { id:'rush-hour', mapId:'first-shop', duration:180, firstArrival:12, interval:18, deadline:105, maxOrders:8, recipes:[0,1,6,0,6,1,6,1], unlocks:['lathe','mill','inspect'], stock:['round','plate','block'], programming:true, sourcing:true, calls:true, callTimes:[27,77,127], passTarget:5, stars:[5,6,8] },
    { id:'night-shift', mapId:'night-shop', duration:210, firstArrival:20, interval:28, deadline:120, maxOrders:6, recipes:[2,5,4,3,4,2], unlocks:['lathe','mill','deburr','anodize','inspect'], stock:['round','plate','block'], programming:true, sourcing:true, calls:false, callTimes:[], passTarget:4, stars:[4,5,6] },
  ]);
});

test('Dawn Shift adds the Surface Grinder, finishing routes, morning calls, and precision Covari jobs', () => {
  assert.deepEqual(dawn.unlocks, ['lathe', 'mill', 'deburr', 'grind', 'anodize', 'inspect']);
  assert.equal(dawn.programming, true);
  assert.equal(dawn.calls, true);
  assert.deepEqual(dawn.callTimes, [40, 120]);
  assert.equal(dawn.sourcing, true);
  assert.equal(dawn.sourceJobs, PRECISION_SOURCE_JOBS);
  const operations = new Set(dawn.recipes.flatMap(index => RECIPES[index].route));
  for (const key of ['lathe', 'mill', 'deburr', 'grind', 'anodize', 'inspect']) {
    assert.ok(operations.has(key), `${key} is used by a Dawn Shift order`);
  }
  for (const index of dawn.recipes) {
    const recipe = RECIPES[index];
    assert.ok(recipe.route.every(key => dawn.unlocks.includes(key)), `${recipe.name} only needs stations Dawn Shift provides`);
    assert.ok(dawn.stock.includes(stockType(recipe)), `${recipe.name} has a stock bin`);
  }
});

test('the Surface Grinder stays unavailable in earlier shifts and processes precision parts on Dawn Shift', () => {
  for (const shift of [0, 1, 2, 3]) {
    const game = fresh(shift);
    assert.equal(game.interact('grind'), false);
    assert.match(game.drain().find(event => event.type === 'hint').message, /not needed in this shift/);
  }
  const game = fresh(DAWN);
  assert.equal(game.spawn(), true);
  const shaft = game.orders[0];
  assert.equal(shaft.name, 'Spindle shaft');
  program(game, shaft.id);
  assert.equal(game.interact('material-round'), true);
  run(game, 'lathe', OPS.lathe.duration);
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.heldOrder.route[game.heldOrder.index], 'grind');
  run(game, 'grind', OPS.grind.duration);
  assert.equal(game.stations.grind.ready, true);
  assert.equal(game.interact('grind'), true);
  assert.equal(game.heldOrder.route[game.heldOrder.index], 'deburr');
  run(game, 'deburr', OPS.deburr.duration);
  assert.equal(game.interact('deburr'), true);
  assert.equal(game.heldOrder.route[game.heldOrder.index], 'inspect');
});

test('Dawn Shift Covari jobs are real capability gaps with no station on the floor', () => {
  assert.equal(PRECISION_SOURCE_JOBS.length, SOURCE_JOBS.length);
  const stations = new Set([...Object.keys(OPS), ...Object.values(OPS).map(op => op.name.toLowerCase())]);
  for (const job of PRECISION_SOURCE_JOBS) {
    assert.ok(job.name && job.capability && job.gap, `${job.name} names its process and why the floor lacks it`);
    assert.ok(TECHNOLOGIES[job.technology], `${job.name} has a technology badge`);
    assert.equal(stations.has(job.technology) || stations.has(job.capability.toLowerCase()), false, `${job.capability} has no station on the floor`);
    assert.ok(!dawn.recipes.some(index => RECIPES[index].name === job.name), 'The shop never makes it itself');
  }
  assert.deepEqual(PRECISION_SOURCE_JOBS.map(job => job.technology), ['edm', 'ht', 'lm']);
  assert.equal(SHIFTS[3].sourceJobs, FINISHING_SOURCE_JOBS, 'Night Shift keeps its finishing source pool');
});

test('dawn-shop registers all precision and finishing stations and uses the dawn theme', async () => {
  const ids = mapId => Array.from(navigation.layout.filter(def => navigation.has(def, mapId)), def => def.id).sort();
  const base = ['buffer', 'inspect', 'lathe', 'material-block', 'material-plate', 'material-round', 'mill', 'office', 'receiving', 'ship'];
  assert.deepEqual(ids('dawn-shop'), [...base, 'anodize', 'deburr', 'grind'].sort());

  navigation.activate('first-shop');
  const grind = navigation.layout.find(station => station.id === 'grind');
  assert.ok(navigation.safe(grind.x, grind.z), 'Grinder leaves the first-shop floor walkable');
  navigation.activate('night-shop');
  assert.ok(navigation.safe(grind.x, grind.z), 'Grinder leaves the night-shop floor walkable');
  navigation.activate('dawn-shop');
  assert.equal(navigation.safe(grind.x, grind.z), false, 'Grinder is a solid collider on dawn-shop');
  navigation.activate('first-shop');

  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('const THEMES='), end = main.indexOf('\nfunction activeMapId');
  const themes = vm.runInNewContext(`(${main.slice(start + 'const THEMES='.length, end).replace(/;\s*$/, '')})`);
  assert.ok(themes.dawn, 'dawn theme exists');
  const luminance = hex => ((hex >> 16) & 255) * .2126 + ((hex >> 8) & 255) * .7152 + (hex & 255) * .0722;
  assert.ok(luminance(themes.dawn.sky) > luminance(themes.night.sky), 'Dawn sky is brighter than night sky');
  assert.ok(luminance(themes.dawn.sky) < luminance(themes.day.sky), 'Dawn sky is warmer/dimmer than midday sky');
});

test('Dawn Shift requires concurrent overlap to clear and rewards brisk flow with three stars', () => {
  const serial = simulateShift(DAWN, { strategy: 'serial', reaction: .5 });
  assert.equal(serial.pass, false, 'One-part-at-a-time play cannot clear all 5 target orders before the bell');
  const steadyFlow = simulateShift(DAWN, { strategy: 'flow', reaction: 1 });
  assert.ok(steadyFlow.pass, 'Concurrent flow at 1.0s reaction clears Dawn Shift');
  assert.equal(steadyFlow.stars, 2);
  const briskFlow = simulateShift(DAWN, { strategy: 'flow', reaction: .5 });
  assert.equal(briskFlow.stars, 3, '0.5s concurrent flow reaches three stars');
  assert.equal(briskFlow.shipped, dawn.maxOrders);
  assert.equal(briskFlow.missed, 0);
  const withCovari = simulateShift(DAWN, { strategy: 'flow', reaction: .5, covari: 'accept' });
  assert.equal(withCovari.stars, 3, '0.5s concurrent flow with Covari outsourcing still reaches three stars');
  assert.equal(withCovari.sourced, 1);
  assert.ok(withCovari.score > briskFlow.score);
});

test('Dawn Shift expert routes handle both morning rush calls and the Covari offer inside the clock', () => {
  const full = simulateShift(DAWN, { reaction: .1, dash: true, phonePolicy: 'accept', covari: 'accept' });
  assert.deepEqual(full, simulateShift(DAWN, { reaction: .1, dash: true, phonePolicy: 'accept', covari: 'accept' }));
  assert.equal(full.stars, 3);
  assert.equal(full.shipped, dawn.maxOrders);
  assert.equal(full.callsReceived, 2);
  assert.equal(full.callsAnswered, 2);
  assert.equal(full.rushesWon, 2);
  assert.equal(full.sourced, 1);
  assert.equal(full.finishReason, 'work-complete');
  assert.ok(full.lastShipmentAt <= dawn.duration);
  assert.equal(full.score, Object.values(full.scoreDetails).reduce((total, points) => total + points, 0));
});

test('the hosted score board and challenge links accept Dawn Shift results with calls and Covari', () => {
  const result = simulateShift(DAWN, { reaction: .1, dash: true, phonePolicy: 'accept', covari: 'accept' });
  const value = {
    role: DAWN,
    score: result.score,
    shipped: result.shipped,
    missed: result.missed,
    sourced: result.sourced,
    calls: result.callsAnswered,
    elapsed: result.elapsed,
    finishReason: result.finishReason,
    spawned: result.spawned
  };
  const run = { role: DAWN, ruleset: RULESET, started_at: START };
  const now = START + result.elapsed * 1000;
  assert.equal(validateResult(value, run, now), null);
  assert.ok(validateResult({ ...value, calls: 3 }, run, now), 'At most two calls on Dawn Shift');
  assert.ok(validateResult({ ...value, sourced: 2 }, run, now), 'At most one Covari job per shift');
  assert.ok(validateResult({ ...value, shipped: dawn.maxOrders + 1 }, run, now));

  const challenge = { role: DAWN, score: result.score, shipped: result.shipped };
  assert.deepEqual(parseChallenge(new URL(challengeURL(challenge, 'https://play.example/')).search), { ...challenge, stars: 3 });
});
