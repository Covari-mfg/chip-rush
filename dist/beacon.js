import { ShopGame, SHIFTS } from './core.js';

export const BEACON_LEVEL = SHIFTS.findIndex(level => level.engine === 'beacon');
export const TENDER_CAPACITY = 3;
export const CROSSING_SECONDS = 12;
export const CHANNEL_PERIOD = 36;
export const WINDOW_START = 20;
export const WINDOW_SECONDS = 12;
export function crossingWindow(elapsed) {
  const phase=((elapsed%CHANNEL_PERIOD)+CHANNEL_PERIOD)%CHANNEL_PERIOD;
  const open=phase>=WINDOW_START-1e-8&&phase<WINDOW_START+WINDOW_SECONDS-1e-8;
  return {open,remaining:open?WINDOW_START+WINDOW_SECONDS-phase:phase<WINDOW_START?WINDOW_START-phase:CHANNEL_PERIOD+WINDOW_START-phase};
}
export const BEACON_RECIPES = [
  {name:'Lantern spindle',kind:'shaft',route:['lathe','inspect'],value:160,color:0xf2c77b},
  {name:'Fresnel carrier',kind:'plate',route:['mill','inspect'],value:185,color:0x85dfd2},
  {name:'Gimbal cradle',kind:'block',route:['lathe','mill','inspect'],value:245,color:0xf2a48b},
];

// The quay is a three-slot buffer. The tender carries one batch at a time.
// Loading is not shipping: only arrival at the lighthouse earns points/stars.
export class BeaconGame extends ShopGame {
  reset(shift = BEACON_LEVEL) {
    if (SHIFTS[shift]?.engine !== 'beacon') shift = BEACON_LEVEL;
    this.quay = [];
    this.tender = {phase:'docked',remaining:0,cargo:[],trips:0};
    this.installed = [];
    super.reset(shift);
  }

  requiredTime(recipe, includeWait = false) {
    const work=super.requiredTime(recipe,includeWait);
    const boatWait=includeWait&&this.tender.phase!=='docked'?this.tender.remaining+(this.tender.phase==='outbound'?CROSSING_SECONDS:0):0;
    const ready=Math.max(work,boatWait),window=crossingWindow(this.elapsed+ready);
    return ready+(window.open?0:window.remaining)+CROSSING_SECONDS;
  }

  spawnRecipe(timeRemaining) {
    const recipe = BEACON_RECIPES[this.config.recipes[this.spawnIndex % this.config.recipes.length]];
    if (timeRemaining >= this.requiredTime(recipe, true)) return recipe;
    return BEACON_RECIPES.filter(candidate => timeRemaining >= this.requiredTime(candidate, true))
      .sort((a,b) => this.requiredTime(a)-this.requiredTime(b))[0] ?? null;
  }

  interact(key) {
    if (this.mode !== 'playing') return false;
    if (key !== 'ship') return super.interact(key);
    const held = this.heldOrder;
    if (!held) return this.sail();
    if (held.route[held.index] !== 'ship') return this.fail(`#${held.id} still needs ${held.route[held.index]}.`);
    if (this.quay.length >= TENDER_CAPACITY) return this.fail('The quay is full. Send the tender first.');
    this.quay.push(held.id);
    held.location = 'quay';
    this.hand = null;
    this.emit('quayLoaded', {orderId:held.id,count:this.quay.length,station:'ship'});
    return true;
  }

  sail() {
    if (this.mode !== 'playing') return false;
    if (this.tender.phase !== 'docked') return this.fail(`Tender returns in ${Math.ceil(this.tender.remaining+(this.tender.phase==='outbound'?CROSSING_SECONDS:0))}s. Keep machining.`);
    if (!this.quay.length) return this.fail('Load a finished part here, then use the quay again to send it.');
    const window=crossingWindow(this.elapsed);
    if (!window.open) return this.fail(`Swell across the channel. Next crossing window in ${Math.ceil(window.remaining)}s.`);
    if (this.time < CROSSING_SECONDS) return this.fail('Too late for another crossing. The tender needs 12 seconds.');
    this.tender.phase = 'outbound';
    this.tender.remaining = CROSSING_SECONDS;
    this.tender.cargo = this.quay.splice(0);
    this.tender.trips++;
    for (const id of this.tender.cargo) this.order(id).location = 'tender';
    this.emit('tenderDeparted', {count:this.tender.cargo.length,station:'ship'});
    return true;
  }

  deliver() {
    const held = this.hand;
    for (const id of this.tender.cargo) {
      const order = this.order(id);
      if (!order) continue;
      this.hand = {orderId:id};
      // Reuse the same scoring, sourcing, split-clock and event commands as
      // the shop. A cargo part's early-shipping bonus locks at departure.
      if (super.interact('ship') && id !== 201) this.installed.push({id,color:order.color,name:order.name,arrived:this.elapsed});
    }
    this.hand = held;
    this.tender.cargo = [];
    this.tender.phase = 'returning';
    this.tender.remaining = CROSSING_SECONDS;
    this.emit('beaconLit', {installed:this.shipped,lit:this.passed()});
  }

  tick(dt) {
    if (this.mode !== 'playing') return;
    let remaining = Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.1,this.time));
    while (remaining > 1e-8 && this.mode === 'playing') {
      const boat = this.tender;
      const step = Math.min(remaining,boat.phase==='docked'?remaining:boat.remaining);
      if (boat.phase !== 'docked') boat.remaining = Math.max(0,boat.remaining-step);
      // Deadlines continue on the quay; safely aboard, they stop. Refunding
      // exactly this substep leaves the shared expiry loop unchanged.
      for (const id of boat.cargo) { const order=this.order(id); if(order&&id!==201)order.remaining+=step; }
      super.tick(step);
      remaining -= step;
      if (this.mode !== 'playing') break;
      if (boat.phase !== 'docked' && boat.remaining < 1e-8) {
        if (boat.phase === 'outbound') this.deliver();
        else { boat.phase='docked';boat.remaining=0;this.emit('tenderReturned'); }
      }
    }
  }

  // A crossing arriving exactly at closing still counts; an unfinished
  // crossing cannot be credited by the ending animation.
  finish(reason) {
    if (this.tender.phase==='outbound' && this.tender.remaining<1e-8) this.deliver();
    super.finish(reason);
    // Shared finish closes an unfinished sourced job. Do not retain its ID
    // in physical cargo after that source order is no longer addressable.
    this.quay = this.quay.filter(id=>id!==201);
    this.tender.cargo = this.tender.cargo.filter(id=>id!==201);
  }
  canFinishEarly() { return this.tender.phase!=='outbound' && super.canFinishEarly(); }
  expire(id) { this.quay=this.quay.filter(value=>value!==id);super.expire(id); }
  snapshot() { return {...super.snapshot(),quay:[...this.quay],tender:{...this.tender,cargo:[...this.tender.cargo]},window:crossingWindow(this.elapsed),installed:this.installed.map(part=>({...part}))}; }
}
