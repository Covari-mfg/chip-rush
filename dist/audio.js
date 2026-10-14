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
// Launch Window's original 120 BPM countdown score: three synchronised stems
// (scripts/music/generate_launch_music.py). The count decides how many play.
const LAUNCH_STEMS=['./assets/music/launch-base-120.mp3','./assets/music/launch-drive-120.mp3','./assets/music/launch-climax-120.mp3'];
const LAUNCH_LOOP_SECONDS=32;
const LAYERS=[[1,0,0],[1,1,0],[1,1,1],[.8,1,1]];
export class ShopAudio {
  constructor(){
    this.ctx=null;this.active=false;this.ducked=false;this.track='country';
    this.musicBuffer=null;this.stormBuffer=null;this.musicSource=null;this.musicOffset=0;this.musicLoad=null;
    this.stemBuffers=null;this.stemLoad=null;this.stemSources=null;this.stemOffset=0;this.intensity=0;
  }
  // 'country' is the shop's loop, 'storm' Blackout Shift's synthesized loop,
  // 'launch' Launch Window's layered countdown stems.
  setTrack(track='country'){
    const next=['storm','launch'].includes(track)?track:'country';
    if(next===this.track)return;
    this.track=next;
    if(this.ctx&&this.musicSource){
      const now=this.ctx.currentTime,{source,fade}=this.musicSource;
      fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.015);
      source.stop(now+.06);this.musicSource=null;this.musicOffset=0;
    }
    if(next==='launch'){this.intensity=0;this.stemOffset=0;this.loadStems();}
    this.syncMusic();
  }
  setIntensity(level){
    level=Math.max(0,Math.min(LAYERS.length-1,Math.trunc(level)||0));if(level===this.intensity)return;this.intensity=level;
    if(this.ctx&&this.stemSources)this.stemSources.forEach((entry,i)=>entry.layer.gain.setTargetAtTime(LAYERS[level][i],this.ctx.currentTime,.9));
  }
  loadStems(){
    if(!this.ctx||this.stemBuffers||this.stemLoad)return;
    this.stemLoad=Promise.all(LAUNCH_STEMS.map(url=>fetch(url,{signal:globalThis.AbortSignal?.timeout?.(15000)})
      .then(response=>{if(!response.ok)throw new Error('Music unavailable');return response.arrayBuffer();})
      .then(bytes=>this.ctx.decodeAudioData(bytes))))
      .then(buffers=>{this.stemBuffers=buffers;this.syncMusic();})
      .catch(()=>{this.stemLoad=null;});
  }
  init(){
    if(!this.ctx){
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.24;
      this.master.connect(this.ctx.destination);this.musicGain=this.ctx.createGain();
      this.musicGain.gain.value=MUSIC_LEVEL*(this.ducked?.28:1);this.musicGain.connect(this.master);
    }
    if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    if(this.track==='launch')this.loadStems();
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
    const now=this.ctx.currentTime,launch=this.active&&this.track==='launch',single=this.active&&!launch;
    if(!launch&&this.stemSources){
      const first=this.stemSources[0];this.stemOffset=(first.offset+now-first.startedAt)%LAUNCH_LOOP_SECONDS;
      for(const {source,fade} of this.stemSources){fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.05);source.stop(now+.25);}
      this.stemSources=null;
    }else if(launch&&this.stemBuffers&&!this.stemSources){
      const offset=this.stemOffset%LAUNCH_LOOP_SECONDS;
      this.stemSources=this.stemBuffers.map((buffer,i)=>{
        const source=this.ctx.createBufferSource(),fade=this.ctx.createGain(),layer=this.ctx.createGain();
        source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=Math.min(LAUNCH_LOOP_SECONDS,buffer.duration);
        layer.gain.value=LAYERS[this.intensity][i];source.connect(layer);layer.connect(fade);fade.connect(this.musicGain);
        fade.gain.setValueAtTime(0,now);fade.gain.setTargetAtTime(1,now,.08);
        source.onended=()=>{source.disconnect();layer.disconnect();fade.disconnect();};
        source.start(now,offset);return {source,fade,layer,startedAt:now,offset};
      });
    }
    const useStorm=this.track==='storm'&&(this.stormBuffer||(this.stormBuffer=buildStormBuffer(this.ctx)));
    const buffer=useStorm?this.stormBuffer:this.musicBuffer;
    const loopCap=useStorm?STORM_LOOP_SECONDS:MUSIC_LOOP_SECONDS;
    if(!single&&this.musicSource){
      const {source,fade,startedAt,offset}=this.musicSource;
      this.musicOffset=(offset+now-startedAt)%source.loopEnd;
      fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.012);
      source.stop(now+.06);this.musicSource=null;
    }else if(single&&buffer&&!this.musicSource){
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
  event(type){switch(type){case'call':[660,880,660,880].forEach((f,i)=>this.note(f,.1,'sine',.14,i*.15));break;case'programmed':this.note(660,.12,'triangle',.18);this.note(990,.22,'triangle',.18,.12);break;case'surge':[330,495,660,990].forEach((f,i)=>this.note(f,.18,'sawtooth',.16,i*.055,f*1.25));this.note(92,.38,'triangle',.24,0,46);break;case'overdrive':this.note(440,.14,'sawtooth',.14,0,880);this.note(660,.18,'triangle',.16,.07,990);break;case'rushWon':[784,988,1175].forEach((f,i)=>this.note(f,.3,'triangle',.2,i*.1));break;case'pickup':this.note(420,.12,'triangle',.24,0,740);break;case'park':this.note(270,.11,'triangle',.3,0,160);break;case'load':this.note(180,.23,'sawtooth',.06,0,70);this.note(780,.08,'sine',.18,.03);break;case'ready':this.note(740,.25,'sine',.28);this.note(990,.3,'sine',.2,.11);break;case'arrival':this.note(640,.09,'triangle',.18);this.note(850,.14,'triangle',.18,.1);break;case'shipped':[523,659,784,1047].forEach((f,i)=>this.note(f,.26,'triangle',.26,i*.07));break;case'expired':this.note(180,.25,'triangle',.2,0,90);break;case'hint':this.note(160,.1,'sine',.13);break;case'dash':this.note(200,.11,'sine',.13,0,700);break;case'finish':[392,523,659,784].forEach((f,i)=>this.note(f,.5,'triangle',.25,i*.13));break;case'select':this.note(880,.05,'sine',.08);break;
    // Launch Window cues.
    case'kitted':this.note(520,.08,'triangle',.16);this.note(780,.12,'triangle',.13,.06);break;
    case'assembling':this.note(260,.42,'sawtooth',.035,0,620);this.note(990,.06,'sine',.08,.4);break;
    case'stack':this.note(140,.22,'square',.07,0,70);[587,880,1175].forEach((f,i)=>this.note(f,.32,'triangle',.16,.08+i*.07));break;
    case'count':this.note(880,.11,'sine',.2);break;
    case'countHigh':this.note(1320,.13,'sine',.22);this.note(660,.13,'sine',.08);break;
    case'terminal':[440,660,880].forEach((f,i)=>this.note(f,.25,'triangle',.18,i*.09));break;
    case'hold':this.note(233,.45,'square',.07);this.note(196,.7,'square',.07,.5);break;
    case'scrub':[392,330,262,196].forEach((f,i)=>this.note(f,.45,'triangle',.18,i*.2));break;
    case'ignition':this.rumble(3.4,.5,160,2.6);break;
    case'liftoff':this.rumble(6,.85,320,.2);[294,440,587,880].forEach((f,i)=>this.note(f,2.4,'triangle',.11,.05*i));break;}}
  // Filtered noise swell for engines; skipped where the context cannot filter.
  rumble(duration,volume,cutoff,attack){
    if(!this.ctx?.createBiquadFilter||!this.ctx.createBuffer)return;
    const ctx=this.ctx,t=ctx.currentTime;
    if(!this.noise){const length=ctx.sampleRate*2,buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){last=(last+.04*(Math.random()*2-1))/1.04;data[i]=last*3.2;}this.noise=buffer;}
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noise;source.loop=true;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff*.5,t);filter.frequency.linearRampToValueAtTime(cutoff,t+attack);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+attack);gain.gain.setTargetAtTime(0,t+duration-1,.6);
    source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(t);source.stop(t+duration+2);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  update(active,ducked=false){
    this.active=active;
    if(this.ctx&&ducked!==this.ducked)this.musicGain.gain.setTargetAtTime(MUSIC_LEVEL*(ducked?.28:1),this.ctx.currentTime,.16);
    this.ducked=ducked;this.syncMusic();
  }
}
