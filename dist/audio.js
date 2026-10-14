// Original 104 BPM country/bluegrass loop, procedural 128 BPM storm-synth buffer,
// and locally synthesized shop cues. Audio unlocks on a home-screen gesture or clock-in.
const MUSIC_URL='./assets/music/country-bluegrass-104.mp3';
const MUSIC_LOOP_SECONDS=1628308/44100;
const STORM_LOOP_SECONDS=32*60/128; // 15.0s seamless 8-bar 128 BPM synthwave loop
const MUSIC_LEVEL=.65; // With the .24 master: about 16 dB below the audition.
function buildStormBuffer(ctx){
  if(typeof ctx.createBuffer!=='function')return null;
  const rate=ctx.sampleRate||44100,len=Math.floor(rate*STORM_LOOP_SECONDS);
  const buffer=ctx.createBuffer(2,len,rate);
  const L=buffer.getChannelData(0),R=buffer.getChannelData(1);
  const stepSec=60/128/4; // 16th note (0.1171875s), 128 steps total
  const bassNotes=[55,55,110,55, 65.41,65.41,130.81,65.41, 73.42,73.42,146.83,73.42, 61.74,61.74,98,82.41];
  const arpNotes=[220,261.63,329.63,440, 329.63,261.63,392,329.63, 293.66,349.23,440,587.33, 392,329.63,293.66,246.94];
  let bassPhase=0,arpPhase=0,padPhaseA=0,padPhaseB=0,noiseSeed=1337;
  for(let i=0;i<len;i++){
    const t=i/rate,step=Math.floor(t/stepSec)%128,inStep=(t%stepSec)/stepSec;
    const bar=Math.floor(step/16),sixteenth=step%16;
    const progShift=bar>=4?(bar%2===1?1.122462:1.059463):1;
    const bassFreq=bassNotes[sixteenth]*progShift;
    const arpFreq=arpNotes[(sixteenth+bar*2)%16]*progShift;
    bassPhase=(bassPhase+bassFreq/rate)%1;
    arpPhase=(arpPhase+arpFreq/rate)%1;
    padPhaseA=(padPhaseA+(110*progShift)/rate)%1;
    padPhaseB=(padPhaseB+(164.81*progShift)/rate)%1;
    const bassEnv=Math.exp(-inStep*5.2);
    const bass=(bassPhase*2-1)*.26*bassEnv+(Math.sin(bassPhase*Math.PI*2)*.18*bassEnv);
    const arpEnv=Math.exp(-inStep*8.5);
    const arp=(arpPhase<.5?.22:-.22)*arpEnv;
    const pad=(Math.sin(padPhaseA*Math.PI*2)+Math.sin(padPhaseB*Math.PI*2))*.06;
    // Electronic kick on 0, 4, 8, 12 and crisp snare/hat pulse
    let drum=0;
    if(sixteenth%4===0){
      const kt=inStep*stepSec;
      drum+=Math.sin(kt*Math.PI*2*(135*Math.exp(-kt*28)+42))*Math.exp(-kt*14)*.34;
    }
    noiseSeed=(noiseSeed*1664525+1013904223)>>>0;
    const white=((noiseSeed/4294967296)*2-1);
    if(sixteenth%4===2)drum+=white*Math.exp(-inStep*11)*.14;
    else drum+=white*Math.exp(-inStep*24)*.045;
    const pan=Math.sin(t*Math.PI*.5)*.28;
    L[i]=Math.max(-.95,Math.min(.95,bass+pad+drum+arp*(.7-pan)));
    R[i]=Math.max(-.95,Math.min(.95,bass+pad+drum+arp*(.7+pan)));
  }
  return buffer;
}
export class ShopAudio {
  constructor(){
    this.ctx=null;this.active=false;this.ducked=false;this.track='country';
    this.musicBuffer=null;this.stormBuffer=null;this.musicSource=null;this.musicOffset=0;this.musicLoad=null;
  }
  setTrack(track='country'){
    const next=track==='storm'?'storm':'country';
    if(next===this.track)return;
    this.track=next;
    if(this.ctx&&this.musicSource){
      const now=this.ctx.currentTime,{source,fade}=this.musicSource;
      fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.015);
      source.stop(now+.06);this.musicSource=null;this.musicOffset=0;
    }
    this.syncMusic();
  }
  init(){
    if(!this.ctx){
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.24;
      this.master.connect(this.ctx.destination);this.musicGain=this.ctx.createGain();
      this.musicGain.gain.value=MUSIC_LEVEL*(this.ducked?.28:1);this.musicGain.connect(this.master);
    }
    if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    if(!this.musicBuffer&&!this.musicLoad){
      this.musicLoad=Promise.resolve().then(()=>fetch(MUSIC_URL,{signal:globalThis.AbortSignal?.timeout?.(15000)}))
        .then(response=>{if(!response.ok)throw new Error('Music unavailable');return response.arrayBuffer();})
        .then(bytes=>this.ctx.decodeAudioData(bytes))
        .then(buffer=>{this.musicBuffer=buffer;this.syncMusic();})
        .catch(()=>{this.musicLoad=null;}); // Cues and gameplay still work; retry on resume.
    }
    if(this.track==='storm')this.syncMusic();
  }
  syncMusic(){
    if(!this.ctx)return;
    const now=this.ctx.currentTime;
    const useStorm=this.track==='storm'&&(this.stormBuffer||(this.stormBuffer=buildStormBuffer(this.ctx)));
    const buffer=useStorm?this.stormBuffer:this.musicBuffer;
    const loopCap=useStorm?STORM_LOOP_SECONDS:MUSIC_LOOP_SECONDS;
    if(!this.active&&this.musicSource){
      const {source,fade,startedAt,offset}=this.musicSource;
      this.musicOffset=(offset+now-startedAt)%source.loopEnd;
      fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.012);
      source.stop(now+.06);this.musicSource=null;
    }else if(this.active&&buffer&&!this.musicSource){
      const source=this.ctx.createBufferSource(),fade=this.ctx.createGain();
      source.buffer=buffer;source.loop=true;source.loopStart=0;
      source.loopEnd=Math.min(loopCap,buffer.duration);
      const offset=this.musicOffset%source.loopEnd;
      source.connect(fade);fade.connect(this.musicGain);fade.gain.setValueAtTime(0,now);
      fade.gain.setTargetAtTime(1,now,.025);
      source.onended=()=>{source.disconnect();fade.disconnect();};
      source.start(now,offset);this.musicSource={source,fade,startedAt:now,offset};
    }
  }
  note(freq,duration=.12,type='sine',volume=.25,delay=0,endFreq){if(!this.ctx)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);}
  event(type){switch(type){case'call':[660,880,660,880].forEach((f,i)=>this.note(f,.1,'sine',.14,i*.15));break;case'programmed':this.note(660,.12,'triangle',.18);this.note(990,.22,'triangle',.18,.12);break;case'surge':[330,495,660,990].forEach((f,i)=>this.note(f,.18,'sawtooth',.16,i*.055,f*1.25));this.note(92,.38,'triangle',.24,0,46);break;case'overdrive':this.note(440,.14,'sawtooth',.14,0,880);this.note(660,.18,'triangle',.16,.07,990);break;case'rushWon':[784,988,1175].forEach((f,i)=>this.note(f,.3,'triangle',.2,i*.1));break;case'pickup':this.note(420,.12,'triangle',.24,0,740);break;case'park':this.note(270,.11,'triangle',.3,0,160);break;case'load':this.note(180,.23,'sawtooth',.06,0,70);this.note(780,.08,'sine',.18,.03);break;case'ready':this.note(740,.25,'sine',.28);this.note(990,.3,'sine',.2,.11);break;case'arrival':this.note(640,.09,'triangle',.18);this.note(850,.14,'triangle',.18,.1);break;case'shipped':[523,659,784,1047].forEach((f,i)=>this.note(f,.26,'triangle',.26,i*.07));break;case'expired':this.note(180,.25,'triangle',.2,0,90);break;case'hint':this.note(160,.1,'sine',.13);break;case'dash':this.note(200,.11,'sine',.13,0,700);break;case'finish':[392,523,659,784].forEach((f,i)=>this.note(f,.5,'triangle',.25,i*.13));break;case'select':this.note(880,.05,'sine',.08);break;}}
  update(active,ducked=false){
    this.active=active;
    if(this.ctx&&ducked!==this.ducked)this.musicGain.gain.setTargetAtTime(MUSIC_LEVEL*(ducked?.28:1),this.ctx.currentTime,.16);
    this.ducked=ducked;this.syncMusic();
  }
}
