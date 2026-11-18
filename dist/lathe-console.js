import { ringBell } from './bell-audio.js';

const letters='ABC';
const diameter=v=>'Ø'+v.toFixed(2);
export function createLatheConsole(game,audio,{pause,retry}){
  const el=document.createElement('section');
  el.className='lathe-console';el.hidden=true;el.setAttribute('aria-label','Bellweather lathe controls');
  el.innerHTML=`<header class="lathe-head"><div class="lathe-title"><small>Bellweather Machine Works</small><h2>The Turning Room</h2></div>
    <div class="lathe-clock"><b data-time></b><small>remaining</small></div><div class="lathe-clock"><b data-count></b><small>accepted</small></div>
    <button data-retry aria-label="Restart batch" title="Restart (R)">↻</button><button data-pause aria-label="Pause shift">Ⅱ</button></header>
    <section class="lathe-print"><small data-number></small><h3 data-name></h3><canvas data-print width="540" height="152" aria-label="Dimensioned turning profile"></canvas><div data-tol></div></section>
    <div class="lathe-notice" role="status" data-feedback></div>
    <button class="lathe-supplier" data-plate hidden>Covari · engrave plate <strong>+300</strong> <kbd>C</kbd></button>
    <div class="lathe-deck"><div class="lathe-section"><small>Select section</small><div class="lathe-lands">${[0,1,2].map(i=>`<button data-land="${i}" aria-label="Select section ${letters[i]}"><span>${letters[i]} <kbd>${i+1}</kbd></span><b></b></button>`).join('')}</div></div>
    <div class="lathe-readout"><small data-axis></small><div class="lathe-measure"><strong data-od></strong><b data-goal></b></div><div class="lathe-band"><i></i><em data-needle></em></div><span data-advice></span></div>
    <div class="lathe-controls"><button data-feed title="Change feed">Feed <b></b> <kbd>F</kbd></button><button data-cut aria-description="Hold for continuous feed. One assistive activation makes a short cut.">Hold to cut <kbd>Space</kbd></button><button data-inspect>Inspect <kbd>E</kbd></button></div></div>`;
  document.getElementById('game').append(el);
  const ui=Object.fromEntries([...el.querySelectorAll('*')].flatMap(n=>Object.keys(n.dataset).map(k=>[k,n])));
  const sections=[...el.querySelectorAll('[data-land]')];
  const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  const focus=()=>document.getElementById('scene').focus({preventScroll:true});
  sections.forEach((b,i)=>b.onclick=()=>{game.selectLand(i);focus();});
  ui.retry.onclick=retry;ui.pause.onclick=pause;
  ui.feed.onclick=()=>{game.fast=!game.fast;focus();};
  ui.inspect.onclick=()=>{game.inspectPart();focus();};
  ui.plate.onclick=()=>{game.takePlate();focus();};
  let jogTimer;
  const cut=()=>{clearTimeout(jogTimer);if(game.mode==='playing')game.cutting=true;};
  const stop=()=>{clearTimeout(jogTimer);game.cutting=false;};
  ui.cut.onclick=e=>{if(e.detail===0){cut();jogTimer=setTimeout(stop,100);}};
  ui.cut.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();ui.cut.setPointerCapture(e.pointerId);cut();};
  ui.cut.onpointerup=ui.cut.onpointercancel=ui.cut.onlostpointercapture=stop;
  ui.cut.onkeydown=e=>{if(['Space','Enter'].includes(e.code)){e.stopPropagation();e.preventDefault();cut();}};
  ui.cut.onkeyup=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();stop();}};
  ui.cut.onblur=stop;
  let lastDrawing=null;
  function blueprint(d){
    const ctx=ui.print.getContext('2d');ctx.clearRect(0,0,540,152);
    ctx.lineWidth=1;ctx.strokeStyle='#337275';ctx.setLineDash([10,5,2,5]);
    ctx.beginPath();ctx.moveTo(8,78);ctx.lineTo(532,78);ctx.stroke();ctx.setLineDash([]);
    const xs=[36,192,348,504],cy=78;
    ctx.strokeStyle='#254e50';ctx.fillStyle='rgba(90,146,139,.15)';ctx.lineWidth=3;ctx.beginPath();
    for(let i=0;i<3;i++){const y=cy-d.targets[i]*1.65;if(!i)ctx.moveTo(xs[i],y);else ctx.lineTo(xs[i],y);ctx.lineTo(xs[i+1],y);}
    for(let i=2;i>=0;i--){const y=cy+d.targets[i]*1.65;ctx.lineTo(xs[i+1],y);ctx.lineTo(xs[i],y);}
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.textAlign='center';ctx.font='bold 22px monospace';ctx.fillStyle='#173a3d';
    for(let i=0;i<3;i++){ctx.fillText('Ø'+d.targets[i]+(d.finishLand===i?' ★':''),(xs[i]+xs[i+1])/2,86);}
  }
  let nextSound=0;
  function update(){
    const d=game.drawing,i=game.land;
    if(lastDrawing!==d){blueprint(d);lastDrawing=d;}
    text(ui.number,'Job '+String(Math.min(game.index+1,8)).padStart(2,'0')+' / 08');
    text(ui.name,d.name);text(ui.tol,'Tolerance ±'+d.tolerance.toFixed(2)+' mm'+(d.finishLand!=null?'   ·   ★ fine finish':''));
    text(ui.time,game.time.toFixed(1)+' s');text(ui.count,game.shipped+' / 8');
    sections.forEach((b,j)=>{b.setAttribute('aria-pressed',String(i===j));b.dataset.state=game.landStatus(j);text(b.querySelector('b'),'Ø'+d.targets[j]+(d.finishLand===j?' ★':''));});
    const error=game.errorAt(i),status=game.landStatus(i);
    text(ui.axis,'Section '+letters[i]+' · measured OD');text(ui.od,diameter(game.measured(i)));
    text(ui.goal,'Target Ø'+d.targets[i]);
    ui.needle.style.left=(50+Math.max(-1,Math.min(1,error/(4*d.tolerance)))*48)+'%';
    const next=sections.findIndex((_,j)=>game.landStatus(j)!=='fit');
    const advice=game.diameters.some((_,j)=>game.landStatus(j)==='under')?'Undersize · inspect to scrap':next<0?'All sections fit · inspect to ship':
      status==='fit'?'In tolerance · select '+letters[next]:status==='rough'?'Take a fine finish cut':
      Math.abs(error)<1.7&&game.fast?'Near size · switch to fine feed':'Hold Cut · remove '+Math.max(0,error).toFixed(2)+' mm';
    text(ui.advice,advice);el.dataset.fit=status;
    const canOrder=game.shipped>=2&&!game.sourced;ui.plate.hidden=!canOrder;
    text(ui.feedback,game.elapsed<game.feedbackUntil?game.feedback:'');text(ui.feed.querySelector('b'),game.fast?'Rough':'Fine');
    ui.cut.classList.toggle('engaged',game.cutting);ui.inspect.classList.toggle('ready',next<0);
    if(game.elapsed<nextSound-.3)nextSound=0;
    if(game.cutting&&game.travel===0&&game.elapsed>=nextSound){
      audio.note(game.fast?128:185,.12,'triangle',game.fast?.11:.06,0,game.fast?95:160);
      audio.note(630+game.diameters[i]*10,.042,'sine',.016);nextSound=game.elapsed+.105;
    }
  }
  function sound(event){
    if(event.type==='bellAccepted')ringBell(audio.ctx,audio.master,event.note,.8);
    if(event.type==='shopCue'&&event.kind==='scrap')audio.note(87,.26,'sawtooth',.11,0,43);
    if(event.type==='shopCue'&&event.kind==='check')audio.note(190,.12,'triangle',.14);
    if(event.type==='shopCue'&&event.kind==='order')audio.note(520,.25,'sine',.15);
  }
  function inspectionReport(){
    const report=document.createElement('details');report.className='lathe-report';
    const summary=document.createElement('summary');summary.textContent='Inspection sheet · '+game.partLog.length+' parts checked';report.append(summary);
    const table=document.createElement('table');
    const head=table.createTHead().insertRow();
    for(const title of ['Part','A','B','C','Result']){const th=document.createElement('th');th.scope='col';th.textContent=title;head.append(th);}
    for(const part of game.partLog){
      const row=table.insertRow();const cells=[part.name,...part.diameters.map(diameter),part.accepted?'Pass':'Scrap'];
      cells.forEach((value,j)=>{const cell=row.insertCell();cell.textContent=value;
        if(j>=1&&j<=3){
          const spec=document.createElement('small');spec.textContent='Ø'+part.targets[j-1]+' ±'+part.tolerance.toFixed(2);cell.append(spec);
          if(Math.abs(part.diameters[j-1]-part.targets[j-1])>part.tolerance+1e-7)cell.className='out-of-size';
        }});
    }
    report.append(table);return report;
  }
  return {el,update,sound,inspectionReport};
}
