import { ShopGame } from './core.js';

// Feed is diameter removed per game second. Values are arcade controls.
export const FEED_FINE=2.4;
export const FEED_ROUGH=8;
export const FINISH_ALLOWANCE=.30;
export const BELL_NOTES=[{hz:293.665},{hz:329.628},{hz:369.994},{hz:440},{hz:493.883},{hz:587.330}];
export const DRAWINGS=[
  ['Bell hanger pin',[28,24,28],.85],
  ['Clapper spindle',[24,30,22],.75],
  ['Rope pulley axle',[22,28,22],.70,0],
  ['Pivot bushing blank',[28,26,20],.65,1],
  ['Hammer pivot',[20,27,23],.60,0],
  ['Yoke trunnion',[25,30,21],.55,2],
  ['Bearing sleeve blank',[28,23,25],.50,1],
  ['Escapement arbor',[19,26,22],.45,2],
].map(([name,targets,tolerance,finishLand])=>({name,targets,tolerance,finishLand,stock:32}));

export class BellGame extends ShopGame{
  spawn(){return false;}
  interact(){return false;}
  reset(shift=0){
    super.reset(shift);
    this.index=0;this.spawnIndex=DRAWINGS.length;this.partLog=[];this.reworkCount=0;this.scrapped=0;
    this.fast=true;this.feedback='';this.feedbackUntil=0;this.scoreDetails={base:0,precision:0,streak:0,sourcing:0,speed:0};
    this.loadBlank();
  }
  loadBlank(){
    this.drawing=DRAWINGS[this.index];this.land=0;this.cutting=false;this.travel=0;
    this.diameters=Array(3).fill(this.drawing.stock);this.fineStock=[0,0,0];
    this.reworked=false;
  }
  selectLand(index){
    if(this.mode!=='playing'||!Number.isInteger(index)||index<0||index>2||index===this.land)return;
    this.land=index;this.travel=.15;
  }
  get finishOK(){
    const i=this.drawing.finishLand;return i===undefined||this.fineStock[i]>=FINISH_ALLOWANCE-1e-7;
  }
  measured(i){return Math.round(this.diameters[i]*100)/100;}
  errorAt(i){return this.measured(i)-this.drawing.targets[i];}
  landStatus(i){
    const delta=this.errorAt(i),tol=this.drawing.tolerance;
    if(delta < -tol-1e-7)return 'under';
    if(delta > tol+1e-7)return 'over';
    if(i===this.drawing.finishLand&&!this.finishOK)return 'rough';
    return 'fit';
  }
  notice(text,kind){
    this.feedback=text;this.feedbackUntil=this.elapsed+2.5;this.emit('shopCue',{kind});
  }
  takePlate(){
    if(this.mode!=='playing'||this.sourced||this.shipped<2)return false;
    this.sourced=1;this.sourcePoints=300;this.score+=300;this.scoreDetails.sourcing+=300;
    this.notice('Engraved plate outsourced · +300','order');return true;
  }
  inspectPart(){
    if(this.mode!=='playing')return false;
    this.cutting=false;
    const states=this.diameters.map((_,i)=>this.landStatus(i)),under=states.indexOf('under');
    if(under>=0){
      this.scrapped++;this.missed++;this.combo=0;
      this.notice('Scrapped · '+String.fromCharCode(65+under)+' was undersize','scrap');
    }else{
      const issue=states.findIndex(s=>s!=='fit');
      if(issue>=0){
        this.selectLand(issue);
        if(!this.reworked){this.reworkCount++;this.reworked=true;}
        const label=String.fromCharCode(65+issue);
        this.notice(states[issue]==='rough'?'Finish '+label+' with fine feed':'Rework '+label+' · still oversized','check');return false;
      }
      const worst=Math.max(...this.drawing.targets.map((_,i)=>Math.abs(this.errorAt(i))));
      const precision=Math.max(0,Math.round(480*(1-worst/this.drawing.tolerance)));
      const chain=Math.min(4,this.combo)*50;
      this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.shipped++;
      this.scoreDetails.base+=320;this.scoreDetails.precision+=precision;this.scoreDetails.streak+=chain;
      this.score+=320+precision+chain;
      if(this.shipped===this.config.passTarget)this.clearElapsed=this.elapsed;
      this.notice(this.drawing.name+' passed · +'+(320+precision+chain),'accepted');
      this.emit('bellAccepted',{note:this.index%BELL_NOTES.length});
    }
    this.partLog.push({name:this.drawing.name,diameters:this.diameters.map((_,i)=>this.measured(i)),targets:this.drawing.targets,
      tolerance:this.drawing.tolerance,accepted:under<0});
    this.index++;
    if(this.index===DRAWINGS.length)this.closeBatch('work-complete');
    else this.loadBlank();
    return under<0;
  }
  closeBatch(reason){
    this.cutting=false;this.missed=DRAWINGS.length-this.shipped;
    if(this.shipped>=this.config.passTarget){
      this.scoreDetails.speed=Math.max(0,Math.floor((60-this.elapsed)*40));
      this.score+=this.scoreDetails.speed;
    }
    this.finish(reason);
  }
  tick(dt){
    if(this.mode!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.25,this.time);this.elapsed+=dt;this.time=Math.max(0,this.config.duration-this.elapsed);
    const moving=Math.min(dt,this.travel);this.travel-=moving;
    if(this.cutting&&dt>moving){
      const i=this.land,old=this.diameters[i];
      this.diameters[i]=Math.max(8,old-(dt-moving)*(this.fast?FEED_ROUGH:FEED_FINE));
      if(old>this.diameters[i]){
        if(this.fast)this.fineStock[i]=0;
        else this.fineStock[i]+=old-this.diameters[i];
      }
    }
    if(this.time<=1e-7)this.closeBatch('time-up');
  }
  snapshot(){
    return {...super.snapshot(),index:this.index,land:this.land,diameters:[...this.diameters],drawing:this.drawing,
      cutting:this.cutting,fast:this.fast,finishOK:this.finishOK,scrapped:this.scrapped,feedback:this.feedback};
  }
}
