import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIFTS, stockType } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';
import { TONE_SECONDS, BELL_NOTES } from '../dist/bells.js';
import { simulateShift, navigation } from './balance.mjs';

const role=SHIFTS.findIndex(s=>s.id==='bellweather');
function advance(game,seconds){
  for(let i=0;i<Math.ceil(seconds*20);i++)game.tick(.05);
}
function cut(game,id){
  const order=game.order(id),machine=order.route[0];
  assert.ok(game.interact('material-'+stockType(order)));
  assert.equal(game.hand.orderId,id);
  assert.ok(game.interact(machine));advance(game,machine==='lathe'?8.05:10.05);
  assert.ok(game.interact(machine));
}
function hang(game,id,voice=0){
  cut(game,id);
  assert.ok(game.interact('inspect'));advance(game,4.05+voice*TONE_SECONDS);
  const tuning=game.tuning();
  assert.equal(tuning.voice,voice);assert.ok(game.interact('inspect'));
  assert.equal(game.heldOrder.note,tuning.note);assert.ok(game.interact('ship'));
  return tuning.note;
}

test('each of the three pitches makes a distinct first bell and preserves shipment credit',()=>{
  const notes=[];
  for(let voice=0;voice<3;voice++){
    const game=shiftGame(role);notes.push(hang(game,101,voice));
    assert.equal(game.peal.length,1);assert.equal(game.shipped,1);
    assert.equal(game.peal[0],notes.at(-1));assert.ok(game.score>0);
  }
  assert.equal(new Set(notes.map(n=>BELL_NOTES[n].hz)).size,3);
});

test('paused tuning holds its pitch; a busy or empty bench cannot commit a note',()=>{
  const game=shiftGame(role);cut(game,101);game.interact('inspect');
  assert.equal(game.tuning(),null);assert.equal(game.interact('inspect'),false);
  advance(game,4.1);const before=game.tuning();game.mode='paused';advance(game,5);
  assert.deepEqual(game.tuning(),before);assert.equal(game.interact('inspect'),false);
  game.mode='playing';advance(game,TONE_SECONDS);assert.notEqual(game.tuning().note,before.note);
  game.interact('inspect');assert.equal(game.tuning(),null);assert.equal(game.peal.length,0);
  assert.ok(game.interact('material-round'));assert.equal(game.order(101).note,undefined);
});

test('a bench swap locks the outgoing pitch and starts a fresh sweep for its replacement',()=>{
  const game=shiftGame(role);cut(game,101);game.interact('inspect');advance(game,1);
  cut(game,102);const outgoing=game.tuning();
  assert.ok(game.interact('inspect'));assert.equal(game.heldOrder.note,outgoing.note);
  assert.equal(game.stations.inspect.part.orderId,102);assert.equal(game.tuning(),null);
  assert.ok(game.interact('ship'));advance(game,4.1);assert.equal(game.tuning().voice,0);
  assert.equal(game.tuning().orderId,102);
});

test('Covari supplies the engraved plate after two bells and adds no note or star progress',()=>{
  const game=shiftGame(role);hang(game,101);hang(game,102);
  assert.equal(game.sourcing,null);advance(game,9);assert.equal(game.sourcing.technology,'lm');
  assert.ok(game.requestSource());advance(game,22.05);game.interact('receiving');game.interact('inspect');
  advance(game,4.1);assert.equal(game.tuning(),null);assert.ok(game.interact('inspect'));
  const before=game.score,notes=[...game.peal];assert.ok(game.interact('ship'));
  assert.deepEqual(game.peal,notes);assert.equal(game.shipped,2);assert.equal(game.score-before,300);
  assert.equal(game.stars(),0);game.reset(role);assert.deepEqual(game.peal,[]);
});

test('a walked production route can fill every hook without dash or outsourcing',()=>{
  const result=simulateShift(role,{strategy:'flow',reaction:.8});
  assert.equal(result.shipped,8);assert.equal(result.stars,3);assert.equal(result.finishReason,'work-complete');
  assert.ok(!navigation.layoutFor('bell-terrace').some(s=>s.id==='laser'));
});

test('an explicit pitch key cuts the requested voice independently of the current sounding note',()=>{
  const game=shiftGame(role);cut(game,101);game.interact('inspect');advance(game,4.1);
  const tuning=game.tuning();assert.notEqual(tuning.note,tuning.choices[2]);
  assert.ok(game.interact('inspect',2));assert.ok(game.interact('ship'));
  assert.deepEqual(game.peal,[tuning.choices[2]]);
});
