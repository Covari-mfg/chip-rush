// Open for Business economy simulation. Deterministic, not a browser playtest
// and not player data. A scripted owner walks the production collision paths
// (extracted from dist/main.js by balance.mjs) at walking speed, works through
// the same ManagerGame actions as the UI, and follows one buying policy.
// Usage: node qa/manager-balance.mjs [--seeds=8] [--days=5] [--trace]
import { navigation } from './balance.mjs';
import { ManagerGame, MACHINES, UPGRADES, WING, BAYS, STAFF, HALLS } from '../dist/manager.js';
import { stockType } from '../dist/core.js';

const WALK = 4.4, DT = .05;
// Routes follow the floor the shop actually has: the original room, the wing, then any south halls.
const lengths = new Map();
let activeMap = null;
export function routeLength(a, b, map = 'owner-shop', halls = []) {
  if (a === b) return 0;
  const floor = halls.length ? `${map}+${halls.join('+')}` : map, key = `${floor}:${a}>${b}`;
  if (!lengths.has(key)) {
    if (activeMap !== floor) { navigation.setHalls(halls); navigation.activate(map); activeMap = floor; }
    const accesses = navigation.accessesFor(map), from = accesses[a], to = accesses[b];
    const points = [from, ...navigation.route(from, to)];
    let length = 0;
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    lengths.set(key, Math.max(length, Math.hypot(to.x - from.x, to.z - from.z)));
  }
  return lengths.get(key);
}

// Buying policies are evening shopping lists, tried in order while the shop
// keeps a cushion for the next day's bills. Entries: 'bay-N:op', 'hire:role',
// 'up:key', 'wing', 'hall:id'.
const CORE = ['bay-1:deburr','bay-2:anodize','bay-4:laser','bay-3:heat'];
export const POLICIES = {
  'solo, never buys':{buy:[]},
  'machines only':{buy:[...CORE,'up:spindles']},
  'machines + staff':{buy:['bay-1:deburr','hire:programmer','bay-2:anodize','hire:runner','bay-4:laser','bay-3:heat','hire:technician','hire:clerk','up:spindles','hire:runner']},
  'full manager':{buy:['bay-1:deburr','hire:programmer','bay-2:anodize','hire:runner','bay-4:laser','bay-3:heat','hire:technician','hire:clerk','hire:sales','up:spindles','hire:runner','wing','bay-5:lathe','bay-6:mill','hire:runner','bay-7:inspect','hire:programmer','hire:runner','up:board','hire:technician'],
    markup:.1, gaps:'covari'},
  'never services':{buy:['bay-1:deburr','hire:programmer','bay-2:anodize','hire:runner','bay-4:laser','bay-3:heat','hire:clerk','up:spindles','hire:runner'],noService:true},
  // Everything above, then the first two south halls with a second turning and milling line.
  'south halls':{buy:['bay-1:deburr','hire:programmer','bay-2:anodize','hire:runner','bay-4:laser','bay-3:heat','hire:technician','hire:clerk','hire:sales','up:spindles','hire:runner','wing','bay-5:lathe','bay-6:mill','hire:runner','bay-7:inspect','hire:programmer','hire:runner','up:board','hire:technician',
    'hall:hall-a','bay-11:lathe','bay-12:mill','hire:runner','bay-13:heat','bay-14:anodize','hall:hall-b','bay-19:lathe','bay-20:mill','hire:runner','hire:clerk','bay-21:inspect','hire:technician'],
    markup:.1, gaps:'covari'},
  'accepts everything':{buy:['bay-1:deburr','bay-2:anodize'],reckless:true},
  'no Covari':{buy:[...CORE,'up:spindles'],covari:false},
};

function cushion(game) { return game.rentTomorrow() + game.wages() + 250; }
function shop(game, policy) {
  const counts = {};
  for (const item of policy.buy) {
    if (item.startsWith('hire:')) {
      const role = item.slice(5), info = STAFF[role];
      counts[role] = (counts[role] ?? 0) + 1;
      if (game.staff.filter(member => member.role === role).length >= counts[role]) continue;
      if (game.staff.filter(member => member.role === role).length >= game.staffMax(role)) return;
      if (game.cash - info.wage * 2 < cushion(game) + info.wage) return;
      game.hire(role);
    } else if (item.startsWith('up:')) {
      const key = item.slice(3);
      if (game.upgrades.has(key)) continue;
      if (game.cash - UPGRADES[key].cost < cushion(game)) return;
      game.purchase(key);
    } else if (item.startsWith('hall:')) {
      const id = item.slice(5);
      if (game.hallOwned(id)) continue;
      if (!game.hallBuyable(id) || game.cash - HALLS.find(hall => hall.id === id).cost < cushion(game) * 1.6) return;
      game.buildHall(id);
    } else if (item === 'wing') {
      if (game.expanded || game.wingPending) continue;
      if (game.cash - WING.cost < cushion(game) * 1.6) return;
      game.buildWing();
    } else {
      const [bay, op] = item.split(':');
      if (game.stations[bay]) continue;
      if (!game.bayOpen(BAYS.find(candidate => candidate.id === bay))) return;
      if (game.cash - MACHINES[op].cost < cushion(game)) return;
      game.buyMachine(bay, op);
    }
  }
}

export function simulate({seed = 1, length = 5, policy = POLICIES['machines + staff'], reaction = .6, trace = false} = {}) {
  const game = new ManagerGame();
  game.distance = (a, b) => routeLength(a, b, game.expanded ? 'owner-wing' : 'owner-shop', game.halls);
  game.start({length, seed});
  const routeLen = (a, b) => game.distance(a, b);
  if (policy.markup) game.setPolicy('markup', policy.markup);
  if (policy.gaps) game.setPolicy('gaps', policy.gaps);
  if (policy.reserve) game.setPolicy('reserve', policy.reserve);
  let at = 'ship', busy = 0, target = null;
  const log = [];
  const act = key => { game.setOfficePresence(key === 'office'); const ok = game.interact(key); if (trace) log.push(`${game.day}:${game.elapsed.toFixed(1)} ${key} ${ok}`); return ok; };
  const go = key => { target = key; busy = routeLen(at, key) / WALK; at = key; };
  const nearestFree = op => game.stationsFor(op).filter(key => game.usable(key) && !game.stations[key].part).sort((a, b) => routeLen(at, a) - routeLen(at, b))[0];
  const choose = () => {
    const held = game.heldOrder;
    if (held) {
      const next = held.route[held.index];
      if (next === 'ship') return 'ship';
      if (game.hasMachine(next)) return nearestFree(next) ?? game.stationsFor(next)[0];
      return game.buffer ? null : 'buffer';
    }
    const down = Object.keys(game.stations).find(key => game.stations[key].down && !game.stations[key].service);
    if (down && !policy.noService && !game.hasStaff('technician')) return down;
    const reserved = game.reservedOrders();
    const ready = Object.entries(game.stations).filter(([, s]) => s.ready && !s.down).map(([key, s]) => ({key, order:game.order(s.part.orderId)}))
      .filter(({order}) => order && !reserved.has(order.id)).sort((a, b) => a.order.remaining - b.order.remaining)[0];
    if (ready) return ready.key;
    if (down && policy.noService && !game.hasStaff('technician')) return down; // a breakdown still has to be fixed by someone
    if (game.receiving) return 'receiving';
    if (game.buffer) return 'buffer';
    const cad = !game.hasStaff('programmer') && game.nextCAD();
    if (cad) return 'office';
    const stock = ['round','plate','block'].map(type => game.nextMaterial(type))
      .filter(order => order && nearestFree(order.route[0]) && !reserved.has(order.id))
      .sort((a, b) => a.remaining - b.remaining)[0];
    if (stock) return `material-${stockType(stock)}`;
    const worn = !policy.noService && !game.hasStaff('technician') && Object.keys(game.stations).find(key => game.usable(key) && !game.stations[key].part && game.stations[key].wear >= 50);
    if (worn) return worn;
    return null;
  };
  while (game.mode !== 'results') {
    if (game.mode === 'evening') { shop(game, policy); game.openDay(); continue; }
    if (!game.hasStaff('sales')) for (const quote of [...game.quotes]) {
      const gaps = game.gapsFor(quote.route);
      // A sensible owner only commits to what the team can work: two jobs alone, more with runners.
      const capacity = Math.min(game.orderLimit, 2 + game.staff.filter(m => m.role === 'runner').length * 1.5 + (game.hasStaff('programmer') ? .5 : 0));
      if (quote.type === 'contract' && (gaps.length || game.boardLoad() >= capacity - 1)) { game.declineQuote(quote.id); continue; }
      if (!gaps.length || policy.reckless) { if (game.boardLoad() < (policy.reckless ? game.orderLimit : capacity)) game.acceptQuote(quote.id); else game.declineQuote(quote.id); }
      else if (policy.covari === false || !game.outsourceQuote(quote.id)) game.declineQuote(quote.id);
    }
    if (busy <= 0) {
      if (target) {
        const station = game.stations[target];
        if (target === 'office') {
          if (game.office.orderId === null && !act('office')) target = null;
          else if (game.office.orderId === null) target = null;
        } else if (station?.service?.by === 'owner') { /* stay until the repair or service is done */ }
        else if (station && station.part && !station.ready && !station.down && game.hand) { /* wait for the machine */ }
        else { act(target); if (!game.stations[target]?.service) target = null; busy = reaction; }
      } else {
        const next = choose();
        if (next) go(next); else busy = .25;
      }
    }
    game.setOfficePresence(target === 'office' && busy <= 0);
    game.setPlayerStation(busy <= 0 ? target : null);
    game.tick(DT);
    busy -= DT;
    game.drain();
  }
  return {
    seed, length, reason:game.finishReason, days:game.daysCompleted, netWorth:game.score, shipped:game.shipped, sourced:game.sourced,
    missed:game.missed, declined:game.declined + game.lapsed, breakdowns:game.breakdowns, contracts:game.contractsDone, contractsFailed:game.contractsFailed,
    bidsLost:game.bidsLost, staff:game.staff.map(m => m.role), expanded:game.expanded, halls:game.halls.length, history:game.history, log,
  };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const arg = (name, fallback) => Number(process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
  const seeds = arg('seeds', 8), days = arg('days', 5);
  const only = process.argv.find(a => a.startsWith('--policy='))?.split('=')[1];
  console.log(`Open for Business simulation · ${days ? days + ' days' : 'Endless'} · seeds 1-${seeds} · not player data`);
  for (const [name, policy] of Object.entries(POLICIES)) {
    if (only && !name.includes(only)) continue;
    const runs = Array.from({length:seeds}, (_, i) => simulate({seed:i + 1, length:days, policy}));
    const worth = runs.map(r => r.netWorth).sort((a, b) => a - b), mean = list => Math.round(list.reduce((s, v) => s + v, 0) / list.length);
    console.log(`${name.padEnd(20)} net worth median $${worth[worth.length >> 1].toLocaleString().padStart(7)} (min $${worth[0].toLocaleString()}, max $${worth.at(-1).toLocaleString()}) · days ${mean(runs.map(r => r.days))} · bankrupt ${runs.filter(r => r.reason === 'bankrupt').length}/${seeds} · shipped ${mean(runs.map(r => r.shipped))} (Covari ${mean(runs.map(r => r.sourced))}) · expired ${mean(runs.map(r => r.missed))} · breakdowns ${mean(runs.map(r => r.breakdowns))} · contracts ${mean(runs.map(r => r.contracts))}/${mean(runs.map(r => r.contractsFailed))} · wing ${runs.filter(r => r.expanded).length} · halls ${mean(runs.map(r => r.halls))}`);
    if (process.argv.includes('--trace')) for (const day of runs[0].history) console.log('   ', JSON.stringify(day));
  }
}
