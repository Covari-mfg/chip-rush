// Original country/bluegrass, storm-synth, harbor and launch scores, plus local
// shop cues. Audio unlocks on a home-screen gesture or clock-in.
const MUSIC_URL='./assets/music/country-bluegrass-104.mp3';
const MUSIC_LOOP_SECONDS=1628308/44100;
const STORM_LOOP_SECONDS=32*60/128; // 15.0s seamless 8-bar 128 BPM synthwave loop
const HARBOR_BPM=92,HARBOR_LOOP_SECONDS=32*60/HARBOR_BPM;
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
// Last Light: an original eight-bar D-major harbor piece. Every note and its
// quiet stereo echoes wrap into bar one; no recordings or external assets.
function buildHarborBuffer(ctx){
  if(typeof ctx.createBuffer!=='function')return null;
  const rate=ctx.sampleRate||44100,len=Math.round(rate*HARBOR_LOOP_SECONDS),beat=60/HARBOR_BPM;
  const buffer=ctx.createBuffer(2,len,rate),L=buffer.getChannelData(0),R=buffer.getChannelData(1);
  const note=(at,beats,freq,volume,pan,voice)=>{
    const start=Math.round(at*beat*rate),duration=beats*beat,count=Math.ceil(duration*rate);
    const left=Math.sqrt((1-pan)/2),right=Math.sqrt((1+pan)/2);
    const echo1=Math.round(beat*.75*rate),echo2=Math.round(beat*1.5*rate);
    for(let j=0;j<count;j++){
      const t=j/rate,u=t/duration,phase=Math.PI*2*freq*t;
      let sample;
      if(voice==='string'){
        const envelope=Math.min(1,t/.55)*Math.min(1,(duration-t)/.95);
        sample=(Math.sin(phase+.018*Math.sin(t*3.1))+.24*Math.sin(phase*2)+.07*Math.sin(phase*3))*envelope;
      }else if(voice==='bell'){
        const envelope=(1-Math.exp(-t*90))*Math.exp(-t*1.8)*Math.pow(1-u,2);
        sample=(Math.sin(phase)+.30*Math.sin(phase*2.003)*Math.exp(-t*3)+.10*Math.sin(phase*4.01)*Math.exp(-t*6))*envelope;
      }else{
        const envelope=(1-Math.exp(-t*180))*Math.exp(-t*7)*Math.pow(1-u,2);
        sample=(Math.sin(phase)+.32*Math.sin(phase*3.98)*Math.exp(-t*12))*envelope;
      }
      sample*=volume;
      const i=(start+j)%len,a=(i+echo1)%len,b=(i+echo2)%len;
      L[i]+=sample*left;R[i]+=sample*right;
      L[a]+=sample*right*.16;R[a]+=sample*left*.16;
      L[b]+=sample*left*.07;R[b]+=sample*right*.07;
    }
  };
  // Dmaj9, Bm7, Gmaj9, A6: low, slow-bowed harmony beneath the glass melody.
  const chords=[[146.832,220,277.183,329.628],[123.471,184.997,220,293.665],
    [97.999,146.832,184.997,220],[110,164.814,220,277.183]];
  const mallets=[[293.665,440,554.365,659.255],[246.942,369.994,440,587.330],
    [195.998,293.665,369.994,440],[220,329.628,440,554.365]];
  for(let bar=0;bar<8;bar++){
    chords[bar%4].forEach((freq,i)=>note(bar*4,5.4,freq,.030,i%2===0?-.32:.32,'string'));
    [0,1.5,2.5,3.5].forEach((at,i)=>note(bar*4+at,1.15,mallets[bar%4][(i+(bar>=4?1:0))%4],.15,i%2===0?-.46:.46,'mallet'));
  }
  const melody=[[.5,739.989],[2.25,880],[3.5,659.255],[4.75,587.330],[6.25,739.989],[7,880],
    [8.5,987.767],[10,880],[11,659.255],[12.5,1108.731],[14,880],[15,739.989],
    [16.5,880],[18.25,739.989],[19.5,659.255],[20.75,587.330],[22,739.989],[23,659.255],
    [24.5,493.883],[26,587.330],[27,880],[28.5,659.255],[30.25,739.989],[31.25,554.365]];
  melody.forEach(([at,freq],i)=>note(at,2.8,freq,.12,i%2===0?.23:-.23,'bell'));
  // Deterministic, low-passed sea hush. Warm the filter with the end of the
  // same noise cycle so its state crosses the loop boundary continuously.
  const noise=new Float32Array(len);let seed=20261015,low=0;
  for(let i=0;i<len;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=seed/2147483648-1;}
  for(let i=Math.max(0,len-1024);i<len;i++)low+=.075*(noise[i]-low);
  let energy=0,peak=0;
  for(let i=0;i<len;i++){
    low+=.075*(noise[i]-low);
    const hush=low*.018*(.7+.3*Math.sin(i/len*Math.PI*4));
    L[i]+=hush;R[i]+=hush*.92;
    energy+=L[i]*L[i]+R[i]*R[i];peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));
  }
  // Keep the calm score audible beside the existing loops, with ample headroom.
  const gain=Math.min(.085/Math.sqrt(energy/(len*2)),.65/peak);
  for(let i=0;i<len;i++){L[i]*=gain;R[i]*=gain;}
  return buffer;
}
// Launch Window's original 120 BPM countdown score: three synchronised stems
// (scripts/music/generate_launch_music.py). The count decides how many play.
const LAUNCH_STEMS=['./assets/music/launch-base-120.mp3','./assets/music/launch-drive-120.mp3','./assets/music/launch-climax-120.mp3'];
const LAUNCH_LOOP_SECONDS=32;
const LAYERS=[[1,0,0],[1,1,0],[1,1,1],[.8,1,1]];
// First Light: an original eight-bar piece in D Lydian at 80 BPM, built here
// as three synchronised stems: a slow pad and bass, a soft pulse of plucked
// notes, and a high bell line. Installed mirror segments bring the layers in.
// No recordings or external assets. Stems use half the device rate: nothing
// in them sits above 6 kHz, and the buffers stay small.
const ORBIT_BPM=80,ORBIT_LOOP_SECONDS=32*60/ORBIT_BPM;
const ORBIT_LAYERS=[[1,.3,0],[1,1,0],[1,1,.75],[.9,1,1]];
// One note per installed segment; in order they are the level's melody.
const SEGMENT_NOTES=[587.330,739.989,880,830.609,739.989,659.255,880,987.767,1108.731,880,1174.659,1479.978];
function buildOrbitStems(ctx){
  if(typeof ctx.createBuffer!=='function')return null;
  const rate=Math.max(8000,Math.round((ctx.sampleRate||44100)/2)),len=Math.round(rate*ORBIT_LOOP_SECONDS),beat=60/ORBIT_BPM;
  const make=()=>{const buffer=ctx.createBuffer(2,len,rate);return {buffer,L:buffer.getChannelData(0),R:buffer.getChannelData(1)};};
  const note=(stem,at,beats,freq,volume,pan,voice)=>{
    const start=Math.round(at*beat*rate),duration=beats*beat,count=Math.ceil(duration*rate);
    const left=Math.sqrt((1-pan)/2),right=Math.sqrt((1+pan)/2),echo=Math.round(beat*.75*rate);
    for(let j=0;j<count;j++){
      const t=j/rate,u=t/duration,phase=Math.PI*2*freq*t;let sample;
      if(voice==='pad'){
        const envelope=Math.min(1,t/1.4)*Math.min(1,(duration-t)/1.8);
        sample=(Math.sin(phase+.02*Math.sin(t*2.3))+.18*Math.sin(phase*2+.4)+.05*Math.sin(phase*3))*envelope;
      }else if(voice==='bass'){
        const envelope=Math.min(1,t/.08)*Math.min(1,(duration-t)/.9);
        sample=(Math.sin(phase)+.12*Math.sin(phase*2))*envelope;
      }else if(voice==='pluck'){
        const envelope=(1-Math.exp(-t*220))*Math.exp(-t*5.5)*Math.pow(1-u,2);
        sample=(Math.sin(phase)+.28*Math.sin(phase*2.001)*Math.exp(-t*9)+.08*Math.sin(phase*3.99)*Math.exp(-t*14))*envelope;
      }else if(voice==='thump'){
        const envelope=Math.exp(-t*13)*(1-Math.exp(-t*400));
        sample=Math.sin(Math.PI*2*(freq+60*Math.exp(-t*30))*t)*envelope;
      }else{
        const envelope=(1-Math.exp(-t*70))*Math.exp(-t*1.5)*Math.pow(1-u,2);
        sample=(Math.sin(phase)+.26*Math.sin(phase*2.003)*Math.exp(-t*2.6)+.07*Math.sin(phase*5.01)*Math.exp(-t*7))*envelope;
      }
      sample*=volume;
      const i=(start+j)%len,a=(i+echo)%len,b=(i+echo*2)%len;
      stem.L[i]+=sample*left;stem.R[i]+=sample*right;
      if(voice==='pluck'||voice==='bell'){stem.L[a]+=sample*right*.22;stem.R[a]+=sample*left*.22;stem.L[b]+=sample*left*.09;stem.R[b]+=sample*right*.09;}
    }
  };
  const base=make(),pulse=make(),shine=make();
  // Dmaj9, E/D, Bm9, Gmaj7#11: two bars each.
  const chords=[[146.832,220,277.183,329.628,369.994],[146.832,207.652,246.942,329.628,415.305],
    [123.471,184.997,220,277.183,369.994],[97.999,146.832,184.997,277.183,369.994]];
  const roots=[73.416,73.416,61.735,48.999];
  for(let c=0;c<4;c++){
    chords[c].forEach((freq,i)=>note(base,c*8,9.2,freq,.05,[-.5,.45,-.2,.3,0][i],'pad'));
    note(base,c*8,7.6,roots[c],.16,0,'bass');note(base,c*8+4,3.6,roots[c]*1.5,.05,0,'bass');
    // Plucked eighths walk up and down the chord, an octave above the pad.
    const tones=chords[c].slice(1).map(freq=>freq*2),order=[0,1,2,3,2,1,3,2,0,2,1,3,2,3,1,2];
    for(let step=0;step<16;step++)if(step%8!==7)note(pulse,c*8+step*.5,1.1,tones[order[step]],step%4===0?.105:.07,step%2?.42:-.42,'pluck');
    for(const at of [0,2.5,4,6.5])note(pulse,c*8+at,.5,46,.16,0,'thump');
  }
  const melody=[[1,880],[3,1108.731],[4.5,1479.978],[7,1318.510],[9,1244.508],[11,987.767],[12.5,1318.510],[15,1108.731],
    [17,1108.731],[19,1479.978],[20.5,1760],[23,1479.978],[25,1108.731],[27,1479.978],[28.5,1108.731],[30.5,880]];
  melody.forEach(([at,freq],i)=>note(shine,at,3.6,freq,.085,i%2?.3:-.3,'bell'));
  // One shared gain keeps the three stems balanced against each other.
  let peak=0,energy=0;
  for(const stem of [base,pulse,shine])for(let i=0;i<len;i++){peak=Math.max(peak,Math.abs(stem.L[i]),Math.abs(stem.R[i]));}
  for(let i=0;i<len;i++){const l=base.L[i]+pulse.L[i]+shine.L[i],r=base.R[i]+pulse.R[i]+shine.R[i];energy+=l*l+r*r;peak=Math.max(peak,Math.abs(l),Math.abs(r));}
  const gain=Math.min(.1/Math.sqrt(energy/(len*2)),.7/peak);
  for(const stem of [base,pulse,shine])for(let i=0;i<len;i++){stem.L[i]*=gain;stem.R[i]*=gain;}
  return [base.buffer,pulse.buffer,shine.buffer];
}
export class ShopAudio {
  constructor(){
    this.ctx=null;this.active=false;this.ducked=false;this.track='country';
    this.musicBuffer=null;this.stormBuffer=null;this.harborBuffer=null;this.musicSource=null;this.musicOffset=0;this.musicLoad=null;
    this.stemBuffers=null;this.stemLoad=null;this.stemSources=null;this.stemOffset=0;this.intensity=0;this.orbitStems=null;
  }
  // 'country' is the shop's loop, 'storm' Blackout Shift's synthesized loop,
  // 'launch' Launch Window's layered countdown stems; 'harbor' Last Light;
  // 'orbit' First Light's three synthesized stems.
  setTrack(track='country'){
    const next=['storm','launch','harbor','orbit'].includes(track)?track:'country';
    if(next===this.track)return;
    this.track=next;this.musicOffset=0;
    if(this.ctx&&this.musicSource){
      const now=this.ctx.currentTime,{source,fade}=this.musicSource;
      fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.015);
      source.stop(now+.06);this.musicSource=null;
    }
    if(next==='launch'){this.intensity=0;this.stemOffset=0;this.loadStems();}
    if(next==='orbit'){this.intensity=0;this.stemOffset=0;}
    this.syncMusic();
  }
  setIntensity(level){
    level=Math.max(0,Math.min(LAYERS.length-1,Math.trunc(level)||0));if(level===this.intensity)return;this.intensity=level;
    if(this.ctx&&this.stemSources)this.stemSources.forEach((entry,i)=>entry.layer.gain.setTargetAtTime(this.layers()[level][i],this.ctx.currentTime,.9));
  }
  layers(){return this.track==='orbit'?ORBIT_LAYERS:LAYERS;}
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
    if(this.track==='storm'||this.track==='harbor'||this.track==='orbit')this.syncMusic();
  }
  syncMusic(){
    if(!this.ctx)return;
    const orbit=this.track==='orbit',stems=orbit?(this.orbitStems||(this.orbitStems=buildOrbitStems(this.ctx))):this.stemBuffers;
    // A device that cannot build buffers plays First Light without music.
    const layered=this.track==='launch'||orbit,loop=orbit?ORBIT_LOOP_SECONDS:LAUNCH_LOOP_SECONDS;
    const now=this.ctx.currentTime,launch=this.active&&layered,single=this.active&&!layered;
    if(!launch&&this.stemSources){
      const first=this.stemSources[0];this.stemOffset=(first.offset+now-first.startedAt)%first.loop;
      for(const {source,fade} of this.stemSources){fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.05);source.stop(now+.25);}
      this.stemSources=null;
    }else if(launch&&stems&&!this.stemSources){
      const offset=this.stemOffset%loop;
      this.stemSources=stems.map((buffer,i)=>{
        const source=this.ctx.createBufferSource(),fade=this.ctx.createGain(),layer=this.ctx.createGain();
        source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=Math.min(loop,buffer.duration);
        layer.gain.value=this.layers()[this.intensity][i];source.connect(layer);layer.connect(fade);fade.connect(this.musicGain);
        fade.gain.setValueAtTime(0,now);fade.gain.setTargetAtTime(1,now,.08);
        source.onended=()=>{source.disconnect();layer.disconnect();fade.disconnect();};
        source.start(now,offset);return {source,fade,layer,startedAt:now,offset,loop};
      });
    }
    const useStorm=this.track==='storm'&&(this.stormBuffer||(this.stormBuffer=buildStormBuffer(this.ctx)));
    const useHarbor=this.track==='harbor'&&(this.harborBuffer||(this.harborBuffer=buildHarborBuffer(this.ctx)));
    const buffer=useStorm?this.stormBuffer:useHarbor?this.harborBuffer:this.musicBuffer;
    const loopCap=useStorm?STORM_LOOP_SECONDS:useHarbor?HARBOR_LOOP_SECONDS:MUSIC_LOOP_SECONDS;
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
    case'liftoff':this.rumble(6,.85,320,.2);[294,440,587,880].forEach((f,i)=>this.note(f,2.4,'triangle',.11,.05*i));break;
    // Tender's low two-note horn; a rising bell when another beacon comes on.
    case'tenderDeparted':this.note(146.832,.7,'sine',.14);this.note(220,.9,'sine',.10,.18);break;
    case'beaconLit':[587.330,739.989,880,1174.659].forEach((f,i)=>this.note(f,.8,'sine',.14,i*.11));break;
    // First Light: a soft push, a catch, film unfolding, the picture arriving.
    case'toss':this.note(330,.22,'sine',.1,0,520);this.note(990,.1,'sine',.04,.04,1320);break;
    case'caught':this.note(1320,.07,'sine',.1);this.note(880,.12,'sine',.07,.05);break;
    case'shieldDeployed':[440,554.365,659.255,830.609,1108.731].forEach((f,i)=>this.note(f,.9,'sine',.1,i*.16));break;
    case'firstLight':[293.665,440,554.365,739.989,830.609,1174.659].forEach((f,i)=>this.note(f,3.2,'sine',.1,i*.09));break;
    case'outOfFocus':[440,415.305,369.994].forEach((f,i)=>this.note(f,.9,'sine',.09,i*.3));break;}}
  // The note for the nth installed segment, a little brighter each time.
  segment(index,delay=0){const freq=SEGMENT_NOTES[Math.max(0,index)%SEGMENT_NOTES.length];this.note(freq,1.1,'sine',.17,delay);this.note(freq*2,.5,'sine',.05,delay+.02);this.note(freq/2,.7,'triangle',.06,delay);}
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
