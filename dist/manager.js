import { ShopGame, OPS, stockType } from './core.js';

// Open for Business: the shop-manager mode. Days instead of a single shift,
// cash instead of points, quotes the player bids on or refuses, and a floor
// that grows from hands-on machining into running a business. Shift rules in
// core.js stay untouched.
export const MANAGER_RULESET = 'manager-v1';
// A separate game mode, not an entry in SHIFTS: it is always available and
// never touches the shift unlock chain. Server rows identify it by ruleset;
// the role is a fixed out-of-range marker so it can never collide with a level.
export const MANAGER_ROLE = -1;
export const MANAGER_MODE = {
  id:'open-for-business', mapId:'owner-shop', mode:'manager', name:'Open for Business', author:'Claude Opus 5.5', harness:'Claude Code',
  subtitle:'Your own shop. Pick jobs, buy machines, hire staff.',
  brief:'The keys are yours. Bid on the quotes that come in, turn away what your floor cannot make, or send it to Covari. Spend what you earn on machines, staff and room to grow. Rent and wages are due every evening.',
  tip:'A job you accept but cannot make will expire, and that costs cash and reputation. Machines wear out: service them before they break.',
  retryTip:'Turn away what you cannot make. Buy the machine that unlocks the most quotes.',
  duration:150, firstArrival:3, interval:15, deadline:90, recipes:[], unlocks:['lathe', 'mill', 'inspect'], stock:['round', 'plate', 'block'],
  programming:true, sourcing:true, calls:false, callTimes:[], passTarget:3, stars:[3, 5, 7],
};
export const RUN_LENGTHS = [3, 5, 7, 0]; // 0 is Endless.
export const DAY_SECONDS = 150;
export const START_CASH = 1500;
export const START_REPUTATION = 3;
export const QUOTE_WINDOW = 18;
export const MAX_QUOTES = 3;
export const QUOTE_CUTOFF = 20;
export const COVARI_DELIVERY = 20;
export const COVARI_SLOTS = 2;
export const INSTALL_SECONDS = 12;
export const RESALE = .7;
export const LATE_PENALTY = .2;
export const EARLY_TIP = .1;
export const AD = {cost:400, reputation:.5};
export const MAX_DAYS = 99;
export const MATERIAL_COST = {round:30, plate:35, block:45};
export const BIDS = [-.1, 0, .1, .2, .3, .4, .5];
export const SALES_DELAY = 3;
export const CONTRACT_BONUS = .1;
export const CONTRACT_PENALTY = .25;
// Sales rules: quotes priced at or above the review line wait for the owner;
// jobs listed below the Covari line go to Covari even when the floor could make them.
export const REVIEW_LEVELS = [0, 800, 1200, 1600, 2400, 3200];
export const COVARI_BELOW = [0, 300, 400, 500, 600, 800];
// Added on top of Covari's price. The customer pays that total; a higher margin wins less often.
export const COVARI_MARGINS = [0, .1, .2, .3, .4, .5];
// Asking a customer for one more day: the first ask risks this much, each
// further ask on the same job adds it again, and loyalty softens it.
export const DELAY_RISK = .25;
export const SAVE_VERSION = 1;

// Processes that exist only in this mode. Heat and laser can be bought; the
// external ones never get a station, so Covari always has real gaps to fill.
export const MANAGER_OPS = {
  heat:{name:'Furnace',short:'HEAT',duration:10,color:'#ff9b6a'},
  laser:{name:'Laser',short:'MARK',duration:3,color:'#ff7fb0'},
  coat:{name:'Powder coat',short:'COAT',duration:8,color:'#b7c3cf',external:true,technology:'pc'},
  mold:{name:'Injection molding',short:'MOLD',duration:8,color:'#b7c3cf',external:true,technology:'im'},
  edm:{name:'Wire EDM',short:'EDM',duration:8,color:'#b7c3cf',external:true,technology:'edm'},
};
export const opInfo = key => OPS[key] ?? MANAGER_OPS[key];
// What Covari charges for each process it actually performs. Inspect and ship stay on this floor.
export const COVARI_STEP = {lathe:90, mill:110, deburr:70, anodize:120, heat:140, laser:60, coat:160, mold:200, edm:180};
// The lathe, mill and QC bench the shop opens with. Everything else stands in a bay.
export const BASE_STATIONS = ['lathe', 'mill', 'inspect'];

// Machines that can be bought into a bay. Bay size decides what fits:
// compact island bays, small front-wall bays, large bays in the wing and halls,
// and the bench spot where the shop's first QC bench stands.
export const MACHINES = {
  lathe:{name:'Lathe', cost:2600, sizes:['large'], blurb:'A second turning center.'},
  mill:{name:'CNC mill', cost:3200, sizes:['large'], blurb:'A second milling center.'},
  inspect:{name:'QC bench', cost:1500, sizes:['large', 'bench'], blurb:'Another inspection bench.'},
  deburr:{name:'Deburr station', cost:900, sizes:['compact', 'large', 'bench'], blurb:'Breaks sharp edges in 4s.'},
  anodize:{name:'Anodize bath', cost:1400, sizes:['compact', 'large', 'bench'], blurb:'An 8s color dip.'},
  heat:{name:'Heat-treat furnace', cost:1700, sizes:['compact', 'small', 'large', 'bench'], blurb:'Hardens steel in 10s.'},
  laser:{name:'Laser marker', cost:1000, sizes:['compact', 'small', 'large', 'bench'], blurb:'Marks serials in 3s.'},
};
// South halls open below the main building once the east wing stands. Each
// must touch floor the shop already owns: row 1 touches the main building.
export const HALLS = [
  {id:'hall-a', name:'Hall A', row:1, col:0, cost:6000}, {id:'hall-b', name:'Hall B', row:1, col:1, cost:6000},
  {id:'hall-c', name:'Hall C', row:2, col:0, cost:8000}, {id:'hall-d', name:'Hall D', row:2, col:1, cost:8000},
  {id:'hall-e', name:'Hall E', row:3, col:0, cost:10000}, {id:'hall-f', name:'Hall F', row:3, col:1, cost:10000},
];
export const HALL_BAYS = ['large', 'large', 'large', 'large', 'large', 'large', 'small', 'small'];
export const HALL_RENT = .1;
export const HALL_ORDERS = 1;
export const BAYS = [
  {id:'bay-1', size:'compact', wing:false}, {id:'bay-2', size:'compact', wing:false},
  {id:'bay-3', size:'small', wing:false}, {id:'bay-4', size:'small', wing:false},
  {id:'bay-5', size:'large', wing:true}, {id:'bay-6', size:'large', wing:true},
  {id:'bay-7', size:'large', wing:true}, {id:'bay-8', size:'large', wing:true},
  {id:'bay-9', size:'small', wing:true}, {id:'bay-10', size:'small', wing:true},
  // The machines the shop opens with stand in bays of their own, so they can be sold or moved.
  {id:'lathe', size:'large', wing:false, base:true}, {id:'mill', size:'large', wing:false, base:true}, {id:'inspect', size:'bench', wing:false, base:true},
  ...HALLS.flatMap((hall, h) => HALL_BAYS.map((size, i) => ({id:`bay-${11 + h * HALL_BAYS.length + i}`, size, wing:true, hall:hall.id}))),
];
export const BAY_SIZES = {compact:'Compact bay', small:'Small bay', large:'Large bay', bench:'Bench bay'};
export const hallAdjacent = (a, b) => (a.row === b.row && a.col !== b.col) || (a.col === b.col && Math.abs(a.row - b.row) === 1);
export const UPGRADES = {
  spindles:{name:'High-speed spindles', cost:1200, blurb:'Every lathe and mill cuts 30% faster.'},
  cam:{name:'CAM software', cost:700, blurb:'CAD takes 3 seconds instead of 6.'},
  board:{name:'Bigger order board', cost:800, blurb:'Hold 6 accepted jobs instead of 4.'},
};
export const WING = {name:'East wing', cost:6000, rent:1.35, resale:.5,
  blurb:'Builders open a wing overnight: four large bays, two small bays, a second CAD desk and room for more staff. Rent rises 35%.'};
// perHall: extra staff each open south hall makes room for (rounded down).
export const STAFF = {
  programmer:{name:'CAD programmer', wage:160, max:1, maxWing:2, perHall:0, speed:0, blurb:'Sits at a CAD desk and programs every accepted job.'},
  runner:{name:'Shop runner', wage:240, max:2, maxWing:4, perHall:1, speed:3.6, blurb:'Fetches stock, loads machines and moves parts along each route.'},
  clerk:{name:'Shipping clerk', wage:120, max:1, maxWing:2, perHall:.5, speed:3.4, blurb:'Ships inspected parts and takes Covari crates to QC.'},
  technician:{name:'Maintenance tech', wage:200, max:1, maxWing:2, perHall:.5, speed:3.6, blurb:'Repairs breakdowns and services worn machines before they fail.'},
  sales:{name:'Sales manager', wage:220, max:1, maxWing:1, perHall:0, speed:0, blurb:'Answers every quote with your sales rules after three seconds.'},
};
const STAFF_NAMES = {programmer:['Ada', 'Grace'], runner:['Rosa', 'Dev', 'Kim', 'Theo', 'Ines', 'Omar', 'Bea', 'Yuki', 'Nils', 'Pia'],
  clerk:['Sam', 'Lou', 'Noor', 'Ash', 'Remy'], technician:['Rio', 'Hal', 'Ivo', 'June', 'Saul'], sales:['Maya']};
// Fictional customers. Loyalty (0-3) moves prices and how often they call.
export const CUSTOMERS = ['Halvorsen Pumps', 'Pinewick Cycles', 'Orchard Robotics', 'Tidewell Marine', 'Quillfeather Aero', 'Juniper & Vale Instruments'];
// Machines wear with every cycle; past BREAK_FROM a cycle may end in a breakdown.
export const WEAR = {lathe:9, mill:10, deburr:6, anodize:7, heat:11, laser:5, inspect:4};
export const BREAK_FROM = 55;
export const SERVICE_FROM = 15;
export const REPAIR = {owner:5, staff:8};
export const SERVICE = {owner:3, staff:4};
export const TECH_SERVICE_AT = 45;

// Jobs unlock by day so the first morning is readable. Ones that name an
// external process can only be fulfilled through Covari. Later jobs revisit a
// machine, chain several finishes, or need tight-tolerance inspection.
export const JOBS = [
  {id:'spacer',name:'Pocket spacer',kind:'shaft',route:['lathe','inspect'],price:260,day:1,weight:3,fade:.3,color:0x79d9cb},
  {id:'plate',name:'Mounting plate',kind:'plate',route:['mill','inspect'],price:300,day:1,weight:3,fade:.3,color:0x8acaf0},
  {id:'housing',name:'Bearing housing',kind:'block',route:['lathe','mill','inspect'],price:480,day:1,weight:2,color:0xffab8c},
  {id:'knob',name:'Dial knob',kind:'shaft',route:['lathe','deburr','inspect'],price:460,day:1,weight:2,color:0xffc477},
  {id:'collar',name:'Ocean collar',kind:'shaft',route:['lathe','anodize','inspect'],price:600,day:1,weight:1.5,color:0x65d3ec},
  {id:'panel',name:'Powder-coated panel',kind:'plate',route:['mill','coat','inspect'],price:640,day:1,weight:1,color:0xb7c3cf},
  {id:'cover',name:'Molded cover',kind:'block',route:['mold','inspect'],price:600,day:1,weight:1,color:0xd7d0c4},
  {id:'pin',name:'Drive pin',kind:'shaft',route:['lathe','heat','inspect'],price:640,day:2,weight:2,color:0xff9b6a},
  {id:'tag',name:'Serial plate',kind:'plate',route:['mill','laser','inspect'],price:520,day:2,weight:2,color:0xff7fb0},
  {id:'valve',name:'Valve body',kind:'block',route:['lathe','mill','deburr','inspect'],price:720,day:2,weight:1.5,color:0xffab8c},
  {id:'insert',name:'Wire EDM insert',kind:'block',route:['mill','edm','inspect'],price:700,day:2,weight:1,color:0xc9d6df},
  {id:'bracket',name:'Satin bracket',kind:'bracket',route:['mill','deburr','anodize','inspect'],price:820,day:3,weight:1.5,color:0xc2a0f2},
  {id:'die',name:'Tool block',kind:'block',route:['mill','heat','deburr','inspect'],price:860,day:3,weight:1.5,color:0xffab8c},
  {id:'gear',name:'Gear blank',kind:'shaft',route:['lathe','mill','heat','inspect'],price:900,day:3,weight:1,grow:.25,color:0xe4c27a},
  {id:'badge',name:'Branded collar',kind:'shaft',route:['lathe','anodize','laser','inspect'],price:860,day:4,weight:1.5,color:0x65d3ec},
  {id:'shaft',name:'Precision shaft',kind:'shaft',route:['lathe','heat','lathe','inspect'],price:1000,day:4,weight:1,grow:.3,tight:true,color:0xd9e2e6},
  {id:'manifold',name:'Hydraulic manifold',kind:'block',route:['mill','heat','mill','deburr','inspect'],price:1150,day:4,weight:1,grow:.3,color:0x9fc3d8},
  {id:'sensor',name:'Sensor housing',kind:'block',route:['lathe','mill','anodize','laser','inspect'],price:1250,day:5,weight:1,grow:.3,tight:true,color:0x7fd0c0},
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function boardId(length) { return `${MANAGER_RULESET}-${length ? 'd' + length : 'endless'}`; }
export function parseBoard(id) {
  const match = /^manager-v1-(?:d(\d)|(endless))$/.exec(String(id));
  if (!match) return null;
  const length = match[2] ? 0 : Number(match[1]);
  return RUN_LENGTHS.includes(length) ? length : null;
}
// Rent climbs every day so Endless always ends; fixed runs feel it too.
export function rentFor(day, wing = false, halls = 0) { return Math.round(300 * 1.3 ** (day - 1) * (wing ? WING.rent : 1) * (1 + HALL_RENT * halls) / 10) * 10; }
// The lathe, mill and QC bench the shop opens with, valued like any machine.
export const START_ASSETS = BASE_STATIONS.reduce((sum, op) => sum + Math.round(MACHINES[op].cost * RESALE), 0);
export function priceScale(day, reputation, loyalty = 0) { return (.8 + reputation * .2 / 3) * (1 + .05 * (day - 1)) * (1 + .04 * loyalty); }
// The most a single shipment can pay on a given day: best reputation and
// loyalty, the dearest job, the highest bid and the early tip. The server
// uses this to bound posted scores.
export function maxPayout(day) {
  return Math.ceil(Math.max(...JOBS.map(job => job.price)) * priceScale(day, 5, 3) * (1 + Math.max(...BIDS)) * (1 + Math.max(EARLY_TIP, CONTRACT_BONUS))) + 10;
}
export function inspectSeconds(job) { return opInfo('inspect').duration * (job.tight ? 2 : 1); }
export function deadlineFor(job, day = 1) {
  const work = job.route.reduce((sum, key) => sum + (key === 'inspect' ? inspectSeconds(job) : opInfo(key).duration), 0);
  return Math.round((45 + work * 1.5 + job.route.length * 8) * Math.max(.75, 1 - .02 * (day - 1)));
}
// A bigger shop draws more customers: the wing brings quotes 25% more often,
// and each south hall 12% more again.
export function quoteInterval(day, reputation, wing = false, halls = 0) {
  return Math.max(wing ? 5 * .88 ** halls : 6.5, (15 - (day - 1) * 1.1 - (reputation - 3) * 1.5) * (wing ? .75 : 1) * .88 ** halls);
}
// The customer's answer to a bid: certain at or below list, falling quickly above it.
export function winChance(markup, reputation, loyalty) {
  if (markup <= 0) return 1;
  return Math.max(.05, Math.min(1, 1 - 2 * markup + .05 * (reputation - 3) + .06 * loyalty));
}
const round10 = value => Math.round(value / 10) * 10;
export function covariPriceFor(route) {
  let sum = 0;
  for (const key of route) {
    if (key === 'ship' || key === 'inspect') continue;
    const price = COVARI_STEP[key];
    if (price == null) throw new Error(`Covari has no price for ${key}`);
    sum += price;
  }
  return round10(Math.max(40, sum));
}
// One table for the sales strip and setPolicy. Gaps, slots and contracts toggle;
// the rest step through their list.
export const POLICY_STEPS = {
  markup: BIDS,
  gaps: ['decline', 'covari', 'accept'],
  reserve: [0, 1, 2],
  contracts: [true, false],
  review: REVIEW_LEVELS,
  covariMargin: COVARI_MARGINS,
  covariBelow: COVARI_BELOW,
};
const clampBid = value => BIDS.reduce((best, bid) => Math.abs(bid - value) < Math.abs(best - value) ? bid : best, 0);

export class ManagerGame extends ShopGame {
  constructor() {
    super();
    this.manager = true;
    this.distance = (from, to) => from === to ? 0 : 6;
    this.mode = 'menu';
  }

  // Classic arrivals never happen here; quotes replace them.
  spawn() { return false; }
  hasEligibleFutureArrival() { return false; }

  start({length = 5, seed = (Math.random() * 2 ** 32) >>> 0} = {}) {
    if (!RUN_LENGTHS.includes(length)) length = 5;
    // The shared reset builds the floor state; the shift it reads is replaced at once.
    super.reset(0);
    this.shiftIndex = MANAGER_ROLE;
    this.config = {...MANAGER_MODE, unlocks:[...BASE_STATIONS]};
    this.nextArrival = Infinity;
    this.stations = {};
    for (const key of BASE_STATIONS) this.stations[key] = this.newStation(key);
    this.length = length;
    this.seed = seed >>> 0;
    this.useRng(this.seed);
    this.day = 1;
    this.daysCompleted = 0;
    this.totalElapsed = 0;
    this.cash = START_CASH;
    this.reputation = START_REPUTATION;
    this.customers = CUSTOMERS.map(name => ({name, loyalty:1}));
    this.quotes = [];
    this.contracts = [];
    this.nextQuoteAt = this.config.firstArrival;
    this.upgrades = new Set();
    this.machinesBought = {};
    this.installing = {};
    this.expanded = false;
    this.wingPending = false;
    this.halls = [];
    this.hallsPending = [];
    this.orderLimit = 4;
    this.adDay = 0;
    this.covariPartner = false;
    // Gaps stay turned away until the shop partners. The margin is added to Covari's price.
    this.policy = {markup:0, gaps:'decline', reserve:0, contracts:true, review:0, covariMargin:.2, covariBelow:0};
    this.staff = [];
    this.staffHired = 0;
    this.receivingQueue = [];
    this.receiving = null;
    this.playerStation = null;
    this.service = null;
    this.totals = {revenue:0, tips:0, materials:0, covari:0, penalties:0, purchases:0, wages:0, rent:0, repairs:0};
    this.ledger = this.blankLedger();
    this.history = [];
    this.quotesSeen = 0;
    this.accepted = 0;
    this.declined = 0;
    this.lapsed = 0;
    this.lost = 0;
    this.bidsLost = 0;
    this.cancelled = 0;
    this.impossibleAccepted = 0;
    this.breakdowns = 0;
    this.contractsDone = 0;
    this.contractsFailed = 0;
    this.delays = 0;
    this.delaysRefused = 0;
    this.moves = 0;
    this.mode = 'playing';
    this.emit('dayStart', {day:1});
    return this;
  }

  // mulberry32 with its state kept on the game, so a saved run resumes the same stream.
  useRng(state) {
    this.rngState = state >>> 0;
    this.rng = () => {
      const a = this.rngState = (this.rngState + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Saving -----------------------------------------------------------------------
  // A run is plain data apart from its random stream, the event queue and the
  // route function the view supplies, so it saves as JSON at any moment.
  serialize() {
    const data = {};
    for (const [key, value] of Object.entries(this)) {
      if (key === 'events' || typeof value === 'function') continue;
      data[key] = value instanceof Set ? [...value] : value;
    }
    return JSON.stringify({version:SAVE_VERSION, ruleset:MANAGER_RULESET, data},
      (key, value) => typeof value === 'number' && !Number.isFinite(value) ? (Number.isNaN(value) ? null : value > 0 ? '+Infinity' : '-Infinity') : value);
  }
  // Loads a saved run over a fresh one, so fields added since the save keep
  // their defaults. A run saved mid-day comes back paused.
  restore(text) {
    let saved;
    try { saved = JSON.parse(text, (key, value) => value === '+Infinity' ? Infinity : value === '-Infinity' ? -Infinity : value); } catch { return false; }
    const data = saved?.data;
    if (saved?.version !== SAVE_VERSION || saved.ruleset !== MANAGER_RULESET || !data || typeof data !== 'object' || Array.isArray(data)) return false;
    const list = key => Array.isArray(data[key]);
    if (!RUN_LENGTHS.includes(data.length) || !['playing', 'paused', 'help', 'evening'].includes(data.mode) || !Number.isInteger(data.day) || data.day < 1 ||
      !Number.isFinite(data.cash) || !Number.isFinite(data.rngState) || !data.stations || typeof data.stations !== 'object' || !data.config?.unlocks ||
      !['orders', 'quotes', 'contracts', 'staff', 'customers', 'history', 'upgrades', 'receivingQueue'].every(list)) return false;
    this.start({length:data.length, seed:data.seed});
    const policy = {...this.policy};
    Object.assign(this, data);
    this.config = {...MANAGER_MODE, ...data.config, unlocks:[...data.config.unlocks]};
    this.upgrades = new Set(data.upgrades);
    this.policy = {...policy, ...data.policy};
    this.useRng(data.rngState);
    this.events = [];
    this.mode = data.mode === 'evening' ? 'evening' : 'paused';
    return true;
  }

  newStation(op) { return {op, part:null, remaining:0, ready:false, duration:0, wear:0, down:false, service:null}; }
  blankLedger() { return {revenue:0, tips:0, materials:0, covari:0, penalties:0, purchases:0, wages:0, rent:0, shipped:0, missed:0, breakdowns:0}; }
  spend(kind, amount) {
    this.cash -= amount; this.ledger[kind] += amount; this.totals[kind] += amount;
    // After-hours spending belongs on the day that just closed, not tomorrow.
    const closed = this.mode === 'evening' && this.history.at(-1);
    if (closed) { closed[kind] += amount; closed.cash = this.cash; }
  }
  earn(amount, tip = 0) { this.cash += amount + tip; this.ledger.revenue += amount; this.ledger.tips += tip; this.totals.revenue += amount; this.totals.tips += tip; }

  // Floor ---------------------------------------------------------------------
  opOf(key) { return this.stations[key]?.op ?? null; }
  installed(key) { return Boolean(this.stations[key]) && !(key in this.installing); }
  stationsFor(op) { return Object.keys(this.stations).filter(key => this.stations[key].op === op && this.installed(key)); }
  hasMachine(op) { return this.stationsFor(op).length > 0; }
  gapsFor(route) { return route.filter(key => key !== 'ship' && !this.hasMachine(key)); }
  bayOpen(bay) { return Boolean(bay) && (!bay.wing || this.expanded) && (!bay.hall || this.halls.includes(bay.hall)); }
  bayMachines() { return BAYS.filter(bay => this.stations[bay.id]).map(bay => this.stations[bay.id].op); }
  usable(key) { const station = this.stations[key]; return this.installed(key) && !station.down && !station.service; }
  durationFor(op, order = null, key = null) {
    let seconds = opInfo(op).duration;
    if (op === 'inspect' && order?.tight) seconds *= 2;
    if (this.upgrades.has('spindles') && (op === 'lathe' || op === 'mill')) seconds *= .7;
    // Worn machines run slower: up to 40% at full wear.
    const wear = key ? this.stations[key]?.wear ?? 0 : 0;
    return seconds * (1 + wear / 250);
  }
  cadTime() { return this.upgrades.has('cam') ? 3 : 6; }
  // Expedited work comes first for everyone on staff; then the earliest due.
  byPriority(a, b) { return (b.expedited ? 1 : 0) - (a.expedited ? 1 : 0) || a.remaining - b.remaining || a.id - b.id; }
  activeOrders() { return this.orders.filter(order => !order.outsourced); }
  covariOrders() { return this.orders.filter(order => order.outsourced); }
  // A contract takes one board slot however many units it has.
  boardLoad() { return this.orders.filter(order => !order.outsourced && !order.contractId).length + this.contracts.length; }
  boardFull(reserve = 0) { return this.boardLoad() >= this.orderLimit - reserve; }
  assetValue() {
    let value = 0;
    for (const bay of BAYS) if (this.stations[bay.id]) value += Math.round(MACHINES[this.stations[bay.id].op].cost * RESALE);
    for (const key of this.upgrades) value += Math.round(UPGRADES[key].cost * RESALE);
    if (this.expanded || this.wingPending) value += Math.round(WING.cost * WING.resale);
    for (const id of [...this.halls, ...this.hallsPending]) value += Math.round(HALLS.find(hall => hall.id === id).cost * WING.resale);
    return value;
  }
  netWorth() { return Math.round(this.cash + this.assetValue()); }
  wages() { return this.staff.reduce((sum, member) => sum + STAFF[member.role].wage, 0); }
  rentToday() { return rentFor(this.day, this.expanded, this.halls.length); }
  // Tomorrow's rent, counting anything the builders open overnight.
  rentTomorrow() { return rentFor(this.day + 1, this.expanded || this.wingPending, this.halls.length + this.hallsPending.length); }
  canManage() { return this.mode === 'evening' || this.mode === 'playing'; }
  staffMax(role) { return this.expanded ? STAFF[role].maxWing + Math.floor(this.halls.length * STAFF[role].perHall) : STAFF[role].max; }
  boardSize() { return (this.upgrades.has('board') ? 6 : 4) + HALL_ORDERS * this.halls.length; }
  maxQuotes() { return MAX_QUOTES + Math.floor(this.halls.length / 2); }
  // Buying any south hall frees machines to move between bays.
  canMove() { return this.halls.length + this.hallsPending.length > 0; }
  hall(id) { return HALLS.find(hall => hall.id === id) ?? null; }
  hallOwned(id) { return this.halls.includes(id) || this.hallsPending.includes(id); }
  hallBuyable(id) {
    const hall = this.hall(id);
    if (!hall || !this.expanded || this.hallOwned(id)) return false;
    return hall.row === 1 || HALLS.some(other => this.hallOwned(other.id) && hallAdjacent(hall, other));
  }
  hasStaff(role) { return this.staff.some(member => member.role === role); }

  // Customers, quotes, bids and contracts ---------------------------------------
  pickCustomer() {
    const weights = this.customers.map(customer => customer.loyalty + .5);
    let roll = this.rng() * weights.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) return i; }
    return weights.length - 1;
  }
  pickJob() {
    // Simple turning and milling work fades as the market expects more from the
    // shop; complex jobs grow more common with every day past their debut.
    // About one quote in three needs a process this floor lacks. The rest are
    // work the machines already here can run, so a good shop does not become
    // a desk that only forwards jobs.
    const pool = JOBS.filter(job => job.day <= this.day);
    const weight = job => Math.max(1, job.weight - (job.fade ?? 0) * (this.day - 1)) + (job.grow ?? 0) * (this.day - job.day);
    const makeable = pool.filter(job => this.gapsFor([...job.route, 'ship']).length === 0);
    const gaps = pool.filter(job => this.gapsFor([...job.route, 'ship']).length > 0);
    const source = makeable.length && gaps.length ? (this.rng() < 1 / 3 ? gaps : makeable) : pool;
    let roll = this.rng() * source.reduce((sum, job) => sum + weight(job), 0), job = source.at(-1);
    for (const candidate of source) { roll -= weight(candidate); if (roll <= 0) { job = candidate; break; } }
    return job;
  }
  contractAllowed() {
    return this.day >= 2 && (!this.length || this.day < this.length) && this.contracts.length < 2 && !this.quotes.some(quote => quote.type === 'contract');
  }
  makeQuote() {
    const customer = this.pickCustomer(), loyalty = this.customers[customer].loyalty;
    const contract = this.contractAllowed() && this.rng() < .16;
    const job = this.pickJob();
    const external = job.route.find(key => MANAGER_OPS[key]?.external);
    const basePrice = round10(job.price * priceScale(this.day, this.reputation, loyalty) * (job.tight ? 1.15 : 1));
    const quote = {
      id:this.nextId++, type:contract ? 'contract' : 'job', customer, jobId:job.id, name:job.name, kind:job.kind, color:job.color, tight:Boolean(job.tight),
      technology:external ? MANAGER_OPS[external].technology : null,
      route:[...job.route, 'ship'], basePrice, markup:this.policy.markup, deadline:deadlineFor(job, this.day),
      quoteRemaining:QUOTE_WINDOW, age:0, material:MATERIAL_COST[stockType(job)], covariCost:covariPriceFor(job.route),
    };
    if (contract) {
      quote.units = Math.min(8, 3 + Math.floor(this.rng() * 3) + Math.floor(this.day / 3));
      quote.unitBase = round10(basePrice * (1 + CONTRACT_BONUS));
      // Due at the end of tomorrow's working day.
      quote.deadline = Math.round(this.time + DAY_SECONDS);
    }
    this.priceQuote(quote);
    return quote;
  }
  priceQuote(quote) {
    if (quote.type === 'contract') { quote.unitPrice = round10(quote.unitBase * (1 + quote.markup)); quote.price = quote.unitPrice * quote.units; }
    else quote.price = round10(quote.basePrice * (1 + quote.markup));
    quote.chance = winChance(quote.markup, this.reputation, this.customers[quote.customer].loyalty);
    return quote;
  }
  quote(id) { return this.quotes.find(quote => quote.id === id); }
  contract(id) { return this.contracts.find(contract => contract.id === id); }

  bidQuote(id, step) {
    const quote = this.quote(id);
    if (this.mode !== 'playing' || !quote) return false;
    const next = BIDS[Math.max(0, Math.min(BIDS.length - 1, BIDS.indexOf(clampBid(quote.markup)) + Math.sign(step)))];
    if (next === quote.markup) return false;
    quote.markup = next;
    this.priceQuote(quote);
    this.emit('bid', {orderId:id, markup:next});
    return true;
  }

  setPolicy(key, value) {
    const valid = POLICY_STEPS[key];
    if (!valid || !valid.includes(value)) return false;
    this.policy[key] = value;
    // A new standing bid also applies to quotes still waiting for an answer.
    if (key === 'markup') for (const quote of this.quotes) { quote.markup = value; this.priceQuote(quote); }
    this.emit('policy', {key, value});
    return true;
  }

  // The customer answers a bid at once: won, the job is yours; lost, it goes elsewhere.
  acceptQuote(id, {bySales = false} = {}) {
    const quote = this.quote(id);
    if (this.mode !== 'playing' || !quote) return false;
    if (this.boardFull()) return this.fail(`The order board is full (${this.orderLimit}). Finish or lose a job first.`);
    this.quotes = this.quotes.filter(candidate => candidate !== quote);
    this.priceQuote(quote);
    if (quote.chance < 1 && this.rng() >= quote.chance) {
      this.bidsLost++;
      this.emit('bidLost', {orderId:id, customer:this.customers[quote.customer].name, markup:quote.markup, bySales});
      return true;
    }
    const gaps = this.gapsFor(quote.route);
    const cad = this.cadTime();
    const base = {index:0, started:false, location:'material', programmed:false, programRemaining:cad, programDuration:cad,
      gaps, outsourced:false, materialPaid:false, customer:quote.customer};
    if (quote.type === 'contract') {
      const contract = {id:quote.id, customer:quote.customer, jobId:quote.jobId, name:quote.name, kind:quote.kind, color:quote.color, tight:quote.tight,
        route:[...quote.route], units:quote.units, unitPrice:quote.unitPrice, shipped:0, failed:0, deadline:quote.deadline, remaining:quote.deadline, gaps};
      this.contracts.push(contract);
      for (let unit = 0; unit < quote.units; unit++) {
        this.orders.push({...base, id:this.nextId++, contractId:contract.id, unit:unit + 1, name:quote.name, kind:quote.kind, color:quote.color,
          tight:quote.tight, route:[...quote.route], price:quote.unitPrice, deadline:quote.deadline, remaining:quote.deadline,
          material:quote.material, jobId:quote.jobId});
      }
    } else {
      this.orders.push({...quote, ...base, remaining:quote.deadline});
    }
    this.accepted++;
    if (gaps.length) this.impossibleAccepted++;
    if (!this.selectedId) this.selectedId = this.orders[0]?.id ?? null;
    this.emit('accepted', {orderId:quote.id, gaps, contract:quote.type === 'contract', price:quote.price, markup:quote.markup, bySales});
    return true;
  }

  declineQuote(id, {bySales = false} = {}) {
    const quote = this.quote(id);
    if (this.mode !== 'playing' || !quote) return false;
    this.quotes = this.quotes.filter(candidate => candidate !== quote);
    this.declined++;
    this.emit('declined', {orderId:id, bySales});
    return true;
  }

  // Covari takes work the floor cannot make (the shared capability-gap rule,
  // expressed per quote) and, when the owner sets a limit, small jobs listed under it.
  smallJob(quote) { return quote.type !== 'contract' && this.policy.covariBelow > 0 && quote.basePrice < this.policy.covariBelow; }
  covariEligible(quote) { return !!this.covariPartner && quote.type !== 'contract' && (this.gapsFor(quote.route).length > 0 || this.smallJob(quote)); }
  covariOpen(quote) { return this.covariEligible(quote) && this.covariOrders().length < COVARI_SLOTS && this.cash >= quote.covariCost; }
  covariCharge(quote) { return round10((quote?.covariCost ?? 0) * (1 + (this.policy.covariMargin ?? 0))); }
  // One click from the shop menu or the floor banner. Missing processes then go to Covari.
  partnerCovari() {
    if (!this.canManage() || this.covariPartner) return false;
    this.covariPartner = true;
    this.policy.gaps = 'covari';
    this.emit('covariPartner');
    return true;
  }
  // Big quotes wait for the owner even when a sales manager is on staff.
  needsReview(quote) { return this.policy.review > 0 && quote.price >= this.policy.review; }
  outsourceQuote(id, {bySales = false} = {}) {
    const quote = this.quote(id);
    if (this.mode !== 'playing' || !quote) return false;
    if (!this.covariPartner) return this.fail('Partner with Covari from the shop menu. Press M.');
    if (quote.type === 'contract') return this.fail('Covari places single jobs, not whole contracts.');
    if (!this.covariEligible(quote)) return this.fail(this.policy.covariBelow ? `Your floor can make this one, and it lists above your Covari limit of $${this.policy.covariBelow}.` : 'Your floor can make this one. Covari is for work your shop cannot do.');
    if (this.covariOrders().length >= COVARI_SLOTS) return this.fail(`Covari is already placing ${COVARI_SLOTS} jobs for you. Ship one first.`);
    if (this.cash < quote.covariCost) return this.fail(`Covari's price is $${quote.covariCost}. You need that up front.`);
    const margin = this.policy.covariMargin ?? 0;
    quote.markup = margin;
    quote.price = this.covariCharge(quote);
    quote.chance = winChance(margin, this.reputation, this.customers[quote.customer].loyalty);
    this.quotes = this.quotes.filter(candidate => candidate !== quote);
    if (quote.chance < 1 && this.rng() >= quote.chance) {
      this.bidsLost++;
      this.emit('bidLost', {orderId:id, customer:this.customers[quote.customer].name, markup:quote.markup, bySales});
      return true;
    }
    this.spend('covari', quote.covariCost);
    const order = {...quote, route:['inspect', 'ship'], index:0, remaining:quote.deadline, started:true, location:'supplier',
      programmed:true, programRemaining:0, programDuration:0, gaps:[], outsourced:true, materialPaid:true, deliveryRemaining:COVARI_DELIVERY};
    this.orders.push(order);
    this.emit('outsourced', {orderId:order.id, cost:quote.covariCost, bySales});
    return true;
  }

  // The sales manager answers each quote after a short look, using the rules.
  salesDecide(quote) {
    const gaps = this.gapsFor(quote.route), room = !this.boardFull(this.policy.reserve);
    if (quote.type === 'contract') return this.policy.contracts && !gaps.length && room ? this.acceptQuote(quote.id, {bySales:true}) : this.declineQuote(quote.id, {bySales:true});
    const small = !gaps.length && this.smallJob(quote);
    if ((small || (gaps.length && this.policy.gaps === 'covari')) && this.salesOutsource(quote)) return true;
    if (gaps.length) {
      if (this.policy.gaps === 'accept' && room) return this.acceptQuote(quote.id, {bySales:true});
      return this.declineQuote(quote.id, {bySales:true});
    }
    // A small job Covari cannot take right now is still work the floor can make.
    return room ? this.acceptQuote(quote.id, {bySales:true}) : this.declineQuote(quote.id, {bySales:true});
  }
  // Covari's price is fixed. The shop's margin is what the customer pays on top.
  salesOutsource(quote) {
    return this.covariOpen(quote) && this.outsourceQuote(quote.id, {bySales:true});
  }

  // Accepted work ------------------------------------------------------------------
  // A job or a whole contract by id: contracts act on every unit at once.
  workUnits(id) {
    const contract = this.contract(id);
    if (contract) return {target:contract, units:this.orders.filter(order => order.contractId === id), contract};
    const order = this.order(id);
    return order && !order.contractId ? {target:order, units:[order], contract:null} : null;
  }
  // Expediting puts a job at the front of every queue: CAD, stock, machines and crates.
  expedite(id) {
    const work = this.workUnits(id);
    if (this.mode !== 'playing' || !work?.units.length) return false;
    const on = !work.target.expedited;
    work.target.expedited = on;
    for (const unit of work.units) unit.expedited = on;
    this.emit('expedite', {orderId:id, on, contract:Boolean(work.contract)});
    return true;
  }
  delayRisk(id) {
    const work = this.workUnits(id);
    if (!work) return null;
    const loyalty = this.customers[work.target.customer]?.loyalty ?? 0;
    return Math.max(.05, Math.min(.9, DELAY_RISK * (1 + (work.target.delays ?? 0)) - .05 * loyalty));
  }
  // Asking for one more day. Most customers agree; the rest take the work
  // elsewhere at once, and the job expires where it stands.
  delayOrder(id) {
    const work = this.workUnits(id);
    if (this.mode !== 'playing') return false;
    if (!work?.units.length) return this.fail('That job has already closed.');
    const risk = this.delayRisk(id), customer = this.customers[work.target.customer]?.name;
    if (this.rng() < risk) {
      this.delaysRefused++;
      for (const unit of work.units) this.expire(unit.id);
      this.emit('delayRefused', {orderId:id, customer, contract:Boolean(work.contract)});
      return true;
    }
    this.delays++;
    work.target.delays = (work.target.delays ?? 0) + 1;
    for (const unit of [...work.units, ...(work.contract ? [work.contract] : [])]) {
      unit.remaining += DAY_SECONDS;
      unit.deadline += DAY_SECONDS;
      unit.delays = work.target.delays;
    }
    this.emit('delayed', {orderId:id, customer, contract:Boolean(work.contract), risk:this.delayRisk(id)});
    return true;
  }

  // Purchases -------------------------------------------------------------------
  buyMachine(bayId, op) {
    const bay = BAYS.find(candidate => candidate.id === bayId), machine = MACHINES[op];
    if (!this.canManage() || !machine || !bay) return false;
    if (!this.bayOpen(bay)) return this.fail(this.closedBay(bay));
    if (this.stations[bayId]) return this.fail('That bay already holds a machine.');
    if (!machine.sizes.includes(bay.size)) return this.fail(`A ${machine.name.toLowerCase()} does not fit a ${BAY_SIZES[bay.size].toLowerCase()}.`);
    if (this.cash < machine.cost) return this.fail(`A ${machine.name.toLowerCase()} costs $${machine.cost.toLocaleString()}.`);
    this.spend('purchases', machine.cost);
    this.stations[bayId] = this.newStation(op);
    this.machinesBought[op] = (this.machinesBought[op] ?? 0) + 1;
    if (this.mode === 'playing') this.installing[bayId] = INSTALL_SECONDS;
    else this.install(bayId);
    this.emit('purchase', {key:op, station:bayId, cost:machine.cost});
    return true;
  }
  install(key) {
    delete this.installing[key];
    const op = this.opOf(key);
    if (op && !this.config.unlocks.includes(op)) this.config.unlocks.push(op);
    this.emit('installed', {station:key, op});
  }
  // Selling frees the bay for a different layout. The machine must be empty and idle.
  sellMachine(key) {
    const bay = BAYS.find(candidate => candidate.id === key), station = this.stations[key];
    if (!bay || !station || !this.canManage()) return false;
    if (station.part || station.service || station.down) return this.fail('Empty and repair the machine before selling it.');
    const refund = Math.round(MACHINES[station.op].cost * RESALE);
    delete this.stations[key];
    delete this.installing[key];
    this.cash += refund;
    this.ledger.purchases -= refund; this.totals.purchases -= refund;
    const closed = this.mode === 'evening' && this.history.at(-1);
    if (closed) { closed.purchases -= refund; closed.cash = this.cash; }
    this.config.unlocks = this.config.unlocks.filter(op => this.hasMachine(op));
    this.dropTasksAt(key);
    this.emit('sold', {station:key, op:station.op, refund});
    return true;
  }
  closedBay(bay) { return bay.hall ? `That bay is in ${this.hall(bay.hall).name}. Open the hall first.` : 'That bay is in the east wing. Build the wing first.'; }
  // Staff heading for a machine that leaves its bay drop that errand and plan again.
  dropTasksAt(key) { for (const member of this.staff) if (member.task?.steps.some(step => step.station === key)) member.task = null; }
  // With a south hall bought, an idle machine can move to any open bay it
  // fits. It has to be installed again, so it is out of use for a while.
  moveMachine(from, to) {
    const source = BAYS.find(bay => bay.id === from), target = BAYS.find(bay => bay.id === to), station = this.stations[from];
    if (!this.canManage() || !source || !target || !station || from === to) return false;
    if (!this.canMove()) return this.fail('Buy a south hall to start moving machines between bays.');
    if (!this.bayOpen(target)) return this.fail(this.closedBay(target));
    if (this.stations[to]) return this.fail('That bay already holds a machine.');
    const machine = MACHINES[station.op];
    if (!machine.sizes.includes(target.size)) return this.fail(`A ${machine.name.toLowerCase()} does not fit a ${BAY_SIZES[target.size].toLowerCase()}.`);
    if (station.part || station.service || station.down) return this.fail('Empty and repair the machine before moving it.');
    delete this.stations[from];
    delete this.installing[from];
    this.stations[to] = station;
    Object.assign(station, {part:null, remaining:0, ready:false, duration:0});
    this.config.unlocks = this.config.unlocks.filter(op => this.hasMachine(op));
    this.dropTasksAt(from);
    this.moves++;
    if (this.mode === 'playing') this.installing[to] = INSTALL_SECONDS;
    this.emit('moved', {from, to, op:station.op});
    if (this.mode !== 'playing') this.install(to);
    return true;
  }
  purchase(key) {
    const item = UPGRADES[key];
    if (!item || this.upgrades.has(key) || !this.canManage()) return false;
    if (this.cash < item.cost) return this.fail(`${item.name} costs $${item.cost.toLocaleString()}.`);
    this.spend('purchases', item.cost);
    this.upgrades.add(key);
    if (key === 'board') this.orderLimit = this.boardSize();
    this.emit('purchase', {key, cost:item.cost});
    return true;
  }
  // The wing opens the next morning, whenever it is ordered.
  buildWing() {
    if (!this.canManage() || this.expanded || this.wingPending) return false;
    if (this.cash < WING.cost) return this.fail(`The east wing costs $${WING.cost.toLocaleString()}.`);
    this.spend('purchases', WING.cost);
    this.wingPending = true;
    this.emit('wingOrdered', {cost:WING.cost});
    return true;
  }
  // South halls also open the next morning. Each one must touch owned floor.
  buildHall(id) {
    const hall = this.hall(id);
    if (!this.canManage() || !hall || this.hallOwned(id)) return false;
    if (!this.expanded) return this.fail('Open the east wing before building south.');
    if (!this.hallBuyable(id)) return this.fail(`${hall.name} has to touch a hall you already own.`);
    if (this.cash < hall.cost) return this.fail(`${hall.name} costs $${hall.cost.toLocaleString()}.`);
    this.spend('purchases', hall.cost);
    this.hallsPending.push(id);
    this.emit('hallOrdered', {hall:id, cost:hall.cost});
    return true;
  }

  advertise() {
    if (!this.canManage()) return false;
    if (this.adDay === this.day) return this.fail('One ad campaign per day.');
    if (this.reputation >= 5) return this.fail('Your reputation is already at its best.');
    if (this.cash < AD.cost) return this.fail(`An ad campaign costs $${AD.cost}.`);
    this.spend('purchases', AD.cost);
    this.adDay = this.day;
    this.reputation = Math.min(5, this.reputation + AD.reputation);
    this.emit('advertised', {reputation:this.reputation});
    return true;
  }

  hire(role) {
    const info = STAFF[role];
    if (!info || !this.canManage()) return false;
    if (this.staff.filter(member => member.role === role).length >= this.staffMax(role))
      return this.fail(!this.expanded && info.max < info.maxWing ? `Build the east wing to make room for another ${info.name.toLowerCase()}.`
        : info.perHall && this.halls.length < HALLS.length ? `Open another south hall to make room for another ${info.name.toLowerCase()}.` : `You already have the most ${info.name.toLowerCase()}s this shop can use.`);
    const names = STAFF_NAMES[role], used = new Set(this.staff.map(member => member.name));
    const seats = this.staff.filter(member => member.role === 'programmer').map(member => member.seat);
    const member = {id:`staff-${++this.staffHired}`, role, name:names.find(name => !used.has(name)) ?? names[0],
      at:role === 'programmer' ? 'office' : role === 'sales' ? 'office' : 'receiving', from:null, to:null, state:'idle', walkTotal:0, walkRemaining:0,
      carry:null, task:null, think:0, waited:0, orderId:null, seat:role === 'programmer' ? (seats.includes(0) ? 1 : 0) : null};
    this.staff.push(member);
    this.emit('hired', {staffId:member.id, role});
    return true;
  }

  // Letting someone go happens after closing so nobody drops a part mid-route.
  fire(id) {
    const member = this.staff.find(candidate => candidate.id === id);
    if (!member) return false;
    if (this.mode !== 'evening') return this.fail('Change staff after closing.');
    this.releaseCarry(member);
    for (const station of Object.values(this.stations)) if (station.service?.by === member.id) station.service = null;
    this.staff = this.staff.filter(candidate => candidate !== member);
    this.emit('fired', {staffId:id, role:member.role});
    return true;
  }
  releaseCarry(member) {
    const order = member.carry ? this.order(member.carry) : null;
    member.carry = null;
    member.task = null;
    if (!order) return;
    if (!this.buffer) { this.buffer = {orderId:order.id}; order.location = 'buffer'; }
    else if (order.outsourced) { this.receivingQueue.unshift(order.id); order.location = 'receiving'; this.syncReceiving(); }
    else { order.started = false; order.index = 0; order.location = 'material'; }
  }

  syncReceiving() { this.receiving = this.receivingQueue.length ? {orderId:this.receivingQueue[0]} : null; }

  nextMaterial(type) {
    const reserved = this.reservedOrders();
    const ready = this.orders
      .filter(order => !order.started && order.programmed && !order.outsourced && stockType(order) === type)
      .sort((a, b) => this.byPriority(a, b));
    return ready.find(order => !reserved.has(order.id)) ?? ready[0];
  }
  // One CAD program covers every unit of a contract.
  nextCAD() {
    const current = this.office.orderId !== null ? this.order(this.office.orderId) : null;
    if (current && !current.programmed) return current;
    return this.cadQueue()[0];
  }
  cadQueue(except = new Set()) {
    const seen = new Set();
    return this.orders.filter(order => !order.programmed && !order.outsourced && !except.has(order.id))
      .sort((a, b) => this.byPriority(a, b))
      .filter(order => !order.contractId || (!seen.has(order.contractId) && seen.add(order.contractId)));
  }

  // The machinist -----------------------------------------------------------------
  setPlayerStation(key) { this.playerStation = key; }

  interact(key) {
    if (this.mode !== 'playing') return false;
    if (key === 'receiving') {
      if (!this.receivingQueue.length) return this.fail('No Covari delivery is waiting.');
      if (this.hand) return this.fail('Your hands are full. Clear them before receiving the crate.');
      const id = this.receivingQueue.shift();
      this.syncReceiving();
      this.hand = {orderId:id};
      this.order(id).location = 'hands';
      this.emit('pickup', {station:key, orderId:id});
      return true;
    }
    if (key === 'office' || key === 'buffer') return super.interact(key);
    if (key === 'material' || key.startsWith('material-')) {
      if (this.heldOrder?.outsourced) return this.fail('A Covari part cannot be recycled. Inspect and ship it.');
      if (this.hand) return super.interact(key);
      const order = key === 'material' ? this.selected : this.nextMaterial(key.slice('material-'.length));
      if (order && !order.materialPaid && !order.started && order.programmed && this.cash < order.material) return this.fail(`Stock for #${order.id} costs $${order.material}. Ship something first.`);
      if (order?.outsourced) return this.fail('Covari is making that part. Collect it at Receiving.');
      const picked = super.interact(key);
      if (picked && this.heldOrder && !this.heldOrder.materialPaid) this.payMaterial(this.heldOrder);
      return picked;
    }
    if (key === 'ship') {
      const order = this.heldOrder;
      if (!order) return this.fail('Bring an inspected part to Shipping.');
      if (order.route[order.index] !== 'ship') return this.fail(`#${order.id} needs ${opInfo(order.route[order.index]).name} next.`);
      this.hand = null;
      this.shipOrder(order, null);
      return true;
    }
    const station = this.stations[key];
    if (!station) return BAYS.some(bay => bay.id === key) ? this.fail('This bay is empty. Click it to choose a machine.') : false;
    const name = opInfo(station.op).name, lower = name.toLowerCase();
    if (key in this.installing) return this.fail(`The ${lower} is being installed · ${Math.ceil(this.installing[key])}s.`);
    if (station.service) {
      if (station.service.by === 'owner') return this.fail(station.service.kind === 'repair' ? 'Keep at it: the repair is under way.' : 'Keep at it: servicing in progress.');
      return this.fail(`${this.staff.find(member => member.id === station.service.by)?.name ?? 'Your technician'} is working on the ${lower}.`);
    }
    if (station.down) return this.startService(key, 'repair', 'owner');
    if (station.part) {
      if (!station.ready) return this.fail(`${name} is working. Handle another order.`);
      if (this.hand) {
        const order = this.heldOrder;
        if (!order.programmed) return this.fail(`#${order.id} needs CAD at the office first.`);
        if (order.route[order.index] !== station.op) return this.fail(`#${order.id} needs ${opInfo(order.route[order.index]).name} next.`);
        const completed = station.part;
        this.loadStation(key, order);
        this.hand = completed;
        this.order(completed.orderId).location = 'hands';
        this.emit('load', {station:key, orderId:order.id, collectedOrderId:completed.orderId});
        return true;
      }
      this.hand = station.part;
      this.clearStation(key);
      this.order(this.hand.orderId).location = 'hands';
      this.emit('pickup', {station:key, orderId:this.hand.orderId});
      return true;
    }
    const order = this.heldOrder;
    if (!order) {
      // Empty hands at an idle machine: give it a service.
      if (station.wear >= SERVICE_FROM) return this.startService(key, 'maint', 'owner');
      return this.fail(`Bring a part that needs the ${lower}.`);
    }
    if (!order.programmed) return this.fail(`#${order.id} needs CAD at the office first.`);
    if (order.route[order.index] !== station.op) return this.fail(`#${order.id} needs ${opInfo(order.route[order.index]).name} next.`);
    this.hand = null;
    this.loadStation(key, order);
    this.emit('load', {station:key, orderId:order.id});
    return true;
  }

  startService(key, kind, by) {
    const station = this.stations[key];
    if (!station || station.service || (kind === 'maint' && (station.part || station.down))) return false;
    // The owner works on one machine at a time; starting another abandons the first.
    if (by === 'owner' && this.service && this.service.station !== key) {
      const previous = this.stations[this.service.station];
      if (previous?.service?.by === 'owner') previous.service = null;
      this.service = null;
    }
    const seconds = (kind === 'repair' ? REPAIR : SERVICE)[by === 'owner' ? 'owner' : 'staff'];
    station.service = {kind, by, remaining:seconds, total:seconds};
    if (by === 'owner') this.service = {station:key, kind};
    this.emit('serviceStart', {station:key, kind, by});
    return true;
  }
  finishService(key) {
    const station = this.stations[key], service = station.service;
    station.service = null;
    if (service.kind === 'repair') { station.down = false; station.wear = 25; }
    else station.wear = 0;
    if (service.by === 'owner') this.service = null;
    this.emit('serviced', {station:key, kind:service.kind, by:service.by});
  }

  payMaterial(order) { order.materialPaid = true; this.spend('materials', order.material); }
  loadStation(key, order) {
    const station = this.stations[key];
    station.part = {orderId:order.id};
    station.remaining = this.durationFor(station.op, order, key);
    station.duration = station.remaining;
    station.ready = false;
    order.location = key;
  }
  clearStation(key) { Object.assign(this.stations[key], {part:null, remaining:0, ready:false}); }

  shipOrder(order, member) {
    // A job that needed an extra day earns no early-delivery tip.
    const tip = !order.outsourced && !order.contractId && !order.delays && order.remaining > order.deadline / 2 ? round10(order.price * EARLY_TIP) : 0;
    this.earn(order.price, tip);
    this.reputation = Math.min(5, this.reputation + .1);
    const customer = this.customers[order.customer];
    if (customer) customer.loyalty = Math.min(3, customer.loyalty + .2);
    this.shipped++;
    this.ledger.shipped++;
    if (order.outsourced) this.sourced++;
    if (this.office.orderId === order.id) this.office.orderId = null;
    order.location = 'shipped';
    this.orders = this.orders.filter(candidate => candidate !== order);
    if (this.selectedId === order.id) this.selectedId = this.orders.find(candidate => !candidate.started)?.id ?? this.orders[0]?.id ?? null;
    this.emit('shipped', {orderId:order.id, points:order.price + tip, price:order.price, tip, station:'ship', staffId:member?.id ?? null, outsourced:order.outsourced, contractId:order.contractId ?? null});
    const contract = order.contractId ? this.contract(order.contractId) : null;
    if (contract) { contract.shipped++; this.settleContract(contract); }
  }

  settleContract(contract) {
    if (contract.shipped + contract.failed < contract.units) return;
    this.contracts = this.contracts.filter(candidate => candidate !== contract);
    const customer = this.customers[contract.customer];
    if (!contract.failed) {
      this.contractsDone++;
      this.reputation = Math.min(5, this.reputation + .3);
      if (customer) customer.loyalty = Math.min(3, customer.loyalty + .5);
      this.emit('contractDone', {contractId:contract.id, customer:customer?.name});
    } else this.emit('contractClosed', {contractId:contract.id, shipped:contract.shipped, failed:contract.failed});
  }

  expire(id) {
    const order = this.order(id);
    if (!order) return;
    const contract = order.contractId ? this.contract(order.contractId) : null;
    const penalty = round10(order.price * (contract ? CONTRACT_PENALTY : LATE_PENALTY));
    this.spend('penalties', penalty);
    this.ledger.missed++;
    const customer = this.customers[order.customer];
    if (contract) {
      // A broken contract hurts once, hard; each missed unit still costs its fee.
      if (!contract.failed) {
        this.contractsFailed++;
        this.reputation = Math.max(1, this.reputation - .6);
        if (customer) customer.loyalty = Math.max(0, customer.loyalty - 1.5);
      }
      contract.failed++;
    } else {
      this.reputation = Math.max(1, this.reputation - (order.gaps?.length ? .8 : .4));
      if (customer) customer.loyalty = Math.max(0, customer.loyalty - 1);
    }
    this.receivingQueue = this.receivingQueue.filter(candidate => candidate !== id);
    this.syncReceiving();
    for (const member of this.staff) {
      if (member.carry === id) member.carry = null;
      if (member.task?.orderId === id) member.task = null;
      if (member.orderId === id) member.orderId = null;
    }
    super.expire(id);
    this.emit('penalty', {orderId:id, penalty, impossible:Boolean(order.gaps?.length), contractId:order.contractId ?? null});
    if (contract) this.settleContract(contract);
  }

  tick(dt) {
    if (this.mode !== 'playing') return;
    dt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .1, this.time));
    this.time = Math.max(0, this.time - dt);
    this.elapsed += dt;
    this.totalElapsed += dt;

    if (this.office.present && this.office.orderId !== null) this.programStep(this.order(this.office.orderId), dt, () => { this.office.orderId = null; });

    for (const [key, station] of Object.entries(this.stations)) {
      if (station.service) {
        // The owner has to stay with the machine; staff keep working on their own.
        if (station.service.by !== 'owner' || this.playerStation === key) {
          station.service.remaining = Math.max(0, station.service.remaining - dt);
          if (station.service.remaining <= 0) this.finishService(key);
        }
        continue;
      }
      if (!station.part || station.ready || station.down) continue;
      station.remaining = Math.max(0, station.remaining - dt);
      if (station.remaining > 0) continue;
      station.ready = true;
      const order = this.order(station.part.orderId);
      if (order) { order.index++; order.location = key; this.emit('ready', {station:key, orderId:order.id}); }
      this.wearStation(key);
    }
    for (const key of Object.keys(this.installing)) {
      this.installing[key] = Math.max(0, this.installing[key] - dt);
      if (this.installing[key] <= 0) this.install(key);
    }
    for (const order of [...this.orders]) {
      if (order.outsourced && order.location === 'supplier') {
        order.deliveryRemaining = Math.max(0, order.deliveryRemaining - dt);
        if (order.deliveryRemaining <= 0) {
          order.location = 'receiving';
          this.receivingQueue.push(order.id);
          this.syncReceiving();
          this.emit('sourceDelivered', {orderId:order.id});
        }
      }
      order.remaining -= dt;
      if (order.remaining <= 0) this.expire(order.id);
    }
    for (const contract of this.contracts) contract.remaining = Math.max(0, contract.remaining - dt);
    const selling = this.hasStaff('sales');
    for (const quote of [...this.quotes]) {
      quote.quoteRemaining -= dt;
      quote.age += dt;
      if (selling && quote.age >= SALES_DELAY && !this.needsReview(quote)) { this.salesDecide(quote); continue; }
      if (quote.quoteRemaining <= 0) {
        this.quotes = this.quotes.filter(candidate => candidate !== quote);
        this.lapsed++;
        this.emit('quoteLapsed', {orderId:quote.id});
      }
    }
    if (this.elapsed >= this.nextQuoteAt && this.time > QUOTE_CUTOFF) {
      this.quotesSeen++;
      if (this.quotes.length < this.maxQuotes()) {
        const quote = this.makeQuote();
        this.quotes.push(quote);
        this.emit('quote', {orderId:quote.id, contract:quote.type === 'contract'});
      } else {
        this.lost++;
        this.emit('quoteLost');
      }
      this.nextQuoteAt = this.elapsed + quoteInterval(this.day, this.reputation, this.expanded, this.halls.length) + (this.rng() - .5) * 4;
    }
    this.tickStaff(dt);
    if (this.time <= 0) this.endDay();
  }

  // Each finished cycle adds wear; past BREAK_FROM a cycle can end in a breakdown
  // that traps the finished part until someone repairs the machine.
  wearStation(key) {
    const station = this.stations[key];
    station.wear = Math.min(100, station.wear + (WEAR[station.op] ?? 6) * (.8 + this.rng() * .4));
    if (station.wear > BREAK_FROM && this.rng() < (station.wear - BREAK_FROM) / 90) {
      station.down = true;
      this.breakdowns++;
      this.ledger.breakdowns++;
      this.emit('breakdown', {station:key, op:station.op, orderId:station.part?.orderId ?? null});
    }
  }

  programStep(order, dt, done) {
    if (!order || order.programmed) return done();
    order.programRemaining = Math.max(0, order.programRemaining - dt);
    if (order.programRemaining > 0) return;
    order.programmed = true;
    if (order.contractId) for (const unit of this.orders) if (unit.contractId === order.contractId) { unit.programmed = true; unit.programRemaining = 0; }
    done();
    this.emit('programmed', {orderId:order.id});
  }

  endDay() {
    this.quotes = [];
    this.office.orderId = null;
    for (const key of Object.keys(this.installing)) this.install(key);
    this.spend('wages', this.wages());
    this.spend('rent', this.rentToday());
    this.history.push({day:this.day, ...this.ledger, cash:this.cash, reputation:this.reputation});
    if (this.cash < 0) return this.finishRun('bankrupt');
    this.daysCompleted = this.day;
    if (this.length && this.day >= this.length) return this.finishRun('complete');
    if (this.day >= MAX_DAYS) return this.finishRun('retired');
    this.mode = 'evening';
    this.emit('dayEnd', {day:this.day, ledger:{...this.ledger}});
  }

  openDay() {
    if (this.mode !== 'evening') return false;
    this.day++;
    this.time = this.config.duration;
    this.elapsed = 0;
    this.nextQuoteAt = this.config.firstArrival;
    this.ledger = this.blankLedger();
    if (this.wingPending) {
      this.wingPending = false;
      this.expanded = true;
      this.config.mapId = 'owner-wing';
      this.emit('wingOpened');
    }
    if (this.hallsPending.length) {
      const opened = this.hallsPending;
      this.halls = [...this.halls, ...opened];
      this.hallsPending = [];
      this.orderLimit = this.boardSize();
      this.emit('hallOpened', {halls:opened});
    }
    this.mode = 'playing';
    this.emit('dayStart', {day:this.day});
    return true;
  }

  // Only Endless can be banked early; fixed runs are judged at their last day.
  retire() {
    if (this.mode !== 'evening' || this.length) return false;
    this.finishRun('retired');
    return true;
  }

  // Closing for good cancels unfinished promises, so accepting work late in
  // the final day is not free.
  finishRun(reason) {
    for (const order of this.orders) {
      const penalty = round10(order.price * (order.contractId ? CONTRACT_PENALTY : LATE_PENALTY));
      this.spend('penalties', penalty);
      this.cancelled++;
    }
    this.unfinished = this.orders.length;
    this.orders = [];
    this.quotes = [];
    this.contracts = [];
    this.hand = null;
    this.buffer = null;
    this.receivingQueue = [];
    this.syncReceiving();
    this.service = null;
    for (const station of Object.values(this.stations)) Object.assign(station, {part:null, remaining:0, ready:false, service:null});
    for (const member of this.staff) Object.assign(member, {carry:null, task:null, orderId:null, state:'idle'});
    this.office.orderId = null;
    this.finishReason = reason;
    this.score = Math.max(0, this.netWorth());
    this.mode = 'results';
    this.emit('finish', {reason});
  }

  passed() { return this.finishReason !== 'bankrupt' && this.daysCompleted >= this.config.passTarget; }
  stars() { return this.config.stars.filter(days => this.daysCompleted >= days).length; }

  // Staff --------------------------------------------------------------------
  reservedOrders(except = null) {
    const ids = new Set();
    for (const member of this.staff) if (member !== except) {
      if (member.task) ids.add(member.task.orderId);
      if (member.orderId) ids.add(member.orderId);
    }
    return ids;
  }
  reservedStations(except = null, actions = ['load', 'repair', 'maint']) {
    const keys = new Set();
    for (const member of this.staff) if (member !== except && member.task)
      for (const step of member.task.steps.slice(member.task.step)) if (actions.includes(step.action)) keys.add(step.station);
    return keys;
  }
  // The nearest machine of a process that can take a part now.
  freeStation(op, reserved, near) {
    return this.stationsFor(op)
      .filter(key => this.usable(key) && !this.stations[key].part && !reserved.has(key))
      .sort((a, b) => this.distance(near, a) - this.distance(near, b))[0] ?? null;
  }

  tickStaff(dt) {
    for (const member of this.staff) {
      if (member.role === 'programmer') { this.tickProgrammer(member, dt); continue; }
      if (member.role === 'sales') { member.state = this.quotes.length ? 'work' : 'idle'; continue; }
      if (member.state === 'walk') {
        member.walkRemaining = Math.max(0, member.walkRemaining - dt);
        if (member.walkRemaining > 0) continue;
        member.at = member.to; member.to = null; member.state = 'act';
      }
      if (member.state === 'service') {
        const step = member.task?.steps[member.task.step], station = step && this.stations[step.station];
        if (!station || station.service?.by !== member.id) this.staffDone(member);
        continue;
      }
      if (member.state === 'act' || member.state === 'wait') { this.staffAct(member, dt); continue; }
      member.think -= dt;
      if (member.think > 0) continue;
      member.think = .3;
      const task = this.planTask(member);
      if (task) { member.task = task; this.staffGo(member); }
    }
  }

  tickProgrammer(member, dt) {
    const current = member.orderId ? this.order(member.orderId) : null;
    if (!current || current.programmed) {
      member.orderId = null;
      const taken = new Set([this.office.orderId, ...this.staff.filter(other => other !== member && other.orderId).map(other => other.orderId)]);
      const takenContracts = new Set([...taken].map(id => this.order(id)?.contractId).filter(Boolean));
      const next = this.cadQueue(taken).find(order => !order.contractId || !takenContracts.has(order.contractId));
      member.state = next ? 'work' : 'idle';
      if (!next) return;
      member.orderId = next.id;
      this.emit('staffCad', {staffId:member.id, orderId:next.id});
    }
    this.programStep(this.order(member.orderId), dt, () => { member.orderId = null; member.state = 'idle'; });
  }

  staffGo(member) {
    const step = member.task.steps[member.task.step];
    if (member.at === step.station) { member.state = 'act'; return; }
    member.from = member.at;
    member.to = step.station;
    member.at = null;
    member.walkTotal = member.walkRemaining = Math.max(.4, this.distance(member.from, member.to) / STAFF[member.role].speed + .5);
    member.state = 'walk';
  }

  staffDone(member, success = true) {
    if (success && member.task && ++member.task.step < member.task.steps.length) return this.staffGo(member);
    member.task = null;
    member.state = 'idle';
    member.think = 0;
    member.waited = 0;
  }

  staffAct(member, dt) {
    const task = member.task;
    if (!task) return this.staffDone(member, false);
    const step = task.steps[task.step];
    const station = this.stations[step.station];
    const carried = member.carry ? this.order(member.carry) : null;
    if (step.action === 'repair' || step.action === 'maint') {
      const ok = station && !station.service && (step.action === 'repair' ? station.down : !station.down && !station.part && station.wear >= SERVICE_FROM);
      if (!ok || !this.startService(step.station, step.action, member.id)) return this.staffDone(member, false);
      member.state = 'service';
      return;
    }
    if (step.action === 'pickup') {
      const order = this.order(task.orderId);
      if (!order || order.started || !order.programmed || (!order.materialPaid && this.cash < order.material)) return this.staffDone(member, false);
      if (!order.materialPaid) this.payMaterial(order);
      order.started = true;
      order.location = member.id;
      member.carry = order.id;
      this.emit('pickup', {station:step.station, orderId:order.id, staffId:member.id});
      return this.staffDone(member);
    }
    if (step.action === 'collect') {
      if (!station?.ready || station.down || station.part?.orderId !== task.orderId || member.carry) return this.staffDone(member, false);
      member.carry = task.orderId;
      this.clearStation(step.station);
      this.order(task.orderId).location = member.id;
      this.emit('pickup', {station:step.station, orderId:task.orderId, staffId:member.id});
      return this.staffDone(member);
    }
    if (step.action === 'unpark') {
      if (member.carry || this.buffer?.orderId !== task.orderId) return this.staffDone(member, false);
      this.buffer = null;
      member.carry = task.orderId;
      this.order(task.orderId).location = member.id;
      this.emit('pickup', {station:'buffer', orderId:task.orderId, staffId:member.id});
      return this.staffDone(member);
    }
    if (step.action === 'receive') {
      if (member.carry || !this.receivingQueue.includes(task.orderId)) return this.staffDone(member, false);
      this.receivingQueue = this.receivingQueue.filter(id => id !== task.orderId);
      this.syncReceiving();
      member.carry = task.orderId;
      this.order(task.orderId).location = member.id;
      this.emit('pickup', {station:'receiving', orderId:task.orderId, staffId:member.id});
      return this.staffDone(member);
    }
    if (!carried) { member.carry = null; return this.staffDone(member, false); }
    if (step.action === 'ship') {
      if (carried.route[carried.index] !== 'ship') return this.staffDone(member, false);
      member.carry = null;
      this.shipOrder(carried, member);
      return this.staffDone(member);
    }
    if (step.action === 'park') {
      if (this.buffer) { member.state = 'wait'; member.waited += dt; return; }
      this.buffer = {orderId:carried.id};
      carried.location = 'buffer';
      member.carry = null;
      this.emit('park', {station:'buffer', staffId:member.id});
      return this.staffDone(member);
    }
    if (step.action === 'load') {
      const op = carried.route[carried.index];
      if (!station || station.op !== op || !this.installed(step.station)) return this.staffDone(member, false);
      const blocked = station.down || station.service || (station.part && !station.ready);
      if (blocked) {
        // Another machine of the same kind may be free by now.
        const other = this.freeStation(op, this.reservedStations(member), step.station);
        if (other) { step.station = other; return this.staffGo(member); }
        member.state = 'wait'; member.waited += dt; return;
      }
      const completed = station.part;
      this.loadStation(step.station, carried);
      member.carry = completed ? completed.orderId : null;
      if (completed) this.order(completed.orderId).location = member.id;
      this.emit('load', {station:step.station, orderId:carried.id, collectedOrderId:completed?.orderId, staffId:member.id});
      return this.staffDone(member);
    }
    this.staffDone(member, false);
  }

  planTask(member) {
    if (member.role === 'technician') return this.planMaintenance(member);
    if (member.role === 'clerk') return this.planClerk(member);
    if (member.role === 'runner') return this.planRunner(member);
    return null;
  }
  floorTask(orderId, steps) { return {orderId, step:0, steps}; }
  // The Hold bench frees a pair of hands. staffAct waits there if it is already full.
  parkTask(orderId) { return this.floorTask(orderId, [{station:'buffer', action:'park'}]); }
  floorContext(member) {
    const here = member.at ?? 'receiving';
    const carried = member.carry ? this.order(member.carry) : null;
    if (member.carry && !carried) member.carry = null;
    const orders = this.reservedOrders(member);
    const byDue = (a, b) => this.byPriority(a, b);
    const ready = Object.entries(this.stations)
      .filter(([, station]) => station.ready && station.part && !station.down && !orders.has(station.part.orderId))
      .map(([key, station]) => ({key, order:this.order(station.part.orderId)}))
      .filter(({order}) => order)
      .sort((a, b) => byDue(a.order, b.order));
    const parked = this.buffer ? this.order(this.buffer.orderId) : null;
    return {here, carried, loads:this.reservedStations(member), orders, byDue, ready, parked};
  }
  planMaintenance(member) {
    const here = member.at ?? 'receiving';
    const reserved = this.reservedStations(member, ['repair', 'maint']), near = key => this.distance(here, key);
    const down = Object.keys(this.stations).filter(key => this.stations[key].down && !this.stations[key].service && !reserved.has(key)).sort((a, b) => near(a) - near(b))[0];
    if (down) return this.floorTask(null, [{station:down, action:'repair'}]);
    const worn = Object.keys(this.stations).filter(key => {
      const station = this.stations[key];
      return this.installed(key) && !station.down && !station.service && !station.part && station.wear >= TECH_SERVICE_AT && !reserved.has(key);
    }).sort((a, b) => this.stations[b].wear - this.stations[a].wear)[0];
    return worn ? this.floorTask(null, [{station:worn, action:'maint'}]) : null;
  }
  // Stock, then the next machine on the route. A finished part goes on the Hold bench.
  planRunner(member) {
    const {here, carried, loads, orders, byDue, ready, parked} = this.floorContext(member);
    if (carried) {
      const next = carried.route[carried.index];
      if (next === 'ship') return this.parkTask(carried.id);
      const target = this.freeStation(next, loads, here) ?? this.stationsFor(next).sort((a, b) => this.distance(here, a) - this.distance(here, b))[0];
      return target ? this.floorTask(carried.id, [{station:target, action:'load'}]) : this.parkTask(carried.id);
    }
    for (const {key, order} of ready) {
      const next = order.route[order.index];
      if (next === 'ship') continue;
      const target = this.freeStation(next, loads, key);
      if (target) return this.floorTask(order.id, [{station:key, action:'collect'}, {station:target, action:'load'}]);
    }
    if (parked && !orders.has(parked.id) && parked.started && parked.route[parked.index] !== 'ship') {
      const target = this.freeStation(parked.route[parked.index], loads, 'buffer');
      if (target) return this.floorTask(parked.id, [{station:'buffer', action:'unpark'}, {station:target, action:'load'}]);
    }
    for (const order of this.orders.filter(order => !order.outsourced && !order.started && order.programmed && !orders.has(order.id) &&
      (order.materialPaid || this.cash >= order.material)).sort(byDue)) {
      const bin = `material-${stockType(order)}`, target = this.freeStation(order.route[0], loads, bin);
      if (target) return this.floorTask(order.id, [{station:bin, action:'pickup'}, {station:target, action:'load'}]);
    }
    return null;
  }
  // Inspected parts out the door, and Covari crates onto QC.
  planClerk(member) {
    const {carried, loads, orders, ready, parked} = this.floorContext(member);
    if (carried) {
      if (carried.route[carried.index] === 'ship') return this.floorTask(carried.id, [{station:'ship', action:'ship'}]);
      return this.parkTask(carried.id);
    }
    for (const {key, order} of ready) {
      if (order.route[order.index] === 'ship') return this.floorTask(order.id, [{station:key, action:'collect'}, {station:'ship', action:'ship'}]);
    }
    if (parked && !orders.has(parked.id) && parked.started && parked.route[parked.index] === 'ship')
      return this.floorTask(parked.id, [{station:'buffer', action:'unpark'}, {station:'ship', action:'ship'}]);
    const crate = this.receivingQueue.filter(id => !orders.has(id) && this.order(id)).sort((a, b) => (this.order(b).expedited ? 1 : 0) - (this.order(a).expedited ? 1 : 0))[0];
    const qc = crate && this.freeStation('inspect', loads, 'receiving');
    if (qc) return this.floorTask(crate, [{station:'receiving', action:'receive'}, {station:qc, action:'load'}]);
    return null;
  }

  snapshot() {
    return {
      ...super.snapshot(), manager:true, length:this.length, seed:this.seed, day:this.day, daysCompleted:this.daysCompleted,
      totalElapsed:this.totalElapsed, cash:this.cash, reputation:this.reputation, netWorth:this.netWorth(), orderLimit:this.orderLimit,
      boardLoad:this.boardLoad(), expanded:this.expanded, wingPending:this.wingPending, halls:[...this.halls], hallsPending:[...this.hallsPending], policy:{...this.policy},
      delays:this.delays, delaysRefused:this.delaysRefused, moves:this.moves,
      quotes:this.quotes.map(quote => ({...quote, route:[...quote.route]})), contracts:this.contracts.map(contract => ({...contract, route:[...contract.route]})),
      customers:this.customers.map(customer => ({...customer})), upgrades:[...this.upgrades], installing:{...this.installing},
      staff:this.staff.map(member => ({...member, task:member.task ? {...member.task, steps:member.task.steps.map(step => ({...step}))} : null})),
      receivingQueue:[...this.receivingQueue], ledger:{...this.ledger}, totals:{...this.totals}, history:this.history.map(day => ({...day})),
      accepted:this.accepted, declined:this.declined, lapsed:this.lapsed, lost:this.lost, bidsLost:this.bidsLost, cancelled:this.cancelled,
      breakdowns:this.breakdowns, contractsDone:this.contractsDone, contractsFailed:this.contractsFailed,
    };
  }
}
