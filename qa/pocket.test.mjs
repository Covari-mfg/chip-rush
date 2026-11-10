// Pocket Shift (hidden #/pocket mode): the plan queue, the mode's identity and
// rules, its floor's routes, and the promise that a run writes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {SHIFTS, ShopGame, isPlayableShift} from '../dist/core.js';
import {PocketGame, POCKET_MODE, POCKET_ROLE} from '../dist/pocket.js';
import {createStationQueue} from '../dist/pocket-queue.js';
import {MANAGER_ROLE} from '../dist/manager.js';
import {navigation, Driver, simulateShift} from './balance.mjs';

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

test('Pocket Shift is a separate mode, never a level, with First Shift rules', () => {
  assert.equal(SHIFTS.some(shift => shift.id === POCKET_MODE.id || shift.mapId === POCKET_MODE.mapId || /pocket/i.test(shift.name)), false);
  assert.equal(POCKET_MODE.id, 'pocket-shift');
  assert.equal(POCKET_MODE.mapId, 'pocket-shop');
  assert.equal(isPlayableShift(POCKET_ROLE), false);
  assert.notEqual(POCKET_ROLE, MANAGER_ROLE);
  for (const key of ['duration','firstArrival','interval','deadline','recipes','unlocks','stock','programming','sourcing','calls','callTimes','passTarget','stars'])
    assert.deepEqual(POCKET_MODE[key], SHIFTS[0][key], `${key} matches First Shift`);
  assert.equal(SHIFTS[0].id, 'first-shift', 'First Shift keeps index 0');
  assert.equal(Object.isFrozen(POCKET_MODE), true);
  const game = new PocketGame();
  game.reset();
  assert.equal(game.shiftIndex, POCKET_ROLE);
  assert.equal(game.config, POCKET_MODE);
  assert.equal(game.snapshot().shift, POCKET_ROLE);
});

test('a Pocket Shift run plays out exactly like First Shift', () => {
  const pocket = new PocketGame(), first = new ShopGame();
  pocket.reset(); first.reset(0);
  const actions = {6:'material-round', 9:'lathe', 19:'lathe', 23:'inspect', 29:'inspect', 33:'ship', 36:'material-plate', 40:'mill', 52:'mill', 56:'inspect', 62:'inspect', 65:'ship'};
  for (let step = 0; step < 1600 && first.mode === 'playing'; step++) {
    const second = step / 10;
    if (actions[second]) assert.equal(pocket.interact(actions[second]), first.interact(actions[second]));
    pocket.tick(.1); first.tick(.1);
    const strip = ({shift, ...rest}) => rest;
    assert.deepEqual(strip(pocket.snapshot()), strip(first.snapshot()), `Same state at ${second}s`);
    pocket.drain(); first.drain();
  }
  assert.equal(first.mode, 'results');
  assert.equal(pocket.shipped, 2);
  assert.equal(pocket.passed(), first.passed());
  assert.equal(pocket.stars(), first.stars());
});

test('the pocket-shop floor shows only First Shift stations, each reachable from the others', () => {
  const layout = navigation.layoutFor('pocket-shop');
  assert.deepEqual(Array.from(layout, def => def.id).sort(), ['buffer','inspect','lathe','material-plate','material-round','mill','ship']);
  const map = navigation.maps['pocket-shop'];
  assert.equal(map.theme, 'day');
  navigation.activate('pocket-shop');
  for (const def of layout) {
    assert.equal(def.rotationY ?? 0, 0, `${def.id} faces the camera`);
    const access = navigation.accessesFor('pocket-shop')[def.id];
    assert.ok(access.z > def.z + def.d / 2, `${def.id} is used from in front`);
    assert.ok(navigation.safe(access.x, access.z), `${def.id} has a walkable access spot`);
  }
  assert.ok(navigation.safe(map.spawn.x, map.spawn.z), 'The machinist starts on open floor');
  const accesses = navigation.accessesFor('pocket-shop');
  for (const [from, a] of Object.entries(accesses)) for (const [to, b] of Object.entries(accesses)) {
    if (from === to) continue;
    const route = navigation.route(a, b);
    assert.ok(route.length, `${from} → ${to} has a route`);
    const end = route.at(-1);
    assert.ok(Math.hypot(end.x - b.x, end.z - b.z) < .2, `${from} → ${to} ends at the station`);
    let at = a;
    for (const point of route) { assert.ok(navigation.clear(at, point), `${from} → ${to} stays collision-free`); at = point; }
  }
  // Every other map keeps its own floor; the deeper search applies only past the old grid.
  navigation.activate('first-shop');
  assert.equal(navigation.layoutFor('first-shop').find(def => def.id === 'ship').rotationY, -Math.PI / 2);
});

// Reproducible simulation, not a playtest: the shared balance driver walks the
// pocket-shop routes at the production walking speed with 0.5s reactions.
function simulatePocket(strategy) {
  const driver = new Driver(0, strategy, 'decline', {reaction:.5});
  driver.game = new PocketGame();
  driver.game.reset();
  driver.position = {...navigation.maps['pocket-shop'].spawn};
  return driver.run();
}

test('the shared driver clears Pocket Shift on its tall floor (simulation)', () => {
  for (const strategy of ['serial', 'flow']) {
    const pocket = simulatePocket(strategy), first = simulateShift(0, {strategy, reaction:.5});
    assert.equal(pocket.role, 'Pocket Shift');
    assert.ok(pocket.pass, `${strategy} clears`);
    assert.ok(pocket.shipped >= POCKET_MODE.passTarget);
    // Walking differs from First Shift only through the room; record both.
    console.log(`# ${strategy}: pocket-shop ${pocket.shipped} shipped / ${pocket.missed} missed, ${pocket.walkingSeconds}s walking; first-shop ${first.shipped} shipped / ${first.missed} missed, ${first.walkingSeconds}s walking`);
  }
  navigation.activate('first-shop');
});

const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = main.indexOf(`function ${name}(`), end = main.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, `${name} has a function boundary`);
  return main.slice(start, end);
}

test('a Pocket Shift run writes no save, record or run and sends nothing', () => {
  const calls = [];
  const spy = name => (...args) => { calls.push(name); };
  const nodes = new Map();
  const element = () => ({hidden:true, textContent:'', innerHTML:'', dataset:{}, style:{},
    classList:{add(){}, remove(){}, toggle(){}}, focus(){}, setAttribute(){}});
  const $ = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const pocketGame = new PocketGame();
  const storage = new Proxy({}, {get:(_, key) => (...args) => { calls.push('localStorage.' + String(key)); return null; }});
  const context = vm.createContext({
    $, Math, String, Object, pocketGame, POCKET_MODE, game:null, menuMode:true, resultShown:false, beaconFinaleTime:0,
    pocketQueue:createStationQueue({limit:3}), stations:{}, targetRing:null, path:[], pathStation:null,
    document:{documentElement:{dataset:{mode:'pocket'}}, body:{classList:{add(){}, remove(){}, toggle(){}}}},
    localStorage:storage, save:spy('save'), saveRun:spy('saveRun'), saveSpeedRecords:spy('saveSpeedRecords'), recordClear:spy('recordClear'),
    social:new Proxy({}, {get:(_, key) => spy('social.' + String(key))}),
    fetch:spy('fetch'), showManagerResults:spy('showManagerResults'),
    audio:{init(){}, update(){}, event(){}}, endBeaconEnding(){}, closePopover(){}, resetBays(){}, resetPad(){}, processEvents(){}, updateUI(){},
    clearMovement(){}, hidePanels(){}, toast(){},
    enterFloor(){ context.menuMode = false; },
  });
  vm.runInContext(['pocketing','pocketRoute','syncPocketMarkers','showPocketPanel','startPocket','showPocketResults','showResults','restartRun'].map(productionFunction).join('\n'), context);
  context.startPocket();
  assert.equal(context.game, pocketGame);
  assert.equal(context.game.mode, 'playing');
  // Ship one part through the shared rules, then end the shift.
  for (const key of ['material-round','lathe']) assert.equal(pocketGame.interact(key), true);
  for (let i = 0; i < 90; i++) pocketGame.tick(.1);
  for (const key of ['lathe','inspect']) assert.equal(pocketGame.interact(key), true);
  for (let i = 0; i < 50; i++) pocketGame.tick(.1);
  for (const key of ['inspect','ship']) assert.equal(pocketGame.interact(key), true);
  pocketGame.finish('time-up');
  context.showResults();
  assert.equal($('pocket-panel').hidden, false);
  assert.equal($('pocket-result').hidden, false);
  assert.equal($('pocket-shipped').textContent, 1);
  assert.equal($('results-panel').hidden, true, 'The shift results, board and challenge links stay closed');
  context.resultShown = false;
  context.restartRun();
  assert.equal(pocketGame.mode, 'playing');
  assert.deepEqual(calls, [], 'No save, record, server run or analytics');
});

test('the hidden route is reachable only by its hash', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/pocket/gi) ?? []).filter(Boolean).length > 0, true);
  assert.doesNotMatch(html.replace(/<section id="pocket-panel"[\s\S]*?<\/section>/, ''), /pocket/i, 'Only the mode panel mentions Pocket Shift');
  assert.doesNotMatch(productionFunction('buildShiftPicker'), /pocket/i);
  assert.doesNotMatch(productionFunction('showHomeView'), /pocket/i);
  assert.match(productionFunction('applyHomeRoute'), /route==='pocket'/);
  const css = await readFile(new URL('../dist/mobile.css', import.meta.url), 'utf8');
  const gate = css.slice(css.indexOf('#phone-rotate-screen {'), css.indexOf('@media (orientation: landscape) {\n  :where(html[data-interface="mobile"][data-phone="true"]) body.playing #shop-sidebar'));
  assert.equal((gate.match(/html\[data-phone="true"\]:not\(\[data-mode="pocket"\]\)/g) ?? []).length, 11, 'Every rotate-gate rule exempts only the pocket route');
  assert.doesNotMatch(gate, /:where\(html\[data-phone="true"\]\)/);
});
