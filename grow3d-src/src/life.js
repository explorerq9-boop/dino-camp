// 让世界更“活”：恐龙宝宝跟着妈妈、天上的翼龙、水里的蛇颈龙、恐龙蛋窝、蜻蜓、飘浮的花粉、脚印和水波
import * as THREE from 'three';
import {makeDino, locomote, headTurn, DINO, GOB} from './dinos.js';
import {H, WATER_Y, biomeAt} from './world.js';

const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function createLife(C) {
  // C: {scene, PL, G, MOB, SV, tip, burstAt, floatText, gainXP, questEvent, tone, onDiscover}
  const {scene, PL, G, MOB} = C;
  const L = {babies: [], fliers: [], swimmers: [], nest: null, nestCD: 8, followers: [], flies: []};

  /* ----- 1. 恐龙宝宝跟着妈妈走 ----- */
  const BABY_OF = {tri: 'gtri', steg: 'gsteg', trex: 'gtrex', anky: 'anky', pachy: 'pachy'};
  L.addBabies = (n, len) => {
    const bid = BABY_OF[n.id]; if (!bid || !DINO[bid]) return;
    const cnt = MOB ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < cnt; i++) { const bl = len * (0.24 + Math.random() * 0.06), D = makeDino(bid, bl); scene.add(D.holder);
      L.babies.push({D, id: bid, len: bl, mom: n, side: i ? -1 : 1, x: n.x, z: n.z, dir: n.dir, v: 0, ph: Math.random() * 6}); }
  };
  function updBabies(dt) {
    for (const b of L.babies) {
      const m = b.mom, ml = m.D.len, back = ml * 0.45 + b.len * 0.8, side = ml * 0.22 * b.side;
      const tx = m.x - Math.sin(m.dir) * back + Math.cos(m.dir) * side, tz = m.z - Math.cos(m.dir) * back - Math.sin(m.dir) * side;
      let dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      if (d > 40) { b.x = tx; b.z = tz; d = 0; } // 妈妈被“搬走”了，宝宝也跟着
      const g = DINO[b.id].gait, walkV = g.Walk * b.len * 1.3;
      let v = 0; if (d > 0.6) { const want = Math.atan2(dx, dz); b.dir = wrapA(b.dir + wrapA(want - b.dir) * Math.min(1, dt * 4)); v = Math.min(walkV * 2.2, d * 1.5 + (m.v || 0)); }
      else b.dir = wrapA(b.dir + wrapA(m.dir - b.dir) * Math.min(1, dt * 2));
      b.x += Math.sin(b.dir) * v * dt; b.z += Math.cos(b.dir) * v * dt; b.v += (v - b.v) * Math.min(1, dt * 5);
      const vis = m.D.holder.visible; b.D.holder.visible = vis;
      b.D.holder.position.set(b.x, H(b.x, b.z), b.z); b.D.holder.rotation.y = b.dir;
      if (vis) { locomote(b.D, b.v, dt); b.D.mixer.update(dt); }
    }
  }

  /* ----- 2. 天上的翼龙 ----- */
  const PN = MOB ? 2 : 4;
  for (let i = 0; i < PN && DINO.ptero; i++) { const D = makeDino('ptero', 3.2 + Math.random() * 1.5, i % 2 ? 0.6 : 0); scene.add(D.holder);
    D.mixer.stopAllAction(); const a = D.acts.Walk; a.play(); a.timeScale = 0.9 + Math.random() * 0.3;
    L.fliers.push({D, cx: 0, cz: 0, r: 25 + Math.random() * 30, h: 20 + Math.random() * 18, sp: (0.12 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1), a: Math.random() * 6.28, init: false}); }
  function updFliers(dt) {
    for (const f of L.fliers) {
      if (!f.init || Math.hypot(f.cx - PL.x, f.cz - PL.z) > 110) { const a = PL.dir + (Math.random() - 0.5) * 2, d = 30 + Math.random() * 50; f.cx = PL.x + Math.sin(a) * d; f.cz = PL.z + Math.cos(a) * d; f.init = true; }
      f.a += f.sp * dt; f.cx += Math.sin(PL.dir) * 0.6 * dt; const x = f.cx + Math.cos(f.a) * f.r, z = f.cz + Math.sin(f.a) * f.r;
      const gy = Math.max(H(x, z), WATER_Y), y = gy + f.h + Math.sin(f.a * 3) * 2;
      f.D.holder.position.set(x, y, z); f.D.holder.rotation.set(0, Math.atan2(-Math.sin(f.a) * Math.sign(f.sp), Math.cos(f.a) * Math.sign(f.sp)), 0);
      f.D.holder.rotation.z = -0.25 * Math.sign(f.sp); f.D.mixer.update(dt);
    }
  }

  /* ----- 3. 水里的蛇颈龙 ----- */
  const deepAt = (x, z) => H(x, z) < -1.0;
  function findDeep(rmin, rmax) { for (let i = 0; i < 120; i++) { const a = Math.random() * 6.28, d = rmin + Math.random() * (rmax - rmin), x = PL.x + Math.sin(a) * d, z = PL.z + Math.cos(a) * d; if (deepAt(x, z) && deepAt(x + 3, z) && deepAt(x - 3, z) && deepAt(x, z + 3) && deepAt(x, z - 3)) return {x, z}; } return null; }
  for (let i = 0; i < (MOB ? 1 : 2) && DINO.plesio; i++) { const D = makeDino('plesio', 4.2 + Math.random(), i ? 0.5 : 0); D.holder.visible = false; scene.add(D.holder); D.mixer.stopAllAction(); D.acts.Walk.play(); D.acts.Walk.timeScale = 0.6;
    L.swimmers.push({D, x: 0, z: 0, dir: Math.random() * 6, on: false, retry: 0, rip: 0}); }
  function updSwimmers(dt) {
    for (const s of L.swimmers) {
      if (!s.on || Math.hypot(s.x - PL.x, s.z - PL.z) > 140) { s.retry -= dt; s.D.holder.visible = false; s.on = false; if (s.retry > 0) continue; s.retry = 3; const p = findDeep(20, 110); if (!p) continue; s.x = p.x; s.z = p.z; s.on = true; }
      const sp = 1.4, nx = s.x + Math.sin(s.dir) * sp * dt * 3, nz = s.z + Math.cos(s.dir) * sp * dt * 3;
      if (!deepAt(nx, nz)) s.dir += dt * 0.5; else { s.x += Math.sin(s.dir) * sp * dt; s.z += Math.cos(s.dir) * sp * dt; s.dir += Math.sin(C.G.t * 0.3 + s.x) * dt * 0.2; }
      s.D.holder.visible = true; s.D.holder.position.set(s.x, WATER_Y - s.D.len * 0.17 + Math.sin(C.G.t * 1.2) * 0.05, s.z); s.D.holder.rotation.y = s.dir; s.D.mixer.update(dt);
      if ((s.rip -= dt) < 0) { s.rip = 0.7; ripple(s.x + Math.sin(s.dir) * s.D.len * 0.3, s.z + Math.cos(s.dir) * s.D.len * 0.3, 1.2); }
    }
  }

  /* ----- 4. 恐龙蛋窝：走近就会孵出恐龙宝宝，跟着你走 ----- */
  const eggTex = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#fbf3df'; x.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { x.fillStyle = ['#c9a46a', '#a7c48a', '#b98ab0'][i % 3]; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 3, 0, 7); x.fill(); } });
  const eggGeo = new THREE.SphereGeometry(0.3, 14, 10).scale(1, 1.3, 1).translate(0, 0.36, 0);
  const eggMat = new THREE.MeshStandardMaterial({map: eggTex, roughness: 0.5});
  const nestGeo = new THREE.TorusGeometry(0.95, 0.32, 8, 22).rotateX(Math.PI / 2).scale(1, 0.75, 1);
  const nestMat = new THREE.MeshStandardMaterial({color: '#9a7446', roughness: 1, flatShading: true});
  const strawGeo = new THREE.CircleGeometry(0.85, 16).rotateX(-Math.PI / 2).translate(0, 0.12, 0), strawMat = new THREE.MeshStandardMaterial({color: '#e3c57a', roughness: 1});
  const glowTex = canvasTex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,240,170,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const HATCH = ['ovi', 'gtri', 'gsteg', 'anky', 'pachy', 'gtrex'];
  const BABY_NAME = {ovi: '窃蛋龙', gtri: '三角龙', gsteg: '剑龙', anky: '甲龙', pachy: '肿头龙', gtrex: '霸王龙'};
  function makeNest(x, z) {
    const g = new THREE.Group(), y = H(x, z); g.position.set(x, y - 0.05, z);
    const nm = new THREE.Mesh(nestGeo, nestMat); nm.position.y = 0.18; nm.castShadow = true; g.add(nm, new THREE.Mesh(strawGeo, strawMat));
    const eggs = []; for (let i = 0; i < 3; i++) { const e = new THREE.Mesh(eggGeo, eggMat); const a = i * 2.1 + 0.3; e.position.set(Math.cos(a) * 0.38, 0.05, Math.sin(a) * 0.38); e.rotation.z = (Math.random() - 0.5) * 0.4; e.castShadow = true; g.add(e); eggs.push(e); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, transparent: true, depthWrite: false, opacity: 0.7})); glow.scale.set(4, 4, 1); glow.position.y = 0.8; g.add(glow);
    g.scale.setScalar(Math.max(1, PL.len * 0.25)); scene.add(g);
    return {g, eggs, glow, x, z, t: 0, hatching: 0, kind: HATCH[Math.floor(Math.random() * HATCH.length)]};
  }
  function dropNest() { if (!L.nest) return; scene.remove(L.nest.g); L.nest.glow.material.dispose(); L.nest = null; }
  function updNest(dt) {
    const N = L.nest;
    if (!N) { if ((L.nestCD -= dt) > 0) return; L.nestCD = 3;
      for (let i = 0; i < 40; i++) { const a = PL.dir + (Math.random() - 0.5) * 2.6, d = 35 + Math.random() * 45, x = PL.x + Math.sin(a) * d, z = PL.z + Math.cos(a) * d;
        if (H(x, z) < 0.05 || C.blocked(x, z, 3) || biomeAt(x, z) === 'river') continue; L.nest = makeNest(x, z); return; }
      return; }
    N.t += dt; const d = Math.hypot(N.x - PL.x, N.z - PL.z);
    if (d > 170) { dropNest(); L.nestCD = 10; return; }
    N.glow.material.opacity = 0.45 + 0.15 * Math.sin(N.t * 1.5);
    if (!N.hatching && d < 2.6 + PL.len * 0.45) { N.hatching = 0.0001; C.tone([523, 659, 784], 0.04, 0.12); }
    if (N.hatching) { N.hatching += dt; const k = N.hatching;
      N.eggs.forEach((e, i) => { e.rotation.z = Math.sin(k * 14 + i * 2) * 0.25 * Math.min(1, k); });
      if (k > 1.4) hatch(N); }
  }
  function hatch(N) {
    const s = N.g.scale.x, y = H(N.x, N.z);
    C.burstAt(N.x, y + 0.6 * s, N.z, '#fbf3df', 16, 1.1); C.burstAt(N.x, y + 0.8 * s, N.z, '#ffe27a', 10, 1.3);
    const id = N.kind, len = Math.max(0.9, PL.len * 0.32), D = makeDino(id, len); D.holder.position.set(N.x, y, N.z); scene.add(D.holder);
    const nm = BABY_NAME[id];
    L.followers.push({D, id, len, x: N.x, z: N.z, dir: Math.random() * 6, v: 0, t: 0, slot: L.followers.length});
    while (L.followers.length > 3) { const f = L.followers.shift(); if (C.toHome) C.toHome(f); else { f.leaving = 4; L.leaving = (L.leaving || []).concat(f); } }
    L.followers.forEach((f, i) => f.slot = i);
    const xp = 3 + C.SV.stage * 2; C.floatText(`+${xp} 🐣 小${nm}破壳啦!`, N.x, y + 2, N.z); C.gainXP(xp);
    C.tip(`🐣 小${nm}破壳啦！它会跟着你走。<br><span class="small">恐龙宝宝都是从蛋里孵出来的。${id === 'ovi' ? '窃蛋龙其实会像鸟一样趴在蛋上孵蛋。' : '有些恐龙爸爸妈妈会守在窝边照顾宝宝。'}</span>`, 4500);
    C.questEvent('nest'); C.onDiscover && C.onDiscover(id === 'gtri' ? 'tri' : id === 'gsteg' ? 'steg' : id === 'gtrex' ? 'trex' : id);
    scene.remove(N.g); N.glow.material.dispose(); L.nest = null; L.nestCD = 25;
  }
  function updFollowers(dt) {
    for (const f of L.followers) {
      const back = PL.len * 0.35 + 0.6 + f.slot * 0.9, sideK = (f.slot % 2 ? -1 : 1) * (PL.len * 0.3 + 1.4 + f.slot * 0.5);
      const tx = PL.x - Math.sin(PL.dir) * back + Math.cos(PL.dir) * sideK, tz = PL.z - Math.cos(PL.dir) * back - Math.sin(PL.dir) * sideK;
      const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
      if (d > 60) { f.x = tx; f.z = tz; }
      const g = DINO[f.id].gait, walkV = g.Walk * f.len * 1.3; let v = 0;
      if (d > 0.7) { f.dir = wrapA(f.dir + wrapA(Math.atan2(dx, dz) - f.dir) * Math.min(1, dt * 5)); v = Math.min(Math.max(walkV * 3, Math.abs(PL.spd) * 1.15), d * 1.8); }
      f.x += Math.sin(f.dir) * v * dt; f.z += Math.cos(f.dir) * v * dt; f.v += (v - f.v) * Math.min(1, dt * 6);
      f.D.holder.position.set(f.x, Math.max(H(f.x, f.z), WATER_Y - 0.1), f.z); f.D.holder.rotation.y = f.dir; locomote(f.D, f.v, dt); f.D.mixer.update(dt);
    }
    if (L.leaving) for (const f of [...L.leaving]) { f.leaving -= dt; f.x += Math.sin(f.dir) * 2 * dt; f.z += Math.cos(f.dir) * 2 * dt; f.D.holder.position.set(f.x, H(f.x, f.z), f.z); locomote(f.D, 2, dt); f.D.mixer.update(dt);
      if (f.leaving <= 0) { scene.remove(f.D.holder); L.leaving.splice(L.leaving.indexOf(f), 1); } }
  }

  /* ----- 5. 水边的蜻蜓 ----- */
  const dfGeo = new THREE.BoxGeometry(0.05, 0.05, 0.5), wingGeo = new THREE.PlaneGeometry(0.55, 0.12).rotateX(-Math.PI / 2);
  const dfMat = new THREE.MeshStandardMaterial({color: '#2f7fd8', roughness: 0.4, metalness: 0.2}), wingMat = new THREE.MeshBasicMaterial({color: '#e8f8ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false});
  for (let i = 0; i < (MOB ? 4 : 8); i++) { const g = new THREE.Group(); g.add(new THREE.Mesh(dfGeo, i % 2 ? new THREE.MeshStandardMaterial({color: '#d8553a', roughness: 0.4}) : dfMat));
    const w1 = new THREE.Mesh(wingGeo, wingMat), w2 = new THREE.Mesh(wingGeo, wingMat); w1.position.z = 0.06; w2.position.z = -0.04; g.add(w1, w2); g.visible = false; scene.add(g);
    L.flies.push({g, w1, w2, x: 0, z: 0, hx: 0, hz: 0, on: false, t: Math.random() * 3, ph: Math.random() * 6}); }
  function updFlies(dt) {
    for (const f of L.flies) {
      if (!f.on || Math.hypot(f.hx - PL.x, f.hz - PL.z) > 60) { f.on = false; f.g.visible = false; if ((f.retry = (f.retry || 0) - dt) > 0) continue; f.retry = 1.5 + Math.random();
        for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, d = 6 + Math.random() * 30, x = PL.x + Math.sin(a) * d, z = PL.z + Math.cos(a) * d; if (H(x, z) < -0.4 && H(x, z) > -1.6) { f.hx = f.x = x; f.hz = f.z = z; f.on = true; break; } }
        if (!f.on) continue; }
      f.t -= dt; if (f.t < 0) { f.t = 0.6 + Math.random() * 1.6; f.tx = f.hx + (Math.random() - 0.5) * 8; f.tz = f.hz + (Math.random() - 0.5) * 8; }
      const ox = f.x, oz = f.z; f.x += ((f.tx ?? f.x) - f.x) * Math.min(1, dt * 2.5); f.z += ((f.tz ?? f.z) - f.z) * Math.min(1, dt * 2.5);
      f.g.visible = true; f.g.position.set(f.x, WATER_Y + 0.7 + Math.sin(C.G.t * 2 + f.ph) * 0.15, f.z);
      if (Math.hypot(f.x - ox, f.z - oz) > 0.002) f.g.rotation.y = Math.atan2(f.x - ox, f.z - oz);
      const fl = Math.sin(C.G.t * 40 + f.ph) * 0.35; f.w1.rotation.z = fl; f.w2.rotation.z = -fl;
    }
  }

  /* ----- 6. 空中飘的花粉和小种子（慢慢飘，不闪） ----- */
  const PCN = MOB ? 70 : 160, pPos = new Float32Array(PCN * 3), pSeed = new Float32Array(PCN);
  for (let i = 0; i < PCN; i++) { pPos[i * 3] = (Math.random() - 0.5) * 60; pPos[i * 3 + 1] = Math.random() * 9; pPos[i * 3 + 2] = (Math.random() - 0.5) * 60; pSeed[i] = Math.random() * 100; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const dotTex = canvasTex(32, 32, (x, w) => { const g = x.createRadialGradient(16, 16, 1, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(1, 'rgba(255,255,240,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const pollen = new THREE.Points(pg, new THREE.PointsMaterial({map: dotTex, size: 0.22, transparent: true, opacity: 0.75, depthWrite: false, color: '#fff6cf', sizeAttenuation: true}));
  pollen.frustumCulled = false; scene.add(pollen);
  function updPollen(dt) {
    const t = C.G.t, A = pg.attributes.position.array;
    for (let i = 0; i < PCN; i++) { let x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2], s = pSeed[i];
      x += (0.35 + Math.sin(t * 0.3 + s) * 0.3) * dt; z += Math.cos(t * 0.27 + s * 1.7) * 0.3 * dt; y += Math.sin(t * 0.5 + s * 3) * 0.12 * dt;
      // 绕着玩家循环
      const rx = x + pollen.position.x - PL.x, rz = z + pollen.position.z - PL.z;
      if (rx > 30) x -= 60; if (rx < -30) x += 60; if (rz > 30) z -= 60; if (rz < -30) z += 60; if (y > 10) y = 0.5; if (y < 0.3) y = 9;
      A[i * 3] = x; A[i * 3 + 1] = y; A[i * 3 + 2] = z; }
    pg.attributes.position.needsUpdate = true; pollen.position.y = Math.max(H(PL.x, PL.z), WATER_Y);
  }

  /* ----- 7. 脚印和水波 ----- */
  const footTex = canvasTex(64, 64, (x) => { x.fillStyle = 'rgba(70,45,20,0.55)'; x.beginPath(); x.ellipse(32, 38, 12, 16, 0, 0, 7); x.fill(); for (const a of [-0.6, 0, 0.6]) { x.beginPath(); x.ellipse(32 + Math.sin(a) * 18, 30 - Math.cos(a) * 20, 5, 9, a, 0, 7); x.fill(); } });
  const ringTex = canvasTex(64, 64, (x) => { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.stroke(); });
  const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const marks = [];
  function mark(tex, x, y, z, s, rot, life, grow) {
    const m = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, opacity: 1, polygonOffset: true, polygonOffsetFactor: -2}));
    m.position.set(x, y, z); m.rotation.y = rot; m.scale.setScalar(s); m.renderOrder = 2; scene.add(m); marks.push({m, life, max: life, grow, s});
    while (marks.length > (MOB ? 40 : 80)) { const o = marks.shift(); scene.remove(o.m); o.m.material.dispose(); }
  }
  function ripple(x, z, s) { mark(ringTex, x, WATER_Y + 0.03, z, s, 0, 1.6, 2.2); }
  L.ripple = ripple;
  let stepT = 0, foot = 1, ripT = 0;
  function updMarks(dt) {
    for (let i = marks.length - 1; i >= 0; i--) { const o = marks[i]; o.life -= dt; const k = 1 - o.life / o.max;
      if (o.grow) o.m.scale.setScalar(o.s * (1 + k * o.grow)); o.m.material.opacity = o.grow ? (1 - k) * 0.8 : Math.min(1, o.life / 2) * 0.9;
      if (o.life <= 0) { scene.remove(o.m); o.m.material.dispose(); marks.splice(i, 1); } }
    const sp = Math.abs(PL.animV || PL.spd || 0), gy = H(PL.x, PL.z);
    if (sp > 0.3) {
      // 走在水里：一圈圈水波，跑起来还有水花
      if (gy < WATER_Y + 0.05) { if ((ripT -= dt) < 0) { ripT = sp > PL.walkSpd * 1.6 ? 0.18 : 0.35; ripple(PL.x + (Math.random() - 0.5) * PL.len * 0.3, PL.z + (Math.random() - 0.5) * PL.len * 0.3, 0.6 + PL.len * 0.25); if (sp > PL.walkSpd * 1.6) C.burstAt(PL.x, WATER_Y + 0.2, PL.z, '#d8f6ff', 3, 0.5 + PL.len * 0.05); } }
      else {
        // 软软的沙地、红土和河岸上留下脚印
        const b = biomeAt(PL.x, PL.z), soft = b === 'palm' || b === 'mesa' || gy < 0.25;
        stepT -= dt * sp / Math.max(0.3, PL.len * 0.35);
        if (soft && stepT < 0) { stepT = 1; foot = -foot; const s = 0.25 + PL.len * 0.1, ox = Math.cos(PL.dir) * foot * PL.len * 0.08, oz = -Math.sin(PL.dir) * foot * PL.len * 0.08;
          mark(footTex, PL.x + ox, gy + 0.04, PL.z + oz, s, PL.dir + Math.PI, 7, 0); }
      }
    }
  }


  /* ----- 8. 迷路的恐龙宝宝：带它回家找妈妈 ----- */
  const emojiTex = (e) => canvasTex(64, 64, (x) => { x.font = '48px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 32, 36); });
  const qTex = emojiTex('❓'), heartTex = emojiTex('💗');
  const BNAME = {gtri: '三角龙', gsteg: '剑龙', gtrex: '霸王龙', anky: '甲龙', pachy: '肿头龙'};
  L.lost = null; L.lostCD = 40;
  function spawnLost() {
    const moms = C.G.npcs.filter(n => BABY_OF[n.id] && DINO[BABY_OF[n.id]] && !n.keep);
    if (!moms.length) return;
    const mom = moms[Math.floor(Math.random() * moms.length)];
    if (!C.placeNear(mom, 70, 115)) return; mom.keep = true;
    let p = null; for (let i = 0; i < 40 && !p; i++) { const a = PL.dir + (Math.random() - 0.5) * 2.2, d = 22 + Math.random() * 22, x = PL.x + Math.sin(a) * d, z = PL.z + Math.cos(a) * d; if (H(x, z) > 0.05 && !C.blocked(x, z, 2)) p = {x, z}; }
    if (!p) { mom.keep = false; return; }
    const id = BABY_OF[mom.id], len = Math.max(0.9, Math.min(PL.len * 0.5, mom.D.len * 0.26)), D = makeDino(id, len); scene.add(D.holder);
    const q = new THREE.Sprite(new THREE.SpriteMaterial({map: qTex, transparent: true, depthWrite: false})); q.scale.setScalar(0.9); scene.add(q);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({map: heartTex, transparent: true, depthWrite: false})); h.scale.setScalar(2.4); scene.add(h);
    L.lost = {D, id, len, mom, x: p.x, z: p.z, dir: Math.random() * 6, v: 0, st: 'wait', q, h, name: BNAME[id]};
  }
  function endLost(L0) { scene.remove(L0.q, L0.h); L0.q.material.dispose(); L0.h.material.dispose(); L0.mom.keep = false; L.lost = null; }
  L.heard = () => { const B = L.lost; if (B && B.st === 'wait' && Math.hypot(B.x - PL.x, B.z - PL.z) < 70) { B.st = 'follow'; C.tip(`小${B.name}听到你的叫声，跑过来啦！带它去找妈妈 💗`, 4000); C.questEvent('lostfound'); return true; } return false; };
  function updLost(dt) {
    const B = L.lost;
    if (!B) { if ((L.lostCD -= dt) < 0) { L.lostCD = 20; spawnLost(); if (L.lost && !C.SV.lostTip) { C.SV.lostTip = 1; C.tip('❓ 有一只恐龙宝宝迷路了！小地图上的 ❓ 就是它。', 4500); } } return; }
    const dP = Math.hypot(B.x - PL.x, B.z - PL.z), m = B.mom;
    if (dP > 190) { scene.remove(B.D.holder); endLost(B); L.lostCD = 30; return; }
    let v = 0;
    if (B.st === 'wait') { B.dir += Math.sin(C.G.t * 0.25) * dt * 0.15; if (dP < 3 + PL.len * 0.5) { B.st = 'follow'; C.tip(`小${B.name}迷路了，带它去找妈妈吧！<br><span class="small">妈妈在小地图上 💗 的地方，头上也有一颗 💗。</span>`, 5000); C.questEvent('lostfound'); } }
    else {
      const back = PL.len * 0.4 + 1.0, tx = PL.x - Math.sin(PL.dir) * back, tz = PL.z - Math.cos(PL.dir) * back, dx = tx - B.x, dz = tz - B.z, d = Math.hypot(dx, dz);
      if (d > 60) { B.x = tx; B.z = tz; }
      const walkV = DINO[B.id].gait.Walk * B.len * 1.3;
      if (d > 0.7) { B.dir = wrapA(B.dir + wrapA(Math.atan2(dx, dz) - B.dir) * Math.min(1, dt * 5)); v = Math.min(Math.max(walkV * 3, Math.abs(PL.spd) * 1.15), d * 1.8); }
      B.x += Math.sin(B.dir) * v * dt; B.z += Math.cos(B.dir) * v * dt;
      if (Math.hypot(B.x - m.x, B.z - m.z) < m.D.len * 0.8 + 4) { // 找到妈妈了
        const y = H(B.x, B.z); C.burstAt(B.x, y + 1, B.z, '#ff8fb8', 18, 1.2); C.burstAt(m.x, y + m.D.len * 0.4, m.z, '#ffd1e3', 14, 1.4);
        const xp = 6 + C.SV.stage * 3; C.floatText(`+${xp} 💗 小${B.name}找到妈妈啦!`, B.x, y + 2, B.z); C.gainXP(xp); C.tone([523, 659, 784, 1046], 0.05, 0.12);
        C.tip(`💗 小${B.name}找到妈妈啦！谢谢你！<br><span class="small">科学家发现过很多恐龙一起筑巢的地方，有些恐龙会成群生活、照顾宝宝。</span>`, 5000);
        L.babies.push({D: B.D, id: B.id, len: B.len, mom: m, side: Math.random() < 0.5 ? 1 : -1, x: B.x, z: B.z, dir: B.dir, v: 0, ph: 0});
        C.questEvent('lost'); endLost(B); L.lostCD = 60; return; }
    }
    B.v += (v - B.v) * Math.min(1, dt * 6);
    B.D.holder.position.set(B.x, Math.max(H(B.x, B.z), WATER_Y - 0.1), B.z); B.D.holder.rotation.y = B.dir; locomote(B.D, B.v, dt); B.D.mixer.update(dt);
    B.q.visible = B.st === 'wait'; B.q.position.set(B.x, H(B.x, B.z) + B.len * 0.9 + 0.6 + Math.sin(C.G.t * 2) * 0.1, B.z);
    B.h.visible = B.st === 'follow' && m.D.holder.visible; B.h.position.set(m.x, H(m.x, m.z) + m.D.len * 0.75 + 1.5 + Math.sin(C.G.t * 1.5) * 0.2, m.z);
  }

  L.update = dt => { updLost(dt); updBabies(dt); updFliers(dt); updSwimmers(dt); updNest(dt); updFollowers(dt); updFlies(dt); updPollen(dt); updMarks(dt); };
  L.resetNest = () => { dropNest(); L.nestCD = 5; };
  return L;
}
