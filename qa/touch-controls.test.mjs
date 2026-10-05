import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const start=main.indexOf("  for(const [id,action] of [['mobile-dash',mobileDash]"),end=main.indexOf('\n}\nfunction registerTools()',start);
assert.ok(start>0&&end>start);
function controls(){
  const nodes=new Map(),actions=[];
  const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:92,height:92})});return nodes.get(id);};
  const context=vm.createContext({$,Math,interact:()=>actions.push('interact'),dash:()=>actions.push('dash'),mobileDash:()=>actions.push('dash')});
  vm.runInContext(main.slice(start,end),context);
  const pointer=(id,x=76,y=46)=>({pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){}});
  return {$,context,actions,pointer};
}

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
