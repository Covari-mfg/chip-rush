import { ShopGame, RECIPES, FINISHING_SOURCE_JOBS } from './core.js';

// Pocket Shift: a portrait, one-thumb mode reached only through the hidden
// #/pocket route. It is a separate mode, not a level: it is not in SHIFTS, has
// no legacy index and never posts a run. Ruleset pocket-v1: endless, three
// strikes. Orders come from a fixed-seed stream, the pace tightens with time,
// and the third expired order ends the run. See docs/experiments/pocket-shift.md.
export const POCKET_RULESET = 'pocket-v1';
// Never a valid SHIFTS index, and distinct from Open for Business (-1).
export const POCKET_ROLE = -2;
export const POCKET_STRIKES = 3;
export const POCKET_SEED = 0x5eed2026;

// Pace, in seconds of run time (tuned with qa/pocket-balance.mjs; simulation
// targets, not player data). Both curves ease linearly to their floors.
export const POCKET_PACE = Object.freeze({
  interval:Object.freeze({start:18, floor:9, over:360}),  // seconds between arrivals
  deadline:Object.freeze({start:82, floor:48, over:90}),  // deadline of a two-step part
  firstOrderBonus:14,                       // the opening order, as in First Shift
  extraStep:10,                             // added per route step beyond two
});
const ease = ({start, floor, over}, t) => start + (floor - start) * Math.min(1, Math.max(0, t) / over);
export const pocketInterval = (t, pace = POCKET_PACE) => ease(pace.interval, t);
// Deadline for a recipe arriving at run time t.
export function pocketDeadline(t, recipe, pace = POCKET_PACE) {
  const steps = recipe.route.filter(key => key !== 'ship').length;
  return Math.round(ease(pace.deadline, t) + Math.max(0, steps - 2) * pace.extraStep);
}

// Variety grows in stages, counted by order number so every run sees the same
// sequence. Indices are RECIPES positions in core.js.
const SPACER = 0, PLATE = 1, KNOB = 2, VALVE = 3, HOUSING = 6;
export const POCKET_STAGES = Object.freeze([
  Object.freeze({from:0, recipes:Object.freeze([SPACER, PLATE])}),
  Object.freeze({from:4, recipes:Object.freeze([SPACER, PLATE, HOUSING])}),
  Object.freeze({from:10, recipes:Object.freeze([SPACER, PLATE, HOUSING, KNOB, VALVE])}),
]);
export const pocketStage = n => POCKET_STAGES.reduce((stage, s, i) => n >= s.from ? i : stage, 0);

// mulberry32: small, fast and identical on every engine.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// The order stream: the first order of each stage shows its new part(s), the
// rest draw from the stage's pool. No part comes three times in a row.
const stream = [], next = random(POCKET_SEED);
export function pocketRecipeIndex(n) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('Order number must be a nonnegative integer');
  while (stream.length <= n) {
    const i = stream.length, stage = POCKET_STAGES[pocketStage(i)], prev = POCKET_STAGES[pocketStage(i) - 1];
    const fresh = stage.recipes.filter(r => !prev?.recipes.includes(r));
    let pick;
    if (i < 2) pick = [SPACER, PLATE][i];
    else if (i - stage.from < fresh.length && i >= stage.from && prev) pick = fresh[i - stage.from];
    else {
      pick = stage.recipes[Math.floor(next() * stage.recipes.length)];
      if (stream.at(-1) === pick && stream.at(-2) === pick) pick = stage.recipes[(stage.recipes.indexOf(pick) + 1) % stage.recipes.length];
    }
    stream.push(pick);
  }
  return stream[n];
}

export const POCKET_MODE = Object.freeze({
  id:'pocket-shift', mapId:'pocket-shop', name:'Pocket Shift', ruleset:POCKET_RULESET, beta:true,
  brief:'Tap up to three stations in order. Your machinist walks the plan and uses each one.',
  duration:Infinity, firstArrival:0,
  unlocks:Object.freeze(['lathe','mill','deburr','inspect']), stock:Object.freeze(['round','plate','block']),
  programming:false, calls:false, callTimes:Object.freeze([]),
  // Covari: the floor has no anodizing, heat treatment, powder coating or laser.
  sourcing:true, sourceJobs:FINISHING_SOURCE_JOBS, sourceGap:60, sourceAfterShipments:2,
  maxActive:4, strikes:POCKET_STRIKES,
  // No clear target or stars: the run is endless and ends on the third strike.
  passTarget:Infinity, stars:Object.freeze([]),
});

export class PocketGame extends ShopGame {
  // pace is POCKET_PACE in play; the balance sweep may pass another curve.
  constructor(pace = POCKET_PACE) { super(); this.pace = pace; }
  reset() {
    this.pace ??= POCKET_PACE;
    // ShopGame's reset prepares the shared state from First Shift; the pocket
    // rules then replace its identity, clock and opening order.
    this.resetting = true;
    super.reset(0);
    this.resetting = false;
    this.shiftIndex = POCKET_ROLE;
    this.config = POCKET_MODE;
    this.pocket = true;
    this.time = Infinity;
    this.orders = [];
    this.events = [];
    this.selectedId = null;
    this.nextId = 101;
    this.spawnIndex = 0;
    this.strikes = 0;
    // The shared first-offer rule is replaced by recurring offers below.
    this.sourceOffered = true;
    this.offers = 0;
    this.nextSourceAt = null;
    this.sourceResolved = true;
    this.spawn();
    this.nextArrival = pocketInterval(0, this.pace);
  }

  spawn() {
    if (this.resetting) return false;
    if (this.orders.length >= this.config.maxActive) return false;
    const n = this.spawnIndex, recipe = RECIPES[pocketRecipeIndex(n)];
    const deadline = pocketDeadline(this.elapsed, recipe, this.pace) + (n === 0 ? this.pace.firstOrderBonus : 0);
    const order = {
      id:this.nextId++, ...recipe, route:[...recipe.route, 'ship'], index:0,
      remaining:deadline, deadline, started:false, location:'material',
      programmed:true, programRemaining:0, number:n, stage:pocketStage(n),
    };
    this.orders.push(order);
    this.spawnIndex++;
    if (!this.selectedId) this.selectedId = order.id;
    this.emit('arrival', {orderId:order.id, stage:order.stage});
    if (n === POCKET_STAGES[order.stage].from && order.stage > 0) this.emit('stage', {stage:order.stage});
    return true;
  }

  // An expired order is a strike. The third strike ends the run at once.
  expire(id) {
    if (!this.orders.some(order => order.id === id)) return;
    super.expire(id);
    this.strikes++;
    this.emit('strike', {orderId:id, strikes:this.strikes, final:this.strikes >= this.config.strikes});
    if (this.strikes >= this.config.strikes) this.finish('strikes');
  }

  // Offers recur: the first after two normal shipments, each later one a quiet
  // gap after the previous offer resolves. A Covari job is never a strike.
  tickSourcing(dt) {
    const job = this.sourcing;
    if (job && !this.sourceResolved && ['declined','fulfilled'].includes(job.state)) {
      this.sourceResolved = true;
      this.nextSourceAt = this.elapsed + this.config.sourceGap;
    }
    const due = this.nextSourceAt === null ? this.shipped >= this.config.sourceAfterShipments : this.elapsed >= this.nextSourceAt;
    if (this.sourceResolved && due) {
      const jobs = this.config.sourceJobs, pick = jobs[this.offers % jobs.length];
      this.offers++;
      this.sourceResolved = false;
      this.sourcing = {id:201, ...pick, kind:'block', route:['inspect','ship'], index:0, programmed:true, programRemaining:0, started:false, location:'supplier', value:300, color:0xffab8c, state:'offer', offerRemaining:30, remaining:22, points:300, number:this.offers};
      this.emit('sourceOffer', {orderId:201, number:this.offers});
    }
    super.tickSourcing(dt);
  }

  tick(dt) {
    if (this.mode !== 'playing') return;
    dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .1));
    this.elapsed += dt;
    for (const [key, station] of Object.entries(this.stations)) {
      if (!station.part || station.ready) continue;
      station.remaining = Math.max(0, station.remaining - dt);
      if (station.remaining > 0) continue;
      station.ready = true;
      const order = this.order(station.part.orderId);
      if (order) { order.index++; order.location = key; this.emit('ready', {station:key, orderId:order.id}); }
    }
    for (const order of [...this.orders]) {
      order.remaining -= dt;
      if (order.remaining <= 0) this.expire(order.id);
      if (this.mode !== 'playing') return;
    }
    if (this.elapsed >= this.nextArrival) this.nextArrival = this.elapsed + (this.spawn() ? pocketInterval(this.elapsed, this.pace) : 2);
    this.tickSourcing(dt);
  }

  snapshot() {
    return {...super.snapshot(), time:null, strikes:this.strikes, maxStrikes:this.config.strikes, survived:this.elapsed,
      stage:pocketStage(Math.max(0, this.spawnIndex - 1)), nextArrival:this.nextArrival, offers:this.offers};
  }
}

// Local best only, under its own key. Nothing here touches the shared save.
export const POCKET_SAVE_KEY = 'chip-rush-pocket-v1';
const count = value => Math.max(0, Math.trunc(Number(value)) || 0);
export function readPocketBest(storage) {
  let value = null;
  try { value = JSON.parse(storage?.getItem(POCKET_SAVE_KEY) || 'null'); } catch { value = null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const seconds = Number(value.longestSeconds);
  return {bestPoints:count(value.bestPoints), bestShipped:count(value.bestShipped),
    longestSeconds:Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 10) / 10 : 0, runs:count(value.runs)};
}
export function recordPocketRun(storage, {score = 0, shipped = 0, elapsed = 0} = {}) {
  const previous = readPocketBest(storage);
  const best = {bestPoints:Math.max(previous.bestPoints, count(score)), bestShipped:Math.max(previous.bestShipped, count(shipped)),
    longestSeconds:Math.max(previous.longestSeconds, Math.round((Number(elapsed) || 0) * 10) / 10), runs:previous.runs + 1};
  try { storage?.setItem(POCKET_SAVE_KEY, JSON.stringify({v:1, ...best})); } catch {}
  return {previous, best, newBest:count(score) > previous.bestPoints};
}
