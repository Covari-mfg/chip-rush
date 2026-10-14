// Blackout Shift (`dawn-shift`, legacy index 4) is the fifth level (Iteration 2).
// Instead of adding "one more machine", it reconfigures the floor into West/East
// machining cells around a central Inspection hub and a 3D Backup Generator,
// drops CAD programming so every ticket starts immediately on the floor, adds
// 1.5x Harmonic Overdrive when 2+ machines run in parallel, 2.0x Generator
// Surges from the Office Surge Console and scheduled coastal lightning strikes,
// a synthesized 128 BPM storm-synth soundtrack, and Covari capability-gap offers.
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

test('Blackout Shift stays at index 4 with stable id dawn-shift and Gemini 4 credit', () => {
  assert.equal(SHIFTS.length, 5);
  assert.equal(dawn.id, 'dawn-shift');
  assert.equal(dawn.mapId, 'dawn-shop');
  assert.equal(dawn.name, 'Blackout Shift');
  assert.equal(dawn.musicTrack, 'storm');
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

test('Blackout Shift does not add another station: it uses existing 5 stations with zero CAD delay and overdrive', () => {
  assert.deepEqual(Object.keys(OPS), ['lathe', 'mill', 'deburr', 'anodize', 'inspect', 'ship']);
  assert.deepEqual(dawn.unlocks, ['lathe', 'mill', 'deburr', 'anodize', 'inspect']);
  assert.equal(dawn.programming, false, 'Emergency storm orders arrive pre-programmed');
  assert.equal(dawn.overdrive, true, 'Generator overdrive mechanic is enabled');
  assert.equal(dawn.calls, false);
  assert.equal(dawn.sourcing, true);
  assert.equal(dawn.sourceJobs, PRECISION_SOURCE_JOBS);
  assert.equal(dawn.maxOrders, 8);
  assert.deepEqual(dawn.stars, [5, 6, 8]);
  for (const index of dawn.recipes) {
    const recipe = RECIPES[index];
    assert.ok(recipe.route.every(key => dawn.unlocks.includes(key)), `${recipe.name} only needs existing stations`);
    assert.ok(dawn.stock.includes(stockType(recipe)), `${recipe.name} has a stock bin`);
  }
});

test('Harmonic Overdrive accelerates machine cycles 1.5x when 2+ machines run simultaneously', () => {
  const game = fresh(DAWN);
  game.surgeRemaining = 0;
  game.stormStrikes = [];
  assert.equal(game.machineSpeed(), 1, 'Idle shop runs at 1.0x');

  assert.equal(game.spawn(), true); // Turbine coupling: lathe -> mill -> deburr -> inspect (round)
  game.spawnIndex = 1; // Breaker busbar: mill -> deburr -> anodize -> inspect (plate)
  assert.equal(game.spawn(), true);

  assert.equal(game.interact('material-round'), true);
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.runningStations(), 1);
  assert.equal(game.machineSpeed(), 1, 'Single running machine stays at 1.0x');

  // Advance 2s at 1.0x: lathe goes from 8s -> 6s
  advance(game, 2.0);
  assert.ok(Math.abs(game.stations.lathe.remaining - 6.0) < 0.06);

  // Load mill in parallel -> 2 running stations engage 1.5x Harmonic Overdrive!
  assert.equal(game.interact('material-plate'), true);
  assert.equal(game.interact('mill'), true);
  assert.equal(game.runningStations(), 2);
  assert.equal(game.machineSpeed(), 1.5, '2+ running machines engage 1.5x Harmonic Overdrive');

  // Advance 4s of wall clock -> 6s of machine work! Lathe finishes its remaining 6s in 4s.
  advance(game, 4.05);
  assert.equal(game.stations.lathe.ready, true, 'Lathe finishes 6s of work in 4s under 1.5x Harmonic Overdrive');
});

test('Office Surge Console and coastal lightning strikes trigger 2.0x Generator Surge', () => {
  const game = fresh(DAWN);
  assert.ok(game.surgeRemaining > 0, 'Blackout Shift starts with an opening capacitor boost');
  assert.equal(game.machineSpeed(), 2.0);

  // Drain opening surge and cooldown
  game.surgeRemaining = 0;
  game.surgeCooldown = 0;
  game.stormStrikes = [50, 105, 148];
  game.stormIndex = 0;
  assert.equal(game.machineSpeed(), 1.0);

  // Walking into the Office triggers the manual 16s 2.0x Generator Surge
  game.setOfficePresence(true);
  assert.equal(game.surgeRemaining, 16);
  assert.equal(game.machineSpeed(), 2.0);
  const events = game.drain();
  assert.ok(events.some(e => e.type === 'surge' && e.source === 'office'));
  game.setOfficePresence(false);

  // Scheduled lightning strike at 50s elapsed supercharges the floor
  game.surgeRemaining = 0;
  game.elapsed = 49.9;
  advance(game, 0.2);
  assert.ok(game.surgeRemaining > 9.5, 'Lightning strike at 50s triggers a 10s 2.0x surge');
  assert.ok(game.drain().some(e => e.type === 'surge' && e.source === 'lightning'));
});

test('Blackout Shift Covari jobs are real capability gaps with no station on the floor', () => {
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

test('dawn-shop reconfigures stations around a central Inspection hub and Backup Generator obstacle', async () => {
  const firstAccess = navigation.accessesFor('first-shop');
  const dawnAccess = navigation.accessesFor('dawn-shop');
  assert.notDeepEqual(dawnAccess.inspect, firstAccess.inspect, 'Inspection moves to the central hub on dawn-shop');
  assert.ok(Math.abs(dawnAccess.inspect.x - 0) < 0.5 && Math.abs(dawnAccess.inspect.z - (-0.32)) < 0.5, 'Inspection is centered on the shop floor');
  assert.ok(dawnAccess.deburr.x < -1.5, 'Deburr is in the West cell with Lathe');
  assert.ok(dawnAccess.anodize.x > 1.5, 'Anodize is in the East cell with Mill');

  navigation.activate('dawn-shop');
  assert.equal(navigation.safe(-0.4, -4.65), false, 'Backup Generator rig is a solid collider on dawn-shop');
  for (const [id, point] of Object.entries(dawnAccess)) {
    assert.ok(navigation.safe(point.x, point.z), `${id} access point is walkable on dawn-shop`);
    const route = navigation.route({ x: -1.1, z: 1.55 }, point, 'dawn-shop');
    assert.ok(route.length >= 1, `A* route reaches ${id} on dawn-shop`);
  }
  navigation.activate('first-shop');

  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('const THEMES='), end = main.indexOf('\nfunction activeMapId');
  const themes = vm.runInNewContext(`(${main.slice(start + 'const THEMES='.length, end).replace(/;\s*$/, '')})`);
  assert.ok(themes.dawn, 'dawn storm theme exists');
});

test('Blackout Shift rewards multi-machine parallel overdrive with three stars', () => {
  const serial = simulateShift(DAWN, { strategy: 'serial', reaction: .5 });
  assert.equal(serial.stars, 1, 'Serial one-part-at-a-time play misses Harmonic Overdrive and gets 1 star');
  const briskFlow = simulateShift(DAWN, { strategy: 'flow', reaction: .5 });
  assert.equal(briskFlow.stars, 3, '0.5s concurrent flow engages Harmonic Overdrive and reaches three stars');
  assert.equal(briskFlow.shipped, dawn.maxOrders);
  assert.equal(briskFlow.missed, 0);
  const withCovari = simulateShift(DAWN, { strategy: 'flow', reaction: .5, covari: 'accept' });
  assert.equal(withCovari.stars, 3, '0.5s concurrent flow with Covari outsourcing reaches three stars');
  assert.equal(withCovari.sourced, 1);
  assert.ok(withCovari.score > briskFlow.score);
});

test('the hosted score board and challenge links accept Blackout Shift results', () => {
  const result = simulateShift(DAWN, { reaction: .1, dash: true, covari: 'accept' });
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
  assert.ok(validateResult({ ...value, calls: 1 }, run, now), 'No customer calls on Blackout Shift');
  assert.ok(validateResult({ ...value, sourced: 2 }, run, now), 'At most one Covari job per shift');
  assert.ok(validateResult({ ...value, shipped: dawn.maxOrders + 1 }, run, now));

  const challenge = { role: DAWN, score: result.score, shipped: result.shipped };
  assert.deepEqual(parseChallenge(new URL(challengeURL(challenge, 'https://play.example/')).search), { ...challenge, stars: 3 });
});
