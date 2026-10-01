import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const start=main.indexOf("  const joystick=$('joystick');"),end=main.indexOf('\n}\nfunction registerTools()',start);
assert.ok(start>0&&end>start);
function controls(){
  const nodes=new Map(),actions=[];
  const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:92,height:92})});return nodes.get(id);};
  const context=vm.createContext({$,Math,touchVector:{x:0,y:0},interact:()=>actions.push('interact'),dash:()=>actions.push('dash'),mobileDash:()=>actions.push('dash')});
  vm.runInContext(main.slice(start,end),context);
  const pointer=(id,x=76,y=46)=>({pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){}});
  return {$,context,actions,pointer};
}

test('the right thumb can interact and dash while the left thumb continues moving',()=>{
  const f=controls(),joystick=f.$('joystick');
  joystick.onpointerdown(f.pointer(1));
  assert.equal(f.context.touchVector.x,1);
  f.$('touch-interact').onpointerdown(f.pointer(2));
  f.$('touch-dash').onpointerdown(f.pointer(2));
  assert.deepEqual(f.actions,['interact','dash']);
  assert.equal(f.context.touchVector.x,1,'Button thumb does not release movement');
  joystick.onpointerup(f.pointer(2));
  assert.equal(f.context.touchVector.x,1,'An unrelated pointer cannot stop the movement thumb');
  joystick.onpointercancel(f.pointer(1));
  assert.equal(f.context.touchVector.x,0);
  assert.equal(f.context.touchVector.y,0);
});

test('another finger cannot steal the joystick, and lost capture stops movement',()=>{
  const f=controls(),joystick=f.$('joystick');
  joystick.onpointerdown(f.pointer(1));
  joystick.onpointerdown(f.pointer(2,16));
  joystick.onpointermove(f.pointer(2,16));
  assert.equal(f.context.touchVector.x,1);
  joystick.onlostpointercapture(f.pointer(1));
  assert.equal(f.context.touchVector.x,0);
  joystick.onpointerdown(f.pointer(2,16));
  assert.equal(f.context.touchVector.x,-1);
});

test('pointer and assistive activation each trigger an action once',()=>{
  const f=controls(),button=f.$('touch-interact');
  button.onpointerdown(f.pointer(1));
  button.onclick({detail:1});
  assert.deepEqual(f.actions,['interact']);
  button.onclick({detail:0});
  assert.deepEqual(f.actions,['interact','interact']);
});

test('the mobile Dash button activates once per pointer press or assistive click',()=>{
  const f=controls(),button=f.$('mobile-dash');
  button.onpointerdown(f.pointer(1));
  button.onclick({detail:1});
  assert.deepEqual(f.actions,['dash']);
  button.onclick({detail:0});
  assert.deepEqual(f.actions,['dash','dash']);
  button.disabled=true;
  button.onpointerdown(f.pointer(2));
  button.onclick({detail:0});
  assert.deepEqual(f.actions,['dash','dash'],'Disabled cooldown or call button cannot activate');
});
