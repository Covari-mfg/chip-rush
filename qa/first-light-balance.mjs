// Deterministic legal-action play of First Light, not observed player data.
// Reuses the shipped collision/navigation code and Driver's walking and dash
// timing. Every segment starts at its stock bin and passes through the real
// machine, catch-ring, QC and mirror commands. A toss is measured exactly as
// the game measures it: floor distance from the machinist to the station.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {stockType,SHIFTS,shiftRuleset} from '../dist/core.js';
import {ORBIT_LEVEL,tossSeconds,MIRROR_SLOTS} from '../dist/orbit.js';
import {validateResult} from '../server/worker.js';
import {Driver,navigation} from './balance.mjs';

const DT=.05,MAP=SHIFTS[ORBIT_LEVEL].mapId,HAND_RANGE=1.35;
export class OrbitDriver extends Driver {
  // strategy 'toss' uses the level's verb; 'carry' walks every part by hand.
  constructor({strategy='toss',reaction=.5,dash=false,covari='decline'}={}){
    super(ORBIT_LEVEL,strategy,'ignore',{reaction,dash,covari});
    this.checkedSegments=0;this.tosses=0;this.tossSeconds=0;
    this.layout=Object.fromEntries(navigation.layoutFor(MAP).map(def=>[def.id,def]));
    this.access=navigation.accessesFor(MAP);
    this.recordEvents(this.game.drain());
  }
  pathTo(id){
    const points=super.pathTo(id);let previous=this.position;
    for(const point of points){assert.ok(navigation.clear(previous,point),`Collision-safe segment to ${id}`);previous=point;this.checkedSegments++;}
    return points;
  }
  recordEvents(events){
    for(const event of events){
      const order=this.game.order(event.orderId);
      this.event(event.type,{...event,...(event.type==='arrival'&&order?{name:order.name,route:[...order.route]}:{})});
    }
  }
  tick(seconds){
    for(let left=seconds;left>1e-8&&this.game.mode==='playing';left-=DT){
      const dt=Math.min(DT,left);this.dashCooldown=Math.max(0,this.dashCooldown-dt);
      this.game.tick(dt);this.recordEvents(this.game.drain());
    }
  }
  interact(id){
    this.walk(id);if(this.game.mode!=='playing')return false;
    const ok=this.game.interact(id);
    this.event(id,{orderId:this.game.hand?.orderId??this.game.selectedId,ok});
    this.recordEvents(this.game.drain());this.tick(Math.max(DT,this.actionDelay));return ok;
  }
  // The same rule as the renderer: standing at the station hands the part
  // over; from anywhere else the part is tossed and drifts there.
  send(key){
    const def=this.layout[key],access=this.access[key];
    if(Math.hypot(this.position.x-access.x,this.position.z-access.z)<HAND_RANGE)return this.interact(key);
    const seconds=tossSeconds(Math.hypot(def.x-this.position.x,def.z-this.position.z));
    const ok=this.game.toss(key,seconds);assert.equal(ok,true,'A toss the rules allow');
    this.tosses++;this.tossSeconds+=seconds;this.at=null;
    this.recordEvents(this.game.drain());this.tick(Math.max(DT,this.actionDelay));return ok;
  }
  sourcing(){
    if(this.game.sourcing?.state!=='offer')return false;
    const accepted=this.covari==='accept',ok=accepted?this.game.requestSource():this.game.declineSource();
    assert.equal(ok,true);this.event(accepted?'source-accept':'source-decline');
    this.recordEvents(this.game.drain());this.tick(Math.max(DT,this.actionDelay));return true;
  }
  canTake(order,next=order.route[order.index]){
    const game=this.game;if(next==='ship')return true;
    return this.strategy==='carry'?!game.stations[next].part||game.stations[next].ready:game.ringFree(next);
  }
  run(){
    const game=this.game;let guard=0;
    while(game.mode==='playing'&&guard++<40000){
      if(this.sourcing())continue;
      const held=game.heldOrder;
      if(held){
        const next=held.route[held.index];
        if(this.strategy==='carry'){
          if(next==='ship'||!game.stations[next].part||game.stations[next].ready)this.interact(next);
          else if(!game.buffer)this.interact('buffer');
          else this.tick(.2);
        }else if(!game.tossBlock(next))this.send(next);
        else if(!game.tossBlock('buffer'))this.send('buffer');
        else this.tick(.2);
        continue;
      }
      // Prefer the closest useful stop, nudged by how soon each order is due.
      const cost=(station,order)=>this.distanceTo(station)/4.4+order.remaining*.04;
      const options=[];
      for(const [station,state] of Object.entries(game.stations)){
        if(!state.ready)continue;const order=game.order(state.part.orderId);
        if(this.canTake(order))options.push({station,cost:cost(station,order)});
      }
      if(game.buffer){const order=game.order(game.buffer.orderId);if(this.canTake(order))options.push({station:'buffer',cost:cost('buffer',order)});}
      if(game.receiving)options.push({station:'receiving',cost:this.distanceTo('receiving')/4.4});
      for(const type of ['round','plate','block']){
        const order=game.nextMaterial(type);if(!order||!this.canTake(order,order.route[0]))continue;
        // In serial play one segment is finished before the next blank is cut.
        if(this.strategy==='carry'&&this.actionDelay>=1&&game.orders.some(other=>other.started))continue;
        options.push({station:'material-'+type,cost:cost('material-'+type,order)+1});
      }
      options.sort((a,b)=>a.cost-b.cost);
      if(options.length)this.interact(options[0].station);else this.tick(.2);
    }
    assert.ok(guard<40000,'Orbit driver completes');
    assert.ok(this.checkedSegments>0,'The proof traversed production collision paths');
    for(const arrival of this.log.filter(event=>event.type==='arrival')){
      if(!this.log.some(event=>event.type==='shipped'&&event.orderId===arrival.orderId))continue;
      const steps=this.log.filter(event=>event.orderId===arrival.orderId);
      assert.equal(steps.filter(event=>event.type==='pickup'&&event.station.startsWith('material')).length,1,'A set segment starts at its matching stock bin');
      assert.deepEqual(steps.filter(event=>event.type==='load').map(event=>event.station),arrival.route.filter(station=>station!=='ship'),'A set segment completes its actual cutting, polishing, coating and QC route');
    }
    const value={role:ORBIT_LEVEL,score:game.score,shipped:game.shipped,missed:game.missed,sourced:game.sourced,calls:0,elapsed:game.elapsed,clearElapsed:game.clearElapsed,spawned:game.spawnIndex,finishReason:game.finishReason};
    const start=1_800_000_000_000;
    assert.equal(validateResult(value,{role:ORBIT_LEVEL,ruleset:shiftRuleset(ORBIT_LEVEL),started_at:start},start+Math.ceil(game.elapsed*1000)),null,'A legal simulated finish is accepted by the hosted score boundary');
    return {role:game.config.name,strategy:this.strategy,reaction:this.actionDelay,dash:this.dash,covari:this.covari,
      spawned:game.spawnIndex,shipped:game.shipped,stars:game.stars(),pass:game.passed(),missed:game.missed,unfinished:game.unfinished,
      score:game.score,sourced:game.sourced,sourcePoints:game.sourcePoints,shield:game.shield,clearElapsed:game.clearElapsed,
      elapsed:game.elapsed,finishReason:game.finishReason,walkingSeconds:this.travelSeconds,dashes:this.dashes,tosses:this.tosses,
      checkedSegments:this.checkedSegments,log:this.log};
  }
}
export const simulateOrbit=options=>new OrbitDriver(options).run();
export const ORBIT_SCENARIOS=[
  {strategy:'carry',reaction:1.5},
  {strategy:'carry',reaction:.5},
  {strategy:'toss',reaction:1},
  {strategy:'toss',reaction:.5},
  {strategy:'toss',reaction:.1,dash:true},
  {strategy:'toss',reaction:.5,covari:'accept'},
];
export function assertOrbitBalance(rows){
  const find=(strategy,reaction,covari='decline')=>rows.find(row=>row.strategy===strategy&&row.reaction===reaction&&row.covari===covari);
  assert.ok(find('toss',1).pass,'Unhurried tossing clears');
  assert.ok(find('toss',.5).pass&&find('toss',.5).stars>=2,'Steady tossing earns at least two stars');
  const expert=find('toss',.1);
  assert.ok(expert.shipped===MIRROR_SLOTS&&expert.stars===3&&expert.missed===0,'An expert route completes the mirror');
  assert.ok(find('toss',.5).stars<3,'A full mirror takes more than a steady pace');
  assert.ok(find('carry',.5).shipped<find('toss',.5).shipped,'Tossing sets more segments than carrying at the same pace');
  assert.ok(!find('carry',1.5).pass,'Slow serial carrying does not clear');
  const covari=find('toss',.5,'accept');
  assert.ok(covari.pass&&covari.sourced===1&&covari.sourcePoints===300&&covari.shield,'Covari is optional, worth exactly 300 and deploys the sunshield');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const rows=ORBIT_SCENARIOS.map(simulateOrbit);
  console.table(rows.map(({log,role,...summary})=>({...summary,elapsed:+summary.elapsed.toFixed(2),clearElapsed:summary.clearElapsed===null?null:+summary.clearElapsed.toFixed(2),walkingSeconds:+summary.walkingSeconds.toFixed(1)})));
  if(process.argv.includes('--trace'))for(const row of rows){console.log(`\n${row.strategy} / reaction ${row.reaction} / Covari ${row.covari}`);console.table(row.log);}
  if(process.argv.includes('--assert'))assertOrbitBalance(rows);
}
