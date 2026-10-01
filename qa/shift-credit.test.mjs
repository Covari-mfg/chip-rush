// Picker copy only. Stars, locks, order, and shift data stay as released.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { SHIFTS } from '../dist/core.js';

const CODEX = 'Created with Codex + GPT 6 - Astra';
const CURSOR = 'Created with Cursor + Sonnet 5.5';

test('each shift card credits its creator under the description', async () => {
  const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('const SHIFT_CREDIT=');
  const end = main.indexOf('\nfunction buildShiftPicker');
  assert.ok(start >= 0 && end > start);
  const credits = vm.runInNewContext(`(${main.slice(start + 'const SHIFT_CREDIT='.length, end).replace(/;\s*$/, '')})`);
  assert.deepEqual(SHIFTS.map(shift => credits[shift.id]), [CODEX, CODEX, CODEX, CURSOR]);
  const picker = main.slice(end, main.indexOf('function hidePanels'));
  assert.match(picker, /<small>\$\{s\.subtitle\}<\/small>\$\{credit\?`<small class="shift-credit">\$\{credit\}<\/small>`:''\}/);
  assert.match(picker, /i>unlocked\?'⌑':grades\[i\]\?'★'\.repeat\(grades\[i\]\):i===selectedShift\?'↗':'·'/);
  assert.deepEqual(SHIFTS.map(shift => [shift.id, shift.author, shift.harness]), [
    ['first-shift', 'GPT-6 Astra', 'Codex'],
    ['mixed-orders', 'GPT-6 Astra', 'Codex'],
    ['rush-hour', 'GPT-6 Astra', 'Codex'],
    ['night-shift', 'Claude Sonnet 5.5', 'Cursor Cloud Agent'],
  ]);
});
