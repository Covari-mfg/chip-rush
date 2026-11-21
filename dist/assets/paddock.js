import * as THREE from '../vendor/three.module.js';

// Redline · Paddock Works: sunlit Mediterranean Grand Prix machine shop beside a
// curbed pit lane, 5-red-light starting gantry, and a sculpted 3D Formula race car
// that visibly assembles piece-by-piece as parts ship and rockets out at Lights Out.

const C = {
  ink: 0x19313d,
  slate: 0x263844,
  asphalt: 0x24313b,
  apron: 0x31404b,
  tileA: 0xdce4e7,
  tileB: 0xcfd9de,
  cream: 0xf2ead6,
  teal: 0x288484,
  mint: 0x5de2cb,
  coral: 0xd85546,
  gold: 0xf4bd58,
  carbon: 0x1d262d,
  rubber: 0x181f24,
  turf: 0x3d7c66,
  cypress: 0x275d4c,
  cypressHi: 0x33725c,
};

const mats = new Map();
function mat(color, roughness = 0.65, metalness = 0.08) {
  const key = `${color}/${roughness}/${metalness}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return mats.get(key);
}
function glow(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
}
function addMesh(parent, geo, color, x, y, z, material) {
  const m = new THREE.Mesh(geo, material || mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(parent, w, h, d, x, y, z, color, material) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z, material);
}
function cyl(parent, rt, rb, h, x, y, z, color, seg = 18, material) {
  return addMesh(parent, new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, material);
}
function sign(parent, text, w, h, x, y, z, color = '#f2ead6', bg = '#1b3a47') {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 192);
  ctx.strokeStyle = '#5de2cb'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 1004, 172);
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 76px system-ui, -apple-system, sans-serif';
  ctx.fillText(text, 512, 100, 960);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return addMesh(parent, new THREE.PlaneGeometry(w, h), C.cream, x, y, z, new THREE.MeshBasicMaterial({ map: tex }));
}

function buildCypress(parent, x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  cyl(g, 0.12, 0.16, 0.7, 0, 0.35, 0, 0x6f533c, 8);
  const c1 = addMesh(g, new THREE.ConeGeometry(0.62, 1.9, 9), C.cypress, 0, 1.5, 0);
  const c2 = addMesh(g, new THREE.ConeGeometry(0.48, 1.7, 9), C.cypressHi, 0, 2.55, 0);
  const c3 = addMesh(g, new THREE.ConeGeometry(0.28, 1.15, 9), C.cypress, 0, 3.45, 0);
  c1.rotation.y = 0.4; c2.rotation.y = 1.1; c3.rotation.y = 0.2;
  parent.add(g);
}

// Sculpted miniature Formula race car oriented along -Z (nose toward Start Gantry).
// Exposes 10 discrete upgrade sub-assemblies plus a Covari special aero fin.
function buildFormulaCar() {
  const root = new THREE.Group();
  root.name = 'paddock-formula-car';

  // Air-jacks lifting chassis until Lights Out
  const jacks = new THREE.Group();
  for (const [jx, jz] of [[-0.52, -1.2], [0.52, -1.2], [-0.55, 1.1], [0.55, 1.1]]) {
    cyl(jacks, 0.06, 0.075, 0.28, jx, 0.14, jz, C.gold, 10, mat(C.gold, 0.32, 0.72));
  }
  root.add(jacks);

  const car = new THREE.Group();
  car.position.y = 0.18; // raised on jacks while building
  root.add(car);

  // Base carbon survival tub + tapered monocoque nose (always visible from second 0)
  const noseShape = new THREE.Shape();
  noseShape.moveTo(0, -2.18);
  noseShape.quadraticCurveTo(0.24, -1.75, 0.36, -0.75);
  noseShape.lineTo(0.4, 0.85);
  noseShape.quadraticCurveTo(0.32, 1.55, 0.16, 1.85);
  noseShape.lineTo(-0.16, 1.85);
  noseShape.quadraticCurveTo(-0.32, 1.55, -0.4, 0.85);
  noseShape.lineTo(-0.36, -0.75);
  noseShape.quadraticCurveTo(-0.24, -1.75, 0, -2.18);
  const tubGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 0.34, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 10 });
  tubGeo.rotateX(Math.PI / 2);
  addMesh(car, tubGeo, C.carbon, 0, 0.56, 0, mat(C.carbon, 0.42, 0.35));

  // Sleek painted nose stripe & cream racing livery cowl
  box(car, 0.34, 0.12, 1.45, 0, 0.62, -0.95, C.teal, mat(C.teal, 0.3, 0.22));
  box(car, 0.14, 0.04, 1.62, 0, 0.68, -0.88, C.coral, mat(C.coral, 0.35, 0.15));
  // Recessed cockpit + seat + steering wheel + helmet silhouette
  box(car, 0.46, 0.18, 0.78, 0, 0.54, -0.05, 0x0f161b);
  addMesh(car, new THREE.SphereGeometry(0.17, 14, 12), C.cream, 0, 0.72, 0.08, mat(C.cream, 0.22, 0.15));
  box(car, 0.22, 0.08, 0.12, 0, 0.73, -0.05, C.ink, mat(C.ink, 0.15, 0.4));
  // Bare floor plank
  box(car, 1.18, 0.06, 2.75, 0, 0.2, 0.15, C.carbon, mat(C.carbon, 0.65, 0.15));

  const slots = {};
  const makeSlot = key => {
    const g = new THREE.Group();
    g.visible = false;
    car.add(g);
    slots[key] = g;
    return g;
  };

  // 1) brakes: 4 gleaming aluminum discs + coral racing calipers
  const brakes = makeSlot('brakes');
  for (const [bx, bz] of [[-0.68, -1.28], [0.68, -1.28], [-0.74, 1.25], [0.74, 1.25]]) {
    const disc = cyl(brakes, 0.21, 0.21, 0.06, bx, 0.36, bz, 0xcbd8de, 16, mat(0xcbd8de, 0.25, 0.8));
    disc.rotation.z = Math.PI / 2;
    box(brakes, 0.1, 0.14, 0.14, bx + (bx < 0 ? 0.04 : -0.04), 0.42, bz - 0.12, C.coral, mat(C.coral, 0.3, 0.3));
  }

  // 2) frontSusp: sculpted titanium front wishbones & steering knuckles
  const frontSusp = makeSlot('frontSusp');
  for (const side of [-1, 1]) {
    box(frontSusp, 0.56, 0.05, 0.07, side * 0.45, 0.44, -1.2, 0x8ea3ad, mat(0x8ea3ad, 0.3, 0.75));
    box(frontSusp, 0.56, 0.05, 0.07, side * 0.45, 0.3, -1.34, 0x8ea3ad, mat(0x8ea3ad, 0.3, 0.75));
    const rod = box(frontSusp, 0.58, 0.04, 0.04, side * 0.44, 0.44, -1.28, C.mint, mat(C.mint, 0.3, 0.55));
    rod.rotation.z = side * 0.32;
  }

  // 3) gearbox: machined titanium rear transmission & engine cover spine
  const gearbox = makeSlot('gearbox');
  box(gearbox, 0.54, 0.38, 1.05, 0, 0.56, 1.15, C.gold, mat(C.gold, 0.28, 0.72));
  box(gearbox, 0.38, 0.26, 0.92, 0, 0.76, 0.85, C.cream, mat(C.cream, 0.32, 0.18));

  // 4) rearSusp: rear wishbones & drive shafts
  const rearSusp = makeSlot('rearSusp');
  for (const side of [-1, 1]) {
    box(rearSusp, 0.58, 0.06, 0.08, side * 0.48, 0.4, 1.24, C.gold, mat(C.gold, 0.3, 0.72));
    box(rearSusp, 0.56, 0.05, 0.07, side * 0.48, 0.28, 1.1, 0x8ea3ad, mat(0x8ea3ad, 0.3, 0.72));
  }

  // 5) frontWing: sculpted multi-plane front aero wing + coral endplates
  const frontWing = makeSlot('frontWing');
  box(frontWing, 1.88, 0.06, 0.46, 0, 0.19, -2.14, C.cream, mat(C.cream, 0.3, 0.2));
  box(frontWing, 1.84, 0.05, 0.24, 0, 0.27, -2.02, C.teal, mat(C.teal, 0.28, 0.22));
  for (const side of [-1, 1]) {
    box(frontWing, 0.07, 0.3, 0.56, side * 0.94, 0.28, -2.12, C.coral, mat(C.coral, 0.32, 0.2));
  }

  // 6) wheels: all 4 wide slick racing tires + alloy centerlock rims + mint/gold sidewall rings!
  const wheels = makeSlot('wheels');
  const tirePositions = [
    [-0.86, -1.28, 0.36, 0.34, C.mint],
    [ 0.86, -1.28, 0.36, 0.34, C.mint],
    [-0.92,  1.25, 0.4,  0.42, C.gold],
    [ 0.92,  1.25, 0.4,  0.42, C.gold],
  ];
  for (const [wx, wz, r, width, stripe] of tirePositions) {
    const wg = new THREE.Group();
    wg.position.set(wx, r, wz);
    const tire = cyl(wg, r, r, width, 0, 0, 0, C.rubber, 22, mat(C.rubber, 0.78, 0.05));
    tire.rotation.z = Math.PI / 2;
    const rim = cyl(wg, r * 0.58, r * 0.58, width + 0.03, 0, 0, 0, 0xcad6dc, 14, mat(0xcad6dc, 0.28, 0.78));
    rim.rotation.z = Math.PI / 2;
    const lock = cyl(wg, 0.07, 0.07, width + 0.08, 0, 0, 0, C.coral, 10, mat(C.coral, 0.3, 0.5));
    lock.rotation.z = Math.PI / 2;
    const ring = addMesh(wg, new THREE.TorusGeometry(r * 0.76, 0.025, 8, 24), stripe, (wx < 0 ? -1 : 1) * (width / 2 + 0.006), 0, 0, glow(stripe));
    ring.rotation.y = Math.PI / 2;
    wheels.add(wg);
  }

  // 7) sidepods: sculpted teal-and-cream aero sidepods & rear floor diffuser strakes
  const sidepods = makeSlot('sidepods');
  for (const side of [-1, 1]) {
    box(sidepods, 0.46, 0.36, 1.56, side * 0.56, 0.42, 0.18, C.teal, mat(C.teal, 0.28, 0.22));
    box(sidepods, 0.42, 0.08, 1.48, side * 0.56, 0.62, 0.2, C.cream, mat(C.cream, 0.3, 0.15));
    box(sidepods, 0.32, 0.22, 0.08, side * 0.56, 0.43, -0.58, 0x0f161b);
  }
  for (let i = -2; i <= 2; i++) {
    box(sidepods, 0.04, 0.16, 0.42, i * 0.22, 0.24, 1.62, C.carbon, mat(C.carbon, 0.5, 0.2));
  }

  // 8) exhaust: glowing titanium exhaust header & central turbo tailpipe
  const exhaust = makeSlot('exhaust');
  const pipe = cyl(exhaust, 0.095, 0.11, 0.42, 0, 0.44, 1.88, C.gold, 14, mat(C.gold, 0.22, 0.85));
  pipe.rotation.x = Math.PI / 2;
  const exhaustGlowMat = glow(0xff9b4a, 0.9);
  const exhaustFlame = addMesh(exhaust, new THREE.ConeGeometry(0.11, 0.44, 12), 0xff9b4a, 0, 0.44, 2.26, exhaustGlowMat);
  exhaustFlame.rotation.x = Math.PI / 2;
  exhaustFlame.visible = false;

  // 9) rearWing: elevated twin-plane DRS rear wing on curved swan-neck pylons
  const rearWing = makeSlot('rearWing');
  for (const side of [-0.22, 0.22]) {
    box(rearWing, 0.05, 0.62, 0.16, side, 0.82, 1.72, C.carbon, mat(C.carbon, 0.4, 0.3));
  }
  box(rearWing, 1.56, 0.07, 0.4, 0, 1.08, 1.8, C.teal, mat(C.teal, 0.26, 0.24));
  box(rearWing, 1.52, 0.05, 0.22, 0, 1.24, 1.88, C.cream, mat(C.cream, 0.28, 0.2));
  for (const side of [-1, 1]) {
    box(rearWing, 0.07, 0.56, 0.54, side * 0.79, 1.02, 1.82, C.coral, mat(C.coral, 0.3, 0.2));
  }

  // 10) halo: sculpted titanium Halo cockpit bar + overhead T-cam intake scoop
  const halo = makeSlot('halo');
  const hoop = addMesh(halo, new THREE.TorusGeometry(0.32, 0.042, 10, 20, Math.PI * 1.15), 0xdbe6eb, 0, 0.86, -0.02, mat(0xdbe6eb, 0.22, 0.85));
  hoop.rotation.x = Math.PI / 2;
  hoop.rotation.z = -Math.PI * 0.075;
  box(halo, 0.055, 0.24, 0.06, 0, 0.74, -0.34, 0xdbe6eb, mat(0xdbe6eb, 0.22, 0.85));
  box(halo, 0.26, 0.28, 0.46, 0, 0.94, 0.38, C.coral, mat(C.coral, 0.3, 0.2));
  box(halo, 0.44, 0.04, 0.08, 0, 1.12, 0.34, C.gold, mat(C.gold, 0.25, 0.75));

  // Optional Covari Special Aero Fin (mounted when Covari capability-gap job ships!)
  const covariFin = new THREE.Group();
  covariFin.visible = false;
  box(covariFin, 0.05, 0.34, 1.12, 0, 0.96, 1.02, C.mint, mat(C.mint, 0.25, 0.45));
  box(covariFin, 0.07, 0.08, 1.14, 0, 1.12, 1.02, C.gold, mat(C.gold, 0.25, 0.75));
  car.add(covariFin);

  return { root, car, jacks, slots, covariFin, exhaustFlame, exhaustGlowMat };
}

export function createPaddock() {
  const g = new THREE.Group();
  g.name = 'redline-paddock';

  // 1) Sunlit Mediterranean turf & asphalt paddock base extending beyond viewport
  const turf = addMesh(g, new THREE.PlaneGeometry(110, 95), C.turf, 6, -0.52, -4, mat(C.turf, 0.92, 0));
  turf.rotation.x = -Math.PI / 2; turf.castShadow = false;

  // Main Pit Lane & Grand Prix Circuit Straight (right of open garage shutter)
  box(g, 6.2, 0.12, 54, 11.4, -0.08, -8, C.asphalt, mat(C.asphalt, 0.82, 0.05));
  box(g, 3.6, 0.13, 28, 10.1, -0.07, -1.5, C.apron, mat(C.apron, 0.78, 0.05));
  // Subtle dark rubber racing line on straight
  box(g, 1.3, 0.01, 52, 13.1, -0.015, -8, 0x1b242c, mat(0x1b242c, 0.9, 0));
  // White pit-exit dividing line + yellow Pit Box outline around the Formula car!
  box(g, 0.11, 0.015, 48, 12.15, -0.01, -6, C.cream);
  for (const [bx, bz, bw, bd] of [
    [10.6, -2.75, 2.6, 0.1], [10.6, 2.25, 2.6, 0.1],
    [9.3, -0.25, 0.1, 5.1], [11.9, -0.25, 0.1, 5.1],
  ]) {
    box(g, bw, 0.015, bd, bx, 0.0, bz, C.gold);
  }

  // Alternating coral-red & cream FIA rumble kerbs along the circuit outer edge (clearly visible on desktop!)
  for (let i = 0; i < 28; i++) {
    box(g, 0.62, 0.08, 1.45, 14.55, -0.01, -24 + i * 1.5, i % 2 ? C.cream : C.coral);
  }
  // Checkered start/finish line across pit exit under gantry
  for (let r = 0; r < 2; r++) {
    for (let col = 0; col < 8; col++) {
      box(g, 0.68, 0.014, 0.44, 9.15 + col * 0.68, -0.005, -5.6 + r * 0.44, (r + col) % 2 ? C.cream : C.carbon);
    }
  }

  // 2) Polished Paddock Machine Shop Garage Floor (bright crisp stone tiles)
  box(g, 18.2, 0.36, 11.4, -0.65, -0.2, -0.8, C.ink);
  for (let ix = 0; ix < 12; ix++) {
    for (let iz = 0; iz < 8; iz++) {
      const tile = box(g, 1.46, 0.04, 1.38, -8.85 + ix * 1.49, -0.01, -5.65 + iz * 1.41, (ix + iz) % 2 ? C.tileA : C.tileB, mat((ix + iz) % 2 ? C.tileA : C.tileB, 0.58, 0.06));
      tile.castShadow = false;
    }
  }
  // Clean racing-teal & coral safety bay lane markings inside the garage
  box(g, 15.8, 0.015, 0.1, -0.7, 0.02, -1.65, C.teal);
  box(g, 0.1, 0.015, 9.6, 3.85, 0.02, -0.8, C.teal);
  for (let i = 0; i < 7; i++) {
    box(g, 0.24, 0.016, 0.55, 8.15, 0.02, -2.6 + i * 0.9, i % 2 ? C.gold : C.ink);
  }

  // Open-front corrugated motorsport paddock back wall (clean cream + slate-teal)
  box(g, 18.4, 0.34, 0.26, -0.65, 2.95, -6.45, C.cream);
  box(g, 18.4, 0.24, 0.22, -0.65, 0.72, -6.45, C.teal);
  for (let i = 0; i < 58; i++) {
    box(g, 0.26, 2.35, 0.14, -9.55 + i * 0.312, 1.62, -6.54, i % 2 ? 0x2c4a58 : 0x365766);
  }
  // Left garage partition wall + clean structural columns (right side stays wide open to Pit Bay!)
  box(g, 0.22, 2.4, 11.4, -9.65, 1.2, -0.8, 0x304d5c);
  box(g, 0.28, 0.22, 11.5, -9.65, 2.45, -0.8, C.cream);
  for (const x of [-9.6, -0.7, 8.35]) {
    box(g, 0.2, 3.25, 0.22, x, 1.62, -6.32, C.ink);
  }
  box(g, 0.2, 3.25, 0.22, -9.6, 1.62, 4.78, C.teal);
  box(g, 18.2, 0.14, 0.16, -0.65, 3.22, -6.32, C.coral);

  // Back-wall motorsport signage tilted slightly toward camera + 10 live car-assembly LEDs!
  const s1 = sign(g, 'PADDOCK WORKS · GARAGE 09', 5.6, 0.74, -3.5, 2.38, -6.24);
  if (s1) s1.rotation.x = -0.45;
  const s2 = sign(g, 'CHASSIS SPEC · 6 TO GRID', 5.0, 0.64, 4.1, 2.42, -6.24, '#f4bd58');
  if (s2) s2.rotation.x = -0.45;
  const progressLamps = [];
  for (let i = 0; i < 10; i++) {
    const lamp = addMesh(g, new THREE.SphereGeometry(0.125, 12, 8), 0x28434e, 1.95 + i * 0.47, 1.72, -6.22, glow(0x28434e));
    progressLamps.push(lamp);
  }

  // Paddock garage props outside walking aisles (spare tire stacks, red tool chest, nitrogen bottles)
  for (let t = 0; t < 3; t++) {
    cyl(g, 0.36, 0.36, 0.26, -8.55, 0.15 + t * 0.27, -5.35, C.rubber, 16);
    cyl(g, 0.2, 0.2, 0.28, -8.55, 0.15 + t * 0.27, -5.35, 0x9fb2bc, 12);
  }
  box(g, 1.35, 0.92, 0.56, -7.2, 0.46, -5.65, C.coral, mat(C.coral, 0.4, 0.25));
  box(g, 1.38, 0.08, 0.6, -7.2, 0.96, -5.65, C.ink);
  for (let b = 0; b < 3; b++) {
    cyl(g, 0.13, 0.13, 1.12, 7.1 + b * 0.34, 0.56, -5.65, b === 1 ? C.gold : C.teal, 12);
  }

  // 3) Overhead 5-Red-Light FIA Starting Gantry spanning the Pit Exit
  const gantry = new THREE.Group();
  gantry.position.set(11.3, 0, -5.6);
  for (const gx of [-2.4, 3.6]) {
    box(gantry, 0.24, 3.9, 0.24, gx, 1.95, 0, C.ink);
    box(gantry, 0.4, 0.24, 0.4, gx, 0.12, 0, C.coral);
  }
  box(gantry, 6.4, 0.36, 0.32, 0.6, 3.72, 0, C.cream);
  box(gantry, 6.4, 0.12, 0.36, 0.6, 3.94, 0, C.teal);
  // Start light housing + 5 glowing start lamps
  box(gantry, 3.1, 0.52, 0.42, -0.5, 3.42, 0.22, C.carbon);
  const startLights = [];
  for (let i = 0; i < 5; i++) {
    const lamp = addMesh(gantry, new THREE.SphereGeometry(0.15, 12, 10), 0x302428, -1.6 + i * 0.55, 3.42, 0.44, glow(0x302428));
    startLights.push(lamp);
  }
  g.add(gantry);

  // Mediterranean Cypress trees right beside outer track kerb (visible in desktop & mobile!)
  for (const [tx, tz, sc] of [[15.8, -8.2, 1.1], [16.5, -4.4, 0.95], [15.9, -0.6, 1.15], [16.4, 3.0, 1.0], [15.7, 6.2, 0.9]]) {
    buildCypress(g, tx, tz, sc);
  }

  // 4) Sculpted Formula Race Car in the Pit Box!
  const formula = buildFormulaCar();
  formula.root.position.set(10.6, 0, -0.3);
  g.add(formula.root);

  // 5) Tire smoke particles for Lights-Out launch
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xeaf2f5, transparent: true, opacity: 0.65 });
  const smokePuffs = [];
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), smokeMat.clone());
    puff.visible = false;
    g.add(puff);
    smokePuffs.push(puff);
  }

  // 6) Crisp CNC Alloy Setup Bay Collars & Warm-Spindle Thermal Floor Rings (around LATHE & MILL!)
  const spindleVisuals = {};
  for (const [id, x, z, initColor] of [['lathe', -3.75, -3.4, C.mint], ['mill', 0.65, -3.4, C.gold]]) {
    const sg = new THREE.Group();
    sg.position.set(x, 0.03, z);
    // Bold luminous alloy setup bay trim framing front + sides outside the hazard strip!
    const barMat = new THREE.MeshBasicMaterial({ color: initColor });
    const frontBar = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.06, 0.22), barMat);
    frontBar.position.set(0, 0.02, 1.48);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 2.6), barMat);
    sideL.position.set(-1.55, 0.02, 0.24);
    const sideR = sideL.clone();
    sideR.position.x = 1.55;
    sg.add(frontBar, sideL, sideR);
    // Floor warm-spindle thermal halo ring (lights up at 1.38x / 1.82x or amber during changeover!)
    const ringGeo = new THREE.RingGeometry(1.75, 2.04, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: initColor, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.01, 0.15);
    sg.add(ring);
    g.add(sg);
    spindleVisuals[id] = { barMat, ringMat, ring };
  }

  let prevFittedCount = 0;
  let snapBounce = 0;

  function update(game, dt, clockTime, reduced, finale) {
    const fitted = game?.fitted ?? [];
    const fittedSet = new Set(fitted.map(f => f.slot));
    if (fitted.length > prevFittedCount) {
      snapBounce = 1.0;
    }
    prevFittedCount = fitted.length;
    if (snapBounce > 0) snapBounce = Math.max(0, snapBounce - dt * 4.5);

    // Show every fitted car sub-assembly + optional Covari Aero Fin.
    // Clearing the 6-part grid target always mounts the centerlock slicks so any
    // cleared car visibly rolls out on racing tires at Lights Out.
    const cleared = fitted.length >= (game?.config?.passTarget ?? 6);
    for (const [slotKey, meshGroup] of Object.entries(formula.slots)) {
      meshGroup.visible = fittedSet.has(slotKey) || (slotKey === 'wheels' && cleared);
    }
    formula.covariFin.visible = Boolean(game?.covariFitted);

    // Update 10 back-wall Chassis Spec LEDs
    for (let i = 0; i < progressLamps.length; i++) {
      const on = i < fitted.length;
      const hex = on ? (i < 6 ? C.mint : C.gold) : 0x28434e;
      progressLamps[i].material.color.setHex(hex);
    }

    // Update CNC Lathe & Mill Alloy Setup Collars & Warm-Spindle Thermal Rings
    for (const id of ['lathe', 'mill']) {
      const sv = spindleVisuals[id];
      const st = game?.stations?.[id];
      if (!sv || !st) continue;
      const alloyHex = st.setup === 'ti' ? C.gold : C.mint;
      if (st.changingOver) {
        sv.barMat.color.setHex(0xff9b3d);
        sv.ringMat.color.setHex(0xff9b3d);
        sv.ringMat.opacity = 0.55 + (reduced ? 0.15 : Math.sin(clockTime * 12) * 0.25);
        sv.ring.scale.setScalar(1.0);
      } else {
        sv.barMat.color.setHex(alloyHex);
        const streak = st.streak ?? 1;
        if (streak >= 3) {
          sv.ringMat.color.setHex(0xff784f); // blazing Redline 1.82x!
          sv.ringMat.opacity = 0.62 + (reduced ? 0.12 : Math.sin(clockTime * 8) * 0.22);
          sv.ring.scale.setScalar(reduced ? 1.03 : 1.02 + Math.sin(clockTime * 8) * 0.03);
        } else if (streak === 2) {
          sv.ringMat.color.setHex(alloyHex);
          sv.ringMat.opacity = 0.42 + (reduced ? 0.08 : Math.sin(clockTime * 5) * 0.14);
          sv.ring.scale.setScalar(1.0);
        } else {
          sv.ringMat.opacity = 0;
        }
      }
    }

    // Car pose & 5-Red-Light Starting Gantry animation
    if (finale) {
      const t = finale.t;
      const go = finale.passed;
      if (go) {
        // 0..2.0s: 5 red lights sequence one by one; 2.0s: LIGHTS OUT -> all emerald & car blasts off!
        const lightsOut = t >= 2.0;
        const litRed = Math.min(5, Math.floor(t / 0.38) + 1);
        for (let i = 0; i < 5; i++) {
          startLights[i].material.color.setHex(lightsOut ? C.mint : i < litRed ? 0xff3b30 : 0x302428);
        }
        const drop = Math.min(1, t / 0.7);
        formula.jacks.position.y = -drop * 0.26;
        formula.car.position.y = 0.18 * (1 - drop) + (lightsOut && !reduced ? Math.sin(t * 50) * 0.012 : 0);
        if (lightsOut) {
          const lt = t - 2.0;
          const dist = lt * lt * 7.8 + lt * 3.2;
          formula.root.position.set(10.6, 0, -0.3 - dist);
          formula.exhaustFlame.visible = true;
          formula.exhaustFlame.scale.set(1, 1 + Math.sin(t * 45) * 0.3, 1);
          // Tire smoke puffs blooming behind rear slicks during launch
          for (let i = 0; i < smokePuffs.length; i++) {
            const age = lt - i * 0.09;
            const p = smokePuffs[i];
            p.visible = age > 0 && age < 1.3;
            if (p.visible) {
              p.position.set(10.6 + (i % 2 ? 0.85 : -0.85) + (i - 3.5) * 0.06, 0.25 + age * 0.75, 0.9 - i * 0.55);
              p.scale.setScalar(0.6 + age * 1.45);
              p.material.opacity = Math.max(0, 0.58 * (1 - age / 1.3));
            }
          }
        } else {
          formula.root.position.set(10.6, 0, -0.3);
          formula.exhaustFlame.visible = t > 1.2;
          for (const p of smokePuffs) p.visible = false;
        }
      } else {
        // Missed the grid (<6 parts): gantry flashes red, car stays on jacks
        const blink = Math.sin(t * 8) > 0;
        for (let i = 0; i < 5; i++) startLights[i].material.color.setHex(blink ? 0xff3b30 : 0x302428);
        formula.jacks.position.y = 0;
        formula.car.position.y = 0.18;
        formula.root.position.set(10.6, 0, -0.3);
        formula.exhaustFlame.visible = false;
        for (const p of smokePuffs) p.visible = false;
      }
    } else {
      // Live shift state: gantry shows red lights counting up with clear progress (0..5), turning mint at 6+!
      const cleared = fitted.length >= (game?.config?.passTarget ?? 6);
      const lit = Math.min(5, fitted.length);
      for (let i = 0; i < 5; i++) {
        startLights[i].material.color.setHex(cleared ? C.mint : i < lit ? C.gold : 0x302428);
      }
      formula.jacks.position.y = 0;
      const idleVib = cleared && !reduced ? Math.sin(clockTime * 32) * 0.006 : 0;
      formula.car.position.y = 0.18 + snapBounce * 0.11 + idleVib;
      formula.root.position.set(10.6, 0, -0.3);
      formula.exhaustFlame.visible = false;
      for (const p of smokePuffs) p.visible = false;
    }
  }

  // Frame points ensure the orthographic camera cleanly frames the Paddock Garage,
  // Formula Car in the Pit Box, Starting Gantry, FIA kerbs, and Cypress edge!
  const framePoints = [
    new THREE.Vector3(-9.6, 0, -6.5),
    new THREE.Vector3(-9.6, 3.3, -6.5),
    new THREE.Vector3(-9.6, 0, 4.8),
    new THREE.Vector3(15.6, 0, -6.4),
    new THREE.Vector3(15.6, 4.0, -6.0),
    new THREE.Vector3(15.6, 0, 4.8),
  ];

  g.userData = { update, framePoints, formula, progressLamps, startLights };
  return g;
}
