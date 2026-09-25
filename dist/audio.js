// Original 104 BPM country/bluegrass loop and locally synthesized shop cues.
// Audio starts only after the player clocks in; the standalone build embeds the track.
const MUSIC_URL='./assets/music/country-bluegrass-104.mp3';
const MUSIC_LOOP_SECONDS=1628308/44100;
const MUSIC_LEVEL=.65; // With the .24 master: about 16 dB below the audition.
export class ShopAudio {
  constructor(){
    this.ctx=null;this.active=false;this.ducked=false;
    this.musicBuffer=null;this.musicSource=null;this.musicOffset=0;this.musicLoad=null;
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
  }
  syncMusic(){
    if(!this.ctx)return;
    const now=this.ctx.currentTime;
    if(!this.active&&this.musicSource){
      const {source,fade,startedAt,offset}=this.musicSource;
      this.musicOffset=(offset+now-startedAt)%source.loopEnd;
      fade.gain.cancelScheduledValues(now);fade.gain.setTargetAtTime(0,now,.012);
      source.stop(now+.06);this.musicSource=null;
    }else if(this.active&&this.musicBuffer&&!this.musicSource){
      const source=this.ctx.createBufferSource(),fade=this.ctx.createGain();
      source.buffer=this.musicBuffer;source.loop=true;source.loopStart=0;
      source.loopEnd=Math.min(MUSIC_LOOP_SECONDS,this.musicBuffer.duration);
      const offset=this.musicOffset%source.loopEnd;
      source.connect(fade);fade.connect(this.musicGain);fade.gain.setValueAtTime(0,now);
      fade.gain.setTargetAtTime(1,now,.025);
      source.onended=()=>{source.disconnect();fade.disconnect();};
      source.start(now,offset);this.musicSource={source,fade,startedAt:now,offset};
    }
  }
  note(freq,duration=.12,type='sine',volume=.25,delay=0,endFreq){if(!this.ctx)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);}
  event(type){switch(type){case'call':[660,880,660,880].forEach((f,i)=>this.note(f,.1,'sine',.14,i*.15));break;case'programmed':this.note(660,.12,'triangle',.18);this.note(990,.22,'triangle',.18,.12);break;case'rushWon':[784,988,1175].forEach((f,i)=>this.note(f,.3,'triangle',.2,i*.1));break;case'pickup':this.note(420,.12,'triangle',.24,0,740);break;case'park':this.note(270,.11,'triangle',.3,0,160);break;case'load':this.note(180,.23,'sawtooth',.06,0,70);this.note(780,.08,'sine',.18,.03);break;case'ready':this.note(740,.25,'sine',.28);this.note(990,.3,'sine',.2,.11);break;case'arrival':this.note(640,.09,'triangle',.18);this.note(850,.14,'triangle',.18,.1);break;case'shipped':[523,659,784,1047].forEach((f,i)=>this.note(f,.26,'triangle',.26,i*.07));break;case'expired':this.note(180,.25,'triangle',.2,0,90);break;case'hint':this.note(160,.1,'sine',.13);break;case'dash':this.note(200,.11,'sine',.13,0,700);break;case'finish':[392,523,659,784].forEach((f,i)=>this.note(f,.5,'triangle',.25,i*.13));break;case'select':this.note(880,.05,'sine',.08);break;}}
  update(active,ducked=false){
    this.active=active;
    if(this.ctx&&ducked!==this.ducked)this.musicGain.gain.setTargetAtTime(MUSIC_LEVEL*(ducked?.28:1),this.ctx.currentTime,.16);
    this.ducked=ducked;this.syncMusic();
  }
}
