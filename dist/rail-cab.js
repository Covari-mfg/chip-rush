import { ringBell } from './bell-audio.js';

const tracks=['Left','Centre','Right'];
const masthead='<span class="rail-wing" aria-hidden="true">≋</span> Bellweather Railway';
export function createRailCab(game,audio,{pause,retry}){
  const el=document.createElement('section');
  el.className='rail-cab';el.hidden=true;el.setAttribute('aria-label','Downhill Express controls');
  el.innerHTML=`<div class="rail-mast"><small>${masthead}</small><strong>Downhill Express</strong>
    <div class="rail-stops" aria-label="Eight deliveries">${'<i></i>'.repeat(8)}</div></div>
    <div class="rail-clock"><div><small>Run time</small><strong data-time></strong></div><div><small>Score</small><b data-score></b></div>
      <button data-retry aria-label="Retry race" title="Retry (R)">↻</button><button data-pause aria-label="Pause" title="Pause (Esc)">Ⅱ</button></div>
    <div class="rail-feedback" data-feedback role="status"></div>
    <div class="rail-covari" data-covari></div>
    <div class="rail-destination"><small data-stop></small><strong data-name></strong><b data-track></b></div>
    <div class="rail-speed"><strong data-speed></strong><small>km/h</small><b data-drive></b></div>
    <div class="rail-controls"><div class="rail-steer"><button data-left aria-label="Switch left">← <kbd>A</kbd></button><button data-right aria-label="Switch right">→ <kbd>D</kbd></button></div>
      <div class="rail-timing"><div class="rail-meter-title"><b data-aim></b><span data-split></span></div>
      <div class="rail-meter"><i class="rail-window"></i><i class="rail-gold"></i><i class="rail-marker" data-marker></i></div></div>
      <div class="rail-actions"><button data-brake aria-label="Hold brake">Brake <kbd>S</kbd></button><button data-throw aria-label="Throw bell">Throw <kbd>Space</kbd></button></div></div>`;
  document.getElementById('game').append(el);
  const ui=Object.fromEntries([...el.querySelectorAll('*')].flatMap(node=>Object.keys(node.dataset).map(k=>[k,node])));
  const stops=[...el.querySelectorAll('.rail-stops i')];
  const set=(k,value)=>{const text=String(value);if(ui[k].textContent!==text)ui[k].textContent=text;};
  const refocus=()=>document.getElementById('scene').focus({preventScroll:true});
  const actions={left:()=>game.switchLane(-1),right:()=>game.switchLane(1),throw:()=>game.throwBell(),retry,pause};
  for(const [name,action] of Object.entries(actions))ui[name].onclick=()=>{action();if(name!=='pause')refocus();};
  const brake=ui.brake;
  const hold=()=>{game.braking=true;brake.classList.add('held');};
  const release=()=>{game.braking=false;brake.classList.remove('held');};
  brake.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();brake.setPointerCapture(e.pointerId);hold();};
  brake.onpointerup=brake.onpointercancel=brake.onlostpointercapture=release;
  brake.onkeydown=e=>{if(['Space','Enter'].includes(e.code)){e.stopPropagation();e.preventDefault();hold();}};
  brake.onkeyup=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();release();}};
  brake.onblur=release;window.addEventListener('blur',release);
  let wheel=0,lastStop='',wheelStep=0;
  function update(){
    const aim=game.aim(),gate=aim?.gate;
    set('time',game.elapsed.toFixed(2));set('score',game.score.toLocaleString());
    set('speed',Math.round(game.speed*3.6));set('drive',game.braking?'Brake':game.boost>0?'Express':'Coasting');
    el.dataset.drive=game.braking?'brake':game.boost>0?'express':'coast';
    const stopKey=game.shipped+'/'+game.missed;
    if(lastStop!==stopKey){
      stops.forEach((stop,i)=>{stop.dataset.state=game.deliveries[i].state;});
      lastStop=stopKey;
    }
    set('stop',gate?'Next stop   '+String(gate.index+1).padStart(2,'0')+' / 08':'Finish line');
    set('name',gate?.name??'Terminus');
    set('track',aim?tracks[gate.lane+1]+' track  ·  '+Math.ceil(aim.gap)+' m':Math.ceil(game.courseLength-game.distance)+' m');
    const status=!aim?'Finish straight':gate.fired?(gate.quality==='miss'?'Missed throw':'Bell away'):aim.open?(aim.bank?'Bank shot':aim.gold?'Bullseye':'Throw now'):aim.gap>30?'Approach':aim.gap<9?'Too late':'Line up';
    set('aim',status);
    el.dataset.window=gate&&!gate.fired&&aim.open?(aim.gold?'gold':'green'):'';
    ui.marker.style.left=Math.max(0,Math.min(100,(50-(aim?.gap??0))*2))+'%';
    const fb=game.feedback?.until>game.elapsed?game.feedback:null;
    set('feedback',fb?.text??'');ui.feedback.dataset.kind=fb?.type??'';
    el.classList.toggle('rail-impact',game.hitFlash>.38);
    const plate=game.gates.find(g=>g.kind==='covari');
    const gap=plate.s-game.distance;
    set('covari',plate.state==='ahead'&&gap>0&&gap<108?'↙  Covari · engraved plate   +300  /  '+Math.ceil(gap)+' m':'');
    const split=game.splits.length-1;
    if(game.record&&split>=0){
      const delta=game.splits[split]-game.record.splits[split];
      set('split','Split '+(delta>=0?'+':'−')+Math.abs(delta).toFixed(2)+' s');
    }else if(game.ghost)set('split','Ghost '+game.record.time.toFixed(2)+' s');
    else set('split',gate?.index===0?'Green to throw · gold to boost':'');
    if(game.elapsed<wheel-.8){wheel=0;wheelStep=0;}
    if(game.mode==='playing'&&game.elapsed>=wheel){
      const accent=wheelStep++%4===0;
      audio.note(accent?89:67,.045,'triangle',accent?.041:.021);
      if(accent)audio.note(225,.018,'triangle',.017,.045);
      wheel=game.elapsed+Math.max(.12,.44-game.speed*.0065);
    }
  }
  function sound(event){
    if(event.type==='railBell')ringBell(audio.ctx,audio.master,event.note,.70);
    if(event.type==='railThrow')audio.note(event.quality==='clean'?430:640,.12,'triangle',.07);
    if(event.type!=='railCue')return;
    if(event.kind==='crash'){audio.note(62,.3,'sawtooth',.10);audio.note(92,.19,'triangle',.08,.045);}
    if(event.kind==='boost'){audio.note(196,.11,'triangle',.055);audio.note(294,.13,'triangle',.045,.08);}
    if(event.kind==='bank')audio.note(880,.2,'sine',.055,.16);
    if(event.kind==='covari')ringBell(audio.ctx,audio.master,5,.45);
  }
  return {el,update,sound};
}
