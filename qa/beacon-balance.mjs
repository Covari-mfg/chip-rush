// Deterministic legal-action play, not observed player data. Reuses the shipped
// collision/navigation code and Driver's walking/dash timing. Every local part
// starts at stock and travels through the real machine and QC commands.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {stockType,SHIFTS,RULESET} from '../dist/core.js';
import {BEACON_LEVEL,CROSSING_SECONDS,TENDER_CAPACITY} from '../dist/beacon.js';
import {validateResult} from '../server/worker.js';
import {Driver,navigation} from './balance.mjs';

const DT=.05;
export class BeaconDriver extends Driver {
  constructor({strategy='flow',reaction=.5,dash=false,batch=1,covari='decline'}={}){
    super(BEACON_LEVEL,strategy,'ignore',{reaction,dash,covari});
    assert.ok(Number.isInteger(batch)&&batch>=1&&batch<=TENDER_CAPACITY,'Choose a legal batch size');
    this.batch=batch;this.checkedSegments=0;this.crossings=[];
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
      if(event.type==='tenderDeparted')this.crossings.push({departed:this.game.elapsed,count:event.count,arrived:null});
      if(event.type==='beaconLit')this.crossings.at(-1).arrived=this.game.elapsed;
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
  // The source ticket is a legal click action, not a station interaction.
  sourcing(){
    if(this.game.sourcing?.state!=='offer')return false;
    const accepted=this.covari==='accept',ok=accepted?this.game.requestSource():this.game.declineSource();
    assert.equal(ok,true);this.event(accepted?'source-accept':'source-decline');
    this.recordEvents(this.game.drain());this.tick(Math.max(DT,this.actionDelay));return true;
  }
  pendingLocal(){return this.game.orders.filter(order=>!['quay','tender'].includes(order.location));}
  shouldSail(){
    const game=this.game;if(game.tender.phase!=='docked'||!game.quay.length||game.hand)return false;
    if(game.quay.length>=this.batch)return true;
    // Leave enough real walking time to reach the quay and cross. A short
    // batch is also valid when no further local work can fill it.
    const urgent=game.time<=CROSSING_SECONDS+this.distanceTo('ship')/4.4+this.actionDelay+2;
    const expiring=game.quay.some(id=>id!==201&&game.order(id).remaining<this.distanceTo('ship')/4.4+this.actionDelay+3);
    return urgent||expiring||(!this.pendingLocal().length&&!game.hasEligibleFutureArrival()&&!game.receiving);
  }
  run(){
    let guard=0;
    while(this.game.mode==='playing'&&guard++<20000){
      if(this.sourcing())continue;
      const held=this.game.heldOrder;
      if(held){
        const next=held.route[held.index],station=this.game.stations[next];
        if(next==='ship'||!station?.part||station.ready)this.interact(next);
        else this.tick(.2);
        continue;
      }
      if(this.shouldSail()){this.interact('ship');continue;}
      if(this.strategy==='serial'){
        let order=this.game.order(this.activeId);
        if(!order||['quay','tender'].includes(order.location)){
          order=this.pendingLocal()[0];this.activeId=order?.id;
        }
        if(order){
          if(!order.started)this.interact('material-'+stockType(order));
          else if(this.game.stations[order.location]?.ready)this.interact(order.location);
          else this.tick(.2);
          continue;
        }
        if(this.game.receiving){this.interact('receiving');continue;}
        this.tick(.2);continue;
      }
      const ready=Object.entries(this.game.stations).filter(([,station])=>station.ready)
        .map(([station,state])=>({station,order:this.game.order(state.part.orderId)}))
        .filter(({order})=>{const next=order.route[order.index];return next==='ship'||!this.game.stations[next]?.part||this.game.stations[next].ready;});
      ready.sort((a,b)=>(a.order.route.length-a.order.index)*4+a.order.remaining*.08+this.distanceTo(a.station)*.3-
        ((b.order.route.length-b.order.index)*4+b.order.remaining*.08+this.distanceTo(b.station)*.3));
      if(ready.length){this.interact(ready[0].station);continue;}
      if(this.game.receiving){this.interact('receiving');continue;}
      const fresh=this.pendingLocal().filter(order=>!order.started&&!this.game.stations[order.route[0]]?.part)
        .sort((a,b)=>a.remaining-b.remaining);
      if(fresh.length){this.interact('material-'+stockType(fresh[0]));continue;}
      this.tick(.2);
    }
    assert.ok(guard<20000,'Harbor driver completes');
    assert.ok(this.checkedSegments>0,'The proof traversed production collision paths');
    for(const trip of this.crossings){
      assert.ok(trip.count>=1&&trip.count<=TENDER_CAPACITY);
      if(trip.arrived!==null)assert.ok(Math.abs(trip.arrived-trip.departed-CROSSING_SECONDS)<=DT+1e-8,'Credit follows a full crossing (event observation has one tick of resolution)');
    }
    for(const arrival of this.log.filter(event=>event.type==='arrival')){
      if(!this.log.some(event=>event.type==='shipped'&&event.orderId===arrival.orderId))continue;
      const steps=this.log.filter(event=>event.orderId===arrival.orderId);
      assert.equal(steps.filter(event=>event.type==='pickup'&&event.station.startsWith('material')).length,1,'Delivered local work starts at its matching stock bin');
      assert.deepEqual(steps.filter(event=>event.type==='load').map(event=>event.station),arrival.route.filter(station=>station!=='ship'),'Delivered parts complete their actual cutting and QC route');
      assert.equal(steps.filter(event=>event.type==='quayLoaded').length,1,'Every delivered part is loaded at the quay exactly once');
    }
    const game=this.game;
    const value={role:BEACON_LEVEL,score:game.score,shipped:game.shipped,missed:game.missed,sourced:game.sourced,calls:0,elapsed:game.elapsed,clearElapsed:game.clearElapsed,spawned:game.spawnIndex,finishReason:game.finishReason};
    const start=1_800_000_000_000;
    assert.equal(validateResult(value,{role:BEACON_LEVEL,ruleset:RULESET,started_at:start},start+Math.ceil(game.elapsed*1000)),null,'A legal simulated finish is accepted by the hosted score boundary');
    return {role:game.config.name,strategy:this.strategy,reaction:this.actionDelay,dash:this.dash,batch:this.batch,covari:this.covari,
      spawned:game.spawnIndex,shipped:game.shipped,stars:game.stars(),pass:game.passed(),missed:game.missed,unfinished:game.unfinished,
      score:game.score,sourced:game.sourced,sourcePoints:game.sourcePoints,clearElapsed:game.clearElapsed,
      elapsed:game.elapsed,finishReason:game.finishReason,walkingSeconds:this.travelSeconds,dashes:this.dashes,
      checkedSegments:this.checkedSegments,crossings:this.crossings,log:this.log};
  }
}
export const simulateBeacon=options=>new BeaconDriver(options).run();
export function assertBeaconBalance(rows){
  assert.ok(rows.filter(row=>row.strategy==='serial').every(row=>row.pass),'A slower serial route clears');
  assert.ok(rows.filter(row=>row.strategy==='flow'&&!row.dash).every(row=>row.pass),'Normal walking clears');
  assert.ok(rows.filter(row=>row.dash).every(row=>row.shipped===SHIFTS[BEACON_LEVEL].maxOrders&&row.stars===3&&row.missed===0),'Expert routes legally install all eight parts');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const rows=[simulateBeacon({strategy:'serial',reaction:1.5}),simulateBeacon({reaction:.5}),
    simulateBeacon({reaction:.1,dash:true}),simulateBeacon({reaction:.1,dash:true,batch:3}),
    simulateBeacon({reaction:.5,covari:'accept'})];
  console.table(rows.map(({log,crossings,...summary})=>({...summary,elapsed:+summary.elapsed.toFixed(2),clearElapsed:summary.clearElapsed===null?null:+summary.clearElapsed.toFixed(2),walkingSeconds:+summary.walkingSeconds.toFixed(1),trips:crossings.length})));
  if(process.argv.includes('--trace'))for(const row of rows){console.log(`\n${row.strategy} / reaction ${row.reaction} / batch ${row.batch} / Covari ${row.covari}`);console.table(row.log);}
  if(process.argv.includes('--assert'))assertBeaconBalance(rows);
}
