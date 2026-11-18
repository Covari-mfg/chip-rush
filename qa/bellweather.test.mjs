import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIFTS, shiftRuleset } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';
import { COURSE_LENGTH, MAX_SPEED, TOWERS, readRailRecord, keepRailRecord } from '../dist/bells.js';
import { validateResult } from '../server/worker.js';
import { simulateRail } from './bellweather-balance.mjs';

const role=SHIFTS.findIndex(s=>s.id==='bellweather');
const storage=()=>{let value=null;return {getItem:()=>value,setItem:(key,v)=>{value=v;}};};

test('no input resolves the entire course with no shipment or speed points',()=>{
  const r=simulateRail({strategy:'idle'});
  assert.equal(r.finishReason,'work-complete');assert.equal(r.spawned,8);
  assert.equal(r.shipped,0);assert.equal(r.missed,8);assert.equal(r.score,0);assert.equal(r.stars,0);
  assert.equal(r.game.distance,COURSE_LENGTH);assert.ok(r.elapsed<100);
});

test('visible steering and throws produce reproducible cautious and express clears',()=>{
  const cautious=simulateRail({strategy:'cautious'}),express=simulateRail({strategy:'express'}),advanced=simulateRail({strategy:'advanced'});
  for(const r of [cautious,express,advanced]){
    assert.equal(r.shipped,8);assert.equal(r.missed,0);assert.equal(r.stars,3);assert.equal(r.finishReason,'work-complete');
    assert.ok(r.clearElapsed>=TOWERS[3].s/MAX_SPEED);assert.ok(r.elapsed>=COURSE_LENGTH/MAX_SPEED&&r.elapsed<100);
    const value={role,score:r.score,shipped:r.shipped,missed:r.missed,sourced:r.sourced,calls:0,elapsed:r.elapsed,clearElapsed:r.clearElapsed,spawned:r.spawned,finishReason:r.finishReason};
    assert.equal(validateResult(value,{role,ruleset:shiftRuleset(role),started_at:0},Math.ceil(r.elapsed*1000)),null);
  }
  assert.ok(express.elapsed<cautious.elapsed);assert.ok(express.score>cautious.score);assert.equal(express.perfect,8);
  const idle=simulateRail({strategy:'idle'});
  assert.ok(idle.elapsed<cautious.elapsed);assert.equal(idle.score,0,'Speed alone earns no points');
  assert.ok(advanced.elapsed<idle.elapsed&&advanced.elapsed<express.elapsed);
  assert.equal(advanced.shipped,8);assert.equal(advanced.impacts,0);assert.ok(advanced.game.pads>0);assert.ok(advanced.game.banks>0);
  assert.ok(advanced.score>express.score);
  for(const r of [cautious,express,advanced]){
    assert.equal(Object.values(r.game.scoreDetails).reduce((a,b)=>a+b,0),r.score,'Receipt sums to score');
    assert.equal(r.game.scoreDetails.express,Math.max(0,Math.floor((45-r.elapsed)*60)));
  }
});

test('stars follow ordinary deliveries, and the optional plate adds 300 only',()=>{
  for(const [count,stars] of [[0,0],[3,0],[4,1],[6,2],[8,3]]){
    const r=simulateRail({throwLimit:count,covari:false});assert.equal(r.shipped,count);assert.equal(r.stars,stars);
  }
  const withPlate=simulateRail({covari:true}),without=simulateRail({covari:false});
  assert.equal(withPlate.sourced,1);assert.equal(without.sourced,0);
  assert.equal(withPlate.shipped,without.shipped);assert.equal(withPlate.stars,without.stars);
  assert.equal(withPlate.score-without.score,300);
  assert.equal(simulateRail({throwLimit:1}).sourced,0);
});

test('ghost stores completed runs and prefers deliveries before time',()=>{
  const store=storage(),slow=simulateRail({strategy:'cautious'}),fast=simulateRail({strategy:'express'});
  assert.equal(keepRailRecord(slow.game,store),true);assert.equal(readRailRecord(store).shipped,8);
  assert.equal(keepRailRecord(fast.game,store),true);assert.equal(readRailRecord(store).time,fast.elapsed);
  assert.equal(keepRailRecord(slow.game,store),false);
  assert.equal(keepRailRecord(simulateRail({strategy:'express',throwLimit:6}).game,store),false);
  const game=shiftGame(role);assert.equal(keepRailRecord(game,store),false);
});

test('pausing freezes the race and finish waits for the terminus',()=>{
  const game=shiftGame(role);game.mode='paused';game.tick(1);assert.equal(game.elapsed,0);assert.equal(game.distance,0);
  game.mode='playing';while(game.distance<TOWERS.at(-1).s+1)game.tick(.05);
  assert.equal(game.mode,'playing');assert.equal(game.shipped+game.missed,8);
  while(game.mode==='playing')game.tick(.05);
  assert.equal(game.distance,COURSE_LENGTH);assert.equal(game.finishReason,'work-complete');
});


test('hosted rail score bounds include the exact finish bonus and feasible shipment maximum',()=>{
  const run={role,ruleset:shiftRuleset(role),started_at:0};
  const elapsed=30,bonus=Math.floor((45-elapsed)*60);
  const value={role,shipped:8,missed:0,sourced:1,calls:0,elapsed,clearElapsed:12,spawned:8,finishReason:'work-complete'};
  const min=8*320+300+bonus;
  const max=8*750+60*(0+1+2+3+4+5+5+5)+300+bonus;
  const valid=score=>validateResult({...value,score},run,elapsed*1000);
  assert.equal(valid(min),null);assert.ok(valid(min-1));assert.equal(valid(max),null);assert.ok(valid(max+1));
  // Hosted elapsed is stored to milliseconds, making its inferred bonus at
  // worst one point away from the unrounded receipt's exact bonus.
  for(const strategy of ['cautious','express','advanced']){
    const r=simulateRail({strategy}),stored=Math.round(r.elapsed*1000)/1000;
    const inferred=Math.max(0,Math.floor((45-stored)*60));
    assert.ok(Math.abs(inferred-r.game.scoreDetails.express)<=1);
  }
});
