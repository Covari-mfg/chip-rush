import { BELL_NOTES, PEAL_BEAT } from './bells.js';

// Both the live tower and the souvenir recording use these same four modes
// of vibration. The valley replies an octave up and from the other side.
export function ringBell(context, output, note, volume=1, octave=1, at=context?.currentTime) {
  if(!context||!output)return;
  const frequency=BELL_NOTES[note].hz*octave;
  const pan=context.createStereoPanner();
  pan.pan.value=octave===2?-.58:.28;pan.connect(output);
  for(const [ratio,seconds,level] of [[.5,1.7,.16],[1,1.35,.31],[2.39,.58,.085],[3.01,.32,.06]]){
    const osc=context.createOscillator(),gain=context.createGain();
    osc.frequency.value=frequency*ratio;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level*volume,at+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,at+seconds);
    osc.connect(gain);gain.connect(pan);
    osc.onended=()=>{osc.disconnect();gain.disconnect();if(ratio===.5)pan.disconnect();};
    osc.start(at);osc.stop(at+seconds+.01);
  }
}

function waveFile(buffer){
  const channels=buffer.numberOfChannels,frames=buffer.length,bytes=frames*channels*2;
  const view=new DataView(new ArrayBuffer(44+bytes));
  function tag(offset,name){for(let i=0;i<name.length;i++)view.setUint8(offset+i,name.charCodeAt(i));}
  tag(0,'RIFF');view.setUint32(4,bytes+36,true);tag(8,'WAVE');tag(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
  view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,bytes,true);
  const data=Array.from({length:channels},(_,ch)=>buffer.getChannelData(ch));
  let offset=44;
  for(let i=0;i<frames;i++)for(const channel of data){
    view.setInt16(offset,Math.round(Math.max(-1,Math.min(1,channel[i]))*32767),true);offset+=2;
  }
  return new Blob([view.buffer],{type:'audio/wav'});
}

export function recordPeal(notes, answered) {
  const sampleRate=32000,echoAt=8*PEAL_BEAT;
  const duration=(notes.length-1)*PEAL_BEAT+2+(answered?echoAt:0);
  const context=new OfflineAudioContext(2,Math.ceil(duration*sampleRate),sampleRate);
  notes.forEach((note,index)=>{
    const at=index*PEAL_BEAT+.05;
    ringBell(context,context.destination,note,.85,1,at);
    if(answered)ringBell(context,context.destination,note,.32,2,at+echoAt);
  });
  return context.startRendering().then(waveFile);
}
