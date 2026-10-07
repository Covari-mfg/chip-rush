// Rendering budget. High-refresh displays (120 Hz and up) must not redraw the
// shop, shadow map included, every display frame: that kept laptop fans at full
// speed. These checks run the production frame gate from dist/main.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
const start = main.indexOf('const FRAME_BUDGET='), end = main.indexOf('let lastRender=');
const budget = vm.runInNewContext(`${main.slice(start, end)};({FRAME_BUDGET, framesPerSecond})`);

test('play renders at most 60 frames a second, menus 30, overlays 10', () => {
  assert.equal(budget.framesPerSecond('playing'), 60);
  assert.equal(budget.framesPerSecond('menu'), 30);
  assert.equal(budget.framesPerSecond('evening'), 30);
  for (const mode of ['paused', 'help', 'results']) assert.equal(budget.framesPerSecond(mode), 10, mode);
});

test('the frame loop skips display frames inside its budget and throttles shadow updates', () => {
  const frame = main.slice(main.indexOf('function frame(now){'), main.indexOf('\n}', main.indexOf('function frame(now){')) + 2);
  assert.match(frame, /^function frame\(now\)\{\n  requestAnimationFrame\(frame\);\n  if\(now-lastRender<1000\/framesPerSecond\(game\.mode\)-2\)return;/, 'The gate runs before any work');
  assert.match(frame, /renderer\.shadowMap\.needsUpdate=true;\n  renderer\.render\(scene,camera\);/, 'Shadows update on demand');
  assert.match(main, /renderer\.shadowMap\.autoUpdate=false;/, 'The shadow map does not redraw itself every frame');
  // Simulate a 120 Hz display for one second of play.
  let renders = 0, lastRender = -Infinity;
  for (let now = 0; now < 1000; now += 1000 / 120) {
    if (now - lastRender < 1000 / budget.framesPerSecond('playing') - 2) continue;
    lastRender = now; renders++;
  }
  assert.ok(renders <= 61 && renders >= 59, `${renders} renders in a second at 120 Hz`);
});

test('sparks share geometry and materials instead of allocating per particle', () => {
  const spawn = main.slice(main.indexOf('function spawnParticles('), main.indexOf('\n', main.indexOf('function spawnParticles(')));
  assert.doesNotMatch(spawn, /new THREE\.(BoxGeometry|MeshBasicMaterial)/);
});
