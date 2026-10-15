import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {SHIFTS,isPlayableShift,nextShiftIndex,shiftRuleset} from '../dist/core.js';

const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
function productionFunction(name){
  const start=main.indexOf(`function ${name}(`),end=main.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start,`${name} has a function boundary`);
  return main.slice(start,end);
}
function fixture(){
  const nodes=new Map(),started=[],briefings=[];
  const element=()=>({hidden:true,textContent:'',children:[],dataset:{},classList:{add(){},remove(){}},
    replaceChildren(...children){this.children=[...children];},appendChild(child){this.children.push(child);},
    setAttribute(){},focus(){}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const context=vm.createContext({shiftRuleset,SHIFTS,isPlayableShift,nextShiftIndex,$,
    document:{createElement:element},selectedShift:0,bests:SHIFTS.map(()=>0),grades:SHIFTS.map(()=>0),speedRecords:{},
    runTime:String,showHomeView(){},hidePanels(){},showModelCredit(){},clock:String,SHIFT_CREDIT:{},
    location:{hash:''},showMenu(){},briefingManager:false,
    endBeaconEnding(){},audio:{init(){}},phonePortrait:()=>false,closePopover(){},resetBays(){},enterFloor(){},
    resetPad(){},processEvents(){},updateUI(){},classicGame:{reset:index=>started.push(index)},launchGame:{},
    social:{start(){}},game:null,
  });
  vm.runInContext(['buildShiftPicker','startShift','showBriefing','applyHomeRoute','unlockCleared','playedFirstShift','unlockForSave'].map(productionFunction).join('\n'),context);
  return {context,$,started,briefings};
}

test('retirement keeps legacy identities and makes the next visible scenario Rush Hour',()=>{
  assert.equal(SHIFTS[1].id,'mixed-orders');assert.equal(SHIFTS[1].retired,true);
  assert.deepEqual(SHIFTS.slice(0,6).map(shift=>shift.id),['first-shift','mixed-orders','rush-hour','night-shift','dawn-shift','launch-window']);
  assert.equal(isPlayableShift(0),true);assert.equal(isPlayableShift(1),false);assert.equal(isPlayableShift(2),true);
  for(const index of [-1,NaN,SHIFTS.length,'2'])assert.equal(isPlayableShift(index),false);
  assert.equal(nextShiftIndex(0),2);assert.equal(nextShiftIndex(2),3);
  assert.equal(nextShiftIndex(SHIFTS.length-1),-1);
});

test('the picker hides the retired slot and keeps record indices aligned',()=>{
  const f=fixture();f.context.bests[1]=9999;f.context.bests[2]=4321;f.context.grades[2]=2;
  f.context.buildShiftPicker();
  const choices=f.$('shift-picker').children;
  assert.deepEqual(choices.map(button=>button.dataset.levelId),SHIFTS.filter(shift=>!shift.retired).map(shift=>shift.id));
  choices[1].onclick();
  assert.equal(f.context.selectedShift,2);assert.equal(f.$('selection-record').textContent,'4,321 pts');
  assert.match(f.$('shift-picker').children[1].innerHTML,/Rush Hour/);
  assert.match(f.$('shift-picker').children[1].innerHTML,/★★/);
});

test('old briefing URLs and direct entry guards cannot play Mixed Orders',()=>{
  const f=fixture();
  f.context.showBriefing(1);assert.equal(f.$('briefing-panel').hidden,true);
  f.context.startShift(1);assert.deepEqual(f.started,[]);
  f.context.location.hash='#/challenges/mixed-orders';f.context.applyHomeRoute();
  assert.equal(f.$('briefing-panel').hidden,true);assert.equal(f.context.selectedShift,0);
  f.context.location.hash='#/challenges/rush-hour';f.context.applyHomeRoute();
  assert.equal(f.$('briefing-panel').hidden,false);assert.equal(f.context.selectedShift,2);
  f.context.startShift(2);assert.deepEqual(f.started,[2]);
  assert.match(f.$('shift-number').textContent,/^SHIFT 02 /,'Display numbering excludes retired slots');
});

test('Next Shift skips the retired slot and the last playable entry retries itself',()=>{
  const f=fixture(),shown=[];
  const handler=main.match(/\$\('next-button'\)\.onclick=(.*?);\$\('replay-button'\)/)?.[1];
  assert.ok(handler,'Next Shift production handler is present');
  f.context.showBriefing=index=>shown.push(index);f.context.challengeRun=false;
  f.context.game={manager:false,shiftIndex:0,passed:()=>true};
  vm.runInContext(`(${handler})()`,f.context);assert.deepEqual(shown,[2]);
  f.context.game.shiftIndex=SHIFTS.length-1;
  vm.runInContext(`(${handler})()`,f.context);assert.equal(shown.at(-1),SHIFTS.length-1);
});

test('legacy saved progress still unlocks successors without reindexing scores',()=>{
  const f=fixture(),bests=[0,2700,0],grades=[0,3,0];
  assert.equal(f.context.unlockForSave(1,bests,grades),2);
  assert.deepEqual(bests,[0,2700,0]);assert.deepEqual(grades,[0,3,0]);
  assert.equal(f.context.unlockForSave(0,[100],[]),SHIFTS.length-1,'The recommended introduction keeps its existing save semantics');
});
