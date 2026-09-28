import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=(await readFile(new URL('../dist/audio.js',import.meta.url),'utf8')).replace('export class ShopAudio','class ShopAudio')+'\nthis.ShopAudio=ShopAudio;';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup({delayed=false,fail=false,noTimeout=false}={}){
  const sources=[],oscillators=[];let fetches=0,resolveDecode;
  const parameter=()=>({value:0,targets:[],setTargetAtTime(v){this.targets.push(v);this.value=v;},setValueAtTime(v){this.value=v;},cancelScheduledValues(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({gain:parameter(),connect(){},disconnect(){}});
  class Context{
    constructor(){this.currentTime=0;this.state='suspended';this.destination={};}
    createGain(){return node();}
    resume(){this.state='running';return Promise.resolve();}
    decodeAudioData(){return delayed?new Promise(r=>{resolveDecode=r;}):Promise.resolve({duration:1628308/44100});}
    createBufferSource(){const n={...node(),start(...args){this.started=args;},stop(...args){this.stopped=args;}};sources.push(n);return n;}
    createOscillator(){const n={...node(),frequency:parameter(),start(){this.started=true;},stop(){}};oscillators.push(n);return n;}
  }
  const context=vm.createContext({window:{AudioContext:Context},AbortSignal:noTimeout?{}:AbortSignal,fetch:async()=>{fetches++;if(fail&&fetches===1)throw new Error('offline');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};}});
  vm.runInContext(code,context);const audio=new context.ShopAudio();
  return {audio,sources,oscillators,get fetches(){return fetches;},decode(){resolveDecode({duration:1628308/44100});}};
}
test('no autoplay; one loop loads and plays beneath existing cues',async()=>{
  const f=setup();assert.equal(f.audio.ctx,null);assert.equal(f.fetches,0);
  f.audio.init();await settle();assert.equal(f.sources.length,0);
  f.audio.update(true);f.audio.update(true);f.audio.init();await settle();
  assert.equal(f.fetches,1);assert.equal(f.sources.length,1);assert.equal(f.sources[0].loop,true);
  assert.ok(Math.abs(f.sources[0].loopEnd-64*60/104)<.0001);
  assert.ok(f.audio.musicGain.gain.value*f.audio.master.gain.value<.16);
  f.audio.event('ready');assert.equal(f.oscillators.length,2);
});
test('pausing while music decodes cannot start background playback',async()=>{
  const f=setup({delayed:true});f.audio.init();f.audio.update(true);await settle();f.audio.update(false);f.decode();await settle();assert.equal(f.sources.length,0);
  f.audio.update(true);assert.equal(f.sources.length,1);
});
test('pause stops its source and resume continues the loop from the paused position',async()=>{
  const f=setup();f.audio.init();await settle();f.audio.update(true);f.audio.ctx.currentTime=41;f.audio.update(false);
  assert.ok(f.sources[0].stopped[0]<=41.061);assert.equal(f.audio.musicSource,null);
  f.audio.ctx.currentTime=100;f.audio.update(true);
  assert.equal(f.sources.length,2);assert.ok(Math.abs(f.sources[1].started[1]-(41-f.sources[0].loopEnd))<.001);
});
test('phone ducking lowers only the music and restores the background mix',async()=>{
  const f=setup();f.audio.init();await settle();f.audio.update(true);
  const normal=f.audio.musicGain.gain.value,master=f.audio.master.gain.value;
  f.audio.update(true,true);assert.ok(f.audio.musicGain.gain.value<normal/3);assert.equal(f.audio.master.gain.value,master);
  f.audio.update(true,false);assert.equal(f.audio.musicGain.gain.value,normal);assert.equal(f.sources.length,1);
});
test('a failed track load leaves cues working and retries on the next gesture',async()=>{
  const f=setup({fail:true});f.audio.init();f.audio.update(true);await settle();f.audio.event('pickup');assert.equal(f.oscillators.length,1);assert.equal(f.sources.length,0);
  f.audio.init();await settle();assert.equal(f.fetches,2);assert.equal(f.sources.length,1);
});

test('older browsers without AbortSignal.timeout can still start music',async()=>{
  const f=setup({noTimeout:true});assert.doesNotThrow(()=>f.audio.init());f.audio.update(true);await settle();assert.equal(f.sources.length,1);
});
