// Clear time is the first ordinary shipment that reaches this level's target.
// It measures the objective, not the later end-of-shift cleanup or cinematic.
export function runTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const tenths = Math.round(seconds * 10);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2,'0')}.${tenths % 10}`;
}
export function readSpeedRecords(storage, shifts) {
  try {
    const saved = JSON.parse(storage.getItem('chip-rush-speed-v1') || '{}');
    return Object.fromEntries(shifts.filter(s => Number.isFinite(saved?.[s.id]) && saved[s.id] > 0 && saved[s.id] <= s.duration + .1).map(s => [s.id,saved[s.id]]));
  } catch { return {}; }
}
export function recordClear(records, game) {
  const time = game.clearElapsed, id = game.config.id;
  if (!Number.isFinite(time) || time <= 0 || !game.passed()) return false;
  if (Number.isFinite(records[id]) && records[id] <= time) return false;
  records[id] = time;
  return true;
}
