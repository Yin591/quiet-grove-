import * as THREE from 'three';

/* ============================================================
   Sanctuary · 安全岛
   Portrait-first forest creek · Three.js + GSAP
   ============================================================ */

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || innerWidth < 768;
const isPortrait = innerHeight > innerWidth;

/* ---------- Scene ---------- */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc8e6a8, 0.030);

const camera = new THREE.PerspectiveCamera(
  isPortrait ? 68 : 58,
  innerWidth / innerHeight, 0.1, 250
);
// portrait composition: a bit higher & further, looking slightly down
camera.position.set(0, 5.2, 13);
camera.lookAt(0, 1.4, -8);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('scene'),
  antialias: !isMobile,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.25 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

function setVh() {
  document.documentElement.style.setProperty('--vh', `${innerHeight * 0.01}px`);
}
setVh();

/* ---------- Sky dome (fresh green-blue afternoon) ---------- */
const skyUniforms = {
  uTop:    { value: new THREE.Color(0xa7d6f4) }, // soft sky blue high
  uMid:    { value: new THREE.Color(0xd6ecc8) }, // pale green-cream
  uBottom: { value: new THREE.Color(0xeff5d8) }, // cream horizon
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false,
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vDir;
    uniform vec3 uTop;
    uniform vec3 uMid;
    uniform vec3 uBottom;
    void main() {
      float h = vDir.y;
      vec3 col;
      if (h >= 0.0) col = mix(uMid, uTop, smoothstep(0.0, 0.75, h));
      else          col = mix(uBottom, uMid, smoothstep(-0.4, 0.0, h));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 24), skyMat);
scene.add(skyDome);

/* ---------- Lights ---------- */
const ambient = new THREE.AmbientLight(0xfff5d8, 0.45);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff0c8, 0.65);
sun.position.set(-18, 22, -10);
scene.add(sun);

const hemi = new THREE.HemisphereLight(0xeaf7d4, 0x4a6a30, 0.45);
scene.add(hemi);

const fillBack = new THREE.DirectionalLight(0xffe9b8, 0.3);
fillBack.position.set(8, 10, 14);
scene.add(fillBack);

/* ---------- Sun visual (very soft, off-center, upper-right) ---------- */
function radialTex(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.9, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.45 })
);
sunMesh.position.set(22, 22, -48);
scene.add(sunMesh);

const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: radialTex([
    [0,    'rgba(255,240,200,0.45)'],
    [0.35, 'rgba(255,225,170,0.18)'],
    [1,    'rgba(255,200,130,0)']
  ]),
  transparent: true,
  opacity: 0.45,
  blending: THREE.NormalBlending,
  depthWrite: false,
}));
sunGlow.scale.set(28, 28, 1);
sunGlow.position.copy(sunMesh.position);
scene.add(sunGlow);

const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: radialTex([
    [0,    'rgba(255,235,190,0.18)'],
    [0.4,  'rgba(255,215,150,0.06)'],
    [1,    'rgba(255,200,130,0)']
  ]),
  transparent: true,
  opacity: 0.5,
  blending: THREE.NormalBlending,
  depthWrite: false,
}));
sunHalo.scale.set(72, 72, 1);
sunHalo.position.copy(sunMesh.position);
scene.add(sunHalo);

/* ---------- Ground: lush green grass plain ---------- */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x6ba24a, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

/* ============================================================
   No stream. The forest itself is the subject now.
   distToStream is kept as a no-op so legacy placement code still works.
   ============================================================ */
function distToStream() { return Infinity; }

/* ---------- Forest-floor pebbles (sparse, scattered) ---------- */
const pebbleGeo = new THREE.IcosahedronGeometry(0.10, 0);
const pebbleMatA = new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.95 });
const pebbleMatB = new THREE.MeshStandardMaterial({ color: 0x807055, roughness: 1 });

const pebbleCount = isMobile ? 30 : 50;
for (let i = 0; i < pebbleCount; i++) {
  const r  = 6 + Math.random() * 22;
  const a  = Math.random() * Math.PI * 2;
  const x  = Math.cos(a) * r;
  const z  = Math.sin(a) * r - 6;
  const m  = new THREE.Mesh(pebbleGeo, Math.random() > 0.5 ? pebbleMatA : pebbleMatB);
  m.position.set(x, 0.04 + Math.random() * 0.05, z);
  m.scale.setScalar(0.3 + Math.random() * 0.8);
  m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  scene.add(m);
}

/* ============================================================
   Grass — fresh sunlit green
   ============================================================ */
const bladeGeo = new THREE.PlaneGeometry(0.07, 0.6, 1, 4);
bladeGeo.translate(0, 0.3, 0);

const grassUniforms = {
  uTime:     { value: 0 },
  uWind:     { value: 1.0 },
  uSunColor: { value: new THREE.Color(0xfff2c0) },
  uBreezeCenter: { value: new THREE.Vector2() },
  uBreezeDirection: { value: new THREE.Vector2(0, -1) },
  uBreezeStrength: { value: 0 },
  uBreezeRadius: { value: 1.1 },
  uTrailMap: { value: null },
};
const grassMat = new THREE.ShaderMaterial({
  uniforms: grassUniforms,
  side: THREE.DoubleSide,
  vertexShader: `
    uniform float uTime;
    uniform float uWind;
    uniform vec2 uBreezeCenter;
    uniform vec2 uBreezeDirection;
    uniform float uBreezeStrength;
    uniform float uBreezeRadius;
    uniform sampler2D uTrailMap;
    varying float vTrail;
    varying float vY;
    varying vec3  vWPos;
    void main() {
      vec3 pos = position;
      vec4 world = instanceMatrix * vec4(pos, 1.0);
      vec4 trail = texture2D(uTrailMap, (world.xz + vec2(45.0, 49.0)) / 90.0);
      vTrail = trail.a;
      float t = uTime;
      float wave =
        sin(t * 0.9 + world.x * 0.32 + world.z * 0.28) * 0.32 +
        sin(t * 1.6 + world.z * 0.55) * 0.13;
      float side = cos(t * 0.7 + world.x * 0.22) * 0.16;
      float tip = pow(uv.y, 1.7);
      world.x += wave * tip * uWind;
      world.z += side * tip * uWind;
      vec2 offset = world.xz - uBreezeCenter;
      float influence = exp(-dot(offset, offset) / (uBreezeRadius * uBreezeRadius)) * uBreezeStrength;
      vec2 breeze = uBreezeDirection * 0.38 + normalize(offset + vec2(0.001)) * 0.10;
      world.xz += breeze * influence * tip;
      world.y -= influence * tip * 0.06;
      world.xz += (trail.gb * 2.0 - 1.0) * vTrail * tip * 0.32;
      world.y *= 1.0 - vTrail * tip * 0.65;
      vY = uv.y;
      vWPos = world.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * world;
    }
  `,
  fragmentShader: `
    varying float vY;
    varying vec3 vWPos;
    varying float vTrail;
    uniform vec3 uSunColor;
    void main() {
      // fresh sunlit green: deep base → bright lime → sun-kissed tip
      vec3 bottom = vec3(0.20, 0.32, 0.12);
      vec3 mid    = vec3(0.43, 0.66, 0.24);
      vec3 top    = mix(vec3(0.74, 0.86, 0.42), uSunColor, 0.35);
      vec3 col = mix(bottom, mid, smoothstep(0.0, 0.55, vY));
      col = mix(col, top, smoothstep(0.5, 1.0, vY));
      col += uSunColor * 0.16 * pow(vY, 5.0);
      col = mix(col, col * vec3(1.06, 1.03, 0.94), vTrail * 0.55);
      // mild fog blend
      float d = length(vWPos.xz);
      col = mix(col, vec3(0.82, 0.92, 0.72), smoothstep(22.0, 70.0, d) * 0.55);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

const GRASS_TARGET = isMobile ? 5200 : 11000;
const grass = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS_TARGET);
const dummy = new THREE.Object3D();
let placed = 0;
for (let i = 0; i < GRASS_TARGET * 3 && placed < GRASS_TARGET; i++) {
  const x = (Math.random() - 0.5) * 90;
  const z = (Math.random() - 0.5) * 90 - 4;
  if (distToStream(x, z) < 2.4) continue; // outside the wider creek, grass meets bank softly
  dummy.position.set(x, 0, z);
  dummy.rotation.y = Math.random() * Math.PI;
  dummy.scale.setScalar(0.6 + Math.random() * 0.85);
  dummy.updateMatrix();
  grass.setMatrixAt(placed++, dummy.matrix);
}
grass.count = placed;
scene.add(grass);

/* ============================================================
   Trees & bushes — green, layered
   ============================================================ */
// natural forest greens — no neon, no high-sat lime
const NEAR_LEAF_PALETTE = [0x6f9e4a, 0x7fae55, 0x6a9344, 0x789f52];
const FAR_LEAF_PALETTE  = [0x8fbf68, 0x9ccb73, 0x86b962, 0x95c46e];

function makeTree(x, z, palette) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 1.6, 7),
    new THREE.MeshLambertMaterial({ color: 0x5e3a1f })
  );
  trunk.position.y = 0.8;
  g.add(trunk);

  const pal = palette || NEAR_LEAF_PALETTE;
  const leafColor = pal[Math.floor(Math.random() * pal.length)];
  // MeshLambertMaterial → lit by the scene's directional/hemi lights only.
  // No emissive, no Additive blending. Trees stay matte and never glow.
  const leafMat = new THREE.MeshLambertMaterial({ color: leafColor });

  const layers = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < layers; i++) {
    const r = 1.35 - i * 0.28;
    const h = 2.2 - i * 0.35;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), leafMat);
    cone.position.y = 2.0 + i * 0.85;
    cone.rotation.y = Math.random() * Math.PI;
    g.add(cone);
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.setScalar(0.95 + Math.random() * 0.9);
  return g;
}

/* ---------- Tree placement: composed, layered, side-banded ----------
   Goal: dense forest hug on left/right + a far layer behind,
   while keeping the stream corridor open. Not random scatter. */

function tryAddTree(x, z, minStreamDist = 4.0, minCamDist = 9) {
  if (distToStream(x, z) < minStreamDist) return false;
  if (Math.sqrt(x * x + (z + 4) * (z + 4)) < minCamDist) return false;
  scene.add(makeTree(x, z));
  return true;
}

// LAYER A — close side bands. Wraps the viewer.
// Mobile: +40%, Desktop: -15% from previous.
const NEAR_PER_SIDE = isMobile ? 40 : 34;
for (let side = -1; side <= 1; side += 2) {
  let placed = 0, tries = 0;
  while (placed < NEAR_PER_SIDE && tries++ < NEAR_PER_SIDE * 6) {
    const xBase = side * (7 + Math.random() * 18);
    const z = -8 - Math.random() * 28;
    const jitter = (Math.random() - 0.5) * 4;
    if (tryAddTree(xBase + jitter, z, 4.0, 9)) placed++;
  }
}

// LAYER B — far backdrop band
const FAR_COUNT = isMobile ? 52 : 42;
for (let i = 0; i < FAR_COUNT; i++) {
  const x = (Math.random() - 0.5) * 140;
  const z = -42 - Math.random() * 18;
  if (distToStream(x, z) < 2.4) continue;
  const t = makeTree(x, z, FAR_LEAF_PALETTE);
  t.scale.multiplyScalar(0.85);
  scene.add(t);
}

// LAYER C — foreground accents flanking the viewer
const FRONT_COUNT = isMobile ? 14 : 10;
for (let i = 0; i < FRONT_COUNT; i++) {
  const side = Math.random() > 0.5 ? 1 : -1;
  const x = side * (14 + Math.random() * 22);
  const z = 4 + Math.random() * 10;
  tryAddTree(x, z, 4.0, 6);
}

// LAYER D (mobile only) — extra trees ahead of the stream to hug horizon
if (isMobile) {
  for (let i = 0; i < 22; i++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * (10 + Math.random() * 16);
    const z = -20 - Math.random() * 14;
    tryAddTree(x, z, 4.0, 8);
  }
  // LAYER E (mobile only) — a few trees ahead of the viewer (in front of stream)
  for (let i = 0; i < 10; i++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * (16 + Math.random() * 14);
    const z = -3 - Math.random() * 8;  // forward, not blocking center
    tryAddTree(x, z, 4.0, 7);
  }
}

function makeBush(x, z) {
  const g = new THREE.Group();
  const BUSH_PALETTE = [0x6a9344, 0x789f52, 0x82a85a];
  const mat = new THREE.MeshLambertMaterial({
    color: BUSH_PALETTE[Math.floor(Math.random() * BUSH_PALETTE.length)],
  });
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const s = 0.32 + Math.random() * 0.42;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
    b.position.set((Math.random() - 0.5) * 0.7, s * 0.55, (Math.random() - 0.5) * 0.7);
    g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}

/* Bushes scattered through the forest floor (used to hug stream — now free) */
const BUSH_COUNT = isMobile ? 28 : 36;
for (let i = 0; i < BUSH_COUNT; i++) {
  const r = 6 + Math.random() * 26;
  const a = Math.random() * Math.PI * 2;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r - 6;
  // skip a small clearing right around camera focus
  if (Math.sqrt(x * x + (z + 4) * (z + 4)) < 6) continue;
  scene.add(makeBush(x, z));
}

/* ============================================================
   Animals — low-poly forest creatures with gentle behaviors
   ============================================================ */

/* Each animal is a tiny THREE.Group with: a body, a head, ears, tail, four legs.
   Materials are warm muted earth tones — no cartoon saturation. */

function softMat(hex) {
  // Lambert: lit by the scene's directional + hemi lights, never emissive.
  return new THREE.MeshLambertMaterial({ color: hex });
}

/* Helper: round-ish ellipsoid from a sphere */
function ellipsoid(rx, ry, rz, mat, segH = 14, segV = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, segH, segV), mat);
  m.scale.set(rx, ry, rz);
  return m;
}
function capsule(r, len, mat) {
  // capsule fallback: cylinder + two hemispheres
  const grp = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  grp.add(cyl);
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  top.position.y =  len / 2;
  grp.add(top);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  bot.position.y = -len / 2;
  grp.add(bot);
  return grp;
}
// Leg with hip pivot: returned Group sits at the hip; the capsule hangs below it.
// Rotate the Group on X to "lift" the leg forward/backward.
function legPivot(r, len, mat) {
  const hip = new THREE.Group();
  const leg = capsule(r, len, mat);
  leg.position.y = -len / 2;
  hip.add(leg);
  hip.userData.length = len;
  return hip;
}
function dot(mat) {
  return new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat);
}

/* ---------- FOX ---------- */
function makeFox() {
  const g = new THREE.Group();
  const orange = softMat(0xb86a3a);
  const cream  = softMat(0xefdcc2);
  const dark   = softMat(0x3b2418);
  const eye    = softMat(0x1a1208);

  // body — long ellipsoid
  const body = ellipsoid(0.18, 0.16, 0.34, orange);
  body.position.y = 0.30;
  g.add(body);
  const belly = ellipsoid(0.16, 0.08, 0.30, cream);
  belly.position.y = 0.22;
  g.add(belly);

  // head
  const headG = new THREE.Group();
  const headBall = ellipsoid(0.13, 0.13, 0.13, orange);
  headG.add(headBall);
  const snout = ellipsoid(0.06, 0.055, 0.085, cream);
  snout.position.set(0, -0.02, 0.13);
  headG.add(snout);
  const nose = ellipsoid(0.025, 0.022, 0.025, dark);
  nose.position.set(0, -0.012, 0.20);
  headG.add(nose);
  const eL = dot(eye); eL.position.set(-0.06, 0.04, 0.10); headG.add(eL);
  const eR = dot(eye); eR.position.set( 0.06, 0.04, 0.10); headG.add(eR);
  const earGeo = new THREE.ConeGeometry(0.055, 0.13, 12);
  const earL = new THREE.Mesh(earGeo, orange);
  earL.position.set(-0.07, 0.13, 0.0); earL.rotation.z =  0.18; headG.add(earL);
  const earR = new THREE.Mesh(earGeo, orange);
  earR.position.set( 0.07, 0.13, 0.0); earR.rotation.z = -0.18; headG.add(earR);
  headG.position.set(0, 0.40, 0.30);
  g.add(headG);

  // fluffy tail — chain of ellipsoids
  const tailG = new THREE.Group();
  tailG.position.set(0, 0.34, -0.30);
  const tailSegs = [];
  for (let i = 0; i < 5; i++) {
    const k = 1 - i * 0.15;
    const seg = ellipsoid(0.085 * k, 0.085 * k, 0.10, i === 4 ? cream : orange);
    seg.position.z = -i * 0.10;
    seg.position.y = i * 0.012;
    tailG.add(seg);
    tailSegs.push(seg);
  }
  g.add(tailG);

  // legs — hip-pivoted capsules so they can swing forward/back when walking
  const legs = [];
  // FL, FR, BL, BR
  [[-0.10, 0.20], [0.10, 0.20], [-0.10, -0.18], [0.10, -0.18]].forEach(([x, z]) => {
    const l = legPivot(0.04, 0.18, dark);
    l.position.set(x, 0.22, z); // hip height
    g.add(l);
    legs.push(l);
  });

  g.userData.kind = 'fox';
  g.userData.head = headG;
  g.userData.tail = tailG;
  g.userData.tailSegs = tailSegs;
  g.userData.legs = legs;
  return g;
}

/* ---------- RABBIT ---------- */
function makeRabbit() {
  const g = new THREE.Group();
  const fur   = softMat(0xefe6d4);
  const pink  = softMat(0xd9a797);
  const dark  = softMat(0x3a2a1c);
  const eye   = softMat(0x1a1208);

  const body = ellipsoid(0.16, 0.14, 0.20, fur);
  body.position.y = 0.20;
  g.add(body);

  const headG = new THREE.Group();
  const headBall = ellipsoid(0.12, 0.11, 0.12, fur);
  headG.add(headBall);
  const snout = ellipsoid(0.055, 0.05, 0.06, fur);
  snout.position.set(0, -0.02, 0.11);
  headG.add(snout);
  const nose = ellipsoid(0.022, 0.018, 0.020, pink);
  nose.position.set(0, -0.012, 0.16);
  headG.add(nose);
  const eL = dot(eye); eL.position.set(-0.055, 0.025, 0.08); headG.add(eL);
  const eR = dot(eye); eR.position.set( 0.055, 0.025, 0.08); headG.add(eR);

  // long rounded ears — capsules tilted
  const earsG = new THREE.Group();
  const earL = capsule(0.028, 0.16, fur);
  earL.position.set(-0.045, 0.18, 0.02);
  earL.rotation.x = -0.18; earL.rotation.z =  0.10;
  earsG.add(earL);
  const earLin = capsule(0.018, 0.12, pink);
  earLin.position.set(-0.045, 0.185, 0.028);
  earLin.rotation.copy(earL.rotation);
  earsG.add(earLin);
  const earR = capsule(0.028, 0.16, fur);
  earR.position.set(0.045, 0.18, 0.02);
  earR.rotation.x = -0.18; earR.rotation.z = -0.10;
  earsG.add(earR);
  const earRin = capsule(0.018, 0.12, pink);
  earRin.position.set(0.045, 0.185, 0.028);
  earRin.rotation.copy(earR.rotation);
  earsG.add(earRin);
  headG.add(earsG);
  headG.position.set(0, 0.34, 0.13);
  g.add(headG);

  // pom-pom tail
  const tailG = new THREE.Group();
  const tail = ellipsoid(0.065, 0.06, 0.06, fur);
  tailG.add(tail);
  tailG.position.set(0, 0.22, -0.18);
  g.add(tailG);

  // soft feet
  const feet = [];
  [[-0.07, 0.08], [0.07, 0.08], [-0.07, -0.08], [0.07, -0.08]].forEach(([x, z]) => {
    const f = ellipsoid(0.04, 0.025, 0.06, dark);
    f.position.set(x, 0.04, z);
    g.add(f);
    feet.push(f);
  });

  g.userData.kind = 'rabbit';
  g.userData.head = headG;
  g.userData.tail = tailG;
  g.userData.ears = earsG;
  g.userData.legs = feet;
  return g;
}

/* ---------- CAT ---------- */
function makeCat() {
  const g = new THREE.Group();
  const grey  = softMat(0x8a7c66);
  const light = softMat(0xc8b89a);
  const dark  = softMat(0x3a2a20);
  const eye   = softMat(0x1a1208);

  const body = ellipsoid(0.14, 0.13, 0.28, grey);
  body.position.y = 0.26;
  g.add(body);
  const belly = ellipsoid(0.13, 0.07, 0.26, light);
  belly.position.y = 0.20;
  g.add(belly);

  const headG = new THREE.Group();
  const headBall = ellipsoid(0.115, 0.11, 0.115, grey);
  headG.add(headBall);
  const nose = ellipsoid(0.018, 0.014, 0.014, dark);
  nose.position.set(0, -0.025, 0.10);
  headG.add(nose);
  const eL = dot(eye); eL.position.set(-0.055, 0.025, 0.085); headG.add(eL);
  const eR = dot(eye); eR.position.set( 0.055, 0.025, 0.085); headG.add(eR);
  const earGeo = new THREE.ConeGeometry(0.045, 0.08, 10);
  const earL = new THREE.Mesh(earGeo, grey);
  earL.position.set(-0.065, 0.11, 0); earL.rotation.z =  0.18; headG.add(earL);
  const earR = new THREE.Mesh(earGeo, grey);
  earR.position.set( 0.065, 0.11, 0); earR.rotation.z = -0.18; headG.add(earR);
  headG.position.set(0, 0.36, 0.22);
  g.add(headG);

  // curved tail — small ellipsoids
  const tailG = new THREE.Group();
  tailG.position.set(0, 0.30, -0.22);
  const tailSegs = [];
  for (let i = 0; i < 6; i++) {
    const k = 1 - i * 0.10;
    const seg = ellipsoid(0.04 * k, 0.04 * k, 0.07, grey);
    seg.position.z = -i * 0.07;
    seg.position.y = Math.sin(i * 0.55) * 0.04;
    tailG.add(seg);
    tailSegs.push(seg);
  }
  g.add(tailG);

  // legs — hip-pivoted so they swing
  const legs = [];
  [[-0.08, 0.16], [0.08, 0.16], [-0.08, -0.14], [0.08, -0.14]].forEach(([x, z]) => {
    const l = legPivot(0.035, 0.18, dark);
    l.position.set(x, 0.22, z);
    g.add(l);
    legs.push(l);
  });

  g.userData.kind = 'cat';
  g.userData.head = headG;
  g.userData.tail = tailG;
  g.userData.tailSegs = tailSegs;
  g.userData.legs = legs;
  return g;
}

/* ---------- Behavior model ----------
   Each animal lives in one of three states:
     - 'walk'  : moves slowly toward a target, body bobs
     - 'pause' : stands still, head looks around
     - 'sit'   : crouches down briefly (cat / rabbit)
   States transition randomly on long, slow timers. */

const animals = [];
const animalHitboxes = []; // array of meshes used only for raycasting

function spawnAnimal(maker, pos, profile) {
  const a = maker();
  a.position.set(pos.x, 0, pos.z);
  a.rotation.y = Math.random() * Math.PI * 2;
  // Wrap in a parent so we can do click bobs without fighting state.y
  scene.add(a);

  // Invisible hitbox (raycast-only) — larger than the model, finger-friendly
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8), hitMat);
  hit.position.y = 0.35;
  hit.userData.type = 'animal';
  a.add(hit);
  animalHitboxes.push(hit);

  const entry = {
    obj: a,
    hit,
    kind: a.userData.kind,
    home: { x: pos.x, z: pos.z, r: profile.roam },
    target: new THREE.Vector3(pos.x, 0, pos.z),
    state: 'walk',
    stateTime: 0,
    nextStateAt: 3 + Math.random() * 3,
    speed: profile.speed,
    walkBias: profile.walkBias,
    hopAmp: profile.hopAmp,
    bobPhase: Math.random() * Math.PI * 2,
    headPhase: Math.random() * Math.PI * 2,
    sitOffset: 0,
    clickBob: 0,        // 0..1 pulse triggered on click
    clickLook: 0,       // attention timer — head briefly looks toward camera
    clickWag: 0,        // fast tail wag burst (fox / cat)
    clickHop: 0,        // small hop pulse (rabbit) — full cycle ~0.55s
    earWiggle: 0,       // rabbit ear pulse
    nextRabbitHopAt: 3 + Math.random() * 3, // standalone idle-hop timer
  };
  hit.userData.animal = entry;
  animals.push(entry);
  pickAnimalTarget(entry); // always assign a first target so 'walk' state moves
  return entry;
}

// FOX — right side mid-ground, walks visibly across the meadow
spawnAnimal(makeFox, { x:  4, z:  1 }, { roam: 5.0, speed: 0.55, walkBias: 0.75, hopAmp: 0.0  });
// RABBIT — left of camera, hops noticeably
spawnAnimal(makeRabbit, { x: -3, z:  0 }, { roam: 3.0, speed: 0.85, walkBias: 0.55, hopAmp: 0.16 });
// CAT — front right, slow walker
spawnAnimal(makeCat, { x:  6, z: -4 }, { roam: 4.0, speed: 0.45, walkBias: 0.65, hopAmp: 0.0  });

// Mobile: keep only fox + rabbit
if (isMobile) {
  const catEntry = animals.find(a => a.kind === 'cat');
  if (catEntry) {
    scene.remove(catEntry.obj);
    const idx = animals.indexOf(catEntry);
    animals.splice(idx, 1);
    const hbIdx = animalHitboxes.indexOf(catEntry.hit);
    if (hbIdx >= 0) animalHitboxes.splice(hbIdx, 1);
  }
}

function pickAnimalTarget(a) {
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = a.home.r * (0.4 + Math.random() * 0.6);
    const tx = a.home.x + Math.cos(ang) * r;
    const tz = a.home.z + Math.sin(ang) * r;
    if (Math.sqrt(tx * tx + (tz - 6) * (tz - 6)) < 2) continue;
    a.target.set(tx, 0, tz);
    return;
  }
  a.target.set(a.home.x, 0, a.home.z);
}

function updateAnimals(dt, t) {
  for (const a of animals) {
    a.stateTime += dt;

    // state transitions
    if (!a.trailFollowing && a.stateTime >= a.nextStateAt) {
      a.stateTime = 0;
      const r = Math.random();
      if (a.state === 'walk') {
        if (r < 0.55) { a.state = 'pause'; a.nextStateAt = 2 + Math.random() * 2.5; }
        else if (a.kind !== 'fox' && r < 0.78) {
          a.state = 'sit'; a.nextStateAt = 3 + Math.random() * 3;
        } else {
          pickAnimalTarget(a); a.nextStateAt = 4 + Math.random() * 4;
        }
      } else {
        if (r < a.walkBias) {
          a.state = 'walk'; pickAnimalTarget(a); a.nextStateAt = 5 + Math.random() * 5;
        } else {
          a.state = 'pause'; a.nextStateAt = 2 + Math.random() * 2.5;
        }
      }
    }

    const o = a.obj;

    if (a.state === 'walk') {
      const dx = a.target.x - o.position.x;
      const dz = a.target.z - o.position.z;
      const d  = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.15) {
        a.state = 'pause'; a.stateTime = 0; a.nextStateAt = 3 + Math.random() * 4;
      } else {
        const step = Math.min(d, a.speed * (a.trailSpeed ?? 1) * dt);
        const nx = dx / d, nz = dz / d;
        o.position.x += nx * step;
        o.position.z += nz * step;
        const yaw = Math.atan2(nx, nz);
        const cur = o.rotation.y;
        const diff = ((yaw - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        o.rotation.y = cur + diff * Math.min(1, dt * 2.4);

        a.bobPhase += dt * (a.kind === 'rabbit' ? 7.0 : 8.0);
        if (a.kind === 'rabbit') {
          // visible hop: abs(sin) so it lands every half-cycle
          o.position.y = Math.abs(Math.sin(a.bobPhase)) * 0.18;
        } else {
          o.position.y = Math.abs(Math.sin(a.bobPhase)) * 0.04;
        }
        // legs lift & swing — trot gait (diagonal pairs in phase)
        if (o.userData.legs && a.kind !== 'rabbit') {
          // legs order: FL, FR, BL, BR
          const phases = [0, Math.PI, Math.PI, 0];
          o.userData.legs.forEach((hip, i) => {
            const swing = Math.sin(a.bobPhase + phases[i]) * 0.55; // ±31°
            hip.rotation.x = swing;
          });
          // tiny body sway + head bob synced to stride
          o.rotation.z = Math.sin(a.bobPhase * 2) * 0.04;
          if (o.userData.head) {
            o.userData.head.rotation.x =
              (o.userData.head.rotation.x || 0) + Math.sin(a.bobPhase * 2) * 0.015;
          }
        }
      }
    } else if (a.state === 'sit') {
      a.sitOffset = Math.min(a.sitOffset + dt * 0.8, 0.06);
      o.position.y = -a.sitOffset;
      o.rotation.z *= 0.9;
      // ease legs back to neutral
      if (o.userData.legs && a.kind !== 'rabbit') {
        o.userData.legs.forEach(hip => { hip.rotation.x *= 0.85; });
      }
    } else {
      // pause
      a.sitOffset = Math.max(a.sitOffset - dt * 0.8, 0);
      o.position.y = -a.sitOffset;
      o.rotation.z *= 0.9;
      // ease legs back to neutral standing
      if (o.userData.legs && a.kind !== 'rabbit') {
        o.userData.legs.forEach(hip => { hip.rotation.x *= 0.85; });
      }
      // standalone idle hop for rabbit
      if (a.kind === 'rabbit') {
        a.nextRabbitHopAt -= dt;
        if (a.nextRabbitHopAt <= 0) {
          a.nextRabbitHopAt = 3.5 + Math.random() * 3.5;
          a.bobPhase = 0; // start fresh
        }
        // play hop for the first ~0.45s of cycle
        const hopT = Math.max(0, 0.45 - a.nextRabbitHopAt);
        if (hopT > 0 && hopT < 0.45) {
          const k = Math.sin((hopT / 0.45) * Math.PI);
          o.position.y += k * 0.14;
        }
      }
      o.position.y += Math.sin(t * 1.1 + a.bobPhase) * 0.006;
    }

    // click bob — short upward spring, decays toward zero
    if (a.clickBob > 0) {
      a.clickBob = Math.max(0, a.clickBob - dt * 1.6);
      const k = Math.sin(a.clickBob * Math.PI);
      o.position.y += k * 0.18;
    }

    // click hop — single arc (~0.55s) on top of position
    if (a.clickHop > 0) {
      a.clickHop = Math.max(0, a.clickHop - dt);
      const p = 1 - (a.clickHop / 0.55);     // 0..1
      const arc = Math.sin(p * Math.PI);
      o.position.y += arc * 0.22;
    }

    // head: look-around, or briefly look toward camera if just clicked
    if (o.userData.head) {
      if (a.clickLook > 0) {
        a.clickLook = Math.max(0, a.clickLook - dt);
        const camLocalAng = Math.atan2(
          camera.position.x - o.position.x,
          camera.position.z - o.position.z
        ) - o.rotation.y;
        const cur = o.userData.head.rotation.y;
        const diff = ((camLocalAng - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        o.userData.head.rotation.y = cur + diff * Math.min(1, dt * 2.6);
        o.userData.head.rotation.x = -0.08;
      } else {
        a.headPhase += dt * 0.35;
        o.userData.head.rotation.y = Math.sin(a.headPhase) * 0.45;
        o.userData.head.rotation.x = Math.sin(a.headPhase * 0.6) * 0.10;
      }
    }

    // tail sway — base idle motion
    let tailYaw = Math.sin(t * 1.2 + a.bobPhase) * 0.25;
    // click wag — fast double swing (~0.9s burst) layered on top
    if (a.clickWag > 0) {
      a.clickWag = Math.max(0, a.clickWag - dt);
      const wagP = (0.9 - a.clickWag) / 0.9;      // 0..1
      const wagAmp = Math.sin(wagP * Math.PI);    // ease in/out
      tailYaw += Math.sin(wagP * Math.PI * 4) * 0.85 * wagAmp;
    }
    if (o.userData.tail) o.userData.tail.rotation.y = tailYaw;

    if (o.userData.tailSegs) {
      o.userData.tailSegs.forEach((seg, i) => {
        seg.position.x = Math.sin(t * 1.4 + i * 0.5 + a.bobPhase) * 0.018 * (i + 1) * 0.3;
      });
    }

    // rabbit ears wiggle — when earWiggle > 0 do a fast double shake
    if (a.kind === 'rabbit' && o.userData.ears) {
      a.earWiggle = Math.max(0, a.earWiggle - dt);
      const idle = Math.sin(t * 1.6) * 0.025;
      const shake = a.earWiggle > 0
        ? Math.sin((1 - a.earWiggle / 0.7) * Math.PI * 4) * 0.32
        : 0;
      o.userData.ears.rotation.z = idle + shake;
    }
  }
}

/* ============================================================
   Click feedback — raycaster + floating hearts (no text)
   ============================================================ */

// Active heart sprites — small, soft, upward-drifting
const hearts = [];

function heartTex() {
  // soft heart silhouette drawn on canvas
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 70);
  const path = new Path2D();
  // two arcs + bottom point
  path.moveTo(0, 22);
  path.bezierCurveTo(-46, -10, -38, -52, 0, -28);
  path.bezierCurveTo(38, -52, 46, -10, 0, 22);
  // very soft glow ring first
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(255, 220, 220, 0.55)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill(path);
  ctx.shadowBlur = 0;
  // subtle inner highlight
  ctx.fillStyle = 'rgba(255, 245, 245, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-10, -14, 7, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}
const HEART_TEX = heartTex();

const HEART_COLORS = [0xffb8c8, 0xffa6bd, 0xff95b0, 0xffc5d2];

function emitHearts(x, y, z, count) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: HEART_TEX,
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    const baseSize = 0.16 + Math.random() * 0.06;
    sp.scale.set(baseSize, baseSize, 1);
    sp.position.set(
      x + (Math.random() - 0.5) * 0.30,
      y + 0.15 + Math.random() * 0.10,
      z + (Math.random() - 0.5) * 0.30
    );
    scene.add(sp);
    hearts.push({
      sprite: sp,
      life: 0,
      ttl: 1.2 + Math.random() * 0.25,
      vy: 0.55 + Math.random() * 0.20,
      vx: (Math.random() - 0.5) * 0.06,
      vz: (Math.random() - 0.5) * 0.06,
      sway: Math.random() * Math.PI * 2,
      baseSize,
    });
  }
}

function updateHearts(dt) {
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.life += dt;
    const t = h.life / h.ttl;
    h.sway += dt * 2.2;
    h.sprite.position.x += (h.vx + Math.sin(h.sway) * 0.04) * dt;
    h.sprite.position.y += h.vy * dt;
    h.sprite.position.z += h.vz * dt;
    h.vy *= 0.985;
    // fade in then out — peak opacity ~0.75
    const o = t < 0.20 ? (t / 0.20) : Math.max(0, 1 - (t - 0.20) / 0.80);
    h.sprite.material.opacity = o * 0.9;
    h.sprite.scale.setScalar(h.baseSize * (1 + t * 0.20));
    if (h.life >= h.ttl) {
      scene.remove(h.sprite);
      h.sprite.material.dispose();
      hearts.splice(i, 1);
    }
  }
}
// Backwards-compat: keep the old updateSparkles symbol used in animate()
const updateSparkles = updateHearts;

function feedbackAnimal(entry) {
  // 1. body action reaction
  if (entry.kind === 'fox') {
    // fast tail wag x2 — implemented as bobPhase kick + a short clickWag timer
    entry.clickWag = 0.9;
    entry.clickBob = 0.5;  // tiny torso lift
  } else if (entry.kind === 'rabbit') {
    // small hop + ear shake
    entry.clickHop = 0.55;
    entry.earWiggle = 0.7;
  } else if (entry.kind === 'cat') {
    // tail swing + head lift
    entry.clickWag = 0.9;
    entry.clickLook = 1.0;
  }

  // 2. floating hearts above the animal
  const wp = entry.obj.position;
  emitHearts(wp.x, wp.y + 0.45, wp.z, 3 + Math.floor(Math.random() * 3));
}

// Raycaster for clicks
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

function tryAnimalClick(clientX, clientY, originalEvent) {
  const target = originalEvent && originalEvent.target;
  if (target && target.closest &&
      (target.closest('.player') || target.closest('#ui') ||
       target.closest('.fs')     || target.closest('.entry') ||
       target.closest('.toast'))) {
    return false;
  }
  _ndc.x = (clientX / innerWidth) * 2 - 1;
  _ndc.y = -(clientY / innerHeight) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);
  const hits = _ray.intersectObjects(animalHitboxes, false);
  if (hits.length) {
    const hb = hits[0].object;
    const entry = hb.userData.animal;
    if (entry) { feedbackAnimal(entry); return true; }
  }
  return false;
}

window.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  // ignore clicks while still in entry ceremony
  if (document.body.classList.contains('pre-entry')) return;
  tryAnimalClick(e.clientX, e.clientY, e);
});

/* ============================================================
   Atmosphere — pollen / dust / dandelion + god rays
   ============================================================ */
function makeParticleSystem(opts) {
  const { count, area, yRange, size, color, tex, blend, speed } = opts;
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * area;
    pos[i * 3 + 1] = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
    pos[i * 3 + 2] = (Math.random() - 0.5) * area - 4;
    vel[i * 3]     = (Math.random() - 0.5) * speed.x;
    vel[i * 3 + 1] = speed.y[0] + Math.random() * (speed.y[1] - speed.y[0]);
    vel[i * 3 + 2] = (Math.random() - 0.5) * speed.x;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size, map: tex, color,
    transparent: true,
    blending: blend,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return { points: new THREE.Points(geo, mat), pos, vel, phase, count, area, yRange };
}

const pollenTex = radialTex([
  [0,    'rgba(255,255,240,1)'],
  [0.35, 'rgba(255,240,180,0.6)'],
  [1,    'rgba(255,200,120,0)']
]);
const dustTex = radialTex([
  [0,    'rgba(255,255,235,0.9)'],
  [0.5,  'rgba(255,250,220,0.3)'],
  [1,    'rgba(255,240,200,0)']
]);
function makeDandelionTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  g.addColorStop(0,    'rgba(255,253,245,0.95)');
  g.addColorStop(0.25, 'rgba(255,250,235,0.55)');
  g.addColorStop(0.55, 'rgba(255,248,225,0.18)');
  g.addColorStop(1,    'rgba(255,240,210,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,250,230,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.2;
    const r1 = 22 + Math.random() * 6;
    const r2 = 55 + Math.random() * 8;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1);
    ctx.lineTo(64 + Math.cos(a) * r2, 64 + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(220,200,150,0.8)';
  ctx.beginPath(); ctx.arc(64, 64, 4, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(c);
}
const dandelionTex = makeDandelionTex();

const pollen = makeParticleSystem({
  count: isMobile ? 420 : 800, area: 78, yRange: [0.4, 9],
  size: 0.085, color: 0xfff5cc, tex: pollenTex,
  blend: THREE.AdditiveBlending,
  speed: { x: 0.014, y: [0.003, 0.009] }
});
pollen.points.material.opacity = 0.72;
scene.add(pollen.points);

const dust = makeParticleSystem({
  count: isMobile ? 520 : 1000, area: 68, yRange: [0.2, 13],
  size: 0.035, color: 0xfffae0, tex: dustTex,
  blend: THREE.AdditiveBlending,
  speed: { x: 0.006, y: [0.001, 0.004] }
});
dust.points.material.opacity = 0.65;
scene.add(dust.points);

const dandelion = makeParticleSystem({
  count: isMobile ? 36 : 70, area: 60, yRange: [1.2, 7.5],
  size: 0.42, color: 0xfff8e8, tex: dandelionTex,
  blend: THREE.NormalBlending,
  speed: { x: 0.020, y: [0.004, 0.010] }
});
dandelion.points.material.opacity = 0.7;
scene.add(dandelion.points);

/* ---------- God rays ---------- */
function makeGodRay(width, height) {
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime:      { value: 0 },
      uColor:     { value: new THREE.Color(0xffe6b0) },
      uIntensity: { value: 0.22 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      void main() {
        float v = 1.0 - vUv.y;
        float h = 1.0 - abs(vUv.x - 0.5) * 2.0;
        h = smoothstep(0.0, 1.0, h);
        float a = pow(h * v, 1.7) * uIntensity;
        a *= 0.85 + sin(uTime * 0.4 + vUv.x * 5.0 + vUv.y * 3.0) * 0.15;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

const godRays = [];
const rayPositions = isMobile ? [
  { x: -6,  z: -10, w: 2.8, h: 16 },
  { x:  8,  z: -12, w: 2.6, h: 17 },
  { x: -3,  z: -20, w: 3.0, h: 19 },
] : [
  { x: -8,  z: -10, w: 3.2, h: 16 },
  { x:  1,  z: -8,  w: 3.6, h: 15 },
  { x: 10,  z: -6,  w: 3.0, h: 14 },
  { x: -12, z: -6,  w: 2.2, h: 14 },
  { x: -6,  z: -22, w: 3.0, h: 20 },
];
rayPositions.forEach(rp => {
  const r = makeGodRay(rp.w, rp.h);
  r.position.set(rp.x, rp.h / 2 + 0.5, rp.z);
  // halved again — softer Tyndall, no stage spotlights
  r.userData.baseIntensity = 0.05 + Math.random() * 0.04;
  r.material.uniforms.uIntensity.value = r.userData.baseIntensity;
  scene.add(r);
  godRays.push(r);
});


export { scene, camera, renderer, setVh, skyUniforms, ambient, sun, hemi, sunMesh, sunGlow, grassUniforms, pollen, dust, dandelion, godRays, animals, updateAnimals, updateSparkles };
