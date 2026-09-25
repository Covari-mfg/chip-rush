// Deterministic simulation, not a browser playtest. Uses normal core actions,
// production A* collision paths, walking speed, and attended office time.
// Default adds 0.5s after each station/program interaction. --reaction=1
// explores a slower player; --rush additionally tries accepting a rush.
// Default answers and declines phone offers; --ignore-calls measures the cost
// of letting mandatory interruptions time out. Each answered call costs 3s.
// --trace prints the reproducible action log; --assert checks normal passes.
// --expert adds Owner runs with 0.1s reactions, collision-checked click
// routes and legal straight-line dashes. This is an attainability proof,
// not a prediction of human success rates. Routes match station-click controls.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { ShopGame, SHIFTS } from '../dist/core.js';

const source = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
const section = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'Production movement extraction: ' + from);
  return source.slice(start, end);
};
const layoutCode = section('const STATION_LAYOUT=', '\nlet renderer');
const boundsCode = section('const bounds=', '\nfunction save');
const safeCode = section('function safeSpot(', '\nfunction moveBy(');
const moveCode = section('function moveBy(', '\n// A* routing');
const pathCode = section('function routeSegmentClear(', '\nfunction goToStation(');
const walkingSpeed = Number(source.match(/let speed=([\d.]+)/)?.[1]);
assert.equal(walkingSpeed, 4.4, 'Revisit balance if production walking speed changes');
const context = vm.createContext({ Math });
vm.runInContext(`${layoutCode}\n${boundsCode}\nconst player={...SPAWN};\n${safeCode}\n${moveCode}\n${pathCode}\nthis.nav={layout:STATION_LAYOUT,spawn:SPAWN,player,findPath,safeSpot,moveBy,routeSegmentClear,dashStep};`, context);
const nav = context.nav;
const accesses = Object.fromEntries(nav.layout.map(s => [s.id, s.access ?? { x:s.x, z:s.z+s.d/2+.63 }]));
assert.ok(accesses.office, 'Office must have a production access point');
const DT = 0.05;
const DASH_SPEED = 11, DASH_DURATION = .2, DASH_COOLDOWN = 1.3;
assert.match(source, /dashCooldown=1\.3;dashTime=\.2;/, 'Revisit expert timing if production dash changes');
assert.match(source, /distance:11\*active\+normalSpeed\*\(dt-active\)/, 'Production dash speed and exact active time');

export const navigation = {
  spawn:{...nav.spawn},
  accesses,
  route(from,to) {nav.player.x=from.x;nav.player.z=from.z;return nav.findPath(to.x,to.z);},
  clear:nav.routeSegmentClear,
  safe:nav.safeSpot,
  dashStep:nav.dashStep,
};

export class Driver {
  constructor(shift, strategy, phonePolicy = 'decline', {reaction = .5, dash = false} = {}) {
    assert.ok(Number.isFinite(reaction)&&reaction>=0,'Nonnegative reaction time');
    this.actionDelay = reaction;
    this.dash = dash;
    this.dashCooldown = 0;
    this.dashes = 0;
    this.game = new ShopGame();
    this.game.reset(shift);
    this.strategy = strategy;
    this.phonePolicy = phonePolicy;
    this.position = { ...navigation.spawn };
    this.at = null;
    this.travelSeconds = 0;
    this.programSeconds = 0;
    this.log = [];
    this.activeId = null;
  }
  event(action, extra = {}) {
    this.log.push({ at:+this.game.elapsed.toFixed(2), action, ...extra });
  }
  tick(seconds) {
    for (let remaining = seconds; remaining > 1e-8 && this.game.mode === 'playing'; remaining -= DT) {
      const dt = Math.min(DT, remaining);
      // updateMovement returns before advancing cooldown during a conversation.
      if (!['answering','offer'].includes(this.game.call?.state)) this.dashCooldown = Math.max(0, this.dashCooldown-dt);
      this.game.tick(dt);
      for (const event of this.game.drain()) {
        if (['shipped','expired','rushWon','rushExpired'].includes(event.type)) this.event(event.type, event);
      }
    }
  }
  pathTo(id) {
    const access = accesses[id];
    assert.ok(access, 'Known destination ' + id);
    nav.player.x=this.position.x;nav.player.z=this.position.z;
    const points = nav.findPath(access.x, access.z);
    assert.ok(points.length || Math.hypot(this.position.x-access.x,this.position.z-access.z)<1.4, 'Reachable ' + id);
    return points;
  }
  distanceTo(id) {
    let previous=this.position, length=0;
    for (const point of this.pathTo(id)) {length+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
    return length;
  }
  walk(id) {
    if (this.at===id) return;
    this.game.setOfficePresence(false);
    const points=this.pathTo(id);
    let previous=this.position, length=0;
    for (const point of points) {length+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
    if (this.dash) {
      // Merge only collinear nodes. A dash cannot turn corners or pass its
      // destination. Walk one frame to face each segment before dashing.
      const segments=[];let origin=this.position;
      for (const target of points) {
        const dx=target.x-origin.x,dz=target.z-origin.z,len=Math.hypot(dx,dz);origin=target;
        if (len<1e-8) continue;
        const ux=dx/len,uz=dz/len,tail=segments.at(-1);
        if (tail&&Math.abs(tail.ux-ux)<1e-6&&Math.abs(tail.uz-uz)<1e-6) tail.length+=len;
        else segments.push({ux,uz,length:len});
      }
      const beforeTravel=this.game.elapsed;
      for (const segment of segments) {
        let remaining=segment.length;
        const orientStep=Math.min(DT,remaining/walkingSpeed);
        remaining-=orientStep*walkingSpeed;this.tick(orientStep);
        while (remaining>1e-8&&this.game.mode==='playing') {
          if (remaining>=DASH_SPEED*DASH_DURATION&&this.dashCooldown<1e-8) {
            this.event('dash',{toward:id,ux:segment.ux,uz:segment.uz,straightRemaining:remaining});
            this.dashes++;this.dashCooldown=DASH_COOLDOWN;
            remaining-=DASH_SPEED*DASH_DURATION;this.tick(DASH_DURATION);
          } else {
            const step=Math.min(DT,remaining/walkingSpeed);
            remaining-=step*walkingSpeed;this.tick(step);
          }
        }
      }
      this.tick(DT);this.travelSeconds+=this.game.elapsed-beforeTravel;
    } else {
      // Add one arrival/interaction frame, never instantaneous station travel.
      const seconds=length/walkingSpeed+DT;
      this.tick(seconds);this.travelSeconds+=seconds;
    }
    this.position={x:previous.x,z:previous.z};this.at=id;
    this.game.setOfficePresence(id==='office');
  }
  interact(id) {
    this.walk(id);
    if (this.game.mode!=='playing') return false;
    const ok=this.game.interact(id);
    this.event(id,{orderId:this.game.hand?.orderId??this.game.selectedId,ok});
    this.tick(Math.max(DT,this.actionDelay));
    return ok;
  }
  program(order) {
    this.game.select(order.id);
    this.walk('office');
    if (this.game.mode!=='playing'||!this.game.order(order.id)) return;
    if(['ringing','answering','offer'].includes(this.game.call?.state))return;
    assert.equal(this.game.interact('office'),true,'Start attended program');
    const seconds=order.programRemaining+this.actionDelay;
    this.event('program',{orderId:order.id,seconds});
    const before=order.programRemaining;this.tick(seconds);this.programSeconds+=before-order.programRemaining;
  }
  calls() {
    const call=this.game.call;
    if (!call||!['ringing','answering','offer'].includes(call.state)) return false;
    if (this.phonePolicy==='ignore') {this.tick(.2);return true;}
    this.walk('office');
    if (this.game.call?.state==='ringing') {
      this.game.interact('phone');this.event('answer-phone',{orderId:this.game.call?.orderId});
    }
    if (this.game.call?.state==='answering') this.tick(this.game.call.answerRemaining+this.actionDelay);
    if (this.game.call?.state==='offer') {
      const id=this.game.call.orderId,accept=this.phonePolicy==='accept'&&this.game.call.rushAvailable!==false;
      if(this.game.respondCall(accept))this.event(accept?'accept-rush':'decline-rush',{orderId:id});
      this.tick(this.actionDelay);
      // The player is already at the office and may keep holding a finished
      // part while programming the accepted rush, avoiding a needless return.
      const rush=this.game.call?.state==='active'?this.game.order(this.game.call.orderId):null;
      if(rush&&!rush.programmed)this.program(rush);
    }
    return true;
  }
  run() {
    let guard=0;
    while(this.game.mode==='playing'&&guard++<20000) {
      if(this.calls()) continue;
      const held=this.game.heldOrder;
      if(held) {
        if(!held.programmed) {this.program(held);continue;}
        const next=held.route[held.index];
        if(next==='ship'||!this.game.stations[next]?.part) {this.interact(next);continue;}
        this.tick(.2);continue;
      }
      if(this.strategy==='serial') {
        let order=this.game.order(this.activeId);
        if(!order) {order=this.game.orders[0];this.activeId=order?.id;}
        if(!order) {this.tick(.2);continue;}
        this.game.select(order.id);
        if(!order.programmed) {this.program(order);continue;}
        if(!order.started) {this.interact('material');continue;}
        const machine=this.game.stations[order.location];
        if(machine?.ready) {this.interact(order.location);continue;}
        this.tick(.2);continue;
      }
      const rush=this.game.call?.state==='active'?this.game.order(this.game.call.orderId):null;
      if(rush&&!rush.started&&!this.game.stations[rush.route[0]]?.part){
        this.game.select(rush.id);if(!rush.programmed)this.program(rush);else this.interact('material');continue;
      }
      const priority=order=>this.game.call?.state==='active'&&this.game.call.orderId===order.id ? -1000 : order.remaining;
      const ready=Object.entries(this.game.stations).filter(([,s])=>s.ready).map(([station,s])=>({station,order:this.game.order(s.part.orderId)})).filter(({order})=>{
        const next=order.route[order.index];return next==='ship'||!this.game.stations[next]?.part;
      });
      // Finish downstream work first, then favor urgent orders and short trips.
      ready.sort((a,b)=>((a.order.route.length-a.order.index)*4+priority(a.order)*.08+this.distanceTo(a.station)*.3)-((b.order.route.length-b.order.index)*4+priority(b.order)*.08+this.distanceTo(b.station)*.3));
      if(ready.length) {this.interact(ready[0].station);continue;}
      const fresh=this.game.orders.filter(o=>!o.started&&!this.game.stations[o.route[0]]?.part);
      fresh.sort((a,b)=>priority(a)-priority(b));
      if(fresh.length) {
        const order=fresh[0];this.game.select(order.id);
        if(!order.programmed) this.program(order);else this.interact('material');
        continue;
      }
      // Program the next queued job while a machine runs, if its saved program
      // is unfinished. Programming pauses during the walk to/from the office.
      const unprogrammed=this.game.orders.filter(o=>!o.started&&!o.programmed).sort((a,b)=>a.remaining-b.remaining)[0];
      if(unprogrammed) {this.program(unprogrammed);continue;}
      this.tick(.2);
    }
    assert.ok(guard<20000,'Driver must finish a shift');
    return {role:this.game.config.name,strategy:this.strategy,phone:this.phonePolicy,rush:this.phonePolicy==='accept',reaction:this.actionDelay,movement:`click route + ${this.dash?'dash':'walk'}`,shipped:this.game.shipped,pass:this.game.passed(),stars:this.game.stars(),score:this.game.score,missed:this.game.missed,unfinished:this.game.unfinished,walkingSeconds:+this.travelSeconds.toFixed(1),programSeconds:+this.programSeconds.toFixed(1),dashes:this.dashes,lastShipmentAt:this.log.findLast(event=>event.action==='shipped')?.at??null,callsReceived:this.game.callsReceived,callsAnswered:this.game.callsAnswered,rushesAccepted:this.game.rushesAccepted,rushesWon:this.game.rushesWon,log:this.log};
  }
}

export function simulateShift(shift, options = {}) {
  return new Driver(shift, options.strategy ?? 'flow', options.phonePolicy ?? 'decline', options).run();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const reaction=Number(process.argv.find(arg=>arg.startsWith('--reaction='))?.split('=')[1] ?? .5);
  const rows=[];
  for(let shift=0;shift<SHIFTS.length;shift++)for(const strategy of ['serial','flow'])rows.push(simulateShift(shift,{strategy,reaction}));
  if(process.argv.includes('--rush'))rows.push(simulateShift(2,{reaction,phonePolicy:'accept'}));
  if(process.argv.includes('--ignore-calls'))rows.push(simulateShift(2,{reaction,phonePolicy:'ignore'}));
  if(process.argv.includes('--expert'))for(const phonePolicy of ['decline','accept'])rows.push(simulateShift(2,{reaction:.1,dash:true,phonePolicy}));
  console.table(rows.map(({log,...summary})=>summary));
  if(process.argv.includes('--trace'))for(const row of rows){console.log('\n'+row.role+' / '+row.strategy+' / rush '+row.rush);console.table(row.log);}
  if(process.argv.includes('--assert')) {
    assert.ok(rows.filter(row=>row.strategy==='flow'&&row.phone==='decline').every(row=>row.pass),'Every role must pass using reproducible normal actions');
    if(process.argv.includes('--expert'))assert.ok(rows.filter(row=>row.movement==='click route + dash').every(row=>row.stars===3&&row.missed===0),'Expert routes must prove Owner mastery with either rush choice');
  }
}
