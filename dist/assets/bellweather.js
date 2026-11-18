import * as THREE from '../vendor/three.module.js';

// Bellweather's open terrace is kept clear: everything above floor height sits
// beyond the playable boundary. The bells are a visual ledger of shipments.
export function createBellweather() {
  const root = new THREE.Group();
  root.name = 'bellweather-foundry';
  const material = (color, metalness = 0, roughness = .8, emissive = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive });
  const stone = material(0x8d7666), wood = material(0x513b36), edge = material(0xb59671);
  const dark = material(0x283b47), brass = material(0xb8864b, .7, .3);
  const bronze = material(0xd69c52, .75, .27, 0x38200a);
  const lamp = new THREE.MeshBasicMaterial({color: 0xffce80});
  function add(geometry, mat, x, y, z, parent = root) {
    const m = new THREE.Mesh(geometry, mat); m.position.set(x,y,z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(w,h,d,x,y,z,mat = stone,parent = root) {
    return add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
  }
  function cylinder(rt,rb,h,x,y,z,mat = brass,parent = root,n = 16) {
    return add(new THREE.CylinderGeometry(rt,rb,h,n),mat,x,y,z,parent);
  }
  // Masonry plinth and individually colored paving stones in a single draw call.
  box(18.6,2.5,11.8,0,-1.27,0,stone);
  // Recessed arches and dressed piers on the visible face of the terrace.
  const recess=material(0x3d464c), mortar=material(0x685d59);
  box(18.65,.14,.16,0,-.35,5.91,edge);
  box(18.65,.18,.16,0,-2.37,5.91,mortar);
  for(let i=0;i<9;i++) {
    const x=-8+i*2;
    box(1.35,1.05,.035,x,-1.75,5.93,recess);
    add(new THREE.CircleGeometry(.675,24,0,Math.PI),recess,x,-1.225,5.95);
    box(.24,2.25,.32,x-.88,-1.25,5.98,edge);
    box(.24,.17,.4,x-.88,-.22,6.01,brass);
  }
  const tileGeo = new THREE.BoxGeometry(.96,.035,.96);
  const tileMat = material(0xffffff);
  const tiles = new THREE.InstancedMesh(tileGeo,tileMat,18*11);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  for(let z=0; z<11; z++) for(let x=0; x<18; x++) {
    const i=z*18+x, v=(Math.sin(i*73.13)*.5+.5);
    matrix.makeTranslation(-8.5+x+(z%2?.14:-.14),-.018,-5+z); tiles.setMatrixAt(i,matrix);
    color.setHSL(.055+(i%5)*.016,.12+(i%3)*.035,.24+v*.11); tiles.setColorAt(i,color);
  }
  tiles.receiveShadow=true; root.add(tiles);
  for (const x of [-9.18,9.18]) box(.18,.12,11.5,x,.02,0,edge);
  for (const z of [-5.7,5.7]) box(18.4,.12,.18,0,.02,z,edge);
  // Fine inlaid courses and a makers' seal are flush with the walking surface.
  const inlay = (points, radius=.016) => {
    const path=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.015,z)));
    const track=add(new THREE.TubeGeometry(path,64,radius,5,false),brass,0,0,0);
    track.castShadow=false;
  };
  inlay([[-8.5,1.8],[-6.7,1.8],[-5.4,.9],[-4.1,.8],[-2.8,1.55],[-1,1.55],[.2,2.4],[2,2.4],[3.1,3.35],[7.8,3.35]]);
  inlay([[-8.5,2.05],[-6.6,2.05],[-5.3,1.15],[-4.2,1.05],[-2.9,1.8],[-1.1,1.8],[.1,2.65],[1.9,2.65],[3,3.6],[7.8,3.6]],.009);
  for(const radius of [.75,.84,1.02]) {
    const seal=add(new THREE.RingGeometry(radius,radius+.022,48),brass,.6,.014,.15);
    seal.rotation.x=-Math.PI/2; seal.castShadow=false;
  }
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4, marker=box(.045,.012,.16,.6+Math.sin(a)*.91,.017,.15+Math.cos(a)*.91,brass);
    marker.rotation.y=a; marker.castShadow=false;
  }
  // Brass compass rose lies flush with the floor.
  const rose = add(new THREE.RingGeometry(.65,.69,48),brass,-6.9,.012,3.9);
  rose.rotation.x=-Math.PI/2;
  for(let i=0;i<8;i++) { const ray=box(.035,.012,i%2?.44:.63,-6.9,.014,3.9,brass); ray.rotation.y=i*Math.PI/4; }

  // A low parapet gives the terrace a definite edge without hiding the floor.
  box(18.5,.46,.32,0,.2,-5.84,stone);
  box(18.6,.12,.5,0,.48,-5.84,edge);
  for(let x=-8.6;x<=8.6;x+=2.15) box(.42,.72,.5,x,.36,-5.84,edge);

  // Campanile: four timber posts and two rows of individually swinging bells.
  const tower = new THREE.Group(); tower.position.set(4.4,0,-7.05); root.add(tower);
  box(7.5,.34,1.8,0,.18,0,stone,tower);
  for(const x of [-3.55,3.55]) for(const z of [-.62,.62]) {
    box(.25,5.35,.25,x,2.95,z,wood,tower);
    box(.38,.18,.38,x,5.64,z,brass,tower);
  }
  for(const y of [3.22,4.92,5.55]) box(7.35,.20,.25,0,y,.4,wood,tower);
  box(7.9,.24,1.9,0,5.85,0,wood,tower);
  const copper = material(0x9c5b3e,.55,.4);
  for(const side of [-1,1]) {
    const roof=box(8.1,.16,1.18,0,6.24,side*.47-.22,copper,tower);
    roof.rotation.x=side*.52;
    box(8.15,.08,.10,0,5.89,side*.98-.22,brass,tower);
  }
  box(8.2,.13,.16,0,6.60,0,brass,tower);
  // A gilded clock, braces and suspension fittings keep the empty tower rich.
  const clock=cylinder(.53,.53,.12,0,6.22,.85,dark,tower,32); clock.rotation.x=Math.PI/2;
  add(new THREE.TorusGeometry(.53,.045,8,32),brass,0,6.22,.93,tower);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    const mark=box(.045,.13,.035,Math.sin(a)*.40,6.22+Math.cos(a)*.40,.94,brass,tower); mark.rotation.z=-a;
  }
  const hand=box(.035,.31,.04,0,6.33,.97,brass,tower); hand.rotation.z=-.35;
  for(const x of [-3.05,3.05]) {
    const brace=box(.14,1.25,.14,x,1.10,.58,wood,tower); brace.rotation.z=x<0?-.64:.64;
  }
  // Lathed profile includes the flared lip, shoulder and hollow underside.
  const bellProfile = [[.36,0],[.34,.055],[.30,.12],[.27,.25],[.245,.43],[.20,.54],[.13,.60],[.055,.62],[.055,.56],[.11,.54],[.17,.49],[.21,.40],[.23,.24],[.26,.11],[.29,.04],[.30,0]].map(([x,y])=>new THREE.Vector2(x,y));
  const bellGeo = new THREE.LatheGeometry(bellProfile,32);
  const bells=[]; const lastStrike=Array(8).fill(-100); let now=0;
  for(let i=0;i<8;i++) {
    const col=i%4,row=Math.floor(i/4);
    const pivot=new THREE.Group(); pivot.position.set(-2.62+col*1.73,row?4.87:3.17,.50); tower.add(pivot);
    const body=add(bellGeo,bronze,0,-.68,0,pivot); body.scale.set(1.3,1.12,1.3);
    cylinder(.055,.055,.18,0,-.03,0,brass,pivot,12);
    cylinder(.04,.04,.40,0,-.64,0,wood,pivot,10);
    add(new THREE.SphereGeometry(.085,12,8),brass,0,-.98,0,pivot);
    const band=add(new THREE.TorusGeometry(.275,.018,6,32),brass,0,-.55,0,pivot); band.rotation.x=Math.PI/2;
    const halo=add(new THREE.RingGeometry(.475,.49,48),new THREE.MeshBasicMaterial({
      color:0xffdfa1,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide
    }),pivot.position.x,pivot.position.y-.36,.84,tower);
    halo.castShadow=halo.receiveShadow=false;halo.visible=false;
    pivot.visible=false; bells.push({pivot,halo});
    // Empty fittings make the unfilled places legible before the first delivery.
    cylinder(.09,.09,.08,pivot.position.x,pivot.position.y,.5,brass,tower,12);
    box(.035,.35,.035,pivot.position.x,pivot.position.y-.18,.48,brass,tower);
    const empty=add(new THREE.TorusGeometry(.19,.018,6,16),wood,pivot.position.x,pivot.position.y-.37,.5,tower);
    empty.scale.set(1,.55,1);
  }
  // Architectural lanterns provide warm points of reference at the terrace edge.
  for(const x of [-8.55,-4.7,-.9]) {
    box(.11,1.45,.11,x,.77,-5.75,wood);
    box(.29,.38,.22,x,1.6,-5.73,lamp);
    box(.37,.08,.29,x,1.83,-5.73,wood);
    const pool=add(new THREE.CircleGeometry(.85,32),new THREE.MeshBasicMaterial({color:0xffb45a,transparent:true,opacity:.09,depthWrite:false}),x,.026,-5.1);
    pool.rotation.x=-Math.PI/2; pool.castShadow=false;
  }
  // A low valley wraps the floating terrace. Instanced trees, roofs and windows
  // give the steep overhead view detail without hundreds of draw calls.
  const ground=box(70,.18,65,0,-4.3,-5,material(0x263c46));
  ground.castShadow=false;
  const riverShape=new THREE.Shape();
  riverShape.moveTo(-27,-28); riverShape.bezierCurveTo(-19,-20,-9,-20,-10,-12);
  riverShape.bezierCurveTo(-11,-5,-19,0,-18,9); riverShape.bezierCurveTo(-17,17,-7,22,-2,29);
  riverShape.lineTo(1,29); riverShape.bezierCurveTo(-4,21,-14,16,-15,9);
  riverShape.bezierCurveTo(-16,1,-8,-5,-7,-12); riverShape.bezierCurveTo(-6,-22,-17,-23,-23,-28);
  riverShape.closePath();
  const river=add(new THREE.ShapeGeometry(riverShape),material(0x56818b,.25,.35,0x0a1b22),0,-4.16,0);
  river.rotation.x=-Math.PI/2; river.castShadow=false;
  const treeCount=210, treeGeo=new THREE.ConeGeometry(.42,1.5,7), forest=material(0x263e3d);
  const trees=new THREE.InstancedMesh(treeGeo,forest,treeCount);
  for(let i=0;i<treeCount;i++) {
    let x=-30+(i*17.37)%60, z=-30+(i*11.93)%58;
    if(Math.abs(x)<10.5 && Math.abs(z)<7) x += x<0?-12:12;
    const scale=.55+(i%5)*.12;
    matrix.makeScale(scale,scale,scale); matrix.setPosition(x,-3.5,z); trees.setMatrixAt(i,matrix);
  }
  trees.castShadow=false; root.add(trees);
  const houseCount=26, houseMat=material(0xae998d), roofMat=material(0x895e58);
  const houses=new THREE.InstancedMesh(new THREE.BoxGeometry(.75,.55,.65),houseMat,houseCount);
  const gable=new THREE.Shape();
  gable.moveTo(-.45,0);gable.lineTo(0,.46);gable.lineTo(.45,0);gable.closePath();
  const roofGeometry=new THREE.ExtrudeGeometry(gable,{depth:.84,bevelEnabled:false});
  roofGeometry.translate(0,0,-.42);
  const roofs=new THREE.InstancedMesh(roofGeometry,roofMat,houseCount);
  const windowMat=new THREE.MeshBasicMaterial({color:0xffbc60});
  const windows=new THREE.InstancedMesh(new THREE.BoxGeometry(.2,.19,.035),windowMat,houseCount);
  for(let i=0;i<houseCount;i++) {
    const row=Math.floor(i/7),x=-15+(i%7)*1.48+.38*Math.sin(2*i),z=-12.6+row*1.32+.55*Math.cos(i);
    const angle=.4*Math.sin(i*1.9),height=.8+.24*(i%3);
    matrix.makeRotationY(angle);matrix.scale(new THREE.Vector3(1,height,1));
    matrix.setPosition(x,-4.12+.275*height,z);houses.setMatrixAt(i,matrix);
    matrix.setPosition(x,-4.12+.55*height,z);roofs.setMatrixAt(i,matrix);
    roofs.setColorAt(i,new THREE.Color().setHSL(.025+(i%4)*.014,.23,.60+(i%3)*.09));
    matrix.setPosition(x+.34*Math.sin(angle),-4.12+.34*height,z+.34*Math.cos(angle));windows.setMatrixAt(i,matrix);
  }
  houses.castShadow=roofs.castShadow=false; root.add(houses,roofs,windows);
  // A second belfry gives the answering voice a visible home across the water.
  const chapel=new THREE.Group();chapel.position.set(-10.7,-4.15,-7.6);root.add(chapel);
  const lime=material(0xd6bbaa),verdigris=material(0x526f70,.27),port=material(0x403c52);
  box(1.8,.95,1.1,-.9,.48,0,lime,chapel);
  const naveRoof=add(roofGeometry,verdigris,-.9,.95,0,chapel);
  naveRoof.rotation.y=Math.PI/2;naveRoof.scale.set(1.6,1.45,2.5);
  box(.76,1.86,.72,.1,.94,.04,lime,chapel);
  box(.55,.53,.04,.1,1.52,.416,port,chapel);
  box(.065,.58,.05,.1,1.52,.45,lime,chapel);
  box(.94,.12,.89,.1,1.96,.04,edge,chapel);
  const spire=add(new THREE.ConeGeometry(.65,1.24,4),verdigris,.1,2.62,.04,chapel);
  spire.rotation.y=Math.PI/4;
  add(new THREE.SphereGeometry(.085,10,8),brass,.1,3.28,.04,chapel);
  const replyBell=add(bellGeo,bronze,.1,1.28,.445,chapel);replyBell.scale.setScalar(.55);
  // Soft, expanding rings are the village's visible reply to the tower.
  const echoMat=new THREE.MeshBasicMaterial({color:0xffd68a,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const echoes=[];
  for(let i=0;i<3;i++) {
    const ring=add(new THREE.RingGeometry(.93,1,48),echoMat,-10.6,-4.08,-7.6);
    ring.rotation.x=-Math.PI/2; ring.castShadow=false; echoes.push(ring);
  }
  root.userData.answer = intensity => {
    const amount=THREE.MathUtils.clamp(Number(intensity)||0,0,1);
    windowMat.color.setRGB(1,.48+amount*.42,.18+amount*.35);
    echoMat.opacity=amount*.65;
    replyBell.rotation.z=amount*.32;
    echoes.forEach((ring,i)=>ring.scale.setScalar(.55+i*.65+amount*.35));
  };
  const warmLight=new THREE.PointLight(0xffbc73,15,18,2); warmLight.position.set(1,5,-4); root.add(warmLight);
  root.userData.strike = index => { if(index>=0 && index<8) lastStrike[index]=now; };
  root.userData.update = (elapsed, notes, endingProgress=0) => {
    if(elapsed<now)lastStrike.fill(-100);
    now=elapsed;
    bells.forEach(({pivot,halo},i)=>{
      pivot.visible=i<notes.length;
      if(!pivot.visible){halo.visible=false;return;}
      pivot.scale.setScalar(1.17-notes[i]*.068);
      const age=Math.max(0,elapsed-lastStrike[i]);
      halo.visible=age<.75;
      if(halo.visible){halo.scale.setScalar(1+age*1.6);halo.material.opacity=.8*(1-age/.75);}
      const strike=Math.exp(-age*1.4)*Math.sin(age*8)*.22;
      const finale=endingProgress>0 ? Math.sin(elapsed*3.1+i*.32)*.18*Math.min(1,endingProgress*3) : 0;
      pivot.rotation.z=strike+finale;
    });
  };
  return root;
}

// Shared small metalwork for the player's bell, the tuning fork and the hoist.
let fixtureMaterials, handbellGeometry;
function metalwork() {
  return fixtureMaterials ??= Object.fromEntries(Object.entries({
    oak:[0x634238,0], iron:[0x374755,.45], brass:[0xe6b668,.65], bronze:[0xca8643,.58],
  }).map(([name,[color,metalness]])=>[name,new THREE.MeshStandardMaterial({color,metalness,roughness:.38})]));
}

export function createHandbell() {
  handbellGeometry ??= new THREE.LatheGeometry([[.22,0],[.25,.025],[.24,.052],[.17,.09],[.13,.22],[.10,.27],[.035,.29],[.035,.34],[0,.34]].map(([x,y])=>new THREE.Vector2(x,y)),24);
  return new THREE.Mesh(handbellGeometry,metalwork().bronze);
}

export function createBellFixture(id) {
  const fixture=new THREE.Group(),m=metalwork();
  function beam(w,h,d,x,y,z,material) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;fixture.add(mesh);return mesh;
  }
  for(const x of [-.68,.68])for(const z of [-.34,.34])beam(.15,.85,.15,x,.43,z,m.iron);
  beam(1.65,.18,.98,0,.9,0,m.oak);
  if(id==='inspect'){
    // The brass tines make the machine's purpose legible in silhouette.
    for(const x of [-.51,-.22])beam(.075,.67,.075,x,1.49,-.12,m.brass);
    beam(.36,.08,.075,-.365,1.18,-.12,m.brass);
    beam(.07,.20,.075,-.365,1.08,-.12,m.brass);
    beam(.7,.06,.62,.36,1.02,0,m.iron);
    fixture.userData.workPoint=new THREE.Vector3(.36,1.07,0);
  }else{
    for(const x of [-.66,.66])beam(.12,1,.14,x,1.45,-.17,m.oak);
    beam(1.48,.14,.18,0,1.96,-.17,m.brass);
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.22,.045,8,24),m.brass);
    wheel.position.set(.42,1.72,-.08);fixture.add(wheel);
    beam(.028,.69,.028,.21,1.38,-.07,m.brass);
    fixture.userData.workPoint=new THREE.Vector3(0,1,0);
  }
  return fixture;
}
