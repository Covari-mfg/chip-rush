// Pocket Shift's plan: the player taps up to `limit` stations and the
// machinist works through them in order. Pure state, no DOM or game rules, so
// it runs under node --test. A station appears at most once in the plan.
export function createStationQueue({limit = 3} = {}) {
  let stops = [];
  const snapshot = () => [...stops];
  return {
    // Tapping a queued station removes it and every stop planned after it;
    // tapping a new one appends it unless the plan is already full.
    tap(id) {
      if (typeof id !== 'string' || !id) return {action:'ignored', stops:snapshot()};
      const at = stops.indexOf(id);
      if (at >= 0) {
        const removed = stops.slice(at);
        stops = stops.slice(0, at);
        return {action:'removed', removed, head:at === 0, stops:snapshot()};
      }
      if (stops.length >= limit) return {action:'full', stops:snapshot()};
      stops.push(id);
      return {action:'added', position:stops.length, stops:snapshot()};
    },
    // The machinist reached the first stop. A used station leaves the plan;
    // a rejected one drops the whole remaining plan.
    arrived(id, accepted) {
      if (stops[0] !== id) return {action:'ignored', stops:snapshot()};
      if (accepted) { stops.shift(); return {action:'advanced', stops:snapshot()}; }
      const dropped = stops;
      stops = [];
      return {action:'dropped', dropped, stops:snapshot()};
    },
    clear() { const dropped = stops; stops = []; return dropped; },
    head() { return stops[0] ?? null; },
    position(id) { const at = stops.indexOf(id); return at < 0 ? 0 : at + 1; },
    get size() { return stops.length; },
    get limit() { return limit; },
    list: snapshot,
  };
}
