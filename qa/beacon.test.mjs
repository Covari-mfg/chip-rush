// Engine commands cover the harbor's delivery contract. Prepared-part fixtures
// skip cutting only where the test concerns the quay rather than machining.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopGame, SHIFTS, OPS, scoreShipment, stockType } from '../dist/core.js';
import { BeaconGame, BEACON_LEVEL, BEACON_RECIPES, CROSSING_SECONDS, TENDER_CAPACITY,crossingWindow } from '../dist/beacon.js';
import { LaunchGame, shiftGame } from '../dist/launch.js';
import { TECHNOLOGIES, technologyBadges } from '../dist/technology.js';
import { simulateBeacon, assertBeaconBalance } from './beacon-balance.mjs';

const LEVEL = 6;
const config = SHIFTS[LEVEL];
const EPSILON = 1e-7;

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < EPSILON, `${message}: ${actual} ≈ ${expected}`);
}
function advance(game, seconds) {
  for (let left = seconds; left > 1e-8; left -= .05) game.tick(Math.min(.05, left));
}
function fresh() {
  const game = shiftGame(LEVEL);
  game.nextArrival = Infinity;
  advance(game,20);
  game.drain();
  return game;
}
function use(game, station) {
  assert.equal(game.interact(station), true, `${station} should accept the action`);
}
function refused(game, station, pattern) {
  game.drain();
  assert.equal(game.interact(station), false, `${station} should refuse the action`);
  if (pattern) assert.match(game.drain().find(event => event.type === 'hint')?.message ?? '', pattern);
}
function spawn(game) {
  assert.equal(game.spawn(), true, 'The next ordinary order can arrive');
  return game.orders.at(-1);
}
function pick(game, order) {
  game.select(order.id);
  use(game, 'material');
  assert.equal(game.hand.orderId, order.id);
}
function preparedInHands(game, order = game.orders.find(candidate => !candidate.started)) {
  pick(game, order);
  order.index = order.route.indexOf('ship');
  return order;
}
function stage(game, order) {
  preparedInHands(game, order);
  use(game, 'ship');
  return order;
}
function sourceAtReceiving() {
  const game = fresh();
  const first = game.orders[0], second = spawn(game);
  spawn(game); // Unfinished ordinary work keeps the shift running after arrival.
  stage(game, first); stage(game, second);
  assert.equal(game.sourcing, null, 'Quay loading does not unlock outside capability');
  use(game, 'ship');
  advance(game, CROSSING_SECONDS);
  assert.equal(game.shipped, 2);
  advance(game, 35.05 - game.elapsed);
  assert.equal(game.sourcing?.state, 'offer');
  use(game, 'source');
  advance(game, 22.05);
  assert.equal(game.sourcing.state, 'delivered');
  return game;
}
function inspectSource(game) {
  use(game, 'receiving');
  refused(game, 'ship', /inspect/i);
  use(game, 'inspect');
  advance(game, OPS.inspect.duration + .05);
  use(game, 'inspect');
}

test('Last Light appends legacy index 6 with a distinct stable identity and harbor rules', () => {
  assert.equal(BEACON_LEVEL, LEVEL);
  assert.deepEqual(SHIFTS.slice(0, LEVEL).map(level => level.id),
    ['first-shift', 'mixed-orders', 'rush-hour', 'night-shift', 'dawn-shift', 'launch-window']);
  assert.equal(SHIFTS[1].retired, true, 'The retired slot remains reserved');
  assert.equal(new Set(SHIFTS.map(level => level.id)).size, SHIFTS.length);
  assert.deepEqual([config.id, config.name, config.engine, config.mapId, config.musicTrack],
    ['last-light', 'Last Light', 'beacon', 'harbor-pier', 'harbor']);
  assert.deepEqual([config.author, config.harness], ['GPT-6.1 Sol', 'Codex']);
  assert.deepEqual({ duration:config.duration, maxOrders:config.maxOrders, passTarget:config.passTarget, stars:config.stars },
    { duration:220, maxOrders:12, passTarget:6, stars:[6, 9, 12] });
  assert.equal(config.programming, false);
  assert.equal(config.calls, false);
  assert.deepEqual(config.unlocks, ['lathe', 'mill', 'inspect']);
  assert.deepEqual(config.stock, ['round', 'plate', 'block']);
  assert.ok(config.recipes.every(index => BEACON_RECIPES[index]));
  assert.equal(config.recipes.length, config.maxOrders);
  assert.equal(TENDER_CAPACITY, 3);
  assert.equal(CROSSING_SECONDS, 12);
  for (const recipe of BEACON_RECIPES) {
    assert.equal(recipe.route.at(-1), 'inspect', `${recipe.name} ends with QC`);
    assert.ok(recipe.route.every(station => config.unlocks.includes(station)), recipe.name);
    assert.ok(config.stock.includes(stockType(recipe)), recipe.name);
  }
});

test('the level factory uses BeaconGame while earlier engines keep their behavior', () => {
  assert.ok(shiftGame(LEVEL) instanceof BeaconGame);
  assert.ok(shiftGame(5) instanceof LaunchGame);
  for (const index of [0, 2, 3, 4]) {
    const game = shiftGame(index);
    assert.ok(game instanceof ShopGame);
    assert.equal(game instanceof BeaconGame, false);
    assert.equal(game instanceof LaunchGame, false);
  }
  const game = new BeaconGame();
  game.reset();
  assert.equal(game.shiftIndex, LEVEL);
  assert.equal(game.orders[0].name, BEACON_RECIPES[config.recipes[0]].name);
});

test('machining and QC load the quay; an explicit second action sends a partial batch', () => {
  const game = fresh(), order = game.orders[0];
  spawn(game); // Keep work present so the complete return journey can run.
  pick(game, order);
  refused(game, 'ship', /still needs/);
  for (const station of order.route.slice(0, -1)) {
    use(game, station);
    advance(game, OPS[station].duration + .05);
    use(game, station);
  }
  use(game, 'ship');
  assert.deepEqual(game.quay, [order.id]);
  assert.equal(order.location, 'quay');
  assert.equal(game.hand, null);
  assert.equal(game.tender.phase, 'docked');
  assert.equal(game.shipped, 0);
  assert.equal(game.score, 0);
  assert.equal(game.clearElapsed, null);
  assert.equal(game.stars(), 0);
  const stagedDeadline = order.remaining;
  advance(game, .2);
  near(order.remaining, stagedDeadline - .2, 'The quay still consumes the customer deadline');
  assert.equal(game.tender.phase, 'docked', 'Waiting never sends the boat automatically');
  if(!crossingWindow(game.elapsed).open)advance(game,crossingWindow(game.elapsed).remaining);
  const departureDeadline = order.remaining;
  use(game, 'ship');
  assert.deepEqual(game.quay, []);
  assert.deepEqual(game.tender.cargo, [order.id]);
  assert.equal(order.location, 'tender');
  advance(game, 11.9);
  assert.equal(game.shipped, 0);
  assert.equal(game.score, 0);
  near(order.remaining, departureDeadline, 'Aboard deadlines and early-delivery bonus freeze');
  advance(game, .1);
  assert.equal(game.shipped, 1);
  assert.equal(game.score, scoreShipment({ value:order.value, remaining:departureDeadline }, 1).total);
  assert.equal(game.order(order.id), undefined);
  assert.equal(game.tender.phase, 'returning');
  near(game.tender.remaining, 12, 'The return is another full crossing');
  advance(game, 11.9);
  assert.equal(game.tender.phase, 'returning');
  advance(game, .1);
  assert.equal(game.tender.phase, 'docked');
  assert.equal(game.shipped, 1, 'The return does not award another shipment');
});

test('the quay holds three parts, never auto-sails, and preserves a fourth held part', () => {
  const game = fresh();
  while (game.orders.length < 4) spawn(game);
  const parts = [...game.orders];
  for (const order of parts.slice(0, 3)) stage(game, order);
  advance(game, .1);
  assert.equal(game.tender.phase, 'docked');
  assert.equal(game.quay.length, 3);
  preparedInHands(game, parts[3]);
  refused(game, 'ship', /quay is full/i);
  assert.equal(game.hand.orderId, parts[3].id);
  assert.equal(parts[3].location, 'hands');
  assert.deepEqual(game.quay, parts.slice(0, 3).map(order => order.id));
  use(game, 'buffer');
  use(game, 'ship');
  assert.deepEqual(game.tender.cargo, parts.slice(0, 3).map(order => order.id));
  assert.equal(game.buffer.orderId, parts[3].id);
  assert.equal(game.shipped, 0);
  advance(game, 12);
  assert.equal(game.shipped, 3);
});

test('work can stage while the tender is away, but the next batch waits for its return', () => {
  const game = fresh(), first = game.orders[0], second = spawn(game);
  spawn(game);
  stage(game, first); use(game, 'ship');
  stage(game, second);
  refused(game, 'ship', /Tender returns/);
  assert.deepEqual(game.quay, [second.id]);
  assert.deepEqual(game.tender.cargo, [first.id]);
  advance(game, 12);
  assert.equal(game.shipped, 1);
  assert.deepEqual(game.quay, [second.id]);
  refused(game, 'ship', /Tender returns/);
  advance(game, 12);
  assert.equal(game.tender.phase, 'docked');
  refused(game,'ship',/Next crossing window/);
  advance(game,crossingWindow(game.elapsed).remaining);
  use(game, 'ship');
  assert.deepEqual(game.tender.cargo, [second.id]);
  assert.equal(game.shipped, 1);
  advance(game, 12);
  assert.equal(game.shipped, 2);
});

test('autonomous arrival preserves a different part already in the player’s hands', () => {
  const game = fresh(), sent = game.orders[0], working = spawn(game);
  stage(game, sent); use(game, 'ship');
  pick(game, working);
  const hand = { ...game.hand };
  advance(game, 12);
  assert.equal(game.shipped, 1);
  assert.deepEqual(game.hand, hand);
  assert.equal(game.heldOrder.id, working.id);
  assert.equal(working.location, 'hands');
  assert.equal(working.index, 0);
  use(game, working.route[0]);
  assert.equal(game.stations[working.route[0]].part.orderId, working.id,
    'The preserved part remains usable at its next machine');
});

test('pausing freezes the tender, staged deadlines, machines, and shift clock', () => {
  const game = fresh(), first = game.orders[0], second = spawn(game), third = spawn(game);
  stage(game, first); use(game, 'ship');
  stage(game, second);
  pick(game, third); use(game, third.route[0]);
  advance(game, .3);
  game.drain();
  game.mode = 'paused';
  const before = game.snapshot();
  advance(game, 20);
  assert.deepEqual(game.snapshot(), before);
  assert.equal(game.interact('ship'), false);
  assert.equal(game.interact(third.route[0]), false);
  game.mode = 'playing';
  advance(game, .1);
  near(game.time, before.time - .1, 'Shift time resumes');
  near(game.tender.remaining, before.tender.remaining - .1, 'The tender resumes');
  near(second.remaining, before.orders.find(order => order.id === second.id).remaining - .1, 'Staged deadlines resume');
  near(game.stations[third.route[0]].remaining, before.stations[third.route[0]].remaining - .1, 'Machining resumes');
});

test('a quay deadline can expire, while even a nearly due part survives safely aboard', () => {
  const waiting = fresh(), expired = waiting.orders[0];
  spawn(waiting);
  stage(waiting, expired);
  expired.remaining = .1;
  advance(waiting, .15);
  assert.equal(waiting.order(expired.id), undefined);
  assert.deepEqual(waiting.quay, []);
  assert.equal(waiting.missed, 1);
  assert.equal(waiting.shipped, 0);
  refused(waiting, 'ship', /Load a finished part/);

  const sailing = fresh(), rescued = sailing.orders[0];
  stage(sailing, rescued);
  rescued.remaining = .1;
  use(sailing, 'ship');
  advance(sailing, 12);
  assert.equal(sailing.shipped, 1);
  assert.equal(sailing.missed, 0);
});

test('arrival exactly at closing counts, and a departure with less than 12 seconds refuses', () => {
  const onTime = fresh(), order = onTime.orders[0];
  stage(onTime, order);
  onTime.time = 12;
  onTime.elapsed = config.duration - 12;
  use(onTime, 'ship');
  advance(onTime, 12);
  assert.equal(onTime.mode, 'results');
  assert.equal(onTime.finishReason, 'time-up');
  assert.equal(onTime.shipped, 1);
  assert.equal(onTime.unfinished, 0);
  assert.ok(onTime.score > 0);

  const tooLate = fresh(), lateOrder = tooLate.orders[0];
  stage(tooLate, lateOrder);
  tooLate.time = 11.99;
  refused(tooLate, 'ship', /Too late.*12 seconds/);
  assert.equal(tooLate.tender.phase, 'docked');
  assert.deepEqual(tooLate.quay, [lateOrder.id]);
  advance(tooLate, 12);
  assert.equal(tooLate.shipped, 0);
  assert.equal(tooLate.unfinished, 1);
  assert.equal(tooLate.score, 0);
});

test('clear time and stars begin at lighthouse arrival, including the closing instant', () => {
  const game = fresh(), order = game.orders[0];
  // The previous three deliveries are established state; this command is the
  // ordinary shipment that crosses the clear threshold.
  game.shipped = config.passTarget - 1;
  stage(game, order);
  game.time = 12;
  game.elapsed = config.duration - 12;
  assert.equal(game.clearElapsed, null);
  assert.equal(game.stars(), 0);
  use(game, 'ship');
  advance(game, 11.9);
  assert.equal(game.passed(), false);
  assert.equal(game.clearElapsed, null);
  advance(game, .1);
  assert.equal(game.passed(), true);
  assert.equal(game.stars(), 1);
  near(game.clearElapsed, config.duration, 'Clear time records arrival, not loading or departure');
  near(game.snapshot().clearElapsed, config.duration, 'The recorded clear time is available to results');
});

test('the final crossing cannot finish early or receive credit before arrival', () => {
  const game = fresh();
  stage(game, game.orders[0]);
  use(game, 'ship');
  advance(game, 11.9);
  assert.equal(game.mode, 'playing');
  assert.equal(game.canFinishEarly(), false);
  assert.equal(game.shipped, 0);
  assert.equal(game.finishReason, null);
  advance(game, .1);
  assert.equal(game.shipped, 1);
  advance(game, .05);
  assert.equal(game.mode, 'results');
  assert.equal(game.finishReason, 'work-complete');
  assert.equal(game.unfinished, 0);
  const score = game.score;
  advance(game, 30);
  assert.equal(game.score, score);
});

test('unfinished ordinary parts count once at closing and reset cannot leak the old boat', () => {
  const game = fresh(), first = game.orders[0], second = spawn(game);
  spawn(game);
  stage(game, first); stage(game, second); use(game, 'ship');
  game.time = .05; // Interrupted shift fixture: the crossing is unfinished.
  advance(game, .1);
  assert.equal(game.mode, 'results');
  assert.equal(game.unfinished, 3);
  assert.equal(game.shipped, 0);
  assert.equal(game.missed, 0);
  advance(game, 30);
  assert.equal(game.shipped, 0);
  assert.equal(game.score, 0);
  assert.equal(game.drain().filter(event => event.type === 'finish').length, 1);
  game.reset();
  assert.deepEqual(game.quay, []);
  assert.deepEqual(game.tender, { phase:'docked', remaining:0, cargo:[], trips:0 });
  assert.deepEqual(game.installed, []);
  assert.equal(game.unfinished, 0);
  assert.equal(game.shipped, 0);
  assert.equal(game.score, 0);
});

test('Covari offers a real optical capability absent from the floor', () => {
  assert.equal(config.sourcing, true);
  assert.deepEqual(config.sourceJobs, [{ name:'Ground Fresnel optic', capability:'Precision optical grinding',
    technology:'optics', gap:'No optical grinding equipment on the pier' }]);
  const game = sourceAtReceiving(), job = game.sourcing;
  assert.equal(job.capability, 'Precision optical grinding');
  assert.equal(job.technology, 'optics');
  assert.equal(TECHNOLOGIES[job.technology].name, job.capability);
  assert.match(technologyBadges([job.technology]), /aria-label="Precision optical grinding"/);
  assert.equal(config.unlocks.includes(job.technology), false);
  assert.ok(BEACON_RECIPES.every(recipe => !recipe.route.includes(job.technology)));
  assert.deepEqual(job.route, ['inspect', 'ship']);
  assert.equal(game.orders.length, 1, 'The outside job consumes no ordinary order slot');
  assert.equal(game.sourcePoints, 0, 'Supplier arrival itself pays nothing');
});

test('the sourced optic needs QC and a tender crossing for exactly 300 points and no star credit', () => {
  const game = sourceAtReceiving();
  inspectSource(game);
  const score = game.score, shipped = game.shipped, combo = game.combo, stars = game.stars();
  game.drain();
  use(game, 'ship');
  assert.deepEqual(game.quay, [201]);
  assert.equal(game.sourcing.state, 'delivered');
  assert.equal(game.score, score);
  assert.equal(game.sourced, 0);
  use(game, 'ship');
  advance(game, 11.9);
  assert.equal(game.score, score);
  advance(game, .1);
  assert.equal(game.sourcing.state, 'fulfilled');
  assert.equal(game.sourced, 1);
  assert.equal(game.score, score + 300);
  assert.equal(game.sourcePoints, 300);
  assert.equal(game.scoreDetails.sourcing, 300);
  assert.equal(game.shipped, shipped);
  assert.equal(game.combo, combo);
  assert.equal(game.stars(), stars);
  assert.equal(game.clearElapsed, null);
  assert.equal(game.installed.some(part => part.id === 201), false);
  assert.equal(game.drain().filter(event => event.type === 'sourceFulfilled').length, 1);
  advance(game, 12);
  assert.equal(game.interact('ship'),false);
  assert.equal(game.sourcePoints, 300, 'A source crate cannot pay twice');
});

for (const place of ['quay', 'tender']) test(`closing clears sourced-part ownership from the ${place} without a late payout`, () => {
  const game = sourceAtReceiving();
  inspectSource(game);
  use(game, 'ship');
  if (place === 'tender') use(game, 'ship');
  const ordinaryCount = game.orders.length, score = game.score;
  game.time = .05;
  advance(game, .1);
  assert.equal(game.mode, 'results');
  assert.equal(game.unfinished, ordinaryCount, 'Outside work never increases ordinary unfinished count');
  assert.equal(game.sourcing.state, 'declined');
  assert.equal(game.sourcing.started, false);
  assert.equal(game.sourcing.location, 'closed');
  assert.equal(game.quay.includes(201), false, 'The closed source crate no longer owns a quay slot');
  assert.equal(game.tender.cargo.includes(201), false, 'The closed source crate no longer belongs to the tender');
  advance(game, 30);
  assert.equal(game.score, score);
  assert.equal(game.sourcePoints, 0);
  assert.equal(game.sourced, 0);
  game.reset();
  assert.equal(game.sourcing, null);
  assert.deepEqual(game.quay, []);
  assert.deepEqual(game.tender.cargo, []);
});

test('safe arrivals budget a lighthouse crossing as well as machining and handling', () => {
  const game = fresh();
  const shortest = Math.min(...BEACON_RECIPES.map(recipe => game.requiredTime(recipe, true)));
  game.time = shortest - .01;
  assert.equal(game.spawn(), false);
  game.time = shortest;
  assert.equal(game.spawn(), true);
  const candidate = game.orders.at(-1);
  assert.ok(game.requiredTime(candidate, true) <= game.time + EPSILON);
  assert.ok(game.requiredTime(candidate, true) >= CROSSING_SECONDS +
    candidate.route.reduce((total, station) => total + OPS[station].duration, 0));
});

test('legal collision-aware simulations punish serial dispatch, install all twelve, and repeat deterministically', () => {
  // These are scripted legal runs with walking/dash delays, not player data.
  // The driver also checks production collision paths and hosted score acceptance.
  const serial = simulateBeacon({ strategy:'serial', reaction:1.5,batch:1 });
  const normalSource = simulateBeacon({ reaction:.5, covari:'accept' });
  const expert = simulateBeacon({ reaction:.1, dash:true, batch:3 });
  assertBeaconBalance([serial, normalSource, expert]);
  assert.ok(serial.shipped < config.passTarget,'The former serial single-send strategy no longer clears');
  assert.equal(expert.shipped, config.maxOrders);
  assert.equal(expert.stars, 3);
  assert.equal(expert.missed, 0);
  assert.ok(expert.crossings.some(trip => trip.count === TENDER_CAPACITY), 'The legal route exercises full batches');
  assert.equal(normalSource.sourced, 1);
  assert.equal(normalSource.sourcePoints, 300);
  assert.equal(serial.clearElapsed,null);
  for (const row of [normalSource, expert]) {
    assert.ok(row.checkedSegments > 0);
    assert.ok(row.clearElapsed > 0 && row.clearElapsed <= row.elapsed);
  }
  assert.deepEqual(simulateBeacon({ reaction:.1, dash:true, batch:3 }), expert);
});


test('crossing windows repeat, close exactly, and reject a loaded departure during swell',()=>{
  for(const base of [0,36,180]){
    assert.equal(crossingWindow(base+19.9).open,false);
    assert.deepEqual(crossingWindow(base+20),{open:true,remaining:12});
    assert.equal(crossingWindow(base+31.9).open,true);
    assert.deepEqual(crossingWindow(base+32),{open:false,remaining:24});
  }
  const game=fresh();spawn(game);stage(game,game.orders[0]);advance(game,12);
  refused(game,'ship',/Next crossing window/);
  assert.equal(game.quay.length,1);assert.equal(game.tender.phase,'docked');
  advance(game,24);use(game,'ship');assert.equal(game.tender.phase,'outbound');
});

test('safe-arrival budget includes the next available crossing after the part is ready',()=>{
  const game=fresh(),recipe=BEACON_RECIPES[0];
  const required=game.requiredTime(recipe,true);
  const departure=game.elapsed+required-CROSSING_SECONDS;
  assert.equal(crossingWindow(departure).open,true);
  game.tender={phase:'outbound',remaining:12,cargo:[],trips:1};
  assert.ok(game.requiredTime(recipe,true)>=24+CROSSING_SECONDS);
});
