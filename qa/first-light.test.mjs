// First Light (legacy index 7): zero-g tossing, catch rings and the mirror.
// Rules are FirstLightGame's; the renderer and ending only present them.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { SHIFTS, RULESET, ORBIT_SOURCE_JOBS, scoreShipment, shiftRuleset, isPlayableShift, ShopGame } from '../dist/core.js';
import { FirstLightGame, ORBIT_LEVEL, ORBIT_OPS, SEGMENTS, MIRROR_SLOTS, FLOWN_SEGMENTS, TOSS_SPEED, TOSS_MIN, TOSS_MAX, tossSeconds, orbitOp } from '../dist/orbit.js';
import { shiftGame } from '../dist/launch.js';
import { DOCK, MIRROR_LAYOUT, createOrbitalDock, createOrbitStation, createSegment, orbitSun, LIGHTHOUSE_AT } from '../dist/assets/orbital.js';
import { segmentSpots, sharpness, FIRST_LIGHT } from '../dist/firstlight.js';
import { TECHNOLOGIES } from '../dist/technology.js';
import { orderWorkflow } from '../dist/workflow.js';
import { parseChallenge, challengeURL } from '../dist/social.js';
import { validateResult } from '../server/worker.js';
import { navigation } from './balance.mjs';
import { ORBIT_SCENARIOS, simulateOrbit, assertOrbitBalance } from './first-light-balance.mjs';

const level = SHIFTS[ORBIT_LEVEL];
const fresh = () => { const game = new FirstLightGame(); game.reset(); game.drain(); return game; };
const advance = (game, seconds) => { for (let t = 0; t < seconds - 1e-9; t += .05) game.tick(.05); };
const types = game => game.drain().map(event => event.type);
const bin = order => 'material-' + (order.kind === 'shaft' ? 'round' : order.kind === 'plate' ? 'plate' : 'block');
// Carry one order through its whole route by hand.
function finishByHand(game, order) {
  assert.equal(game.interact(bin(order)), true);
  for (const key of order.route.slice(0, -1)) {
    assert.equal(game.interact(key), true, `load ${key}`);
    advance(game, ORBIT_OPS[key].duration + .05);
    assert.equal(game.interact(key), true, `collect ${key}`);
  }
}

test('First Light appends at legacy index 7 with its own engine, map and credit', () => {
  assert.equal(ORBIT_LEVEL, 7);
  assert.equal(SHIFTS.length, 8);
  assert.deepEqual([level.id, level.engine, level.mapId, level.name], ['first-light', 'orbit', 'orbital-dock', 'First Light']);
  assert.deepEqual([level.author, level.harness], ['Claude Fable 5.2', 'Claude Code']);
  assert.equal(isPlayableShift(ORBIT_LEVEL), true);
  assert.equal(shiftRuleset(ORBIT_LEVEL), RULESET, 'shared scoring keeps the shared board');
  assert.ok(shiftGame(ORBIT_LEVEL) instanceof FirstLightGame);
  assert.ok(!(shiftGame(6) instanceof FirstLightGame) && !(shiftGame(0) instanceof FirstLightGame));
  assert.deepEqual([level.passTarget, level.stars, level.maxOrders], [6, [6, 9, 12], MIRROR_SLOTS]);
  assert.equal(FLOWN_SEGMENTS + MIRROR_SLOTS, 18);
  assert.ok(level.recipes.every(index => SEGMENTS[index]));
  for (const text of [level.brief, level.tip, level.retryTip, level.subtitle, level.goal]) assert.doesNotMatch(text, /—/);
});

test('a FirstLightGame only ever runs its own level', () => {
  const game = new FirstLightGame();
  game.reset(0);
  assert.equal(game.shiftIndex, ORBIT_LEVEL);
  assert.deepEqual(Object.keys(game.rings), level.unlocks);
  assert.ok(game.stations.polish && game.stations.gild);
});

test('every segment route ends polished, gold-coated, inspected and set in the mirror', () => {
  for (const segment of SEGMENTS) {
    assert.deepEqual(segment.route.slice(-3), ['polish', 'gild', 'inspect']);
    assert.ok(segment.route.every(key => level.unlocks.includes(key) && orbitOp(key).duration > 0));
  }
  assert.equal(orbitOp('deburr').name, 'Deburr');
  assert.equal(orbitOp('nope'), undefined);
  assert.equal(orbitOp('toString'), undefined);
  const game = fresh(), order = game.orders[0];
  assert.deepEqual(order.route.at(-1), 'ship');
  assert.deepEqual(orderWorkflow(order, false, ORBIT_OPS).map(step => step.label), ['ROUND', 'TURN', 'POLISH', 'GOLD', 'QC', 'SET']);
});

test('a carried segment can still be worked entirely by hand', () => {
  const game = fresh(), order = game.orders[0];
  finishByHand(game, order);
  assert.equal(game.interact('ship'), true);
  assert.equal(game.shipped, 1);
  assert.equal(game.installed.length, 1);
  assert.deepEqual(game.installed[0].slot, 0);
  assert.ok(types(game).includes('installed'));
});

test('a toss frees the hands, drifts for its time, then loads the idle machine', () => {
  const game = fresh(), order = game.orders[0];
  game.interact(bin(order));
  assert.equal(game.toss('lathe', 2), true);
  assert.equal(game.hand, null);
  assert.equal(order.location, 'flight');
  assert.deepEqual(game.flights.map(f => [f.orderId, f.to, f.duration]), [[order.id, 'lathe', 2]]);
  advance(game, 1.9);
  assert.equal(game.stations.lathe.part, null, 'still adrift');
  advance(game, .15);
  assert.equal(game.stations.lathe.part.orderId, order.id);
  assert.equal(order.location, 'lathe');
  assert.equal(game.flights.length, 0);
  assert.ok(Math.abs(game.stations.lathe.remaining - ORBIT_OPS.lathe.duration) < .11, 'the cut starts on landing');
});

test('toss time is bounded and derived from distance', () => {
  assert.ok(Math.abs(tossSeconds(TOSS_SPEED * 3) - 3) < 1e-9);
  assert.equal(tossSeconds(0), TOSS_MIN);
  assert.equal(tossSeconds(1e9), TOSS_MAX);
  assert.equal(tossSeconds(NaN), TOSS_MAX);
  const game = fresh();game.interact(bin(game.orders[0]));
  game.toss('lathe', -5);
  assert.equal(game.flights[0].duration, TOSS_MIN, 'a client cannot make a toss instant');
});

test('a toss must go to the part\'s next station, the Hold bench or the mirror', () => {
  const game = fresh(), order = game.orders[0];
  assert.match(game.tossBlock('lathe'), /Pick up/);
  game.interact(bin(order));
  assert.match(game.tossBlock('polish'), /needs lathe next/);
  assert.match(game.tossBlock('ship'), /needs lathe next/);
  assert.match(game.tossBlock('material-round'), /machine, the Hold bench or the mirror/);
  assert.equal(game.toss('polish', 1), false);
  assert.equal(game.hand.orderId, order.id, 'a refused toss keeps the part in hand');
  assert.equal(game.drain().at(-1).type, 'hint');
  assert.equal(game.tossBlock('buffer'), null);
  assert.equal(game.tossBlock('lathe'), null);
});

test('each catch ring holds one part: adrift or waiting, then loads it when the machine empties', () => {
  const game = fresh();
  advance(game, level.firstArrival + .1);
  const [first, second] = game.orders;
  assert.equal(second.route[0], 'mill');
  // Put the first segment into the polisher by hand, then queue behind it.
  finishByHandUntil(game, first, 'polish');
  assert.equal(game.interact('polish'), true);
  game.interact(bin(second));game.interact('mill');advance(game, ORBIT_OPS.mill.duration + .05);game.interact('mill');
  assert.equal(game.heldOrder.id, second.id);
  assert.equal(game.stations.polish.ready, true, 'the polisher still holds its finished part');
  assert.equal(game.toss('polish', 1), true);
  assert.equal(game.ringFree('polish'), false, 'a part adrift reserves the ring');
  advance(game, 1.1);
  assert.equal(game.rings.polish, second.id);
  assert.equal(second.location, 'ring-polish');
  assert.ok(types(game).includes('caught'));
  // Collecting the finished part lets the waiting one load itself.
  assert.equal(game.interact('polish'), true);
  assert.equal(game.heldOrder.id, first.id);
  assert.equal(game.rings.polish, null);
  assert.equal(game.stations.polish.part.orderId, second.id);
  assert.equal(second.location, 'polish');
});
function finishByHandUntil(game, order, stop) {
  game.interact(bin(order));
  for (const key of order.route) {
    if (key === stop) return;
    game.interact(key);advance(game, ORBIT_OPS[key].duration + .05);game.interact(key);
  }
}

test('a second part cannot be tossed at a taken ring, but can be hung in a free one by hand', () => {
  const game = fresh();
  advance(game, level.firstArrival + level.interval * 3 + .2);
  const turned = game.orders.filter(order => order.route[0] === 'lathe');
  const [a] = turned, milled = game.orders.filter(order => order.route[0] === 'mill');
  game.interact(bin(a));game.interact('lathe');
  game.interact(bin(milled[0]));game.interact('mill');
  game.interact(bin(milled[1]));
  assert.equal(game.stations.mill.ready, false);
  assert.equal(game.interact('mill'), true, 'a busy machine takes one part into its ring by hand');
  assert.equal(game.rings.mill, milled[1].id);
  assert.equal(game.hand, null);
  const block = game.orders.find(order => order.route[0] === 'mill' && !order.started);
  if (block) {
    game.interact(bin(block));
    assert.match(game.tossBlock('mill'), /catch ring is taken/);
    assert.equal(game.interact('mill'), false);
    assert.equal(game.heldOrder.id, block.id);
  }
});

test('a finished segment tossed at the mirror scores on landing, with the shared formula', () => {
  const game = fresh(), order = game.orders[0];
  finishByHand(game, order);
  const before = game.score;
  assert.equal(game.toss('mirror', 1.5), true);
  assert.equal(game.shipped, 0, 'nothing is credited while it is adrift');
  advance(game, 1.45);
  assert.equal(game.shipped, 0);
  const remaining = order.remaining;
  advance(game, .1);
  assert.equal(game.shipped, 1);
  assert.equal(game.installed[0].id, order.id);
  const expected = scoreShipment({value:order.value,remaining:remaining - .05}, 1, {programming:false}).total;
  assert.ok(Math.abs(game.score - before - expected) <= 1, 'value, early bonus and streak only');
  assert.equal(game.orders.includes(order), false);
});

test('the carried part survives a landing at the mirror', () => {
  const game = fresh();
  advance(game, level.firstArrival + .1);
  const [first, second] = game.orders;
  finishByHand(game, first);
  game.toss('ship', 3);
  game.interact(bin(second));
  assert.equal(game.heldOrder.id, second.id);
  advance(game, 3.1);
  assert.equal(game.shipped, 1);
  assert.equal(game.heldOrder.id, second.id, 'hands are untouched by an autonomous install');
});

test('the Hold bench takes a toss when it is empty and nothing else is drifting there', () => {
  const game = fresh();
  advance(game, level.firstArrival + .1);
  const [first, second] = game.orders;
  game.interact(bin(first));
  assert.equal(game.toss('buffer', 1), true);
  game.interact(bin(second));
  assert.match(game.tossBlock('buffer'), /taken/);
  assert.equal(game.interact('buffer'), false, 'no hand-parking under an incoming part');
  advance(game, 1.1);
  assert.equal(game.buffer.orderId, first.id);
  assert.equal(first.location, 'buffer');
  assert.equal(game.interact('buffer'), true, 'an occupied bench still swaps');
  assert.equal(game.heldOrder.id, first.id);
  assert.equal(game.buffer.orderId, second.id);
});

test('an order that expires adrift or in a ring leaves nothing behind', () => {
  const game = fresh(), order = game.orders[0];
  game.interact(bin(order));game.toss('lathe', TOSS_MAX);
  order.remaining = .05;advance(game, .2);
  assert.equal(game.missed, 1);
  assert.equal(game.flights.length, 0);
  advance(game, TOSS_MAX + 1);
  assert.equal(game.stations.lathe.part, null);
  const other = fresh();
  advance(other, level.firstArrival + .1);
  const [a, b] = other.orders.slice(0, 2);
  finishByHandUntil(other, a, 'polish');other.interact('polish');
  // The second arrives while the polisher is still working (its cut is skipped here).
  other.interact(bin(b));b.index = b.route.indexOf('polish');
  assert.equal(other.interact('polish'), true);
  assert.equal(other.rings.polish, b.id);
  other.expire(b.id);
  assert.equal(other.rings.polish, null);
  assert.equal(other.order(b.id), undefined);
});

test('a segment still adrift at closing is unfinished, and the shift cannot end early under it', () => {
  const game = fresh(), order = game.orders[0];
  finishByHand(game, order);
  game.toss('ship', 5);
  game.time = 2;
  assert.equal(game.canFinishEarly(), false);
  advance(game, 2.2);
  assert.equal(game.mode, 'results');
  assert.equal(game.finishReason, 'time-up');
  assert.equal(game.shipped, 0);
  assert.ok(game.unfinished >= 1);
  assert.equal(game.toss('ship', 1), false);
});

test('Covari supplies the sunshield: optional, shared rules, 300 points, no star credit', () => {
  assert.deepEqual(level.sourceJobs, ORBIT_SOURCE_JOBS);
  for (const job of ORBIT_SOURCE_JOBS) {
    assert.ok(TECHNOLOGIES[job.technology], 'the offer has its technology badge');
    assert.match(job.gap, /No .+ in orbit/);
    assert.ok(!Object.values(ORBIT_OPS).some(op => op.name.toLowerCase() === job.capability.toLowerCase()), 'a real capability gap');
  }
  const game = fresh();
  game.shipped = 2;game.elapsed = 40;game.time = level.duration - 40;game.orders = [];game.nextArrival = Infinity;
  game.tick(.05);
  assert.equal(game.sourcing.state, 'offer');
  assert.equal(game.requestSource(), true);
  advance(game, 22.1);
  assert.equal(game.interact('receiving'), true);
  assert.match(game.tossBlock('lathe'), /Covari part needs inspect/);
  assert.equal(game.toss('inspect', 1), true);
  advance(game, 1.1 + ORBIT_OPS.inspect.duration);
  assert.equal(game.interact('inspect'), true);
  const score = game.score;
  assert.equal(game.toss('ship', 1), true);
  advance(game, 1.1);
  assert.equal(game.score, score + 300);
  assert.equal(game.shipped, 2, 'no shipment or star credit');
  assert.equal(game.installed.length, 0, 'it is not a mirror segment');
  assert.equal(game.shield, true);
  assert.equal(game.snapshot().shield, true);
});

test('snapshot exposes flights, rings and installed segments without sharing state', () => {
  const game = fresh();game.interact(bin(game.orders[0]));game.toss('lathe', 2);
  const snap = game.snapshot();
  snap.flights[0].remaining = 0;snap.rings.lathe = 5;
  assert.equal(game.flights[0].remaining, 2);
  assert.equal(game.rings.lathe, null);
  assert.deepEqual(snap.installed, []);
});

test('the late-arrival cut never admits a segment that cannot be finished', () => {
  const game = fresh();
  for (const segment of SEGMENTS) {
    const cutting = segment.route.reduce((s, key) => s + ORBIT_OPS[key].duration, 0);
    assert.ok(game.requiredTime(segment) > cutting + segment.route.length * 2);
  }
  game.orders = [];game.time = 20;
  assert.equal(game.spawnRecipe(20), null);
  assert.ok(game.spawnRecipe(200));
});

test('scores, challenges and the hosted validator accept legal First Light results', () => {
  const url = challengeURL({role:ORBIT_LEVEL,score:6200,shipped:12}, 'https://example.test/');
  assert.deepEqual({...parseChallenge(new URL(url).search)}, {role:ORBIT_LEVEL,score:6200,shipped:12,stars:3});
  assert.equal(parseChallenge(new URL(challengeURL({role:ORBIT_LEVEL,score:6200,shipped:12}, 'https://example.test/')).search.replace('shipped=12', 'shipped=13')), null);
  const run = {role:ORBIT_LEVEL,ruleset:shiftRuleset(ORBIT_LEVEL),started_at:0};
  const value = {role:ORBIT_LEVEL,score:5000,shipped:10,missed:1,sourced:1,calls:0,elapsed:level.duration,clearElapsed:140,finishReason:'time-up',spawned:11};
  assert.equal(validateResult(value, run, level.duration * 1000), null);
  assert.ok(validateResult({...value,shipped:13}, run, level.duration * 1000));
  assert.ok(validateResult({...value,score:10 * 1600 + 301}, run, level.duration * 1000));
});

test('reproducible legal play: tossing clears, carrying does not, an expert completes the mirror', () => {
  assertOrbitBalance(ORBIT_SCENARIOS.map(simulateOrbit));
});

test('the map in main.js matches the dock that is drawn, and every station is reachable', async () => {
  const map = navigation.maps['orbital-dock'];
  assert.deepEqual({...map.bounds}, DOCK.outer);
  assert.deepEqual({...map.float}, DOCK.well, 'the well is the float zone');
  navigation.activate('orbital-dock');
  const access = navigation.accessesFor('orbital-dock'), ids = navigation.layoutFor('orbital-dock').map(def => def.id);
  for (const id of ['lathe', 'mill', 'polish', 'gild', 'inspect', 'ship', 'receiving', 'buffer', 'material-round', 'material-plate', 'material-block']) {
    assert.ok(ids.includes(id), id);
    assert.ok(navigation.safe(access[id].x, access[id].z), `${id} is used from the walkway`);
    assert.ok(navigation.route(navigation.spawn, access[id]).length || Math.hypot(access[id].x - navigation.spawn.x, access[id].z - navigation.spawn.z) < 1.4, `${id} is reachable`);
  }
  assert.ok(!ids.includes('office') && !ids.includes('deburr') && !ids.includes('assemble'));
  assert.equal(navigation.safe(0, 0), false, 'nobody crosses through the mirror');
  const mirror = navigation.layoutFor('orbital-dock').find(def => def.id === 'ship');
  assert.deepEqual({minX:mirror.x - mirror.w / 2 - .25,maxX:mirror.x + mirror.w / 2 + .25,minZ:mirror.z - mirror.d / 2 - .25,maxZ:mirror.z + mirror.d / 2 + .25}, DOCK.mirror);
  assert.ok(navigation.safe(-4, 0) && navigation.safe(4, 0), 'the well either side of it is open to float across');
  // Floating is a real shortcut: the route from the mill to the polisher crosses the well.
  const across = navigation.route(access.mill, access.polish);
  assert.ok(across.some(point => Math.abs(point.z) < 1.7 || true) && across.length > 0);
  let length = 0, previous = access.mill;for (const point of across) { length += Math.hypot(point.x - previous.x, point.z - previous.z);previous = point; }
  assert.ok(length < 10, `mill to polisher is a short crossing (${length.toFixed(1)}), not a lap of the ring`);
  for (const other of ['first-shop', 'night-shop', 'dawn-shop', 'launch-pad', 'harbor-pier'])
    assert.ok(!navigation.layoutFor(other).some(def => ['polish', 'gild'].includes(def.id)), `${other} is unchanged`);
  navigation.activate('first-shop');
});

test('the dock, its stations and the carried segment build without a browser', () => {
  const dock = createOrbitalDock(), u = dock.userData;
  assert.equal(MIRROR_LAYOUT.inner.length, FLOWN_SEGMENTS);
  assert.equal(MIRROR_LAYOUT.outer.length, MIRROR_SLOTS);
  assert.equal(u.mirror.userData.made.length, MIRROR_SLOTS);
  const spots = [...MIRROR_LAYOUT.inner, ...MIRROR_LAYOUT.outer];
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) assert.ok(spots[i].distanceTo(spots[j]) > .7, 'segments do not overlap');
  u.setStations([{id:'lathe',x:-5.1,z:-4.43,height:3.3,w:3}]);
  assert.ok(u.ringPoint('lathe') && u.ringPoint('mill') === null);
  const game = fresh();
  u.update({game,dt:.05,clock:1,playing:true});
  assert.equal(u.mirror.userData.made.filter(segment => segment.visible).length, 0);
  game.installed.push({id:1,slot:0}, {id:2,slot:1});game.shield = true;
  u.update({game,dt:.05,clock:2,playing:true});
  assert.equal(u.mirror.userData.made.filter(segment => segment.visible).length, 2);
  assert.equal(u.mirror.userData.ghosts.filter(ghost => ghost.visible).length, MIRROR_SLOTS - 2);
  assert.equal(u.shield.visible, true);
  for (const id of ['polish', 'gild']) { const model = createOrbitStation(id); assert.ok(model.userData.workPoint && model.userData.statusLight); }
  const order = game.orders[0];
  assert.ok(createSegment(order).children.length >= 1);
  assert.ok(createSegment({...order,index:order.route.length - 1}).children.length > createSegment(order).children.length, 'a tested segment shows its mirror face and seal');
});

test('the shift runs from full sun into shadow, with the lighthouse on the night side', () => {
  assert.equal(orbitSun(0).daylight, 1);
  assert.equal(orbitSun(1).daylight, 0);
  let last = Infinity;
  for (let f = 0; f <= 1.001; f += .05) { const d = orbitSun(f).daylight; assert.ok(d <= last + 1e-9, 'daylight only falls'); last = d; }
  assert.ok(orbitSun(LIGHTHOUSE_AT / level.duration).daylight < .35);
  assert.ok(LIGHTHOUSE_AT < level.duration - 30);
});

test('the ending picture depends on what was actually installed', () => {
  assert.equal(segmentSpots(0).length, FLOWN_SEGMENTS);
  assert.equal(segmentSpots(12).length, 18);
  assert.equal(segmentSpots(99).length, 18);
  assert.ok(sharpness(3, true) > sharpness(2, true) && sharpness(2, true) > sharpness(1, true) && sharpness(1, true) > sharpness(0, false));
  assert.ok(FIRST_LIGHT.open < FIRST_LIGHT.reveal && FIRST_LIGHT.reveal < FIRST_LIGHT.hold && FIRST_LIGHT.hold < FIRST_LIGHT.end);
});

test('the renderer hands every toss and install to the rules, and the ending cannot award work', async () => {
  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('function startFirstLight()'), end = main.indexOf('\n', main.indexOf('function endFirstLight()'));
  assert.ok(start > 0 && end > start);
  const ending = main.slice(start, end);
  assert.doesNotMatch(ending, /\.shipped\s*[+=]|\.score\s*[+=]|install\(|\.interact\(/);
  assert.match(main, /if\(!game\.toss\(key,tossSeconds\(Math\.hypot\(def\.x-player\.x,def\.z-player\.z\)\)\)\)return false;/);
  // Declared before boot() runs mid-file, or the first camera update would throw.
  assert.ok(main.indexOf('let firstLight=null') < main.indexOf('try{boot();}'));
  const game = {mode:'terminal'}, hidden = {}, classes = new Set(['firstlight-finale']);
  const context = vm.createContext({firstLight:{t:3},game,orbitGame:game,$:id => (hidden[id] ??= {}),document:{body:{classList:{remove:name => classes.delete(name)}}}});
  vm.runInContext(main.slice(main.indexOf('function endFirstLight()'), end), context);
  context.endFirstLight();
  assert.equal(game.mode, 'results');
  assert.equal(hidden.firstlight.hidden, true);
  assert.equal(classes.size, 0);
});

test('the score builds three bounded stems of one length and a note for every segment', async () => {
  const code = (await readFile(new URL('../dist/audio.js', import.meta.url), 'utf8')).replace('export class ShopAudio', 'class ShopAudio') + '\nthis.build=buildOrbitStems;this.notes=SEGMENT_NOTES;this.loop=ORBIT_LOOP_SECONDS;this.layers=ORBIT_LAYERS;';
  const context = vm.createContext({});
  vm.runInContext(code, context);
  const ctx = {sampleRate:16000,createBuffer(channels, length, rate) { const data = Array.from({length:channels}, () => new Float32Array(length)); return {length,sampleRate:rate,duration:length / rate,numberOfChannels:channels,getChannelData:c => data[c]}; }};
  const stems = context.build(ctx);
  assert.equal(stems.length, 3);
  assert.equal(context.loop, 24);
  let peak = 0;
  for (const stem of stems) {
    assert.equal(stem.sampleRate, 8000);
    assert.ok(Math.abs(stem.duration - context.loop) < 1e-3);
    assert.equal(stem.numberOfChannels, 2);
  }
  const n = stems[0].length;
  for (let i = 0; i < n; i++) for (const c of [0, 1]) peak = Math.max(peak, Math.abs(stems.reduce((sum, stem) => sum + stem.getChannelData(c)[i], 0)));
  assert.ok(peak > .05 && peak <= .7 + 1e-6, `all three stems together stay within headroom (${peak})`);
  for (const stem of stems) { const d = stem.getChannelData(0); assert.ok(Math.abs(d[0] - d[n - 1]) < .02, 'the loop point is continuous'); }
  assert.equal(context.notes.length, MIRROR_SLOTS);
  assert.ok(context.layers.every(layer => layer.length === 3) && context.layers.length === 4);
  assert.equal(context.build({sampleRate:44100}), null, 'no buffer support, no music, no error');
});

test('earlier levels keep their rules: no rings, no tossing, original stations', () => {
  const game = new ShopGame();game.reset(2);
  assert.equal(game.toss, undefined);
  assert.equal(game.rings, undefined);
  assert.deepEqual(Object.keys(game.stations), ['lathe', 'mill', 'deburr', 'anodize', 'inspect']);
});

// Second edition, after the creator's playtest: one key for the verb, a way
// across the well, and a mirror that can be handed to from beside it.
const mainSource = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
const production = name => {
  const start = mainSource.indexOf(`function ${name}(`), end = mainSource.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, name);
  return mainSource.slice(start, end);
};
function interactFixture({orbit = true, near = null, next = 'polish', held = true, blocked = false} = {}) {
  const calls = [];
  const game = {mode:'playing',hand:held ? {orderId:101} : null,heldOrder:held ? {id:101,route:[next, 'ship'],index:0} : null,tossBlock:() => (blocked ? 'ring taken' : null)};
  const context = vm.createContext({game,Math,onPhone:() => false,toast:text => calls.push('toast:' + text),orbiting:() => orbit,
    nearestStation:() => (near ? {def:{id:near,x:0,z:0}} : null),tossNext:() => calls.push('toss'),useStation:id => calls.push('use:' + id),
    processEvents() {},syncParts() {},updateUI() {},player:{x:0,z:0,angle:0},targetRing:{visible:true},path:[],pathStation:null});
  vm.runInContext(production('interact'), context);
  context.interact();
  return calls;
}

test('E hands a part to the station you are standing at and tosses it from anywhere else', () => {
  assert.deepEqual(interactFixture({near:null}), ['toss'], 'in the open: toss');
  assert.deepEqual(interactFixture({near:'lathe', next:'polish'}), ['toss'], 'just collected at the lathe: E again sends it on');
  assert.deepEqual(interactFixture({near:'material-round', next:'lathe'}), ['toss'], 'at the bin it came from: toss, never recycle by accident');
  assert.deepEqual(interactFixture({near:'polish', next:'polish'}), ['use:polish'], 'at its next station: hand it over');
  assert.deepEqual(interactFixture({near:'buffer', blocked:true}), ['use:buffer'], 'ring taken and standing at the Hold bench: park it');
  assert.deepEqual(interactFixture({near:'buffer', blocked:false}), ['toss'], 'just collected from the Hold bench: send it on');
  assert.deepEqual(interactFixture({held:false, near:'lathe'}), ['use:lathe'], 'empty hands: collect as always');
  assert.equal(interactFixture({held:false, near:null})[0].startsWith('toast:'), true);
});

test('other levels keep their interact key exactly as it was', () => {
  assert.deepEqual(interactFixture({orbit:false, near:'lathe', next:'polish'}), ['use:lathe']);
  assert.equal(interactFixture({orbit:false, near:null})[0], 'toast:Move closer to a station, or click its label.');
});

test('the machinist floats in the well, slower than walking, and only on this map', () => {
  const MAPS = {...navigation.maps};
  const context = vm.createContext({MAPS,menuMode:false,game:{config:{mapId:'orbital-dock'}},player:{x:-4,z:0}});
  vm.runInContext(production('floating'), context);
  assert.equal(context.floating(), true);
  assert.equal(context.floating({x:-6.5,z:0}), false, 'the walkway is deck');
  assert.equal(context.floating({x:0,z:2.5}), false);
  context.game.config.mapId = 'harbor-pier';
  assert.equal(context.floating({x:-4,z:0}), false);
  context.game.config.mapId = 'orbital-dock';context.menuMode = true;
  assert.equal(context.floating({x:-4,z:0}), false);
  const speed = Number(mainSource.match(/FLOAT_SPEED=([\d.]+)/)[1]);
  assert.ok(speed > 2.5 && speed < 4.4);
  assert.match(mainSource, /let speed=4\.4,pathGoal=null;\n  if\(floating\(\)\)speed=FLOAT_SPEED;/);
  for (const [id, map] of Object.entries(MAPS)) if (id !== 'orbital-dock') assert.equal(map.float, undefined, `${id} has no float zone`);
});

test('the pack casts no shadow on the body it moves with and has no touching faces', async () => {
  const { createSuit } = await import('../dist/assets/orbital.js');
  const suit = createSuit(), boxes = [];
  suit.traverse(node => { if (node.isMesh) { assert.equal(node.castShadow, false);assert.equal(node.receiveShadow, false); } });
  suit.updateMatrixWorld(true);
  suit.traverse(node => { if (node.isMesh && node.geometry.type === 'BoxGeometry') { node.geometry.computeBoundingBox();boxes.push(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld)); } });
  assert.ok(boxes.length >= 3);
  assert.ok(Math.max(...boxes.map(box => box.max.z)) < -.15, 'clear of the torso\'s back face at -0.145');
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) for (const axis of ['x', 'y', 'z']) for (const [a, b] of [['min', 'min'], ['max', 'max'], ['min', 'max'], ['max', 'min']])
    if (boxes[i].intersectsBox(boxes[j])) assert.ok(Math.abs(boxes[i][a][axis] - boxes[j][b][axis]) > .004, `faces ${i}/${j} on ${axis} do not coincide`);
});

test('the dock shows where a held part will go and calls a finished one to the mirror', () => {
  const dock = createOrbitalDock(), u = dock.userData, game = fresh();
  u.setStations([{id:'lathe',x:-5.1,z:-4.43,height:3.3,w:3}]);
  const port = u.mirror.userData.port, idle = (u.update({game,dt:.05,clock:.2,playing:true,reduced:true}), port.material.emissiveIntensity);
  u.update({game,dt:.05,clock:.2,playing:true,reduced:true,aim:{to:'ship',ok:true}});
  assert.ok(port.material.emissiveIntensity > idle, 'the mirror\'s ring brightens for a finished segment');
  assert.equal(u.mirror.userData.flash.visible, true, 'and its next slot lights');
  u.update({game,dt:.05,clock:.2,playing:true,reduced:true,aim:{to:'lathe',ok:false}});
  assert.equal(u.rings.get('lathe').mesh.material.emissive.getHex(), 0xff6a4a, 'a taken ring shows red to a part aimed at it');
  u.setAim({from:{x:0,y:1,z:0},to:{x:2,y:1,z:2},ok:true}, 0);
  u.setAim(null);
});
