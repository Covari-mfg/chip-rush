import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIFTS, shiftRuleset } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';
import { FEED_FINE, FEED_ROUGH } from '../dist/bells.js';
import { validateResult } from '../server/worker.js';
import { simulateTurning } from './bellweather-balance.mjs';

const role=SHIFTS.findIndex(s=>s.id==='bellweather');
const newGame=()=>shiftGame(role);

test('ordinary lathe inputs produce accepted parts and a valid hosted result',()=>{
  const r=simulateTurning();
  assert.equal(r.shipped,8);assert.equal(r.missed,0);assert.equal(r.stars,3);
  assert.equal(r.finishReason,'work-complete');assert.equal(r.sourced,1);
  const value={role,score:r.score,shipped:r.shipped,missed:r.missed,sourced:r.sourced,calls:0,elapsed:r.elapsed,clearElapsed:r.clearElapsed,spawned:r.spawned,finishReason:r.finishReason};
  assert.equal(validateResult(value,{role,ruleset:shiftRuleset(role),started_at:0},Math.ceil(r.elapsed*1000)),null);
});

test('oversize inspection permits rework, while an undersize land scraps the blank',()=>{
  const game=newGame();
  game.inspectPart();assert.equal(game.shipped,0);assert.equal(game.missed,0);
  game.selectLand(0);game.fast=true;game.cutting=true;
  while(game.diameters[0]>=game.drawing.targets[0]-game.drawing.tolerance)game.tick(.01);
  game.cutting=false;game.inspectPart();assert.equal(game.missed,1);assert.equal(game.shipped,0);
});

test('idle shift times out with all blanks counted missed',()=>{
  const r=simulateTurning({strategy:'idle'});
  assert.equal(r.finishReason,'time-up');assert.equal(r.shipped,0);assert.equal(r.missed,8);assert.equal(r.spawned,8);assert.equal(r.score,0);
});

test('optional sourcing requires two shipments and adds 300 without star credit',()=>{
  const withPlate=simulateTurning(),without=simulateTurning({covari:false});
  assert.equal(withPlate.score-without.score,300);assert.equal(withPlate.sourced,1);
  assert.equal(withPlate.shipped,without.shipped);assert.equal(withPlate.stars,without.stars);
  const game=newGame();game.takePlate();assert.equal(game.sourced,0);
});

test('feed rates and pause are respected',()=>{
  const game=newGame(),diameter=game.diameters[0];
  game.cutting=true;game.fast=false;game.tick(.1);
  assert.ok(Math.abs(game.diameters[0]-(diameter-FEED_FINE*.1))<1e-6);
  game.fast=true;const before=game.diameters[0];game.tick(.1);
  assert.ok(Math.abs(game.diameters[0]-(before-FEED_ROUGH*.1))<1e-6);
  game.mode='paused';const elapsed=game.elapsed,paused=game.diameters[0];game.tick(1);
  assert.equal(game.elapsed,elapsed);assert.equal(game.diameters[0],paused);
});

test('hosted scores respect shipment, streak, sourcing and speed bounds',()=>{
  const run={role,ruleset:shiftRuleset(role),started_at:0};
  const value={role,shipped:8,missed:0,sourced:1,calls:0,elapsed:50,clearElapsed:20,spawned:8,finishReason:'work-complete'};
  const bonus=400, min=8*320+bonus+300, max=8*800+(0+50+100+150+200*4)+bonus+300;
  assert.equal(validateResult({...value,score:min},run,50000),null);
  assert.ok(validateResult({...value,score:min-2},run,50000));
  assert.equal(validateResult({...value,score:max},run,50000),null);
  assert.ok(validateResult({...value,score:max+2},run,50000));
});

test('a bearing journal can meet its diameter and still need a fine finish',()=>{
  const game=newGame();
  function turn(i,stop,fast){
    game.selectLand(i);game.fast=fast;game.cutting=true;
    while(game.diameters[i]>stop)game.tick(.01);
    game.cutting=false;
  }
  for(let blank=0;blank<3;blank++){
    for(let i=0;i<3;i++)turn(i,game.drawing.targets[i]+.28,true);
    if(blank<2)assert.equal(game.inspectPart(),true);
  }
  const journal=game.drawing.finishLand;
  assert.equal(game.landStatus(journal),'rough');
  assert.equal(game.inspectPart(),false);
  assert.equal(game.index,2);
  turn(journal,game.drawing.targets[journal]-.08,false);
  assert.equal(game.inspectPart(),true);
  const entry=game.partLog.at(-1);
  assert.equal(entry.accepted,true);
  assert.ok(entry.diameters.every((d,i)=>Math.abs(d-entry.targets[i])<=entry.tolerance));
  assert.notEqual(entry.diameters,game.diameters);
});

test('inspection uses the same hundredth-millimetre reading as the instrument',()=>{
  const game=newGame();game.cutting=true;
  while(game.diameters[0]>29.5)game.tick(.05);
  game.tick((game.diameters[0]-28.854)/FEED_ROUGH);
  assert.equal(game.measured(0),28.85);
  assert.equal(game.landStatus(0),'fit');
});
