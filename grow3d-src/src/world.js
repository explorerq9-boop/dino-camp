// 世界：没有边界的大陆。玩家走到哪里，周围的地形、河、湖、红岩、树和花就按“种子”自动生成，
// 走远了就收起来，所以可以一直走下去，内存也不会越用越多。
import * as THREE from 'three';
import {SEASON, PLANT_GLSL, GROUND_GLSL} from './season.js';

export const RNG = seed => { seed = Math.abs(Math.floor(seed)) % 2147483646 + 1; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.17;

export const WATER_Y = -0.35;
export const CH = 80; // 每块地 80×80

export const BIOMES = {
  fern:   {name: '蕨类森林', icon: '🌿', fact: '恐龙时代的大部分时间还没有草，地上长满了蕨类植物。', map: '#3f8f4a'},
  flower: {name: '开花草原', icon: '🌼', fact: '开花植物在白垩纪才出现，有些恐龙见过地球上最早的花。', map: '#9fcf5a'},
  river:  {name: '大河湿地', icon: '💧', fact: '恐龙常常到河边喝水，很多恐龙化石就是在古代河流的泥沙里找到的。', map: '#4fb7c9'},
  palm:   {name: '苏铁海岸', icon: '🌴', fact: '苏铁长得像棕榈树，在侏罗纪特别多，是植食恐龙爱吃的食物。', map: '#e6cf8f'},
  mesa:   {name: '红岩台地', icon: '🏜️', fact: '很多恐龙化石是在红色岩层里发现的，比如中国四川和美国西部。', map: '#d0754a'},
};

/* ---------- 大陆的“形状” ---------- */
const bioA = (x, z) => fbm(x * 0.0036 + 11.3, z * 0.0036 - 7.1);   // 东西向：蕨类/草原，苏铁/红岩
const bioB = (x, z) => fbm(x * 0.0036 - 31.7, z * 0.0036 + 19.9);  // 南北向：北边绿，南边黄
export function riverDist(x, z) { // 到最近河道中心的大概距离
  const mask = fbm(x * 0.0025 + 300, z * 0.0025 - 200); if (mask < 0.38) return 99;
  return Math.abs(fbm(x * 0.0045 + 100, z * 0.0045 - 100) - 0.5) * 270 + (mask < 0.44 ? (0.44 - mask) * 400 : 0);
}
const lakeV = (x, z) => fbm(x * 0.006 - 40, z * 0.006 + 70) + sstep(0.45, 0.6, bioB(x, z)) * 0.05;
export function biomeAt(x, z) {
  if (riverDist(x, z) < 13 || lakeV(x, z) > 0.64) return 'river';
  const a = bioA(x, z), b = bioB(x, z);
  if (b < 0.5) return a < 0.5 ? 'fern' : 'flower';
  return a < 0.5 ? 'palm' : 'mesa';
}
export function H(x, z) {
  let h = 0.35 + fbm(x * 0.035, z * 0.035) * 1.6 - 0.5;
  h += (fbm(x * 0.008 + 5, z * 0.008 + 9) - 0.5) * 3; // 缓缓的大山坡
  const rd = riverDist(x, z), carve = 1 - sstep(4, 12, rd); h = h * (1 - carve) - 0.85 * carve;
  const lk = sstep(0.63, 0.72, lakeV(x, z)); h = h * (1 - lk) - 1.8 * lk; // 湖
  return h;
}

/* ---------- 红岩台地：每块地用自己的种子决定有没有、在哪里 ---------- */
const mesaCache = new Map();
export function mesasOfChunk(ci, cj) {
  const key = ci + ',' + cj; if (mesaCache.has(key)) return mesaCache.get(key);
  const R = RNG(ci * 73856093 ^ cj * 19349663), out = [];
  const n = Math.floor(R() * 4);
  for (let i = 0; i < n; i++) { const x = (ci + 0.15 + R() * 0.7) * CH, z = (cj + 0.15 + R() * 0.7) * CH;
    if (biomeAt(x, z) !== 'mesa' || riverDist(x, z) < 22 || lakeV(x, z) > 0.58) continue;
    const r = 5 + R() * 8; if (out.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r + 4)) continue; out.push({x, z, r, h: 7 + R() * 15}); }
  if (mesaCache.size > 4000) mesaCache.clear(); mesaCache.set(key, out); return out;
}
const chunkOf = v => Math.floor(v / CH);
export function mesasNear(x, z) { const ci = chunkOf(x), cj = chunkOf(z), out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...mesasOfChunk(ci + a, cj + b)); return out; }

/* ---------- 地面颜色（鲜艳的卡通色） ---------- */
const C = s => new THREE.Color(s);
const COL = {fern: C('#5f9f3f'), fern2: C('#3f8236'), flower: C('#93c84f'), flower2: C('#bcd862'), palm: C('#ecd497'), palm2: C('#d9bd78'),
  mesa: C('#d9814f'), mesa2: C('#c3613a'), bank: C('#f3ecd6'), bed: C('#1d8f9a'), grass: C('#74b84a'), meadow: C('#a9d65a'), moss: C('#8fbf3a'), dry: C('#d8cf73')};
const FLOWERCOLS = ['#ff4d6d', '#ffd23f', '#b06cff', '#ff8c42', '#ffffff', '#ff5fc8'].map(C);
const _a = new THREE.Color(), _b = new THREE.Color(), _p = new THREE.Color(), _m = new THREE.Color();
function groundColor(x, z, h, out) {
  const n = fbm(x * 0.09, z * 0.09), n2 = fbm(x * 0.022 + 40, z * 0.022 - 17), A = bioA(x, z), B = bioB(x, z);
  const fa = sstep(0.47, 0.53, A), fb = sstep(0.47, 0.53, B);
  _a.copy(COL.fern).lerp(COL.fern2, n).lerp(COL.moss, sstep(0.55, 0.75, n2) * 0.7);
  _b.copy(COL.flower).lerp(COL.flower2, n).lerp(COL.dry, sstep(0.55, 0.75, n2) * 0.6);
  _p.copy(COL.palm).lerp(COL.palm2, n); _m.copy(COL.mesa).lerp(COL.mesa2, n);
  _a.lerp(_b, fa); _p.lerp(_m, fa); out.copy(_a).lerp(_p, fb);
  const rd = riverDist(x, z), wet = Math.max(1 - sstep(8, 16, rd), sstep(0.58, 0.64, lakeV(x, z))); out.lerp(COL.grass, wet * 0.75 * (1 - fb * 0.5));
  if (B < 0.5 && A > 0.5) { const f = fbm(x * 0.05 + 7, z * 0.05 - 3); if (f > 0.58) out.lerp(COL.meadow, sstep(0.58, 0.66, f) * 0.6 * fa); }
  if (h < 0.0) out.lerp(COL.bank, sstep(0.0, -0.22, h));
  if (h < -0.3) out.lerp(COL.bed, sstep(-0.3, -0.7, h));
  return out;
}

/* ---------- 共用材质 ---------- */
const groundMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.95});
groundMat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.uniforms.uT = WIND; sh.uniforms.uSeason = SEASON;
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uT; uniform vec3 uSeason;\nfloat hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn2(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.0-2.0*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}')
    .replace('#include <color_fragment>', '#include <color_fragment>\n{ vec2 wp=mod(vWP.xz,1000.0); vec2 q=wp*0.35; vec2 i=floor(q), f=fract(q); f=f*f*(3.0-2.0*f); float n=mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); float g=hh(floor(wp*6.0)); diffuseColor.rgb*=0.9+0.14*n+0.04*g;   vec2 cq=mod(vWP.xz,2000.0)*0.012+vec2(uT*0.018,uT*0.01); float cl=vn2(cq)*0.65+vn2(cq*2.3)*0.35; diffuseColor.rgb*=1.0-0.16*smoothstep(0.55,0.72,cl);   float wl=vWP.y-(-0.35); float wet=1.0-smoothstep(0.0,0.35,wl); diffuseColor.rgb*=1.0-0.18*wet*step(-0.05,wl);   float fo=smoothstep(0.07,0.0,abs(wl-0.02-0.03*sin(uT*0.9+vWP.x*0.15+vWP.z*0.1))); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),fo*0.7); }' + GROUND_GLSL);
};
const mesaMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.9, flatShading: true});
mesaMat.onBeforeCompile = sh => { sh.uniforms.uSeason = SEASON;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSWP; uniform vec3 uSeason;').replace('#include <color_fragment>', '#include <color_fragment>\n{ vec3 wn = normalize(cross(dFdx(vSWP), dFdy(vSWP))); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94,0.97,1.0), uSeason.z * smoothstep(0.6, 0.9, abs(wn.y)) * 0.9); }'); };

export const WIND = {value: 0};
export const NEAR = {value: 2.5};
// 风：让草、花、树叶轻轻摆动；离镜头太近的叶子隐藏，不挡视线
export function addSway(mat, amp) {
  mat.onBeforeCompile = sh => { sh.uniforms.uWind = WIND; sh.uniforms.uNear = NEAR;
    sh.uniforms.uSeason = SEASON;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSWP; uniform float uNear; uniform vec3 uSeason;').replace('#include <color_fragment>', '#include <color_fragment>\n' + PLANT_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (distance(vSWP, cameraPosition) < uNear) discard;');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind; varying vec3 vSWP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
        vSWP = (modelMatrix * wp).xyz; }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = mod(instanceMatrix[3].xyz, 1000.0);
      #endif
        float ph = uWind * 1.7 + ip.x * 0.31 + ip.z * 0.27; float hgt = max(position.y, 0.0);
        transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3) * 0.3) * hgt * ${amp.toFixed(4)};
        transformed.z += cos(ph * 0.8) * 0.5 * hgt * ${amp.toFixed(4)}; }`); };
  mat.customProgramCacheKey = () => 'sway' + amp;
}

// 植物模型 → 可以一次画很多棵的“模板”
export function makeKind(gltfScene, targetH, opt = {}) {
  gltfScene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltfScene), size = box.getSize(new THREE.Vector3());
  const k = targetH / size.y, parts = [];
  gltfScene.traverse(m => {
    if (!m.isMesh) return;
    const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); g.scale(k, k, k);
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(mm => {
      const n = mm.clone(); if (n.map) { n.alphaTest = 0.45; n.transparent = false; n.side = THREE.DoubleSide; }
      if (opt.bright && n.color) n.color.multiplyScalar(opt.bright);
      if (opt.saturate && n.color) { const hsl = {}; n.color.getHSL(hsl); n.color.setHSL(hsl.h, Math.min(1, hsl.s * opt.saturate), Math.min(0.8, hsl.l * (opt.bright || 1))); }
      n.roughness = 0.85; n.metalness = 0; addSway(n, opt.sway || 0); return n; });
    parts.push({g, mats});
  });
  return {parts, opt};
}
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _V = new THREE.Vector3(), _S = new THREE.Vector3();
function instance(kind, list, group, far) {
  const res = [];
  for (const p of kind.parts) {
    const im = new THREE.InstancedMesh(p.g, p.mats.length === 1 ? p.mats[0] : p.mats, list.length);
    list.forEach((it, i) => { _E.set(0, it.r, 0); _Q.setFromEuler(_E); _M.compose(_V.set(it.x, it.y, it.z), _Q, _S.set(it.s, it.s, it.s)); im.setMatrixAt(i, _M); });
    im.computeBoundingSphere(); im.castShadow = !!kind.opt.shadow; im.userData.far = far; im.userData.kn = kind.name; group.add(im); res.push(im);
  }
  return res;
}

/* ---------- 世界管理：按块生成、按块收起 ---------- */
export function createWorld(scene, {mobile = false} = {}) {
  const W = {chunks: new Map(), kinds: [], lily: null, scene, mobile, solidCache: new Map(), clear: []};
  const inClear = (x, z) => W.clear.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < c.r * c.r);
  const SEG = mobile ? 26 : 36, TER_RING = 2, FLORA_RING = 2, QF = mobile ? 0.35 : 0.6;
  const stem = new THREE.CylinderGeometry(0.02, 0.025, 0.36, 4).translate(0, 0.18, 0);
  const head = new THREE.IcosahedronGeometry(0.11, 0).scale(1, 0.6, 1).translate(0, 0.38, 0);
  const stemM = new THREE.MeshStandardMaterial({color: '#4f9a3a', roughness: 0.9}), headM = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.5, flatShading: true}); addSway(stemM, 0.18); addSway(headM, 0.18);
  const bands = ['#e9a15f', '#d36b3c', '#f1c48a', '#b9512f', '#e48450', '#f6dcae', '#c45a33'].map(C);

  W.addKind = (kind, biomes, perChunk, margin, solidR) => W.kinds.push({kind, biomes, n: perChunk, margin, solidR});

  function terrain(ci, cj) {
    const g = new THREE.PlaneGeometry(CH, CH, SEG, SEG); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, nor = g.attributes.normal, cols = new Float32Array(pos.count * 3), c = new THREE.Color(), x0 = (ci + 0.5) * CH, z0 = (cj + 0.5) * CH, e = 0.8;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + x0, z = pos.getZ(i) + z0, h = H(x, z); pos.setY(i, h);
      const nx = H(x - e, z) - H(x + e, z), nz = H(x, z - e) - H(x, z + e), l = Math.hypot(nx, 2 * e, nz); nor.setXYZ(i, nx / l, 2 * e / l, nz / l);
      groundColor(x, z, h, c); const j = (hash(x * 3.1, z * 2.7) - 0.5) * 0.06; cols[i * 3] = c.r + j; cols[i * 3 + 1] = c.g + j; cols[i * 3 + 2] = c.b + j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, groundMat); m.position.set(x0, 0, z0); m.receiveShadow = true; return m;
  }
  function mesaMesh(M) {
    const g = new THREE.CylinderGeometry(M.r * 0.86, M.r * 1.12, M.h, 20, 9, false);
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), seed = M.x * 0.37 + M.z;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      if (r > 0.01) { const k = 1 + 0.13 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 7 + seed * 2) + 0.05 * Math.sin(y * 1.3 + a * 5); pos.setX(i, x * k); pos.setZ(i, z * k); }
      const yy = y + M.h / 2, cc = yy > M.h - 0.05 ? C('#9cbf5a') : bands[Math.floor(yy * 0.55 + Math.sin(a * 2 + seed) * 0.4 + 100) % bands.length];
      cols[i * 3] = cc.r; cols[i * 3 + 1] = cc.g; cols[i * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ng = g.toNonIndexed(); g.dispose(); ng.computeVertexNormals();
    const m = new THREE.Mesh(ng, mesaMat); m.position.set(M.x, H(M.x, M.z) + M.h / 2 - 0.6, M.z); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function flora(ci, cj, ch) {
    const R = RNG(ci * 92821 + cj * 68917 + 12345), x0 = ci * CH, z0 = cj * CH, mesas = mesasNear((ci + 0.5) * CH, (cj + 0.5) * CH);
    const solids = ch.solids, grp = ch.flora;
    for (const M of mesasOfChunk(ci, cj)) { grp.add(mesaMesh(M)); solids.push({x: M.x, z: M.z, r: M.r * 1.15 + 0.5, big: true}); }
    for (const K of W.kinds) {
      const list = [], tries = Math.round(K.n * QF * (K.kind.opt.tall ? 1.3 : 1));
      for (let i = 0; i < tries; i++) { const x = x0 + R() * CH, z = z0 + R() * CH, r = R() * Math.PI * 2, s = 0.75 + R() * 0.5;
        if (!K.biomes.includes(biomeAt(x, z))) continue; const h = H(x, z); if (h < -0.15) continue; if (inClear(x, z)) continue;
        if (mesas.some(M => Math.abs(M.x - x) < M.r * 1.3 + K.margin && Math.hypot(M.x - x, M.z - z) < M.r * 1.25 + K.margin)) continue;
        list.push({x, y: h - 0.05, z, r, s}); }
      if (!list.length) continue;
      instance(K.kind, list, grp, K.kind.opt.far || (mobile ? 135 : 160));
      if (K.solidR) for (const it of list) solids.push({x: it.x, z: it.z, r: K.solidR * it.s});
    }
    // 花海
    const fl = [];
    for (let i = 0; i < (mobile ? 1100 : 2200); i++) { const x = x0 + R() * CH, z = z0 + R() * CH, rr = R(), s = 0.6 + R() * 0.7;
      if (biomeAt(x, z) !== 'flower' || inClear(x, z)) continue; const f = fbm(x * 0.05 + 7, z * 0.05 - 3); if (f < 0.5 && rr > 0.08) continue; const h = H(x, z); if (h < 0) continue;
      fl.push({x, y: h, z, s, c: FLOWERCOLS[Math.floor(hash(Math.floor(x * 0.15), Math.floor(z * 0.15)) * 6 + rr * 1.6) % 6]}); }
    if (fl.length) { const ims = new THREE.InstancedMesh(stem, stemM, fl.length), imh = new THREE.InstancedMesh(head, headM, fl.length);
      fl.forEach((p, i) => { _M.makeScale(p.s, p.s, p.s).setPosition(p.x, p.y, p.z); ims.setMatrixAt(i, _M); imh.setMatrixAt(i, _M); imh.setColorAt(i, p.c); });
      for (const im of [ims, imh]) { im.computeBoundingSphere(); im.userData.far = 95; grp.add(im); } }
    // 睡莲
    if (W.lily) { const ll = []; for (let i = 0; i < 40; i++) { const x = x0 + R() * CH, z = z0 + R() * CH, r = R() * 6, s = 1.4 + R(); if (H(x, z) < -0.55) ll.push({x, y: WATER_Y + 0.02, z, r, s}); }
      if (ll.length) instance(W.lily, ll, grp, 110); }
  }
  function load(ci, cj, withFlora) {
    const key = ci + ',' + cj; let ch = W.chunks.get(key);
    if (!ch) { ch = {ci, cj, ter: terrain(ci, cj), flora: null, solids: []}; scene.add(ch.ter); W.chunks.set(key, ch); }
    if (withFlora && !ch.flora) { ch.flora = new THREE.Group(); ch.solids = []; flora(ci, cj, ch); scene.add(ch.flora); }
    return ch;
  }
  function dropFlora(ch) { if (!ch.flora) return; ch.flora.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh) o.geometry.dispose(); }); scene.remove(ch.flora); ch.flora = null; ch.solids = []; }
  function drop(ch) { dropFlora(ch); scene.remove(ch.ter); ch.ter.geometry.dispose(); W.chunks.delete(ch.ci + ',' + ch.cj); }

  // 每帧最多生成几块，避免卡顿；immediate=true 时一次全部生成（开局用）
  W.update = (px, pz, immediate = false) => {
    const pi = chunkOf(px), pj = chunkOf(pz); let budget = immediate ? 1e9 : 1;
    const need = [];
    for (let a = -TER_RING; a <= TER_RING; a++) for (let b = -TER_RING; b <= TER_RING; b++) {
      const ci = pi + a, cj = pj + b, d = Math.max(Math.abs(a), Math.abs(b)), ch = W.chunks.get(ci + ',' + cj), wf = d <= FLORA_RING;
      if (!ch || (wf && !ch.flora)) need.push({ci, cj, wf, d: Math.hypot((ci + 0.5) * CH - px, (cj + 0.5) * CH - pz) + (ch ? 0 : -1)});
    }
    need.sort((p, q) => p.d - q.d);
    for (const n of need) { if (budget-- <= 0) break; load(n.ci, n.cj, n.wf); }
    for (const ch of [...W.chunks.values()]) { const d = Math.max(Math.abs(ch.ci - pi), Math.abs(ch.cj - pj)); if (d > TER_RING + 1) drop(ch); else if (d > FLORA_RING + 1) dropFlora(ch); }
    return need.length;
  };
  W.cull = (px, pz) => { for (const ch of W.chunks.values()) { if (!ch.flora) continue; for (const m of ch.flora.children) { if (!m.userData.far) continue; const s = m.boundingSphere; if (!s) continue; const dx = s.center.x - px, dz = s.center.z - pz, f = m.userData.far + s.radius * 0.5; m.visible = dx * dx + dz * dz < f * f; } } };
  W.solidsNear = (x, z) => { const ci = chunkOf(x), cj = chunkOf(z), out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ch = W.chunks.get((ci + a) + ',' + (cj + b)); if (ch) for (const s of ch.solids) out.push(s); else for (const M of mesasOfChunk(ci + a, cj + b)) out.push({x: M.x, z: M.z, r: M.r * 1.15 + 0.5, big: true}); } return out; };
  // 小窝附近不长树和草（让出一块空地）
  W.setClear = list => { W.clear = list; for (const ch of W.chunks.values()) if (ch.flora) { const x0 = ch.ci * CH, z0 = ch.cj * CH; if (list.some(c => c.x + c.r > x0 && c.x - c.r < x0 + CH && c.z + c.r > z0 && c.z - c.r < z0 + CH)) dropFlora(ch); } };
  W.stats = () => ({chunks: W.chunks.size, flora: [...W.chunks.values()].filter(c => c.flora).length});
  return W;
}

/* ---------- 水面：一大片跟着玩家走的水 ---------- */
export function buildWater(scene) {
  const g = new THREE.PlaneGeometry(700, 700, 1, 1); g.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({color: '#25c2d6', roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.88});
  const U = {uT: {value: 0}};
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = U.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uT;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 p = mod(vWP.xz, 2000.0); diffuseColor.rgb = vec3(0.05,0.60,0.66);
  float w = sin(p.x*0.9+uT*1.3)*sin(p.y*0.7-uT*1.1)+sin((p.x+p.y)*0.45+uT*0.8);
  diffuseColor.rgb += smoothstep(1.2,1.9,w)*0.18;
  float fr = pow(1.0 - abs(normalize(cameraPosition - vWP).y), 3.0); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75,0.9,1.0), fr*0.55); }`);
  };
  const m = new THREE.Mesh(g, mat); m.position.y = WATER_Y; m.renderOrder = 1; scene.add(m);
  U.mesh = m; return U;
}

export function buildSky(scene) {
  const g = new THREE.SphereGeometry(600, 32, 16);
  const m = new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `varying vec3 vP; void main(){ float y=max(vP.y,0.0); vec3 top=vec3(0.16,0.52,0.92), hor=vec3(0.72,0.90,1.0);
      vec3 c=mix(hor, top, pow(y,0.55)); vec3 sd=normalize(vec3(0.45,0.55,-0.7)); float s=max(dot(vP,sd),0.0); c+=vec3(1.0,0.92,0.7)*(pow(s,350.0)*2.0+pow(s,12.0)*0.25);
      if(vP.y<0.0) c=hor; gl_FragColor=vec4(c,1.0);
#include <colorspace_fragment>
    }`});
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
  for (let i = 0; i < 14; i++) { const cx = 40 + Math.random() * 176, cy = 70 + Math.random() * 25 - (Math.abs(cx - 128) < 60 ? 18 : 0), r = 22 + Math.random() * 22;
    const gr = x.createRadialGradient(cx, cy - r * 0.3, 2, cx, cy, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(248,252,255,.95)'); gr.addColorStop(1, 'rgba(235,245,255,0)'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const clouds = new THREE.Group(), R = RNG(20261124);
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, fog: false, depthWrite: false, transparent: true, opacity: 0.95}));
    const a = R() * Math.PI * 2, d = 200 + R() * 220; s.position.set(Math.cos(a) * d, 70 + R() * 60, Math.sin(a) * d); const k = 70 + R() * 70; s.scale.set(k, k / 2, 1); clouds.add(s); }
  scene.add(clouds);
  return {sky, clouds};
}
