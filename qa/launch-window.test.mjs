// Launch Window is the fifth level. These checks cover its catalog entry, the
// kit and assembly-cell rules, the hangar map, save/score compatibility, the
// layered score, the standalone bundle, and reproducible balance bounds.
// Balance rows are simulations of scripted play, not player data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, stat } from 'node:fs/promises';
import { ShopGame, SHIFTS, OPS, RULESET, LAUNCH_SOURCE_JOBS, scoreShipment, stockType } from '../dist/core.js';
import { LaunchGame, KITS, ASSEMBLY, LAUNCH_LEVEL, kitSeconds, shiftGame } from '../dist/launch.js';
import { TECHNOLOGIES } from '../dist/technology.js';
import { challengeURL, parseChallenge } from '../dist/social.js';
import { validateResult } from '../server/worker.js';
import { simulateShift, navigation } from './balance.mjs';

const LAUNCH = 5;
const level = SHIFTS[LAUNCH];
const START = 1_800_000_000_000;

function advance(game, seconds) {
  for (let left = seconds; left > 1e-8; left -= .05) game.tick(Math.min(.05, left));
}
function fresh() {
  const game = shiftGame(LAUNCH);
  game.nextArrival = Infinity;
  game.drain();
  return game;
}
// The second kit arrives on schedule, 14 s in, so the first stays earlier-due.
function twoKits() {
  const game = shiftGame(LAUNCH);
  advance(game, level.firstArrival + .1);
  game.nextArrival = Infinity;
  game.drain();
  assert.equal(game.kits().length, 2);
  return game;
}
function use(game, station) {
  const ok = game.interact(station);
  const hints = game.drain().filter(event => event.type === 'hint').map(event => event.message);
  assert.equal(ok, true, `${station}: ${hints.join(' ')}`);
}
function refused(game, station, pattern) {
  assert.equal(game.interact(station), false, `${station} should refuse`);
  const hint = game.drain().find(event => event.type === 'hint');
  assert.ok(hint, `${station} explains why`);
  if (pattern) assert.match(hint.message, pattern);
}
// Machine the held part's whole route, ending with it staged in the cell.
function machineToKit(game) {
  for (;;) {
    const part = game.heldOrder;
    const next = part.route[part.index];
    use(game, next);
    if (next === 'assemble') return;
    advance(game, OPS[next].duration + .05);
    use(game, next);
  }
}
function buildKit(game, kit) {
  for (const id of kit.parts) {
    const part = game.order(id);
    use(game, `material-${stockType(part)}`);
    assert.equal(game.hand.orderId, id, 'Stock dispatch hands over this kit’s part');
    machineToKit(game);
  }
}

test('Launch Window is appended at legacy index 5, after Blackout Shift, with its own identity and credit', () => {
  assert.deepEqual(SHIFTS.slice(0, LAUNCH).map(shift => shift.id), ['first-shift','mixed-orders','rush-hour','night-shift','dawn-shift']);
  assert.equal(LAUNCH_LEVEL, LAUNCH);
  assert.equal(level.id, 'launch-window');
  assert.equal(level.mapId, 'launch-pad');
  assert.equal(level.engine, 'launch');
  assert.equal(level.musicTrack, 'launch');
  assert.deepEqual([level.author, level.harness], ['Claude Opus 5.5', 'Claude Code']);
  assert.equal(new Set(SHIFTS.map(shift => shift.id)).size, SHIFTS.length);
  assert.deepEqual({ passTarget:level.passTarget, stars:level.stars, maxOrders:level.maxOrders, duration:level.duration, terminalCount:level.terminalCount },
    { passTarget:4, stars:[4,5,7], maxOrders:7, duration:210, terminalCount:10 });
  assert.equal(level.programming, false, 'Flight programs are locked: no CAD');
  assert.equal(level.calls, false);
  assert.ok(level.kits.every(index => KITS[index]), 'Every scheduled kit exists');
  assert.equal(level.kits.length, level.maxOrders);
});

test('Night Shift and earlier levels keep their released configuration', () => {
  const night = SHIFTS[3];
  assert.deepEqual({ id:night.id, mapId:night.mapId, duration:night.duration, recipes:night.recipes, unlocks:night.unlocks, stars:night.stars, passTarget:night.passTarget, maxOrders:night.maxOrders },
    { id:'night-shift', mapId:'night-shop', duration:210, recipes:[2,5,4,3,4,2], unlocks:['lathe','mill','deburr','anodize','inspect'], stars:[4,5,6], passTarget:4, maxOrders:6 });
  for (let index = 0; index < LAUNCH; index++) {
    assert.equal(SHIFTS[index].engine, undefined, `${SHIFTS[index].id} still runs on ShopGame`);
    assert.ok(shiftGame(index) instanceof ShopGame && !(shiftGame(index) instanceof LaunchGame));
  }
  assert.ok(shiftGame(LAUNCH) instanceof LaunchGame);
  assert.ok(!('assemble' in new ShopGame().stations), 'Earlier levels have no assembly cell');
});

test('every kit is two or three lathe/mill parts that meet in the assembly cell', () => {
  for (const kit of KITS) {
    assert.ok(kit.parts.length >= 2 && kit.parts.length <= 3, kit.name);
    assert.ok(kit.value >= 250 && kit.value <= 420, kit.name);
    for (const part of kit.parts) {
      assert.ok(part.route.length >= 1 && part.route.every(key => ['lathe','mill'].includes(key)), part.name);
      assert.ok(['round','plate','block'].includes(stockType(part)), part.name);
    }
    assert.ok(kitSeconds(kit) > ASSEMBLY.duration + OPS.inspect.duration);
  }
  assert.deepEqual(level.unlocks, ['lathe','mill','assemble','inspect']);
});

test('a kit spawns as one ticket with child parts that share its deadline', () => {
  const game = fresh();
  assert.equal(game.kits().length, 1);
  const kit = game.kits()[0], parts = game.partsOf(kit);
  assert.equal(kit.name, KITS[level.kits[0]].name);
  assert.deepEqual(kit.route, ['assemble','inspect','ship']);
  assert.equal(kit.remaining, level.deadline + 14, 'The opening kit gets the usual extra 14 seconds');
  assert.deepEqual(parts.map(part => part.tag), [`${kit.id}A`, `${kit.id}B`]);
  for (const part of parts) {
    assert.equal(part.route.at(-1), 'assemble');
    assert.equal(part.remaining, kit.remaining);
  }
  advance(game, 5);
  assert.ok(parts.every(part => part.remaining === kit.remaining), 'Parts follow the kit clock');
  assert.equal(game.snapshot().orders.length, 3, 'Snapshots carry the kit and its parts');
});

test('the cell assembles a kit by itself once its last part arrives, then QC and the pad', () => {
  const game = fresh(), kit = game.kits()[0];
  const [first, second] = kit.parts.map(id => game.order(id));
  use(game, `material-${stockType(first)}`);
  machineToKit(game);
  assert.equal(first.location, 'kit');
  assert.equal(game.stations.assemble.part, null, 'One part is not a kit');
  use(game, `material-${stockType(second)}`);
  machineToKit(game);
  const events = game.drain();
  assert.ok(events.some(event => event.type === 'assembling' && event.orderId === kit.id) || game.stations.assemble.part?.orderId === kit.id);
  assert.equal(game.stations.assemble.part.orderId, kit.id);
  assert.equal(game.order(first.id), undefined, 'Joined parts leave the order list');
  refused(game, 'assemble', /Assembling/);
  advance(game, ASSEMBLY.duration + .05);
  assert.equal(game.stations.assemble.ready, true);
  use(game, 'assemble');
  assert.equal(game.hand.orderId, kit.id);
  refused(game, 'ship', /Inspect/);
  refused(game, 'material-round', /cannot go back to stock/);
  use(game, 'inspect');
  advance(game, OPS.inspect.duration + .05);
  use(game, 'inspect');
  const remaining = kit.remaining;
  use(game, 'ship');
  assert.equal(game.shipped, 1);
  assert.equal(game.score, scoreShipment({ value:kit.value, remaining }, 1).total);
  assert.deepEqual(game.stack.map(entry => entry.section), [kit.section]);
  assert.equal(game.orders.length, 0);
});

test('parts can wait in the cell while it is busy, and a waiting kit starts when it is cleared', () => {
  const game = twoKits();
  const [a, b] = game.kits();
  const [aShaft, aPlate] = a.parts.map(id => game.order(id)), [bBlock, bShaft] = b.parts.map(id => game.order(id));
  const cut = key => { use(game, key); advance(game, OPS[key].duration + .05); };
  use(game, 'material-round');assert.equal(game.hand.orderId, aShaft.id);cut('lathe');use(game, 'lathe');use(game, 'assemble');
  use(game, 'material-round');assert.equal(game.hand.orderId, bShaft.id);cut('lathe');
  use(game, 'material-plate');assert.equal(game.hand.orderId, aPlate.id);cut('mill');use(game, 'mill');use(game, 'buffer');
  use(game, 'material-block');assert.equal(game.hand.orderId, bBlock.id);cut('mill');
  use(game, 'buffer');use(game, 'assemble');
  assert.equal(game.stations.assemble.part.orderId, a.id, 'The first kit is being assembled');
  use(game, 'lathe');use(game, 'assemble');use(game, 'mill');use(game, 'assemble');
  assert.ok(game.partsOf(b).every(part => part.location === 'kit'), 'Parts are accepted while the cell works');
  assert.equal(b.started, false);
  advance(game, ASSEMBLY.duration + .05);
  assert.equal(game.stations.assemble.ready, true);
  assert.equal(b.started, false, 'A ready assembly still blocks the cell');
  use(game, 'assemble');
  assert.equal(game.hand.orderId, a.id);
  assert.equal(game.stations.assemble.part.orderId, b.id, 'Collecting starts the next complete kit at once');
});

test('dropping a part at a ready cell swaps it for the finished assembly', () => {
  const game = twoKits();
  const [a, b] = game.kits();
  buildKit(game, a);
  advance(game, ASSEMBLY.duration + .05);
  const part = game.order(b.parts[0]);
  use(game, `material-${stockType(part)}`);
  for (const key of part.route.slice(0, -1)) { use(game, key); advance(game, OPS[key].duration + .05); use(game, key); }
  use(game, 'assemble');
  assert.equal(game.hand.orderId, a.id, 'One interaction kits the part and collects the assembly');
  assert.equal(part.location, 'kit');
});

test('wrong stations explain the next step instead of crashing', () => {
  const game = fresh(), kit = game.kits()[0], part = game.order(kit.parts[0]);
  use(game, `material-${stockType(part)}`);
  const wrong = part.route[0] === 'lathe' ? 'mill' : 'lathe';
  refused(game, wrong, new RegExp(OPS[part.route[0]].name));
  refused(game, 'inspect', /needs/);
  refused(game, 'ship', /needs/);
  refused(game, 'assemble', /first/);
  use(game, part.route[0]);
  advance(game, OPS[part.route[0]].duration + .05);
  use(game, part.route[0]);
  refused(game, 'inspect', /assembly cell/);
  refused(game, 'ship', /assembly cell/);
  // A part can be parked, recycled to its bin, and picked up again.
  use(game, 'buffer');
  assert.equal(part.location, 'buffer');
  use(game, 'buffer');
  use(game, `material-${stockType(part)}`);
  assert.deepEqual([part.started, part.index, part.location, game.hand], [false, 0, 'material', null]);
});

test('an expired kit takes every part with it, wherever they are, and counts one miss', () => {
  const game = fresh();
  const [a] = game.kits();
  const [first, second] = a.parts.map(id => game.order(id));
  use(game, `material-${stockType(first)}`);
  use(game, first.route[0]);
  use(game, `material-${stockType(second)}`);
  use(game, 'buffer');
  advance(game, a.remaining + .1);
  assert.equal(game.missed, 1);
  assert.ok(!game.orders.some(order => order.id === a.id || order.parentId === a.id));
  assert.equal(game.buffer, null);
  assert.ok(Object.values(game.stations).every(station => station.part?.orderId !== first.id));
  assert.equal(game.combo, 0);
});

test('the shift ends early only after every kit resolves, and counts kits as unfinished', () => {
  const game = shiftGame(LAUNCH);
  game.spawnIndex = level.maxOrders; game.nextArrival = Infinity;
  for (const kit of [...game.kits()]) {
    buildKit(game, kit);
    advance(game, ASSEMBLY.duration + .05);
    use(game, 'assemble');use(game, 'inspect');advance(game, OPS.inspect.duration + .05);use(game, 'inspect');use(game, 'ship');
  }
  advance(game, .2);
  assert.equal(game.mode, 'results');
  assert.equal(game.finishReason, 'work-complete');
  assert.equal(game.unfinished, 0);
  const late = shiftGame(LAUNCH);
  advance(late, level.duration + 1);
  assert.equal(late.finishReason, 'time-up');
  assert.equal(late.unfinished, late.kits().length);
  assert.ok(late.unfinished <= 4);
  assert.equal(late.launchDecision(), 'scrub');
});

test('liftoff needs the clear target', () => {
  const game = fresh();
  for (const shipped of [0, 3, 4, 7]) {
    game.shipped = shipped;
    assert.equal(game.launchDecision(), shipped >= level.passTarget ? 'go' : 'scrub');
  }
});

test('Covari offers flight hardware the pad cannot make and delivers it through QC', () => {
  for (const job of LAUNCH_SOURCE_JOBS) {
    assert.equal(TECHNOLOGIES[job.technology].name, job.capability);
    assert.ok(!level.unlocks.includes(job.technology), `${job.capability} is a real capability gap`);
    assert.match(job.gap, /^No .+ at the pad$/);
  }
  const game = fresh();
  game.shipped = 2; game.elapsed = 40;
  advance(game, .1);
  assert.equal(game.sourcing?.state, 'offer');
  assert.ok(LAUNCH_SOURCE_JOBS.some(job => job.name === game.sourcing.name));
  assert.equal(game.requestSource(), true);
  advance(game, 22.1);
  use(game, 'receiving');
  refused(game, 'assemble', /only needs QC/);
  use(game, 'inspect');advance(game, OPS.inspect.duration + .05);use(game, 'inspect');
  const before = game.score;
  use(game, 'ship');
  assert.equal(game.score - before, 300);
  assert.equal(game.covariOnPad, game.sourcing.technology);
  assert.equal(game.stack.length, 0, 'Outsourced work earns points, not a rocket section');
});

test('late arrivals swap to a two-part kit or stop when a kit could not finish', () => {
  const game = fresh();
  game.spawnIndex = level.kits.indexOf(4);
  assert.equal(KITS[level.kits[game.spawnIndex]].parts.length, 3);
  const swapped = game.spawnRecipe(kitSeconds(KITS[4]) - 1);
  assert.ok(swapped && swapped.parts.length === 2, 'A shorter kit replaces the three-part finale');
  assert.equal(game.spawnRecipe(5), null);
});

test('the hangar map adds the cell, drops the office, and every station is reachable', () => {
  const layout = navigation.layoutFor('launch-pad');
  const ids = layout.map(def => def.id);
  assert.ok(ids.includes('assemble'));
  assert.ok(!ids.includes('office') && !ids.includes('deburr') && !ids.includes('anodize'));
  for (const map of ['first-shop','night-shop']) assert.ok(!navigation.layoutFor(map).some(def => def.id === 'assemble'), `${map} has no assembly cell`);
  // Released maps keep their machines where they were.
  for (const map of ['first-shop','night-shop']) {
    const at = Object.fromEntries(navigation.layoutFor(map).map(def => [def.id, [def.x, def.z]]));
    assert.deepEqual([at.lathe, at.mill, at.inspect, at.ship], [[-2.55,-3.4],[1.3,-3.4],[5.8,-2.25],[5.8,1]]);
  }
  navigation.activate('launch-pad');
  const accesses = navigation.accessesFor('launch-pad');
  const needed = ['material-round','material-plate','material-block','lathe','mill','assemble','inspect','ship','buffer','receiving'];
  for (const from of needed) for (const to of needed) {
    if (from === to) continue;
    assert.ok(navigation.safe(accesses[from].x, accesses[from].z), `${from} access is walkable`);
    const route = navigation.route(accesses[from], accesses[to]);
    const near = Math.hypot(accesses[from].x - accesses[to].x, accesses[from].z - accesses[to].z) < 1.4;
    assert.ok(route.length || near, `${from} → ${to}`);
  }
  assert.ok(navigation.safe(navigation.spawn.x, navigation.spawn.z), 'The machinist spawns on open floor');
});

test('earlier levels simulate exactly as before Launch Window', () => {
  // Recorded from Blackout Shift's PR head (9f5d270) with the same driver and 0.5 s handoffs.
  const baseline = [
    [0,'serial',7,3533,141.35],[0,'flow',7,3545,133.95],[1,'serial',5,3259,180],[1,'flow',6,4377,160.4],
    [2,'serial',4,2309,180],[2,'flow',6,3643,180],[3,'serial',5,3661,210],[3,'flow',6,4810,181.69],
    [4,'serial',5,3126,180],[4,'flow',8,6186,161.46],
  ];
  for (const [shift, strategy, shipped, score, elapsed] of baseline) {
    const result = simulateShift(shift, { strategy });
    assert.deepEqual([result.shipped, result.score, result.elapsed], [shipped, score, elapsed], `${SHIFTS[shift].id} ${strategy}`);
  }
});

test('simulated play: slow play clears, overlap earns two stars, the full stack is mastery', () => {
  const flow = simulateShift(LAUNCH, { strategy:'flow' });
  const serial = simulateShift(LAUNCH, { strategy:'serial', reaction:1.5 });
  const slow = simulateShift(LAUNCH, { strategy:'flow', reaction:1.5 });
  const expert = simulateShift(LAUNCH, { reaction:.1, dash:true });
  assert.ok(serial.pass, 'One kit at a time with slow handoffs still clears');
  assert.ok(slow.pass && slow.stars < 3, 'Slow handoffs clear without the full stack');
  assert.ok(flow.stars >= 2 && flow.stars < 3, 'Overlapping kits earns two stars');
  assert.deepEqual([expert.stars, expert.missed], [3, 0]);
  assert.ok(expert.elapsed < level.duration, 'An expert finishes before terminal count');
  assert.equal(expert.score, Object.values(expert.scoreDetails).reduce((sum, points) => sum + points, 0));
  assert.deepEqual(simulateShift(LAUNCH, { reaction:.1, dash:true }), expert, 'Repeatable');
});

test('hosted scores and challenge links accept Launch Window results within its limits', () => {
  for (const options of [{ strategy:'flow' }, { strategy:'serial' }]) {
    const result = simulateShift(LAUNCH, options);
    const value = { role:LAUNCH, score:result.score, shipped:result.shipped, missed:result.missed, sourced:0, calls:0, elapsed:result.elapsed, finishReason:result.finishReason, spawned:result.spawned };
    const run = { role:LAUNCH, ruleset:RULESET, started_at:START };
    assert.equal(validateResult(value, run, START + (result.elapsed + 5) * 1000), null, options.strategy);
    assert.match(validateResult({ ...value, shipped:8, spawned:8 }, run, START + 400_000), /limits/);
  }
  const challenge = { role:LAUNCH, score:5200, shipped:7 };
  assert.deepEqual(parseChallenge(new URL(challengeURL(challenge, 'https://play.example/')).search), { ...challenge, stars:3 });
  assert.equal(parseChallenge(new URL(challengeURL({ ...challenge, shipped:8 }, 'https://play.example/')).search), null);
});

test('Launch Window opens with the rest once First Shift has been played', async () => {
  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  const migration = main.slice(main.indexOf('const SAVE_KEY='), main.indexOf('const STATION_LAYOUT='));
  const load = save => {
    const data = new Map([['chip-rush-roles-v8', JSON.stringify(save)]]);
    const context = vm.createContext({ SHIFTS, RUN_LENGTHS:[0,3,5,7], localStorage:{ getItem:k => data.get(k) ?? null, setItem:(k, v) => data.set(k, v) } });
    vm.runInContext(`let unlocked=0,bests=SHIFTS.map(()=>0),grades=SHIFTS.map(()=>0);function save(){}${migration};this.result={unlocked,bests,grades};`, context);
    return JSON.parse(JSON.stringify(context.result));
  };
  assert.deepEqual(load({ unlocked:0, bests:[640], grades:[0] }), { unlocked:LAUNCH, bests:[640,0,0,0,0,0], grades:[0,0,0,0,0,0] }, 'A failed First Shift run still counts');
  assert.equal(load({ unlocked:0, bests:[], grades:[] }).unlocked, 0, 'A new player starts at First Shift');
  assert.equal(load({ unlocked:0, bests:[0,0,9000], grades:[0,0,3] }).unlocked, 0, 'Friend-challenge stars elsewhere open nothing');
});

test('the countdown score is three looped stems of one length, layered by the count', async () => {
  const meta = JSON.parse(await readFile(new URL('../dist/assets/music/launch-window-120.json', import.meta.url), 'utf8'));
  assert.equal(meta.bpm, 120);
  assert.equal(meta.loopEndSeconds, 32);
  for (const key of ['base','drive','climax']) {
    assert.equal(meta.files[key].mp3.decodedQa.frames, 32 * 44100, key);
    assert.equal(meta.files[key].mp3.decodedQa.clippedSamples, 0, key);
    assert.equal((await stat(new URL(`../dist/assets/music/launch-${key}-120.mp3`, import.meta.url))).size, meta.files[key].mp3.bytes);
  }
  const code = (await readFile(new URL('../dist/audio.js', import.meta.url), 'utf8')).replace('export class ShopAudio', 'class ShopAudio') + '\nthis.ShopAudio=ShopAudio;';
  const sources = [], urls = [];
  const param = () => ({ value:0, setTargetAtTime(v){ this.value=v; }, setValueAtTime(v){ this.value=v; }, cancelScheduledValues(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} });
  const node = () => ({ gain:param(), connect(){}, disconnect(){} });
  class Context {
    constructor(){ this.currentTime=0; this.state='running'; this.destination={}; }
    createGain(){ return node(); } resume(){ return Promise.resolve(); }
    decodeAudioData(){ return Promise.resolve({ duration:32 }); }
    createBufferSource(){ const n={ ...node(), start(...args){ this.started=args; }, stop(){ this.stopped=true; } }; sources.push(n); return n; }
    createOscillator(){ return { ...node(), frequency:param(), start(){}, stop(){} }; }
  }
  const context = vm.createContext({ window:{ AudioContext:Context }, AbortSignal, fetch:async url => { urls.push(url); return { ok:true, arrayBuffer:async () => new ArrayBuffer(0) }; } });
  vm.runInContext(code, context);
  const audio = new context.ShopAudio();
  audio.init(); audio.setTrack('launch'); audio.update(true);
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(Array.from(urls).filter(url => url.includes('launch')).sort(), ['./assets/music/launch-base-120.mp3','./assets/music/launch-climax-120.mp3','./assets/music/launch-drive-120.mp3']);
  const stems = audio.stemSources;
  assert.equal(stems.length, 3);
  assert.ok(stems.every(stem => stem.source.loop && stem.source.loopEnd === 32 && stem.source.started[0] === stems[0].source.started[0]), 'Stems start together and loop at 32 s');
  const gains = () => Array.from(stems, stem => stem.layer.gain.value);
  assert.deepEqual(gains(), [1,0,0], 'The count opens on the base layer');
  audio.setIntensity(2);
  assert.deepEqual(gains(), [1,1,1], 'The last minute plays every layer');
  audio.setTrack('country');
  assert.equal(audio.stemSources, null);
  assert.ok(stems.every(stem => stem.source.stopped));
});

test('the standalone bundle binds every import, including Launch Window and the halls', async () => {
  const bundle = await readFile(new URL('./offline-syntax.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new vm.Script(bundle), 'The bundle parses');
  assert.doesNotMatch(bundle, /\.\/assets\/music\//, 'Music is embedded');
  for (const name of ['createHangar','createLaunchComplex','LaunchGame','HALLS','createHall']) assert.match(bundle, new RegExp(`const \\{[^}]*\\b${name}\\b[^}]*\\}=(Models|Launch|Manager);`), name);
  assert.equal((bundle.match(/data:audio\/mpeg;base64,/g) ?? []).length, 4, 'The country loop and three launch stems');
});
