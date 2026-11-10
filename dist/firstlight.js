// First Light's ending: what the finished telescope sees. Each mirror segment
// first makes its own blurred copy of one star; the copies are walked onto
// each other, and then the sky behind the star comes into focus. How many
// segments the shift installed decides how bright and how sharp the picture
// is. Everything is drawn here from a fixed seed; there are no image assets.
export const FIRST_LIGHT={open:3.2,align:3.4,reveal:8.4,hold:10.6,end:15};
const SQ3=Math.sqrt(3);
const INNER=[[0,-1],[1,-1],[1,0],[0,1],[-1,1],[-1,0]];
const OUTER=[[0,-2],[1,-2],[2,-2],[2,-1],[2,0],[1,1],[0,2],[-1,2],[-2,2],[-2,1],[-2,0],[-1,-1]];
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const ease=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
// 0 to 1: how well the picture resolves for a shift's star rating.
export function sharpness(stars,passed){return !passed?.2:stars>=3?1:stars===2?.82:.64;}
// One spot per segment that is actually in the mirror, laid out like the mirror.
export function segmentSpots(made,flown=6){
  const cells=[...INNER.slice(0,flown),...OUTER.slice(0,Math.max(0,Math.min(OUTER.length,made)))],random=seeded(7);
  return cells.map(([q,r],i)=>({x:SQ3*(q+r/2)/4.2+(random()-.5)*.1,y:1.5*r/4.2+(random()-.5)*.1,delay:random()*.35,index:i}));
}

function paintField(field){
  const f=field.getContext('2d'),S=field.width,random=seeded(20261110);
  f.fillStyle='#02030a';f.fillRect(0,0,S,S);
  const wash=f.createRadialGradient(S*.6,S*.35,0,S*.6,S*.35,S*.8);wash.addColorStop(0,'rgba(34,46,92,.5)');wash.addColorStop(1,'rgba(2,3,10,0)');f.fillStyle=wash;f.fillRect(0,0,S,S);
  const palette=['255,217,160','255,179,138','169,200,255','255,241,214','255,143,107','205,225,255'];
  const smudge=(x,y,length,ratio,angle,color,alpha)=>{
    f.save();f.translate(x,y);f.rotate(angle);f.scale(1,ratio);
    const g=f.createRadialGradient(0,0,0,0,0,length);g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(.35,`rgba(${color},${alpha*.45})`);g.addColorStop(1,`rgba(${color},0)`);
    f.fillStyle=g;f.beginPath();f.arc(0,0,length,0,Math.PI*2);f.fill();f.restore();
  };
  // Hundreds of distant galaxies: small, tilted, in old-light and young-light colors.
  for(let i=0;i<420;i++){const depth=random();smudge(random()*S,random()*S,1.2+depth*depth*depth*13,.28+random()*.72,random()*Math.PI,palette[Math.floor(random()*palette.length)],.22+random()*.6);}
  // A cluster whose weight bends the light behind it into thin arcs.
  const cx=S*.7,cy=S*.29;
  for(let i=0;i<26;i++){const a=random()*Math.PI*2,d=Math.pow(random(),1.6)*S*.1;smudge(cx+Math.cos(a)*d,cy+Math.sin(a)*d,3+random()*8,.5+random()*.5,random()*Math.PI,'255,214,158',.5+random()*.4);}
  f.lineCap='round';
  for(let i=0;i<9;i++){const radius=S*(.075+random()*.11),start=random()*Math.PI*2,span=.18+random()*.34;f.strokeStyle=`rgba(${random()>.5?'255,170,120':'190,210,255'},${.3+random()*.35})`;f.lineWidth=.9+random()*1.6;f.beginPath();f.arc(cx,cy,radius,start,start+span);f.stroke();}
  // One grand spiral, close enough to show its arms.
  f.save();f.translate(S*.27,S*.71);f.rotate(-.5);f.scale(1,.56);
  const core=f.createRadialGradient(0,0,0,0,0,S*.2);core.addColorStop(0,'rgba(255,236,200,.95)');core.addColorStop(.12,'rgba(255,205,150,.5)');core.addColorStop(.5,'rgba(120,150,230,.12)');core.addColorStop(1,'rgba(120,150,230,0)');
  f.fillStyle=core;f.beginPath();f.arc(0,0,S*.2,0,Math.PI*2);f.fill();
  for(let arm=0;arm<2;arm++)for(let k=0;k<620;k++){
    const u=k/620,theta=u*Math.PI*3.1+arm*Math.PI,radius=S*.014*Math.exp(theta*.26-arm*Math.PI*.26),spread=(random()+random()-1)*S*.012*(.5+u*1.8);
    const x=Math.cos(theta)*radius+Math.cos(theta+1.57)*spread,y=Math.sin(theta)*radius+Math.sin(theta+1.57)*spread,pink=random()>.93;
    f.fillStyle=pink?`rgba(255,120,150,${.5+random()*.4})`:`rgba(${Math.round(255-u*70)},${Math.round(222-u*10)},${Math.round(190+u*65)},${.16+random()*.5})`;
    f.beginPath();f.arc(x,y,pink?1.5+random()*1.4:.6+random()*1.5,0,Math.PI*2);f.fill();
  }
  f.restore();
  // A few nearer stars, each with the six-plus-two spikes of a hexagonal mirror.
  // They keep clear of the centre, where the alignment star sits.
  for(let i=0;i<5;i++){const a=random()*Math.PI*2,d=S*(.27+random()*.19);star(f,S/2+Math.cos(a)*d,S/2+Math.sin(a)*d,S*(.007+random()*.008),.6);}
}
function star(ctx,x,y,size,alpha,spikes=1){
  ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';
  const glow=ctx.createRadialGradient(0,0,0,0,0,size*2.6);glow.addColorStop(0,`rgba(255,250,235,${alpha})`);glow.addColorStop(.18,`rgba(210,225,255,${alpha*.6})`);glow.addColorStop(1,'rgba(150,180,255,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,size*2.6,0,Math.PI*2);ctx.fill();
  if(spikes>0)for(let i=0;i<8;i++){
    const main=i<6,angle=main?Math.PI/6+i*Math.PI/3:i===6?0:Math.PI,length=size*(main?9:4.5)*spikes;
    const g=ctx.createLinearGradient(0,0,Math.cos(angle)*length,Math.sin(angle)*length);g.addColorStop(0,`rgba(235,240,255,${alpha*(main?.8:.5)})`);g.addColorStop(1,'rgba(200,215,255,0)');
    ctx.strokeStyle=g;ctx.lineWidth=Math.max(.8,size*(main?.2:.12));ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(angle)*length,Math.sin(angle)*length);ctx.stroke();
  }
  ctx.restore();
}

export function createFirstLight(canvas){
  const ctx=canvas.getContext('2d'),S=canvas.width,field=canvas.ownerDocument.createElement('canvas');
  field.width=field.height=S;
  let state=null,painted=false;
  function start({made=0,flown=6,total=18,stars=0,passed=false,reduced=false}={}){
    if(!painted){paintField(field);painted=true;}
    state={spots:segmentSpots(made,flown),count:made+flown,total,sharp:sharpness(stars,passed),passed,reduced};
    draw(0);
  }
  function draw(t){
    if(!state)return;
    const {spots,sharp,passed,reduced}=state,T=FIRST_LIGHT;
    const align=reduced?(t>=T.align?1:0):ease((t-T.align)/(T.reveal-T.align)),reveal=reduced?(t>=T.reveal?1:0):ease((t-T.reveal)/(T.hold-T.reveal));
    const hold=Math.max(0,t-T.hold),light=spots.length/state.total;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#02030a';ctx.fillRect(0,0,S,S);
    if(reveal>0){
      const zoom=1.08-.05*reveal+(reduced?0:Math.min(.035,hold*.008));
      ctx.save();ctx.translate(S/2,S/2);ctx.scale(zoom,zoom);ctx.globalAlpha=reveal*(passed?.55+.45*light:.3);ctx.drawImage(field,-S/2,-S/2);ctx.restore();
    }
    // Every segment's copy of the star walks to the centre and stacks there.
    // Too little mirror never fully stacks: the copies stay a loose cluster.
    const spread=S*.36,rest=passed?0:.2;
    ctx.globalCompositeOperation='lighter';
    for(const spot of spots){
      const k=ease((align-spot.delay*.6)/(1-spot.delay*.6)),away=(1-k)+rest*k;
      const x=S/2+spot.x*spread*away,y=S/2+spot.y*spread*away,radius=S*(.03-.016*k);
      const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,`rgba(255,244,220,${.5+.2*k})`);g.addColorStop(.4,`rgba(255,214,150,${.22})`);g.addColorStop(1,'rgba(255,200,120,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
    if(passed&&align>.72)star(ctx,S/2,S/2,S*.017*(.6+.4*light),ease((align-.72)/.28)*(.55+.45*light),ease((align-.8)/.2)*(.55+.45*sharp));
    // Out of focus until the copies stack; the star rating sets the final focus.
    const blur=(1-align)*9+(1-sharp)*(passed?5.5:9)*Math.max(align,.001);
    canvas.style.filter=blur>.05?`blur(${blur.toFixed(2)}px)`:'none';
    canvas.style.opacity=String(reduced?(t>=T.open?1:0):ease((t-T.open)/.9));
    canvas.style.transform=`scale(${reduced?1:.55+.45*ease((t-T.open)/1.1)})`;
  }
  return {start,draw,get state(){return state;}};
}
