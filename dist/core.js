export const RULESET = 'roles-v5-performance';
// Complexity and speed earn points on delivery. CAM is only paid when its
// part ships, so restarting or reprogramming a job cannot farm points.
export function scoreShipment(order, combo, {programming=false,rushBonus=0}={}) {
  const base=order.value;
  const program=programming ? 60 : 0;
  const speed=Math.round(Math.max(0,order.remaining)*4);
  const subtotal=base+program+speed;
  const multiplier=1+(Math.max(1,Math.min(5,combo))-1)*.15;
  const streak=Math.round(subtotal*multiplier)-subtotal;
  return {base,program,speed,streak,rush:rushBonus,total:subtotal+streak+rushBonus};
}
export const OPS = {
  lathe:{name:'Lathe',short:'TURN',duration:8,color:'#7cdeca'},
  mill:{name:'Mill',short:'MILL',duration:10,color:'#8dc9f1'},
  deburr:{name:'Deburr',short:'EDGE',duration:4,color:'#ffbf7d'},
  anodize:{name:'Anodize',short:'DIP',duration:8,color:'#c3a0ed'},
  inspect:{name:'Inspect',short:'QC',duration:4,color:'#ffd670'},
  ship:{name:'Shipping',short:'SHIP',duration:0,color:'#85ddaa'},
};
export const RECIPES = [
  {name:'Pocket spacer',kind:'shaft',route:['lathe','inspect'],value:120,color:0x79d9cb},
  {name:'Mounting plate',kind:'plate',route:['mill','inspect'],value:140,color:0x8acaf0},
  {name:'Dial knob',kind:'shaft',route:['lathe','deburr','inspect'],value:180,color:0xffc477},
  {name:'Valve body',kind:'block',route:['lathe','mill','deburr','inspect'],value:250,color:0xffab8c},
  {name:'Satin bracket',kind:'bracket',route:['mill','deburr','anodize','inspect'],value:270,color:0xc2a0f2},
  {name:'Ocean collar',kind:'shaft',route:['lathe','anodize','inspect'],value:220,color:0x65d3ec},
  {name:'Bearing housing',kind:'block',route:['lathe','mill','inspect'],value:230,color:0xffab8c},
];
// Clearing a role is the introduction; its third star is the mastery target.
// Owner supplies enough work for ten shipments, but keeps the same six-order
// promotion floor and deterministic recipe sequence. A little deadline slack
// leaves room to recover; the three-star challenge is sustained throughput.
export const SHIFTS = [
  {name:'Operator',subtitle:'Run the machines. Find your rhythm.',brief:'Collect stock, follow each route, and ship 3 orders to earn your promotion.',duration:150,interval:21,deadline:82,recipes:[0,1,0,1,0,1,0,1],unlocks:['lathe','mill','inspect'],programming:false,calls:false,passTarget:3,stars:[3,4,5]},
  {name:'Production Manager',subtitle:'Program the work. Keep it moving.',brief:'Spend 4 seconds programming each order at the office, then ship 4 orders.',duration:180,interval:23,deadline:105,recipes:[0,1,0,1,6,0,6,1],unlocks:['lathe','mill','inspect'],programming:true,calls:false,passTarget:4,stars:[4,6,7]},
  {name:'Owner',subtitle:'Keep your promises. Choose your rushes.',brief:'Ship 6 orders to clear. Ten shipments earns the exceptional three-star Owner shift.',duration:180,interval:15,deadline:105,recipes:[0,1,0,6,1,1,6,0,1],unlocks:['lathe','mill','inspect'],programming:true,calls:true,passTarget:6,stars:[6,8,10]},
];

const PROGRAM_DURATION = 4;
const CALL_INVITATION_DURATION = 22;
const CALL_ANSWER_DURATION = 3;
const RUSH_WINDOW = 45;
const RUSH_BONUS = 100;
// Calls are part of the Owner workload, even when the shop has no spare rush
// capacity. Fixed spacing makes retries learnable and prevents lucky quiet runs.
const OWNER_CALL_TIMES = [27, 77, 127];
const CALL_RECOVERY_TIME = 10;

export class ShopGame {
  constructor() {
    this.reset(0);
    this.mode = 'menu';
  }

  reset(shift = 0) {
    this.shiftIndex = shift;
    this.config = SHIFTS[shift];
    this.time = this.config.duration;
    this.elapsed = 0;
    this.orders = [];
    this.selectedId = null;
    this.hand = null;
    this.buffer = null;
    this.stations = Object.fromEntries(Object.keys(OPS).filter(key => key !== 'ship').map(key => [key, {part:null,remaining:0,ready:false}]));
    this.office = {present:false,orderId:null};
    this.call = null;
    this.callIndex = 0;
    this.nextCallAt = this.config.calls ? OWNER_CALL_TIMES[0] : Infinity;
    this.lastCallEndedAt = -Infinity;
    this.callsReceived = 0;
    this.callsAnswered = 0;
    this.rushesAccepted = 0;
    this.rushesWon = 0;
    this.nextId = 101;
    this.spawnIndex = 0;
    this.nextArrival = 12;
    this.sourcing = null;
    this.sourceOffered = false;
    this.sourced = 0;
    this.sourcePoints = 0;
    this.score = 0;
    this.scoreDetails = {base:0,program:0,speed:0,streak:0,rush:0,calls:0,sourcing:0};
    this.shipped = 0;
    this.missed = 0;
    this.unfinished = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.events = [];
    this.mode = 'playing';
    this.spawn();
  }

  emit(type, data = {}) { this.events.push({type,...data}); }
  drain() { const events = this.events; this.events = []; return events; }
  order(id) { return this.orders.find(order => order.id === id); }
  get selected() { return this.order(this.selectedId); }
  get heldOrder() { return this.hand ? this.order(this.hand.orderId) : null; }

  // Allow stock collection before programming. The program belongs to the order,
  // independently of its physical part, and survives recycling that part.
  setOfficePresence(present) { this.office.present = Boolean(present); }

  requiredTime(recipe, includeMachineWait = false) {
    const route = recipe.route.filter(key => key !== 'ship');
    const processing = route.reduce((seconds, key) => seconds + OPS[key].duration, 0);
    const travel = (route.length + 2) * 3.5 + 5;
    const programming = this.config.programming && !recipe.programmed
      ? (recipe.programRemaining ?? PROGRAM_DURATION) + 3.5
      : 0;
    // A completed output still blocks its machine. Include time to collect it,
    // as well as outstanding cutting time, instead of treating it as available.
    const waits = includeMachineWait ? route.reduce((seconds, key) => {
      const station = this.stations[key];
      return seconds + (station.part ? station.remaining + 4 : 0);
    }, 0) : 0;
    return processing + travel + programming + waits;
  }

  spawn() {
    if (this.orders.length >= 4) return false;
    let recipe = RECIPES[this.config.recipes[this.spawnIndex % this.config.recipes.length]];
    if (this.time < this.requiredTime(recipe, true)) {
      recipe = [RECIPES[0], RECIPES[1]]
        .filter(candidate => this.time >= this.requiredTime(candidate, true))
        .sort((a, b) => this.requiredTime(a, true) - this.requiredTime(b, true))[0];
      if (!recipe) return false;
    }
    const deadline = this.config.deadline + (this.spawnIndex === 0 ? 14 : 0);
    const order = {
      id:this.nextId++,...recipe,route:[...recipe.route,'ship'],index:0,
      remaining:deadline,deadline,started:false,location:'material',
      programmed:!this.config.programming,
      programRemaining:this.config.programming ? PROGRAM_DURATION : 0,
    };
    this.orders.push(order);
    this.spawnIndex++;
    if (!this.selectedId) this.selectedId = order.id;
    this.emit('arrival', {orderId:order.id});
    return true;
  }

  maybeCall() {
    if (!this.config.calls || this.call || this.elapsed < this.nextCallAt ||
        this.elapsed < this.lastCallEndedAt + CALL_RECOVERY_TIME || this.time <= 25) return;
    // The newest live order is the customer asking to jump the queue. Do not
    // interrupt for an order that would expire before a complete conversation.
    const order = this.orders.findLast(candidate => candidate.remaining > CALL_INVITATION_DURATION + CALL_ANSWER_DURATION);
    if (!order) return;
    this.call = {
      orderId:order.id,state:'ringing',ringRemaining:CALL_INVITATION_DURATION,answerRemaining:0,
      remaining:RUSH_WINDOW,window:RUSH_WINDOW,bonus:RUSH_BONUS,rushAvailable:this.canRush(order),
    };
    this.callIndex++;
    this.nextCallAt = OWNER_CALL_TIMES[this.callIndex] ?? Infinity;
    this.callsReceived++;
    this.emit('call', {orderId:order.id,window:RUSH_WINDOW,bonus:RUSH_BONUS,number:this.callsReceived});
  }

  clearCall() {
    this.call = null;
    this.lastCallEndedAt = this.elapsed;
  }

  canRush(order) {
    if (!order || order.started || order.route.length !== 3) return false;
    if (this.time < RUSH_WINDOW + 4 || order.remaining < RUSH_WINDOW + 4) return false;
    if (this.requiredTime(order, true) > RUSH_WINDOW) return false;
    // A bonus should not demand abandoning an older order about to expire.
    return this.orders.every(other => other.id === order.id || other.remaining >= RUSH_WINDOW + 8);
  }

  respondCall(accept) {
    if (this.mode !== 'playing' || !this.office.present || this.call?.state !== 'offer') return false;
    const call = this.call;
    if (!accept) {
      this.clearCall();
      this.emit('callDeclined', {orderId:call.orderId});
      return true;
    }
    if (!this.canRush(this.order(call.orderId))) {
      this.clearCall();
      return this.fail('That rush window has closed. The regular order is still good.');
    }
    call.state = 'active';
    call.remaining = call.window;
    // Accepting changes the shop's priority. Keep the interrupted job's saved
    // programming progress, but wait for an explicit target before resuming.
    this.office.orderId = null;
    this.rushesAccepted++;
    this.emit('rushAccepted', {orderId:call.orderId,window:call.window,bonus:call.bonus});
    return true;
  }

  requestSource() {
    if(this.mode !== 'playing' || this.sourcing?.state !== 'offer') return false;
    if(this.call && this.call.state !== 'active') return this.fail('Answer the customer call before placing this job.');
    if(!this.office.present) return this.fail('Go to the office to source this job with Covari.');
    this.office.orderId = null;
    this.sourcing.state = 'approving';
    this.emit('sourceApproving');
    return true;
  }

  declineSource() {
    if(this.mode !== 'playing' || this.sourcing?.state !== 'offer') return false;
    this.sourcing.state = 'declined';
    this.emit('sourceDeclined');
    return true;
  }

  tickSourcing(dt, phoneInterrupting) {
    if(!this.sourceOffered && this.elapsed >= 35) {
      this.sourceOffered = true;
      this.sourcing = {id:'C-201',name:'Wire EDM insert',capability:'Wire EDM',state:'offer',offerRemaining:30,approvalRemaining:2,remaining:22,points:60};
      this.emit('sourceOffer');
    }
    const job=this.sourcing;
    if(!job)return;
    if(job.state === 'offer') {
      job.offerRemaining = Math.max(0,job.offerRemaining-dt);
      if(job.offerRemaining<=0)job.state='declined';
    } else if(job.state === 'approving' && this.office.present && !phoneInterrupting) {
      job.approvalRemaining = Math.max(0,job.approvalRemaining-dt);
      if(job.approvalRemaining<=0){job.state='sourcing';this.emit('sourcePlaced');}
    } else if(job.state === 'sourcing') {
      job.remaining = Math.max(0,job.remaining-dt);
      if(job.remaining<=0){job.state='delivered';this.score+=job.points;this.sourcePoints+=job.points;this.scoreDetails.sourcing+=job.points;this.sourced++;this.emit('sourceDelivered',{points:job.points});}
    }
  }

  select(id) {
    if (this.order(id)) {
      this.selectedId = id;
      this.emit('select', {orderId:id});
    }
  }

  cycle() {
    if (!this.orders.length) return;
    const index = this.orders.findIndex(order => order.id === this.selectedId);
    this.select(this.orders[(index + 1) % this.orders.length].id);
  }

  tick(dt) {
    if (this.mode !== 'playing') return;
    dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .1, this.time));
    this.time = Math.max(0, this.time - dt);
    this.elapsed += dt;

    const phoneInterrupting = this.call && this.call.state !== 'active';
    if (!phoneInterrupting && this.sourcing?.state !== 'approving' && this.office.present && this.office.orderId !== null) {
      const order = this.order(this.office.orderId);
      if (!order || order.programmed) this.office.orderId = null;
      else {
        order.programRemaining = Math.max(0, order.programRemaining - dt);
        if (order.programRemaining <= 0) {
          order.programmed = true;
          this.office.orderId = null;
          this.emit('programmed', {orderId:order.id});
        }
      }
    }

    for (const [key, station] of Object.entries(this.stations)) {
      if (station.part && !station.ready) {
        station.remaining = Math.max(0, station.remaining - dt);
        if (station.remaining <= 0) {
          station.ready = true;
          const order = this.order(station.part.orderId);
          if (order) {
            order.index++;
            order.location = key;
            this.emit('ready', {station:key,orderId:order.id});
          }
        }
      }
    }

    for (const order of [...this.orders]) {
      order.remaining -= dt;
      if (order.remaining <= 0) this.expire(order.id);
    }

    if (this.call) {
      if (this.call.state === 'active') {
        this.call.remaining = Math.max(0, this.call.remaining - dt);
        if (this.call.remaining <= 0) {
          const orderId = this.call.orderId;
          this.clearCall();
          this.emit('rushExpired', {orderId,reason:'timeout'});
        }
      } else if (this.call.state === 'answering') {
        // Once answered, the conversation runs to completion. The UI keeps the
        // machinist at the desk; only pausing the whole game pauses this timer.
        this.call.answerRemaining = Math.max(0, this.call.answerRemaining - dt);
        if (this.call.answerRemaining <= 0) {
          this.call.state = 'offer';
          this.callsAnswered++;
          this.score+=25;
          this.scoreDetails.calls+=25;
          this.emit('callAnswered', {orderId:this.call.orderId,window:this.call.window,bonus:this.call.bonus,points:25});
        }
      } else {
        this.call.ringRemaining = Math.max(0, this.call.ringRemaining - dt);
        if (this.call.ringRemaining <= 0) this.clearCall();
      }
      if (this.call && this.call.state !== 'active') this.call.rushAvailable = this.canRush(this.order(this.call.orderId));
    }

    if (this.elapsed >= this.nextArrival && this.time > 0) {
      this.nextArrival = this.elapsed + (this.spawn() ? this.config.interval : 2);
    }
    this.maybeCall();
    this.tickSourcing(dt, phoneInterrupting);
    if (this.time <= 0) {
      this.unfinished = this.orders.length;
      this.office.orderId = null;
      this.clearCall();
      this.mode = 'results';
      this.emit('finish');
    }
  }

  expire(id) {
    const order = this.order(id);
    if (!order) return;
    this.orders = this.orders.filter(candidate => candidate.id !== id);
    if (this.hand?.orderId === id) this.hand = null;
    if (this.buffer?.orderId === id) this.buffer = null;
    for (const station of Object.values(this.stations)) {
      if (station.part?.orderId === id) {
        station.part = null;
        station.ready = false;
        station.remaining = 0;
      }
    }
    if (this.office.orderId === id) this.office.orderId = null;
    if (this.call?.orderId === id) {
      if (this.call.state === 'active') this.emit('rushExpired', {orderId:id,reason:'orderExpired'});
      this.clearCall();
    }
    this.missed++;
    this.combo = 0;
    if (this.selectedId === id) this.selectedId = this.orders[0]?.id ?? null;
    this.emit('expired', {orderId:id});
  }

  interact(key) {
    if (this.mode !== 'playing') return false;
    if (this.call?.state === 'answering') return this.fail('Stay on the phone. The customer is explaining the rush request.');
    if (this.call?.state === 'offer') return this.fail('Accept or decline the customer’s rush request before returning to work.');
    if (this.call?.state === 'ringing' && key !== 'office' && key !== 'phone') {
      return this.fail('The customer is calling. Answer the phone at the office first.');
    }
    if (key === 'source') return this.requestSource();
    if (key === 'office') {
      if (this.call?.state === 'ringing') return this.interact('phone');
      if (!this.office.present) return this.fail('Walk to the office to program this job.');
      if (this.sourcing?.state === 'approving') return true;
      if (!this.config.programming) return this.fail('Your jobs are already programmed for this shift.');
      const order = this.selected;
      if (!order) return this.fail('Select an order to program.');
      if (order.programmed) return this.fail(`#${order.id} is already programmed.`);
      this.office.orderId = order.id;
      this.emit('programming', {orderId:order.id,remaining:order.programRemaining});
      return true;
    }
    if (key === 'phone') {
      if (!this.office.present) return this.fail('Answer the phone at the office.');
      if (this.call?.state !== 'ringing') return this.fail('No new customer call right now.');
      this.call.state = 'answering';
      this.call.answerRemaining = CALL_ANSWER_DURATION;
      this.emit('callAnswering', {orderId:this.call.orderId,duration:CALL_ANSWER_DURATION});
      return true;
    }
    if (key === 'material') {
      if (this.hand) {
        const returned = this.heldOrder;
        returned.started = false;
        returned.index = 0;
        returned.location = 'material';
        this.hand = null;
        this.selectedId = returned.id;
        this.emit('recycle', {orderId:returned.id});
        return true;
      }
      const order = this.selected;
      if (!order) return this.fail('No orders yet. Take a breath.');
      if (order.started) return this.fail(`#${order.id} is already on the floor. Select a new ticket.`);
      this.hand = {orderId:order.id};
      order.started = true;
      order.location = 'hands';
      this.emit('pickup', {station:key,orderId:order.id});
      return true;
    }
    if (key === 'buffer') {
      if (this.hand && this.buffer) return this.fail('Hold bench is occupied. Collect its part first.');
      if (this.hand) {
        this.buffer = this.hand;
        this.hand = null;
        this.order(this.buffer.orderId).location = 'buffer';
        this.emit('park', {station:key});
        return true;
      }
      if (this.buffer) {
        this.hand = this.buffer;
        this.buffer = null;
        this.order(this.hand.orderId).location = 'hands';
        this.emit('pickup', {station:key,orderId:this.hand.orderId});
        return true;
      }
      return this.fail('Park a part here to free your hands.');
    }
    if (key === 'ship') {
      const order = this.heldOrder;
      if (!order) return this.fail('Bring a finished part to Shipping.');
      if (order.route[order.index] !== 'ship') return this.fail(`#${order.id} needs ${OPS[order.route[order.index]].name} next.`);
      this.combo = Math.min(this.combo + 1, 5);
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const rushBonus = this.call?.orderId === order.id && this.call.state === 'active' ? this.call.bonus : 0;
      const breakdown=scoreShipment(order,this.combo,{programming:this.config.programming,rushBonus});
      const points=breakdown.total;
      for(const key of ['base','program','speed','streak','rush'])this.scoreDetails[key]+=breakdown[key];
      this.score += points;
      this.shipped++;
      if (rushBonus) {
        this.rushesWon++;
        this.emit('rushWon', {orderId:order.id,bonus:rushBonus});
      }
      if (this.call?.orderId === order.id) this.clearCall();
      if (this.office.orderId === order.id) this.office.orderId = null;
      this.hand = null;
      this.orders = this.orders.filter(candidate => candidate.id !== order.id);
      if (this.selectedId === order.id) this.selectedId = this.orders.find(candidate => !candidate.started)?.id ?? this.orders[0]?.id ?? null;
      this.emit('shipped', {orderId:order.id,points,rushBonus,breakdown,combo:this.combo,station:key});
      return true;
    }

    const station = this.stations[key];
    if (!station) return false;
    if (!this.config.unlocks.includes(key)) return this.fail(`${OPS[key].name} is not needed in this shift.`);
    if (station.part) {
      if (!station.ready) return this.fail(`${OPS[key].name} is working. Handle another order.`);
      if (this.hand) return this.fail('Free your hands before collecting this part.');
      this.hand = station.part;
      station.part = null;
      station.ready = false;
      station.remaining = 0;
      this.order(this.hand.orderId).location = 'hands';
      this.emit('pickup', {station:key,orderId:this.hand.orderId});
      return true;
    }
    const order = this.heldOrder;
    if (!order) return this.fail(`Bring a part that needs ${OPS[key].name}.`);
    if (!order.programmed) return this.fail(`#${order.id} needs programming at the office first.`);
    if (order.route[order.index] !== key) return this.fail(`#${order.id} needs ${OPS[order.route[order.index]].name} next.`);
    station.part = this.hand;
    this.hand = null;
    station.remaining = OPS[key].duration;
    station.ready = false;
    order.location = key;
    this.emit('load', {station:key,orderId:order.id});
    return true;
  }

  fail(message) { this.emit('hint', {message}); return false; }
  passed() { return this.shipped >= this.config.passTarget; }
  stars() { return this.config.stars.filter(target => this.shipped >= target).length; }
  snapshot() {
    return {
      mode:this.mode,shift:this.shiftIndex,time:this.time,score:this.score,ruleset:RULESET,
      sourced:this.sourced,sourcePoints:this.sourcePoints,sourcing:this.sourcing?{...this.sourcing}:null,
      shipped:this.shipped,missed:this.missed,unfinished:this.unfinished,
      combo:this.combo,selectedId:this.selectedId,passed:this.passed(),
      rushesAccepted:this.rushesAccepted,rushesWon:this.rushesWon,
      callsReceived:this.callsReceived,callsAnswered:this.callsAnswered,
      office:{...this.office},call:this.call ? {...this.call} : null,
      hand:this.hand ? {...this.hand} : null,buffer:this.buffer ? {...this.buffer} : null,
      orders:this.orders.map(order => ({...order,route:[...order.route]})),
      stations:JSON.parse(JSON.stringify(this.stations)),
    };
  }
}
