// Share the same station id between its label and its 3D model. Floor taps use
// screen coordinates instead. Call consume only for the mobile interface.
export function createTapNavigation({interval = 350, radius = 24} = {}) {
  let previous = null;
  return {
    consume({target = null, x, y, time}) {
      const tap = {target, x, y, time};
      const elapsed = previous ? time - previous.time : Infinity;
      const sameDestination = previous && target === previous.target && (
        target !== null || (
          Number.isFinite(x) && Number.isFinite(y) &&
          Number.isFinite(previous.x) && Number.isFinite(previous.y) &&
          Math.hypot(x - previous.x, y - previous.y) <= radius
        )
      );
      if (Number.isFinite(time) && sameDestination && elapsed >= 0 && elapsed <= interval) {
        // Suppress repeated taps in a rapid burst. Navigating again at a station
        // could repeat its interaction (for example, recycling a fresh part).
        previous = tap;
        return 'ignore';
      }
      previous = Number.isFinite(time) ? tap : null;
      return 'walk';
    },
    reset() {
      previous = null;
    },
  };
}
