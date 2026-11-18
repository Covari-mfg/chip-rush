import { BELL_NOTES } from './bells.js';

// Four partials give each successful catch the same bronze bell timbre.
export function ringBell(context, output, note, volume=1) {
  if(!context||!output)return;
  const at=context.currentTime, frequency=BELL_NOTES[note].hz;
  const pan=context.createStereoPanner();
  pan.pan.value=.18;pan.connect(output);
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
