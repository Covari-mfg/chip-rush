// Open for Business: rules, floor, staff, bids, contracts, breakdowns, economy,
// server validation, boards and saves. Balance rows come from
// qa/manager-balance.mjs and are simulations, not player data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { SHIFTS, OPS, RULESET, ShopGame } from '../dist/core.js';
import {
  ManagerGame, MANAGER_ROLE, MANAGER_MODE, MANAGER_OPS, MACHINES, BAYS, UPGRADES, WING, STAFF, JOBS, CUSTOMERS, RUN_LENGTHS, DAY_SECONDS, START_CASH,
  QUOTE_WINDOW, MAX_QUOTES, QUOTE_CUTOFF, COVARI_SLOTS, COVARI_DELIVERY, INSTALL_SECONDS, RESALE, LATE_PENALTY, AD, MAX_DAYS, BIDS,
  covariPriceFor,
  SALES_DELAY, CONTRACT_BONUS, CONTRACT_PENALTY, BREAK_FROM, SERVICE_FROM, REPAIR, SERVICE, TECH_SERVICE_AT,
  rentFor, maxPayout, boardId, parseBoard, deadlineFor, opInfo, winChance, quoteInterval,
  START_ASSETS, HALLS, HALL_BAYS, HALL_RENT, REVIEW_LEVELS, COVARI_BELOW, DELAY_RISK, hallAdjacent,
} from '../dist/manager.js';
import { parseChallenge, challengeURL } from '../dist/social.js';
import worker, { validateManagerResult, validateResult } from '../server/worker.js';
import { simulate, POLICIES, routeLength } from './manager-balance.mjs';
import { navigation } from './balance.mjs';

const START = 1_800_000_000_000;
function advance(game, seconds) { for (let left = seconds; left > 1e-8 && game.mode === 'playing'; left -= .05) game.tick(Math.min(.05, left)); }
function fresh({length = 5, seed = 7} = {}) {
  const game = new ManagerGame();
  game.start({length, seed});
  game.nextQuoteAt = Infinity;
  game.drain();
  return game;
}
// A quote for a chosen job, priced exactly as the game prices its own.
function quoteFor(game, jobId, {contract = false, customer = 0, markup = 0} = {}) {
  const job = JOBS.find(candidate => candidate.id === jobId);
  const basePrice = Math.round(job.price * (job.tight ? 1.15 : 1) / 10) * 10;
  const quote = {id:game.nextId++, type:contract ? 'contract' : 'job', customer, jobId, name:job.name, kind:job.kind, color:job.color, tight:Boolean(job.tight),
    technology:null, route:[...job.route, 'ship'], basePrice, markup, deadline:contract ? Math.round(game.time + DAY_SECONDS) : deadlineFor(job),
    quoteRemaining:QUOTE_WINDOW, age:0, material:30, covariCost:covariPriceFor(job.route)};
  if (contract) { quote.units = 3; quote.unitBase = Math.round(basePrice * (1 + CONTRACT_BONUS) / 10) * 10; }
  game.priceQuote(quote);
  game.quotes.push(quote);
  return quote;
}
const evening = (game, fn) => { const mode = game.mode; game.mode = 'evening'; try { return fn(); } finally { game.mode = mode; } };
function cad(game, id) {
  game.setOfficePresence(true);
  while (!game.order(id).programmed) { assert.equal(game.interact('office'), true); advance(game, game.order(id).programRemaining + .05); }
  game.setOfficePresence(false);
}
const bin = order => `material-${{shaft:'round', plate:'plate', bracket:'plate', block:'block'}[order.kind]}`;
function runOn(game, key) {
  assert.equal(game.interact(key), true, `load ${key}`);
  advance(game, game.stations[key].remaining + .05);
  assert.equal(game.interact(key), true, `collect ${key}`);
}

// Every part is in exactly one place, and its order agrees with that place.
function assertIntegrity(game) {
  const places = new Map();
  const put = (id, where) => { assert.ok(!places.has(id), `#${id} is in ${places.get(id)} and ${where}`); places.set(id, where); };
  if (game.hand) put(game.hand.orderId, 'hands');
  if (game.buffer) put(game.buffer.orderId, 'buffer');
  for (const [key, station] of Object.entries(game.stations)) if (station.part) put(station.part.orderId, key);
  for (const member of game.staff) if (member.carry) put(member.carry, member.id);
  for (const id of game.receivingQueue) put(id, 'receiving');
  for (const order of game.orders) {
    const where = places.get(order.id);
    if (order.location === 'material') { assert.equal(order.started, false); assert.equal(where, undefined); continue; }
    if (order.location === 'supplier') { assert.equal(order.outsourced, true); assert.equal(where, undefined); continue; }
    assert.equal(where, order.location, `#${order.id} says ${order.location}`);
  }
  for (const id of places.keys()) assert.ok(game.order(id), `#${id} still exists`);
  for (const contract of game.contracts) {
    const units = game.orders.filter(order => order.contractId === contract.id).length;
    assert.equal(units + contract.shipped + contract.failed, contract.units, `contract #${contract.id} accounts for every part`);
  }
  for (const [key, station] of Object.entries(game.stations)) {
    assert.ok(station.wear >= 0 && station.wear <= 100);
    if (station.service?.by === 'owner') assert.equal(game.service?.station, key);
    if (key.startsWith('bay-')) assert.ok(MACHINES[station.op].sizes.includes(BAYS.find(bay => bay.id === key).size), `${station.op} fits ${key}`);
  }
  assert.ok(game.quotes.length <= MAX_QUOTES);
  assert.ok(game.covariOrders().length <= COVARI_SLOTS);
  assert.ok(game.reputation >= 1 && game.reputation <= 5);
  for (const customer of game.customers) assert.ok(customer.loyalty >= 0 && customer.loyalty <= 3);
}

test('Open for Business is a separate mode outside the shift catalog', () => {
  const level = MANAGER_MODE;
  assert.equal(SHIFTS.length, 4, 'The released shift list is unchanged');
  assert.ok(!SHIFTS.some(shift => shift.id === level.id || shift.mode), 'The mode is not a level');
  assert.ok(MANAGER_ROLE < 0, 'Its server role can never collide with a level index');
  assert.equal(new ManagerGame().start().shiftIndex, MANAGER_ROLE);
  assert.equal(level.id, 'open-for-business');
  assert.equal(level.mode, 'manager');
  assert.equal(level.mapId, 'owner-shop');
  assert.deepEqual([level.author, level.harness], ['Claude Opus 5.5', 'Claude Code']);
  assert.equal(RULESET, 'roles-v8-optional-calls', 'Shift ruleset and boards are untouched');
  for (const map of ['owner-shop', 'owner-wing']) assert.ok(navigation.maps[map], `${map} is registered`);
  for (const key of Object.keys(MANAGER_OPS)) assert.equal(OPS[key], undefined, `${key} stays out of the shift catalog`);
  assert.deepEqual(Object.keys(new ShopGame().stations), ['lathe', 'mill', 'deburr', 'anodize', 'inspect'], 'Shift snapshots keep their station set');
});

test('a run starts with a lathe, a mill and QC, empty bays and no staff', () => {
  const game = new ManagerGame().start({length:5, seed:1});
  assert.equal(game.mode, 'playing');
  assert.equal(game.cash, START_CASH);
  assert.deepEqual(Object.keys(game.stations), ['lathe', 'mill', 'inspect']);
  for (const key of Object.keys(game.stations)) assert.equal(game.stations[key].op, key);
  assert.equal(game.staff.length, 0);
  assert.equal(game.orders.length, 0, 'No classic order is spawned');
  assert.equal(game.expanded, false);
  assert.equal(game.config.mapId, 'owner-shop');
  for (const op of ['deburr', 'anodize', 'heat', 'laser']) assert.equal(game.hasMachine(op), false);
  assert.equal(new ManagerGame().start({length:4}).length, 5, 'Unknown lengths fall back to five days');
});

test('quotes arrive on a seeded schedule, cap at three, lapse, and stop near closing', () => {
  const a = new ManagerGame().start({seed:99}), b = new ManagerGame().start({seed:99});
  advance(a, 60); advance(b, 60);
  assert.deepEqual(a.drain().filter(e => e.type === 'quote').map(e => e.orderId), b.drain().filter(e => e.type === 'quote').map(e => e.orderId));
  assert.ok(a.quotesSeen >= 3);
  assert.ok(a.quotes.length <= MAX_QUOTES);
  assert.equal(a.lapsed + a.lost + a.quotes.length, a.quotesSeen, 'Every quote is pending, lapsed or lost');
  const c = new ManagerGame().start({seed:3});
  advance(c, 3.1);
  assert.equal(c.quotes.length, 1, 'The first quote arrives three seconds in');
  assert.ok(c.quotes[0].customer >= 0 && c.quotes[0].customer < CUSTOMERS.length);
  advance(c, QUOTE_WINDOW + .2);
  assert.ok(!c.quotes.some(q => q.id === 101), 'Unanswered quotes lapse');
  const late = new ManagerGame().start({seed:3});
  late.nextQuoteAt = 0; late.time = QUOTE_CUTOFF - 1; late.elapsed = DAY_SECONDS - QUOTE_CUTOFF + 1;
  late.tick(.05);
  assert.equal(late.quotes.length, 0, 'No new quotes in the last twenty seconds');
  assert.ok(quoteInterval(5, 3, true) < quoteInterval(5, 3, false), 'The wing draws more customers');
});

test('jobs grow more complex: repeated machines, longer chains and tight tolerances', () => {
  const day1 = new ManagerGame().start({seed:5});
  for (let i = 0; i < 300; i++) { const quote = day1.makeQuote(); assert.ok(JOBS.find(job => job.id === quote.jobId).day <= 1, quote.name); }
  assert.ok(JOBS.some(job => new Set(job.route).size < job.route.length), 'Some routes revisit a machine');
  assert.ok(JOBS.some(job => job.route.length >= 5), 'Some routes chain five steps');
  assert.ok(JOBS.some(job => job.tight), 'Some jobs need tight-tolerance QC');
  for (const job of JOBS) {
    for (const key of job.route) assert.ok(opInfo(key), `${job.id}: ${key} is a known process`);
    assert.equal(job.route.at(-1), 'inspect');
    assert.ok(deadlineFor(job) > 60 && deadlineFor(job) < 260, `${job.id} deadline ${deadlineFor(job)}`);
  }
  const late = new ManagerGame().start({seed:5});late.day = 9;
  const complex = Array.from({length:400}, () => late.makeQuote()).filter(q => JOBS.find(job => job.id === q.jobId).route.length >= 5).length;
  const early = new ManagerGame().start({seed:5});early.day = 5;
  const fewer = Array.from({length:400}, () => early.makeQuote()).filter(q => JOBS.find(job => job.id === q.jobId).route.length >= 5).length;
  assert.ok(complex > fewer, `complex jobs grow more common (${fewer} → ${complex})`);
  for (const key of Object.keys(MANAGER_OPS).filter(key => MANAGER_OPS[key].external)) assert.equal(MACHINES[key], undefined, `${key} can never be bought`);
  const game = fresh(), shaft = quoteFor(game, 'shaft');
  game.acceptQuote(shaft.id); cad(game, shaft.id);
  game.interact('material-round'); runOn(game, 'lathe');
  game.cash += 5000;
  assert.equal(evening(game, () => game.buyMachine('bay-3', 'heat')), true);
  runOn(game, 'bay-3'); runOn(game, 'lathe');
  game.interact('inspect');
  assert.equal(game.stations.inspect.remaining, OPS.inspect.duration * 2, 'Tight tolerance doubles inspection');
});

test('bids trade price against the chance the customer says yes', () => {
  assert.equal(winChance(0, 3, 0), 1);
  assert.equal(winChance(-.1, 3, 0), 1);
  assert.ok(winChance(.1, 3, 1) < 1 && winChance(.3, 3, 1) < winChance(.1, 3, 1));
  assert.ok(winChance(.2, 5, 3) > winChance(.2, 1, 0), 'Reputation and loyalty make a high bid likelier');
  const game = fresh(), q = quoteFor(game, 'spacer');
  const list = q.price;
  assert.equal(game.bidQuote(q.id, -1), true);
  assert.equal(game.bidQuote(q.id, -1), false, 'A bid cannot go below −10%');
  assert.equal(q.price, Math.round(q.basePrice * .9 / 10) * 10);
  for (let i = 0; i < BIDS.length + 1; i++) game.bidQuote(q.id, 1);
  assert.equal(q.markup, BIDS.at(-1));
  assert.equal(BIDS.at(-1), .5, 'Bids reach +50%');
  assert.equal(q.price, Math.round(q.basePrice * 1.5 / 10) * 10);
  assert.ok(q.price > list && q.chance < 1);
  game.rng = () => .999;
  assert.equal(game.acceptQuote(q.id), true);
  assert.equal(game.orders.length, 0, 'A losing bid wins nothing');
  assert.equal(game.bidsLost, 1);
  assert.ok(game.drain().some(e => e.type === 'bidLost'));
  const won = quoteFor(game, 'spacer', {markup:.2});
  game.rng = () => 0;
  assert.equal(game.acceptQuote(won.id), true);
  assert.equal(game.orders[0].price, won.price, 'A winning bid sets the price paid on shipping');
});

test('a full in-house job pays its bid, tips early delivery and wins the customer over', () => {
  const game = fresh(), quote = quoteFor(game, 'housing', {customer:2});
  const loyalty = game.customers[2].loyalty;
  game.acceptQuote(quote.id); cad(game, quote.id);
  const order = game.order(quote.id);
  assert.equal(game.interact(bin(order)), true);
  assert.equal(game.cash, START_CASH - quote.material);
  for (const key of ['lathe', 'mill', 'inspect']) runOn(game, key);
  assert.equal(game.interact('ship'), true);
  const shipped = game.drain().find(e => e.type === 'shipped');
  assert.equal(shipped.tip, Math.round(quote.price * .1 / 10) * 10);
  assert.equal(game.cash, START_CASH - quote.material + quote.price + shipped.tip);
  assert.ok(Math.abs(game.reputation - 3.1) < 1e-9);
  assert.ok(game.customers[2].loyalty > loyalty, 'Loyalty grows with every delivery');
});

test('stock is paid once, recycling is free, and an empty till blocks pickup', () => {
  const game = fresh(), quote = quoteFor(game, 'spacer');
  game.acceptQuote(quote.id); cad(game, quote.id);
  game.interact('material-round');
  assert.equal(game.interact('material-round'), true, 'Recycle');
  assert.equal(game.interact('material-round'), true, 'Pick up again');
  assert.equal(game.ledger.materials, quote.material);
  const broke = fresh(), q2 = quoteFor(broke, 'spacer');
  broke.acceptQuote(q2.id); cad(broke, q2.id);
  broke.cash = 10;
  assert.equal(broke.interact('material-round'), false);
  assert.match(broke.drain().at(-1).message, /costs \$30/);
});

test('accepting work the floor cannot make expires with a fee, a reputation hit and a lost customer', () => {
  const game = fresh(), quote = quoteFor(game, 'knob', {customer:1});
  assert.deepEqual(game.gapsFor(quote.route), ['deburr']);
  assert.equal(game.acceptQuote(quote.id), true, 'The player is allowed to make the mistake');
  cad(game, quote.id);
  game.interact('material-round'); runOn(game, 'lathe');
  assert.equal(game.interact('bay-1'), false);
  assert.match(game.drain().at(-1).message, /bay is empty/);
  advance(game, game.order(quote.id).remaining + .1);
  assert.equal(game.order(quote.id), undefined);
  assert.equal(game.hand, null);
  assert.equal(game.ledger.penalties, Math.round(quote.price * LATE_PENALTY / 10) * 10);
  assert.ok(Math.abs(game.reputation - 2.2) < 1e-9);
  assert.equal(game.customers[1].loyalty, 0);
});

test('Covari takes only real capability gaps, is paid up front and ships through QC', () => {
  const game = fresh();
  assert.equal(game.outsourceQuote(quoteFor(game, 'panel').id), false, 'Not a partner yet');
  assert.equal(game.partnerCovari(), true);
  assert.equal(game.policy.gaps, 'covari');
  assert.equal(game.outsourceQuote(quoteFor(game, 'spacer').id), false);
  const panel = quoteFor(game, 'panel');
  assert.equal(game.outsourceQuote(panel.id), true);
  assert.equal(game.order(panel.id).price, game.covariCharge(panel));
  const order = game.order(panel.id);
  assert.deepEqual(order.route, ['inspect', 'ship']);
  assert.equal(game.cash, START_CASH - panel.covariCost);
  assert.equal(game.boardLoad(), 0, 'Covari work does not use the order board');
  advance(game, COVARI_DELIVERY + .05);
  assert.equal(game.interact('receiving'), true);
  runOn(game, 'inspect');
  assert.equal(game.interact('ship'), true);
  assert.equal(game.cash, START_CASH - panel.covariCost + panel.price, 'Full price, no early tip');
  const busy = fresh();busy.partnerCovari();const many = [quoteFor(busy, 'panel'), quoteFor(busy, 'cover'), quoteFor(busy, 'panel')];
  assert.equal(busy.outsourceQuote(many[0].id), true);
  assert.equal(busy.outsourceQuote(many[1].id), true);
  assert.equal(busy.outsourceQuote(many[2].id), false);
  const deal = fresh();deal.partnerCovari();const contract = quoteFor(deal, 'panel', {contract:true});
  assert.equal(deal.outsourceQuote(contract.id), false, 'Covari does not take whole contracts');
});

test('machines go into bays that fit them; duplicates add capacity; selling frees the bay', () => {
  const game = fresh();game.cash = 30000;
  assert.equal(game.buyMachine('bay-3', 'anodize'), false, 'An anodize bath does not fit a small bay');
  assert.equal(game.buyMachine('bay-1', 'lathe'), false, 'A lathe needs a large bay');
  assert.equal(game.buyMachine('bay-5', 'lathe'), false, 'Wing bays need the wing');
  assert.equal(game.buyMachine('bay-1', 'deburr'), true, 'Machines can be bought on the floor, mid-shift');
  assert.equal(game.buyMachine('bay-1', 'heat'), false, 'One machine per bay');
  assert.equal(game.hasMachine('deburr'), false, 'Installing');
  advance(game, INSTALL_SECONDS + .05);
  assert.equal(game.hasMachine('deburr'), true);
  assert.equal(game.buyMachine('bay-2', 'deburr'), true, 'A second deburr station');
  advance(game, INSTALL_SECONDS + .05);
  assert.deepEqual(game.stationsFor('deburr'), ['bay-1', 'bay-2']);
  const [a, b] = [quoteFor(game, 'knob'), quoteFor(game, 'knob')];
  game.acceptQuote(a.id); game.acceptQuote(b.id); cad(game, a.id); cad(game, b.id);
  game.interact('material-round'); runOn(game, 'lathe'); game.interact('bay-1');
  game.stations['bay-1'].remaining = 60; // keep the first station busy
  game.interact('material-round'); runOn(game, 'lathe');
  assert.equal(game.interact('bay-1'), false, 'The first station is busy');
  assert.equal(game.interact('bay-2'), true, 'The second takes the next part');
  const cash = game.cash;
  assert.equal(game.sellMachine('bay-2'), false, 'A working machine cannot be sold');
  advance(game, 30); game.interact('bay-2'); game.interact('bay-1');
  assert.equal(game.sellMachine('bay-2'), true);
  assert.equal(game.cash, cash + Math.round(MACHINES.deburr.cost * RESALE));
  assert.equal(game.stations['bay-2'], undefined);
  assert.equal(game.hasMachine('deburr'), true, 'The other deburr station remains');
  evening(game, () => { assert.equal(game.buyMachine('bay-2', 'anodize'), true); });
  assert.equal(game.hasMachine('anodize'), true, 'After hours, machines are ready by morning');
});

test('the east wing opens overnight, adds large bays and staff room, and raises rent', () => {
  const game = fresh();game.cash = 30000;
  assert.equal(game.staffMax('runner'), STAFF.runner.max);
  assert.equal(game.buildWing(), true);
  assert.equal(game.buildWing(), false, 'Ordered once');
  assert.equal(game.expanded, false, 'Builders work overnight');
  assert.equal(game.buyMachine('bay-5', 'lathe'), false);
  advance(game, DAY_SECONDS + .1);
  assert.equal(game.history[0].rent, rentFor(1), 'Tonight’s rent is unchanged');
  game.openDay();
  assert.equal(game.expanded, true);
  assert.equal(game.config.mapId, 'owner-wing');
  assert.ok(game.drain().some(e => e.type === 'wingOpened'));
  for (const op of ['lathe', 'mill', 'inspect']) assert.equal(game.buyMachine(BAYS.find(bay => bay.wing && bay.size === 'large' && !game.stations[bay.id]).id, op), true, `a second ${op}`);
  assert.equal(game.rentToday(), rentFor(2, true));
  assert.ok(rentFor(2, true) > rentFor(2));
  assert.equal(game.staffMax('runner'), STAFF.runner.maxWing);
  for (let i = 0; i < STAFF.runner.maxWing; i++) assert.equal(game.hire('runner'), true);
  assert.equal(game.hire('runner'), false);
  assert.equal(game.hire('programmer'), true); assert.equal(game.hire('programmer'), true);
  assert.deepEqual(game.staff.filter(m => m.role === 'programmer').map(m => m.seat), [0, 1], 'The second programmer sits at the wing’s CAD desk');
  assert.ok(game.assetValue() >= Math.round(WING.cost * WING.resale));
});

test('machines wear, slow down, break with a part inside, and the owner repairs them in person', () => {
  const game = fresh(), quote = quoteFor(game, 'spacer');
  game.acceptQuote(quote.id); cad(game, quote.id);
  game.stations.lathe.wear = 99;
  game.interact('material-round');
  game.interact('lathe');
  assert.ok(game.stations.lathe.remaining > OPS.lathe.duration * 1.35, 'A worn machine runs slower');
  game.rng = () => 0;
  advance(game, game.stations.lathe.remaining + .05);
  assert.equal(game.stations.lathe.down, true);
  assert.equal(game.breakdowns, 1);
  assert.ok(game.drain().some(e => e.type === 'breakdown' && e.orderId === quote.id));
  assert.equal(game.stations.lathe.ready, true, 'The finished part is stuck inside');
  assert.equal(game.interact('lathe'), true, 'Interacting starts the repair');
  advance(game, REPAIR.owner + 1);
  assert.equal(game.stations.lathe.down, true, 'Repairs need the owner at the machine');
  game.setPlayerStation('lathe');
  advance(game, REPAIR.owner + .1);
  assert.equal(game.stations.lathe.down, false);
  assert.equal(game.stations.lathe.wear, 25);
  assert.equal(game.interact('lathe'), true, 'The part can be collected after the repair');
  assert.equal(game.heldOrder.id, quote.id);
});

test('an idle worn machine can be serviced with empty hands', () => {
  const game = fresh();
  game.stations.mill.wear = SERVICE_FROM - 1;
  assert.equal(game.interact('mill'), false, 'A nearly new machine needs no service');
  game.stations.mill.wear = 60;
  game.setPlayerStation('mill');
  assert.equal(game.interact('mill'), true);
  assert.equal(game.interact('mill'), false, 'Already being serviced');
  advance(game, SERVICE.owner + .1);
  assert.equal(game.stations.mill.wear, 0);
  assert.ok(game.drain().some(e => e.type === 'serviced' && e.kind === 'maint'));
});

test('contracts: one board slot, one CAD program, paid per part, judged as a whole', () => {
  const game = fresh(), q = quoteFor(game, 'spacer', {contract:true, customer:3});
  assert.equal(q.price, q.unitPrice * q.units);
  assert.equal(game.acceptQuote(q.id), true);
  assert.equal(game.contracts.length, 1);
  assert.equal(game.orders.filter(o => o.contractId === q.id).length, 3);
  assert.equal(game.boardLoad(), 1, 'A contract takes one board slot');
  cad(game, game.orders[0].id);
  assert.ok(game.orders.every(o => o.programmed), 'One CAD program covers every part');
  for (let i = 0; i < 3; i++) { game.interact('material-round'); runOn(game, 'lathe'); runOn(game, 'inspect'); game.interact('ship'); }
  assert.equal(game.contracts.length, 0);
  assert.equal(game.contractsDone, 1);
  assert.ok(game.drain().some(e => e.type === 'contractDone'));
  assert.equal(game.ledger.tips, 0, 'Contract parts earn the contract price, not early tips');
  const broken = fresh(), bq = quoteFor(broken, 'spacer', {contract:true});
  broken.acceptQuote(bq.id);
  const rep = broken.reputation;
  advance(broken, DAY_SECONDS + .1);broken.openDay();advance(broken, DAY_SECONDS);
  assert.equal(broken.contractsFailed, 1);
  assert.equal(broken.contracts.length, 0);
  assert.ok(Math.abs(broken.reputation - (rep - .6)) < 1e-9, 'A broken contract costs reputation once');
  assert.equal(broken.totals.penalties, 3 * Math.round(bq.unitPrice * CONTRACT_PENALTY / 10) * 10);
  const last = fresh({length:3});last.day = 3;
  for (let i = 0; i < 300; i++) assert.notEqual(last.makeQuote().type, 'contract', 'No contracts on the last day of a fixed run');
  const early = fresh();
  for (let i = 0; i < 100; i++) assert.notEqual(early.makeQuote().type, 'contract', 'No contracts on day one');
});

test('a sales manager answers quotes with your rules', () => {
  const game = fresh();
  evening(game, () => game.hire('sales'));
  game.setPolicy('markup', .1);
  assert.equal(game.setPolicy('markup', .15), false);
  game.rng = () => 0;
  const ok = quoteFor(game, 'spacer', {markup:game.policy.markup}), gap = quoteFor(game, 'knob');
  advance(game, SALES_DELAY - .2);
  assert.equal(game.quotes.length, 2, 'The sales manager takes a few seconds');
  advance(game, .4);
  assert.equal(game.quotes.length, 0);
  assert.equal(game.order(ok.id)?.price, ok.price, 'Bid at the standing markup and won');
  assert.equal(game.order(gap.id), undefined, 'Missing process: turned away by default');
  assert.equal(game.partnerCovari(), true);
  const panel = quoteFor(game, 'panel');advance(game, SALES_DELAY + .1);
  assert.ok(game.order(panel.id)?.outsourced, 'Missing process: sent to Covari');
  game.setPolicy('reserve', 2);
  game.orderLimit = 3;
  const tooMany = quoteFor(game, 'spacer');advance(game, SALES_DELAY + .1);
  assert.equal(game.order(tooMany.id), undefined, 'Keeps the reserved slots free');
  game.setPolicy('reserve', 0);game.setPolicy('contracts', false);
  const contract = quoteFor(game, 'spacer', {contract:true});advance(game, SALES_DELAY + .1);
  assert.equal(game.contracts.length, 0, 'Contracts can be switched off');
  assert.equal(game.setPolicy('gaps', 'maybe'), false);
});

test('day end pays rent and wages, opens an evening, and the next day starts clean', () => {
  const game = fresh({length:5});
  advance(game, DAY_SECONDS - 10);
  game.acceptQuote(quoteFor(game, 'spacer').id);
  game.quotes.push(game.makeQuote());
  advance(game, 10.1);
  assert.equal(game.mode, 'evening');
  assert.equal(game.daysCompleted, 1);
  assert.equal(game.quotes.length, 0);
  assert.equal(game.orders.length, 1, 'Accepted work carries over');
  assert.equal(game.cash, START_CASH - rentFor(1));
  game.tick(1);
  assert.equal(game.time, 0, 'Nothing runs overnight');
  assert.equal(game.openDay(), true);
  assert.equal(game.day, 2);
  assert.equal(game.ledger.wages, 0);
  for (let day = 1; day < 30; day++) assert.ok(rentFor(day + 1) > rentFor(day));
});

test('after-hours purchases appear on the closed day’s ledger, and selling refunds it', () => {
  const game = fresh();
  advance(game, DAY_SECONDS + .1);
  const closed = game.history.at(-1);
  game.cash = 9000; closed.cash = 9000;
  assert.equal(game.buyMachine('bay-4', 'laser'), true);
  assert.equal(closed.purchases, MACHINES.laser.cost);
  assert.equal(game.sellMachine('bay-4'), true);
  assert.equal(closed.purchases, MACHINES.laser.cost - Math.round(MACHINES.laser.cost * RESALE));
  assert.equal(closed.cash, game.cash);
  game.openDay();
  assert.equal(game.ledger.purchases, 0);
});

test('fixed runs finish on their last day; bankruptcy ends early; Endless retires', () => {
  const game = fresh({length:3});
  for (let day = 1; day <= 3; day++) { advance(game, DAY_SECONDS + .1); if (day < 3) { assert.equal(game.retire(), false); game.openDay(); } }
  assert.equal(game.finishReason, 'complete');
  assert.equal(game.daysCompleted, 3);
  assert.equal(game.stars(), 1);
  const broke = fresh({length:0});broke.cash = rentFor(1) - 1;
  advance(broke, DAY_SECONDS + .1);
  assert.equal(broke.finishReason, 'bankrupt');
  assert.equal(broke.score, broke.cash + START_ASSETS, 'A bankrupt shop is worth its machines less its debt');
  const banked = fresh({length:0});banked.cash = 9000;banked.buyMachine('bay-4', 'laser');
  advance(banked, DAY_SECONDS + .1);
  assert.equal(banked.retire(), true);
  assert.equal(banked.score, banked.cash + START_ASSETS + Math.round(MACHINES.laser.cost * RESALE));
  const unfinished = fresh({length:3});unfinished.day = 3;
  advance(unfinished, DAY_SECONDS - 10);
  const q = quoteFor(unfinished, 'spacer');unfinished.acceptQuote(q.id);
  advance(unfinished, 10.1);
  assert.equal(unfinished.cancelled, 1, 'Unfinished promises are cancelled at closing');
});

test('random play with the full floor keeps every part in exactly one place for whole runs', () => {
  for (const seed of [1, 2, 3, 4]) {
    const game = new ManagerGame();
    game.start({length:3, seed});
    let rng = seed * 7919;
    const random = () => (rng = (rng * 48271) % 2147483647) / 2147483647;
    const keys = ['office', 'material-round', 'material-plate', 'material-block', 'lathe', 'mill', 'inspect', 'ship', 'buffer', 'receiving', ...BAYS.map(bay => bay.id)];
    evening(game, () => {
      game.cash += 30000;
      game.buyMachine('bay-1', 'deburr'); game.buyMachine('bay-2', 'anodize'); game.buyMachine('bay-3', 'heat'); game.buyMachine('bay-4', 'laser');
      game.buildWing();
      for (const role of ['runner', 'runner', 'clerk', 'programmer', 'technician']) game.hire(role);
      if (seed % 2) game.hire('sales');
    });
    if (seed % 2) game.partnerCovari();
    game.setPolicy('gaps', seed % 2 ? 'covari' : 'accept');
    let ticks = 0;
    while (game.mode !== 'results' && ticks++ < 20000) {
      if (game.mode === 'evening') {
        if (game.expanded && !game.stations['bay-5']) { game.buyMachine('bay-5', 'lathe'); game.buyMachine('bay-6', 'mill'); game.buyMachine('bay-7', 'inspect'); game.hire('runner'); game.hire('programmer'); }
        game.openDay(); continue;
      }
      for (const q of [...game.quotes]) { const r = random(); if (r < .2) game.bidQuote(q.id, random() < .5 ? 1 : -1); else if (r < .5) game.acceptQuote(q.id); else if (r < .6) game.outsourceQuote(q.id); else if (r < .7) game.declineQuote(q.id); }
      game.setOfficePresence(random() < .2);
      const spot = keys[Math.floor(random() * keys.length)];
      game.setPlayerStation(random() < .5 ? spot : null);
      if (random() < .3) game.interact(spot);
      if (random() < .002) game.sellMachine(BAYS[Math.floor(random() * 4)].id);
      game.tick(.05);
      assertIntegrity(game);
    }
    assert.equal(game.mode, 'results', `seed ${seed} finishes`);
    assert.ok(Number.isFinite(game.score));
    // The test injected $30,000 to build the floor; a real run never has it.
    const posted = {role:MANAGER_ROLE, board:boardId(3), score:Math.max(0, game.score - 30000), shipped:game.shipped, missed:game.missed, sourced:game.sourced, days:game.daysCompleted, elapsed:game.totalElapsed, finishReason:game.finishReason};
    assert.equal(validateManagerResult(posted, {role:MANAGER_ROLE, ruleset:boardId(3), started_at:START}, START + 3600_000), null, `seed ${seed} posts`);
  }
});

test('simulated strategies rank as designed', () => {
  const median = list => [...list].sort((a, b) => a - b)[list.length >> 1];
  const worth = (policy, length = 7) => median([1, 2, 3, 4, 5].map(seed => simulate({seed, length, policy:POLICIES[policy]}).netWorth));
  const solo = worth('solo, never buys'), machines = worth('machines only'), staffed = worth('machines + staff'), grown = worth('full manager'), neglect = worth('never services');
  assert.ok(grown > staffed && staffed > machines && machines > solo, `full ${grown} > staffed ${staffed} > machines ${machines} > solo ${solo}`);
  assert.ok(staffed > neglect, `skipping maintenance costs money (${staffed} vs ${neglect})`);
  assert.ok(solo > START_CASH, 'A careful solo owner still makes money');
  const reckless = [1, 2, 3, 4, 5].map(seed => simulate({seed, length:5, policy:POLICIES['accepts everything']}));
  assert.ok(reckless.filter(run => run.reason === 'bankrupt').length >= 4, 'Accepting impossible work ruins the shop');
  for (const run of [1, 2].map(seed => simulate({seed, length:0, policy:POLICIES['full manager']}))) {
    assert.equal(run.reason, 'bankrupt', 'Endless always ends');
    assert.ok(run.days >= 8 && run.days <= 40, `strong endless run lasts ${run.days} days`);
    assert.ok(run.expanded, 'The full strategy builds the wing');
  }
  assert.ok(routeLength('material-round', 'lathe') > 2);
  assert.ok(routeLength('material-round', 'bay-6', 'owner-wing') > routeLength('material-round', 'lathe', 'owner-wing'), 'The wing is farther from the bins');
});

test('the server bounds manager results by the run’s own economy', () => {
  const run = {role:MANAGER_ROLE, ruleset:boardId(5), started_at:START};
  const ok = {role:MANAGER_ROLE, board:boardId(5), score:12000, shipped:40, missed:2, sourced:5, days:5, elapsed:5 * DAY_SECONDS, finishReason:'complete'};
  const at = START + 1000 * 5 * DAY_SECONDS;
  assert.equal(validateManagerResult(ok, run, at), null);
  const bad = (extra, pattern, when = at, against = run) => assert.match(validateManagerResult({...ok, ...extra}, against, when), pattern, JSON.stringify(extra));
  bad({}, /new run/, at, {...run, ruleset:RULESET});
  bad({}, /new run/, at, {...run, role:2});
  bad({role:2}, /new run/);
  bad({board:boardId(3)}, /new run/);
  bad({days:6}, /limits/);
  bad({score:-1}, /limits/);
  bad({shipped:1.5}, /limits/);
  bad({finishReason:'time-up'}, /Finish/);
  bad({days:4, elapsed:4 * DAY_SECONDS}, /did not finish/);
  bad({finishReason:'retired'}, /Only an Endless/, at, {...run});
  bad({finishReason:'bankrupt'}, /did not finish/);
  bad({elapsed:3 * DAY_SECONDS}, /finish time/);
  bad({}, /finish time/, START + 1000 * 100);
  bad({}, /expired/, START + 4 * 86400_000);
  bad({sourced:41}, /does not match/);
  bad({score:START_CASH + START_ASSETS + 40 * maxPayout(5) + 1}, /does not match/);
  bad({shipped:10_000}, /does not match/);
  const bankrupt = {...ok, days:2, elapsed:3 * DAY_SECONDS, finishReason:'bankrupt', score:0};
  assert.equal(validateManagerResult(bankrupt, run, at), null);
  const endless = {role:MANAGER_ROLE, ruleset:boardId(0), started_at:START};
  assert.equal(validateManagerResult({...ok, board:boardId(0), days:12, elapsed:12 * DAY_SECONDS, finishReason:'retired', score:40000, shipped:150}, endless, START + 86400_000), null);
  assert.match(validateManagerResult({...ok, board:boardId(0), days:12, elapsed:12 * DAY_SECONDS, finishReason:'complete'}, endless, START + 86400_000), /did not finish/);
  assert.match(validateManagerResult({...ok, board:boardId(0), days:MAX_DAYS + 1}, endless, START + 86400_000), /limits/);
  assert.match(validateResult({role:MANAGER_ROLE, score:1, shipped:1, missed:0, sourced:0, calls:0}, {role:MANAGER_ROLE, ruleset:RULESET, started_at:START}, at), /new shift/, 'The shift validator never accepts manager runs');
  for (const length of RUN_LENGTHS) assert.equal(parseBoard(boardId(length)), length);
  for (const id of ['manager-v1-d4', 'manager-v1-', 'roles-v8-optional-calls', 'manager-v2-d5', null]) assert.equal(parseBoard(id), null);
});

test('manager runs post to their own board and never mix with shift scores', async t => {
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  const sqlite = new DatabaseSync(':memory:');
  for (const {tag} of journal.entries) sqlite.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const prepare = (sql, values = []) => ({
    bind(...next) { return prepare(sql, next); },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return {results:sqlite.prepare(sql).all(...values), success:true}; },
    async run() { sqlite.prepare(sql).run(...values); return {success:true}; },
  });
  const env = {DB:{prepare, async batch(list) { for (const statement of list) await statement.run(); }}, ASSETS:{fetch:async () => new Response('game')}};
  const ORIGIN = 'https://chip-rush.example';
  let now = START;
  const send = async (path, {data, cookie} = {}) => {
    const headers = new Headers();
    if (data) { headers.set('origin', ORIGIN); headers.set('content-type', 'application/json'); }
    if (cookie) headers.set('cookie', cookie);
    const real = Date.now; Date.now = () => now;
    try { return await worker.fetch(new Request(ORIGIN + path, {method:data ? 'POST' : 'GET', headers, body:data ? JSON.stringify(data) : undefined}), env); } finally { Date.now = real; }
  };
  const begin = async (role, ruleset) => { const r = await send('/api/runs', {data:{role, ruleset}}); return {status:r.status, id:r.ok ? (await r.json()).id : null, cookie:r.headers.get('set-cookie')?.split(';')[0]}; };
  assert.equal((await begin(MANAGER_ROLE, RULESET)).status, 400, 'The manager role cannot start a shift run');
  assert.equal((await begin(2, boardId(5))).status, 400, 'A shift cannot start a manager run');
  assert.equal((await begin(MANAGER_ROLE, 'manager-v1-d9')).status, 400);
  const runs = {};
  for (const length of [5, 0]) runs[length] = await begin(MANAGER_ROLE, boardId(length));
  const shift = await begin(2, RULESET);
  now = START + 2 * 3600_000;
  const post = (run, data) => send('/api/scores', {cookie:run.cookie, data:{runId:run.id, name:'Owner One', role:MANAGER_ROLE, ...data}});
  let response = await post(runs[5], {board:boardId(5), score:15000, shipped:45, missed:1, sourced:6, days:5, elapsed:5 * DAY_SECONDS, finishReason:'complete'});
  assert.equal(response.status, 200, await response.clone().text());
  response = await post(runs[0], {board:boardId(0), score:30000, shipped:120, missed:4, sourced:20, days:9, elapsed:9 * DAY_SECONDS, finishReason:'retired'});
  assert.equal(response.status, 200, await response.clone().text());
  response = await send('/api/scores', {cookie:shift.cookie, data:{runId:shift.id, name:'Shift Player', role:2, score:4000, shipped:5, missed:0, sourced:0, calls:3, elapsed:180, finishReason:'time-up'}});
  assert.equal(response.status, 200, await response.clone().text());
  const fixed = await (await send(`/api/leaderboard?board=${boardId(5)}`)).json();
  assert.deepEqual(fixed.entries.map(e => [e.name, e.score, e.days]), [['Owner One', 15000, 5]]);
  const endless = await (await send(`/api/leaderboard?board=${boardId(0)}`)).json();
  assert.deepEqual(endless.entries.map(e => [e.score, e.days]), [[30000, 9]]);
  assert.deepEqual((await (await send(`/api/leaderboard?board=${boardId(3)}`)).json()).entries, []);
  const shifts = await (await send('/api/leaderboard')).json();
  assert.deepEqual(shifts.entries.map(e => e.name), ['Shift Player'], 'The shift board only lists shift runs');
  assert.equal((await send('/api/leaderboard?board=roles-v8-optional-calls')).status, 404);
  response = await post(runs[5], {board:boardId(5), score:99999999, shipped:45, missed:1, sourced:6, days:5, elapsed:5 * DAY_SECONDS, finishReason:'complete'});
  assert.equal((await (await send(`/api/leaderboard?board=${boardId(5)}`)).json()).entries.length, 1, 'One score per run');
});

test('endless boards rank days survived before net worth', async () => {
  const source = await readFile(new URL('../server/worker.js', import.meta.url), 'utf8');
  assert.match(source, /length\?'points DESC,days DESC,created_at ASC':'days DESC,points DESC,created_at ASC'/);
});

test('challenge links never carry manager runs', () => {
  assert.equal(parseChallenge(new URL(challengeURL({role:MANAGER_ROLE, score:5000, shipped:5}, 'https://x.test/')).search), null);
});

test('manager records load safely beside shift progress in the v8 save', async () => {
  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  const migration = main.slice(main.indexOf('const SAVE_KEY='), main.indexOf('const STATION_LAYOUT='));
  const load = initial => {
    const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
    const context = vm.createContext({SHIFTS, RUN_LENGTHS, localStorage:{getItem:k => data.get(k) ?? null, setItem:(k, v) => data.set(k, v)}});
    vm.runInContext(`let unlocked=0,bests=SHIFTS.map(()=>0),grades=SHIFTS.map(()=>0);function save(){}${migration};this.result={unlocked,managerRecord};`, context);
    return JSON.parse(JSON.stringify(context.result));
  };
  const fresh = load({});
  assert.equal(fresh.unlocked, 0, 'A new player starts at First Shift');
  assert.deepEqual(fresh.managerRecord, {bests:{}, days:0, length:5}, 'and can still open the shop: the mode needs no unlock');
  const cleared = load({'chip-rush-roles-v8':{unlocked:3, bests:[1, 2, 3, 4], grades:[3, 3, 3, 1]}});
  assert.equal(cleared.unlocked, 3, 'The shift unlock chain ends at Night Shift as released');
  const saved = load({'chip-rush-roles-v8':{unlocked:1, bests:[0, 0, 0, 0], grades:[1, 0, 0, 0], manager:{bests:{5:9000, 0:'x', 3:-4, 9:500}, days:7.8, length:0}}});
  assert.equal(saved.unlocked, 1, 'Manager records never unlock shifts');
  assert.deepEqual(saved.managerRecord, {bests:{5:9000}, days:7, length:0});
  for (const junk of [null, 'x', [], {length:4, days:-3}]) {
    const value = load({'chip-rush-roles-v8':{unlocked:0, bests:[], grades:[], manager:junk}}).managerRecord;
    assert.deepEqual(value, {bests:{}, days:0, length:5}, JSON.stringify(junk));
  }
});

test('every owner floor places every bay where the door can reach it', () => {
  const allHalls = HALLS.map(hall => hall.id);
  for (const [map, halls] of [['owner-shop', []], ['owner-wing', []], ['owner-wing', ['hall-b', 'hall-d']], ['owner-wing', allHalls]]) {
    navigation.setHalls(halls);
    navigation.activate(map);
    const accesses = navigation.accessesFor(map), bays = navigation.layoutFor(map).filter(def => def.bay || def.baseBay);
    const expected = BAYS.filter(bay => (map === 'owner-wing' || !bay.wing) && (!bay.hall || halls.includes(bay.hall)));
    assert.deepEqual(Array.from(bays, def => def.id).sort(), expected.map(bay => bay.id).sort(), `${map} ${halls.join()}: bays match the engine`);
    for (const def of bays) {
      assert.equal(def.bay ?? def.baseBay, BAYS.find(bay => bay.id === def.id).size, `${def.id} size matches the engine`);
      assert.ok(navigation.safe(accesses[def.id].x, accesses[def.id].z), `${def.id} access is on open floor`);
      assert.ok(navigation.route(navigation.spawn, accesses[def.id]).length > 0, `${map} ${halls.join()}: ${def.id} is reachable from the door`);
    }
    // Operator points stay apart, so each bay is its own place to stand.
    const points = Object.entries(accesses).filter(([id]) => id.startsWith('bay-'));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++)
      assert.ok(Math.hypot(points[i][1].x - points[j][1].x, points[i][1].z - points[j][1].z) > 1.3, `${points[i][0]} and ${points[j][0]} access points are distinct`);
  }
  // A closed hall is solid floor: its bays cannot be reached until it opens.
  navigation.setHalls(['hall-a']);
  navigation.activate('owner-wing');
  const insideB = navigation.hallPlots.find(plot => plot.id === 'hall-b');
  assert.equal(navigation.safe(insideB.cx, insideB.z0 + 5), false);
  navigation.setHalls([]);
  navigation.activate('first-shop');
});

// Round three: expedite, delays, sales review and Covari rules, south halls,
// moving and selling the starting machines, and saved runs.

test('expedited work jumps every staff queue, for single jobs and whole contracts', () => {
  const game = fresh();
  const early = quoteFor(game, 'spacer'), late = quoteFor(game, 'plate');
  game.acceptQuote(early.id); game.acceptQuote(late.id);
  game.order(late.id).remaining += 30;
  assert.equal(game.cadQueue()[0].id, early.id, 'Earliest due first by default');
  assert.equal(game.expedite(late.id), true);
  assert.equal(game.order(late.id).expedited, true);
  assert.equal(game.cadQueue()[0].id, late.id, 'Expedited first');
  evening(game, () => game.hire('programmer'));
  game.tick(.05);
  assert.equal(game.staff[0].orderId, late.id, 'The programmer starts on the expedited job');
  assert.equal(game.expedite(late.id), true);
  assert.equal(game.order(late.id).expedited, false, 'Expedite toggles off');
  const contract = quoteFor(game, 'spacer', {contract:true});game.acceptQuote(contract.id);
  assert.equal(game.expedite(contract.id), true);
  assert.ok(game.contract(contract.id).expedited && game.orders.filter(o => o.contractId === contract.id).every(o => o.expedited), 'Every unit of a contract is expedited');
  assert.equal(game.expedite(999), false);
  game.mode = 'evening';assert.equal(game.expedite(early.id), false, 'Only during the working day');
});

test('a delay adds a day unless the customer refuses; a refusal scraps the part wherever it is', () => {
  const game = fresh();
  game.rng = () => .99;
  const q = quoteFor(game, 'spacer');game.acceptQuote(q.id);
  const order = game.order(q.id), remaining = order.remaining, deadline = order.deadline, first = game.delayRisk(q.id);
  assert.ok(first > 0 && first < DELAY_RISK + .01, 'The first ask risks about a quarter, less with loyalty');
  assert.equal(game.delayOrder(q.id), true);
  assert.equal(order.remaining, remaining + DAY_SECONDS);
  assert.equal(order.deadline, deadline + DAY_SECONDS);
  assert.ok(game.delayRisk(q.id) > first, 'Each further ask is riskier');
  assert.ok(game.drain().some(e => e.type === 'delayed'));
  // A delayed job ships without an early tip.
  cad(game, q.id);
  assert.equal(game.interact(bin(order)), true);
  runOn(game, 'lathe');runOn(game, 'inspect');
  game.interact('ship');
  const shipped = game.drain().find(e => e.type === 'shipped');
  assert.equal(shipped.tip, 0);
  // Refusals: in a machine, in the owner's hands, and in a runner's hands.
  for (const where of ['machine', 'hands', 'runner']) {
    const g = fresh();
    if (where === 'runner') evening(g, () => { g.hire('programmer'); g.hire('runner'); });
    const job = quoteFor(g, 'spacer');g.acceptQuote(job.id);
    if (where === 'runner') { for (let t = 0; t < 60 && !g.staff.some(m => m.carry === job.id); t += .05) g.tick(.05); assert.ok(g.staff.some(m => m.carry === job.id)); }
    else { cad(g, job.id); g.interact(bin(g.order(job.id))); if (where === 'machine') g.interact('lathe'); }
    const cash = g.cash, missed = g.missed;
    g.rng = () => 0;
    assert.equal(g.delayOrder(job.id), true);
    assert.equal(g.order(job.id), undefined, `${where}: the job is gone`);
    assert.equal(g.missed, missed + 1, `${where}: counts as expired`);
    assert.ok(g.cash < cash, `${where}: the expiry fee is charged`);
    assert.equal(g.hand, null);assert.equal(g.stations.lathe.part, null);assert.ok(g.staff.every(m => m.carry !== job.id));
    assert.ok(g.drain().some(e => e.type === 'delayRefused'));
    assertIntegrity(g);
  }
  // Contracts move as a whole, and a refusal breaks the whole contract.
  const c = fresh(), deal = quoteFor(c, 'spacer', {contract:true});c.acceptQuote(deal.id);
  c.rng = () => .99;
  const before = c.contract(deal.id).remaining;
  assert.equal(c.delayOrder(deal.id), true);
  assert.equal(c.contract(deal.id).remaining, before + DAY_SECONDS);
  assert.ok(c.orders.filter(o => o.contractId === deal.id).every(o => o.remaining === before + DAY_SECONDS));
  c.rng = () => 0;
  assert.equal(c.delayOrder(deal.id), true);
  assert.equal(c.contract(deal.id), undefined);
  assert.equal(c.contractsFailed, 1);
  assertIntegrity(c);
  assert.equal(c.delayOrder(deal.id), false, 'A closed job cannot be delayed');
});

test('sales rules: a review line for big quotes, a Covari bid, and Covari for small jobs', () => {
  const game = fresh();
  evening(game, () => game.hire('sales'));
  game.rng = () => 0;
  assert.equal(game.setPolicy('review', 800), true);
  assert.equal(game.setPolicy('review', 750), false);
  const big = quoteFor(game, 'shaft'), small = quoteFor(game, 'plate');
  assert.ok(big.price >= 800 && small.price < 800);
  advance(game, SALES_DELAY + .1);
  assert.ok(game.quote(big.id), 'A quote over the review line waits for the owner');
  assert.equal(game.quote(small.id), undefined, 'Smaller quotes are still answered');
  advance(game, QUOTE_WINDOW);
  assert.equal(game.quote(big.id), undefined, 'An unreviewed quote lapses like any other');
  game.setPolicy('review', 0);
  // Small jobs to Covari, even though the floor can make them, at the Covari bid.
  assert.equal(game.partnerCovari(), true);
  assert.equal(game.setPolicy('covariBelow', 300), true);
  assert.equal(game.setPolicy('covariMargin', .2), true);
  const spacer = quoteFor(game, 'spacer');
  assert.ok(spacer.basePrice < 300 && game.covariEligible(spacer));
  advance(game, SALES_DELAY + .1);
  const placed = game.order(spacer.id);
  assert.ok(placed?.outsourced, 'Sent to Covari');
  assert.equal(placed.price, Math.round(spacer.covariCost * 1.2 / 10) * 10, 'Covari price plus the shop margin');
  assert.equal(placed.price - game.totals.covari, placed.price - spacer.covariCost);
  // With Covari full, a small job the floor can make is accepted in-house at the standing bid.
  const second = quoteFor(game, 'spacer');advance(game, SALES_DELAY + .1);
  assert.ok(game.order(second.id)?.outsourced);
  const third = quoteFor(game, 'spacer');advance(game, SALES_DELAY + .1);
  assert.equal(game.order(third.id)?.outsourced, false, 'Covari full: made in-house');
  assert.equal(game.order(third.id).markup, game.policy.markup);
  // Same (null) follows the standing bid.
  assert.equal(game.setPolicy('covariMargin', 0), true);
  // The owner can send small jobs by hand too, but not larger ones the floor can make.
  const owner = fresh();owner.partnerCovari();owner.setPolicy('covariBelow', 300);
  assert.equal(owner.outsourceQuote(quoteFor(owner, 'housing').id), false);
  assert.match(owner.drain().find(e => e.type === 'hint')?.message ?? '', /Covari limit/);
  assert.equal(owner.outsourceQuote(quoteFor(owner, 'spacer').id), true);
  assert.equal(owner.setPolicy('covariBelow', 333), false);
  assert.ok(REVIEW_LEVELS.includes(0) && COVARI_BELOW.includes(0), 'Both rules can be switched off');
});

test('south halls open overnight next to owned floor, add bays, slots, staff room and rent', () => {
  const game = fresh({length:0});
  game.cash = 100000;
  evening(game, () => assert.equal(game.buildHall('hall-a'), false));
  assert.match(game.drain().find(e => e.type === 'hint').message, /east wing/);
  evening(game, () => game.buildWing());
  advance(game, DAY_SECONDS + .1);game.openDay();
  assert.equal(HALLS.length * HALL_BAYS.length + 13, BAYS.length, 'Ten original bays, three starting machines and the halls');
  assert.equal(game.hallBuyable('hall-c'), false, 'Hall C needs a neighbour first');
  assert.equal(game.hallBuyable('hall-a'), true);
  const rent = game.rentTomorrow(), limit = game.orderLimit, runners = game.staffMax('runner'), worth = game.netWorth();
  assert.equal(game.buildHall('hall-a'), true, 'Halls can be ordered during the day');
  assert.equal(game.netWorth(), worth - HALLS[0].cost + Math.round(HALLS[0].cost * WING.resale));
  assert.ok(game.hallBuyable('hall-c') && game.hallBuyable('hall-b'), 'A hall ordered tonight counts as a neighbour');
  assert.equal(game.buyMachine('bay-11', 'lathe'), false, 'Not open until morning');
  assert.ok(game.rentTomorrow() > rent);
  assert.equal(game.buildHall('hall-a'), false, 'Bought once');
  advance(game, DAY_SECONDS + .1);
  assert.equal(game.history.at(-1).rent, rentFor(2, true), 'Tonight’s rent is unchanged');
  game.openDay();
  assert.deepEqual(game.halls, ['hall-a']);
  assert.equal(game.rentToday(), rentFor(3, true, 1));
  assert.equal(game.rentToday(), Math.round(rentFor(3, true) * (1 + HALL_RENT) / 10) * 10);
  assert.equal(game.orderLimit, limit + 1);
  assert.equal(game.staffMax('runner'), runners + 1);
  assert.equal(game.staffMax('programmer'), STAFF.programmer.maxWing, 'CAD seats do not grow');
  assert.ok(quoteInterval(3, 3, true, 1) < quoteInterval(3, 3, true, 0), 'A hall draws more quotes');
  assert.ok(game.drain().some(e => e.type === 'hallOpened'));
  assert.equal(game.buyMachine('bay-11', 'lathe'), true);
  assert.equal(game.buyMachine('bay-17', 'lathe'), false, 'Small hall bays take small machines');
  assert.equal(game.buyMachine('bay-17', 'laser'), true);
  assert.equal(game.buyMachine('bay-19', 'lathe'), false);
  assert.match(game.drain().filter(e => e.type === 'hint').at(-1).message, /Hall B/);
  assert.ok(hallAdjacent(HALLS[0], HALLS[2]) && hallAdjacent(HALLS[0], HALLS[1]) && !hallAdjacent(HALLS[0], HALLS[3]));
});

test('with a hall bought, idle machines move between bays and reinstall', () => {
  const game = fresh({length:0});
  game.cash = 100000;
  assert.equal(game.moveMachine('lathe', 'bay-1'), false);
  assert.match(game.drain().find(e => e.type === 'hint').message, /south hall/);
  evening(game, () => game.buildWing());
  advance(game, DAY_SECONDS + .1);game.openDay();
  evening(game, () => game.buildHall('hall-b'));
  assert.equal(game.canMove(), true, 'Buying a hall unlocks moving');
  game.stations.lathe.wear = 30;
  assert.equal(game.moveMachine('lathe', 'bay-3'), false, 'A lathe needs a large bay');
  assert.equal(game.moveMachine('lathe', 'bay-5'), true);
  assert.equal(game.stations.lathe, undefined);
  assert.equal(game.stations['bay-5'].op, 'lathe');
  assert.equal(game.stations['bay-5'].wear, 30, 'Wear travels with the machine');
  assert.equal(game.installing['bay-5'], INSTALL_SECONDS, 'Moving reinstalls');
  assert.equal(game.hasMachine('lathe'), false, 'Out of use while it reinstalls');
  advance(game, INSTALL_SECONDS + .1);
  assert.equal(game.hasMachine('lathe'), true);
  assert.equal(game.moves, 1);
  // A machine with a part inside cannot move.
  const q = quoteFor(game, 'plate');game.acceptQuote(q.id);cad(game, q.id);game.interact(bin(game.order(q.id)));game.interact('mill');
  assert.equal(game.moveMachine('mill', 'lathe'), false);
  assert.match(game.drain().filter(e => e.type === 'hint').at(-1).message, /Empty/);
  // After closing, a move installs at once.
  advance(game, DAY_SECONDS);
  assert.equal(game.mode, 'evening');
  game.clearStation('mill');
  assert.equal(game.moveMachine('mill', 'lathe'), true, 'The old lathe bay takes a mill');
  assert.equal(game.installed('lathe'), true);
});

test('the starting machines can be sold or replaced, and net worth counts them', () => {
  const game = fresh();
  assert.equal(game.netWorth(), START_CASH + START_ASSETS);
  game.cash = 10000;
  const worth = game.netWorth();
  assert.equal(game.sellMachine('lathe'), true);
  assert.equal(game.netWorth(), worth, 'Selling turns a machine into its resale value, nothing more');
  assert.equal(game.cash, 10000 + Math.round(MACHINES.lathe.cost * RESALE));
  assert.deepEqual(game.gapsFor(['lathe', 'inspect', 'ship']), ['lathe']);
  assert.equal(game.buyMachine('lathe', 'mill'), true, 'The old lathe bay is a large bay');
  assert.equal(game.sellMachine('inspect'), true);
  assert.equal(game.buyMachine('inspect', 'lathe'), false, 'The QC spot is a bench bay');
  assert.equal(game.buyMachine('inspect', 'deburr'), true);
  assert.equal(game.config.unlocks.includes('inspect'), false);
});

test('a saved run resumes exactly where it was, mid-day or in the evening', () => {
  const play = (game, seconds) => {
    for (let left = seconds; left > 1e-8 && ['playing', 'evening'].includes(game.mode); left -= .05) {
      if (game.mode === 'evening') { game.openDay(); continue; }
      for (const q of [...game.quotes]) if (!game.gapsFor(q.route).length && !game.boardFull()) game.acceptQuote(q.id); else game.declineQuote(q.id);
      game.tick(.05);
    }
  };
  const a = new ManagerGame();a.distance = (x, y) => x === y ? 0 : 6;a.start({length:0, seed:11});
  evening(a, () => { a.cash += 5000; a.hire('programmer'); a.hire('runner'); a.hire('sales'); a.purchase('cam'); a.buyMachine('bay-1', 'deburr'); });
  a.setPolicy('covariBelow', 300);
  play(a, 80);
  const order = a.orders.find(o => !o.contractId);if (order) { a.expedite(order.id); }
  const text = a.serialize();
  const b = new ManagerGame();b.distance = a.distance;
  assert.equal(b.restore(text), true);
  assert.equal(b.mode, 'paused', 'A mid-day save comes back paused');
  b.mode = 'playing';
  assert.ok(b.upgrades instanceof Set && b.upgrades.has('cam'));
  assert.equal(b.nextArrival, Infinity);
  a.drain();
  play(a, 300);play(b, 300);
  assert.equal(b.serialize(), a.serialize(), 'The restored run plays out identically');
  // Evening saves come back to the evening.
  const closed = new ManagerGame();closed.distance = a.distance;closed.start({length:3, seed:2});advance(closed, DAY_SECONDS + .1);
  const restored = new ManagerGame();assert.equal(restored.restore(closed.serialize()), true);
  assert.equal(restored.mode, 'evening');assert.equal(restored.day, 1);
  // Anything else is refused and leaves the game alone.
  for (const bad of ['', 'x', '{}', '[]', JSON.stringify({version:99, ruleset:'manager-v1', data:{}}), JSON.stringify({version:1, ruleset:'manager-v1', data:[]}),
    JSON.stringify({version:1, ruleset:'manager-v1', data:{...JSON.parse(text).data, orders:'nope'}}), JSON.stringify({version:1, ruleset:'manager-v1', data:{...JSON.parse(text).data, mode:'results'}}),
    JSON.stringify({version:1, ruleset:'manager-v1', data:{...JSON.parse(text).data, length:4}})]) {
    const c = new ManagerGame();assert.equal(c.restore(bad), false, bad.slice(0, 40));assert.equal(c.mode, 'menu');
  }
});

test('random play with halls, moves, delays, expedites and save-restore keeps every part in one place', () => {
  for (const seed of [5, 6, 7]) {
    let game = new ManagerGame();
    game.start({length:0, seed});
    let rng = seed * 104729;
    const random = () => (rng = (rng * 48271) % 2147483647) / 2147483647;
    const keys = ['office', 'material-round', 'material-plate', 'material-block', 'ship', 'buffer', 'receiving', ...BAYS.map(bay => bay.id)];
    evening(game, () => {
      game.cash += 60000;
      game.buyMachine('bay-1', 'deburr'); game.buyMachine('bay-2', 'anodize'); game.buyMachine('bay-3', 'heat'); game.buyMachine('bay-4', 'laser');
      game.buildWing();
      for (const role of ['runner', 'runner', 'clerk', 'programmer', 'technician', 'sales']) game.hire(role);
    });
    game.partnerCovari();game.setPolicy('gaps', 'covari');game.setPolicy('covariBelow', 400);game.setPolicy('review', 1600);
    let ticks = 0;
    while (game.mode !== 'results' && game.day < 5 && ticks++ < 30000) {
      if (game.mode === 'evening') {
        if (game.expanded && !game.hallOwned('hall-a')) { game.buildHall('hall-a'); game.buildHall('hall-c'); }
        if (game.halls.length && !game.stations['bay-11']) { game.buyMachine('bay-11', 'lathe'); game.buyMachine('bay-12', 'mill'); game.buyMachine('bay-27', 'inspect'); game.hire('runner'); }
        game.openDay(); continue;
      }
      for (const q of [...game.quotes]) { const r = random(); if (r < .3) game.acceptQuote(q.id); else if (r < .4) game.outsourceQuote(q.id); }
      for (const o of [...game.orders]) { const r = random(); if (r < .002) game.delayOrder(o.contractId ?? o.id); else if (r < .004) game.expedite(o.contractId ?? o.id); }
      game.setOfficePresence(random() < .2);
      const spot = keys[Math.floor(random() * keys.length)];
      game.setPlayerStation(random() < .5 ? spot : null);
      if (random() < .3) game.interact(spot);
      if (random() < .003) { const from = Object.keys(game.stations)[Math.floor(random() * Object.keys(game.stations).length)], to = BAYS[Math.floor(random() * BAYS.length)].id; game.moveMachine(from, to); }
      if (random() < .001) { const restored = new ManagerGame(); assert.equal(restored.restore(game.serialize()), true); restored.mode = 'playing'; game = restored; }
      game.tick(.05);
      assertIntegrity(game);
    }
    assert.ok(game.day >= 3 || game.mode === 'results', `seed ${seed} plays several days`);
    assert.ok(game.halls.length > 0 || game.mode === 'results', `seed ${seed} opens a hall`);
  }
});
