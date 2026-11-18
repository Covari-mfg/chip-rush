import * as THREE from '../vendor/three.module.js';

// Painted in world coordinates so the mountain silhouettes and evening star
// remain anchored behind the belfry throughout the final camera move.
export function createBellSky(){
  const canvas=document.createElement('canvas');
  canvas.width=2560;canvas.height=768;
  const ctx=canvas.getContext('2d'),w=80,h=24;
  ctx.setTransform(canvas.width/w,0,0,-canvas.height/h,canvas.width/2,canvas.height*16/h);
  function gradient(bottom,top,stops){
    const g=ctx.createLinearGradient(0,bottom,0,top);
    for(const [at,color] of stops)g.addColorStop(at,color);
    return g;
  }
  function disc(x,y,r,fill){
    ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fill();
  }
  function polygon(points,fill){
    ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(...points[0]);
    for(const point of points.slice(1))ctx.lineTo(...point);
    ctx.closePath();ctx.fill();
  }
  ctx.fillStyle=gradient(-6,9,[[0,'#efa873'],[.32,'#eca688'],[.54,'#ae87a2'],[.76,'#65698f'],[1,'#353e69']]);
  ctx.fillRect(-40,-8,w,h);
  let seed=1811;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let i=0;i<270;i++)disc(random()*w-40,random()*12+2,.008+random()*.019,'#f9dfcf');
  const glow=ctx.createRadialGradient(-5.5,3.35,.15,-5.5,3.35,3.5);
  glow.addColorStop(0,'#ffdfad94');glow.addColorStop(1,'#ffd9b000');
  disc(-5.5,3.35,3.5,glow);disc(-5.5,3.35,.54,'#ffe5b2');
  // Broken bands of cloud catch the last warm light off the ridge.
  for(let i=0;i<100;i++){
    const x=random()*w-40,y=random()*5+.05,l=.2+random()*3;
    polygon([[x,y],[x+l*.65,y+.045],[x+l,y+.016],[x+l*.45,y-.028]],'#ffd7b22b');
  }
  function ridge(base,amp,fill,snow){
    const points=[];
    for(let x=-42;x<=42;x+=.85){
      const y=base+amp*(.38*Math.sin(x*.49)+.36*Math.sin(1.12*x+1)+.33*random());
      points.push([x,y]);
    }
    polygon([...points,[42,-8],[-42,-8]],fill);
    if(snow)for(let i=1;i<points.length-1;i++){
      const [x,y]=points[i],prev=points[i-1],next=points[i+1];
      if(y>prev[1]&&y>next[1])polygon([[x,y],[x+.54,(y+next[1])*.5],[x+.19,y-.23],[x-.02,y-.15],[x-.25,y-.34]],snow);
    }
  }
  ridge(.75,2.55,'#9f8299','#efb69e');
  ridge(-.48,2.15,'#716e91','#c799a1');
  ridge(-1.8,1.5,gradient(-6,.5,[[0,'#5c6480'],[1,'#665e7b']]));
  ridge(-3.2,1.2,'#424d69');
  for(let i=0;i<260;i++){
    const x=random()*w-40,y=-3.5+.38*Math.sin(x*.45)+random()*.18;
    ctx.fillStyle=random()>.4?'#e6ac79':'#b28083';ctx.fillRect(x,y,.045+random()*.07,.034);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,fog:false}));
  mesh.position.set(0,4,-13.6);return mesh;
}
