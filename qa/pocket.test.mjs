// Pocket Shift (hidden #/pocket mode, ruleset pocket-v1): the plan queue, the
// mode's identity, its endless three-strike rules, its floor's routes, its
// local best, and the promise that a run writes nothing else.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {SHIFTS, RECIPES, FINISHING_SOURCE_JOBS, isPlayableShift, scoreShipment} from '../dist/core.js';
import {PocketGame, POCKET_MODE, POCKET_ROLE, POCKET_RULESET, POCKET_PACE, POCKET_STAGES, POCKET_SAVE_KEY,
  pocketRecipeIndex, pocketStage, pocketInterval, pocketDeadline, readPocketBest, recordPocketRun} from '../dist/pocket.js';
import {createStationQueue} from '../dist/pocket-queue.js';
import {POCKET_BADGES, POCKET_TAP_RADIUS, POCKET_DEBURR_ORDER, POCKET_DEBURR_LEAD, pocketTapTarget, pocketDeburrInstalled, pocketCrateShown,
  pocketAbsentStations, pocketRemainingStations, pocketShortName, pocketBadgeIcon} from '../dist/pocket-floor.js';
import {MANAGER_ROLE} from '../dist/manager.js';
import {navigation} from './balance.mjs';
import {simulatePocket, checkTargets, STRATEGIES, CEILING} from './pocket-balance.mjs';

test('the plan queues at most three stations in tap order', () => {
  const q = createStationQueue();
  assert.equal(q.tap('material-round').action, 'added');
  assert.equal(q.tap('lathe').position, 2);
  assert.equal(q.tap('inspect').position, 3);
  assert.deepEqual(q.list(), ['material-round', 'lathe', 'inspect']);
  const full = q.tap('ship');
  assert.equal(full.action, 'full');
  assert.deepEqual(q.list(), ['material-round', 'lathe', 'inspect'], 'A fourth tap is ignored');
  assert.equal(q.position('lathe'), 2);
  assert.equal(q.position('ship'), 0);
  assert.equal(q.head(), 'material-round');
});

test('tapping a queued station removes it and every stop after it', () => {
  const q = createStationQueue();
  for (const id of ['material-plate', 'mill', 'buffer']) q.tap(id);
  const removed = q.tap('mill');
  assert.equal(removed.action, 'removed');
  assert.deepEqual(removed.removed, ['mill', 'buffer']);
  assert.equal(removed.head, false);
  assert.deepEqual(q.list(), ['material-plate']);
  const head = q.tap('material-plate');
  assert.equal(head.head, true, 'Removing the first stop tells the caller to stop walking');
  assert.equal(q.size, 0);
  assert.equal(q.tap('').action, 'ignored');
});

test('arrival advances on success and drops the rest of the plan on rejection', () => {
  const q = createStationQueue();
  for (const id of ['material-round', 'lathe', 'inspect']) q.tap(id);
  assert.equal(q.arrived('lathe', true).action, 'ignored', 'Only the first stop can be reached');
  assert.equal(q.arrived('material-round', true).action, 'advanced');
  assert.deepEqual(q.list(), ['lathe', 'inspect']);
  const dropped = q.arrived('lathe', false);
  assert.equal(dropped.action, 'dropped');
  assert.deepEqual(dropped.dropped, ['lathe', 'inspect']);
  assert.equal(q.size, 0);
  q.tap('ship'); q.tap('buffer');
  assert.deepEqual(q.clear(), ['ship', 'buffer'], 'A floor tap clears the whole plan');
  assert.equal(q.head(), null);
  assert.equal(createStationQueue({limit:2}).limit, 2);
});


// Generous taps: nearest footprint or badge within the radius, never a further neighbour.
test('a near-miss tap resolves to the nearest station, and bare floor stays bare', () => {
  const box = (left, top, w, h) => ({left, top, right:left + w, bottom:top + h});
  // Two close neighbours, 20 px apart, each with a badge under its front-left foot.
  const targets = [
    {id:'lathe', boxes:[box(40, 300, 90, 110), box(30, 395, 40, 36)]},
    {id:'mill', boxes:[box(150, 300, 100, 115), box(140, 400, 40, 36)]},
  ];
  assert.equal(pocketTapTarget({x:80, y:350}, targets), 'lathe', 'Inside a footprint');
  assert.equal(pocketTapTarget({x:136, y:350}, targets), 'lathe', '6 px from the lathe, 14 px from the mill');
  assert.equal(pocketTapTarget({x:144, y:350}, targets), 'mill', '14 px from the lathe, 6 px from the mill');
  assert.equal(pocketTapTarget({x:160, y:450}, targets), 'mill', 'Near the mill’s badge');
  assert.equal(pocketTapTarget({x:85, y:300 - POCKET_TAP_RADIUS + 2}, targets), 'lathe', 'Just inside the radius above the lathe');
  assert.equal(pocketTapTarget({x:85, y:300 - POCKET_TAP_RADIUS - 2}, targets), null, 'Just outside it: a bare-floor tap');
  assert.equal(pocketTapTarget({x:400, y:350}, targets), null);
  // Overlapping boxes: the tap belongs to the box whose centre is nearer.
  const overlap = [{id:'a', boxes:[box(0, 0, 100, 100)]}, {id:'b', boxes:[box(80, 0, 100, 100)]}];
  assert.equal(pocketTapTarget({x:85, y:50}, overlap), 'a');
  assert.equal(pocketTapTarget({x:95, y:50}, overlap), 'b');
  // Across the gap the answer switches at the midline (a tie there goes to the nearer centre), never to the further station.
  for (let x = 131; x < 150; x++) assert.equal(pocketTapTarget({x, y:350}, targets), x <= 140 ? 'lathe' : 'mill', `x ${x}`);
  assert.ok(POCKET_TAP_RADIUS >= 44 && POCKET_TAP_RADIUS <= 56);
  assert.equal(pocketTapTarget({x:0, y:0}, [{id:'x', boxes:[null, {left:5, right:5, top:0, bottom:10}]}]), null, 'Empty boxes are ignored');
});

test('stations and ticket chips share one badge language', () => {
  for (const id of ['material-round','material-plate','material-block','lathe','mill','deburr','inspect','ship','buffer','receiving']) {
    const b = POCKET_BADGES[id];
    assert.ok(b && /^[A-Z]{3,7}$/.test(b.word) && /^#[0-9a-f]{6}$/i.test(b.color) && b.name, `${id} has a word, colour and name`);
    assert.match(pocketBadgeIcon(id), /^<svg[^>]*aria-hidden="true"/);
  }
  assert.equal(POCKET_BADGES.lathe.word, 'LATHE', 'The ticket says what the station says (no more TURN / QC)');
  assert.equal(POCKET_BADGES.inspect.word, 'INSPECT');
  const valve = {...RECIPES[3], route:[...RECIPES[3].route, 'ship'], index:0, started:false};
  assert.deepEqual(pocketRemainingStations(valve), ['material-block','lathe','mill','deburr','inspect','ship'], 'A five-step route and its stock');
  assert.deepEqual(pocketRemainingStations({...valve, started:true, index:2}), ['deburr','inspect','ship']);
  assert.deepEqual([0, 1, 2, 3, 6].map(i => pocketShortName(RECIPES[i].name)), ['Spacer','Plate','Knob','Valve','Housing']);
});

test('Deburr arrives shortly before the first deburr order; the crate spot shows only for a delivery', () => {
  assert.equal(POCKET_DEBURR_ORDER, POCKET_STAGES[2].from, 'Deburr is first needed by the stage that brings the deburr parts');
  assert.equal(pocketDeburrInstalled({spawnIndex:0, nextArrival:0, elapsed:0}), false);
  assert.equal(pocketDeburrInstalled({spawnIndex:POCKET_DEBURR_ORDER, nextArrival:150, elapsed:150 - POCKET_DEBURR_LEAD - 1}), false);
  assert.equal(pocketDeburrInstalled({spawnIndex:POCKET_DEBURR_ORDER, nextArrival:150, elapsed:150 - POCKET_DEBURR_LEAD}), true);
  assert.equal(pocketDeburrInstalled({spawnIndex:POCKET_DEBURR_ORDER + 1}), true);
  // In a run (orders cleared so none expire), Deburr is on the floor before order 11 arrives, and stays.
  const game = fresh();
  let installedAt = null;
  for (let t = 0; t < 400 && game.mode === 'playing'; t += .1) {
    game.orders.forEach(o => { o.remaining = 99; }); if (game.orders.length > 2) game.orders.shift();
    game.tick(.1); game.drain();
    if (installedAt === null && pocketDeburrInstalled(game)) installedAt = {spawnIndex:game.spawnIndex, lead:game.nextArrival - game.elapsed};
    if (installedAt) assert.equal(pocketDeburrInstalled(game), true, 'Deburr never leaves');
  }
  assert.equal(installedAt.spawnIndex, POCKET_DEBURR_ORDER);
  assert.ok(installedAt.lead > 0 && installedAt.lead <= POCKET_DEBURR_LEAD);
  assert.equal(pocketCrateShown({sourcing:null}), false);
  assert.equal(pocketCrateShown({sourcing:{state:'offer'}}), false);
  assert.equal(pocketCrateShown({sourcing:{state:'sourcing'}}), true, 'On its way');
  assert.equal(pocketCrateShown({sourcing:{state:'delivered', location:'receiving'}}), true, 'Waiting');
  assert.equal(pocketCrateShown({sourcing:{state:'delivered', location:'hands'}}), false, 'Collected');
  assert.deepEqual(pocketAbsentStations({}), ['deburr','receiving']);
});

const name = index => RECIPES[index].name;
function run(game, seconds, dt = .1) { const events = []; for (let t = 0; t < seconds && game.mode === 'playing'; t += dt) { game.tick(dt); events.push(...game.drain()); } return events; }
function fresh() { const game = new PocketGame(); game.reset(); game.drain(); return game; }
// Carry the oldest order through its route with the real rules, waiting at each machine.
function ship(game, events = []) {
  const order = game.orders[0];
  assert.equal(game.interact(`material-${order.kind === 'shaft' ? 'round' : order.kind === 'plate' ? 'plate' : 'block'}`), true);
  for (const key of order.route.slice(0, -1)) {
    assert.equal(game.interact(key), true, `load ${key}`);
    while (!game.stations[key].ready) { game.tick(.1); events.push(...game.drain()); }
    assert.equal(game.interact(key), true, `collect ${key}`);
  }
  return order;
}

test('Pocket Shift is a separate mode with its own ruleset, never a level', () => {
  assert.equal(SHIFTS.some(shift => shift.id === POCKET_MODE.id || shift.mapId === POCKET_MODE.mapId || /pocket/i.test(shift.name) || shift.ruleset === POCKET_RULESET), false);
  assert.equal(POCKET_MODE.id, 'pocket-shift');
  assert.equal(POCKET_MODE.mapId, 'pocket-shop');
  assert.equal(POCKET_RULESET, 'pocket-v1');
  assert.equal(POCKET_MODE.ruleset, 'pocket-v1');
  assert.equal(isPlayableShift(POCKET_ROLE), false);
  assert.notEqual(POCKET_ROLE, MANAGER_ROLE);
  assert.equal(SHIFTS[0].id, 'first-shift', 'First Shift keeps index 0');
  assert.equal(Object.isFrozen(POCKET_MODE) && Object.isFrozen(POCKET_PACE), true);
  const game = fresh();
  assert.equal(game.shiftIndex, POCKET_ROLE);
  assert.equal(game.config, POCKET_MODE);
  const snapshot = game.snapshot();
  assert.equal(snapshot.shift, POCKET_ROLE);
  assert.equal(snapshot.ruleset, 'pocket-v1');
  assert.equal(snapshot.time, null, 'No shift clock');
  assert.equal(snapshot.strikes, 0);
  assert.deepEqual(game.orders.map(o => [o.name, o.deadline]), [['Pocket spacer', 96]], 'First order at 0s, First Shift deadline plus its opening bonus');
});

test('the order stream is fixed: every run sees the same parts in the same order', () => {
  const first = Array.from({length:40}, (_, n) => name(pocketRecipeIndex(n)));
  assert.deepEqual(first.slice(0, 2), ['Pocket spacer', 'Mounting plate']);
  // Two games, each clearing its board so arrivals never wait: the same stream, opening order included.
  const arrivals = game => { const names = [game.orders[0].name]; for (let i = 0; i < 24; i++) { game.orders = []; game.spawn(); names.push(game.orders[0].name); } return names; };
  assert.deepEqual(arrivals(fresh()), arrivals(fresh()));
  assert.deepEqual(arrivals(fresh()), first.slice(0, 25));
  // A golden prefix, so a change to the seed or generator is a deliberate one.
  assert.deepEqual(first.slice(0, 12).map(n => n.split(' ')[0]), ['Pocket','Mounting','Mounting','Pocket','Bearing','Pocket','Mounting','Mounting','Bearing','Bearing','Dial','Valve']);
  for (let n = 2; n < 40; n++) assert.ok(!(first[n] === first[n - 1] && first[n] === first[n - 2]), `No part three times in a row (order ${n})`);
});

test('variety grows in stages: spacer and plate, then the housing, then deburr work', () => {
  const [one, two, three] = POCKET_STAGES;
  assert.deepEqual([one.from, two.from, three.from], [0, 4, 10]);
  const seen = n => name(pocketRecipeIndex(n));
  for (let n = 0; n < two.from; n++) assert.ok(['Pocket spacer', 'Mounting plate'].includes(seen(n)), `order ${n} is an opening part`);
  assert.equal(seen(two.from), 'Bearing housing', 'Stage 2 opens with its new part');
  for (let n = two.from; n < three.from; n++) assert.ok(['Pocket spacer', 'Mounting plate', 'Bearing housing'].includes(seen(n)));
  assert.deepEqual([seen(three.from), seen(three.from + 1)], ['Dial knob', 'Valve body'], 'Stage 3 shows both deburr parts first');
  const later = new Set(Array.from({length:40}, (_, n) => seen(three.from + n)));
  assert.deepEqual([...later].sort(), ['Bearing housing', 'Dial knob', 'Mounting plate', 'Pocket spacer', 'Valve body']);
  assert.deepEqual([0, 3, 4, 9, 10, 99].map(pocketStage), [0, 0, 1, 1, 2, 2]);
  // Recipes and values are the shared ones from core.js.
  assert.deepEqual(RECIPES[6].route, ['lathe', 'mill', 'inspect']);
  assert.deepEqual(RECIPES[3].route, ['lathe', 'mill', 'deburr', 'inspect']);
});

test('the pace starts at First Shift’s and tightens to its floors', () => {
  const spacer = RECIPES[0], valve = RECIPES[3];
  assert.equal(pocketInterval(0), 18);
  assert.equal(pocketInterval(POCKET_PACE.interval.over), POCKET_PACE.interval.floor);
  assert.equal(pocketInterval(10_000), POCKET_PACE.interval.floor, 'Floors hold');
  assert.equal(pocketDeadline(0, spacer), 82);
  assert.equal(pocketDeadline(10_000, spacer), POCKET_PACE.deadline.floor);
  assert.equal(pocketDeadline(10_000, valve), POCKET_PACE.deadline.floor + 2 * POCKET_PACE.extraStep, 'Longer routes get more time');
  for (let t = 0; t < 600; t += 15) {
    assert.ok(pocketInterval(t + 15) <= pocketInterval(t));
    assert.ok(pocketDeadline(t + 15, spacer) <= pocketDeadline(t, spacer));
  }
});

test('three expired orders end the run, and nothing else does', () => {
  const game = fresh();
  const early = run(game, 90);
  assert.equal(game.mode, 'playing', 'No clock ends the run');
  assert.equal(early.filter(e => e.type === 'strike').length, 0);
  const events = early.concat(run(game, 400));
  const strikes = events.filter(e => e.type === 'strike');
  assert.deepEqual(strikes.map(e => [e.strikes, e.final]), [[1, false], [2, false], [3, true]]);
  assert.equal(game.mode, 'results');
  assert.equal(game.finishReason, 'strikes');
  assert.equal(game.missed, 3, 'The run stops on the third miss, even when two expire together');
  assert.equal(events.filter(e => e.type === 'finish').length, 1);
  assert.equal(game.snapshot().strikes, 3);
  assert.ok(game.orders.length <= POCKET_MODE.maxActive);
});

test('at most four orders are active; a full board holds arrivals back', () => {
  const game = fresh();
  let most = 0;
  for (let t = 0; t < 200 && game.mode === 'playing'; t += .1) { game.tick(.1); game.drain(); most = Math.max(most, game.orders.length); }
  assert.equal(most, 4);
  const full = fresh();
  for (let i = 0; i < 3; i++) full.spawn();
  assert.equal(full.orders.length, 4);
  assert.equal(full.spawn(), false);
  assert.equal(full.spawnIndex, 4, 'A refused arrival keeps its place in the stream');
});

test('shipping scores with the shared scoreShipment formula and streak', () => {
  const game = fresh();
  let expected = 0;
  for (let i = 0; i < 2; i++) {
    if (!game.orders.length) game.spawn();
    const order = ship(game);
    const before = {...order};
    const breakdown = scoreShipment(before, Math.min(game.combo + 1, 5), {programming:false});
    assert.equal(game.interact('inspect') || true, true);
    assert.equal(game.interact('ship'), true);
    expected += breakdown.total;
    assert.equal(game.score, expected);
  }
  assert.equal(game.shipped, 2);
  assert.equal(game.combo, 2);
  assert.ok(game.scoreDetails.streak > 0, 'The second shipment carries a streak');
});

test('Covari: first offer after two shipments, recurs after a quiet gap, never a strike', () => {
  const game = fresh();
  const events = [];
  for (let i = 0; i < 2; i++) { if (!game.orders.length) game.spawn(); ship(game, events); assert.equal(game.interact('ship'), true); }
  game.tick(.1); events.push(...game.drain());
  assert.equal(game.sourcing.state, 'offer');
  assert.equal(FINISHING_SOURCE_JOBS.some(job => job.name === game.sourcing.name), true, 'A real capability gap on this floor');
  assert.equal(game.orders.some(o => o.id === 201), false, 'The offer takes no order slot');
  // Ignored: the offer lapses without a strike, then a new one comes after the gap.
  const strikes = game.strikes, firstName = game.sourcing.name;
  for (let t = 0; t < 30.2; t += .1) { game.tick(.1); game.orders.forEach(o => { o.remaining = 99; }); }
  assert.equal(game.sourcing.state, 'declined');
  assert.equal(game.strikes, strikes);
  for (let t = 0; t < POCKET_MODE.sourceGap - 1; t += .1) { game.tick(.1); game.orders.forEach(o => { o.remaining = 99; }); }
  assert.equal(game.sourcing.state, 'declined', 'Quiet gap');
  for (let t = 0; t < 2; t += .1) { game.tick(.1); game.orders.forEach(o => { o.remaining = 99; }); }
  assert.equal(game.sourcing.state, 'offer', 'A new offer after the gap');
  assert.notEqual(game.sourcing.name, firstName, 'Offers rotate through the outside jobs');
  // Accepted and left unfinished in hand: it never expires and never strikes.
  assert.equal(game.requestSource(), true);
  for (let t = 0; t < 23; t += .1) { game.tick(.1); game.orders.forEach(o => { o.remaining = 99; }); }
  assert.equal(game.sourcing.state, 'delivered');
  game.hand = null;
  assert.equal(game.interact('receiving'), true);
  for (let t = 0; t < 300; t += .1) { game.tick(.1); game.orders.forEach(o => { o.remaining = 99; }); }
  assert.equal(game.heldOrder.id, 201);
  assert.equal(game.strikes, strikes, 'An unfinished Covari job is never a strike');
  assert.equal(game.combo, 2);
  // Finished: 300 points, no shipment or streak credit.
  const score = game.score;
  assert.equal(game.interact('inspect'), true);
  for (let t = 0; t < 4.2; t += .1) game.tick(.1);
  assert.equal(game.interact('inspect'), true);
  assert.equal(game.interact('ship'), true);
  assert.equal(game.score, score + 300);
  assert.equal(game.shipped, 2);
  assert.equal(game.combo, 2);
  // Declined outright: no strike either.
  for (let t = 0; t < POCKET_MODE.sourceGap + 1; t += .1) { game.tick(.1); game.orders.forEach(o => { o.remaining = 99; }); }
  assert.equal(game.sourcing.state, 'offer');
  assert.equal(game.declineSource(), true);
  game.tick(.1);
  assert.equal(game.strikes, strikes);
  assert.equal(game.offers, 3);
});

test('the pocket-shop floor holds this mode’s stations, each reachable from the others', () => {
  const layout = navigation.layoutFor('pocket-shop');
  assert.deepEqual(Array.from(layout, def => def.id).sort(), ['buffer','deburr','inspect','lathe','material-block','material-plate','material-round','mill','receiving','ship']);
  const map = navigation.maps['pocket-shop'];
  assert.equal(map.theme, 'day');
  navigation.activate('pocket-shop');
  const accesses = navigation.accessesFor('pocket-shop');
  for (const def of layout) {
    assert.equal(def.rotationY ?? 0, 0, `${def.id} faces the camera`);
    const access = accesses[def.id];
    // Bins are used from the aisle behind them, shared with the machines; every other station from in front.
    if (def.stock) assert.ok(access.z < def.z - def.d / 2, `${def.id} is used from the aisle behind it`);
    else assert.ok(access.z > def.z + def.d / 2, `${def.id} is used from in front`);
    assert.ok(Math.abs(access.x - def.x) < .01, `${def.id} access is centred`);
    assert.ok(navigation.safe(access.x, access.z), `${def.id} has a walkable access spot`);
  }
  // Bottom to top: stock nearest the camera, Inspect and Shipping at the back.
  const z = id => layout.find(def => def.id === id).z;
  assert.ok(z('material-round') > z('lathe') && z('lathe') > z('deburr') && z('deburr') > z('inspect'));
  assert.ok(z('ship') < z('buffer') && z('receiving') < z('buffer'));
  assert.ok(navigation.safe(map.spawn.x, map.spawn.z), 'The machinist starts on open floor');
  for (const [from, a] of Object.entries(accesses)) for (const [to, b] of Object.entries(accesses)) {
    if (from === to) continue;
    const route = navigation.route(a, b);
    assert.ok(route.length, `${from} → ${to} has a route`);
    const end = route.at(-1);
    assert.ok(Math.hypot(end.x - b.x, end.z - b.z) < .2, `${from} → ${to} ends at the station`);
    let at = a;
    for (const point of route) { assert.ok(navigation.clear(at, point), `${from} → ${to} stays collision-free`); at = point; }
  }
  // Before Deburr arrives and between deliveries, their spots are open floor and every route still works.
  navigation.setAbsent(['deburr', 'receiving']);
  navigation.activate('pocket-shop');
  const deburr = layout.find(def => def.id === 'deburr');
  assert.ok(navigation.safe(deburr.x, deburr.z), 'Deburr’s spot is walkable before it arrives');
  for (const from of ['material-round', 'lathe', 'mill', 'buffer', 'inspect', 'ship']) for (const to of ['material-block', 'inspect', 'ship', 'lathe']) {
    if (from !== to) assert.ok(navigation.route(accesses[from], accesses[to]).length, `${from} → ${to} without the late fixtures`);
  }
  navigation.setAbsent();
  navigation.activate('pocket-shop');
  assert.equal(navigation.safe(deburr.x, deburr.z), false, 'Once there, Deburr blocks its footprint');
  // Drawn at or below their usual size: no per-map enlargement.
  for (const def of layout) assert.ok((def.scale ?? 1) <= 1, `${def.id} is not enlarged`);
  // Every other map keeps its own floor; the deeper search applies only past the old grid.
  navigation.activate('first-shop');
  assert.equal(navigation.layoutFor('first-shop').find(def => def.id === 'ship').rotationY, -Math.PI / 2);
  assert.equal(navigation.layoutFor('first-shop').some(def => def.id === 'deburr'), false);
  assert.equal(navigation.layoutFor('night-shop').find(def => def.id === 'deburr').x, -.9, 'Deburr keeps its Night Shift place');
});

// Reproducible simulation, not a playtest: see qa/pocket-balance.mjs.
test('every simulated strategy’s run ends on three strikes within its target (simulation)', () => {
  const rows = Object.keys(STRATEGIES).map(player => simulatePocket(player));
  checkTargets(rows);
  for (const row of rows) {
    assert.ok(row.survived < CEILING);
    console.log(`# ${row.player}: ${row.survived}s, ${row.shipped} shipped, ${row.points} points, ${row.sourced} Covari, walking ${Math.round(row.walkingShare * 100)}%`);
  }
  navigation.activate('first-shop');
});

test('the local best reads defensively and writes only its own key', () => {
  const store = new Map(), writes = [];
  const storage = {getItem:key => store.get(key) ?? null, setItem:(key, value) => { writes.push(key); store.set(key, value); }};
  assert.deepEqual(readPocketBest(storage), {bestPoints:0, bestShipped:0, longestSeconds:0, runs:0});
  for (const junk of ['{', '[]', '"x"', 'null', JSON.stringify({bestPoints:-5, bestShipped:'lots', longestSeconds:'NaN', runs:2.7})]) {
    store.set(POCKET_SAVE_KEY, junk);
    assert.deepEqual(readPocketBest(storage), {bestPoints:0, bestShipped:0, longestSeconds:0, runs:junk.includes('runs') ? 2 : 0});
  }
  store.delete(POCKET_SAVE_KEY);
  assert.deepEqual(readPocketBest(null), {bestPoints:0, bestShipped:0, longestSeconds:0, runs:0});
  const first = recordPocketRun(storage, {score:1200, shipped:5, elapsed:131.26});
  assert.equal(first.newBest, true);
  assert.deepEqual(first.best, {bestPoints:1200, bestShipped:5, longestSeconds:131.3, runs:1});
  const second = recordPocketRun(storage, {score:900, shipped:6, elapsed:100});
  assert.equal(second.newBest, false, 'A new best means more points');
  assert.deepEqual(second.best, {bestPoints:1200, bestShipped:6, longestSeconds:131.3, runs:2}, 'Each best is kept on its own');
  assert.deepEqual([...new Set(writes)], [POCKET_SAVE_KEY]);
  const broken = {getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); }};
  assert.equal(recordPocketRun(broken, {score:5}).newBest, true, 'Blocked storage never breaks the result card');
});

const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = main.indexOf(`function ${name}(`), end = main.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, `${name} has a function boundary`);
  return main.slice(start, end);
}

test('a Pocket Shift run writes only its own best and sends nothing', () => {
  const calls = [], writes = [];
  const spy = name => (...args) => { calls.push(name); };
  const nodes = new Map();
  const element = () => ({hidden:true, textContent:'', innerHTML:'', className:'', dataset:{}, style:{}, children:[],
    classList:{add(){}, remove(){}, toggle(){}}, focus(){}, setAttribute(){}});
  const $ = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const pocketGame = new PocketGame();
  const store = new Map();
  const storage = {getItem:key => { calls.push('localStorage.getItem:' + key); return store.get(key) ?? null; }, setItem:(key, value) => { writes.push(key); store.set(key, value); }, removeItem:spy('localStorage.removeItem'), clear:spy('localStorage.clear')};
  const context = vm.createContext({
    $, Math, String, Object, Number, JSON, pocketGame, POCKET_MODE, readPocketBest, recordPocketRun, game:null, menuMode:true, resultShown:false, beaconFinaleTime:0,
    pocketQueue:createStationQueue({limit:3}), stations:{}, targetRing:null, path:[], pathStation:null, pocketResult:null, pocketFinaleTimer:0,
    clearTimeout(){}, setTimeout(){},
    document:{documentElement:{dataset:{mode:'pocket'}}, body:{classList:{add(){}, remove(){}, toggle(){}}}},
    localStorage:storage, save:spy('save'), saveRun:spy('saveRun'), saveSpeedRecords:spy('saveSpeedRecords'), recordClear:spy('recordClear'),
    social:new Proxy({}, {get:(_, key) => spy('social.' + String(key))}),
    fetch:spy('fetch'), showManagerResults:spy('showManagerResults'),
    audio:{init(){}, update(){}, event(){}}, endBeaconEnding(){}, closePopover(){}, resetBays(){}, resetPad(){}, processEvents(){}, updateUI(){},
    clearMovement(){}, hidePanels(){}, toast(){},
    enterFloor(){ context.menuMode = false; },
  });
  vm.runInContext(['pocketing','pocketRoute','syncPocketMarkers','pocketClock','pocketBestLine','showPocketPanel','startPocket','showPocketResults','showResults','restartRun'].map(productionFunction).join('\n'), context);
  context.showPocketPanel('start');
  assert.equal($('pocket-best').textContent, 'Your best run is kept on this device.');
  context.startPocket();
  assert.equal(context.game, pocketGame);
  assert.equal(context.game.mode, 'playing');
  // Ship one part through the shared rules, then let three orders expire.
  ship(pocketGame);
  assert.equal(pocketGame.interact('ship'), true);
  for (let t = 0; t < 600 && pocketGame.mode === 'playing'; t += .1) pocketGame.tick(.1);
  assert.equal(pocketGame.finishReason, 'strikes');
  context.showResults();
  assert.equal($('pocket-panel').hidden, false);
  assert.equal($('pocket-result').hidden, false);
  assert.equal($('pocket-shipped').textContent, 1);
  assert.equal($('pocket-points').textContent, pocketGame.score.toLocaleString());
  assert.match($('pocket-time').textContent, /^\d+:\d\d$/);
  assert.equal($('pocket-new-best').hidden, false, 'The first run with points is a new best');
  assert.equal($('results-panel').hidden, true, 'The shift results, board and challenge links stay closed');
  context.resultShown = false;
  context.restartRun();
  assert.equal(pocketGame.mode, 'playing');
  assert.equal(pocketGame.strikes, 0, 'Play again starts a fresh run');
  assert.deepEqual(writes, [POCKET_SAVE_KEY], 'Only the pocket best is written');
  assert.deepEqual(calls.filter(call => !call.startsWith('localStorage.getItem:' + POCKET_SAVE_KEY)), [], 'No other save, record, server run or analytics');
  const saved = JSON.parse(store.get(POCKET_SAVE_KEY));
  assert.deepEqual(Object.keys(saved), ['v', 'bestPoints', 'bestShipped', 'longestSeconds', 'runs']);
  assert.deepEqual([saved.v, saved.bestShipped, saved.runs], [1, 1, 1]);
  assert.ok(saved.bestPoints > 0 && saved.longestSeconds > 60);
});

test('the hidden route is reachable only by its hash', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="pocket-panel"/);
  const stripped = html.replace(/<section id="pocket-panel"[\s\S]*?<\/section>/, '').replace(/<section id="pocket-hud"[\s\S]*?<\/section>/, '').replace(/<div id="pocket-(band|flash)"[^>]*><\/div>/g, '');
  assert.doesNotMatch(stripped, /pocket/i, 'Only the mode’s own panel, HUD and layers mention Pocket Shift');
  assert.doesNotMatch(productionFunction('buildShiftPicker'), /pocket/i);
  assert.doesNotMatch(productionFunction('showHomeView'), /pocket/i);
  assert.doesNotMatch(productionFunction('buildModeCard'), /pocket/i);
  assert.match(productionFunction('applyHomeRoute'), /route==='pocket'/);
  assert.match(html, /<section id="pocket-hud"[^>]*hidden/, 'The pocket HUD starts hidden');
  assert.match(html, /<div id="pocket-band"[^>]*hidden/);
  const css = await readFile(new URL('../dist/mobile.css', import.meta.url), 'utf8');
  const gate = css.slice(css.indexOf('#phone-rotate-screen {'), css.indexOf('@media (orientation: landscape) {\n  :where(html[data-interface="mobile"][data-phone="true"]) body.playing #shop-sidebar'));
  assert.equal((gate.match(/html\[data-phone="true"\]:not\(\[data-mode="pocket"\]\)/g) ?? []).length, 11, 'Every rotate-gate rule exempts only the pocket route');
  assert.doesNotMatch(gate, /:where\(html\[data-phone="true"\]\)/);
  // Every pocket rule is scoped to the pocket route or to pocket-only elements.
  const pocketCss = css.slice(css.indexOf('/* Pocket Shift (hidden #/pocket route)'));
  for (const rule of pocketCss.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{/g).map(r => r.trim().slice(0, -1).trim()).filter(r => r && !r.startsWith('@') && !/^\d+%|^from|^to/.test(r)))
    for (const selector of rule.split(',').map(x => x.trim()))
      assert.match(selector, /data-mode="pocket"|^\.pocket-|^\.pt-|pocket-/, `${selector} is pocket-only`);
});
