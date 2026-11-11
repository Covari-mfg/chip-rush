// Pocket Shift (pocket-v1) balance: deterministic simulation, not a playtest.
// Plays the real PocketGame rules on the production pocket-shop floor, with
// production A* collision routes and walking speed (an optional walk multiplier
// explores a faster machinist; play uses none). Strategies reuse the shared balance driver's decisions:
//   slow     one job at a time, 1s after every interaction, declines Covari
//   ordinary overlaps machines, 0.5s, accepts Covari
//   expert   overlaps machines, 0.1s, accepts Covari
// These are simulation targets, not predictions of how long people last.
// --assert checks the targets; --rooms compares walking between rooms on First
// Shift's own rules; --trace prints each run's action log.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ShopGame, SHIFTS, stockType } from '../dist/core.js';
import { PocketGame, POCKET_MODE } from '../dist/pocket.js';
import { navigation, Driver } from './balance.mjs';

const BASE_SPEED = 4.4, DT = .05;
export const CEILING = 12 * 60;
export const TARGETS = Object.freeze({slow:[90, 180], expert:[240, 480]});

// The shared driver, walking on a chosen map at a chosen speed.
class RoomDriver extends Driver {
  constructor(game, strategy, {reaction, covari = 'decline', walk = 1, mapId = game.config.mapId}) {
    super(0, strategy, 'decline', {reaction, covari});
    this.game = game;
    this.mapId = mapId;
    this.speed = BASE_SPEED * walk;
    this.position = {...(navigation.maps[mapId].spawn ?? navigation.spawn)};
  }
  pathTo(id) {
    const access = navigation.accessesFor(this.mapId)[id];
    assert.ok(access, `Known destination ${id}`);
    navigation.activate(this.mapId);
    const points = navigation.route(this.position, access);
    assert.ok(points.length || Math.hypot(this.position.x - access.x, this.position.z - access.z) < 1.4, `Reachable ${id}`);
    return points;
  }
  walk(id) {
    if (this.at === id) return;
    const points = this.pathTo(id);
    let previous = this.position, length = 0;
    for (const point of points) { length += Math.hypot(point.x - previous.x, point.z - previous.z); previous = point; }
    const seconds = length / this.speed + DT;
    this.tick(seconds);
    this.travelSeconds += seconds;
    this.position = {x:previous.x, z:previous.z};
    this.at = id;
  }
  // Pocket decisions. Unlike the shared driver, a held part may be swapped for
  // a finished one at its next station (the shared rules allow it) or parked on
  // the Hold bench, so a Covari crate can never stall the floor.
  runPocket() {
    const g = this.game, st = key => g.stations[key];
    const free = key => key === 'ship' || !st(key).part || st(key).ready;
    let guard = 0;
    while (g.mode === 'playing' && guard++ < 40000) {
      if (this.covari === 'accept' && g.sourcing?.state === 'offer' && g.requestSource()) { this.event('source-accept'); this.tick(Math.max(DT, this.actionDelay)); continue; }
      const held = g.heldOrder;
      if (held) {
        const next = held.route[held.index];
        if (free(next)) this.interact(next);
        else if (!g.buffer && this.strategy !== 'serial') this.interact('buffer');
        else this.tick(.2);
        continue;
      }
      if (this.strategy === 'serial') {
        let order = g.order(this.activeId);
        if (!order || order.location === 'shipped') { order = g.orders[0]; this.activeId = order?.id; }
        if (!order) { this.tick(.2); continue; }
        if (!order.started) this.interact('material-' + stockType(order));
        else if (st(order.location)?.ready) this.interact(order.location);
        else this.tick(.2);
        continue;
      }
      const ready = Object.entries(g.stations).filter(([, s]) => s.ready).map(([key, s]) => ({key, order:g.order(s.part.orderId)}))
        .filter(({key, order}) => { const next = order.route[order.index]; return next === 'ship' || next !== key && free(next); })
        .sort((a, b) => (a.order.route.length - a.order.index) * 4 + a.order.remaining * .08 + this.distanceTo(a.key) * .3 - ((b.order.route.length - b.order.index) * 4 + b.order.remaining * .08 + this.distanceTo(b.key) * .3));
      if (ready.length) { this.interact(ready[0].key); continue; }
      const parked = g.buffer && g.order(g.buffer.orderId);
      if (parked && free(parked.route[parked.index])) { this.interact('buffer'); continue; }
      if (g.receiving && g.sourcing?.state === 'delivered' && !g.buffer) { this.interact('receiving'); continue; }
      const fresh = g.orders.filter(o => !o.started && free(o.route[0]) && !st(o.route[0]).part).sort((a, b) => a.remaining - b.remaining);
      if (fresh.length) { this.interact('material-' + stockType(fresh[0])); continue; }
      this.tick(.2);
    }
    assert.ok(guard < 40000, 'Driver must finish a run');
    return {elapsed:+g.elapsed.toFixed(2), shipped:g.shipped, score:g.score, finishReason:g.finishReason, sourced:g.sourced, spawned:g.spawnIndex, walkingSeconds:+this.travelSeconds.toFixed(1)};
  }
}

export const STRATEGIES = Object.freeze({
  slow:{strategy:'serial', reaction:1, covari:'decline'},
  ordinary:{strategy:'flow', reaction:.5, covari:'accept'},
  expert:{strategy:'flow', reaction:.1, covari:'accept'},
});

export function simulatePocket(name, {walk = 1, pace, options = STRATEGIES[name]} = {}) {
  const game = new PocketGame(pace);
  game.reset();
  const driver = new RoomDriver(game, options.strategy, {...options, walk}), run = driver.runPocket();
  return {
    player:name, strategy:options.strategy, reaction:options.reaction, covari:options.covari,
    survived:run.elapsed, shipped:run.shipped, points:run.score, strikes:game.strikes, finish:run.finishReason,
    sourced:run.sourced, offers:game.offers, ordersSeen:run.spawned,
    walkingSeconds:run.walkingSeconds, walkingShare:+(run.walkingSeconds / Math.max(1, run.elapsed)).toFixed(3),
    log:driver.log,
  };
}

// First Shift's own rules and orders, played on another room: how much the room
// alone changes walking.
export function compareRooms(walk = 1) {
  const rows = [];
  for (const strategy of ['serial', 'flow']) for (const [mapId, scale] of [['first-shop', 1], ['pocket-shop', 1], ...(walk === 1 ? [] : [['pocket-shop', walk]])]) {
    const game = new ShopGame();
    game.reset(0);
    game.config = {...SHIFTS[0], mapId};
    const run = new RoomDriver(game, strategy, {reaction:.5, walk:scale, mapId}).run();
    rows.push({rules:'First Shift', room:mapId, walk:scale, strategy, shipped:run.shipped, missed:run.missed, walkingSeconds:run.walkingSeconds, walkingShare:+(run.walkingSeconds / run.elapsed).toFixed(3)});
  }
  navigation.activate('first-shop');
  return rows;
}

export function checkTargets(rows) {
  for (const row of rows) {
    assert.equal(row.finish, 'strikes', `${row.player}: only the third strike ends a run`);
    assert.equal(row.strikes, POCKET_MODE.strikes);
    assert.ok(row.survived < CEILING, `${row.player} run ends before ${CEILING}s (simulated ${row.survived}s)`);
  }
  const by = Object.fromEntries(rows.map(row => [row.player, row]));
  for (const [player, [low, high]] of Object.entries(TARGETS)) {
    assert.ok(by[player].survived >= low && by[player].survived <= high, `${player} lasts ${low}–${high}s in simulation (got ${by[player].survived}s)`);
  }
  assert.ok(by.slow.survived < by.ordinary.survived && by.ordinary.survived < by.expert.survived, 'Better play lasts longer');
  assert.ok(by.expert.sourced >= 1, 'The expert carries at least one Covari job through');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const rows = Object.keys(STRATEGIES).map(name => simulatePocket(name));
  console.table(rows.map(({log, ...summary}) => summary));
  if (process.argv.includes('--rooms')) console.table(compareRooms());
  if (process.argv.includes('--trace')) for (const row of rows) { console.log(`\n${row.player}`); console.table(row.log); }
  if (process.argv.includes('--assert')) { checkTargets(rows); console.log('pocket-v1 simulation targets hold'); }
  navigation.activate('first-shop');
}
