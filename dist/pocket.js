import { ShopGame, SHIFTS } from './core.js';

// Pocket Shift: a portrait, one-thumb way to play, reached only through the
// hidden #/pocket route. It is a separate mode, not a level: it is not in
// SHIFTS, has no legacy index, keeps no score or record, and never posts a run.
// The rules are First Shift's, copied value for value; only the identity and
// the room (a tall `pocket-shop` floor) differ. See docs/experiments/pocket-shift.md.
const FIRST_SHIFT = SHIFTS[0];
// Never a valid SHIFTS index, and distinct from Open for Business (-1).
export const POCKET_ROLE = -2;
const RULE_KEYS = ['duration','firstArrival','interval','deadline','recipes','unlocks','stock','programming','sourcing','calls','callTimes','passTarget','stars'];
export const POCKET_MODE = Object.freeze({
  ...Object.fromEntries(RULE_KEYS.map(key => [key, Array.isArray(FIRST_SHIFT[key]) ? Object.freeze([...FIRST_SHIFT[key]]) : FIRST_SHIFT[key]])),
  id:'pocket-shift',mapId:'pocket-shop',name:'Pocket Shift',prototype:true,
  brief:'Tap up to three stations in order. Your machinist walks the plan and uses each one.',
});

export class PocketGame extends ShopGame {
  // ShopGame's reset reads SHIFTS[0] for the opening order, which is exactly
  // First Shift's; afterwards the mode carries its own identity.
  reset() {
    super.reset(0);
    this.shiftIndex = POCKET_ROLE;
    this.config = POCKET_MODE;
    this.pocket = true;
  }
}
