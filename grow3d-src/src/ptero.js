// 按真实化石比例做的无齿翼龙（Pteranodon）：
// 长长的没有牙的嘴、向后伸的头冠、短身体，翅膀是一层皮膜，
// 从肩膀经过前臂、用特别长的第四指撑开，后缘一直连到脚踝。飞行以滑翔为主，偶尔慢慢扇几下。
import * as THREE from 'three';

let MATS = null;
function membraneTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#6b4a33'); g.addColorStop(0.55, '#8a6446'); g.addColorStop(1, '#5a3c2a');
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  // 翼膜里的细纤维（actinofibrils），从前缘斜向后缘
  x.strokeStyle = 'rgba(40,25,15,0.22)'; x.lineWidth = 1;
  for (let i = -40; i < 300; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i - 30, 128); x.stroke(); }
  // 皮肤斑驳
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,20,10' : '200,170,130'},${0.05 + Math.random() * 0.06})`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 128, 2 + Math.random() * 6, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function mats() {
  if (MATS) return MATS;
  MATS = {
    skin: new THREE.MeshStandardMaterial({color: '#7d6a58', roughness: 0.8}),
    belly: new THREE.MeshStandardMaterial({color: '#cdbca0', roughness: 0.85}),
    beak: new THREE.MeshStandardMaterial({color: '#b9a27a', roughness: 0.5}),
    crest: new THREE.MeshStandardMaterial({color: '#8a4e34', roughness: 0.6}),
    eye: new THREE.MeshStandardMaterial({color: '#140c08', roughness: 0.2}),
    wing: new THREE.MeshStandardMaterial({map: membraneTex(), roughness: 0.75, side: THREE.DoubleSide, color: '#ffffff'}),
    bone: new THREE.MeshStandardMaterial({color: '#5e4a3a', roughness: 0.7}),
  };
  return MATS;
}

// 单边翅膀的形状（展开时，x 向外，z 向前），单位：翼展一半 = 1
const IN = 0.36; // 腕关节的位置（内段：上臂+前臂；外段：第四指）
const LE = x => 0.05 - x * 0.06 + (x > IN ? -(x - IN) * 0.12 : 0);       // 前缘 z
const TE = x => LE(x) - (0.2 * Math.pow(Math.max(0, 1 - x), 0.75) * (1 - 0.22 * Math.sin(Math.PI * x)) + 0.004); // 后缘：内侧宽（连到脚踝），向翼尖收窄，中间微微内凹
function wingPart(x0, x1, nx, side) {
  const nz = 6, pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx, le = LE(x), te = x >= 0.995 ? le - 0.004 : TE(x);
    for (let j = 0; j <= nz; j++) { const v = j / nz, z = le + (te - le) * v; const sag = Math.sin(v * Math.PI) * 0.012 * (1 - x); // 皮膜微微下垂
      pos.push(side * (x - x0), -sag, z); uv.push(x, v); } }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + nz + 1; if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function limb(a, b, r0, r1, m) { // 从 a 到 b 的细圆柱
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 6), m); o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}

export function makePtero(len, tint = 0) {
  const M = mats(), span = len * 1.45, h = span / 2; // 翼展
  const holder = new THREE.Group(), obj = new THREE.Group(); holder.add(obj);
  const add = (geo, m, x, y, z, s) => { const o = new THREE.Mesh(geo, m); o.position.set(x * h, y * h, z * h); if (s) o.scale.set(...s); o.castShadow = true; obj.add(o); return o; };
  let skin = M.skin; if (tint) { skin = M.skin.clone(); skin.color.offsetHSL(0.01 * tint, -0.05 * tint, 0.05 * tint); }
  // 身体：短小的躯干，背深肚浅
  add(new THREE.SphereGeometry(h * 0.06, 14, 10), skin, 0, 0, 0, [0.8, 0.75, 2.2]);
  add(new THREE.SphereGeometry(h * 0.05, 12, 8), M.belly, 0, -0.016, 0.01, [0.75, 0.55, 1.9]);
  // 脖子
  const neck = limb(new THREE.Vector3(0, 0.02 * h, 0.1 * h), new THREE.Vector3(0, 0.06 * h, 0.22 * h), h * 0.03, h * 0.022, skin); neck.castShadow = true; obj.add(neck);
  // 头：头骨 + 长长的尖嘴（没有牙）+ 向后的头冠
  const head = new THREE.Group(); head.position.set(0, 0.07 * h, 0.24 * h); obj.add(head);
  const hm = (geo, m, x, y, z, s, r) => { const o = new THREE.Mesh(geo, m); o.position.set(x * h, y * h, z * h); if (s) o.scale.set(...s); if (r) o.rotation.set(...r); o.castShadow = true; head.add(o); return o; };
  hm(new THREE.SphereGeometry(h * 0.035, 12, 8), skin, 0, 0, 0, [0.75, 0.9, 1.3]);
  hm(new THREE.ConeGeometry(h * 0.024, h * 0.3, 8).rotateX(Math.PI / 2), M.beak, 0, -0.008, 0.17, [0.65, 1, 1]);          // 上喙
  hm(new THREE.ConeGeometry(h * 0.016, h * 0.27, 8).rotateX(Math.PI / 2), M.beak, 0, -0.022, 0.155, [0.6, 0.8, 1]);         // 下喙
  hm(new THREE.ConeGeometry(h * 0.04, h * 0.26, 10).rotateX(-Math.PI / 2), M.crest, 0, 0.03, -0.13, [0.12, 1, 1], [0.28, 0, 0]); // 头冠（侧扁，向后上方伸）
  for (const sx of [-1, 1]) hm(new THREE.SphereGeometry(h * 0.007, 8, 6), M.eye, sx * 0.022, 0.01, 0.025);
  // 后腿和小尾巴
  for (const sx of [-1, 1]) { obj.add(limb(new THREE.Vector3(sx * 0.03 * h, -0.02 * h, -0.1 * h), new THREE.Vector3(sx * 0.05 * h, -0.03 * h, -0.2 * h), h * 0.012, h * 0.008, skin)); }
  add(new THREE.ConeGeometry(h * 0.012, h * 0.06, 5).rotateX(-Math.PI / 2), skin, 0, 0.005, -0.15);
  // 翅膀：内段绕肩膀转，外段绕手腕再转一点（翼指）
  const wings = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.05 * h, 0.02 * h, 0.04 * h); obj.add(sh);
    const inner = new THREE.Mesh(wingPart(0, IN, 6, sx), M.wing); inner.scale.setScalar(h); inner.castShadow = true; sh.add(inner);
    sh.add(limb(new THREE.Vector3(0, 0, LE(0) * h), new THREE.Vector3(sx * IN * h, 0, LE(IN) * h), h * 0.016, h * 0.011, M.bone));
    const wr = new THREE.Group(); wr.position.set(sx * IN * h, 0, 0); sh.add(wr);
    const outer = new THREE.Mesh(wingPart(IN, 1, 10, sx), M.wing); outer.scale.setScalar(h); outer.castShadow = true; wr.add(outer);
    wr.add(limb(new THREE.Vector3(0, 0, LE(IN) * h), new THREE.Vector3(sx * (1 - IN) * h, 0, LE(1) * h), h * 0.009, h * 0.003, M.bone));
    // 小小的三根手指（爪子）在腕关节前面
    wr.add(limb(new THREE.Vector3(0, 0, LE(IN) * h), new THREE.Vector3(sx * 0.02 * h, -0.01 * h, (LE(IN) + 0.04) * h), h * 0.005, h * 0.002, M.bone));
    wings.push({sh, wr, sx});
  }
  obj.position.y = len * 0.15;
  // 和普通恐龙一样的接口：mixer.update(dt) 推动扇翅/滑翔，acts.Walk.timeScale 控制用力程度
  const st = {ph: Math.random() * 6, glide: 1 + Math.random() * 3, flapN: 0};
  const walk = {timeScale: 1, play() {}, reset() { return walk; }, setEffectiveWeight() {}, stop() {}};
  const acts = {Walk: walk, Idle: walk};
  const mixer = {
    stopAllAction() {}, uncacheRoot() {},
    update(dt) {
      const eff = walk.timeScale; // >1.3 表示正在爬升，要一直扇
      if (st.glide > 0 && eff < 1.3) { st.glide -= dt; st.amp = (st.amp ?? 0) + (0 - (st.amp ?? 0)) * Math.min(1, dt * 2); if (st.glide <= 0) st.flapN = 2 + Math.floor(Math.random() * 2); }
      else { st.amp = (st.amp ?? 0) + (1 - (st.amp ?? 0)) * Math.min(1, dt * 3); const prev = st.ph; st.ph += dt * (4.2 + Math.max(0, eff - 1) * 1.5);
        if (Math.floor(prev / 6.283) !== Math.floor(st.ph / 6.283) && eff < 1.3 && --st.flapN <= 0) st.glide = 3 + Math.random() * 4; }
      const s = Math.sin(st.ph), a = st.amp;
      for (const w of wings) {
        // 滑翔：翅膀平伸、略微上翘；扇翅：上下 ~35°，外段跟着慢半拍
        w.sh.rotation.z = w.sx * (0.06 + a * s * 0.55);
        w.wr.rotation.z = w.sx * (0.04 + a * Math.sin(st.ph - 0.7) * 0.35);
        w.sh.rotation.y = -w.sx * a * Math.cos(st.ph) * 0.08;
      }
      obj.position.y = len * 0.15 - a * s * len * 0.03;
      head.rotation.x = Math.sin(st.ph * 0.5) * 0.04 * a;
    },
  };
  mixer.update(0);
  return {holder, obj, mixer, acts, cur: 'Walk', id: 'ptero', len, proc: true};
}
