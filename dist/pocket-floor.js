import { OPS, stockType } from './core.js';
import { TECHNOLOGIES } from './technology.js';

// Pocket Shift's floor, presentation only: one badge language shared by the
// stations and the order tickets, the generous tap rule, and the fixtures that
// come and go (the Covari crate spot, the Deburr bench that arrives before the
// deburr parts). Pure functions, no DOM or Three.js, so node --test covers them.
// Nothing here changes the pocket-v1 rules.

// Pictograms on a 32-unit grid, drawn as strokes in the station's own colour.
const STOCK_DRAWING = {
  round:'<ellipse cx="8" cy="16" rx="4" ry="7"/><path d="M8 9h16c5 0 5 14 0 14H8M24 9c-5 0-5 14 0 14"/>',
  plate:'<path d="m3 12 16-6 10 5-16 6zM3 12v5l10 6 16-7v-5M13 17v6"/>',
  block:'<path d="m5 10 11-6 11 6v13l-11 6-11-6zM5 10l11 6 11-6M16 16v13"/>',
};
const DRAWING = {
  'material-round':STOCK_DRAWING.round,
  'material-plate':STOCK_DRAWING.plate,
  'material-block':STOCK_DRAWING.block,
  lathe:TECHNOLOGIES.lathe.drawing,
  mill:TECHNOLOGIES.mill.drawing,
  // A grinding wheel on its spindle, throwing sparks.
  deburr:'<circle cx="13" cy="17" r="8"/><circle cx="13" cy="17" r="2.5"/><path d="M3 17h2m16 0h8M23 9l4-4M24 13l5-1M22 6l1-4"/>',
  // A loupe over a tick.
  inspect:'<circle cx="13" cy="13" r="9"/><path d="m20 20 9 9M9 13l3 3 5-6"/>',
  // A carton leaving on an arrow.
  ship:'<path d="M3 11h16v15H3zM3 11l3-5h10l3 5M11 11v6M21 18h9m-4-4 4 4-4 4"/>',
  // The Hold bench: a tray on two legs, a part waiting on it.
  buffer:'<path d="M3 15h26M6 15v12M26 15v12M3 19h26M11 15v-5h10v5"/>',
  // The Covari crate on its pallet.
  receiving:'<path d="M5 6h22v16H5zM5 6l22 16M27 6 5 22M3 26h26M7 22v4m18-4v4M16 22v4"/>',
};

// The word under each icon is the station's own name, so a ticket chip and the
// station it points at read the same. Colours follow OPS (and the stock bins'
// metal colours, which match the machine that first cuts that stock).
export const POCKET_BADGES = Object.freeze({
  'material-round':Object.freeze({word:'ROUND', name:'Round stock', color:'#7cdeca'}),
  'material-plate':Object.freeze({word:'PLATE', name:'Plate stock', color:'#8dc9f1'}),
  'material-block':Object.freeze({word:'BLOCK', name:'Block stock', color:'#ffbf7d'}),
  lathe:Object.freeze({word:'LATHE', name:'Lathe', color:OPS.lathe.color}),
  mill:Object.freeze({word:'MILL', name:'Mill', color:OPS.mill.color}),
  deburr:Object.freeze({word:'DEBURR', name:'Deburr', color:OPS.deburr.color}),
  inspect:Object.freeze({word:'INSPECT', name:'Inspect', color:OPS.inspect.color}),
  ship:Object.freeze({word:'SHIP', name:'Shipping', color:OPS.ship.color}),
  buffer:Object.freeze({word:'HOLD', name:'Hold bench', color:'#d8bd8a'}),
  receiving:Object.freeze({word:'CRATE', name:'Covari crate', color:'#72e8cf'}),
});

export function pocketBadgeIcon(id, className = 'pocket-icon') {
  const drawing = DRAWING[id];
  return drawing ? `<svg class="${className}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawing}</svg>` : '';
}

// Ticket names that fit a quarter of a phone's width; the full name stays in
// the ticket's accessible label.
const SHORT_NAMES = {'Pocket spacer':'Spacer', 'Mounting plate':'Plate', 'Bearing housing':'Housing', 'Dial knob':'Knob', 'Valve body':'Valve'};
export const pocketShortName = name => SHORT_NAMES[name] ?? name.split(' ').at(-1);

// The steps an order still needs, as station ids: its stock bin until the part
// is started, then each route step not yet done. ship is the Shipping station.
export function pocketRemainingStations(order) {
  const steps = order.started ? [] : ['material-' + stockType(order)];
  for (const [index, key] of order.route.entries()) if (index >= order.index) steps.push(key);
  return steps;
}

// Generous taps. A tap resolves to the station whose footprint or badge is
// nearest to it, within radius CSS pixels; a tap inside a box is at distance 0.
// Ties go to the box whose centre is nearer. Further than radius from every
// box, it is a bare-floor tap (null). Because the nearest box always wins, a tap
// is never given to a neighbour that is further away than another station.
export const POCKET_TAP_RADIUS = 46;
export function boxDistance(point, box) {
  const dx = Math.max(box.left - point.x, 0, point.x - box.right), dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
  return Math.hypot(dx, dy);
}
export function pocketTapTarget(point, targets, {radius = POCKET_TAP_RADIUS} = {}) {
  let best = null;
  for (const target of targets) for (const box of target.boxes ?? []) {
    if (!box || !(box.right > box.left) || !(box.bottom > box.top)) continue;
    const d = boxDistance(point, box);
    if (d > radius) continue;
    const c = Math.hypot(point.x - (box.left + box.right) / 2, point.y - (box.top + box.bottom) / 2);
    if (!best || d < best.d - 1e-6 || (Math.abs(d - best.d) <= 1e-6 && c < best.c)) best = {id:target.id, d, c};
  }
  return best?.id ?? null;
}

// Deburr is first needed by order 11 (index 10). It arrives this many seconds
// before that order is due, and stays for the rest of the run.
export const POCKET_DEBURR_ORDER = 10, POCKET_DEBURR_LEAD = 8;
export function pocketDeburrInstalled({spawnIndex = 0, nextArrival = 0, elapsed = 0} = {}) {
  if (spawnIndex > POCKET_DEBURR_ORDER) return true;
  return spawnIndex === POCKET_DEBURR_ORDER && nextArrival - elapsed <= POCKET_DEBURR_LEAD;
}
// The crate spot by the back door is on the floor only while a Covari delivery
// is on its way or waiting there.
export function pocketCrateShown(game) {
  const job = game?.sourcing;
  return !!job && (job.state === 'sourcing' || job.state === 'delivered' && job.location === 'receiving');
}
// Stations not on the floor right now: they draw nothing, take no taps and
// block no walking.
export function pocketAbsentStations(game) {
  const absent = [];
  if (!pocketDeburrInstalled(game)) absent.push('deburr');
  if (!pocketCrateShown(game)) absent.push('receiving');
  return absent;
}
