import * as THREE from '../vendor/three.module.js';

// The course is built in world space: the same centreline drives the rails,
// scenery, gates and camera, so a bend never pulls a target off its track.
export function createBellRailway(){
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#9e829d'); scene.fog=new THREE.FogExp2('#d8a5a4',.0031);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(900,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
    varying vec3 vPos;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){
      vec3 ray=normalize(vPos);
      vec3 col=mix(vec3(.99,.66,.48),vec3(.43,.40,.59),smoothstep(-.03,.34,ray.y));
      col=mix(col,vec3(.16,.26,.40),smoothstep(.29,.8,ray.y));
      vec2 uv=ray.xz/max(.06,ray.y+.12)*vec2(2.,6.);
      float cloud=noise(uv)*.55+noise(uv*2.3)*.30+noise(uv*5.7)*.15;
      col=mix(col,vec3(.97,.74,.68),smoothstep(.50,.72,cloud)*smoothstep(.00,.1,ray.y)*.65);
      float sun=max(0.,dot(ray,normalize(vec3(-.10,.175,-1.))));
      col+=vec3(.25,.13,.05)*pow(sun,90.);
      col=mix(col,vec3(1.,.92,.72),smoothstep(.9989,.99915,sun));
      gl_FragColor=vec4(col,1.);
    }`}));scene.add(sky);
  const camera=new THREE.PerspectiveCamera(48,1,.1,1800);
  scene.add(new THREE.HemisphereLight('#fff0cf','#594d68',2));
  const sun=new THREE.DirectionalLight('#ffd59b',2.4); sun.position.set(-100,170,80); scene.add(sun);
  const mat=(color, extra={})=>new THREE.MeshStandardMaterial({color,roughness:.78,...extra});
  const wood=mat('#80513b'),woodLight=mat('#b5835a'), darkWood=mat('#453a39'), metal=mat('#596671',{metalness:.7,roughness:.35}), bronze=mat('#d08a37',{metalness:.75,roughness:.27}), gold=mat('#ffe28a',{metalness:.65,roughness:.28}), snow=mat('#e9e7df'), rock=mat('#718297'), pine=mat('#345c62'), water=mat('#6c9eae',{metalness:.3,roughness:.35}), green=mat('#7bffad',{emissive:'#18b967',emissiveIntensity:1}), cyan=mat('#63eeff',{emissive:'#00a9dc',emissiveIntensity:.9}), violet=mat('#c49bff',{emissive:'#7547c4',emissiveIntensity:.7}), red=mat('#eb6a50'), cream=mat('#fff0cd'), black=mat('#29313a');
  const boxGeo=new THREE.BoxGeometry(1,1,1), cylGeo=new THREE.CylinderGeometry(1,1,1,12);
  function box(parent,x,y,z,w,h,d,m){const o=new THREE.Mesh(boxGeo,m);o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);return o}
  function cylinder(parent,x,y,z,r,h,m){const o=new THREE.Mesh(cylGeo,m);o.position.set(x,y,z);o.scale.set(r,h,r);parent.add(o);return o}
  function sphere(parent,x,y,z,r,m){const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),m);o.position.set(x,y,z);parent.add(o);return o}
  const centre=s=>Math.sin(s*.0048)*32+Math.sin(s*.011)*8;
  const height=s=>48-s*.021+Math.sin(s*.006)*3;
  function point(s,lane=0,y=0){return new THREE.Vector3(centre(s)+lane*3.5,height(s)+y,-s)}
  function angle(s){return Math.atan2(centre(s+1)-centre(s-1),2)}
  function at(s,lane=0,y=0){const g=new THREE.Group();g.position.copy(point(s,lane,y));g.rotation.y=-angle(s);scene.add(g);return g}
  function beam(parent,a,b,width,depth,m){const p=a.clone().add(b).multiplyScalar(.5),v=b.clone().sub(a);const o=box(parent,p.x,p.y,p.z,width,v.length(),depth,m);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o}
  // Timber deck is segmented along the curves; rails run uninterrupted across it.
  const end=1160, step=5;
  for(let s=-80;s<end;s+=step){
    const g=at(s,0,-.38);box(g,0,0,-step/2,12,.48,step+.15,wood);
    for(let lane=-1;lane<=1;lane++)for(const side of [-.72,.72])box(g,lane*3.5+side,.37,-step/2,.13,.16,step+.25,metal);
    for(let z=0;z<step;z+=1.25)for(let lane=-1;lane<=1;lane++)box(g,lane*3.5,.27,-z,2,.13,.22,darkWood);
    for(const x of [-5.8,5.8]){box(g,x,.1,-step/2,.23,.6,step,woodLight);box(g,x,1.05,-step/2,.13,.13,step,woodLight);box(g,x,.65,-step/2,.1,.1,step,woodLight);box(g,x,.68,0,.12,1.25,.12,woodLight)}
    if(s%20===0){for(const x of [-5,5]){box(g,x,-15,0,.55,30,.55,darkWood);beam(g,new THREE.Vector3(x,-1,0),new THREE.Vector3(-x,-12,0),.3,.3,wood);}}
  }
  // Layered valley floor and a winding ribbon of water beneath the trestle.
  const land=mat('#4c6c6a'),bank=mat('#829389'),river=mat('#5a9ca8',{metalness:.12,roughness:.55}),riverLight=mat('#a6d4d1');
  box(scene,0,-15,-540,900,3,1600,land);
  for(let s=-100;s<1300;s+=20){const x=centre(s)*.65+Math.sin(s*.009)*30;const g=new THREE.Group();g.position.set(x,-12.8,-s);g.rotation.y=-angle(s)*.6;scene.add(g);box(g,0,0,-10,43,.3,21,bank);box(g,0,.18,-10,36,.15,21,river);box(g,-9,.27,-10,.22,.03,15,riverLight);box(g,7,.27,-6,.15,.03,9,riverLight)}
  let seed=491;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  // Each ridge is one irregular connected mesh: snow belongs to its faces,
  // rather than floating above a separate cone.
  const ridgeMaterial=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide});
  function ridge(side,offset,baseHeight){
    // Break up the face into gullies and sunlit spurs. The snow line follows
    // altitude and slope, so a peak reads from the rails and from below.
    const rows=[],vertices=[],colors=[];
    const faces=['#4c555f','#5c606a','#646779','#787789','#9a8b98'];
    for(let i=0;i<=52;i++){
      const along=i*30-170;
      const peak=baseHeight*(.87+.24*Math.sin(i*.71)+.19*Math.sin(i*.32+1)) + rnd()*20;
      const ridgeX=offset+26*Math.sin(i*.49)+15*Math.cos(i*.93);
      rows.push([0,.23,.51,.73,1].map((f,j)=>new THREE.Vector3(
        side*(ridgeX-(1-f)*(48+18*Math.sin(i*.67+j*.6))+rnd()*8),
        -12+f*(peak+12)+(j>0&&j<4?(rnd()-.5)*12:0),-along+(rnd()-.5)*19)));
    }
    function facet(a,b,c,band){
      const altitude=(a.y+b.y+c.y)/3;
      const snow=altitude>baseHeight*(.82+rnd()*.12);
      const tint=new THREE.Color(snow?(rnd()>.5?'#ddd8cc':'#bbb8c2'):faces[Math.min(4,band+(rnd()>.55?1:0))]);
      for(const v of [a,b,c]){vertices.push(v.x,v.y,v.z);colors.push(tint.r,tint.g,tint.b);}
    }
    for(let i=1;i<rows.length;i++)for(let j=1;j<5;j++){
      const a=rows[i-1][j-1],b=rows[i-1][j],c=rows[i][j],d=rows[i][j-1];
      facet(a,b,d,j-1);facet(b,c,d,j-1);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();scene.add(new THREE.Mesh(geo,ridgeMaterial));
  }
  ridge(-1,155,76);ridge(1,175,78);ridge(-1,280,134);ridge(1,295,135);
  const treeGeo=new THREE.ConeGeometry(1,1,7);
  for(let i=0;i<220;i++){const s=rnd()*1300,side=i%2?1:-1,x=centre(s)+side*(36+rnd()*75),y=-13,h=6+rnd()*11;const g=new THREE.Group();g.position.set(x,y,-s);scene.add(g);cylinder(g,0,1,0,.25,3,darkWood);for(let level=0;level<2;level++){const t=new THREE.Mesh(treeGeo,pine);t.scale.set(h*(.34-level*.08),h*.7,h*(.34-level*.08));t.position.y=2+h*(.32+level*.26);g.add(t)}}
  // Trackside depot and watermill punctuate the first bends without obscuring gates.
  function building(s,side,scale=1){const g=at(s,side*5,-.2);box(g,0,0,0,8*scale,.5,11*scale,woodLight);box(g,side*2,2*scale,0,5*scale,4*scale,7*scale,cream);const roof=new THREE.Mesh(new THREE.ConeGeometry(4.8*scale,2.5*scale,4),bronze);roof.rotation.y=Math.PI/4;roof.position.set(side*2,5*scale,0);g.add(roof);for(const z of [-2,2]){box(g,-side*.55,2.3*scale,z*scale,.1,1.2*scale,1.2*scale,gold);box(g,-side*.62,2.3*scale,z*scale,.12,.12,1.3*scale,darkWood)}box(g,side*3.4,5.5*scale,-2*scale,.65*scale,2*scale,.65*scale,red);return g}
  building(92,-1,1);building(340,1,1.2);building(770,-1,1.1);
  const wheel=at(330,7,-16);const wheelRing=new THREE.Mesh(new THREE.TorusGeometry(4,.35,8,16),woodLight);wheel.add(wheelRing);for(let i=0;i<8;i++){const spoke=box(wheel,0,0,0,.2,8,.22,darkWood);spoke.rotation.z=i*Math.PI/4;const a=i*Math.PI/4;box(wheel,Math.sin(a)*4,Math.cos(a)*4,0,1,.35,.8,woodLight)}
  // Arched stone gallery: the open arch leaves all three lanes visible.
  for(const s of [420,438,456]){const g=at(s);for(const x of [-7,7])box(g,x,4,0,2,8,3,rock);const arch=new THREE.Mesh(new THREE.TorusGeometry(7,1,8,20,Math.PI),rock);arch.position.y=8;arch.rotation.z=0;g.add(arch)}
  // The iron suspension span rises out of the timber approach. Its cables
  // follow both the bend and the sag between the two pairs of towers.
  const iron=mat('#703e3a'),cable=mat('#454959');
  for(const end of [690,800]){
    const g=at(end);
    for(const x of [-6.5,6.5]){
      box(g,x,6,0,.7,13,.9,iron);box(g,x,12.4,0,1.1,.6,1.3,cream);
    }
    box(g,0,11.2,0,13.4,.55,.8,iron);
    for(let x=-6;x<6;x+=2)beam(g,new THREE.Vector3(x,11.3,0),new THREE.Vector3(x+2,12.5,0),.2,.2,iron);
    box(g,0,12.6,0,13.4,.3,.6,iron);
  }
  for(const side of [-1,1]){
    const anchor=s=>{const t=(s-690)/110;return point(s,side*1.86,4.3+8.2*Math.pow(2*t-1,2));};
    for(let s=690;s<800;s+=5){
      beam(scene,anchor(s),anchor(s+5),.19,.19,cable);
      beam(scene,point(s,side*1.86,.4),anchor(s),.09,.09,metal);
    }
  }
  // Raised buildings share the bridge foundations and side platforms.
  function platform(g,side,length){
    box(g,0,-.38,0,8,.45,length,wood);
    for(const z of [-length*.4,length*.4])for(const x of [-3,3]){
      box(g,x,-30,z,.7,60,.7,darkWood);
      beam(g,new THREE.Vector3(x,-10,z),new THREE.Vector3(-x,-1,z),.32,.32,woodLight);
    }
    box(g,-side*5,-.35,0,5,.34,2.4,woodLight);
  }
  for(const [s,side] of [[92,-1],[340,1],[770,-1]])platform(at(s,side*5),side,11);
  // The terminus has a clock tower visible from the final sprint.
  const tower=at(1056,4.4);platform(tower,1,8);
  box(tower,0,5.6,0,3.5,11.2,3.5,cream);box(tower,0,9,0,4,.28,4,wood);
  for(const x of [-1.3,1.3])box(tower,x,7.5,1.8,.25,6,.18,darkWood);
  const face=new THREE.Mesh(new THREE.CircleGeometry(1.15,24),darkWood);
  face.position.set(0,9.7,1.78);tower.add(face);box(tower,0,10,1.81,.14,.65,.07,cream);box(tower,.33,9.7,1.81,.68,.12,.07,cream);
  const spire=new THREE.Mesh(new THREE.ConeGeometry(3.1,5,4),bronze);spire.rotation.y=Math.PI/4;spire.position.y=13.6;tower.add(spire);
  // Merge the immutable landscape and viaduct into material/geometry instances.
  // Per-instance matrices preserve the bends while reducing thousands of draw calls.
  scene.updateMatrixWorld(true);
  const buckets=new Map(), staticRoots=scene.children.filter(o=>o!==sky && o!==wheel && !(o instanceof THREE.Light));
  for(const root of staticRoots)root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+o.material.uuid+':'+Math.floor(o.matrixWorld.elements[14]/180);let b=buckets.get(key);if(!b){b={geometry:o.geometry,material:o.material,matrices:[]};buckets.set(key,b)}b.matrices.push(o.matrixWorld.clone())});
  for(const root of staticRoots)scene.remove(root);
  for(const b of buckets.values()){const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh)}
  // The trolley rides on the selected track. Its bell swings independently.
  const trolley=new THREE.Group();scene.add(trolley);
  box(trolley,0,.65,0,2.55,.45,3.6,red);box(trolley,0,.95,0,2.3,.18,3.25,woodLight);
  for(const x of [-1.25,1.25])for(const z of [-1.15,1.15]){const w=cylinder(trolley,x,.43,z,.47,.24,metal);w.rotation.z=Math.PI/2;sphere(trolley,x*1.1,.43,z,.13,gold)}
  for(const x of [-.9,.9]){box(trolley,x,1.75,.15,.18,1.7,.18,darkWood);box(trolley,x,1.15,-1.35,.12,.8,.12,gold)}
  box(trolley,0,2.6,.15,2,.2,.22,woodLight);
  const swing=new THREE.Group();swing.position.set(0,2.55,.15);trolley.add(swing);cylinder(swing,0,-.13,0,.11,.3,metal);
  const bell=new THREE.Mesh(new THREE.CylinderGeometry(.31,.84,1.1,24,1,false),bronze);bell.position.y=-.75;swing.add(bell);const rim=new THREE.Mesh(new THREE.TorusGeometry(.84,.09,8,24),gold);rim.rotation.x=Math.PI/2;rim.position.y=-1.29;swing.add(rim);sphere(swing,0,-1.36,0,.16,darkWood);
  for(const y of [-.55,-.95]){const band=new THREE.Mesh(new THREE.TorusGeometry(y===-.55?.49:.7,.035,6,24),gold);band.rotation.x=Math.PI/2;band.position.y=y;swing.add(band)}
  for(const x of [-1.06,1.06])box(trolley,x,1.1,1.55,.1,.5,.1,gold);box(trolley,0,.8,1.83,1.1,.2,.06,gold);
  const flag=box(trolley,0,1.6,1.5,1.7,.65,.04,cream);box(trolley,0,1.6,1.47,1.45,.1,.04,red);
  function sign(parent,text,x,y,z,w,h,dark='#244145'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=dark;ctx.fillRect(0,0,512,96);ctx.strokeStyle='#ebd893';ctx.lineWidth=4;ctx.strokeRect(5,5,502,86);
    ctx.fillStyle='#fff0cd';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 49px Georgia';ctx.fillText(text,256,48,482);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map}));
    panel.position.set(x,y,z);parent.add(panel);
  }
  sign(trolley,'BELL  MAIL',0,1.6,1.54,1.72,.62);
  const gates=new Map();
  function makeGate(data){
    const g=at(data.s,data.lane);const kind=data.kind;
    if(kind==='delivery'){
      // Copper-roofed station and a suspended, front-facing target hoop.
      for(const x of [-1.55,1.55])box(g,x,2.1,0,.22,4.2,.25,woodLight);
      box(g,0,4.3,0,3.4,.25,.5,bronze);box(g,0,3.7,.1,2.6,.72,.12,red);
      sign(g,data.name.toUpperCase(),0,3.81,.19,3.28,.84);
      const hoop=new THREE.Mesh(new THREE.TorusGeometry(.88,.14,10,28),mat('#ffbf37',{emissive:'#d6710e',emissiveIntensity:.6}));hoop.position.set(0,2.45,.2);g.add(hoop);
      for(const x of [-.6,.6])beam(g,new THREE.Vector3(x,4.1,0),new THREE.Vector3(x,2.9,.2),.055,.055,gold);
      const basket=new THREE.Mesh(new THREE.CylinderGeometry(.74,.48,.65,14,1,true),woodLight);basket.position.set(0,1.7,.15);g.add(basket);
      for(const x of [-1.42,1.42]){box(g,x,3.05,.1,.22,1.5,.06,cream);box(g,x,2.65,.12,.22,.3,.06,red)}
      for(let d=9;d<=30;d+=3){const r=at(data.s-d,data.lane,.08);box(r,0,.05,0,2.2,.08,2.4,green);if(d>=15&&d<=21)box(r,0,.11,0,.34,.04,2.4,gold);g.userData.zone??=[];g.userData.zone.push(r)}
      // A small settlement beyond the target gives each delivery a destination.
      const v=at(data.s, data.lane>0?3.5:-3.5,-.2);box(v,0,2,0,4,4,4,cream);const roof=new THREE.Mesh(new THREE.ConeGeometry(3.2,2.3,4),bronze);roof.position.y=5;roof.rotation.y=Math.PI/4;v.add(roof);box(v,0,2,2.05,1,1.4,.08,darkWood);platform(v,data.lane>0?1:-1,7);for(const x of [-1.25,1.25]){
        box(v,x,2.5,2.04,.66,.91,.12,gold);box(v,x,2.5,2.12,.09,1,.09,wood);
      }g.userData.village=v;
    }else if(kind==='work'){
      for(const x of [-.85,.85]){const leg=box(g,x,.6,0,.18,1.2,.2,woodLight);leg.rotation.z=x*.2}box(g,0,1.12,0,2.6,.55,.25,cream);for(const x of [-.8,0,.8]){const stripe=box(g,x,1.13,.14,.35,.57,.02,red);stripe.rotation.z=-.55}
    }else if(kind==='boost'){
      box(g,0,.12,0,2.6,.15,5,cyan);for(const z of [-1.5,0,1.5]){for(const side of [-1,1]){const a=box(g,side*.35,.22,z,.18,.08,1,cream);a.rotation.y=side*.65}}
    }else{
      for(const x of [-1.3,1.3])box(g,x,1.7,0,.15,3.4,.2,violet);box(g,0,3.35,0,2.8,.3,.4,violet);box(g,0,2.35,.1,2.3,.9,.15,violet);box(g,0,.12,0,2.5,.12,4,violet);sign(g,'COVARI',0,2.45,.21,2.8,.76,'#583c70');
    }
    g.userData.kind=kind;return g;
  }
  const finish=at(1100);for(const x of [-6,6])box(finish,x,4,0,.4,8,.4,woodLight);for(let i=0;i<12;i++)for(let j=0;j<2;j++)box(finish,-5.5+i,7.4+j*.6,0,1,.6,.2,(i+j)%2?cream:black);
  const ghost=new THREE.Group();scene.add(ghost);const ghostMat=new THREE.MeshBasicMaterial({color:'#7af7ff',transparent:true,opacity:.28,depthWrite:false});box(ghost,0,.8,0,2.4,.5,3.3,ghostMat);box(ghost,0,1.5,0,1.3,1.1,1.4,ghostMat);
  const shotMeshes=Array.from({length:3},()=>{
    const shot=swing.clone();shot.scale.setScalar(.84);shot.visible=false;scene.add(shot);return shot;
  });
  const sparks=new THREE.Group();scene.add(sparks);
  const glint=new THREE.MeshBasicMaterial({color:'#ffe497'});
  for(let i=0;i<20;i++)box(sparks,0,0,0,.09,.24,.12,glint);
  let landed=-1;
  let lastHit=null;
  const cameraPos=new THREE.Vector3(),look=new THREE.Vector3();let lastDistance=null, lastPhase=null;
  function update(state,aspect,reduced){

    ghost.visible=!!state.ghost&&Math.abs(state.ghost.distance-state.distance)>5&&state.ghost.distance>state.distance-20&&state.ghost.distance<state.distance+180;if(ghost.visible){ghost.position.copy(point(state.ghost.distance,state.ghost.lane,.18));ghost.rotation.y=-angle(state.ghost.distance)}
    camera.aspect=aspect;camera.fov=(aspect<1.3?60:50)+(reduced?0:Math.max(0,state.speed-24)*.27);camera.updateProjectionMatrix();
    for(const data of state.gates||[]){const key=data.s+':'+data.lane+':'+data.kind;let g=gates.get(key);if(!g){g=makeGate(data);gates.set(key,g)}g.visible=data.state!=='locked'&&data.s>state.distance-45&&data.s<state.distance+270;if(g.userData.zone)for(const z of g.userData.zone)z.visible=data.state==='ahead'&&data.s>state.distance-5&&data.s<state.distance+150; if(g.userData.village)g.userData.village.visible=g.visible;g.scale.setScalar(data.state==='hit'?.85:1)}
    trolley.position.copy(point(state.distance,state.lane,.05));trolley.rotation.y=-angle(state.distance);swing.rotation.z=reduced?0:Math.sin(state.elapsed*3.2)*(.1+state.speed*.003);swing.rotation.x=reduced?0:Math.sin(state.elapsed*2.1)*.1;
    flag.rotation.y=reduced?0:Math.sin(state.elapsed*9)*.12;
    const cam=point(state.distance-12,state.lane*.65,6.4);const target=point(state.distance+27,state.lane*.3,1.5);const snap=reduced||lastDistance===null||state.distance<lastDistance-3||state.phase!==lastPhase&&state.phase!=='run'||state.phase==='finish';cameraPos.lerp(cam,snap?1:.35);look.lerp(target,snap?1:.4);lastDistance=state.distance;lastPhase=state.phase;if(!cameraPos.length())cameraPos.copy(cam);camera.position.copy(cameraPos);camera.lookAt(look);camera.rotateZ(reduced?0:((state.targetLane??state.lane)-state.lane)*-.028);sky.position.copy(camera.position);
    for(let i=0;i<shotMeshes.length;i++){const shot=(state.shots||[])[i],m=shotMeshes[i];m.visible=!!shot;if(shot){const t=Math.min(1,shot.age/shot.duration);m.position.copy(point(THREE.MathUtils.lerp(shot.fromS,shot.toS,t),THREE.MathUtils.lerp(shot.fromLane,shot.toLane,t),2.5+Math.sin(t*Math.PI)*4))}}
    swing.visible=!state.shots?.length;
    trolley.rotation.z=reduced?0:((state.targetLane??state.lane)-state.lane)*-.13;
    const hit=state.deliveries?.filter(g=>g.state==='hit').at(-1);
    if(state.distance<115){landed=-1;lastHit=null;}
    if(hit&&landed!==hit.index){landed=hit.index;lastHit={at:state.elapsed,s:hit.s,lane:hit.lane};}
    const age=lastHit?state.elapsed-lastHit.at:2;
    sparks.visible=age<.7&&!reduced;
    if(sparks.visible){
      sparks.position.copy(point(lastHit.s,lastHit.lane,2.6));
      sparks.children.forEach((spark,i)=>{
        const a=i*2.4,r=age*(2.5+(i%4));spark.position.set(Math.cos(a)*r,age*(6+i%4)-6*age*age,Math.sin(a)*r+age*2);
        spark.rotation.z=a+age*2;spark.scale.set(.11,.24*(1-age),.1);
      });
    }
    wheel.rotation.z=reduced?0:state.elapsed*.8;
  }
  update({distance:0,lane:0,speed:20,elapsed:0,gates:[],shots:[],impacts:0},1.6,true);
  return {scene,camera,update};
}
