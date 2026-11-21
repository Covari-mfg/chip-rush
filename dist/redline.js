import { ShopGame, SHIFTS, OPS, stockType } from './core.js';

// Redline · Paddock Works: sunlit Grand Prix machine shop.
// Core shop-management mechanics:
// - Two alloys: 6061 Aluminum (ALU, round bin) and Ti-6Al-4V Titanium (TI, block bin)
// - CNC Lathe and Mill each hold an active alloy setup collar (ALU or TI):
//   * Matching alloy -> 0s setup, climbs Warm-Spindle Flow (1.0x -> 1.38x -> 1.82x),
//     and pays +75 Batch Flow points on shipment.
//   * Mismatched alloy -> 6.0s visible tool changeover, resets spindle flow to 1.0x.
//   * Idle hot spindles cool down back to 1.0x after 12.0s without matching work.
// - One-beat hand-to-machine Ready-Swap keeps hot spindles fed with zero downtime.
// - 10 sculpted Formula race-car components visibly assemble onto the Pit Bay car.
// - Covari outsourcing covers a real floor capability gap (Carbon layup / Wire EDM / Laser marking).

export const REDLINE_LEVEL = 9;
export const CHANGEOVER_SECONDS = 6.0;
export const WARM_HOLD_SECONDS = 12.0;
export const BATCH_BONUS = 75;
export const HOT_BONUS = 120;
export const TI_CUT_MULTIPLIER = 1.22;

export const REDLINE_ALLOYS = {
  alu: { id: 'alu', code: 'ALU', name: '6061 Aluminum', stock: 'round', kind: 'shaft', cutMul: 1.0, color: 0x62e5cf, hex: '#62e5cf' },
  ti:  { id: 'ti',  code: 'TI',  name: 'Ti-6Al-4V Titanium', stock: 'block', kind: 'block', cutMul: TI_CUT_MULTIPLIER, color: 0xf4bd58, hex: '#f4bd58' },
};

export const REDLINE_OPS = {
  lathe:   { name: 'Lathe',   duration: 8.2 },
  mill:    { name: 'Mill',    duration: 9.2 },
  deburr:  { name: 'Deburr',  duration: 4.2 },
  inspect: { name: 'Inspect', duration: 4.2 },
  ship:    { name: 'Pit Bay', duration: 0 },
};

export const REDLINE_SOURCE_JOBS = [
  { name: 'Carbon-Ti wing endplates', capability: 'Carbon fiber layup', technology: 'cf', gap: 'No carbon autoclave on this floor' },
  { name: 'Wire-EDM dog-ring gear',   capability: 'Wire EDM',           technology: 'edm', gap: 'No wire EDM on this floor' },
  { name: 'FIA chassis plaque',       capability: 'Laser marking',      technology: 'lm', gap: 'No laser marker on this floor' },
];

// 10 Formula race-car components ordered to create genuine alloy-batching
// dilemmas: naive FIFO play bounces between ALU and TI (eating 6.0s changeovers),
// while smart ticket selection + Hold Bench staging keeps both spindles at 1.82x!
export const REDLINE_RECIPES = [
  { name: 'Brake calipers',   alloy: 'alu', kind: 'shaft', slot: 'brakes',    route: ['lathe', 'inspect'],                   value: 175, color: 0x62e5cf },
  { name: 'Gearbox casing',   alloy: 'ti',  kind: 'block', slot: 'gearbox',   route: ['mill', 'inspect'],                    value: 205, color: 0xf4bd58 },
  { name: 'Drive shafts',     alloy: 'ti',  kind: 'block', slot: 'rearSusp',  route: ['lathe', 'inspect'],                   value: 225, color: 0xf4bd58 },
  { name: 'Front uprights',   alloy: 'alu', kind: 'shaft', slot: 'frontSusp', route: ['lathe', 'deburr', 'inspect'],         value: 230, color: 0x62e5cf },
  { name: 'Front aero wing',  alloy: 'ti',  kind: 'block', slot: 'frontWing', route: ['mill', 'deburr', 'inspect'],          value: 255, color: 0xf4bd58, hot: true },
  { name: 'Floor diffuser',   alloy: 'alu', kind: 'shaft', slot: 'sidepods',  route: ['mill', 'deburr', 'inspect'],          value: 240, color: 0x62e5cf },
  { name: 'DRS rear wing',    alloy: 'ti',  kind: 'block', slot: 'rearWing',  route: ['mill', 'inspect'],                    value: 235, color: 0xf4bd58 },
  { name: 'Centerlock hubs',  alloy: 'alu', kind: 'shaft', slot: 'wheels',    route: ['lathe', 'mill', 'inspect'],           value: 275, color: 0x62e5cf },
  { name: 'Titanium header',  alloy: 'ti',  kind: 'block', slot: 'exhaust',   route: ['lathe', 'deburr', 'inspect'],         value: 265, color: 0xf4bd58, hot: true },
  { name: 'Billet aero halo', alloy: 'alu', kind: 'shaft', slot: 'halo',      route: ['lathe', 'mill', 'deburr', 'inspect'], value: 320, color: 0x62e5cf },
];

export const isCncOp = key => key === 'lathe' || key === 'mill';

export function flowMultiplier(streak) {
  if (streak >= 3) return 1.82;
  if (streak === 2) return 1.38;
  return 1.0;
}

export function redlineOp(key) {
  return REDLINE_OPS[key] ?? OPS[key];
}

export class RedlineGame extends ShopGame {
  reset(shift = REDLINE_LEVEL) {
    if (SHIFTS[shift]?.engine !== 'redline') shift = REDLINE_LEVEL;
    this.fitted = [];
    this.covariFitted = false;
    this.stats = { batchHits: 0, changeovers: 0, peakFlow: 1.0, swaps: 0, hotShipped: 0 };
    super.reset(shift);
    this.scoreDetails = { base: 0, speed: 0, batch: 0, hot: 0, streak: 0, sourcing: 0 };

    // Initialize CNC spindle setups: Lathe starts on ALU, Mill starts on TI.
    this.stations.lathe = { ...this.stations.lathe, setup: 'alu', streak: 1, warmRemaining: 0, changingOver: false };
    this.stations.mill  = { ...this.stations.mill,  setup: 'ti',  streak: 1, warmRemaining: 0, changingOver: false };

    // Open with THREE orders immediately (ALU Lathe + TI Mill + TI Lathe trap) so
    // parallel batching decisions begin on second 0. Clear opening arrival events
    // so clock-in never stacks triple arrival chimes.
    this.spawn();
    this.spawn();
    this.events = [];
    this.nextArrival = this.config.firstArrival ?? 9;
  }

  cutDuration(op, alloy, streak = 1) {
    const base = (REDLINE_OPS[op]?.duration ?? OPS[op]?.duration ?? 6);
    if (!isCncOp(op)) return base;
    const alloyMul = REDLINE_ALLOYS[alloy]?.cutMul ?? 1.0;
    return (base * alloyMul) / flowMultiplier(streak);
  }

  requiredTime(recipe) {
    const alloy = recipe.alloy ?? 'alu';
    let total = 5; // walk + Pit Bay handling margin
    for (const op of recipe.route) {
      if (op === 'ship') continue;
      total += this.cutDuration(op, alloy, 1) * (isCncOp(op) ? 0.72 : 1.0);
    }
    return total;
  }

  spawnRecipe(timeRemaining) {
    if (this.spawnIndex >= (this.config.maxOrders ?? REDLINE_RECIPES.length)) return null;
    const recipe = REDLINE_RECIPES[this.spawnIndex % REDLINE_RECIPES.length];
    if (timeRemaining >= this.requiredTime(recipe)) return recipe;
    return null;
  }

  spawn() {
    if (this.orders.length >= 4) return false;
    const recipe = this.spawnRecipe(this.time);
    if (!recipe) return false;
    const opening = this.spawnIndex < 2;
    const complexExtra = recipe.route.length >= 4 ? 12 : recipe.route.length >= 3 ? 4 : 0;
    const deadline = recipe.hot ? Math.max(58, this.config.deadline - 14) : (this.config.deadline + (opening ? 10 : 0) + complexExtra);
    const order = {
      id: this.nextId++,
      name: recipe.name,
      kind: recipe.kind,
      alloy: recipe.alloy,
      slot: recipe.slot,
      hot: Boolean(recipe.hot),
      value: recipe.value,
      color: recipe.color,
      route: [...recipe.route, 'ship'],
      index: 0,
      deadline,
      remaining: deadline,
      location: 'material',
      started: false,
      programmed: true,
      programRemaining: 0,
      zeroSetups: 0,
      changeovers: 0,
      arrivedAt: this.elapsed,
    };
    this.orders.push(order);
    this.spawnIndex++;
    if (!this.selectedId) this.selectedId = order.id;
    this.emit('arrival', { orderId: order.id, name: order.name, route: [...order.route], alloy: order.alloy, hot: order.hot });
    return true;
  }

  // Selection-aware stock bin lookup: if the player clicked/pressed 1-4 on an
  // unstarted order matching this bin's alloy, pull THAT order so they can
  // deliberately batch alloys ahead of mismatched older tickets!
  nextMaterial(type) {
    const selected = this.orders.find(o => o.id === this.selectedId && !o.started && o.location === 'material' && stockType(o) === type);
    if (selected) return selected;
    return this.orders
      .filter(o => !o.started && o.location === 'material' && stockType(o) === type)
      .sort((a, b) => a.remaining - b.remaining || a.id - b.id)[0] ?? null;
  }

  selectOrder(id) {
    const o = this.orders.find(x => x.id === id);
    if (!o) return false;
    this.selectedId = o.id;
    this.emit('select', { orderId: o.id });
    return true;
  }

  loadIntoStation(key, order) {
    const st = this.stations[key];
    st.part = { orderId: order.id };
    st.ready = false;
    order.location = key;

    if (isCncOp(key)) {
      if (st.setup === order.alloy) {
        // ZERO-SETUP BATCH MATCH!
        st.streak = Math.min(3, st.streak + 1);
        st.warmRemaining = 0;
        st.changingOver = false;
        order.zeroSetups = (order.zeroSetups || 0) + 1;
        this.stats.batchHits++;
        this.stats.peakFlow = Math.max(this.stats.peakFlow, flowMultiplier(st.streak));
        const dur = this.cutDuration(key, order.alloy, st.streak);
        st.duration = dur;
        st.remaining = dur;
        this.emit('redlineFlow', { station: key, orderId: order.id, alloy: order.alloy, streak: st.streak, multiplier: flowMultiplier(st.streak) });
      } else {
        // MISMATCHED ALLOY -> 6.0s TOOL CHANGEOVER!
        st.setup = order.alloy;
        st.streak = 1;
        st.warmRemaining = 0;
        st.changingOver = true;
        order.changeovers = (order.changeovers || 0) + 1;
        this.stats.changeovers++;
        st.duration = CHANGEOVER_SECONDS;
        st.remaining = CHANGEOVER_SECONDS;
        this.emit('changeover', { station: key, orderId: order.id, alloy: order.alloy });
      }
    } else {
      const dur = this.cutDuration(key, order.alloy, 1);
      st.duration = dur;
      st.remaining = dur;
      st.changingOver = false;
      this.emit('load', { station: key, orderId: order.id });
    }
  }

  interact(key) {
    if (this.mode !== 'playing') return false;

    // Stock bin recycling: never allow restarting a job to farm +75 Batch Flow points.
    if (key.startsWith('material-') && this.hand) {
      const held = this.heldOrder;
      const ok = super.interact(key);
      if (ok && held && held.id !== 201) {
        held.zeroSetups = 0;
        held.changeovers = 0;
      }
      return ok;
    }

    // Shipping at the Pit Bay: fit finished part onto the Formula race car!
    // Defer work-complete finish to tick() so tickSourcing() can still offer Covari
    // and syncParts() cleanly clears the carried mesh before the finale starts.
    if (key === 'ship') {
      const held = this.heldOrder;
      if (!held) return this.fail('Bring an inspected part to fit onto the car.');
      if (held.route[held.index] !== 'ship') return this.fail(`#${held.id} still needs ${redlineOp(held.route[held.index]).name}.`);

      if (held.id === 201) {
        // Covari capability-gap job: exact 300 pts, zero shipment/star/streak credit
        this.hand = null;
        this.sourced = 1;
        this.sourcePoints = 300;
        this.score += 300;
        this.scoreDetails.sourcing += 300;
        this.sourcing.state = 'fulfilled';
        this.sourcing.started = false;
        this.sourcing.location = 'shipped';
        this.covariFitted = true;
        this.emit('sourceFulfilled', { orderId: 201, points: 300, station: 'ship' });
        return true;
      }

      // Normal car component fitted onto the Formula car!
      this.hand = null;
      this.orders = this.orders.filter(o => o.id !== held.id);
      if (this.selectedId === held.id) this.selectedId = this.orders[0]?.id ?? null;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.shipped++;
      if (this.shipped === this.config.passTarget) this.clearElapsed = this.elapsed;

      const base = held.value;
      const speed = Math.round(Math.max(0, held.remaining) * 2.5);
      const maxBatchOps = held.route.filter(isCncOp).length;
      const batch = Math.min(held.zeroSetups || 0, maxBatchOps) * BATCH_BONUS;
      const hot = held.hot ? HOT_BONUS : 0;
      const mult = 1 + (Math.max(1, Math.min(5, this.combo)) - 1) * 0.12;
      const streak = Math.round((base + speed) * mult) - (base + speed);
      const points = base + speed + batch + hot + streak;

      this.scoreDetails.base += base;
      this.scoreDetails.speed += speed;
      this.scoreDetails.batch += batch;
      this.scoreDetails.hot += hot;
      this.scoreDetails.streak += streak;
      this.score += points;
      if (held.hot) this.stats.hotShipped++;

      this.fitted.push({
        id: held.id,
        name: held.name,
        slot: held.slot,
        alloy: held.alloy,
        hot: held.hot,
        at: this.elapsed,
        points,
        zeroSetups: Math.min(held.zeroSetups || 0, maxBatchOps),
        changeovers: held.changeovers || 0,
      });
      this.emit('shipped', { orderId: held.id, points, combo: Math.min(5, this.combo), slot: held.slot, batch, hot, fittedCount: this.fitted.length, station: 'ship' });
      return true;
    }

    // CNC / Deburr / Inspect interaction with alloy setup + 1-beat Ready-Swap!
    if (this.stations[key] && key !== 'ship') {
      if (!this.config.unlocks.includes(key)) return this.fail(`${redlineOp(key)?.name ?? key} is not on this floor.`);
      const st = this.stations[key];
      const held = this.heldOrder;

      // Case 1: Machine is READY (order.index was already advanced when ready triggered!)
      if (st.part && st.ready) {
        const finished = this.order(st.part.orderId);
        // One-beat Ready-Swap: if player holds a part whose next op IS this station!
        if (held && held.route[held.index] === key) {
          this.hand = { orderId: finished.id };
          finished.location = 'hands';
          this.stats.swaps++;
          this.loadIntoStation(key, held);
          this.emit('pickup', { orderId: finished.id, station: key, swapped: true });
          return true;
        }
        if (this.hand) return this.fail('Hands full. Park on the Hold bench or swap a part for this machine.');
        st.part = null;
        st.ready = false;
        st.remaining = 0;
        st.duration = 0;
        if (isCncOp(key) && st.streak > 1) st.warmRemaining = WARM_HOLD_SECONDS;
        this.hand = { orderId: finished.id };
        finished.location = 'hands';
        this.emit('pickup', { orderId: finished.id, station: key });
        return true;
      }

      // Case 2: Machine is busy
      if (st.part) {
        return this.fail(st.changingOver
          ? `${redlineOp(key).name} tool changeover (${Math.ceil(st.remaining)}s)`
          : `${redlineOp(key).name} cutting (${Math.ceil(st.remaining)}s)`);
      }

      // Case 3: Machine is empty — load held part if it belongs here
      if (!held) return this.fail(`Bring a part that needs ${redlineOp(key).name}.`);
      if (held.route[held.index] !== key) return this.fail(`#${held.id} needs ${redlineOp(held.route[held.index]).name} next.`);
      this.hand = null;
      this.loadIntoStation(key, held);
      return true;
    }

    // Stock bins, Hold Bench, Receiving fall through cleanly to ShopGame!
    return super.interact(key);
  }

  tick(dt) {
    if (this.mode !== 'playing') return;
    dt = Math.min(Math.max(0, Number.isFinite(dt) ? dt : 0), 0.1, this.time);
    if (dt <= 0) return;

    this.elapsed += dt;
    this.time = Math.max(0, this.config.duration - this.elapsed);

    // Scheduled arrivals
    if (this.elapsed >= this.nextArrival) {
      if (this.orders.length < 4 && this.spawn()) {
        this.nextArrival = this.elapsed + (this.config.interval ?? 11);
      } else if (this.orders.length < 4) {
        this.nextArrival = Infinity;
      }
    }

    // Tick stations (handling CNC changeover -> cutting transition + ready index advance + warm-hold decay)
    for (const [key, st] of Object.entries(this.stations)) {
      if (st.part && !st.ready) {
        st.remaining = Math.max(0, st.remaining - dt);
        if (st.remaining <= 1e-8) {
          if (st.changingOver) {
            const o = this.order(st.part.orderId);
            st.changingOver = false;
            const dur = o ? this.cutDuration(key, o.alloy, st.streak) : (REDLINE_OPS[key]?.duration ?? 8);
            st.duration = dur;
            st.remaining = dur;
            this.emit('load', { station: key, orderId: st.part.orderId });
          } else {
            st.ready = true;
            st.remaining = 0;
            const o = this.order(st.part.orderId);
            if (o) o.index++;
            this.emit('ready', { station: key, orderId: st.part.orderId });
          }
        }
      } else if (!st.part && isCncOp(key) && st.streak > 1) {
        st.warmRemaining = Math.max(0, st.warmRemaining - dt);
        if (st.warmRemaining <= 1e-8) {
          st.streak = 1;
          st.warmRemaining = 0;
          this.emit('spindleCooled', { station: key });
        }
      }
    }

    // Covari sourcing offer & delivery countdown (reuses ShopGame's exact shared rules!)
    this.tickSourcing(dt);

    // Order deadlines
    const expired = [];
    for (const o of this.orders) {
      o.remaining = Math.max(0, o.remaining - dt);
      if (o.remaining <= 1e-8) expired.push(o.id);
    }
    for (const id of expired) this.expire(id);

    // Check closing bell or early work-complete
    if (this.time <= 1e-8) {
      this.unfinished = this.orders.length;
      this.finish('time-up');
    } else if (this.workResolved()) {
      this.unfinished = 0;
      this.finish('work-complete');
    }
  }

  workResolved() {
    if (this.orders.length > 0) return false;
    if (this.sourcing && !['declined', 'fulfilled'].includes(this.sourcing.state)) return false;
    return !this.hasEligibleFutureArrival();
  }

  hasEligibleFutureArrival() {
    if (this.spawnIndex >= (this.config.maxOrders ?? REDLINE_RECIPES.length)) return false;
    const at = Math.max(this.elapsed, this.nextArrival);
    return Boolean(this.spawnRecipe(this.config.duration - at));
  }

  expire(id) {
    const hadStation = Object.entries(this.stations).find(([, st]) => st.part?.orderId === id);
    if (hadStation) {
      hadStation[1].changingOver = false;
      hadStation[1].duration = 0;
      if (isCncOp(hadStation[0]) && hadStation[1].streak > 1) {
        hadStation[1].warmRemaining = WARM_HOLD_SECONDS;
      }
    }
    super.expire(id);
  }

  snapshot() {
    return {
      ...super.snapshot(),
      fitted: this.fitted.map(f => ({ ...f })),
      covariFitted: this.covariFitted,
      stats: { ...this.stats },
      spindles: {
        lathe: { setup: this.stations.lathe.setup, streak: this.stations.lathe.streak, warmRemaining: this.stations.lathe.warmRemaining, changingOver: this.stations.lathe.changingOver },
        mill:  { setup: this.stations.mill.setup,  streak: this.stations.mill.streak,  warmRemaining: this.stations.mill.warmRemaining,  changingOver: this.stations.mill.changingOver },
      },
    };
  }
}
