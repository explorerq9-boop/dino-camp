// 自己的小窝：一个大窝 + 一圈可以摆装饰的位置；路上捡到的装饰品可以带回来摆；孵出来的宝宝住在这里
import * as THREE from 'three';
import {makeDino, locomote, DINO} from './dinos.js';
import {H, WATER_Y} from './world.js';

export const DECOR = {
  shell: {name: '贝壳', icon: '🐚', fact: '恐龙时代的海里住着很多贝类，海边能捡到它们的壳。', water: true},
  gem: {name: '彩色石头', icon: '💎', fact: '有些吃植物的恐龙会吞下小石头，帮忙在肚子里磨碎植物，这叫“胃石”。'},
  feather: {name: '羽毛', icon: '🪶', fact: '很多恐龙身上长着羽毛，比如迅猛龙和窃蛋龙。'},
  fossil: {name: '菊石化石', icon: '🐌', fact: '菊石是和恐龙同时代、住在海里的动物，它的壳卷成一圈一圈的。'},
  flower: {name: '大花', icon: '🌺', fact: '开花植物是在恐龙时代后期才出现的。'},
  mush: {name: '蘑菇灯', icon: '🍄', fact: '有些蘑菇真的会在夜里发出淡淡的光。'},
};
export const DECOR_KEYS = Object.keys(DECOR);
const SLOTS = 12;
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// 每种装饰品的 3D 小模型（程序画的）
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.6}, o));
const fossilTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#c9b48a'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#7d6640'; x.lineWidth = 5; x.beginPath(); for (let a = 0; a < 6 * Math.PI; a += 0.1) { const r = 3 + a * 3.1; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke();
  for (let a = 0; a < 6 * Math.PI; a += 0.5) { const r = 3 + a * 3.1; x.beginPath(); x.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); x.lineTo(64 + Math.cos(a) * (r + 9), 64 + Math.sin(a) * (r + 9)); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
export function makeDecor(kind, s = 1) {
  const g = new THREE.Group();
  if (kind === 'shell') { const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 10, 1, true), std('#ffc7b8', {side: THREE.DoubleSide})); m.rotation.z = Math.PI / 2.2; m.position.y = 0.3; const b = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), std('#ffe3d6')); b.scale.set(0.7, 1, 1); b.position.set(-0.3, 0.3, 0); g.add(m, b); }
  if (kind === 'gem') { const cols = ['#a36bff', '#4fc3ff', '#5fe08a']; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 - i * 0.06), std(cols[i], {roughness: 0.2, metalness: 0.1, emissive: cols[i], emissiveIntensity: 0.25, flatShading: true})); m.scale.y = 1.6; m.position.set((i - 1) * 0.3, 0.45 - i * 0.05, i === 1 ? 0.15 : 0); m.rotation.z = (i - 1) * 0.3; g.add(m); } }
  if (kind === 'feather') { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6), std('#7fd3ff')); m.scale.set(0.22, 1, 0.05); m.position.y = 0.55; m.rotation.z = 0.25; const q = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), std('#f4efe0')); q.position.y = 0.5; q.rotation.z = 0.25; const t = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6), std('#ff9e5e')); t.scale.set(0.2, 0.3, 0.06); t.position.set(-0.12, 0.95, 0); t.rotation.z = 0.25; g.add(m, q, t); }
  if (kind === 'fossil') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.18, 20), [std('#b39c70'), std('#fff', {map: fossilTex}), std('#b39c70')]); m.rotation.x = -1.1; m.position.y = 0.45; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), std('#9a9183', {flatShading: true})); r.scale.set(1.3, 0.6, 1); r.position.set(0, 0.12, 0.1); g.add(r, m); }
  if (kind === 'flower') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 5), std('#4f9a3a')); st.position.y = 0.5; g.add(st); for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), std('#ff6fa8')); p.scale.set(1, 0.4, 0.6); const a = i / 6 * Math.PI * 2; p.position.set(Math.cos(a) * 0.22, 1.02, Math.sin(a) * 0.22); p.rotation.y = -a; g.add(p); } const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), std('#ffd23f')); c.position.y = 1.05; g.add(c); }
  if (kind === 'mush') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), std('#f4ead2')); st.position.y = 0.25; const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffb84d', {emissive: '#ffb84d', emissiveIntensity: 0.55})); cap.position.y = 0.45; g.add(st, cap); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(s); return g;
}

export function createHome(C) {
  // C: {scene, PL, G, SV, MOB, tip, burstAt, floatText, tone, save, questEvent, findLand, blocked, glowTex}
  const {scene, PL, SV, G} = C;
  SV.bag = SV.bag || {}; SV.homeDecor = SV.homeDecor || []; SV.homeBabies = SV.homeBabies || [];
  const HM = {grp: null, decor: [], babies: [], items: [], near: false};

  function build() {
    C.world.setClear([{x: SV.home.x, z: SV.home.z, r: 10}]);
    if (HM.grp) { scene.remove(HM.grp); }
    const g = new THREE.Group(), x = SV.home.x, z = SV.home.z; g.position.set(x, H(x, z) - 0.05, z);
    const nest = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.75, 10, 28).rotateX(Math.PI / 2).scale(1, 0.7, 1), new THREE.MeshStandardMaterial({color: '#9a7446', roughness: 1, flatShading: true}));
    nest.position.y = 0.4; nest.castShadow = true; nest.receiveShadow = true;
    const straw = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: '#e8cd86', roughness: 1})); straw.position.y = 0.25;
    g.add(nest, straw);
    // 一圈小石头当“院子”边
    const rockG = new THREE.DodecahedronGeometry(0.35), rockM = new THREE.MeshStandardMaterial({color: '#b6aa96', roughness: 0.9, flatShading: true});
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = 7.2 + Math.sin(i * 3.1) * 0.25, rx = x + Math.cos(a) * r, rz = z + Math.sin(a) * r; const m = new THREE.Mesh(rockG, rockM); m.position.set(Math.cos(a) * r, H(rx, rz) - g.position.y + 0.1, Math.sin(a) * r); m.scale.set(1 + Math.sin(i) * 0.3, 0.7, 1); m.rotation.y = i; g.add(m); }
    // 小旗子，远远就能看见
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), new THREE.MeshStandardMaterial({color: '#8a6a44'})); pole.position.set(0, 2.25, -3.2);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshStandardMaterial({color: '#ff8a3c', side: THREE.DoubleSide})); flag.position.set(0.65, 4.0, -3.2); HM.flag = flag;
    g.add(pole, flag); scene.add(g); HM.grp = g;
    placeDecor();
  }
  function placeDecor() {
    for (const d of HM.decor) HM.grp.remove(d);
    HM.decor = SV.homeDecor.map((k, i) => { const a = i / SLOTS * Math.PI * 2 + 0.26, r = 4.8, dx = Math.cos(a) * r, dz = Math.sin(a) * r;
      const m = makeDecor(k, 1.7); m.position.set(dx, H(SV.home.x + dx, SV.home.z + dz) - HM.grp.position.y, dz); m.rotation.y = -a + Math.PI / 2; HM.grp.add(m); return m; });
  }
  HM.setHome = (x, z) => { SV.home = {x, z}; C.save(); build(); for (const b of HM.babies) scene.remove(b.D.holder); HM.babies = []; };
  if (!SV.home) { const p = C.findLand(PL.x + 14, PL.z + 10, null, 4, 30); SV.home = {x: p.x, z: p.z}; }
  build();

  /* 路上的装饰品 */
  function spawnItem() {
    for (let i = 0; i < 40; i++) {
      const k = DECOR_KEYS[Math.floor(Math.random() * DECOR_KEYS.length)], a = PL.dir + (Math.random() - 0.5) * 3, d = 25 + Math.random() * 70, x = PL.x + Math.sin(a) * d, z = PL.z + Math.cos(a) * d, h = H(x, z);
      if (DECOR[k].water ? (h > 0.1 || h < -0.3) : (h < 0.05)) continue; if (C.blocked(x, z, 1.5)) continue;
      const m = makeDecor(k, 1.1); m.position.set(x, Math.max(h, WATER_Y), z); scene.add(m);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: C.glowTex, transparent: true, depthWrite: false, opacity: 0.8, color: '#e7d2ff'})); glow.scale.set(3, 3, 1); glow.position.y = 0.7; m.add(glow);
      HM.items.push({k, x, z, m, glow, t: Math.random() * 6}); return;
    }
  }
  function dropItem(it) { scene.remove(it.m); it.glow.material.dispose(); it.m.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); HM.items.splice(HM.items.indexOf(it), 1); }
  function pick(it) {
    SV.bag[it.k] = (SV.bag[it.k] || 0) + 1; C.save();
    C.burstAt(it.x, H(it.x, it.z) + 0.8, it.z, '#e7d2ff', 14, 1.1); C.tone([784, 988, 1318], 0.04, 0.08);
    C.floatText(`${DECOR[it.k].icon} 捡到${DECOR[it.k].name}!`, it.x, H(it.x, it.z) + 1.5, it.z);
    const first = !SV.seenDecor || !SV.seenDecor[it.k]; SV.seenDecor = Object.assign(SV.seenDecor || {}, {[it.k]: 1});
    C.tip(`${DECOR[it.k].icon} 捡到${DECOR[it.k].name}！可以带回 🏠 小窝摆起来。${first ? `<br><span class="small">${DECOR[it.k].fact}</span>` : ''}`, first ? 4500 : 2500);
    C.questEvent('collect'); dropItem(it);
  }

  /* 小窝里的宝宝 */
  HM.addBaby = id => { SV.homeBabies.push(id); while (SV.homeBabies.length > 8) SV.homeBabies.shift(); C.save(); for (const b of HM.babies) scene.remove(b.D.holder); HM.babies = []; };
  function updBabies(dt, dHome) {
    if (dHome > 130) { if (HM.babies.length) { for (const b of HM.babies) scene.remove(b.D.holder); HM.babies = []; } return; }
    if (!HM.babies.length && dHome < 100) HM.babies = SV.homeBabies.filter(id => DINO[id]).map((id, i) => { const D = makeDino(id, 1.6 + (i % 3) * 0.2); scene.add(D.holder); const a = i * 1.7; return {D, id, x: SV.home.x + Math.cos(a) * 3, z: SV.home.z + Math.sin(a) * 3, dir: a, v: 0, t: Math.random() * 3, tx: 0, tz: 0, len: D.len}; });
    for (const b of HM.babies) {
      b.t -= dt; if (b.t < 0) { b.t = 2 + Math.random() * 4; const a = Math.random() * 6.28, r = 1.5 + Math.random() * 4.5; b.tx = SV.home.x + Math.cos(a) * r; b.tz = SV.home.z + Math.sin(a) * r; b.go = Math.random() < 0.7; }
      let v = 0; if (b.go) { const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz); if (d > 0.4) { b.dir = wrapA(b.dir + wrapA(Math.atan2(dx, dz) - b.dir) * Math.min(1, dt * 3)); v = DINO[b.id].gait.Walk * b.len * 1.2; } else b.go = false; }
      b.x += Math.sin(b.dir) * v * dt; b.z += Math.cos(b.dir) * v * dt; b.v += (v - b.v) * Math.min(1, dt * 5);
      b.D.holder.position.set(b.x, H(b.x, b.z), b.z); b.D.holder.rotation.y = b.dir; locomote(b.D, b.v, dt); b.D.mixer.update(dt);
    }
  }

  HM.update = (dt, followers) => {
    const dHome = Math.hypot(PL.x - SV.home.x, PL.z - SV.home.z);
    if (HM.flag) HM.flag.rotation.y = Math.sin(G.t * 1.3) * 0.25;
    // 装饰品：附近保持 2~3 个
    if (HM.items.length < (C.MOB ? 2 : 3) && Math.random() < dt * 0.3) spawnItem();
    for (const it of [...HM.items]) { const d = Math.hypot(it.x - PL.x, it.z - PL.z); if (d > 150) { dropItem(it); continue; }
      it.t += dt; it.m.rotation.y += dt * 0.6; it.glow.material.opacity = 0.55 + 0.2 * Math.sin(it.t * 1.5);
      if (d < 1.6 + PL.len * 0.35 && (!G.fly || PL.fy - H(it.x, it.z) < 3)) pick(it); }
    updBabies(dt, dHome);
    const near = dHome < 9;
    if (near && !HM.near) { // 到家了
      let n = 0; if (followers && followers.length) { for (const f of [...followers]) { HM.addBaby(f.id); scene.remove(f.D.holder); n++; } followers.length = 0; }
      C.tip(n ? `🏠 到家啦！${n} 只宝宝住进了小窝。` : '🏠 到家啦！点「装饰小窝」把捡到的东西摆起来。', 3500); C.questEvent('home');
    }
    HM.near = near; return near;
  };

  HM.ui = (box, close) => {
    const bagN = DECOR_KEYS.reduce((a, k) => a + (SV.bag[k] || 0), 0);
    box.innerHTML = `<h1>🏠 我的小窝</h1><p>家里住着 ${SV.homeBabies.length} 只恐龙宝宝${SV.homeBabies.length ? '' : '（孵出来的宝宝带回家就会住在这里）'}，摆了 ${SV.homeDecor.length}/${SLOTS} 个装饰。</p>
      <p style="color:#6c7563">${bagN ? '点下面的东西，把它摆到小窝旁边：' : '背包是空的。在路上找找闪着光的贝壳、彩色石头、羽毛、化石、大花和蘑菇灯吧！'}</p>
      <div class="bag">${DECOR_KEYS.map(k => `<button class="bitem" data-k="${k}" ${SV.bag[k] ? '' : 'disabled'}><span>${DECOR[k].icon}</span><b>${DECOR[k].name}</b><small>× ${SV.bag[k] || 0}</small></button>`).join('')}</div>
      <p><button class="btn light" id="decorBack">把装饰全部收回背包</button></p><button class="btn" id="homeClose">好了</button>`;
    box.querySelectorAll('.bitem').forEach(b => b.onclick = () => { const k = b.dataset.k; if (!SV.bag[k] || SV.homeDecor.length >= SLOTS) { if (SV.homeDecor.length >= SLOTS) C.tip('小窝旁边摆满啦！可以先收回一些。'); return; }
      SV.bag[k]--; SV.homeDecor.push(k); C.save(); placeDecor(); C.questEvent('decorate'); C.tone([659, 880], 0.04, 0.08); HM.ui(box, close); });
    box.querySelector('#decorBack').onclick = () => { for (const k of SV.homeDecor) SV.bag[k] = (SV.bag[k] || 0) + 1; SV.homeDecor = []; C.save(); placeDecor(); HM.ui(box, close); };
    box.querySelector('#homeClose').onclick = close;
  };
  return HM;
}
