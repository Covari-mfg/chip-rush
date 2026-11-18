import { SHIFTS } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';

// Uses only the same land selection, feed and inspection controls as a player.
export function simulateTurning({strategy='fast',covari=true}={}){
  const game=shiftGame(SHIFTS.findIndex(s=>s.id==='bellweather'));
  let guard=0;
  while(game.mode==='playing'&&guard++<30000){
    if(strategy!=='idle'){
      if(covari&&game.shipped>=2)game.takePlate();
      let land=game.diameters.findIndex((d,i)=>d>game.drawing.targets[i]+game.drawing.tolerance*.5);
      if(land<0){game.cutting=false;game.inspectPart();continue;}
      game.selectLand(land);
      game.fast=strategy==='fast'&&game.diameters[land]>game.drawing.targets[land]+1;
      game.cutting=true;
    }
    game.tick(.01);
  }
  if(guard>=30000)throw new Error('Turning simulation did not finish');
  return {role:game.config.name,strategy,spawned:game.spawnIndex,shipped:game.shipped,missed:game.missed,pass:game.passed(),stars:game.stars(),score:game.score,sourced:game.sourced,elapsed:game.elapsed,clearElapsed:game.clearElapsed,finishReason:game.finishReason,game};
}
