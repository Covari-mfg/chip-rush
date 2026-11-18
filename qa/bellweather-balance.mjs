import { SHIFTS } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';

// Deterministic input driver: it steers using visible gates and throws when the
// next hoop enters a chosen release window. It does not modify game state.
export function simulateRail({strategy='cautious',covari=true,throwLimit=8}={}){
  const game=shiftGame(SHIFTS.findIndex(s=>s.id==='bellweather'));
  let guard=0;
  while(game.mode==='playing'&&guard++<5000){
    if(strategy!=='idle'){
      const delivery=game.deliveries.find(g=>g.state==='ahead');
      const plate=game.gates.find(g=>g.kind==='covari'&&g.state==='ahead');
      let target=covari&&plate&&plate.s>game.distance&&(!delivery||plate.s<delivery.s)?plate:delivery;
      let lane=target?.lane;
      if(strategy==='advanced'){
        const next=game.gates.find(g=>g.state==='ahead'&&g.s>game.distance&&g.kind!=='delivery'&&(g.kind!=='covari'||covari));
        const gap=delivery?delivery.s-game.distance:Infinity;
        if(delivery&&gap<=34){
          // Cross-track gold throws earn the bank bonus; return to the next rail afterwards.
          lane=delivery.lane===0?(game.lane<0?-1:1):0;
        }else if(next&&next.s-game.distance<55&&(!delivery||next.s<delivery.s-35)){
          lane=next.kind==='work'?(next.lane===0?1:0):next.lane;
        }
      }
      if(lane!==undefined){
        if(game.targetLane<lane)game.switchLane(1);
        else if(game.targetLane>lane)game.switchLane(-1);
      }
      game.braking=strategy==='cautious';
      const aim=game.aim();
      if(aim&&aim.gate.index<throwLimit&&aim.open&&(strategy==='cautious'||aim.gold))game.throwBell();
    }
    game.tick(.05);
  }
  if(guard>=5000)throw new Error('Rail simulation did not finish');
  return {role:game.config.name,strategy,spawned:game.spawnIndex,shipped:game.shipped,missed:game.missed,pass:game.passed(),stars:game.stars(),score:game.score,sourced:game.sourced,elapsed:game.elapsed,clearElapsed:game.clearElapsed,finishReason:game.finishReason,perfect:game.perfect,impacts:game.impacts,game};
}
