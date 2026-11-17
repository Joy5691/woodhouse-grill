/* =========================================================
   Offline 3D dish renderer (dev tool)
   Models every menu item with three.js primitives + the steak
   painter, renders ONE still per dish and saves a small WebP to
   assets/dishes3d/<itemId>.webp (via the dev server's PUT).
   The live site only loads those light images.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { paintSteak, steakGeometry, SHAPES, paintWood, paintBone, radialTex, ellipseR, gauss, rng } from '../js/steak3d.js';

const TAU = Math.PI * 2;
const SIZE = 320;
const log = m => { document.getElementById('log').textContent += m + '\n'; };

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('view').appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;

function makeScene() {
  const scene = new THREE.Scene();
  scene.environment = envTex; scene.environmentIntensity = .45;
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x2a1208, .45));
  const key = new THREE.DirectionalLight(0xffe2c4, 1.6); key.position.set(3, 7, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); key.shadow.radius = 5; key.shadow.bias = -.001;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9a55, 1.3); rim.position.set(-4, 3, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xffb27a, 2.2, 10, 1.6); fill.position.set(0, 1.4, 3.4); scene.add(fill);
  return scene;
}

/* ---------- shared materials / helpers ---------- */
const woodTex = new THREE.CanvasTexture(paintWood()); woodTex.colorSpace = THREE.SRGBColorSpace;
const boneTex = new THREE.CanvasTexture(paintBone()); boneTex.colorSpace = THREE.SRGBColorSpace;
const M = {
  board: () => { const m = new THREE.MeshStandardMaterial({ map: woodTex, roughness: .8, color: 0x8a6a55 }); return m; },
  bone: () => new THREE.MeshStandardMaterial({ map: boneTex, color: 0xc4a07c, roughness: .6 }),
  std: (c, r = .5, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r }, extra)),
  phys: (c, extra = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color: c }, extra)),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .04, metalness: 0, transmission: 1, thickness: .08, ior: 1.45, transparent: true, opacity: 1, clearcoat: 1 }),
  ceramic: (c = 0xf4efe6) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .25, clearcoat: .6 }),
  iron: () => new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: .55, metalness: .7 })
};
const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

function board(r = 2.05) {
  const BT = .16, prof = [new THREE.Vector2(0, -BT)];
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI; prof.push(new THREE.Vector2(r + Math.cos(a) * .07, -BT / 2 + Math.sin(a) * BT / 2)); }
  prof.push(new THREE.Vector2(0, 0));
  const g = new THREE.LatheGeometry(prof, 72), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (r * 2.1) + .5, p.getZ(i) / (r * 2.1) + .5);
  const m = new THREE.Mesh(g, M.board()); m.position.y = -.2; m.receiveShadow = true; return m;
}
function plate(r = 1.9, color = 0xf4efe6) {
  const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(r * .7, 0), new THREE.Vector2(r * .78, .05), new THREE.Vector2(r, .16), new THREE.Vector2(r * 1.02, .2), new THREE.Vector2(r * .98, .21), new THREE.Vector2(r * .76, .09), new THREE.Vector2(0, .06)];
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M.ceramic(color)); m.position.y = -.24; m.receiveShadow = true; return m;
}
function skillet(r = 1.75) {
  const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r + .08, .3), new THREE.Vector2(r - .02, .32), new THREE.Vector2(r - .1, .07), new THREE.Vector2(0, .07)];
  const g = new THREE.Group();
  const pan = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M.iron()); pan.position.y = -.24; g.add(pan);
  const woodBase = new THREE.Mesh(new THREE.CylinderGeometry(r + .35, r + .35, .14, 64), M.board()); woodBase.position.y = -.32; g.add(woodBase);
  return shadowed(g);
}

/* ---------- simple procedural textures ---------- */
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function speckle(ctx, w, h, n, colors, rmax = 2, seed = 1) { const r = rng(seed); for (let i = 0; i < n; i++) { ctx.fillStyle = colors[(r() * colors.length) | 0]; ctx.beginPath(); ctx.arc(r() * w, r() * h, .5 + r() * rmax, 0, TAU); ctx.fill(); } }
const blotchTex = (base, spots, n = 1600, seed = 3) => canvasTex(256, 256, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); speckle(c, w, h, n, spots, 3, seed); });

/* ---------- steak (uses the real steak painter) ---------- */
async function steak(key, opt = {}) {
  const shape = Object.assign({}, SHAPES[key], opt.shape || {});
  let maxR = 0; for (let i = 0; i < 360; i++) maxR = Math.max(maxR, shape.R(i / 360 * TAU));
  const span = maxR * 2.08 + (shape.bend || 0) * 2;
  const t = await paintSteak(shape, span, 512);
  const map = new THREE.CanvasTexture(t.col); map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: new THREE.CanvasTexture(t.bump), bumpScale: 4, roughnessMap: new THREE.CanvasTexture(t.rough), roughness: 1 });
  const g = new THREE.Group(); g.add(new THREE.Mesh(steakGeometry(shape, span, 120, 48), mat));
  g.userData.maxR = maxR;
  return g;
}
async function steakFromShape(shape) {
  let maxR = 0; for (let i = 0; i < 360; i++) maxR = Math.max(maxR, shape.R(i / 360 * TAU));
  const span = maxR * 2.08;
  const t = await paintSteak(shape, span, 384);
  const map = new THREE.CanvasTexture(t.col); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(steakGeometry(shape, span, 90, 36), new THREE.MeshStandardMaterial({ map, bumpMap: new THREE.CanvasTexture(t.bump), bumpScale: 3, roughnessMap: new THREE.CanvasTexture(t.rough), roughness: 1 }));
}

/* ---------- blob (sauce / cheese / chicken) ---------- */
function blob(rx, ry, rz, mat, seed = 1, wob = .12) {
  const g = new THREE.SphereGeometry(1, 48, 32), p = g.attributes.position, r = rng(seed);
  const k = [r() * 6, r() * 6, r() * 6];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + wob * (Math.sin(x * 3 + k[0]) * Math.sin(z * 3.4 + k[1]) + .5 * Math.sin(y * 5 + k[2]));
    p.setXYZ(i, x * rx * n, Math.max(y, -.15) * ry * n, z * rz * n);
  }
  g.computeVertexNormals(); return new THREE.Mesh(g, mat);
}

/* ---------- dish builders ---------- */
const sauceMat = c => M.phys(c, { roughness: .25, clearcoat: .8, clearcoatRoughness: .2 });
const CHEESE = () => sauceMat(0xf2b13a), BBQ = () => sauceMat(0x5a1608);

async function ribSlab(len = 2.2, wid = 1.1, nb = 4) {
  const shape = { H: .42, seed: 140 + nb, marb: 0, fat: [], grill: [[.5, .35]], period: .5, char: .9,
    pal: { light: [120, 36, 18], mid: [84, 22, 10], deep: [46, 12, 6], line: [30, 8, 4], char: [20, 6, 3], edge: [70, 18, 8] },
    R: th => { const a = len / 2, b = wid / 2, c = Math.cos(th), s = Math.sin(th); const n = 6; return 1 / Math.pow(Math.pow(Math.abs(c) / a, n) + Math.pow(Math.abs(s) / b, n), 1 / n) * (1 + .03 * Math.sin(5 * th)); } };
  const g = new THREE.Group();
  const slab = await steakFromShape(shape); slab.material.roughness = .45; slab.material.metalness = .05; g.add(slab);
  for (let i = 0; i < nb; i++) {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .55, 16), M.bone());
    bone.rotation.x = Math.PI / 2; bone.position.set(-len / 2 + .3 + i * (len - .6) / (nb - 1), -.04, wid / 2 + .12); g.add(bone);
  }
  const glaze = blob(len * .42, .05, wid * .38, BBQ(), nb, .05); glaze.position.y = .2; g.add(glaze);
  return g;
}
// brisket slice face: black peppery bark on top, red smoke ring, juicy brown-pink meat with horizontal grain
function sliceTex(seed) {
  return canvasTex(256, 128, (c, w, h) => {
    const r = rng(seed);
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#120804'); grd.addColorStop(.16, '#1e0e08'); grd.addColorStop(.2, '#7a2418'); grd.addColorStop(.32, '#a8483a');
    grd.addColorStop(.5, '#b07462'); grd.addColorStop(.85, '#9c6250'); grd.addColorStop(.92, '#6a2a1c'); grd.addColorStop(1, '#2a1208');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.globalAlpha = .18; for (let i = 0; i < 70; i++) { const y = h * (.25 + r() * .62); c.strokeStyle = r() > .5 ? '#f2d6c4' : '#5a2418'; c.lineWidth = .6 + r() * 1.4; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * .3, y + (r() - .5) * 8, w * .7, y + (r() - .5) * 8, w, y + (r() - .5) * 6); c.stroke(); }
    c.globalAlpha = 1; speckle(c, w, h * .18, 260, ['#000', '#3a2a20', '#5a4030'], 1.6, seed);
  });
}
function brisketSlices(n = 5) {
  const g = new THREE.Group(), tex = sliceTex(9);
  const W = 1.55, Hs = .62, s = new THREE.Shape();
  const rr = .12; s.moveTo(-W / 2 + rr, -Hs / 2); s.lineTo(W / 2 - rr, -Hs / 2); s.quadraticCurveTo(W / 2, -Hs / 2, W / 2, -Hs / 2 + rr); s.lineTo(W / 2, Hs / 2 - .05); s.quadraticCurveTo(0, Hs / 2 + .08, -W / 2, Hs / 2 - .05); s.lineTo(-W / 2, -Hs / 2 + rr); s.quadraticCurveTo(-W / 2, -Hs / 2, -W / 2 + rr, -Hs / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2 });
  tex.repeat.set(1 / W, 1 / Hs); tex.offset.set(.5, .5);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: .5 }), barkMat = M.std(0x1a0c06, .85);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, [faceMat, barkMat]);
    // shingled slices leaning back, like brisket fanned out on a carving board
    const t = n > 1 ? i / (n - 1) : .5;
    m.position.set(-.55 + t * 1.1, .12, .55 - t * 1.1); m.rotation.set(-1.05, .1 + t * .1, 0);
    g.add(m);
  }
  return g;
}
function sausageCoins(n, x0, z0) {
  const g = new THREE.Group(), face = new THREE.MeshStandardMaterial({ map: blotchTex('#b8443a', ['#e9c0a0', '#7a1e18', '#f0d4bc'], 900, 4), roughness: .5 }), side = M.std(0x6a1810, .4);
  for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .08, 32), [side, face, face]); c.position.set(x0 + i * .3, -.08 + i * .03, z0 + (i % 2) * .1); c.rotation.z = -.25; g.add(c); }
  return g;
}
function pickle(x, z, rot = 0) { const p = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .55, 8, 16), M.phys(0x6f8a2a, { roughness: .35, clearcoat: .5 })); p.rotation.set(0, rot, Math.PI / 2); p.position.set(x, -.06, z); return p; }
function chickenThigh(seed, sx = 1) {
  const shape = { H: .42, seed, marb: 0, fat: [], grill: [[.7, 1]], period: .32, char: .6,
    pal: { light: [196, 120, 52], mid: [160, 86, 34], deep: [110, 52, 20], line: [50, 22, 10], char: [34, 14, 6], edge: [150, 80, 30] },
    R: th => ellipseR(.85 * sx, .6, th) + .06 * Math.sin(3 * th + seed) };
  return steakFromShape(shape);
}
async function fishFillet(len = 2.3) {
  const shape = { H: .3, seed: 61, marb: 0, fat: [], grill: [[.9, .8]], period: .3, char: .35,
    pal: { light: [214, 132, 58], mid: [186, 98, 40], deep: [130, 56, 22], line: [70, 30, 12], char: [50, 20, 8], edge: [170, 92, 40] },
    R: th => ellipseR(len / 2, .5, th) * (1 - .35 * gauss(th, 0, .5)) };
  return steakFromShape(shape);
}
function calamariRing(x, z, ry = 0) { const t = new THREE.Mesh(new THREE.TorusGeometry(.3, .1, 16, 40), new THREE.MeshStandardMaterial({ map: blotchTex('#d99a44', ['#b0702a', '#f0c070', '#8a4a18'], 800, 7), roughness: .7 })); t.rotation.set(Math.PI / 2 - .2, 0, ry); t.position.set(x, -.04, z); return t; }
function shrimp(x, z, ry = 0) { const t = new THREE.Mesh(new THREE.TorusGeometry(.22, .09, 14, 30, Math.PI * 1.5), M.phys(0xe8703a, { roughness: .4, clearcoat: .5 })); t.rotation.set(Math.PI / 2, 0, ry); t.position.set(x, .02, z); return t; }
function corn(x, z, ry = 0) {
  const g = new THREE.CylinderGeometry(.22, .22, 1, 24, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i); const k = 1 + .06 * Math.abs(Math.sin(a * 7)) * Math.abs(Math.sin(y * 18)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: blotchTex('#e8b632', ['#7a3a10', '#3a1a08', '#f6d060'], 1200, 8), roughness: .45 }));
  m.rotation.set(0, ry, Math.PI / 2); m.position.set(x, 0, z); return m;
}
function mushroomSlice(x, z, ry, s = 1) {
  const shape = new THREE.Shape(); shape.absarc(0, .18, .3, 0, Math.PI, false); shape.lineTo(-.08, .18); shape.lineTo(-.08, -.15); shape.lineTo(.08, -.15); shape.lineTo(.08, .18); shape.lineTo(.3, .18);
  const g = new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2 });
  const m = new THREE.Mesh(g, M.std(0xcaa27a, .6)); m.rotation.set(-Math.PI / 2, 0, ry); m.scale.setScalar(s); m.position.set(x, .2, z); return m;
}
function strips(n, mats, area = [1.2, .8], y = .05, seed = 5, size = [.5, .07, .12]) {
  const g = new THREE.Group(), r = rng(seed);
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(...size.map(v => v * (.8 + r() * .5))), mats[(r() * mats.length) | 0]); m.position.set((r() - .5) * area[0] * 2, y + r() * .12, (r() - .5) * area[1] * 2); m.rotation.set(r() * .3, r() * TAU, r() * .3); g.add(m); }
  return g;
}

/* desserts */
function churros() {
  const g = new THREE.Group();
  const mk = () => { const geo = new THREE.CylinderGeometry(.26, .26, 2.3, 32, 1), p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = .82 + .18 * Math.abs(Math.cos(a * 4)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } geo.computeVertexNormals(); return geo; };
  const mat = new THREE.MeshPhysicalMaterial({ map: blotchTex('#a8581c', ['#e6c48e', '#c27a30', '#6a3010'], 700, 11), roughness: .55, clearcoat: .3 });
  [[-.45, .2, .5], [-.1, .45, .25], [.25, .3, -.05], [.05, .7, .4]].forEach(([x, y, r]) => { const c = new THREE.Mesh(mk(), mat); c.rotation.set(0, r, Math.PI / 2 - .12); c.position.set(x, y, x * .5); g.add(c); });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.42, .34, .38, 40, 1, true), M.ceramic()); cup.position.set(1.05, -.02, .55); g.add(cup);
  const choc = new THREE.Mesh(new THREE.CircleGeometry(.4, 40), sauceMat(0x3a1a0c)); choc.rotation.x = -Math.PI / 2; choc.position.set(1.05, .14, .55); g.add(choc);
  return g;
}
function trifle() {
  const g = new THREE.Group();
  const layers = [[0x4a2a1a, .3], [0xf3e0b0, .25], [0x2a1a10, .2], [0xf8e8c0, .3], [0xd8a050, .12]];
  let y = -.1;
  layers.forEach(([c, h], i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.82 - i * .015, .78, h, 48), M.phys(c, { roughness: .5 })); m.position.y = y + h / 2; y += h; g.add(m); });
  const cream = blob(.75, .28, .75, M.phys(0xfff8ec, { roughness: .6 }), 4, .08); cream.position.y = y + .05; g.add(cream);
  const nut = blob(.2, .12, .2, M.std(0xc0822a, .5), 2, .2); nut.position.set(.1, y + .3, 0); g.add(nut);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(.9, .82, y + .5, 48, 1, true), M.glass()); glass.position.y = (y + .5) / 2 - .1; g.add(glass);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.18, .5, .4, 32), M.glass()); stem.position.y = -.3; g.add(stem);
  return g;
}
function brulee() {
  const g = new THREE.Group();
  const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(1.18, .1), new THREE.Vector2(1.2, .6), new THREE.Vector2(1.1, .62), new THREE.Vector2(1.08, .15), new THREE.Vector2(0, .15)];
  const geo = new THREE.LatheGeometry(prof, 64), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), r = Math.hypot(p.getX(i), p.getZ(i)); if (r > 1.1) { const k = 1 + .03 * Math.cos(a * 24); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
  geo.computeVertexNormals();
  const ram = new THREE.Mesh(geo, M.ceramic(0xfaf6ee)); ram.position.y = -.2; g.add(ram);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.08, 64), new THREE.MeshPhysicalMaterial({ map: canvasTex(256, 256, (c, w, h) => { const grd = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); grd.addColorStop(0, '#e0a040'); grd.addColorStop(.7, '#c27020'); grd.addColorStop(1, '#6a3008'); c.fillStyle = grd; c.fillRect(0, 0, w, h); speckle(c, w, h, 500, ['#3a1806', '#f0c060'], 4, 6); }), roughness: .2, clearcoat: 1 }));
  top.rotation.x = -Math.PI / 2; top.position.y = .33; g.add(top);
  return g;
}

/* drinks */
function drink(kind, color, opts = {}) {
  const g = new THREE.Group();
  if (kind === 'tall') {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(.62, .52, 2.3, 48, 1, true), M.glass()); glass.position.y = .9; g.add(glass);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .12, 48), M.glass()); base.position.y = -.2; g.add(base);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(.57, .5, 1.85, 48), M.phys(color, { roughness: .1, transmission: .45, thickness: .6, transparent: true })); liq.position.y = .7; g.add(liq);
    if (opts.layer) { const l2 = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .6, 48), M.phys(opts.layer, { roughness: .1, transmission: .3, thickness: .5 })); l2.position.y = .05; g.add(l2); }
    const r = rng(opts.seed || 1);
    for (let i = 0; i < 4; i++) { const ice = new THREE.Mesh(new THREE.BoxGeometry(.32, .32, .32), M.phys(0xffffff, { roughness: .05, transmission: .9, thickness: .3 })); ice.position.set((r() - .5) * .5, 1.4 + r() * .2, (r() - .5) * .5); ice.rotation.set(r(), r(), r()); g.add(ice); }
    if (opts.garnish) { const lem = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .06, 32), M.phys(opts.garnish, { roughness: .3 })); lem.rotation.set(Math.PI / 2, 0, .3); lem.position.set(.45, 1.95, .1); g.add(lem); }
    if (opts.mint) { for (let i = 0; i < 3; i++) { const leaf = blob(.18, .03, .1, M.std(0x2f8a3a, .4), i + 3, .1); leaf.position.set(-.1 + i * .12, 1.75, -.05 + i * .05); leaf.rotation.set(.4, i, .3); g.add(leaf); } }
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.4, 12), M.std(opts.straw || 0x1a1a1a, .4)); straw.position.set(-.2, 1.5, .1); straw.rotation.z = .25; g.add(straw);
  } else if (kind === 'smoothie') {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(.6, .45, 2, 48, 1, true), M.glass()); glass.position.y = .8; g.add(glass);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(.57, .43, 1.8, 48), M.phys(color, { roughness: .6 })); liq.position.y = .72; g.add(liq);
    const top = blob(.55, .18, .55, M.phys(color, { roughness: .6 }), 3, .1); top.position.y = 1.64; g.add(top);
    const fruit = blob(.18, .16, .18, M.phys(opts.fruit || color, { roughness: .3, clearcoat: .6 }), 5, .1); fruit.position.set(.25, 1.85, 0); g.add(fruit);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.4, 12), M.std(0xf2f2f2, .4)); straw.position.set(-.2, 1.5, .1); straw.rotation.z = .25; g.add(straw);
  } else if (kind === 'frapp') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.62, .45, 1.9, 48, 1, true), M.glass()); cup.position.y = .75; g.add(cup);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(.59, .43, 1.75, 48), M.phys(color, { roughness: .5 })); liq.position.y = .7; g.add(liq);
    for (let i = 0; i < 3; i++) { const w = blob(.55 - i * .14, .2, .55 - i * .14, M.phys(0xfffaf0, { roughness: .7 }), i + 1, .08); w.position.y = 1.65 + i * .22; g.add(w); }
    const dr = new THREE.Mesh(new THREE.TorusGeometry(.32, .03, 8, 40), sauceMat(opts.drizzle || 0x7a3a10)); dr.rotation.x = Math.PI / 2; dr.position.y = 1.95; g.add(dr);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.4, 12), M.std(0x2a7a3a, .4)); straw.position.set(.15, 1.8, 0); straw.rotation.z = -.15; g.add(straw);
  } else if (kind === 'cup' || kind === 'espresso') {
    const s = kind === 'espresso' ? .7 : 1;
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(1.15 * s, .9 * s, .1, 48), M.ceramic(0xfaf6ee)); saucer.position.y = -.18; g.add(saucer);
    const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(.42, 0), new THREE.Vector2(.62, .2), new THREE.Vector2(.72, .85), new THREE.Vector2(.68, .86), new THREE.Vector2(.58, .2), new THREE.Vector2(0, .1)];
    const cup = new THREE.Mesh(new THREE.LatheGeometry(prof.map(v => v.clone().multiplyScalar(s)), 48), M.ceramic(0xfaf6ee)); cup.position.y = -.13; g.add(cup);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.22 * s, .06 * s, 12, 24, Math.PI * 1.3), M.ceramic(0xfaf6ee)); handle.position.set(.72 * s, .32 * s, 0); handle.rotation.z = -Math.PI * .65; g.add(handle);
    const top = new THREE.Mesh(new THREE.CircleGeometry(.66 * s, 48), new THREE.MeshPhysicalMaterial({ map: canvasTex(256, 256, (c, w, h) => { const grd = c.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2); grd.addColorStop(0, opts.foam || '#c48a52'); grd.addColorStop(.75, color); grd.addColorStop(1, '#2a140a'); c.fillStyle = grd; c.fillRect(0, 0, w, h); if (opts.art) { c.strokeStyle = '#f4e4cc'; c.lineWidth = 9; c.beginPath(); c.arc(w / 2, h / 2 + 20, 40, Math.PI, 0); c.stroke(); c.beginPath(); c.moveTo(w / 2, h / 2 + 20); c.lineTo(w / 2, h / 2 - 50); c.stroke(); } }), roughness: .3, clearcoat: .6 }));
    top.rotation.x = -Math.PI / 2; top.position.y = .7 * s; g.add(top);
  } else if (kind === 'bottle') {
    const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(.5, 0), new THREE.Vector2(.52, .1), new THREE.Vector2(.52, 1.5), new THREE.Vector2(.3, 2.0), new THREE.Vector2(.16, 2.3), new THREE.Vector2(.16, 2.6), new THREE.Vector2(0, 2.6)];
    const b = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M.phys(color, { roughness: .08, transmission: opts.clear ? .95 : .6, thickness: .4, clearcoat: 1 })); b.position.y = -.2; g.add(b);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .16, 24), M.std(opts.cap || 0xd0d0d0, .3, { metalness: .8 })); cap.position.y = 2.46; g.add(cap);
    if (opts.label) { const lab = new THREE.Mesh(new THREE.CylinderGeometry(.53, .53, .55, 48, 1, true), M.std(opts.label, .5)); lab.position.y = .65; g.add(lab); }
  } else if (kind === 'can') {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 1.6, 48), M.std(color, .25, { metalness: .6 })); can.position.y = .6; g.add(can);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.44, .5, .12, 48), M.std(0xd8d8d8, .2, { metalness: 1 })); top.position.y = 1.46; g.add(top);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.505, .505, .3, 48, 1, true), M.std(opts.band || 0xffffff, .4)); band.position.y = .7; g.add(band);
  }
  return g;
}

/* ---------- recipes per menu item ---------- */
const SIDE = { coaster: r => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .1, 64), M.board()); m.position.y = -.27; m.receiveShadow = true; return m; } };
const R = {
  // West Texas
  ribeye: async () => ({ base: board(), food: await steak('ribeye') }),
  tomahawk: async () => { const s = await steak('tomahawk'); const len = 2.1, bone = new THREE.Mesh(new THREE.CylinderGeometry(.13, .17, len, 24), M.bone()); bone.rotation.z = -Math.PI / 2; bone.scale.set(1, 1, .62); bone.position.set(.8 + len / 2, -.06, -.1); const knob = new THREE.Mesh(new THREE.SphereGeometry(.18, 20, 14), M.bone()); knob.scale.set(.8, .8, .7); knob.position.set(.8 + len, -.06, -.1); s.add(bone, knob); s.position.x = -.75; s.rotation.y = .55; return { base: board(), food: s, dist: 9.6 }; },
  picanha: async () => { const g = new THREE.Group(); for (let k = 0; k < 3; k++) { const s = await steakFromShape(SHAPES.picanha); s.rotation.set(0, k * .3, Math.PI / 2); s.position.set(-.75 + k * .75, .2, 0); s.scale.set(1, 1.5, 1.1); g.add(s); } const rod = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 3.6, 12), M.std(0xd8d8d8, .25, { metalness: 1 })); rod.rotation.z = Math.PI / 2; rod.position.y = .2; g.add(rod); return { base: board(), food: g }; },
  hanger: async () => ({ base: board(), food: await steak('hanger') }),
  sirloin: async () => ({ base: board(), food: await steak('sirloin') }),
  rump: async () => ({ base: board(), food: await steak('rump') }),
  // East Texas
  tbone: async () => ({ base: board(), food: await steak('tbone') }),
  cheese: async () => { const s = await steak('rump'); const c = blob(.75, .14, .55, CHEESE(), 2); c.position.y = .26; s.add(c); return { base: skillet(), food: s }; },
  philly: async () => { const g = new THREE.Group(); g.add(strips(16, [M.std(0x5a2a14, .6), M.std(0x6e3a1c, .6)], [1.1, .8], .0, 7, [.6, .08, .16])); g.add(strips(8, [M.phys(0xefe2c6, { roughness: .4 })], [1, .7], .1, 9, [.5, .04, .05])); const c = blob(.9, .1, .6, CHEESE(), 5, .2); c.position.y = .2; g.add(c); return { base: skillet(), food: g, keepBase: true }; },
  pepper: async () => { const s = await steak('sirloin'); const sauce = blob(.6, .08, .4, sauceMat(0x6a3a1a), 3); sauce.position.y = .22; s.add(sauce); const r = rng(3); for (let i = 0; i < 18; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), M.std(0x1a1008, .6)); p.position.set((r() - .5) * 1, .3, (r() - .5) * .6); s.add(p); } return { base: skillet(), food: s }; },
  mushroom: async () => { const s = await steak('hanger'); const sauce = blob(.7, .07, .3, sauceMat(0x8a6040), 7); sauce.position.y = .22; s.add(sauce); for (let i = 0; i < 6; i++) s.add(mushroomSlice(-.7 + i * .28, (i % 2) * .15 - .05, i, .7)); return { base: skillet(), food: s }; },
  // Smokehouse
  broncho: async () => { const g = new THREE.Group(); const a = await ribSlab(2.2, 1, 4); a.position.set(-.1, 0, -.45); a.rotation.y = .15; const b = await ribSlab(2, .95, 4); b.position.set(.15, .05, .55); b.rotation.y = -.1; g.add(a, b); return { base: board(), food: g }; },
  shortFull: async () => { const g = await ribSlab(2.4, 1.3, 4); return { base: board(), food: g }; },
  shortHalf: async () => { const g = await ribSlab(1.5, 1.2, 2); return { base: board(), food: g }; },
  austin: async () => { const g = await ribSlab(2.3, .9, 2); g.rotation.y = .3; return { base: board(), food: g }; },
  brisket500: async () => ({ base: board(), food: brisketSlices(4) }),
  brisket1000: async () => ({ base: board(), food: brisketSlices(6) }),
  duo: async () => { const g = new THREE.Group(); const b = brisketSlices(4); b.position.set(-.3, 0, -.5); b.scale.setScalar(.8); g.add(b); const r = await ribSlab(1.4, .8, 3); r.position.set(.4, 0, .55); r.scale.setScalar(.8); g.add(r); g.add(sausageCoins(4, -1.3, .5)); g.add(pickle(1.2, -.4, .5)); g.add(pickle(1.3, -.1, .3)); return { base: board(), food: g }; },
  // Surf & turf
  surf: async () => { const g = new THREE.Group(); const f = await fishFillet(2); f.position.set(-.5, 0, -.3); f.rotation.y = .3; g.add(f); const m = await steak('rump'); m.scale.setScalar(.45); m.position.set(.8, .02, -.45); g.add(m); const m2 = await steak('ribeye'); m2.scale.setScalar(.42); m2.position.set(1.1, .02, .35); g.add(m2); g.add(calamariRing(-.2, .7), calamariRing(.25, .8, 1), shrimp(-.9, .6, 2)); g.add(corn(.3, .2, .8)); return { base: board(), food: g }; },
  surfjr: async () => { const g = new THREE.Group(); const f = await fishFillet(1.8); f.position.set(-.4, 0, -.2); f.rotation.y = .4; g.add(f); const m = await steak('rump'); m.scale.setScalar(.42); m.position.set(.9, .02, -.2); g.add(m); g.add(calamariRing(.1, .7), shrimp(-.7, .6, 1)); return { base: board(), food: g }; },
  pescado: async () => { const g = new THREE.Group(); const f = await fishFillet(2.4); g.add(f); const c = blob(.7, .1, .3, CHEESE(), 9, .25); c.position.set(.3, .25, 0); g.add(c); g.add(shrimp(.1, .05, 1)); g.children.at(-1).position.y = .35; return { base: skillet(), food: g }; },
  // Tex-Mex & birds
  fajitas: async () => { const g = new THREE.Group(); g.add(strips(22, [M.std(0x5a2a14, .55), M.std(0x6e3a1c, .55), M.std(0x4a2210, .55)], [1.15, 1.0], .0, 3, [.6, .1, .16])); g.add(strips(14, [M.phys(0xc82a1a, { roughness: .3 }), M.phys(0x3a8a2a, { roughness: .3 }), M.phys(0xe8b020, { roughness: .3 })], [1.1, .9], .12, 6, [.55, .05, .12])); return { base: skillet(), food: g, keepBase: true }; },
  rusty: async () => { const g = new THREE.Group(); const a = await chickenThigh(21, 1); a.position.set(-.45, 0, -.2); a.rotation.y = .4; const b = await chickenThigh(33, .9); b.position.set(.55, 0, .3); b.rotation.y = -.5; g.add(a, b); return { base: board(), food: g }; },
  hangman: async () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const t = await chickenThigh(40 + i, .55); t.scale.set(1, 1.6, 1); t.rotation.z = Math.PI / 2; t.position.set(-.8 + i * .8, .25, 0); g.add(t); } const rod = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 3.4, 12), M.std(0xd8d8d8, .25, { metalness: 1 })); rod.rotation.z = Math.PI / 2; rod.position.y = .25; g.add(rod); const c = blob(.6, .1, .3, CHEESE(), 2, .3); c.position.set(0, .5, .1); g.add(c); return { base: board(), food: g }; },
  // Desserts
  churros: async () => ({ base: board(1.9), food: churros(), dist: 6.9 }),
  trifle: async () => ({ base: SIDE.coaster(1.3), food: trifle(), dist: 5.8, y: .55 }),
  brulee: async () => ({ base: plate(1.7), food: brulee(), dist: 7.6 })
};
// drinks
const DR = (kind, color, opts) => async () => ({ base: SIDE.coaster(1.2), food: drink(kind, color, opts), dist: kind === 'cup' || kind === 'espresso' ? 5.2 : 6.6, y: kind === 'cup' || kind === 'espresso' ? .25 : .9 });
Object.assign(R, {
  goblet: DR('tall', 0x6a2a14, { seed: 1, garnish: 0xf0b030, straw: 0x111111 }),
  bluemarg: DR('tall', 0x2a8ad8, { seed: 2, garnish: 0x9ad040, straw: 0xffffff }),
  colaberry: DR('tall', 0x5a0a1a, { seed: 3, straw: 0xd02040 }),
  island: DR('tall', 0x18a8d8, { seed: 4, layer: 0xf0c040, garnish: 0xf0d040 }),
  mangoberry: DR('tall', 0xf0a020, { seed: 5, layer: 0xd0203a, straw: 0xd0203a }),
  doudou: DR('tall', 0xf0d040, { seed: 6, garnish: 0xe03a1a }),
  applemint: DR('tall', 0xc8e070, { seed: 7, mint: true, garnish: 0x9ad040 }),
  night: DR('tall', 0x2a0a3a, { seed: 8, garnish: 0x6a1a8a }),
  strawmint: DR('tall', 0xe8344a, { seed: 9, mint: true }),
  icetea: DR('tall', 0xa0501a, { seed: 10, garnish: 0xf0d040 }),
  smoothie: DR('smoothie', 0xd8346a, { fruit: 0xe82a4a }),
  frapp: DR('frapp', 0xa86a3a, { drizzle: 0x6a3008 }),
  capp: DR('cup', '#a0602a', { foam: '#e8c89a', art: true }),
  latte: DR('cup', '#b07a4a', { foam: '#f0dcc0', art: true }),
  americano: DR('cup', '#3a1a0a', { foam: '#6a3a1a' }),
  espresso: DR('espresso', '#4a2210', { foam: '#c08a50' }),
  ginger: DR('bottle', 0xd8a840, { label: 0x1a4a2a, cap: 0xc0a040 }),
  cokezero: DR('can', 0x111111, { band: 0xd8202a }),
  imported: DR('can', 0xc81a1a, { band: 0xffffff }),
  sodawater: DR('bottle', 0xe8f4f0, { clear: true, label: 0x2a6ab0 }),
  soft: DR('bottle', 0x2a0a06, { label: 0xd8202a, cap: 0xd8202a }),
  water: DR('bottle', 0xdff0ff, { clear: true, label: 0x2a8ad8, cap: 0x2a8ad8 })
});

/* ---------- render one ---------- */
async function render(id) {
  const recipe = R[id]; if (!recipe) return null;
  const { base, food, keepBase = false } = await recipe();
  const scene = makeScene();
  // no plates / boards / coasters — only vessels that ARE the dish (skillets) are kept
  const subject = new THREE.Group(); shadowed(food); subject.add(food);
  if (keepBase && base) subject.add(base);
  scene.add(subject);
  // frame the dish automatically
  subject.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(subject), sphere = box.getBoundingSphere(new THREE.Sphere());
  const fov = 28, dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(fov / 2)) * 1.02;
  // soft contact shadow under the food only
  const sz = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.15;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(radialTex([[0, 'rgba(0,0,0,.45)'], [.45, 'rgba(0,0,0,.18)'], [1, 'rgba(0,0,0,0)']])), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.set(sphere.center.x, box.min.y + .005, sphere.center.z); scene.add(sh);
  const cam = new THREE.PerspectiveCamera(fov, 1, .1, 100);
  const el = .78; // ~45° down
  cam.position.set(sphere.center.x, sphere.center.y + Math.sin(el) * dist, sphere.center.z + Math.cos(el) * dist); cam.lookAt(sphere.center);
  renderer.render(scene, cam);
  const blob = await new Promise(r => renderer.domElement.toBlob(r, 'image/webp', .84));
  scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  return blob;
}

export async function renderAll(ids) {
  ids = ids || Object.keys(R);
  for (const id of ids) {
    const b = await render(id);
    if (!b) { log('skip ' + id); continue; }
    await fetch(`../assets/dishes3d/${id}.webp`, { method: 'PUT', body: b });
    log(`${id}: ${Math.round(b.size / 1024)} KB`);
    const img = new Image(); img.src = URL.createObjectURL(b); img.title = id; document.getElementById('grid').appendChild(img);
  }
  log('DONE'); window.done = true;
}
window.renderAll = renderAll;
window.RECIPES = Object.keys(R);
