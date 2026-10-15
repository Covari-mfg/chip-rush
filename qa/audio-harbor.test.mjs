import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const code=(await readFile(new URL('../dist/audio.js',import.meta.url),'utf8')).replace('export class ShopAudio','class ShopAudio')+'\nthis.ShopAudio=ShopAudio;';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const loopSeconds=32*60/92;
function setup({sampleRate=8000,offline=false,bufferSupport=true}={}){
  const sources=[],oscillators=[];let fetches=0,buffers=0;
  const parameter=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},cancelScheduledValues(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({gain:parameter(),connect(){},disconnect(){}});
  class Context{
    constructor(){this.currentTime=0;this.state='running';this.destination={};this.sampleRate=sampleRate;}
    createGain(){return node();}
    decodeAudioData(){return Promise.resolve({duration:40});}
    createBuffer(channels,length,rate){buffers++;const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,length,numberOfChannels:channels,sampleRate:rate,getChannelData:c=>data[c]};}
    createBufferSource(){const source={...node(),start(...args){this.started=args;},stop(...args){this.stopped=args;}};sources.push(source);return source;}
    createOscillator(){const oscillator={...node(),frequency:parameter(),start(){},stop(){}};oscillators.push(oscillator);return oscillator;}
  }
  if(!bufferSupport)Context.prototype.createBuffer=undefined;
  const context=vm.createContext({window:{AudioContext:Context},fetch:async()=>{fetches++;if(offline)throw new Error('offline');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};}});
  vm.runInContext(code,context);
  return {audio:new context.ShopAudio(),sources,oscillators,get fetches(){return fetches;},get buffers(){return buffers;}};
}

test('harbor synthesizes a bounded stereo 92 BPM loop at the browser sample rate',async()=>{
  const f=setup({sampleRate:44100,offline:true});f.audio.setTrack('harbor');f.audio.update(true);f.audio.init();await settle();
  assert.equal(f.audio.track,'harbor');assert.equal(f.sources.length,1);
  const buffer=f.sources[0].buffer;
  assert.equal(buffer.sampleRate,44100);assert.equal(buffer.numberOfChannels,2);
  assert.equal(buffer.length,Math.round(loopSeconds*44100));
  assert.ok(Math.abs(f.sources[0].loopEnd-loopSeconds)<1/44100);
  let energy=0,peak=0,difference=0;
  const L=buffer.getChannelData(0),R=buffer.getChannelData(1);
  for(let i=0;i<L.length;i++){
    assert.ok(Number.isFinite(L[i])&&Number.isFinite(R[i]));
    energy+=L[i]*L[i]+R[i]*R[i];peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));difference+=Math.abs(L[i]-R[i]);
  }
  const rms=Math.sqrt(energy/(L.length*2));
  assert.ok(rms>.06&&rms<.1,`RMS ${rms}`);assert.ok(peak<.651,`peak ${peak}`);
  assert.ok(difference/L.length>.005,'score has stereo placement');
  for(const channel of [L,R])assert.ok(Math.abs(channel[0]-channel.at(-1))<.015,'wrapped notes and sea hush meet without a large jump');
  assert.equal(f.fetches,1,'the existing country preload remains the only fetch');
});

test('harbor plays while the country file is offline and pause/resume reuses its buffer',async()=>{
  const f=setup({offline:true});f.audio.setTrack('harbor');f.audio.init();f.audio.update(true);await settle();
  assert.equal(f.sources.length,1);assert.equal(f.buffers,1);
  const buffer=f.audio.harborBuffer;f.audio.ctx.currentTime=loopSeconds+3.25;f.audio.update(false);
  assert.equal(f.audio.musicSource,null);assert.ok(f.sources[0].stopped);
  f.audio.ctx.currentTime=100;f.audio.update(true);
  assert.equal(f.sources.length,2);assert.equal(f.sources[1].buffer,buffer);assert.equal(f.buffers,1);
  assert.ok(Math.abs(f.sources[1].started[1]-3.25)<1/8000);
  f.audio.setTrack('harbor');assert.equal(f.sources.length,2,'selecting the same track does not restart it');
});

test('paused track changes start harbor at its beginning and retain country/storm transitions',async()=>{
  const f=setup();f.audio.init();await settle();f.audio.update(true);
  f.audio.ctx.currentTime=9;f.audio.update(false);f.audio.setTrack('harbor');
  assert.equal(f.sources.length,1,'changing tracks while paused cannot play');
  f.audio.update(true);assert.equal(f.sources.length,2);assert.equal(f.sources[1].started[1],0);
  f.audio.setTrack('storm');assert.equal(f.audio.track,'storm');assert.equal(f.sources.length,3);assert.ok(f.sources[1].stopped);
  f.audio.setTrack('country');assert.equal(f.audio.track,'country');assert.equal(f.sources.length,4);assert.equal(f.sources[3].buffer,f.audio.musicBuffer);
});

test('leaving launch for harbor fades its stems and returning to launch resets the layers',async()=>{
  const f=setup();f.audio.setTrack('launch');f.audio.init();f.audio.update(true);await settle();
  assert.equal(f.sources.length,3);f.audio.setIntensity(2);f.audio.ctx.currentTime=4;
  f.audio.setTrack('harbor');assert.equal(f.sources.length,4);assert.equal(f.audio.stemSources,null);
  assert.ok(f.sources.slice(0,3).every(source=>source.stopped));
  f.audio.setTrack('launch');assert.equal(f.sources.length,7);assert.equal(f.audio.intensity,0);
  assert.ok(f.sources[3].stopped);assert.ok(f.sources.slice(4).every(source=>source.started[1]===0));
});

test('harbor falls back to the existing file if a context cannot construct buffers',async()=>{
  const f=setup({bufferSupport:false});f.audio.setTrack('harbor');f.audio.init();f.audio.update(true);await settle();
  assert.equal(f.sources.length,1);assert.equal(f.sources[0].buffer,f.audio.musicBuffer);assert.equal(f.audio.harborBuffer,null);
  f.audio.event('tenderDeparted');f.audio.event('beaconLit');assert.equal(f.oscillators.length,6);
});

test('harbor synthesis is deterministic and stays silent until audio unlocks',async()=>{
  const a=setup({offline:true}),b=setup({offline:true});
  a.audio.setTrack('harbor');a.audio.update(true);assert.equal(a.sources.length,0);assert.equal(a.fetches,0);assert.equal(a.audio.ctx,null);
  a.audio.init();b.audio.setTrack('harbor');b.audio.init();await settle();
  assert.deepEqual(a.audio.harborBuffer.getChannelData(0),b.audio.harborBuffer.getChannelData(0));
  assert.equal(b.sources.length,0,'preparing a buffer while inactive cannot play');
});
