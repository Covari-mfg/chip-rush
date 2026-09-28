import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ShopGame, PROGRAM_DURATION, stockType } from '../dist/core.js';
import { orderWorkflow } from '../dist/workflow.js';

function advance(game,seconds){for(let t=0;t<seconds;t+=.05)game.tick(Math.min(.05,seconds-t));}
for(const role of [0,1,2])test(`role ${role} route tells the player exactly when to collect material`,()=>{
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
  const context=vm.createContext({localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
  vm.runInContext(`let unlocked=0,bests=[0,0,0],grades=[0,0,0];function save(){localStorage.setItem(SAVE_KEY,JSON.stringify({unlocked,bests,grades}));}${migration};this.result={unlocked,bests,grades,migrationNotice};`,context);
  return {result:JSON.parse(JSON.stringify(context.result)),data};
}
test('new stock rules preserve unlocks and leave historical records intact',()=>{
  for(const version of ['v6','v5','v4','v3','v2']) {
    const old={unlocked:2,bests:[2900,5000,8000],grades:[3,3,3]},key='chip-rush-roles-'+version;
    const {result,data}=migrate({[key]:old});
    assert.deepEqual(result,{unlocked:2,bests:[0,0,0],grades:[0,0,0],migrationNotice:true});
    assert.deepEqual(JSON.parse(data.get(key)),old,'Historical records remain intact');
    assert.deepEqual(JSON.parse(data.get('chip-rush-roles-v7')).bests,[0,0,0]);
  }
});
test('current-season progress takes precedence over previous progress',()=>{
  const {result}=migrate({'chip-rush-roles-v7':{unlocked:1,bests:[1,2,3],grades:[1,2,3]},'chip-rush-roles-v6':{unlocked:2,bests:[9000,9000,9000]}});
  assert.deepEqual(result,{unlocked:1,bests:[1,2,3],grades:[1,2,3],migrationNotice:false});
});
