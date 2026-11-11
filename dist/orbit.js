import { ShopGame, SHIFTS, OPS } from './core.js';

// First Light (legacy index 7): the shop works from an orbital dock, finishing
// the primary mirror of the telescope that flew on the rocket it helped build.
// Nothing falls here, so a held part can be tossed: it drifts to a station on
// its own while the machinist does something else. Every machine has a catch
// ring that holds one part, in flight or waiting, and loads it as soon as the
// machine is free. A finished segment is tossed into the mirror itself.
// Stock, the Hold bench, Receiving, scoring and Covari reuse ShopGame's rules.
export const ORBIT_LEVEL = SHIFTS.findIndex(level => level.engine === 'orbit');
export const ORBIT_OPS = {
  ...OPS,
  polish:{name:'Polish',short:'POLISH',duration:6,color:'#cfe3ee'},
  gild:{name:'Gold coat',short:'GOLD',duration:7,color:'#f2c14e'},
  ship:{...OPS.ship,name:'Mirror',short:'SET'},
};
export const orbitOp = key => (Object.hasOwn(ORBIT_OPS, key) ? ORBIT_OPS[key] : undefined);
// Twelve outer segments are made here; the inner six flew up already installed.
export const MIRROR_SLOTS = 12;
export const FLOWN_SEGMENTS = 6;
export const SEGMENTS = [
  {name:'Turned segment',kind:'shaft',route:['lathe','polish','gild','inspect'],value:230,color:0xf2c14e},
  {name:'Milled segment',kind:'plate',route:['mill','polish','gild','inspect'],value:250,color:0xf2c14e},
  {name:'Ribbed segment',kind:'block',route:['mill','lathe','polish','gild','inspect'],value:330,color:0xf2c14e},
];
// A tossed part drifts at a constant speed. The renderer and the balance
// driver measure the distance; the rules bound the resulting flight time.
export const TOSS_SPEED = 3.2;
export const TOSS_MIN = .4;
export const TOSS_MAX = 8;
export function tossSeconds(distance) {
  const seconds = Number.isFinite(distance) ? Math.max(0, distance) / TOSS_SPEED : TOSS_MAX;
  return Math.max(TOSS_MIN, Math.min(TOSS_MAX, seconds));
}
const ringLocation = key => `ring-${key}`;

export class FirstLightGame extends ShopGame {
  // ShopGame's constructor resets to level 0; this engine only runs its own level.
  reset(shift = ORBIT_LEVEL) {
    if (SHIFTS[shift]?.engine !== 'orbit') shift = ORBIT_LEVEL;
    this.flights = [];
    this.rings = {};
    this.installed = [];
    this.shield = false;
    super.reset(shift);
    for (const key of ['polish', 'gild']) this.stations[key] = {part:null,remaining:0,ready:false};
    for (const key of this.machines()) this.rings[key] = null;
  }

  machines() { return this.config.unlocks; }
  inbound(key) { return this.flights.some(flight => flight.to === key); }
  ringFree(key) { return this.rings[key] == null && !this.inbound(key); }
  needs(order) {
    const next = order.route[order.index];
    const label = order.id === 201 ? 'The Covari part' : `#${order.id}`;
    return `${label} needs ${next === 'ship' ? 'the mirror' : ORBIT_OPS[next].name.toLowerCase()} next.`;
  }

  // Generous on purpose: this is the late-arrival cut, not a route planner.
  requiredTime(recipe, includeWait = false) {
    const route = recipe.route.filter(key => key !== 'ship');
    const processing = route.reduce((seconds, key) => seconds + ORBIT_OPS[key].duration, 0);
    const handling = (route.length + 1) * 2.6 + 4;
    const waits = includeWait ? route.reduce((seconds, key) => {
      const station = this.stations?.[key];
      return seconds + (station?.part ? station.remaining + 3 : 0) + (this.rings?.[key] != null ? ORBIT_OPS[key].duration : 0);
    }, 0) : 0;
    return processing + handling + waits;
  }

  spawnRecipe(timeRemaining) {
    const recipe = SEGMENTS[this.config.recipes[this.spawnIndex % this.config.recipes.length]];
    if (timeRemaining >= this.requiredTime(recipe, true)) return recipe;
    return SEGMENTS.filter(candidate => timeRemaining >= this.requiredTime(candidate, true))
      .sort((a, b) => this.requiredTime(a) - this.requiredTime(b))[0] ?? null;
  }

  startMachine(key, part) {
    const station = this.stations[key], order = this.order(part.orderId);
    station.part = part;
    station.remaining = ORBIT_OPS[key].duration;
    station.ready = false;
    if (order) order.location = key;
  }

  // A waiting part loads itself the moment its machine is empty.
  settle() {
    for (const key of Object.keys(this.rings)) {
      const id = this.rings[key];
      if (id == null || this.stations[key].part) continue;
      this.rings[key] = null;
      this.startMachine(key, {orderId:id});
      this.emit('load', {station:key,orderId:id,fromRing:true});
    }
  }

  useMachine(key) {
    const op = ORBIT_OPS[key], station = this.stations[key], held = this.heldOrder;
    if (station.part) {
      if (!station.ready) {
        // A busy machine still takes one part by hand, hung in its catch ring.
        if (held && held.route[held.index] === key) {
          if (!this.ringFree(key)) return this.fail(`${op.name} is working and its catch ring is taken.`);
          this.rings[key] = held.id;
          held.location = ringLocation(key);
          this.hand = null;
          this.emit('caught', {station:key,orderId:held.id});
          return true;
        }
        return this.fail(`${op.name} is working. Handle another segment.`);
      }
      if (held) {
        if (held.route[held.index] !== key) return this.fail(this.needs(held));
        const completed = station.part;
        this.startMachine(key, this.hand);
        this.hand = completed;
        this.order(completed.orderId).location = 'hands';
        this.emit('load', {station:key,orderId:held.id,collectedOrderId:completed.orderId});
        return true;
      }
      this.hand = station.part;
      station.part = null;
      station.ready = false;
      station.remaining = 0;
      this.order(this.hand.orderId).location = 'hands';
      this.emit('pickup', {station:key,orderId:this.hand.orderId});
      return true;
    }
    if (!held) return this.fail(`Bring a segment that needs ${op.name.toLowerCase()}.`);
    if (held.route[held.index] !== key) return this.fail(this.needs(held));
    this.startMachine(key, this.hand);
    this.hand = null;
    this.emit('load', {station:key,orderId:held.id});
    return true;
  }

  // Setting a finished segment in the mirror is this level's shipment: the
  // shared scoring, clear split, Covari bonus and events all apply.
  install(id) {
    const order = this.order(id);
    if (!order) return false;
    const carried = this.hand?.orderId === id ? null : this.hand;
    const color = order.color, name = order.name;
    this.hand = {orderId:id};
    const done = super.interact('ship');
    this.hand = carried;
    if (!done) return false;
    if (id === 201) {
      this.shield = true;
      this.emit('shieldDeployed', {orderId:id});
    } else {
      const slot = this.installed.length;
      this.installed.push({id,slot,color,name,at:this.elapsed});
      this.emit('installed', {orderId:id,slot,count:this.installed.length});
    }
    return true;
  }

  interact(key) {
    if (this.mode !== 'playing') return false;
    if (key === 'mirror') key = 'ship';
    let done;
    if (key === 'ship') {
      const held = this.heldOrder;
      if (!held) done = this.fail('Bring a gold-coated, inspected segment to the mirror.');
      else if (held.route[held.index] !== 'ship') done = this.fail(this.needs(held));
      else done = this.install(held.id);
    } else if (this.machines().includes(key)) {
      done = this.useMachine(key);
    } else if (Object.hasOwn(ORBIT_OPS, key)) {
      done = this.fail(`${ORBIT_OPS[key].name} is not on this dock.`);
    } else if (key === 'buffer' && this.hand && !this.buffer && this.inbound('buffer')) {
      done = this.fail('A segment is already drifting to the Hold bench.');
    } else {
      done = super.interact(key);
    }
    this.settle();
    return done;
  }

  // Why the held part cannot be tossed to this station, or null when it can.
  tossBlock(key) {
    if (key === 'mirror') key = 'ship';
    if (this.mode !== 'playing') return 'The dock is not working right now.';
    const held = this.heldOrder;
    if (!held) return 'Pick up a segment before tossing.';
    if (key === 'buffer') return this.buffer || this.inbound('buffer') ? 'The Hold bench is taken.' : null;
    if (key !== 'ship' && !this.machines().includes(key)) return 'Toss a segment to a machine, the Hold bench or the mirror.';
    if (held.route[held.index] !== key) return this.needs(held);
    if (key !== 'ship' && !this.ringFree(key)) return `${ORBIT_OPS[key].name}’s catch ring is taken.`;
    return null;
  }

  toss(key, seconds) {
    if (key === 'mirror') key = 'ship';
    const block = this.tossBlock(key);
    if (block) return this.fail(block);
    const held = this.heldOrder, duration = Math.max(TOSS_MIN, Math.min(TOSS_MAX, Number.isFinite(seconds) ? seconds : TOSS_MAX));
    this.flights.push({orderId:held.id,to:key,remaining:duration,duration});
    held.location = 'flight';
    this.hand = null;
    this.emit('toss', {orderId:held.id,to:key,seconds:duration});
    return true;
  }

  land(flight) {
    const order = this.order(flight.orderId);
    if (!order) return;
    const key = flight.to;
    if (key === 'ship') { this.install(order.id); return; }
    if (key === 'buffer') {
      this.buffer = {orderId:order.id};
      order.location = 'buffer';
      this.emit('caught', {station:key,orderId:order.id});
      return;
    }
    if (!this.stations[key].part) {
      this.startMachine(key, {orderId:order.id});
      this.emit('load', {station:key,orderId:order.id,caught:true});
    } else {
      this.rings[key] = order.id;
      order.location = ringLocation(key);
      this.emit('caught', {station:key,orderId:order.id});
    }
  }

  tick(dt) {
    if (this.mode !== 'playing') return;
    dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .1, this.time));
    for (const flight of [...this.flights]) {
      flight.remaining -= dt;
      if (flight.remaining > 1e-9) continue;
      this.flights = this.flights.filter(other => other !== flight);
      this.land(flight);
    }
    this.settle();
    super.tick(dt);
    if (this.mode === 'playing') this.settle();
  }

  expire(id) {
    this.flights = this.flights.filter(flight => flight.orderId !== id);
    for (const key of Object.keys(this.rings)) if (this.rings[key] === id) this.rings[key] = null;
    super.expire(id);
  }

  // A segment still adrift at closing is unfinished: only a landing installs it.
  finish(reason) {
    super.finish(reason);
    this.flights = this.flights.filter(flight => flight.orderId !== 201);
    for (const key of Object.keys(this.rings)) if (this.rings[key] === 201) this.rings[key] = null;
  }

  canFinishEarly() { return !this.flights.length && super.canFinishEarly(); }

  snapshot() {
    return {...super.snapshot(),flights:this.flights.map(flight => ({...flight})),rings:{...this.rings},installed:this.installed.map(part => ({...part})),shield:this.shield};
  }
}
