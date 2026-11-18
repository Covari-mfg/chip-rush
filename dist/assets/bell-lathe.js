import * as THREE from '../vendor/three.module.js';

// A small working shop, arranged around the spindle's X axis.
export function createBellLathe(){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#25383b');
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);
  scene.add(new THREE.HemisphereLight('#e5f5ee','#3a3029',2.1));
  const key=new THREE.DirectionalLight('#fff0cf',2.7);key.position.set(-3,8,8);scene.add(key);
  const rim=new THREE.DirectionalLight('#a6e7e3',1.3);rim.position.set(4,5,-5);scene.add(rim);
  const mat=(color,metalness=0,roughness=.65,extra={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
  const paint=mat('#88b6ad',.35,.42),paintDark=mat('#46756f',.35,.52),edge=mat('#b0d3c8',.3,.4),iron=mat('#384c50',.8,.36),steel=mat('#aebfc0',.85,.25),dark=mat('#1c2b2e',.55,.45),brass=mat('#cba35d',.82,.27),bright=mat('#ead69b',.8,.22),wall=mat('#52635e'),floor=mat('#344441'), lamp=mat('#fff2c3',.15,.3,{emissive:'#ffd58a',emissiveIntensity:1.1});
  // A shop roof, skylights and dark floor provide reflections on turned metal.
  function texture(width,height,draw){
    const c=document.createElement('canvas');c.width=width;c.height=height;
    draw(c.getContext('2d'),width,height);
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return map;
  }
  const shopLight=texture(512,256,(ctx,w,h)=>{
    const shade=ctx.createLinearGradient(0,0,0,h);
    shade.addColorStop(0,'#37535a');shade.addColorStop(.42,'#9baca0');shade.addColorStop(.55,'#52453c');shade.addColorStop(1,'#132527');
    ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#fff1d6':'#cee2dd';ctx.fillRect(i*79+16,38,44,47);}
    ctx.fillStyle='#ffe7ba';ctx.fillRect(28,10,170,6);
  });
  shopLight.mapping=THREE.EquirectangularReflectionMapping;scene.environment=shopLight;scene.environmentIntensity=.68;
  const castTexture=texture(128,128,(ctx,w,h)=>{
    ctx.fillStyle='#e5e4da';ctx.fillRect(0,0,w,h);
    let n=91;
    for(let i=0;i<1600;i++){n=(Math.imul(n,1664525)+1013904223)>>>0;ctx.fillStyle=i%2?'#adafa840':'#fffdf540';ctx.fillRect(n%128,(n>>>16)%128,1,1);}
  });
  paint.map=castTexture;paintDark.map=castTexture;
  const boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(1,1,1,48);
  function box(p,x,y,z,w,h,d,m){const o=new THREE.Mesh(boxGeo,m);o.position.set(x,y,z);o.scale.set(w,h,d);p.add(o);return o}
  function cyl(p,x,y,z,r,len,m){const o=new THREE.Mesh(cylGeo,m);o.position.set(x,y,z);o.scale.set(r,len,r);o.rotation.z=Math.PI/2;p.add(o);return o}
  function bolt(p,x,y,z,r=.045){const o=new THREE.Mesh(new THREE.SphereGeometry(r,10,6),steel);o.position.set(x,y,z);p.add(o);return o}
  function ring(p,x,y,z,r,t,m,arc=Math.PI*2){const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,48,arc),m);o.position.set(x,y,z);o.rotation.y=Math.PI/2;p.add(o);return o}
  box(scene,0,-.08,0,30,.15,20,floor);box(scene,0,4,-3.4,30,8,.25,wall);
  // Tall foundry glazing and overhead practical lamps establish the shop.
  for(const [index,x] of [-6,-2,2,6].entries()){
    box(scene,x,4.6,-3.24,2.7,4.1,.12,dark);
    const glass=texture(192,256,(ctx,w,h)=>{
      const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#859ea8');sky.addColorStop(.7,'#f2c58b');sky.addColorStop(1,'#e5dbb2');
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#8c9390';ctx.beginPath();ctx.moveTo(0,h);
      for(let i=0;i<=12;i++)ctx.lineTo(i*w/12,124+21*Math.sin((index*12+i)*.59)+8*Math.sin((index*12+i)*1.2));
      ctx.lineTo(w,h);ctx.fill();
      ctx.fillStyle='#647774';
      for(let i=0;i<4;i++){const left=i*57-index*5;ctx.beginPath();ctx.moveTo(left,196);ctx.lineTo(left+52,169-index*2);ctx.lineTo(left+52,197);ctx.fill();}
      ctx.fillRect(0,195,w,61);ctx.fillRect(26+index*13,139,8,58);ctx.fillRect(23+index*13,137,14,4);
      ctx.fillStyle='#c2b697';for(let i=0;i<10;i++)ctx.fillRect(i*23,207,12,19);
    });
    box(scene,x,4.6,-3.15,2.48,3.88,.08,new THREE.MeshBasicMaterial({map:glass}));
    for(const dx of [-.82,0,.82])box(scene,x+dx,4.6,-3.08,.055,3.9,.08,iron);
    for(const y of [3.3,4.6,5.9])box(scene,x,y,-3.08,2.5,.06,.08,iron);
    box(scene,x,2.55,-3.03,2.85,.12,.38,paintDark);
  }
  const shadowMap=texture(256,128,(ctx,w,h)=>{
    ctx.scale(w,h);const shade=ctx.createRadialGradient(.5,.5,.09,.5,.5,.51);
    shade.addColorStop(0,'rgba(8,17,17,.83)');shade.addColorStop(.7,'rgba(8,17,17,.49)');shade.addColorStop(1,'rgba(8,17,17,0)');
    ctx.fillStyle=shade;ctx.fillRect(0,0,1,1);
  });
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(12,4.8),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));
  contact.rotation.x=-Math.PI/2;contact.position.set(0,.005,.15);scene.add(contact);
  for(const x of [-3,2.8]){box(scene,x,7,-.4,.06,1.8,.06,dark);const shade=new THREE.Mesh(new THREE.ConeGeometry(.58,.36,20,1,true),iron);shade.position.set(x,6.15,-.4);shade.rotation.x=Math.PI;scene.add(shade);const bulb=new THREE.Mesh(new THREE.SphereGeometry(.19,16,8),lamp);bulb.position.set(x,6,-.4);scene.add(bulb);const light=new THREE.PointLight('#ffd89d',9,10);light.position.set(x,5.8,0);scene.add(light)}
  // Bed, front apron and two rails. The work is deliberately unobstructed.
  box(scene,0,.58,0,8.7,1.05,2.15,paintDark);box(scene,0,1.2,0,8.9,.3,2.35,paint);box(scene,0,1.39,-.42,8.1,.14,.34,steel);box(scene,0,1.39,.53,8.1,.14,.35,steel);
  box(scene,0,.58,1.1,8.3,.82,.08,paint);for(const x of [-3.5,0,3.5]){box(scene,x,.58,1.16,2.05,.55,.06,paintDark);for(const dx of [-.85,.85])for(const y of [.4,.76])bolt(scene,x+dx,y,1.21)}
  for(const x of [-3.3,3.3])box(scene,x,.17,0,1.7,.34,2.4,iron);
  // Headstock casing, inspection panels and a three-jaw chuck.
  box(scene,-3.35,2.15,-.15,2.05,1.65,1.8,paint);box(scene,-3.35,3.04,-.15,1.9,.18,1.7,edge);box(scene,-3.4,2.15,.78,1.6,1.08,.07,paintDark);box(scene,-3.4,2.15,.83,1.35,.84,.06,paint);
  for(const x of [-3.95,-2.85])for(const y of [1.84,2.46])bolt(scene,x,y,.88);
  const spindleY=2.75;const chuck=new THREE.Group();chuck.position.set(-2.19,spindleY,0);scene.add(chuck);
  cyl(chuck,0,0,0,.72,.4,iron);cyl(chuck,.23,0,0,.64,.12,steel);ring(chuck,.3,0,0,.49,.025,dark);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const jaw=new THREE.Group();jaw.rotation.x=a;chuck.add(jaw);box(jaw,.35,.43,0,.3,.38,.25,iron);box(jaw,.48,.28,0,.25,.24,.2,steel);bolt(jaw,.51,.48,.13,.045)}
  // Three independent cylinders make changing diameters physically legible.
  const stockStart=-1.85,landLength=1.15,stockRadius=.46;const lands=[],references=[],edges=[];
  const refMat=new THREE.MeshBasicMaterial({color:'#9df4d5',transparent:true,opacity:.58,depthWrite:false});
  for(let i=0;i<3;i++){const x=stockStart+landLength*(i+.5);const land=cyl(scene,x,spindleY,0,stockRadius,landLength+.008,brass);lands.push(land);const ref=ring(scene,x,spindleY,0,1,.018,refMat,Math.PI*1.14);references.push(ref);const edgeRing=ring(scene,stockStart+landLength*i,spindleY,0,stockRadius,.009,steel);edges.push(edgeRing);for(let j=1;j<6;j++){const groove=ring(scene,stockStart+landLength*(i+j/6),spindleY,0,stockRadius+.002,.0035,bright);(land.userData.grooves??=[]).push(groove)}}
  edges.push(ring(scene,stockStart+landLength*3,spindleY,0,stockRadius,.009,steel));
  function label(text,x){const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#203e40';ctx.fillRect(17,16,94,94);ctx.strokeStyle='#efcf82';ctx.lineWidth=4;ctx.strokeRect(17,16,94,94);ctx.fillStyle='#fff0be';ctx.font='bold 69px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,65);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false}));sprite.position.set(x,spindleY+.78,0);sprite.scale.set(.34,.34,.34);scene.add(sprite);return sprite}
  const labels=['A','B','C'].map((v,i)=>label(v,stockStart+landLength*(i+.5)));
  // Rear splash guard, leadscrew, apron controls and speed chart.
  box(scene,0,1.82,-1.05,8.15,.95,.12,paintDark);box(scene,0,2.28,-1.05,8.15,.07,.18,edge);
  cyl(scene,0,1.31,1.16,.085,7.9,steel);for(let x=-3.75;x<3.75;x+=.19)ring(scene,x,1.31,1.16,.09,.012,iron);
  const apronWheel=new THREE.Group();apronWheel.position.set(.7,.61,1.24);scene.add(apronWheel);const aw=new THREE.Mesh(new THREE.TorusGeometry(.25,.035,8,24),iron);apronWheel.add(aw);for(let a=0;a<Math.PI;a+=Math.PI/2){const spoke=box(apronWheel,0,0,0,.045,.46,.05,steel);spoke.rotation.z=a}bolt(apronWheel,0,0,.04,.07);
  const plate=document.createElement('canvas');plate.width=256;plate.height=128;const pc=plate.getContext('2d');pc.fillStyle='#263e3b';pc.fillRect(0,0,256,128);pc.strokeStyle='#d8c991';pc.strokeRect(4,4,248,120);pc.fillStyle='#f2e2ad';pc.textAlign='center';pc.font='bold 22px sans-serif';pc.fillText('SPINDLE SPEED',128,30);pc.font='18px monospace';pc.fillText('180  320  560',128,63);pc.fillText('900  1400 RPM',128,92);const plateMap=new THREE.CanvasTexture(plate);plateMap.colorSpace=THREE.SRGBColorSpace;const speedPlate=new THREE.Mesh(new THREE.PlaneGeometry(.65,.33),new THREE.MeshBasicMaterial({map:plateMap}));speedPlate.position.set(-3.38,2.71,.86);scene.add(speedPlate);
  // Centre support at the right and its rotating handwheel.
  box(scene,3.1,1.84,-.18,1.1,.86,1.36,paint);box(scene,3.1,2.3,-.18,.88,.18,1.2,edge);cyl(scene,2.35,spindleY,0,.21,.82,steel);const tip=new THREE.Mesh(new THREE.ConeGeometry(.21,.34,24),steel);tip.rotation.z=Math.PI/2;tip.position.set(1.77,spindleY,0);scene.add(tip);
  const wheel=new THREE.Group();wheel.position.set(3.7,2.2,.57);scene.add(wheel);ring(wheel,0,0,0,.34,.04,iron);for(let i=0;i<4;i++){const a=i*Math.PI/2;box(wheel,0,Math.sin(a)*.17,Math.cos(a)*.17,.09,.08,.34,steel).rotation.x=-a}cyl(wheel,.07,0,0,.1,.2,brass);
  // Moving carriage and tool post; the gold insert reaches the actual surface.
  const carriage=new THREE.Group();scene.add(carriage);box(carriage,0,1.58,.75,1.3,.35,1.05,paintDark);box(carriage,0,1.8,.86,1.05,.16,.86,steel);box(carriage,0,1.93,.8,.7,.18,.62,iron);for(const x of [-.25,.25])bolt(carriage,x,2.04,1.04);
  box(carriage,0,2.25,.8,.5,.65,.48,paintDark);box(carriage,0,2.55,.8,.62,.12,.57,steel);box(carriage,0,2.68,.8,.48,.18,.45,iron);
  const tool=new THREE.Group();carriage.add(tool);box(tool,0,0,.34,.3,.22,.7,iron);box(tool,0,0,-.02,.22,.12,.24,steel);const insert=box(tool,0,.025,-.14,.18,.08,.17,brass);insert.rotation.y=Math.PI/4;
  const chips=new THREE.Group();scene.add(chips);const chipMat=mat('#dfb75f',.85,.25),chipLight=mat('#eee0a5',.8,.23);
  for(let i=0;i<18;i++){const o=i<6?new THREE.Mesh(new THREE.TorusGeometry(.09+i*.009,.012,5,14,Math.PI*1.5),chipMat):new THREE.Mesh(new THREE.BoxGeometry(.08,.025,.035),i%2?chipMat:chipLight);chips.add(o)}
  // A small finished-parts tray beside the headstock, populated from accepted jobs.
  const rack=new THREE.Group();rack.position.set(-4.45,1.56,.72);scene.add(rack);
  box(rack,0,0,0,1.03,.09,.78,iron);box(rack,0,.12,-.37,1.03,.2,.06,paintDark);box(rack,-.49,.12,0,.06,.2,.78,paintDark);box(rack,.49,.12,0,.06,.2,.78,paintDark);
  const finished=[];
  for(let row=0;row<4;row++){const part=new THREE.Group();part.position.set(0,.15+row*.115,-.24+row*.14);rack.add(part);for(let i=0;i<3;i++)cyl(part,-.3+i*.3,0,0,.065,.302,brass);part.visible=false;finished.push(part)}
  function update(game,aspect,reduced){
    const accepted=(game.partLog||[]).filter(part=>part.accepted).slice(-finished.length);finished.forEach((part,i)=>{const entry=accepted[i];part.visible=!!entry;if(entry)part.children.forEach((land,j)=>{const ratio=THREE.MathUtils.clamp((entry.diameters?.[j]??32)/32,.2,1);land.scale.x=.065*ratio;land.scale.z=.065*ratio})});
    const elapsed=game.elapsed||0;const idx=THREE.MathUtils.clamp(game.land||0,0,2);const ds=game.diameters||[32,32,32],targets=game.drawing?.targets||[26,22,18],stock=game.drawing?.stock||32;
    camera.aspect=aspect;camera.fov=aspect<1?48:38;camera.position.set(2.1,4.45,aspect<1?14.8:12.8);camera.lookAt(0,2.15,0);camera.updateProjectionMatrix();
    chuck.rotation.x=reduced?0:elapsed*7;
    for(let i=0;i<3;i++){const ratio=THREE.MathUtils.clamp((ds[i]??stock)/stock,.2,1);lands[i].scale.x=stockRadius*ratio;lands[i].scale.z=stockRadius*ratio;lands[i].rotation.x=reduced?0:elapsed*7;lands[i].userData.grooves.forEach(g=>g.scale.setScalar(ratio));const target=THREE.MathUtils.clamp((targets[i]??stock)/stock,.2,1);references[i].scale.setScalar(stockRadius*target);references[i].visible=i===idx;}
    const x=stockStart+landLength*(idx+.5)+(game.cutting&&!reduced?Math.sin(elapsed*(game.fast?2.1:1.1))*landLength*.32:0),radius=stockRadius*THREE.MathUtils.clamp((ds[idx]??stock)/stock,.2,1);carriage.position.x=x;labels.forEach((label,i)=>{label.material.opacity=i===idx?1:.83});edges.forEach((edge,i)=>{edge.visible=i===idx||i===idx+1;edge.scale.setScalar(THREE.MathUtils.clamp((ds[idx]??stock)/stock,.2,1))});tool.position.set(0,spindleY,radius+.14+(game.cutting?0:.16));
    chips.visible=!!game.cutting&&!reduced;if(chips.visible){chips.position.set(x,spindleY,radius+.06);chips.children.forEach((o,i)=>{const t=(elapsed*(game.fast?2.3:1.5)+i*.137)%1;o.position.set(Math.sin(i*4.1)*t*.5,-t*t*.8, t*.45);o.rotation.set(i+t*5,i*.7,t*4);o.scale.setScalar(.65+(1-t)*.5)})}
  }
  update({diameters:[32,32,32],drawing:{targets:[26,22,18],stock:32},land:0,elapsed:0},1.6,true);
  return {scene,camera,update};
}
