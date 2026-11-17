/* =========================================================
   WOODHOUSE GRILL — 3D Steak Studio (three.js)
   Procedural steak geometry + procedurally painted textures.
   Performance: no shadow maps (baked contact shadow), capped
   pixel ratio, 30fps when idle, texture painting is time-sliced
   so it never blocks scrolling.
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// yield to the browser between work chunks (MessageChannel is not subject to timer throttling)
const yieldFrame = (() => {
  const ch = new MessageChannel(), q = [];
  ch.port1.onmessage = () => { const r = q.shift(); r && r(); };
  return () => new Promise(r => { q.push(r); ch.port2.postMessage(0); });
})();
const MOBILE = window.matchMedia('(max-width: 760px)').matches;

/* ---------------- cut shapes ---------------- */
function ellipseR(a, b, th) { const c = Math.cos(th), s = Math.sin(th); return (a * b) / Math.sqrt((b * c) ** 2 + (a * s) ** 2); }
const gauss = (th, c, w) => { const d = Math.atan2(Math.sin(th - c), Math.cos(th - c)); return Math.exp(-(d * d) / w); };
const segDist = (x, z, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, t = clamp01(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)); return Math.hypot(x - ax - vx * t, z - az - vz * t); };

// palettes (sRGB) — matched to real grilled steak: tan-brown crust, dark-brown (not black) grill lines
const CRUST = { light: [122, 72, 46], mid: [92, 50, 30], deep: [62, 31, 18], line: [34, 16, 9], char: [24, 12, 7], fat: [190, 142, 90], fatSear: [140, 86, 44], edge: [96, 48, 24] };

const SHAPES = {
  ribeye: { H: .34, seed: 11, marb: .7, fat: [[2.3, 3.6, .14]], grill: [[.62, 1], [-.95, .35]], period: .36,
    R: th => ellipseR(1.08, .86, th) + .1 * gauss(th, 2.6, .25) - .07 * gauss(th, 4.9, .2) + .03 * Math.sin(3 * th + 1) + .02 * Math.sin(5 * th + 2) },
  sirloin: { H: .3, seed: 23, marb: .3, fat: [[.35, 2.75, .13]], grill: [[.6, 1], [-.9, .35]], period: .36,
    R: th => ellipseR(1.38, .72, th) - .1 * gauss(th, 4.71, .5) + .025 * Math.sin(4 * th + .5) + .02 * Math.sin(7 * th) },
  rump: { H: .4, seed: 37, marb: .25, fat: [[3.9, 5.3, .1]], grill: [[.7, 1], [-.85, .4]], period: .38,
    R: th => ellipseR(1.12, .84, th) + .05 * gauss(th, .5, .3) + .03 * Math.sin(3 * th + 2) + .02 * Math.sin(6 * th + 1) },
  hanger: { H: .3, seed: 51, marb: .45, fat: [], grill: [[.9, 1], [-.6, .3]], period: .32, bend: .32, a: 1.6,
    R: th => ellipseR(1.6, .44, th) * (1 - .14 * gauss(th, 0, .3)) + .02 * Math.sin(5 * th) },
  tomahawk: { H: .5, seed: 67, marb: .8, fat: [[1.9, 4.4, .13]], grill: [[.62, 1], [-.95, .35]], period: .38,
    R: th => ellipseR(1.0, .86, th) + .06 * gauss(th, 2.8, .3) + .03 * Math.sin(3 * th) + .02 * Math.sin(5 * th + 1) },
  // T-bone modelled on the reference photo: broad body, bone flush with the meat,
  // the T's bar along the top edge and the stem running down between strip & tenderloin
  tbone: { H: .3, seed: 79, marb: .35, fat: [[5.4, 6.2, .1], [0, .9, .1]], grill: [[.5, 1], [-1.05, .45]], period: .34,
    R: th => ellipseR(1.32, 1.0, th) + .1 * gauss(th, 4.25, .22) - .12 * gauss(th, 1.9, .35) + .06 * gauss(th, 5.2, .15) + .025 * Math.sin(5 * th + .7),
    // returns [distance to bone, local half-width]
    bone: (x, z) => {
      const bar = Math.min(segDist(x, z, -1.08, -.42, -.62, -.66), segDist(x, z, -.62, -.66, -.12, -.8));
      const s1 = segDist(x, z, -.3, -.74, -.05, -.18), s2 = segDist(x, z, -.05, -.18, .22, .38), s3 = segDist(x, z, .22, .38, .5, .86);
      const stem = Math.min(s1, s2, s3);
      const taper = .07 - clamp01((z + .7) / 1.6) * .03;
      return bar < stem ? [bar, .09] : [stem, taper];
    } },
  picanha: { H: .34, seed: 97, marb: .1, fat: [], grill: [[.95, 1]], period: .3, char: .8, pal: { light: [130, 60, 36], mid: [100, 44, 26], deep: [62, 24, 14] },
    R: th => ellipseR(.62, .36, th) + .02 * Math.sin(4 * th) }
};

/* ---------------- noise fields (GPU up-scaling of random grids) ---------------- */
const canFilter = (() => { try { return 'filter' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();
function noiseField(size, cells, seed) {
  const r = rng(seed), c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high';
  let total = 0;
  cells.forEach(([n, w]) => {
    const s = document.createElement('canvas'); s.width = s.height = n; const sc = s.getContext('2d');
    const id = sc.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { const v = r() * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    sc.putImageData(id, 0, 0);
    total += w; ctx.globalAlpha = w / total;
    if (canFilter) ctx.filter = `blur(${(size / n) * .45}px)`;
    ctx.drawImage(s, -size / n, -size / n, size + 2 * size / n, size + 2 * size / n);
    if (canFilter) ctx.filter = 'none';
  });
  const d = ctx.getImageData(0, 0, size, size).data, out = new Float32Array(size * size);
  let mn = 1, mx = 0;
  for (let i = 0; i < out.length; i++) { const v = d[i * 4] / 255; out[i] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
  const k = 1 / Math.max(.001, mx - mn);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) * k;
  return out;
}

/* ---------------- steak texture painter (time-sliced) ---------------- */
async function paintSteak(shape, span, S) {
  const r = rng(shape.seed);
  const nLow = noiseField(S, [[5, 1], [10, .6], [20, .3]], shape.seed + 1); await yieldFrame();
  const nMid = noiseField(S, [[18, 1], [36, .55], [72, .3]], shape.seed + 2); await yieldFrame();
  const nHi = noiseField(S, [[64, 1], [128, .6], [256, .35]], shape.seed + 3); await yieldFrame();
  const nMarb = noiseField(S, [[14, 1], [30, .45]], shape.seed + 4); await yieldFrame();

  // R(θ) lookup — avoids evaluating the outline function per pixel
  const RN = 1024, RT = new Float32Array(RN);
  for (let i = 0; i < RN; i++) RT[i] = shape.R(i / RN * TAU);

  const col = new Uint8ClampedArray(S * S * 4), bump = new Uint8ClampedArray(S * S * 4), rough = new Uint8ClampedArray(S * S * 4);
  const P = shape.period, W = .07;
  const pal = Object.assign({}, CRUST, shape.pal || {});
  const charAmt = shape.char || .3;
  const grills = shape.grill.map(([a, s]) => [Math.cos(a), Math.sin(a), s]);

  let t0 = performance.now();
  for (let py = 0; py < S; py++) {
    if (performance.now() - t0 > 7) { await yieldFrame(); t0 = performance.now(); }
    const z = (py / S - .5) * span;
    for (let px = 0; px < S; px++) {
      const x = (px / S - .5) * span;
      const i = py * S + px, o = i * 4;
      const lo = nLow[i], mi = nMid[i], hi = nHi[i];
      let th = Math.atan2(z, x); if (th < 0) th += TAU;
      const rr = Math.sqrt(x * x + z * z) / RT[(th / TAU * RN) | 0];

      // tan / brown crust with mottling
      const t = clamp01(lo * .9 + mi * .35 - .15);
      let cr = t < .5 ? mix(pal.light[0], pal.mid[0], t * 2) : mix(pal.mid[0], pal.deep[0], t * 2 - 1);
      let cg = t < .5 ? mix(pal.light[1], pal.mid[1], t * 2) : mix(pal.mid[1], pal.deep[1], t * 2 - 1);
      let cb = t < .5 ? mix(pal.light[2], pal.mid[2], t * 2) : mix(pal.mid[2], pal.deep[2], t * 2 - 1);
      const fine = .84 + .32 * hi; cr *= fine; cg *= fine; cb *= fine;

      // subtle seared fat streaks
      const rid = 1 - Math.abs(2 * nMarb[i] - 1);
      const mb = smooth(.93, .99, rid) * shape.marb * (1 - smooth(.8, .9, rr)) * (.4 + .6 * hi);
      cr = mix(cr, pal.fat[0] * .85, mb * .45); cg = mix(cg, pal.fat[1] * .8, mb * .45); cb = mix(cb, pal.fat[2] * .75, mb * .45);

      // fat cap
      let fat = 0;
      for (const [a0, a1, wdt] of shape.fat) {
        const inArc = smooth(a0 - .15, a0 + .15, th) * (1 - smooth(a1 - .15, a1 + .15, th));
        fat = Math.max(fat, inArc * smooth(1 - wdt - .03, 1 - wdt + .03, rr + (mi - .5) * .05));
      }
      if (fat > 0) {
        const fs = clamp01(hi * .8 + lo * .4 - .15);
        cr = mix(cr, mix(pal.fat[0], pal.fatSear[0], fs), fat); cg = mix(cg, mix(pal.fat[1], pal.fatSear[1], fs), fat); cb = mix(cb, mix(pal.fat[2], pal.fatSear[2], fs), fat);
      }

      // T-bone: bone flush with the surface
      let bone = 0;
      if (shape.bone) {
        const [bd, bw] = shape.bone(x, z);
        bone = 1 - smooth(bw * .65, bw, bd + (hi - .5) * .025 + (mi - .5) * .02);
        const halo = (1 - smooth(bw, bw * 1.8, bd)) * (1 - bone);
        cr = mix(cr, pal.char[0] + 20, halo * .6); cg = mix(cg, pal.char[1] + 10, halo * .6); cb = mix(cb, pal.char[2] + 6, halo * .6);
        const bs = clamp01(hi * 1.1 + mi * .4 - .25);
        bone *= .55 + .45 * smooth(.2, .6, lo + (hi - .5) * .4); // partly covered by seared meat
        cr = mix(cr, mix(176, 118, bs), bone); cg = mix(cg, mix(146, 88, bs), bone); cb = mix(cb, mix(110, 56, bs), bone);
      }

      // char spots
      const ch = smooth(.74, .92, hi * .6 + (1 - lo) * .5) * charAmt * (1 - bone);
      cr = mix(cr, pal.char[0], ch); cg = mix(cg, pal.char[1], ch); cb = mix(cb, pal.char[2], ch);

      // grill marks: one strong direction + a fainter cross direction
      let g = 0;
      for (const [ca, sa, strength] of grills) {
        const u = (x * ca + z * sa) / P + .25;
        const f = u - Math.floor(u);
        const d = Math.abs(f - .5) * P + (mi - .5) * .035 + (hi - .5) * .012;
        g = Math.max(g, (1 - smooth(W * .2, W * .75, d)) * strength);
      }
      g *= smooth(.08, .45, lo * .6 + mi * .3 + hi * .3) * (.6 + .4 * hi) * (1 - smooth(.88, .97, rr)) * (1 - bone * .8);
      const gc = fat > .5 ? .6 : 1;
      cr = mix(cr, pal.line[0], g * gc); cg = mix(cg, pal.line[1], g * gc); cb = mix(cb, pal.line[2], g * gc);

      // crusty, slightly orange seared edge (the sides)
      const rim = smooth(.86, 1.0, rr) * (1 - fat * .6);
      cr = mix(cr, pal.edge[0] + lo * 50, rim * .8); cg = mix(cg, pal.edge[1] + lo * 26, rim * .8); cb = mix(cb, pal.edge[2] + lo * 12, rim * .8);

      col[o] = cr; col[o + 1] = cg; col[o + 2] = cb; col[o + 3] = 255;
      const bv = 128 + (hi - .5) * 80 + (mi - .5) * 40 - g * 60 + mb * 20 + bone * 40 + fat * 10;
      bump[o] = bump[o + 1] = bump[o + 2] = bv; bump[o + 3] = 255;
      const rv = 160 - smooth(.55, .85, lo) * 95 + g * 50 - fat * 50 - bone * 10;
      rough[o] = rough[o + 1] = rough[o + 2] = rv; rough[o + 3] = 255;
    }
  }
  const toCanvas = data => { const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').putImageData(new ImageData(data, S, S), 0, 0); return c; };
  const cCol = toCanvas(col), cBump = toCanvas(bump), cRough = toCanvas(rough);

  // cracked pepper & salt
  const cx = cCol.getContext('2d'), bx = cBump.getContext('2d');
  const inner = (px, py) => { const x = (px / S - .5) * span, z = (py / S - .5) * span; let th = Math.atan2(z, x); if (th < 0) th += TAU; return Math.sqrt(x * x + z * z) / RT[(th / TAU * RN) | 0] < .86; };
  const pepper = Math.round(S * S / 700), k = S / 1024;
  for (let n = 0; n < pepper; n++) {
    const x = r() * S, y = r() * S, rad = (.6 + r() * r() * 3) * k;
    if (!inner(x, y)) continue;
    cx.fillStyle = `rgba(${18 + r() * 20},${10 + r() * 8},6,${.7 + r() * .3})`;
    cx.beginPath(); cx.ellipse(x, y, rad, rad * (.6 + r() * .4), r() * 3, 0, TAU); cx.fill();
    bx.fillStyle = 'rgba(255,255,255,.5)'; bx.beginPath(); bx.arc(x, y, rad, 0, TAU); bx.fill();
  }
  for (let n = 0; n < pepper * .15; n++) {
    const x = r() * S, y = r() * S; if (!inner(x, y)) continue;
    cx.fillStyle = `rgba(250,236,210,${.4 + r() * .4})`; cx.fillRect(x, y, (.6 + r() * 1.4) * k, (.6 + r() * 1.4) * k);
  }
  return { col: cCol, bump: cBump, rough: cRough };
}

function paintBone() {
  const W = 128, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#b48c62'); g.addColorStop(.1, '#d8bf98'); g.addColorStop(.5, '#bf9a6c'); g.addColorStop(.82, '#7a4a26'); g.addColorStop(1, '#3a1a0c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rng(5);
  for (let i = 0; i < 320; i++) { const y = r() * H; ctx.fillStyle = `rgba(${60 + r() * 50},${30 + r() * 25},${10 + r() * 15},${(y / H) * .6 * r()})`; ctx.fillRect(r() * W, y, 1 + r() * 4, 1 + r() * 12); }
  return c;
}
function paintWood() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#3b2215'; ctx.fillRect(0, 0, S, S);
  const r = rng(404);
  for (let i = 0; i < 420; i++) {
    const y = r() * S, amp = 4 + r() * 18, f = .004 + r() * .01, ph = r() * 6;
    ctx.strokeStyle = r() > .5 ? `rgba(20,10,5,${.12 + r() * .25})` : `rgba(120,72,40,${.06 + r() * .14})`;
    ctx.lineWidth = .6 + r() * 2.4; ctx.beginPath();
    for (let x = 0; x <= S; x += 16) { const yy = y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * .3; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(12,6,3,.55)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * .43, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,100,60,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * .43 + 6, 0, TAU); ctx.stroke();
  return c;
}
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, s]) => grd.addColorStop(o, s));
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return c;
}

/* ---------------- steak geometry ---------------- */
function steakGeometry(shape, span, NT, NP) {
  const H = shape.H, e = .4, pos = [], uv = [];
  const r = rng(shape.seed + 9);
  const bumps = Array.from({ length: 14 }, () => [(r() - .5) * 1.8, (r() - .5) * 1.2, .15 + r() * .3, (r() - .5) * .07]);
  const surfBump = (x, z) => bumps.reduce((s, [bx, bz, w, h]) => s + h * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / (w * w)), 0);
  const push = (x, y, z) => { uv.push(x / span + .5, 1 - (z / span + .5)); pos.push(x, y, z + (shape.bend ? shape.bend * (x / shape.a) ** 2 : 0)); };
  for (let j = 0; j < NP; j++) {
    const ph = -Math.PI / 2 + (j + 1) * Math.PI / (NP + 1), c = Math.cos(ph), s = Math.sin(ph);
    const hz = Math.pow(Math.abs(c), e), vt = Math.sign(s) * Math.pow(Math.abs(s), e);
    for (let i = 0; i < NT; i++) {
      const th = i / NT * TAU;
      const R = shape.R(th) * (1 + .018 * Math.sin(7 * th + 2.5 * vt + shape.seed) + .012 * Math.sin(17 * th - 4 * vt) + .008 * Math.sin(31 * th + 6 * vt));
      const x = R * hz * Math.cos(th), z = R * hz * Math.sin(th);
      const top = Math.max(0, vt);
      let boneLift = 0;
      if (shape.bone && top > .5) { const [bd, bw] = shape.bone(x, z); boneLift = .02 * (1 - smooth(bw * .6, bw * 1.3, bd)); }
      push(x, H / 2 * vt + top * (.035 * (1 - hz * hz) + surfBump(x, z) + boneLift) - Math.max(0, -vt) * .01, z);
    }
  }
  push(0, -H / 2 - .01, 0); push(0, H / 2 + .035 + surfBump(0, 0), 0);
  const bot = NP * NT, topI = bot + 1, idx = [];
  for (let j = 0; j < NP - 1; j++) for (let i = 0; i < NT; i++) {
    const a = j * NT + i, b = j * NT + (i + 1) % NT, c = (j + 1) * NT + i, d = (j + 1) * NT + (i + 1) % NT;
    idx.push(a, c, b, b, c, d);
  }
  for (let i = 0; i < NT; i++) { idx.push(bot, i, (i + 1) % NT); idx.push(topI, (NP - 1) * NT + (i + 1) % NT, (NP - 1) * NT + i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ---------------- interior (cap) shader ---------------- */
const capVert = `
varying vec3 vLocal;
#include <clipping_planes_pars_vertex>
void main(){ vLocal = position; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const capFrag = `
uniform sampler2D uR; uniform float uRmax, uH, uBend, uA, uMarb, uGray;
uniform vec3 uCenter, uGrayCol, uCrust, uFat;
varying vec3 vLocal;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ return vn(p)*.55 + vn(p*2.1+7.3)*.3 + vn(p*4.3+1.7)*.15; }
void main(){
  vec3 p = vLocal;
  float zu = p.z - uBend * pow(p.x / uA, 2.0);
  float th = atan(zu, p.x); if (th < 0.0) th += 6.2831853;
  float R = texture2D(uR, vec2(th / 6.2831853, 0.5)).r * uRmax;
  float rho = length(vec2(p.x, zu)) / R;
  float yr = abs(p.y) / (uH * 0.5);
  float dist = max(0.0, min((1.0 - rho) * R, (1.0 - yr) * uH * 0.5));
  float n1 = fbm(p.zy * vec2(6.0, 9.0));
  float n2 = vn(p.zy * vec2(70.0, 90.0));
  float core = smoothstep(0.015, 0.12, dist);
  vec3 col = mix(mix(uCenter, uGrayCol, 0.3), uCenter, core) * (0.9 + 0.14 * n1 + 0.05 * n2);
  float g = 1.0 - smoothstep(uGray * 0.45, uGray + 0.008, dist + (n1 - 0.5) * 0.01);
  col = mix(col, uGrayCol * (0.88 + 0.2 * n2), g);
  // fine intramuscular fat: thin, soft, sparse
  float rib = 1.0 - abs(2.0 * fbm(p.zy * vec2(5.0, 7.5) + 3.7) - 1.0);
  float m = smoothstep(0.955, 0.995, rib) * uMarb * smoothstep(0.015, 0.035, dist);
  col = mix(col, uFat, m * 0.45);
  // muscle grain
  col *= 0.95 + 0.05 * sin(p.z * 160.0 + n1 * 10.0 + p.y * 24.0);
  float c = 1.0 - smoothstep(0.004, 0.016, dist + (n2 - 0.5) * 0.006);
  col = mix(col, uCrust * (0.85 + 0.3 * n2), c);
  col *= 0.86 + 0.18 * smoothstep(-uH * 0.5, uH * 0.5, p.y);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// building blocks reused by tools/dish-renderer.js (offline menu renders)
export { paintSteak, steakGeometry, SHAPES, paintWood, paintBone, radialTex, ellipseR, gauss, rng };
export const DONENESS = [
  { name: 'Rare', temp: '50°C', center: '#a3323d', gray: .006 },
  { name: 'Medium Rare', temp: '55°C', center: '#c05358', gray: .013 },
  { name: 'Medium', temp: '60°C', center: '#c67a74', gray: .028 },
  { name: 'Medium Well', temp: '65°C', center: '#ab887a', gray: .055 },
  { name: 'Well Done', temp: '70°C+', center: '#8a6b5c', gray: .4 }
];

/* =========================================================
   STUDIO
   ========================================================= */
export function createStudio(container) {
  const DPR = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.25 : 1.5);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;
  scene.environmentIntensity = .35;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 4.1, 6.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.enableZoom = false; controls.enablePan = false;
  controls.minPolarAngle = .45; controls.maxPolarAngle = 1.32; controls.rotateSpeed = .7;
  controls.target.set(0, .15, 0);
  // phones: vertical swipes scroll the page, horizontal swipes rotate the steak
  renderer.domElement.style.touchAction = 'pan-y';

  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x2a1208, .35));
  const key = new THREE.DirectionalLight(0xffe2c4, 1.35); key.position.set(3.2, 6, 3.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff8a44, 1.5); rim.position.set(-4, 2.4, -4.5); scene.add(rim);
  const fire = new THREE.PointLight(0xff9a5a, 3, 9, 1.6); fire.position.set(.4, .6, 3.2); scene.add(fire);
  const top = new THREE.SpotLight(0xfff3e4, 3, 12, .45, .9, 1.5); top.position.set(-1.2, 6, 1.2); scene.add(top, top.target);

  // board
  const wood = new THREE.CanvasTexture(paintWood()); wood.colorSpace = THREE.SRGBColorSpace; wood.anisotropy = 4;
  const BR = 2.05, BT = .16, prof = [new THREE.Vector2(0, -BT)];
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI; prof.push(new THREE.Vector2(BR + Math.cos(a) * .07, -BT / 2 + Math.sin(a) * BT / 2)); }
  prof.push(new THREE.Vector2(0, 0));
  const boardGeo = new THREE.LatheGeometry(prof, 72);
  const bp = boardGeo.attributes.position, buv = boardGeo.attributes.uv;
  for (let i = 0; i < bp.count; i++) buv.setXY(i, bp.getX(i) / (BR * 2.1) + .5, bp.getZ(i) / (BR * 2.1) + .5);
  const board = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ map: wood, roughness: .8, color: 0x7a5a48 }));
  board.position.y = -.2; scene.add(board);

  // baked contact shadow (cheap replacement for shadow maps)
  const shadowTex = new THREE.CanvasTexture(radialTex([[0, 'rgba(0,0,0,.75)'], [.45, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]));
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.195; shadow.renderOrder = 1; scene.add(shadow);

  const stage = new THREE.Group(); scene.add(stage);

  // steam
  const steamTex = new THREE.CanvasTexture(radialTex([[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']]));
  const steam = [];
  for (let i = 0; i < (MOBILE ? 6 : 10); i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0xfff1e6, transparent: true, opacity: 0, depthWrite: false }));
    m.userData = { life: Math.random() * 3, max: 2.4 + Math.random() * 1.6, x: 0, z: 0, s: 0 }; steam.push(m); scene.add(m);
  }

  const boneTex = new THREE.CanvasTexture(paintBone()); boneTex.colorSpace = THREE.SRGBColorSpace;
  const boneMat = new THREE.MeshStandardMaterial({ map: boneTex, color: 0xc4a07c, roughness: .62 });

  const cache = {}, building = {};
  let current = null, currentKey = null, sliced = false, doneness = 1, busy = false, pending = null;
  let activeUntil = 0, visible = false, raf = null, lastRender = 0;
  const wake = (ms = 1500) => { activeUntil = Math.max(activeUntil, performance.now() + ms); loop(); };

  async function buildModel(key) {
    if (cache[key]) return cache[key];
    if (building[key]) return building[key];
    building[key] = (async () => {
      const shape = SHAPES[key];
      let maxR = 0; for (let i = 0; i < 360; i++) maxR = Math.max(maxR, shape.R(i / 360 * TAU));
      const span = maxR * 2.08 + (shape.bend || 0) * 2;
      const tex = await paintSteak(shape, span, MOBILE ? 512 : 768);
      const map = new THREE.CanvasTexture(tex.col); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      const bumpMap = new THREE.CanvasTexture(tex.bump), roughnessMap = new THREE.CanvasTexture(tex.rough);
      const meatMat = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 4, roughnessMap, roughness: 1 });
      const root = new THREE.Group();
      const model = { key, root, shape, meatMat, sliceable: key !== 'picanha', bones: [], home: { x: 0, ry: 0 } };

      if (key === 'picanha') {
        const g = steakGeometry(shape, span, 96, 40);
        const pos = g.attributes.position, Rb = .34, tmax = 2.55, A = .62;
        for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), t = (x / A) * tmax, rho = Rb + y; pos.setXYZ(i, rho * Math.cos(t) - Rb * Math.cos(tmax), rho * Math.sin(t), pos.getZ(i)); }
        g.computeVertexNormals();
        for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(g, meatMat); m.position.y = .62 + k * .78; m.rotation.y = k * 2.1 + .3; m.rotation.z = (k - 1) * .06; root.add(m); }
        const steel = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: .28 });
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, 3.1, 12), steel); rod.position.y = 1.35; root.add(rod);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(.075, .065, .5, 20), new THREE.MeshStandardMaterial({ color: 0x5a1e10, roughness: .4, metalness: .2 })); handle.position.y = 3.1; root.add(handle);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(.085, 20, 12), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: .25 })); cap.position.y = 3.38; root.add(cap);
        model.frame = { y: 1.3, dist: 10.2 }; model.shadow = .9; model.scale = .9;
      } else {
        const geo = steakGeometry(shape, span, MOBILE ? 120 : 150, MOBILE ? 48 : 60);
        const meat = new THREE.Mesh(geo, meatMat); root.add(meat);
        model.meat = meat; model.geo = geo;
        model.frame = { y: .12, dist: 9.6 }; model.shadow = maxR * 2.3; model.scale = 1;
        if (key === 'tomahawk') {
          const len = 2.1, bg = new THREE.CylinderGeometry(.13, .17, len, 24, 6, false), bpos = bg.attributes.position;
          for (let i = 0; i < bpos.count; i++) { const yy = bpos.getY(i) / len + .5; bpos.setX(i, bpos.getX(i) + Math.sin(yy * Math.PI) * .06); }
          bg.computeVertexNormals();
          const bone = new THREE.Mesh(bg, boneMat); bone.rotation.z = -Math.PI / 2; bone.scale.set(1, 1, .62); bone.position.set(.8 + len / 2, -.06, -.1);
          const knob = new THREE.Mesh(new THREE.SphereGeometry(.18, 20, 14), boneMat); knob.scale.set(.8, .8, .7); knob.position.set(.8 + len, -.06, -.1);
          root.add(bone, knob); model.bones.push(bone, knob);
          model.home = { x: -.75, ry: .5 };
          model.frame = { y: .1, dist: 9.8 };
        }
      }
      root.position.x = model.home.x; root.rotation.y = model.home.ry;
      if (model.sliceable) {
        const N = 512, data = new Float32Array(N); let Rmax = 0;
        for (let i = 0; i < N; i++) { data[i] = shape.R(i / N * TAU); Rmax = Math.max(Rmax, data[i]); }
        for (let i = 0; i < N; i++) data[i] /= Rmax;
        const rt = new THREE.DataTexture(data, N, 1, THREE.RedFormat, THREE.FloatType);
        rt.wrapS = THREE.RepeatWrapping; rt.magFilter = rt.minFilter = THREE.LinearFilter; rt.needsUpdate = true;
        model.rTex = rt; model.Rmax = Rmax;
      }
      // upload textures to the GPU now (avoids a hitch on first display)
      renderer.initTexture && [map, bumpMap, roughnessMap].forEach(t => renderer.initTexture(t));
      cache[key] = model;
      return model;
    })();
    return building[key];
  }

  /* ---------- slicing ---------- */
  function capMaterial(model) {
    const d = DONENESS[doneness];
    return new THREE.ShaderMaterial({
      vertexShader: capVert, fragmentShader: capFrag, side: THREE.DoubleSide,
      uniforms: {
        uR: { value: model.rTex }, uRmax: { value: model.Rmax }, uH: { value: model.shape.H },
        uBend: { value: model.shape.bend || 0 }, uA: { value: model.shape.a || 1 }, uMarb: { value: model.shape.marb },
        uGray: { value: d.gray }, uCenter: { value: new THREE.Color(d.center) }, uGrayCol: { value: new THREE.Color('#8c6a5a') },
        uCrust: { value: new THREE.Color('#5a2e18') }, uFat: { value: new THREE.Color('#ead8c2') }
      },
      stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp
    });
  }
  function stencilGroup(geo, plane, order) {
    const g = new THREE.Group();
    const base = new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc });
    const back = base.clone(); back.side = THREE.BackSide; back.clippingPlanes = [plane];
    back.stencilFail = back.stencilZFail = back.stencilZPass = THREE.IncrementWrapStencilOp;
    const front = base.clone(); front.side = THREE.FrontSide; front.clippingPlanes = [plane];
    front.stencilFail = front.stencilZFail = front.stencilZPass = THREE.DecrementWrapStencilOp;
    const m0 = new THREE.Mesh(geo, back), m1 = new THREE.Mesh(geo, front);
    m0.renderOrder = m1.renderOrder = order; g.add(m0, m1); return g;
  }
  function ensureHalves(model) {
    if (model.halves) return model.halves;
    const mk = (sign, order) => {
      const half = new THREE.Group();
      const local = new THREE.Plane(new THREE.Vector3(-sign, 0, 0), 0), world = local.clone();
      const mat = model.meatMat.clone(); mat.clippingPlanes = [world];
      const mesh = new THREE.Mesh(model.geo, mat); mesh.renderOrder = 6;
      const st = stencilGroup(model.geo, world, order);
      const capGeo = new THREE.PlaneGeometry(6, 3); capGeo.rotateY(Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, capMaterial(model)); cap.renderOrder = order + .1;
      cap.onAfterRender = r => r.clearStencil();
      half.add(st, cap, mesh); half.userData = { local, world, cap };
      return half;
    };
    const L = mk(1, 2), R = mk(-1, 3);
    model.bones.forEach(b => (b.position.x > 0 ? R : L).add(b.clone()));
    model.halves = { L, R };
    return model.halves;
  }
  function updatePlanes() {
    if (!current || !current.halves || !current.halves.L.parent) return;
    [current.halves.L, current.halves.R].forEach(h => { h.updateMatrixWorld(true); h.userData.world.copy(h.userData.local).applyMatrix4(h.matrixWorld); });
  }
  function setCapDoneness(model) {
    if (!model || !model.halves) return;
    const d = DONENESS[doneness], c = new THREE.Color(d.center);
    [model.halves.L, model.halves.R].forEach(h => {
      const u = h.userData.cap.material.uniforms;
      gsap.to(u.uGray, { value: d.gray, duration: .6 });
      gsap.to(u.uCenter.value, { r: c.r, g: c.g, b: c.b, duration: .6 });
    });
    wake(900);
  }

  function setSliced(on) {
    if (!current || !current.sliceable || busy) return sliced;
    const m = current, { L, R } = ensureHalves(m);
    wake(1800);
    if (on && !sliced) {
      sliced = true;
      m.root.children.forEach(c => { if (c !== L && c !== R) c.visible = false; });
      [L, R].forEach(h => { h.position.set(0, 0, 0); h.rotation.set(0, 0, 0); });
      m.root.add(L, R);
      // centre the cut on the board (fixes off-centre tomahawk) and face it to the camera
      gsap.to(m.root.position, { x: 0, duration: .9, ease: 'power3.inOut' });
      gsap.to(m.root.rotation, { y: 0, duration: .9, ease: 'power3.inOut' });
      const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      let target = az; target += Math.round((stage.rotation.y - target) / TAU) * TAU;
      gsap.to(stage.rotation, { y: target, duration: .9, ease: 'power3.inOut' });
      gsap.to(L.position, { x: -.55, z: -.1, duration: 1.1, ease: 'expo.out', delay: .15 });
      gsap.to(R.position, { x: .55, z: -.1, duration: 1.1, ease: 'expo.out', delay: .15 });
      gsap.to(L.rotation, { y: -1.0, duration: 1.1, ease: 'expo.out', delay: .15 });
      gsap.to(R.rotation, { y: 1.0, duration: 1.1, ease: 'expo.out', delay: .15 });
      puff(8);
    } else if (!on && sliced) {
      sliced = false;
      gsap.to([L.position, R.position], { x: 0, z: 0, duration: .6, ease: 'power3.inOut' });
      gsap.to([L.rotation, R.rotation], { y: 0, duration: .6, ease: 'power3.inOut', onComplete: () => {
        m.root.remove(L, R); m.root.children.forEach(c => c.visible = true);
        gsap.to(m.root.position, { x: m.home.x, duration: .7, ease: 'power3.inOut' });
        gsap.to(m.root.rotation, { y: m.home.ry, duration: .7, ease: 'power3.inOut' });
        wake(900);
      } });
    }
    return sliced;
  }
  function setDoneness(i) { doneness = i; setCapDoneness(current); }
  function puff(n = 6) { let k = 0; for (const s of steam) { if (k >= n) break; if (s.userData.life > s.userData.max * .6) { s.userData.life = 0; k++; } } }

  async function show(key) {
    if (busy) { pending = key; return; }
    if (key === currentKey) return;
    busy = true; wake(2500);
    const prevKey = currentKey;
    const next = await buildModel(key);
    const prev = current;
    const doIn = () => {
      if (prev) { stage.remove(prev.root); if (prev.halves) { prev.root.remove(prev.halves.L, prev.halves.R); prev.root.children.forEach(c => c.visible = true); } prev.root.position.x = prev.home.x; prev.root.rotation.y = prev.home.ry; }
      sliced = false; current = next; currentKey = key; stage.add(next.root);
      stage.rotation.y = -.5;
      const s0 = next.scale;
      gsap.fromTo(next.root.position, { y: 1.6 }, { y: 0, duration: .9, ease: 'bounce.out' });
      gsap.fromTo(next.root.scale, { x: s0 * .6, y: s0 * .6, z: s0 * .6 }, { x: s0, y: s0, z: s0, duration: .8, ease: 'back.out(1.6)' });
      gsap.to(stage.rotation, { y: 0, duration: 1.4, ease: 'expo.out' });
      gsap.to(controls.target, { y: next.frame.y, duration: 1, ease: 'power3.inOut' });
      gsap.to(shadow.scale, { x: next.shadow, y: next.shadow * .8, duration: .8 });
      frameDist = next.frame.dist;
      setTimeout(() => { puff(8); flash(); }, 650);
      setTimeout(() => { busy = false; wake(1200); if (pending) { const k = pending; pending = null; show(k); } }, 900);
    };
    if (prev && prevKey) {
      gsap.to(prev.root.scale, { x: .001, y: .001, z: .001, duration: .4, ease: 'back.in(1.8)', onComplete: doIn });
      gsap.to(stage.rotation, { y: stage.rotation.y + 1.2, duration: .4, ease: 'power2.in' });
    } else doIn();
  }
  function flash() { gsap.fromTo(fire, { intensity: 12 }, { intensity: 3, duration: 1.2, ease: 'power2.out' }); }

  let frameDist = 8.9;
  function resize() {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); wake(300);
  }
  new ResizeObserver(resize).observe(container); resize();

  let idleT = 0, interacting = false;
  controls.addEventListener('start', () => { interacting = true; wake(99999); });
  controls.addEventListener('end', () => { interacting = false; idleT = 0; activeUntil = performance.now() + 1200; });

  /* ---------- loop: 60fps while active, ~30fps while idly turning ---------- */
  const io =new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { rootMargin: '80px' });
  io.observe(container);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  const clock = new THREE.Clock(), dir = new THREE.Vector3();
  function loop() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }
  function tick(force) {
    raf = null;
    if ((!visible || document.hidden) && force !== true) return;
    const now = performance.now(), active = interacting || now < activeUntil;
    if (force !== true && !active && now - lastRender < 32) { loop(); return; }
    lastRender = now;
    const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
    idleT += dt;
    if (!interacting && !sliced && idleT > 2.5) stage.rotation.y += dt * .22;

    const want = frameDist * Math.max(1, Math.pow(1.6 / camera.aspect, .45));
    dir.subVectors(camera.position, controls.target).normalize();
    const cur = camera.position.distanceTo(controls.target);
    if (Math.abs(want - cur) > .002) camera.position.copy(controls.target).addScaledVector(dir, cur + (want - cur) * .08);
    controls.update();

    fire.intensity += ((3 + Math.sin(t * 7.3) * .6 + Math.sin(t * 13.1) * .4) - fire.intensity) * .1;
    for (const s of steam) {
      const u = s.userData; u.life += dt;
      if (u.life >= u.max) { u.life = 0; u.max = 2.2 + Math.random() * 1.8; }
      if (u.life < dt * 1.5) { u.x = (Math.random() - .5) * 1.4; u.z = (Math.random() - .5) * .9; u.s = .35 + Math.random() * .4; }
      const k = u.life / u.max, baseY = current && current.key === 'picanha' ? 1.6 : .55;
      s.position.set(u.x + Math.sin(t + u.z * 5) * .15 * k, baseY + k * 2.1, u.z - .3);
      s.scale.setScalar(u.s + k * 1.5);
      s.material.opacity = Math.sin(k * Math.PI) * Math.min(1, k * 3) * .07;
    }
    updatePlanes();
    renderer.render(scene, camera);
    if (force !== true) loop();
  }

  return {
    show, setSliced, setDoneness,
    isSliced: () => sliced,
    canSlice: () => !!(current && current.sliceable),
    prebuild: key => buildModel(key),
    renderNow: () => tick(true),
    dispose: () => { io.disconnect(); renderer.dispose(); }
  };
}
