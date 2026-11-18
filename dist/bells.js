import { ShopGame, OPS } from './core.js';

// D major pentatonic. Each blank offers a low, middle and high voice.
// Choosing by ear is optional. All three pitches score identically.
export const BELL_NOTES = [
  {name:'D',hz:293.665}, {name:'E',hz:329.628}, {name:'F♯',hz:369.994},
  {name:'A',hz:440}, {name:'B',hz:493.883}, {name:'D′',hz:587.330},
];
const VOICINGS = [[0,2,3],[1,3,4],[2,4,5],[0,3,5]];
const NAMES = ['Vesper','Lark','Willow','Swallow','Alder','Linnet','Rowan','Wren'];
export const BELL_OPS = {...OPS,inspect:{...OPS.inspect,name:'Tuning bench',short:'TUNE'},ship:{...OPS.ship,name:'Belfry',short:'HANG'}};
export const TONE_SECONDS = 1.15;
export const PEAL_BEAT = .68;

export class BellGame extends ShopGame {
  reset(shift = 0) {
    this.peal = [];
    this.sweepStarted = 0;
    super.reset(shift);
  }

  spawnRecipe(timeRemaining) {
    const recipe = super.spawnRecipe(timeRemaining);
    if (!recipe || this.config.engine !== 'bells') return recipe;
    return {...recipe,name:NAMES[this.spawnIndex]+' bell',color:0xdfa34d};
  }

  tuning() {
    const bench = this.stations.inspect;
    if (!bench.ready || !bench.part || bench.part.orderId === 201) return null;
    const voice = Math.floor(Math.max(0,this.elapsed-this.sweepStarted)/TONE_SECONDS)%3;
    const choices = VOICINGS[(bench.part.orderId-101)%VOICINGS.length];
    return {orderId:bench.part.orderId,voice,choices,note:choices[voice]};
  }

  interact(key,voice) {
    const held = this.heldOrder;
    const tuning = key === 'inspect' ? this.tuning() : null;
    if (!super.interact(key)) return false;
    if (key === 'inspect') {
      // Read the outgoing pitch before a one-action swap starts the next blank.
      if (tuning && this.hand?.orderId === tuning.orderId) {
        const note=Number.isInteger(voice)&&voice>=0&&voice<3?tuning.choices[voice]:tuning.note;
        this.heldOrder.note = note;
        this.emit('tuned',{note,station:key});
      }
      if (held && this.stations.inspect.part?.orderId === held.id)
        this.sweepStarted = this.elapsed + OPS.inspect.duration;
    }
    if (key.startsWith('material') && held) delete held.note;
    if (key === 'ship' && held && held.id !== 201) {
      this.peal.push(held.note);
      this.emit('bellHung',{note:held.note,slot:this.peal.length-1});
    }
    return true;
  }
}
