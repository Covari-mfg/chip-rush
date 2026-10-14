import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ShopGame, SHIFTS } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';
import { runTime, readSpeedRecords, recordClear } from '../dist/records.js';

// Shipping is the production command; these fixtures represent inspected parts
// already in the player's hands so the split can be tested without a renderer.
function ship(game, at, sourced=false) {
  game.elapsed=at;
  const order={id:sourced?201:100+game.shipped,route:['ship'],index:0,location:'hands',programmed:true,value:120,remaining:30,deadline:82};
  if(sourced){game.sourcing={...order,state:'delivered'};game.sourceOffered=true;}
  else game.orders.push(order);
  game.hand={orderId:order.id};
  assert.equal(game.interact('ship'),true);
}

test('clear split is the target shipment, stays frozen, and resets on replay in both engines',()=>{
  for(const index of [0,SHIFTS.findIndex(s=>s.id==='launch-window')]) {
    const game=shiftGame(index);game.orders=[];
    for(let n=1;n<=game.config.passTarget;n++){
      ship(game,n*12);
      assert.equal(game.clearElapsed,n===game.config.passTarget?n*12:null);
    }
    const split=game.clearElapsed;ship(game,split+20);assert.equal(game.clearElapsed,split);
    game.reset(index);assert.equal(game.clearElapsed,null);
  }
});

test('outsourced shipment adds points without advancing the speedrun target',()=>{
  const game=new ShopGame();game.reset(1);game.orders=[];
  ship(game,20,true);assert.equal(game.shipped,0);assert.equal(game.sourced,1);assert.equal(game.clearElapsed,null);
});

test('a faster clear updates independently of score and a failed run sets no record',()=>{
  const records={};const game={config:SHIFTS[0],clearElapsed:75,passed:()=>true,score:5000};
  assert.equal(recordClear(records,game),true);
  assert.equal(recordClear(records,{...game,score:1000,clearElapsed:64}),true);
  assert.equal(records['first-shift'],64);
  assert.equal(recordClear(records,{...game,clearElapsed:90}),false);
  assert.equal(recordClear(records,{...game,passed:()=>false,clearElapsed:12}),false);
  const storage={getItem:()=>JSON.stringify({...records,'launch-window':-1,'unknown-level':2})};
  assert.deepEqual(readSpeedRecords(storage,SHIFTS),{'first-shift':64});
  assert.equal(runTime(64.26),'1:04.3');assert.equal(runTime(null),'—');assert.equal(runTime(59.96),'1:00.0');
});

test('every challenge is selectable for a fresh save without changing stable catalog order',async()=>{
  const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
  const credits=main.slice(main.indexOf('const SHIFT_CREDIT='),main.indexOf('\nfunction buildShiftPicker'));
  const picker=main.slice(main.indexOf('function buildShiftPicker('),main.indexOf('\nfunction playSelection('));
  const holder={children:[],replaceChildren(){this.children=[];},appendChild(node){this.children.push(node);}};
  const nodes=new Map();const $=id=>{if(id==='shift-picker')return holder;if(!nodes.has(id))nodes.set(id,{setAttribute(){}});return nodes.get(id);};const start=$('start-button');const context=vm.createContext({SHIFTS,runTime,homeView:'challenges',savedRunSummary:()=>null,selectedShift:0,unlocked:0,bests:SHIFTS.map(()=>0),grades:SHIFTS.map(()=>0),speedRecords:{},$,document:{createElement:()=>({dataset:{},setAttribute(){}})}});
  vm.runInContext(credits+'\n'+picker+'\nbuildShiftPicker();',context);
  const cards=holder.children.filter(n=>n.dataset.levelId);assert.deepEqual(cards.map(c=>c.dataset.levelId),SHIFTS.map(s=>s.id));
  assert.ok(cards.every(c=>!c.disabled));cards.at(-1).onclick();assert.match(start.innerHTML,/Launch Window/);
});


test('one Play action starts a shift, starts a shop, or resumes its saved day directly',async()=>{
  const source=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('function playSelection('),source.indexOf('function navigateHome('));
  const calls=[],game={manager:false,mode:'menu'};
  const context=vm.createContext({homeView:'challenges',selectedShift:5,game,savedRunSummary:()=>null,startShift:i=>calls.push(['shift',i]),startManager:()=>calls.push(['new shop']),resumeManager:()=>{game.manager=true;game.mode='paused';calls.push(['restore']);},resume:()=>{game.mode='playing';calls.push(['resume']);}});
  vm.runInContext(body,context);context.playSelection();assert.deepEqual(calls,[['shift',5]]);
  calls.length=0;context.homeView='business';context.playSelection();assert.deepEqual(calls,[['new shop']]);
  calls.length=0;context.savedRunSummary=()=>({day:4});context.playSelection();assert.deepEqual(calls,[['restore'],['resume']]);assert.equal(game.mode,'playing');
});
