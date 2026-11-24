// 世界：地形、河流、海、红岩台地、植物、天空
import * as THREE from 'three';

export const RNG = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const R = RNG(20261124);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.17;

export const BOUND = {x0: -120, x1: 120, z0: -120, z1: 92};
export const WATER_Y = -0.35;
export const riverZ = x => 14 * Math.sin(x * 0.026) + 7 * Math.sin(x * 0.067 + 1.3) + 4;
export const riverD = (x, z) => Math.abs(z - riverZ(x));

export const BIOMES = {
  fern:   {name: '蕨类森林', icon: '🌿', fact: '恐龙时代的大部分时间还没有草，地上长满了蕨类植物。', map: '#3f8f4a'},
  flower: {name: '开花草原', icon: '🌼', fact: '开花植物在白垩纪才出现，有些恐龙见过地球上最早的花。', map: '#9fcf5a'},
  river:  {name: '大河湿地', icon: '💧', fact: '恐龙常常到河边喝水，很多恐龙化石就是在古代河流的泥沙里找到的。', map: '#4fb7c9'},
  palm:   {name: '苏铁海岸', icon: '🌴', fact: '苏铁长得像棕榈树，在侏罗纪特别多，是植食恐龙爱吃的食物。', map: '#e6cf8f'},
  mesa:   {name: '红岩台地', icon: '🏜️', fact: '很多恐龙化石是在红色岩层里发现的，比如中国四川和美国西部。', map: '#d0754a'},
};
export function biomeAt(x, z) {
  if (riverD(x, z) < 13 && z < 70) return 'river';
  if (z < riverZ(x)) return x < 12 ? 'fern' : 'flower';
  return x < 32 ? 'palm' : 'mesa';
}

export const MESAS = [];
function placeMesas() {
  const spots = [[62, 40, 9, 13], [88, 22, 7, 18], [55, 74, 11, 11], [96, 60, 8, 15], [75, 52, 5, 9], [108, 84, 10, 20], [40, 58, 5, 7],
    [-150, -60, 16, 26], [150, -20, 14, 30], [140, 120, 18, 24], [-60, -165, 20, 30], [60, -170, 18, 34]];
  for (const [x, z, r, h] of spots) MESAS.push({x, z, r, h});
}
placeMesas();

export function H(x, z) {
  let h = 0.35 + fbm(x * 0.035, z * 0.035) * 1.6 - 0.5;
  const rd = riverD(x, z);
  const carve = 1 - sstep(4, 12, rd); h = h * (1 - carve) - 0.85 * carve;
  // 南边的海
  h = h + (-3.2 - h) * sstep(84, 104, z + Math.sin(x * 0.05) * 5);
  // 海岸和台地附近平一点
  // 世界边缘的山
  const e = Math.max(-z - 110, Math.abs(x) - 112);
  if (e > 0) h += Math.min(e * 0.22, 14) * (0.5 + fbm(x * 0.02, z * 0.02));
  return h;
}

// 地面颜色（鲜艳的卡通色）
const C = s => new THREE.Color(s);
const COL = {fern: C('#5f9f3f'), fern2: C('#3f8236'), flower: C('#93c84f'), flower2: C('#bcd862'), palm: C('#ecd497'), palm2: C('#d9bd78'),
  mesa: C('#d9814f'), mesa2: C('#c3613a'), bank: C('#f3ecd6'), bed: C('#1d8f9a'), grass: C('#74b84a'), meadow: C('#a9d65a'), moss: C('#8fbf3a'), dry: C('#d8cf73'), mount: C('#8fae6a'), mount2: C('#b9c9c9')};
const FLOWERCOLS = ['#ff4d6d', '#ffd23f', '#b06cff', '#ff8c42', '#ffffff', '#ff5fc8'].map(C);
function groundColor(x, z, h, out) {
  const n = fbm(x * 0.09, z * 0.09), rz = riverZ(x), north = sstep(3, -3, z - rz);
  const n2 = fbm(x * 0.022 + 40, z * 0.022 - 17);
  const a = new THREE.Color().copy(COL.fern).lerp(COL.fern2, n).lerp(COL.moss, sstep(0.55, 0.75, n2) * 0.7), b = new THREE.Color().copy(COL.flower).lerp(COL.flower2, n).lerp(COL.dry, sstep(0.55, 0.75, n2) * 0.6);
  const nc = a.lerp(b, sstep(4, 22, x));
  const p = new THREE.Color().copy(COL.palm).lerp(COL.palm2, n), m = new THREE.Color().copy(COL.mesa).lerp(COL.mesa2, n);
  const sc = p.lerp(m, sstep(22, 42, x));
  out.copy(sc).lerp(nc, north);
  // 河岸绿草
  const rd = riverD(x, z); out.lerp(COL.grass, (1 - sstep(8, 16, rd)) * 0.75 * (z < 75 ? 1 : 0));
  // 花海：开花草原里一块块彩色花田
  if (north > 0.5 && x > 10) { const f = fbm(x * 0.05 + 7, z * 0.05 - 3); if (f > 0.58) { const k = hash(Math.floor(x * 0.9), Math.floor(z * 0.9)); out.lerp(COL.meadow, sstep(0.58, 0.66, f) * 0.6); } }
  // 水边白色沙滩
  if (h < 0.0) out.lerp(COL.bank, sstep(0.0, -0.22, h));
  if (h < -0.3) out.lerp(COL.bed, sstep(-0.3, -0.7, h));
  // 远处的山
  const e = Math.max(-z - 110, Math.abs(x) - 112); if (e > 0) out.lerp(COL.mount, sstep(0, 20, e)).lerp(COL.mount2, sstep(40, 70, h));
  return out;
}

export function buildTerrain(scene) {
  const S = 420, N = 200, g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = H(x, z); pos.setY(i, h);
    groundColor(x, z, h, c); const j = (hash(x * 3.1, z * 2.7) - 0.5) * 0.06; cols[i * 3] = c.r + j; cols[i * 3 + 1] = c.g + j; cols[i * 3 + 2] = c.b + j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.95});
  // 细节：地面加一点颗粒感
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nfloat hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}')
      .replace('#include <color_fragment>', '#include <color_fragment>\n{ vec2 q=vWP.xz*0.35; vec2 i=floor(q), f=fract(q); f=f*f*(3.0-2.0*f); float n=mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); float g=hh(floor(vWP.xz*6.0)); diffuseColor.rgb*=0.9+0.14*n+0.04*g; }');
  };
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; scene.add(mesh);
  return mesh;
}

export function buildWater(scene) {
  const g = new THREE.PlaneGeometry(420, 420, 1, 1); g.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({color: '#25c2d6', roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.88});
  const U = {uT: {value: 0}};
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = U.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uT;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{ float deep = smoothstep(80.0,110.0,vWP.z); diffuseColor.rgb = mix(vec3(0.05,0.62,0.66), vec3(0.03,0.36,0.70), deep);
  float w = sin(vWP.x*0.9+uT*1.3)*sin(vWP.z*0.7-uT*1.1)+sin((vWP.x+vWP.z)*0.45+uT*0.8);
  diffuseColor.rgb += smoothstep(1.2,1.9,w)*0.18; }`);
  };
  const m = new THREE.Mesh(g, mat); m.position.y = WATER_Y; m.renderOrder = 1; scene.add(m);
  return U;
}

export function buildMesas(scene) {
  const bands = ['#e9a15f', '#d36b3c', '#f1c48a', '#b9512f', '#e48450', '#f6dcae', '#c45a33'].map(C);
  const grp = new THREE.Group();
  for (const M of MESAS) {
    const g = new THREE.CylinderGeometry(M.r * 0.86, M.r * 1.12, M.h, 22, 10, false);
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), seed = M.x * 0.37 + M.z;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const a = Math.atan2(z, x), r = Math.hypot(x, z);
      if (r > 0.01) { const k = 1 + 0.13 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 7 + seed * 2) + 0.05 * Math.sin(y * 1.3 + a * 5); pos.setX(i, x * k); pos.setZ(i, z * k); }
      const yy = y + M.h / 2, band = bands[Math.floor((yy * 0.55 + Math.sin(a * 2 + seed) * 0.4 + 100)) % bands.length];
      const c = yy > M.h - 0.05 ? C('#9cbf5a') : band; cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    const m = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.9, flatShading: true}));
    m.position.set(M.x, H(M.x, M.z) + M.h / 2 - 0.6, M.z); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  }
  scene.add(grp);
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
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -1; scene.add(sky);
  // 云：柔软的卡通云
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
  for (let i = 0; i < 14; i++) { const cx = 40 + Math.random() * 176, cy = 70 + Math.random() * 25 - (Math.abs(cx - 128) < 60 ? 18 : 0), r = 22 + Math.random() * 22;
    const gr = x.createRadialGradient(cx, cy - r * 0.3, 2, cx, cy, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(248,252,255,.95)'); gr.addColorStop(1, 'rgba(235,245,255,0)'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const clouds = [];
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, fog: false, depthWrite: false, transparent: true, opacity: 0.95}));
    const a = R() * Math.PI * 2, d = 200 + R() * 220; s.position.set(Math.cos(a) * d, 70 + R() * 60, Math.sin(a) * d - 60); const k = 70 + R() * 70; s.scale.set(k, k / 2, 1); scene.add(s); clouds.push(s); }
  return clouds;
}

export const CHUNKS = [];
export function cullChunks(px, pz) { for (const m of CHUNKS) { const dx = m.userData.cx - px, dz = m.userData.cz - pz; m.visible = dx * dx + dz * dz < m.userData.far * m.userData.far; } }
// 植物：把模型转成 InstancedMesh，一次画很多棵，电脑上很省力
export function makeInstancer(scene, gltfScene, targetH, opt = {}) {
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
      n.roughness = 0.85; n.metalness = 0; return n; });
    parts.push({g, mats});
  });
  return {parts, k, size, add(list) {
    // 按 40×40 的格子分块，看不见的块整块跳过（视锥裁剪 + 距离裁剪）
    const cells = {};
    for (const it of list) { const k = Math.floor(it.x / 40) + ',' + Math.floor(it.z / 40); (cells[k] = cells[k] || []).push(it); }
    const res = [];
    for (const k in cells) {
      const L = cells[k]; let cx = 0, cz = 0; L.forEach(it => { cx += it.x; cz += it.z; }); cx /= L.length; cz /= L.length;
      for (const p of parts) {
        const im = new THREE.InstancedMesh(p.g, p.mats.length === 1 ? p.mats[0] : p.mats, L.length);
        const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        L.forEach((it, i) => { e.set(0, it.r, 0); q.setFromEuler(e); M.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * (it.sy || 1), it.s)); im.setMatrixAt(i, M); });
        im.computeBoundingSphere(); im.castShadow = !!opt.shadow; im.receiveShadow = !!opt.recv; im.userData.cx = cx; im.userData.cz = cz; im.userData.far = opt.far || 150;
        scene.add(im); res.push(im); CHUNKS.push(im);
      }
    }
    return res;
  }};
}

// 花海：成千上万朵小花，一次画完
export function buildFlowerField(scene) {
  const stem = new THREE.CylinderGeometry(0.02, 0.025, 0.36, 4).translate(0, 0.18, 0);
  const head = new THREE.IcosahedronGeometry(0.11, 0).scale(1, 0.6, 1).translate(0, 0.38, 0);
  const list = []; const RR = RNG(99);
  for (let i = 0; i < 30000 && list.length < 4200; i++) {
    const x = -10 + RR() * 140, z = -125 + RR() * 140; if (biomeAt(x, z) !== 'flower') continue;
    const f = fbm(x * 0.05 + 7, z * 0.05 - 3); if (f < 0.5 && RR() > 0.08) continue; const h = H(x, z); if (h < 0) continue;
    list.push({x, y: h, z, c: FLOWERCOLS[Math.floor(hash(Math.floor(x * 0.15), Math.floor(z * 0.15)) * 6 + RR() * 1.6) % 6], s: 0.6 + RR() * 0.7});
  }
  const sm = new THREE.MeshStandardMaterial({color: '#4f9a3a', roughness: 0.9}), hm = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.5, flatShading: true});
  const cells = {}; for (const p of list) { const k = Math.floor(p.x / 30) + ',' + Math.floor(p.z / 30); (cells[k] = cells[k] || []).push(p); }
  const M = new THREE.Matrix4();
  for (const k in cells) { const L = cells[k]; const ims = new THREE.InstancedMesh(stem, sm, L.length), imh = new THREE.InstancedMesh(head, hm, L.length);
    L.forEach((p, i) => { M.makeScale(p.s, p.s, p.s).setPosition(p.x, p.y, p.z); ims.setMatrixAt(i, M); imh.setMatrixAt(i, M); imh.setColorAt(i, p.c); });
    for (const im of [ims, imh]) { im.computeBoundingSphere(); im.userData.cx = L[0].x; im.userData.cz = L[0].z; im.userData.far = 90; CHUNKS.push(im); scene.add(im); } }
}
