import { ShopGame } from './core.js';

export const COURSE_LENGTH=1100;
export const MAX_SPEED=43;
export const TOWERS=[
  {s:115,lane:0,name:'Depot'}, {s:236,lane:-1,name:'Pine Mill'},
  {s:357,lane:1,name:'Copper Falls'}, {s:491,lane:0,name:'Stone Gallery'},
  {s:632,lane:-1,name:'North Chapel'}, {s:760,lane:1,name:'High Bridge'},
  {s:895,lane:-1,name:'Switchback'}, {s:1038,lane:1,name:'Bellweather'},
];
export const BELL_NOTES=[{hz:293.665},{hz:329.628},{hz:369.994},{hz:440},{hz:493.883},{hz:587.330}];
const boostPads=[[54,0],[168,0],[261,1],[329,0],[400,-1],[464,1],[533,0],[608,0],[690,1],[738,0],[815,1],[869,0],[946,-1],[1018,0],[1065,1]];
const trestleWork=[[193,1],[285,-1],[381,1],[423,0],[513,-1],[553,0],[595,1],[651,-1],[716,1],[786,0],[833,1],[911,-1],[963,0],[991,-1]];
const bells=[0,2,3,1,4,2,5,0];
export const RACE_RECORD='chip-rush-bellweather-v2-downhill-ghost';

export function readRailRecord(storage){
  try{
    const r=JSON.parse(storage.getItem(RACE_RECORD));
    if(!r||!Number.isInteger(r.shipped)||r.shipped<1||r.shipped>8||!Number.isFinite(r.time)||r.time<COURSE_LENGTH/MAX_SPEED||r.time>100)return null;
    if(!Array.isArray(r.splits)||r.splits.length!==8||!r.splits.every(t=>Number.isFinite(t)&&t>=0&&t<=r.time))return null;
    if(!Array.isArray(r.trace)||r.trace.length<2||r.trace.length>1050)return null;
    if(!r.trace.every((p,i)=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)
      &&p[0]>=0&&p[0]<=r.time&&p[1]>=0&&p[1]<=COURSE_LENGTH&&Math.abs(p[2])<=1
      &&(!i||p[0]>=r.trace[i-1][0]&&p[1]>=r.trace[i-1][1])))return null;
    if(r.trace[0][0]!==0||r.trace.at(-1)[1]!==COURSE_LENGTH)return null;
    return r;
  }catch{return null;}
}
export function keepRailRecord(game,storage){
  const old=readRailRecord(storage);
  if(game.phase!=='finish'||!game.shipped||old&&(old.shipped>game.shipped||old.shipped===game.shipped&&old.time<=game.elapsed))return false;
  try{storage.setItem(RACE_RECORD,JSON.stringify({time:game.elapsed,shipped:game.shipped,splits:game.splits,trace:game.trace}));return true;}catch{return false;}
}

export class BellGame extends ShopGame {
  // The shared shift lifecycle owns scores, pause and results. All orders here
  // are physical trackside handoffs, so the shop's arrival timer is unused.
  spawn(){return false;}
  interact(){return false;}
  reset(shift=0){
    super.reset(shift);
    this.courseLength=COURSE_LENGTH;
    this.distance=0;this.speed=18;this.lane=0;this.targetLane=0;this.braking=false;
    this.boost=0;this.hitFlash=0;this.impacts=0;this.cooldown=0;this.phase='run';
    this.perfect=0;this.banks=0;this.pads=0;this.topSpeed=18;this.shots=[];this.splits=[];
    this.trace=[[0,0,0]];this.record=null;this.ghost=null;this.ghostIndex=0;
    this.feedback=null;this.scoreDetails={base:0,precision:0,bank:0,streak:0,sourcing:0,express:0};
    this.gates=[
      ...TOWERS.map((t,i)=>({...t,kind:'delivery',index:i})),
      ...boostPads.map(([s,lane])=>({s,lane,kind:'boost'})),
      ...trestleWork.map(([s,lane])=>({s,lane,kind:'work'})),
      {s:690,lane:-1,kind:'covari',name:'Laser-engraved dedication plate'},
    ].sort((a,b)=>a.s-b.s).map(g=>({...g,state:g.kind==='covari'?'locked':'ahead'}));
    this.deliveries=this.gates.filter(g=>g.kind==='delivery');
    this.spawnIndex=8;
  }

  switchLane(direction){
    if(this.mode!=='playing'||![-1,1].includes(direction))return;
    this.targetLane=Math.max(-1,Math.min(1,this.targetLane+direction));
  }
  aim(){
    const gate=this.deliveries.find(g=>g.state==='ahead');
    if(!gate)return null;
    const gap=gate.s-this.distance,offset=Math.abs(this.lane-gate.lane);
    const gold=gap>=15&&gap<=21,direct=offset<=.32;
    const bank=gold&&offset>=.68&&offset<=1.32;
    return {gate,gap,gold,direct,bank,open:gap>=9&&gap<=30&&(direct||bank)};
  }
  notice(text,type,seconds=1.1){
    this.feedback={text,type,until:this.elapsed+seconds};
    this.emit('railCue',{text,kind:type});
  }
  throwBell(){
    const aim=this.aim();
    if(this.mode!=='playing'||this.cooldown>0||!aim||aim.gate.fired)return false;
    const {gate,gap,open,bank,gold}=aim;
    if(gap>41){
      this.cooldown=.22;this.notice('Wait for the green strip','early',.55);return false;
    }
    gate.fired=true;
    const quality=!open?'miss':bank?'bank':gold?'perfect':'clean';
    gate.quality=quality;
    this.shots.push({fromS:this.distance,toS:gate.s,fromLane:this.lane,toLane:open?gate.lane:this.lane+.5,
      age:0,duration:Math.max(.18,gap/this.speed),success:open});
    this.cooldown=.34;
    if(!open)this.notice(gap>30?'Early release':gap<9?'Late release':'Outside throwing line','miss');
    else this.emit('railThrow',{quality});
    return open;
  }
  resolveGate(g){
    const aligned=Math.abs(this.lane-g.lane)<.46;
    if(g.kind==='delivery'){
      this.splits.push(this.elapsed);
      if(!g.quality||g.quality==='miss'){
        this.missed++;this.combo=0;g.state='miss';
        if(!g.fired)this.notice('Missed '+g.name,'miss');
        return;
      }
      g.state='hit';this.shipped++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);
      const gold=g.quality!=='clean',bank=g.quality==='bank';
      const precision=gold?260:0,bankPoints=bank?170:0,chain=Math.min(5,this.combo-1)*60;
      this.scoreDetails.base+=320;this.scoreDetails.precision+=precision;this.scoreDetails.bank+=bankPoints;this.scoreDetails.streak+=chain;
      const points=320+precision+bankPoints+chain;this.score+=points;
      if(this.shipped===this.config.passTarget)this.clearElapsed=this.elapsed;
      if(gold){this.perfect++;if(bank)this.banks++;this.kick(2.1,3.2);}
      this.notice((bank?'Cross-track catch':gold?'Bullseye':'Delivered')+'  +'+points,g.quality);
      this.emit('railBell',{note:bells[g.index],slot:g.index});
      if(this.shipped===2){const plate=this.gates.find(e=>e.kind==='covari');if(plate.s>this.distance)plate.state='ahead';}
      return;
    }
    g.state=aligned?'hit':'skip';
    if(!aligned)return;
    if(g.kind==='work'){
      this.speed=Math.max(14,this.speed*.54);this.impacts++;this.hitFlash=.65;this.boost=0;this.combo=0;
      this.notice('Track work · lost speed','crash');
    }else if(g.kind==='boost'){
      this.pads++;this.kick(3.4,5);this.notice('Express rail','boost',.6);
    }else{
      this.sourced=1;this.sourcePoints=300;this.score+=300;this.scoreDetails.sourcing+=300;
      this.notice('Covari plate collected  +300','covari',1.5);
    }
  }
  kick(duration,gain){this.boost=Math.max(this.boost,duration);this.speed=Math.min(MAX_SPEED,this.speed+gain);}
  tick(dt){
    if(this.mode!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    for(let left=Math.min(dt,.25);left>1e-8&&this.mode==='playing';){
      const step=Math.min(1/120,left);this.advance(step);left-=step;
    }
  }
  advance(dt){
    const old=this.distance;
    const cruise=this.braking?14:this.boost>0?MAX_SPEED:24;
    const rate=this.braking?18:this.speed>cruise?2.9:5.7;
    this.speed+=Math.sign(cruise-this.speed)*Math.min(Math.abs(cruise-this.speed),dt*rate);
    dt=Math.min(dt,(COURSE_LENGTH-old)/this.speed);
    this.elapsed+=dt;this.time=this.config.duration-this.elapsed;
    this.distance=Math.min(COURSE_LENGTH,old+this.speed*dt);
    this.lane+=Math.sign(this.targetLane-this.lane)*Math.min(Math.abs(this.targetLane-this.lane),dt*3.9);
    this.topSpeed=Math.max(this.topSpeed,this.speed);this.boost=Math.max(0,this.boost-dt);
    this.cooldown=Math.max(0,this.cooldown-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);
    for(const shot of this.shots)shot.age+=dt;
    if(this.shots.length&&this.shots[0].age>=this.shots[0].duration)this.shots.shift();
    for(const gate of this.gates)if(gate.s>old&&gate.s<=this.distance&&gate.state==='ahead')this.resolveGate(gate);
    if(this.elapsed-this.trace.at(-1)[0]>=.1)this.trace.push([this.elapsed,this.distance,this.lane]);
    if(this.distance>=COURSE_LENGTH-1e-7){
      this.trace.push([this.elapsed,COURSE_LENGTH,this.lane]);
      if(this.shipped>=this.config.passTarget){
        this.scoreDetails.express=Math.max(0,Math.floor((45-this.elapsed)*60));
        this.score+=this.scoreDetails.express;
      }
      this.phase='finish';this.finish('work-complete');
    }
    if(this.record){
      const trace=this.record.trace;
      while(this.ghostIndex+1<trace.length-1&&trace[this.ghostIndex+1][0]<=this.elapsed)this.ghostIndex++;
      const a=trace[this.ghostIndex],b=trace[this.ghostIndex+1];
      const t=Math.min(1,Math.max(0,(this.elapsed-a[0])/(b[0]-a[0]||1)));
      this.ghost={distance:a[1]+t*(b[1]-a[1]),lane:a[2]+t*(b[2]-a[2])};
    }
  }
  snapshot(){
    return {...super.snapshot(),distance:this.distance,speed:this.speed,lane:this.lane,targetLane:this.targetLane,
      next:this.aim(),impacts:this.impacts,perfect:this.perfect,banks:this.banks,pads:this.pads,splits:[...this.splits]};
  }
}
