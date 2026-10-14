import { ShopGame, SHIFTS, OPS, stockType } from './core.js';

// Launch Window (level 5): the shop machines flight hardware beside the pad.
// An order is a kit. Each of its parts starts from its own stock, follows its
// own short machine route and ends at the assembly cell. When every part of a
// kit has arrived, the cell joins them on its own; the assembly is then
// inspected and sent to the pad like any finished order. Kit parts are tracked
// as child entries of this.orders, so stock dispatch, machine loading, swaps,
// the Hold bench and recycling reuse ShopGame's rules unchanged. Only the
// parent (the kit) has a deadline, a slot on the order rail, and a score.
export const ASSEMBLY = {name:'Assembly cell',short:'ASSY',duration:6,color:'#9fe0ff'};
export const LAUNCH_OPS = {...OPS, assemble:ASSEMBLY, ship:{...OPS.ship, name:'Pad transfer', short:'PAD'}};
export const launchOp = key => LAUNCH_OPS[key];
const LETTERS = 'ABC';
export const LAUNCH_LEVEL = SHIFTS.findIndex(level => level.engine === 'launch');

// section names the rocket segment the assembly becomes on the pad.
export const KITS = [
  {name:'Engine strut',section:'strut',value:250,color:0xffb36b,parts:[
    {name:'Strut pin',kind:'shaft',route:['lathe']},
    {name:'Clevis plate',kind:'plate',route:['mill']},
  ]},
  {name:'Valve cluster',section:'valve',value:270,color:0x7fd2ff,parts:[
    {name:'Valve body',kind:'block',route:['mill']},
    {name:'Poppet stem',kind:'shaft',route:['lathe']},
  ]},
  {name:'Turbopump housing',section:'pump',value:330,color:0xff8a78,parts:[
    {name:'Pump housing',kind:'hub',route:['lathe','mill']},
    {name:'Impeller shaft',kind:'shaft',route:['lathe']},
  ]},
  {name:'Avionics deck',section:'avionics',value:350,color:0x8fe38a,parts:[
    {name:'Deck plate',kind:'plate',route:['mill']},
    {name:'Mount bracket',kind:'bracket',route:['mill']},
    {name:'Standoff',kind:'shaft',route:['lathe']},
  ]},
  {name:'Payload adapter',section:'payload',value:420,color:0xf6d365,parts:[
    {name:'Adapter ring',kind:'flange',route:['lathe','mill']},
    {name:'Clamp band',kind:'plate',route:['mill']},
    {name:'Separation bolt',kind:'shaft',route:['lathe']},
  ]},
];

// Seconds a kit needs from arrival, by a deliberately generous estimate: parts
// queue for the same two machines, every part is carried twice, and the
// assembly is carried to Inspection and the pad. Used for the late-arrival cut.
export function kitSeconds(kit) {
  const cutting = kit.parts.reduce((sum, part) => sum + part.route.reduce((s, key) => s + OPS[key].duration, 0), 0);
  const trips = kit.parts.reduce((sum, part) => sum + part.route.length + 1, 0) + 2;
  return cutting * .75 + ASSEMBLY.duration + OPS.inspect.duration + trips * 3.2 + 5;
}

export class LaunchGame extends ShopGame {
  // ShopGame's constructor resets to level 0; LaunchGame only runs launch
  // levels, so any other index opens the first launch level instead.
  reset(shift = LAUNCH_LEVEL) {
    if (SHIFTS[shift]?.engine !== 'launch') shift = LAUNCH_LEVEL;
    this.stack = [];
    this.covariOnPad = null;
    super.reset(shift);
    this.stations.assemble = {part:null,remaining:0,ready:false};
  }

  kits() { return this.orders.filter(order => order.kit); }
  partsOf(kit) { return kit.parts.map(id => this.order(id)).filter(Boolean); }

  spawn() {
    if (this.kits().length >= 4 || this.spawnIndex >= (this.config.maxOrders ?? Infinity)) return false;
    const recipe = this.spawnRecipe(this.time);
    if (!recipe) return false;
    const deadline = this.config.deadline + (this.spawnIndex === 0 ? 14 : 0);
    const kit = {
      id:this.nextId++,kit:true,kitIndex:KITS.indexOf(recipe),name:recipe.name,section:recipe.section,kind:'section',
      value:recipe.value,color:recipe.color,route:['assemble','inspect','ship'],index:0,remaining:deadline,deadline,
      started:false,location:'waiting',programmed:true,programRemaining:0,parts:[],
    };
    this.orders.push(kit);
    recipe.parts.forEach((part, n) => {
      const child = {
        id:kit.id*10+n+1,parentId:kit.id,letter:LETTERS[n],tag:`${kit.id}${LETTERS[n]}`,name:part.name,kind:part.kind,
        color:recipe.color,route:[...part.route,'assemble'],index:0,started:false,location:'material',
        programmed:true,programRemaining:0,value:0,deadline,
      };
      // A part's clock is its kit's clock. Writes are ignored: only the kit expires.
      Object.defineProperty(child, 'remaining', {get:() => kit.remaining,set:() => {},enumerable:true});
      kit.parts.push(child.id);
      this.orders.push(child);
    });
    this.spawnIndex++;
    if (!this.selectedId) this.selectedId = kit.id;
    this.emit('arrival', {orderId:kit.id});
    return true;
  }

  spawnRecipe(timeRemaining) {
    let recipe = KITS[this.config.kits[this.spawnIndex % this.config.kits.length]];
    if (timeRemaining < kitSeconds(recipe) + this.backlogSeconds()) {
      recipe = KITS.filter(candidate => candidate.parts.length === 2 && timeRemaining >= kitSeconds(candidate) + this.backlogSeconds())
        .sort((a, b) => kitSeconds(a) - kitSeconds(b))[0];
    }
    return recipe ?? null;
  }

  // Work already waiting at the assembly cell delays a late kit too.
  backlogSeconds() {
    const cell = this.stations?.assemble;
    return cell?.part ? cell.remaining + 3 : 0;
  }

  nextMaterial(type) {
    return this.orders
      .filter(order => order.parentId && !order.started && stockType(order) === type)
      .sort((a, b) => a.remaining - b.remaining || a.id - b.id)[0];
  }

  // The cell takes parts at any time and assembles one kit at a time.
  completeKits() {
    return this.kits().filter(kit => !kit.started && this.partsOf(kit).length && this.partsOf(kit).every(part => part.location === 'kit'))
      .sort((a, b) => a.remaining - b.remaining || a.id - b.id);
  }

  startAssembly() {
    const cell = this.stations.assemble;
    if (cell.part || this.mode !== 'playing') return false;
    const kit = this.completeKits()[0];
    if (!kit) return false;
    const parts = new Set(kit.parts);
    this.orders = this.orders.filter(order => !parts.has(order.id));
    kit.started = true;
    kit.location = 'assemble';
    cell.part = {orderId:kit.id};
    cell.remaining = ASSEMBLY.duration;
    cell.ready = false;
    this.emit('assembling', {orderId:kit.id,station:'assemble'});
    return true;
  }

  useCell() {
    const cell = this.stations.assemble, held = this.heldOrder;
    if (held && !held.parentId) {
      if (held.id === 201) return this.fail('The Covari part only needs QC and the pad.');
      return this.fail(`#${held.id} is assembled. It needs ${launchOp(held.route[held.index]).name} next.`);
    }
    if (held) {
      const next = held.route[held.index];
      if (next !== 'assemble') return this.fail(`Part ${held.tag} needs the ${launchOp(next).name.toLowerCase()} first.`);
      held.location = 'kit';
      this.hand = null;
      const kit = this.order(held.parentId);
      const waiting = this.partsOf(kit).filter(part => part.location !== 'kit').length;
      this.emit('kitted', {orderId:held.id,kitId:kit.id,station:'assemble',waiting});
      if (cell.ready) this.collectCell();
      this.startAssembly();
      return true;
    }
    if (cell.ready) {
      this.collectCell();
      this.startAssembly();
      return true;
    }
    if (cell.part) return this.fail(`Assembling #${cell.part.orderId}. Ready in ${Math.ceil(cell.remaining)}s.`);
    return this.fail('Bring machined parts here. A kit is assembled as soon as its last part arrives.');
  }

  collectCell() {
    const cell = this.stations.assemble;
    this.hand = cell.part;
    cell.part = null;
    cell.ready = false;
    cell.remaining = 0;
    this.order(this.hand.orderId).location = 'hands';
    this.emit('pickup', {station:'assemble',orderId:this.hand.orderId});
  }

  interact(key) {
    if (this.mode !== 'playing') return false;
    if (key === 'assemble') return this.useCell();
    const held = this.heldOrder;
    if (held && (key === 'material' || key.startsWith('material-')) && held.kit) return this.fail('Assembled flight hardware cannot go back to stock.');
    // ShopGame names the next operation from OPS, which has no assembly cell.
    const next = held?.route[held.index];
    const machine = key === 'ship' || (Object.hasOwn(this.stations, key) && key !== 'assemble');
    if (held && machine && next !== key && !(this.stations[key]?.part && !this.stations[key].ready)) {
      const label = held.parentId ? `Part ${held.tag}` : `#${held.id}`;
      return this.fail(`${label} needs ${next === 'assemble' ? 'the assembly cell' : launchOp(next).name} next.`);
    }
    const shipping = key === 'ship' ? held : null;
    const done = super.interact(key);
    // A shipped kit is stacked onto the rocket; the renderer draws the stack.
    if (done && shipping?.kit) this.stack.push({section:shipping.section,color:shipping.color,name:shipping.name,id:shipping.id});
    if (done && shipping?.id === 201) this.covariOnPad = shipping.technology;
    return done;
  }

  tick(dt) {
    super.tick(dt);
    // A kit completed while the cell was busy starts when the cell is cleared.
    if (this.mode === 'playing') this.startAssembly();
  }

  expire(id) {
    const order = this.order(id);
    if (!order) return;
    // Parts expire with their kit, never on their own.
    if (order.parentId) return this.expire(order.parentId);
    if (order.kit) {
      for (const partId of order.parts) {
        if (!this.order(partId)) continue;
        this.orders = this.orders.filter(candidate => candidate.id !== partId);
        if (this.hand?.orderId === partId) this.hand = null;
        if (this.buffer?.orderId === partId) this.buffer = null;
        for (const station of Object.values(this.stations)) {
          if (station.part?.orderId === partId) { station.part = null; station.ready = false; station.remaining = 0; }
        }
      }
    }
    super.expire(id);
  }

  finish(reason) {
    super.finish(reason);
    this.unfinished = this.kits().length;
  }

  // Liftoff needs the clear target. Below it, the launch director scrubs.
  launchDecision() { return this.passed() ? 'go' : 'scrub'; }

  snapshot() {
    return {...super.snapshot(),stack:[...this.stack],covariOnPad:this.covariOnPad};
  }
}

// One place to create the rules for a level.
export function shiftGame(shift) {
  const game = SHIFTS[shift]?.engine === 'launch' ? new LaunchGame() : new ShopGame();
  game.reset(shift);
  return game;
}
