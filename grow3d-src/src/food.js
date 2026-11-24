// 食物：用简单几何体拼出来的卡通食物（原创）
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const VCMAT = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.45});

const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.45}, o));
const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const MATS = {};
const mat = (c, o) => MATS[c + JSON.stringify(o || {})] || (MATS[c + JSON.stringify(o || {})] = M(c, o));

export const FOOD = {
  bug:    {name: '甲虫', icon: '🐞', tier: 1, xp: 1, kind: 'meat', r: 0.35},
  berry:  {name: '浆果', icon: '🫐', tier: 1, xp: 1, kind: 'plant', r: 0.35},
  flower: {name: '花朵', icon: '🌸', tier: 1, xp: 1, kind: 'plant', r: 0.35, biomes: ['flower', 'fern', 'river']},
  fly:    {name: '蜻蜓', icon: '🪰', tier: 2, xp: 2, kind: 'meat', r: 0.5},
  shroom: {name: '大蘑菇', icon: '🍄', tier: 2, xp: 2, kind: 'plant', r: 0.55, biomes: ['fern', 'river', 'flower']},
  fish:   {name: '小鱼', icon: '🐟', tier: 3, xp: 3, kind: 'meat', r: 0.8, water: true},
  cone:   {name: '苏铁果', icon: '🍍', tier: 3, xp: 3, kind: 'plant', r: 0.8, biomes: ['palm', 'mesa', 'fern', 'river', 'flower']},
  bigfish:{name: '大鱼', icon: '🐠', tier: 4, xp: 4, kind: 'meat', r: 1.3, water: true},
  leaves: {name: '一大丛嫩叶', icon: '🌿', tier: 4, xp: 4, kind: 'plant', r: 1.3},
  lizard: {name: '小蜥蜴', icon: '🦎', tier: 3, xp: 3, kind: 'meat', r: 0.8, biomes: ['mesa', 'palm', 'flower']},
};
export const FOOD_KEYS = Object.keys(FOOD);

const ringGeo = new THREE.RingGeometry(0.7, 1, 28).rotateX(-Math.PI / 2); ringGeo.userData.shared = true;
let lockTex = null;
function lockSprite() {
  if (!lockTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill(); x.font = '36px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🔒', 32, 34); lockTex = new THREE.CanvasTexture(c); lockTex.colorSpace = THREE.SRGBColorSpace; }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: lockTex, depthTest: false, transparent: true})); s.renderOrder = 5; return s;
}

export function makeFood(type) {
  const f = FOOD[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const add = (geo, m, x = 0, y = 0, z = 0, s) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (s) o.scale.set(...s); o.castShadow = true; body.add(o); return o; };
  switch (type) {
    case 'bug': { const c = ['#e8402a', '#2f7de1', '#f2b21c'][Math.floor(Math.random() * 3)];
      add(S(0.22), mat(c, {roughness: 0.25}), 0, 0.18, 0, [1, 0.7, 1.3]); add(S(0.11), mat('#222'), 0, 0.16, 0.27);
      for (const sx of [-1, 1]) add(S(0.05, 6, 4), mat('#111'), sx * 0.09, 0.3, 0.05); add(new THREE.BoxGeometry(0.01, 0.02, 0.4), mat('#111'), 0, 0.33, 0); break; }
    case 'berry': { const c = Math.random() < 0.5 ? '#c3245a' : '#5b3fc4'; for (let i = 0; i < 6; i++) { const a = i * 1.1; add(S(0.11), mat(c, {roughness: 0.2}), Math.cos(a) * 0.13, 0.13 + (i % 3) * 0.06, Math.sin(a) * 0.13); }
      add(new THREE.ConeGeometry(0.16, 0.05, 5), mat('#3f9a3c'), 0, 0.34, 0); break; }
    case 'flower': { const c = ['#ff5c8a', '#ffd23f', '#b46cff', '#ff8c42'][Math.floor(Math.random() * 4)];
      add(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), mat('#3f8f3a'), 0, 0.25, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(S(0.09, 8, 6), mat(c), Math.cos(a) * 0.12, 0.52, Math.sin(a) * 0.12, [1, 0.45, 1]); } add(S(0.07, 8, 6), mat('#ffe066'), 0, 0.54, 0); break; }
    case 'fly': { add(new THREE.CylinderGeometry(0.05, 0.03, 0.7, 6).rotateX(Math.PI / 2), mat('#1fb5a0', {roughness: 0.2}), 0, 0, 0); add(S(0.09), mat('#126b5f'), 0, 0, 0.38);
      const wm = new THREE.MeshStandardMaterial({color: '#dff6ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide});
      for (const sx of [-1, 1]) for (const z of [0.12, -0.02]) { const w = add(new THREE.PlaneGeometry(0.5, 0.13).rotateX(-Math.PI / 2), wm, sx * 0.27, 0.03, z); w.castShadow = false; w.userData.wing = sx; }
      body.position.y = 1.1; break; }
    case 'shroom': { add(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 10), mat('#f4ead2'), 0, 0.22, 0);
      add(new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e2412f', {roughness: 0.35}), 0, 0.42, 0, [1, 0.75, 1]);
      for (let i = 0; i < 7; i++) { const a = i * 0.9, r = 0.18 + (i % 2) * 0.1; add(S(0.05, 6, 4), mat('#fff'), Math.cos(a) * r, 0.42 + 0.3 * Math.cos(r * 2.2), Math.sin(a) * r); } break; }
    case 'fish': case 'bigfish': { const k = type === 'bigfish' ? 1.7 : 1, c = type === 'bigfish' ? '#3a8de0' : '#ff8a2a';
      add(S(0.3 * k, 14, 10), mat(c, {roughness: 0.25}), 0, 0, 0, [0.55, 0.8, 1.4]); add(new THREE.ConeGeometry(0.22 * k, 0.4 * k, 4).rotateX(-Math.PI / 2), mat(c), 0, 0, -0.55 * k, [0.25, 1, 1]);
      for (const sx of [-1, 1]) add(S(0.05 * k, 6, 4), mat('#111'), sx * 0.13 * k, 0.08 * k, 0.28 * k);
      add(S(0.2 * k, 8, 6), mat('#fff4d6'), 0, -0.1 * k, 0.05 * k, [0.5, 0.4, 1.1]); body.rotation.z = 0; break; }
    case 'cone': { add(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 6), mat('#8a5a32'), 0, 0.15, 0);
      const cg = new THREE.SphereGeometry(0.4, 10, 12); const o = add(cg, mat('#f08a24', {roughness: 0.6, flatShading: true}), 0, 0.62, 0, [0.9, 1.35, 0.9]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const l = add(new THREE.ConeGeometry(0.1, 1.1, 4), mat('#3c9a3a'), Math.cos(a) * 0.35, 0.35, Math.sin(a) * 0.35); l.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); } break; }
    case 'leaves': { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, l = add(S(0.5, 10, 8), mat(i % 2 ? '#5cc23f' : '#82d64e', {roughness: 0.6}), Math.cos(a) * 0.55, 0.5 + (i % 3) * 0.25, Math.sin(a) * 0.55, [1.4, 0.35, 0.7]); l.rotation.y = -a; l.rotation.z = 0.5; }
      add(S(0.3, 8, 6), mat('#ff7a59'), 0, 1.05, 0); add(S(0.22, 8, 6), mat('#ffd23f'), 0.35, 0.95, 0.2); break; }
    case 'lizard': { add(S(0.22, 12, 8), mat('#46c07a', {roughness: 0.3}), 0, 0.2, 0, [0.8, 0.6, 2]); add(S(0.17, 10, 8), mat('#46c07a'), 0, 0.24, 0.48, [0.9, 0.7, 1.2]);
      add(new THREE.ConeGeometry(0.1, 0.9, 6).rotateX(-Math.PI / 2), mat('#3aa86a'), 0, 0.18, -0.75);
      for (const sx of [-1, 1]) { add(S(0.04, 6, 4), mat('#111'), sx * 0.1, 0.32, 0.58); for (const z of [0.22, -0.2]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 5), mat('#3aa86a'), sx * 0.2, 0.1, z).rotation.z = sx * 0.9; } break; }
  }
  // 把很多小零件合并成一个网格，一只食物只需画一次
  { const geos = [], keep = [];
    body.updateMatrixWorld(true);
    for (const c of body.children) { if (c.userData.wing || c.material.transparent) { keep.push(c); continue; }
      let g = c.geometry.clone(); if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); c.updateMatrix(); g.applyMatrix4(c.matrix);
      const col = c.material.color, n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); if (!g.attributes.normal) g.computeVertexNormals(); geos.push(g); }
    body.clear(); const merged = new THREE.Mesh(mergeGeometries(geos), VCMAT); merged.castShadow = true; body.add(merged); keep.forEach(c => body.add(c)); }
  const k = f.tier === 4 ? 1.25 : f.tier === 3 ? 1.1 : f.tier === 2 ? 1.1 : 1.2; body.scale.multiplyScalar(k);
  if (!f.water) { const ring = new THREE.Mesh(ringGeo, Object.assign(new THREE.MeshBasicMaterial({color: '#fffbd0', transparent: true, opacity: 0.45, depthWrite: false}), {userData: {own: true}})); ring.scale.setScalar(f.r * 1.3); ring.position.y = 0.06; g.add(ring); g.userData.ring = ring; }
  const lock = lockSprite(); lock.scale.setScalar(0.8 + f.r * 0.5); lock.position.y = f.r * 2 + 1 + (type === 'fly' ? 1 : 0); lock.visible = false; g.add(lock); g.userData.lock = lock;
  g.userData.body = body;
  return g;
}

// 每种食物的小动画
const anims = {
  bug: (o, t) => { const b = o.userData.body; b.rotation.y = Math.sin(t * 0.7) * 1.2; b.position.y = 0; },
  fly: (o, t) => { const b = o.userData.body; b.position.y = 1.2 + Math.sin(t * 1.7) * 0.25; b.rotation.y = t * 0.6; b.children.forEach(c => { if (c.userData.wing) c.rotation.z = c.userData.wing * Math.sin(t * 40) * 0.5; }); },
  fish: (o, t) => { const b = o.userData.body; b.position.y = -0.1 + Math.max(0, Math.sin(t * 1.2)) * 0.5; b.rotation.y = Math.sin(t * 0.5) * 2; b.rotation.x = -Math.cos(t * 1.2) * 0.4; },
  flower: (o, t) => { o.userData.body.rotation.z = Math.sin(t * 1.3) * 0.08; },
  leaves: (o, t) => { o.userData.body.rotation.y = Math.sin(t * 0.4) * 0.15; },
  lizard: (o, t) => { const b = o.userData.body; b.rotation.y = Math.sin(t * 0.3) * 2; },
};
anims.bigfish = anims.fish;
for (const k in anims) FOOD[k].anim = anims[k];
