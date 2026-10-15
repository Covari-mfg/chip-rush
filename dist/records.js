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
    return Object.fromEntries(shifts.filter(s => Number.isFinite(saved?.[s.recordId??s.id]) && saved[s.recordId??s.id] > 0 && saved[s.recordId??s.id] <= s.duration + .1).map(s => [s.recordId??s.id,saved[s.recordId??s.id]]));
  } catch { return {}; }
}
export function recordClear(records, game) {
  const time = game.clearElapsed, id = game.config.recordId??game.config.id;
  if (!Number.isFinite(time) || time <= 0 || !game.passed()) return false;
  if (Number.isFinite(records[id]) && records[id] <= time) return false;
  records[id] = time;
  return true;
}

// A changed level gets fresh records; the first edition stays in the save.
// Other levels and their numeric slots are untouched.
export function versionLevelRecords(saved, shifts) {
  if (!saved) return null;
  const next={...saved,bests:[...(Array.isArray(saved.bests)?saved.bests:[])],grades:[...(Array.isArray(saved.grades)?saved.grades:[])],levelVersions:{...saved.levelVersions},levelArchives:{...saved.levelArchives}};
  shifts.forEach((shift,index)=>{
    if(!shift.ruleset||next.levelVersions[shift.id]===shift.ruleset)return;
    if(next.bests[index]||next.grades[index])next.levelArchives[shift.id+'@'+(next.levelVersions[shift.id]??'first-edition')]={best:next.bests[index]??0,stars:next.grades[index]??0};
    next.bests[index]=0;next.grades[index]=0;next.levelVersions[shift.id]=shift.ruleset;
  });
  return next;
}
export function saveSpeedRecords(storage, records) {
  let old={};
  try {old=JSON.parse(storage.getItem('chip-rush-speed-v1')||'{}');}catch{}
  try {storage.setItem('chip-rush-speed-v1',JSON.stringify({...old,...records}));}catch{}
}
