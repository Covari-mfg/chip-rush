import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SHIFTS, stockType } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';
import { isCncOp } from '../dist/redline.js';

const REDLINE_ROLE = SHIFTS.findIndex(s => s.id === 'redline');

// Exact physical access coordinates on the paddock-garage floor (matches dist/main.js!)
const ACCESS = {
  'material-round': { x: -5.1,  z: -1.5 },
  'material-block': { x: -5.1,  z:  0.4 },
  buffer:           { x: -6.4,  z:  3.05 },
  lathe:            { x: -3.75, z: -1.75 },
  mill:             { x:  0.65, z: -1.72 },
  deburr:           { x: -0.9,  z:  2.13 },
  receiving:        { x: -2.3,  z:  2.05 },
  inspect:          { x:  4.32, z: -2.25 },
  ship:             { x:  4.27, z:  1.0  },
};

export function simulateRedline({
  strategy = 'master', // 'idle' | 'serial' | 'fifo' | 'batch' | 'master'
  reaction = 0.35,
  dash = false,
  covari = 'decline',
  dt = 0.05,
} = {}) {
  const game = shiftGame(REDLINE_ROLE);
  if (strategy === 'idle') {
    while (game.mode === 'playing') game.tick(0.1);
    return summarize(game, strategy);
  }

  let px = 0, pz = 2.6;
  let dashCd = 0;
  const walkSpeed = 4.4;

  const advance = sec => {
    let left = sec;
    while (left > 1e-9 && game.mode === 'playing') {
      const step = Math.min(dt, left);
      game.tick(step);
      dashCd = Math.max(0, dashCd - step);
      left -= step;
    }
  };

  const walkAndUse = stationId => {
    const dst = ACCESS[stationId];
    const dist = Math.hypot(dst.x - px, dst.z - pz);
    // Conservative 1.15x floor detour multiplier around Deburr/benches
    const effDist = dist * 1.15;
    let travel = effDist / walkSpeed;
    if (dash && dashCd <= 0 && effDist > 2.6) {
      travel = Math.max(0.18, (effDist - 1.35) / walkSpeed);
      dashCd = 1.3;
    }
    advance(travel + reaction);
    px = dst.x; pz = dst.z;
    if (game.mode !== 'playing') return false;
    return game.interact(stationId);
  };

  const canDeliverHeld = held => {
    if (!held) return null;
    const next = held.route[held.index];
    if (next === 'ship') return 'ship';
    const st = game.stations[next];
    if (!st) return null;
    if (!st.part) return next;
    // 1-beat Ready-Swap when holding a matching-next part!
    if (st.ready && strategy !== 'serial') return next;
    return null;
  };

  let guard = 0;
  while (game.mode === 'playing' && guard++ < 5000) {
    // Handle optional Covari offer
    if (game.sourcing?.state === 'offer') {
      if (covari === 'accept') game.requestSource();
      else game.declineSource();
      advance(reaction);
      continue;
    }

    const held = game.heldOrder;

    // 1) If holding a part, deliver or ready-swap if its next station is free/ready!
    if (held) {
      const target = canDeliverHeld(held);
      if (target) {
        // Smart batching check: if holding a mismatched alloy for a CNC that has a
        // matching-alloy unstarted/buffered order waiting and plenty of time, park on Hold Bench!
        if ((strategy === 'batch' || strategy === 'master') && isCncOp(target) && !game.buffer) {
          const st = game.stations[target];
          const mismatch = st.setup !== held.alloy;
          const hasMatchingOther = game.orders.some(o =>
            o.id !== held.id && o.alloy === st.setup && o.route[o.index] === target && (o.location === 'material' || o.location === 'buffer')
          );
          if (mismatch && hasMatchingOther && held.remaining > 28) {
            walkAndUse('buffer');
            continue;
          }
        }
        walkAndUse(target);
        continue;
      }
      // Station is busy: park on Hold Bench in flow/batch/master modes if other work exists
      if (strategy !== 'serial' && !game.buffer) {
        const otherReady = Object.entries(game.stations).some(([, s]) => s.ready);
        const otherFreeStart = game.orders.some(o => !o.started && !game.stations[o.route[0]]?.part);
        if (otherReady || otherFreeStart) {
          walkAndUse('buffer');
          continue;
        }
      }
      advance(0.15);
      continue;
    }

    // 2) Hands empty — check for READY machines first (prioritizing Inspect -> Ship, then CNCs)
    const readyList = Object.entries(game.stations)
      .filter(([, st]) => st.ready && st.part)
      .map(([id, st]) => ({ id, order: game.order(st.part.orderId) }))
      .filter(x => x.order);

    if (readyList.length) {
      // Master/Batch move: if a READY CNC has a matching-alloy part in stock or Hold Bench,
      // grab that part FIRST so we can 1-beat Ready-Swap and keep the 1.82x spindle blazing!
      if (strategy === 'batch' || strategy === 'master') {
        const swapCnc = readyList.find(({ id }) => isCncOp(id));
        if (swapCnc) {
          const st = game.stations[swapCnc.id];
          // Check Hold Bench first for matching-next part
          const bufOrder = game.buffer ? game.order(game.buffer.orderId) : null;
          if (bufOrder && bufOrder.route[bufOrder.index] === swapCnc.id && bufOrder.alloy === st.setup) {
            walkAndUse('buffer');
            continue;
          }
          // Check unstarted stock order matching both first op AND alloy!
          const stockMatch = game.orders
            .filter(o => !o.started && o.route[0] === swapCnc.id && o.alloy === st.setup)
            .sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || a.remaining - b.remaining)[0];
          if (stockMatch) {
            game.selectOrder(stockMatch.id);
            walkAndUse(`material-${stockType(stockMatch)}`);
            continue;
          }
        }
      }
      readyList.sort((a, b) => {
        const pa = (a.order.route[a.order.index] === 'ship' ? -40 : 0) + (a.order.hot ? -15 : 0) + a.order.remaining;
        const pb = (b.order.route[b.order.index] === 'ship' ? -40 : 0) + (b.order.hot ? -15 : 0) + b.order.remaining;
        return pa - pb;
      });
      walkAndUse(readyList[0].id);
      continue;
    }

    // 3) Check delivered Covari crate at Receiving (if QC is free)
    if (game.receiving && !game.stations.inspect.part) {
      walkAndUse('receiving');
      continue;
    }

    // 4) Check Hold Bench if parked part's next station is now free (preferring alloy matches)
    if (game.buffer) {
      const bo = game.order(game.buffer.orderId);
      const next = bo?.route[bo.index];
      const st = game.stations[next];
      if (bo && (next === 'ship' || (st && !st.part))) {
        const matchingStockBetter = (strategy === 'batch' || strategy === 'master') && isCncOp(next) && st.setup !== bo.alloy &&
          game.orders.some(o => !o.started && o.route[0] === next && o.alloy === st.setup);
        if (!matchingStockBetter || bo.remaining < 24) {
          walkAndUse('buffer');
          continue;
        }
      }
    }

    // 5) Pull an unstarted order from Stock!
    const startable = game.orders.filter(o => !o.started && !game.stations[o.route[0]]?.part);
    if (startable.length) {
      let pick;
      if (strategy === 'serial') {
        // Serial: only start if ZERO parts are already in progress anywhere
        const inProgress = game.orders.some(o => o.started);
        if (inProgress) { advance(0.15); continue; }
        pick = startable[0];
      } else if (strategy === 'fifo') {
        // Naive FIFO: grabs oldest order regardless of alloy mismatch!
        pick = startable.sort((a, b) => a.id - b.id)[0];
      } else {
        // Batch / Master: strongly prefer orders matching the target CNC's current alloy setup!
        pick = startable.sort((a, b) => {
          const sa = game.stations[a.route[0]], sb = game.stations[b.route[0]];
          const am = isCncOp(a.route[0]) && sa.setup === a.alloy ? 1 : 0;
          const bm = isCncOp(b.route[0]) && sb.setup === b.alloy ? 1 : 0;
          const aUrgent = a.remaining < 36 ? 1 : 0;
          const bUrgent = b.remaining < 36 ? 1 : 0;
          if (aUrgent !== bUrgent) return bUrgent - aUrgent;
          if (am !== bm) return bm - am;
          if (a.hot !== b.hot) return (b.hot ? 1 : 0) - (a.hot ? 1 : 0);
          return a.remaining - b.remaining;
        })[0];
      }
      game.selectOrder(pick.id);
      walkAndUse(`material-${stockType(pick)}`);
      continue;
    }

    advance(0.15);
  }

  return summarize(game, strategy);
}

function summarize(game, strategy) {
  return {
    role: REDLINE_ROLE,
    id: game.config.id,
    strategy,
    spawned: game.spawnIndex,
    shipped: game.shipped,
    missed: game.missed,
    unfinished: game.unfinished,
    sourced: game.sourced,
    pass: game.passed(),
    stars: game.stars(),
    score: game.score,
    elapsed: +game.elapsed.toFixed(2),
    clearElapsed: game.clearElapsed !== null ? +game.clearElapsed.toFixed(2) : null,
    finishReason: game.finishReason,
    batchHits: game.stats.batchHits,
    changeovers: game.stats.changeovers,
    peakFlow: game.stats.peakFlow,
    swaps: game.stats.swaps,
    hotShipped: game.stats.hotShipped,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const runs = [
    simulateRedline({ strategy: 'idle' }),
    simulateRedline({ strategy: 'serial', reaction: 0.6, dash: false }),
    simulateRedline({ strategy: 'fifo',   reaction: 0.55, dash: false }),
    simulateRedline({ strategy: 'batch',  reaction: 0.45, dash: false }),
    simulateRedline({ strategy: 'master', reaction: 0.25, dash: true, covari: 'decline' }),
    simulateRedline({ strategy: 'master', reaction: 0.25, dash: true, covari: 'accept' }),
  ];
  console.table(runs.map(({ role, id, ...r }) => r));
}
