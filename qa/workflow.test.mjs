import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ShopGame, SHIFTS, PROGRAM_DURATION, stockType } from '../dist/core.js';
import { orderWorkflow } from '../dist/workflow.js';

function advance(game,seconds){for(let t=0;t<seconds;t+=.05)game.tick(Math.min(.05,seconds-t));}
for(const role of [0,1,2,3])test(`role ${role} route tells the player exactly when to collect material`,()=>{
  const game=new ShopGame();game.reset(role);game.nextArrival=Infinity;game.nextCallAt=Infinity;
  const order=game.selected;
  let steps=orderWorkflow(order,game.config.programming);
  assert.equal(steps.find(s=>s.active).key,role?'cad':`material-${stockType(order)}`);
  assert.equal(steps.find(s=>s.key===`material-${stockType(order)}`).done,false);
  assert.ok(!steps.find(s=>s.key===order.route[0]).active);
  if(role){
    game.setOfficePresence(true);game.interact('office');advance(game,PROGRAM_DURATION+.05);
    steps=orderWorkflow(order,true);
    assert.equal(steps.find(s=>s.key==='cad').done,true);
    assert.equal(steps.find(s=>s.active).key,`material-${stockType(order)}`);
    assert.equal(steps.find(s=>s.key===`material-${stockType(order)}`).done,false);
    assert.equal(game.hand,null,'CAD does not put a physical part in your hands');
  }
  game.interact(`material-${stockType(order)}`);steps=orderWorkflow(order,game.config.programming);
  assert.equal(steps.find(s=>s.key===`material-${stockType(order)}`).done,true);
  assert.equal(steps.find(s=>s.active).key,order.route[0]);
  game.interact('material-'+stockType(order));steps=orderWorkflow(order,game.config.programming);
  assert.equal(steps.find(s=>s.key===`material-${stockType(order)}`).done,false,'Recycled stock needs collecting again');
  assert.equal(steps.find(s=>s.active).key,`material-${stockType(order)}`);
});
test('combined route shows both machines in order and inspection after them',()=>{
  const order={programmed:true,started:true,route:['lathe','mill','inspect','ship'],index:1};
  const steps=orderWorkflow(order,true);
  assert.deepEqual(steps.map(s=>s.label),['CAD','BLOCK','TURN','MILL','QC','SHIP']);
  assert.deepEqual(steps.filter(s=>s.done).map(s=>s.key),['cad','material-block','lathe']);
  assert.deepEqual(steps.filter(s=>s.active).map(s=>s.key),['mill']);
});
const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const migration=main.slice(main.indexOf("const SAVE_KEY="),main.indexOf('const STATION_LAYOUT='));
function migrate(initial){
  const data=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
  const context=vm.createContext({SHIFTS,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
  vm.runInContext(`let unlocked=0,bests=SHIFTS.map(()=>0),grades=SHIFTS.map(()=>0);function save(){localStorage.setItem(SAVE_KEY,JSON.stringify({unlocked,bests,grades}));}${migration};this.result={unlocked,bests,grades};`,context);
  return {result:JSON.parse(JSON.stringify(context.result)),data};
}
test('optional call rules preserve unlocks and leave historical records intact',()=>{
  for(const version of ['v7','v6','v5','v4','v3','v2']) {
    const old={unlocked:2,bests:[2900,5000,8000],grades:[3,3,3]},key='chip-rush-roles-'+version;
    const {result,data}=migrate({[key]:old});
    assert.deepEqual(result,{unlocked:3,bests:[0,0,0,0],grades:[0,0,0,0]},'Clearing the last earlier level unlocks Night Shift');
    assert.deepEqual(JSON.parse(data.get(key)),old,'Historical records remain intact');
    assert.deepEqual(JSON.parse(data.get('chip-rush-roles-v8')).bests,[0,0,0,0]);
  }
  const {result}=migrate({'chip-rush-roles-v7':{unlocked:2,bests:[1,2,3],grades:[3,2,0]}});
  assert.equal(result.unlocked,2,'An uncleared Rush Hour leaves Night Shift locked');
});
test('current-season progress takes precedence over previous progress',()=>{
  const {result}=migrate({'chip-rush-roles-v8':{unlocked:1,bests:[1,2,3],grades:[1,0,0]},'chip-rush-roles-v6':{unlocked:2,bests:[9000,9000,9000]}});
  assert.deepEqual(result,{unlocked:1,bests:[1,2,3,0],grades:[1,0,0,0]});
});
test('a save from before Night Shift keeps its records and unlocks it once Rush Hour is cleared',()=>{
  const saved={unlocked:2,bests:[3500,4400,3900],grades:[3,3,1]};
  const {result}=migrate({'chip-rush-roles-v8':saved});
  assert.deepEqual(result,{unlocked:3,bests:[3500,4400,3900,0],grades:[3,3,1,0]});
  assert.equal(migrate({'chip-rush-roles-v8':{...saved,grades:[3,3,0]}}).result.unlocked,2,'Rush Hour must be cleared first');
});
test('stars from a friend challenge on a locked level unlock nothing',()=>{
  const {result}=migrate({'chip-rush-roles-v8':{unlocked:0,bests:[0,0,9000],grades:[0,0,3]}});
  assert.equal(result.unlocked,0);
  assert.equal(migrate({'chip-rush-roles-v8':{unlocked:1,bests:[0,0,0],grades:[0,0,3]}}).result.unlocked,1,'Only a cleared, unlocked level advances progress');
});
test('a save can never unlock past the final level',()=>{
  assert.equal(migrate({'chip-rush-roles-v8':{unlocked:99,bests:[],grades:[3,3,3,3]}}).result.unlocked,SHIFTS.length-1);
});
