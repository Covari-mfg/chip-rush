import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
const from=main.indexOf('function endBeaconEnding()'),to=main.indexOf('\nfunction updateHarbor(',from);
assert.ok(from>=0&&to>from);
function fixture(active=true){
  const elements=Object.fromEntries(['beacon-finale','tender-panel'].map(id=>[id,{hidden:false}]));
  const beaconGame={mode:'terminal'},game=active?beaconGame:{mode:'playing'};
  const context=vm.createContext({beaconGame,game,beaconEnding:active?{t:5}:null,$:id=>elements[id],document:{body:{classList:{remove(){}}}}});
  vm.runInContext(main.slice(from,to),context);
  return {context,elements,game};
}
test('leaving the lighthouse ending enters results so audio and frame pacing stop',()=>{
  const f=fixture();f.context.endBeaconEnding();
  assert.equal(f.game.mode,'results');assert.equal(f.context.beaconEnding,null);
  assert.ok(Object.values(f.elements).every(element=>element.hidden));
});
test('clearing an inactive lighthouse ending leaves another shift alone',()=>{
  const f=fixture(false);f.context.endBeaconEnding();assert.equal(f.game.mode,'playing');
});
