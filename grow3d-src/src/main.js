import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SPECIES, prepDino, makeDino, measureGait, locomote, bite, headTurn, DINO} from './dinos.js';
import {RNG, BOUND, WATER_Y, H, riverZ, riverD, biomeAt, BIOMES, MESAS, buildTerrain, buildWater, buildMesas, buildSky, makeInstancer, buildFlowerField, cullChunks, WIND, NEAR} from './world.js';
import {FOOD, FOOD_KEYS, makeFood} from './food.js';

const $ = id => document.getElementById(id);
const KEY = 'dinogrow3d_v1';
const SV = Object.assign({stage: 0, path: ['baby'], xp: 0, sound: false, seen: false, done: []}, JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => localStorage.setItem(KEY, JSON.stringify(SV));

// 阶段：0 宝宝 → 1 二选一 → 2 二选一 → 3 最终形态
const STAGES = [{opts: ['baby']}, {opts: ['raptor', 'para']}, {opts: ['steg', 'tri']}, {opts: ['trex', 'apato']}];
const NEED = [10, 18, 28, Infinity];
const LEN = {baby: 1.9, raptor: 3.4, para: 4.6, steg: 6.4, tri: 6.4, trex: 9.5, apato: 13};
const NPC_LEN = {raptor: 3.6, para: 7, steg: 7.5, tri: 7.5, trex: 10.5, apato: 17};
const modelOf = id => id === 'baby' ? 'raptor' : id;
const spInfo = id => id === 'baby' ? Object.assign({}, SPECIES.raptor, {name: '迅猛龙宝宝'}) : SPECIES[id];
const curId = () => SV.path[SV.stage];
// 存档保护：如果存档坏了就重来
if (!(SV.stage >= 0 && SV.stage < STAGES.length) || SV.path.length !== SV.stage + 1 || SV.path.some(p => !LEN[p])) { SV.stage = 0; SV.path = ['baby']; SV.xp = 0; }

/* ---------- 声音（默认关） ---------- */
let actx = null;
function tone(fs, vol = 0.05, gap = 0.12) { if (!SV.sound) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t0 = actx.currentTime;
  fs.forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + i * gap); g.gain.linearRampToValueAtTime(vol, t0 + i * gap + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * gap + 0.35); o.connect(g).connect(actx.destination); o.start(t0 + i * gap); o.stop(t0 + i * gap + 0.4); }); } catch (e) {} }
function say(t) { if (!SV.sound || !window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'zh-CN'; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) {} }
let tipT = 0; function tip(t, ms = 3000) { const e = $('tip'); e.innerHTML = t; e.classList.add('show'); clearTimeout(tipT); tipT = setTimeout(() => e.classList.remove('show'), ms); }

/* ---------- 渲染器 ---------- */
// 手机/平板：触屏操作 + 省电画质
const MOB = (matchMedia && matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
if (MOB) document.body.classList.add('mob');
const QF = MOB ? 0.55 : 1; // 植物数量系数
(function checkGL() { try { const c = document.createElement('canvas'); if (!c.getContext('webgl2')) throw 0; } catch (e) {
  document.getElementById('loadTxt').innerHTML = '这台设备的浏览器太旧，不支持 3D 画面 😢<br><a href="grow2d.html" style="color:#3a7a2a">点这里玩 2D 版恐龙长大记</a>'; throw new Error('no webgl2'); } })();
const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
let PR = Math.min(window.devicePixelRatio || 1, MOB ? 1.25 : 1.5);
renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = MOB ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c4e6f8', MOB ? 50 : 60, MOB ? 170 : 210);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.3, 1300);
const hemi = new THREE.HemisphereLight('#dff1ff', '#c8a874', 1.35); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.5); sun.castShadow = true; sun.shadow.mapSize.set(MOB ? 1024 : 2048, MOB ? 1024 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);
const SUN_DIR = new THREE.Vector3(0.45, 0.8, 0.5).normalize();
const fitCam = () => { camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 64 : 48; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
fitCam(); addEventListener('resize', fitCam); addEventListener('orientationchange', () => setTimeout(fitCam, 300));

/* ---------- 资源 ---------- */
const loader = new GLTFLoader();
async function loadGLB(path) {
  const A = window.ASSETS;
  if (A && A[path]) { const bin = atob(A[path]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return loader.parseAsync(u.buffer, ''); }
  return loader.loadAsync((window.ASSET_BASE || 'assets/') + path.split('/').map(encodeURIComponent).join('/'));
}

const G = {t: 0, paused: true, items: [], npcs: [], parts: [], solids: [], curBiome: null};
const PL = {x: -40, z: -40, dir: 0, vx: 0, vz: 0, D: null, len: 2, tx: null, tz: null, bump: 0, eatT: 0, scaleAnim: 1};

async function init() {
  const prog = (t) => { $('loadTxt').textContent = t; };
  prog('正在搭建世界…');
  buildTerrain(scene); G.water = buildWater(scene); buildMesas(scene); buildFlowerField(scene, MOB ? 2000 : 4200); G.clouds = buildSky(scene);
  for (const M of MESAS) G.solids.push({x: M.x, z: M.z, r: M.r * 1.15 + 0.5});
  prog('正在请恐龙们过来…');
  for (const id of Object.keys(SPECIES)) { prepDino(id, await loadGLB('dino/' + SPECIES[id].file + '.glb')); measureGait(id); }
  prog('正在种树和种花…');
  await plantFlora();
  prog('正在准备食物…');
  makeThumbs();
  // 玩家
  spawnPlayer(true);
  // 其他恐龙（住在各自的地方，慢慢散步）
  const plan = [['raptor', 'fern'], ['raptor', 'fern'], ['para', 'flower'], ['para', 'river'], ['tri', 'flower'], ['steg', 'fern'], ['apato', 'river'], ['apato', 'palm'], ['trex', 'mesa'], ['tri', 'mesa'], ['para', 'palm'], ['steg', 'mesa']];
  for (const [id, home] of plan) { const p = randomSpot(home, 6); const D = makeDino(id, NPC_LEN[id]); D.holder.position.set(p.x, H(p.x, p.z), p.z); D.mixer.update(Math.random() * 3); scene.add(D.holder);
    G.npcs.push({D, id, home, x: p.x, z: p.z, dir: Math.random() * 6, st: 'idle', timer: Math.random() * 4, tx: 0, tz: 0, speed: 1.2 + NPC_LEN[id] * 0.12}); }
  for (let i = 0; i < 90; i++) spawnFood(false);
  makeButterflies(); buildMinimap(); updHud();
  $('loading').style.display = 'none';
  intro();
  requestAnimationFrame(frame);
}

/* ---------- 植物 ---------- */
function randomSpot(biome, margin = 2, tries = 400) {
  const R = Math.random;
  for (let i = 0; i < tries; i++) {
    const x = BOUND.x0 + 6 + R() * (BOUND.x1 - BOUND.x0 - 12), z = BOUND.z0 + 6 + R() * (BOUND.z1 - BOUND.z0 - 12);
    if (biome && biomeAt(x, z) !== biome) continue;
    const h = H(x, z); if (h < -0.2) continue;
    if (G.solids.some(s => Math.hypot(s.x - x, s.z - z) < s.r + margin)) continue;
    return {x, z};
  }
  return {x: 0, z: -30};
}
async function plantFlora() {
  const R = RNG(7);
  const pick = (biomes, n, margin = 1.5, cond) => { const out = []; let guard = 0;
    while (out.length < n && guard++ < n * 60) { const x = -205 + R() * 410, z = -205 + R() * 400; const b = biomeAt(x, z), h = H(x, z);
      if (!biomes.includes(b) && !(biomes.includes('edge') && (Math.abs(x) > 118 || z < -118))) continue;
      if (h < -0.15 || (cond && !cond(x, z, h))) continue; if (MESAS.some(M => Math.hypot(M.x - x, M.z - z) < M.r * 1.25 + margin)) continue;
      if (Math.hypot(x + 40, z + 40) < 6) continue;
      out.push({x, y: h - 0.05, z, r: R() * Math.PI * 2, s: 0.75 + R() * 0.5}); }
    return out; };
  const L = async (p, h, opt) => makeInstancer(scene, (await loadGLB(p)).scene, h, opt);
  const sets = [
    ['nat/CommonTree_1.glb', 11, {shadow: 1, saturate: 1.25, sway: 0.005}, ['fern'], 22, 2.5, 1.2], ['nat/CommonTree_2.glb', 12, {shadow: 1, saturate: 1.25, sway: 0.005}, ['fern', 'flower'], 20, 2.5, 1.2],
    ['nat/CommonTree_3.glb', 9, {shadow: 1, saturate: 1.25, sway: 0.005}, ['fern', 'flower'], 18, 2.5, 1.2], ['nat/CommonTree_4.glb', 9, {shadow: 1, saturate: 1.25, sway: 0.005}, ['fern', 'edge'], 40, 2.5, 1.2],
    ['nat/CommonTree_5.glb', 10, {shadow: 1, saturate: 1.25, sway: 0.005}, ['fern', 'edge'], 40, 2.5, 1.2],
    ['nat/PalmTree_1.glb', 11, {shadow: 1, saturate: 1.3, sway: 0.006}, ['palm'], 22, 2, 0.8], ['nat/PalmTree_2.glb', 10, {shadow: 1, saturate: 1.3, sway: 0.006}, ['palm', 'river'], 22, 2, 0.8],
    ['nat/PalmTree_3.glb', 12, {shadow: 1, saturate: 1.3, sway: 0.006}, ['palm'], 18, 2, 0.8], ['nat/PalmTree_4.glb', 9, {shadow: 1, saturate: 1.3, sway: 0.006}, ['palm', 'mesa'], 16, 2, 0.8],
    ['nat/Willow_1.glb', 10, {shadow: 1, saturate: 1.2, sway: 0.008}, ['river'], 12, 3, 1.2], ['nat/Willow_3.glb', 8, {shadow: 1, saturate: 1.2, sway: 0.008}, ['river'], 10, 3, 1.2],
    ['mega/Fern.glb', 1.25, {bright: 1.7, sway: 0.05}, ['fern', 'palm', 'river'], 220, 0.5], ['mega/Flower Group.glb', 1.1, {far: 80, sway: 0.12}, ['flower'], 140, 0.3], ['mega/Bush with Flowers.glb', 1.6, {far: 100}, ['flower', 'fern'], 60, 0.6],
    ['mega/Tall Grass.glb', 1.3, {bright: 1.4, far: 80, sway: 0.12}, ['river', 'flower', 'fern'], 200, 0.2], ['mega/Mushroom.glb', 0.6, {far: 70}, ['fern'], 40, 0.3], ['mega/Plant Big.glb', 0.4, {bright: 1.5}, ['fern', 'river'], 90, 0.3],
    ['nat/Flowers.glb', 0.9, {saturate: 1.4, far: 80, sway: 0.14}, ['flower', 'river'], 160, 0.2], ['nat/Plant_1.glb', 1.2, {saturate: 1.3, sway: 0.05}, ['fern', 'palm'], 80, 0.3], ['nat/Plant_4.glb', 1.6, {saturate: 1.3, sway: 0.05}, ['fern', 'palm', 'river'], 70, 0.4],
    ['nat/Bush_1.glb', 0.9, {saturate: 1.2, bright: 1.35}, ['mesa', 'palm'], 40, 0.8], ['nat/BushBerries_1.glb', 1.6, {saturate: 1.3}, ['fern', 'flower'], 40, 0.8],
    ['nat/Rock_Moss_2.glb', 1.4, {shadow: 1}, ['fern', 'river'], 40, 0.8, 0.7], ['nat/Rock_3.glb', 1.8, {shadow: 1, saturate: 0.6}, ['mesa', 'palm'], 40, 0.8, 0.8], ['nat/Rock_6.glb', 2.6, {shadow: 1}, ['mesa'], 25, 1, 1.2],
    ['nat/CactusFlowers_2.glb', 1.6, {saturate: 1.3, far: 90}, ['mesa'], 30, 0.6], ['nat/CactusFlowers_4.glb', 1.3, {saturate: 1.3, far: 90}, ['mesa'], 25, 0.6],
    ['nat/WoodLog_Moss.glb', 0.9, {shadow: 1}, ['fern'], 12, 1], ['nat/Grass_Short.glb', 0.6, {saturate: 1.3, far: 70, sway: 0.2}, ['fern', 'flower', 'river'], 300, 0.1],
  ];
  let done = 0;
  for (const [p, h, opt, biomes, n, margin, solidR] of sets) {
    const inst = await L(p, h, opt); const list = pick(biomes, Math.max(4, Math.round(n * (h > 5 ? Math.max(QF, 0.75) : QF))), margin); if (MOB && opt.far) opt.far *= 0.8;
    done++; $('loadTxt').textContent = `正在种树和种花… ${Math.round(done / sets.length * 100)}%`;
    inst.add(list);
    if (solidR) for (const it of list) G.solids.push({x: it.x, z: it.z, r: solidR * it.s});
  }
  // 湖面的睡莲
  const lily = await L('nat/Lilypad.glb', 0.12, {saturate: 1.3}); const ll = [];
  for (let i = 0; i < 70; i++) { const x = -110 + Math.random() * 220, z = riverZ(x) + (Math.random() - 0.5) * 7; if (H(x, z) < -0.5) ll.push({x, y: WATER_Y + 0.02, z, r: Math.random() * 6, s: 1.4 + Math.random()}); }
  lily.add(ll);
}

/* ---------- 恐龙缩略图（进化选择、名片用） ---------- */
const THUMB = {};
function makeThumbs() {
  const r = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true}); r.setSize(360, 230); r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene(); s.add(new THREE.HemisphereLight('#e6f4ff', '#c8a874', 1.6)); const d = new THREE.DirectionalLight('#fff1d6', 2.6); d.position.set(3, 6, 6); s.add(d);
  const cam = new THREE.PerspectiveCamera(28, 360 / 230, 0.1, 100);
  for (const id of ['baby', ...Object.keys(SPECIES)]) {
    const D = makeDino(modelOf(id), id === 'apato' ? 8.5 : 6); D.holder.rotation.y = Math.PI * 0.42; D.mixer.update(0.5); s.add(D.holder);
    const hgt = {baby: 2.2, raptor: 2.2, para: 2.6, steg: 2.6, tri: 2.2, trex: 2.6, apato: 2.4}[id];
    cam.position.set(0.6, hgt + 1.6, 13.5); cam.lookAt(0, hgt * 0.62, 0);
    r.render(s, cam); THUMB[id] = r.domElement.toDataURL(); s.remove(D.holder);
  }
  r.dispose(); r.forceContextLoss && r.forceContextLoss();
}

/* ---------- 玩家 ---------- */
function spawnPlayer(first) {
  const old = PL.D; if (old) scene.remove(old.holder);
  PL.len = LEN[curId()]; PL.D = makeDino(modelOf(curId()), PL.len); scene.add(PL.D.holder);
  if (first) { if (SV.px !== undefined && Math.abs(SV.px) < 125) { PL.x = SV.px; PL.z = SV.pz; } PL.dir = 0; }
  const g = DINO[modelOf(curId())].gait, RM = {baby: 1.55, raptor: 1.15, para: 1.0, steg: 1.25, tri: 1.15, trex: 1.0, apato: 1.45};
  PL.walkSpd = g.Walk * PL.len * 1.35; PL.runSpd = g.Run * PL.len * RM[curId()]; PL.spd = 0; PL.holdT = 0; PL.look = 0; PL.lean = 0; PL.pitch = 0;
}
const keys = {};
const keyName = e => (e.key || '').length === 1 ? e.key.toLowerCase() : e.key;
addEventListener('keydown', e => { const k = keyName(e); keys[k] = true; if (e.key.startsWith('Arrow') || k === ' ') e.preventDefault(); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { PL.tx = null; marker.visible = false; } });
addEventListener('keyup', e => { keys[keyName(e)] = false; });
const clearInput = () => { for (const k in keys) keys[k] = false; ptr.down = false; ptr.drag = false; if (typeof JOY !== 'undefined') { JOY.on = false; JOY.x = JOY.y = 0; const k = document.querySelector('#joy i'); if (k) k.style.transform = ''; } };
addEventListener('blur', clearInput); document.addEventListener('visibilitychange', clearInput);
// 鼠标/手指：轻点地面 = 走过去；按住拖动 = 转动视角
const ptr = {down: false, drag: false, x: 0, y: 0, sx: 0, sy: 0};
const CAM = {yaw: 0, pitch: 0.42, manualT: -10};
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function groundPoint(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; let t = 0;
  for (let i = 0; i < 300; i++) { t += 0.8 + t * 0.02; const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y <= Math.max(H(x, z), WATER_Y)) return {x, z}; }
  return null;
}
const touches = new Map(); let pinch0 = 0, zoom0 = 1;
renderer.domElement.addEventListener('pointerdown', e => { touches.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = G.zoom || 1; ptr.drag = true; ptr.pinch = true; return; } });
const touchEnd = e => { touches.delete(e.pointerId); if (touches.size < 2) ptr.pinch = false; };
addEventListener('pointerup', touchEnd); addEventListener('pointercancel', touchEnd);
renderer.domElement.addEventListener('pointerdown', e => { if (G.paused || touches.size > 1) return; ptr.down = true; ptr.drag = false; ptr.x = ptr.sx = e.clientX; ptr.y = ptr.sy = e.clientY; renderer.domElement.setPointerCapture && renderer.domElement.setPointerCapture(e.pointerId); });
addEventListener('pointermove', e => { if (touches.has(e.pointerId)) touches.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (ptr.pinch && touches.size === 2) { const [a, b] = [...touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) G.zoom = Math.max(0.55, Math.min(1.7, zoom0 * pinch0 / d)); return; }
  if (!ptr.down) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY;
  if (!ptr.drag && Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) > 8) ptr.drag = true;
  const sens = MOB ? 0.009 : 0.006; if (ptr.drag) { CAM.yaw -= dx * sens; CAM.pitch = Math.max(0.12, Math.min(0.95, CAM.pitch + dy * sens * 0.7)); CAM.manualT = G.t; } });
const endPtr = e => { if (ptr.down && !ptr.drag && !ptr.pinch && !G.paused) setTarget(); ptr.down = false; ptr.drag = false; };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', () => { ptr.down = false; ptr.drag = false; });
function setTarget() { const p = groundPoint(ptr.x, ptr.y); if (p) { PL.tx = Math.max(BOUND.x0, Math.min(BOUND.x1, p.x)); PL.tz = Math.max(BOUND.z0, Math.min(BOUND.z1, p.z)); marker.position.set(PL.tx, Math.max(H(PL.tx, PL.tz), WATER_Y) + 0.08, PL.tz); marker.visible = true; marker.userData.t = 0; } }
renderer.domElement.addEventListener('wheel', e => { G.zoom = Math.max(0.55, Math.min(1.7, (G.zoom || 1) * (e.deltaY > 0 ? 1.08 : 0.93))); e.preventDefault(); }, {passive: false});
// 摇杆（手机）：往哪推，恐龙就往屏幕上那个方向走；推到底会跑
const JOY = {on: false, x: 0, y: 0, id: null};
{ const jz = $('joy'), knob = jz.querySelector('i'), R0 = 48;
  const upd = e => { const r = jz.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const l = Math.hypot(dx, dy); if (l > R0) { dx *= R0 / l; dy *= R0 / l; }
    JOY.x = dx / R0; JOY.y = dy / R0; knob.style.transform = `translate(${dx}px,${dy}px)`; };
  jz.addEventListener('pointerdown', e => { if (G.paused) return; JOY.on = true; JOY.id = e.pointerId; jz.setPointerCapture(e.pointerId); PL.tx = null; marker.visible = false; upd(e); e.preventDefault(); });
  jz.addEventListener('pointermove', e => { if (JOY.on && e.pointerId === JOY.id) upd(e); });
  const end = e => { if (e.pointerId !== JOY.id) return; JOY.on = false; JOY.x = JOY.y = 0; knob.style.transform = ''; };
  jz.addEventListener('pointerup', end); jz.addEventListener('pointercancel', end); jz.addEventListener('lostpointercapture', end); }
const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#fff6c0', transparent: true, opacity: 0.8, depthWrite: false}));
marker.visible = false; scene.add(marker);

function blocked(x, z, r) {
  if (x < BOUND.x0 || x > BOUND.x1 || z < BOUND.z0 || z > BOUND.z1) return true;
  if (H(x, z) < -1.0) return true; // 太深的海
  for (const s of G.solids) { const rr = s.r + r * 0.6; if (Math.abs(s.x - x) < rr && Math.abs(s.z - z) < rr && Math.hypot(s.x - x, s.z - z) < rr) return s; }
  return false;
}
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function updatePlayer(dt) {
  // 键盘：←→ 转身，↑ 往前走（走一会儿会自己跑起来），↓ 往后退
  let turn = 0, fwd = 0;
  if (keys.ArrowLeft || keys.a) turn += 1; if (keys.ArrowRight || keys.d) turn -= 1;
  if (keys.ArrowUp || keys.w) fwd = 1; else if (keys.ArrowDown || keys.s) fwd = -0.6;
  if (keys.q) { CAM.yaw += dt * 1.8; CAM.manualT = G.t; } if (keys.e) { CAM.yaw -= dt * 1.8; CAM.manualT = G.t; }
  let wantTurn = turn * 2.4;
  const jm = Math.hypot(JOY.x, JOY.y);
  if (JOY.on && jm > 0.15) { // 摇杆：方向相对于镜头
    const sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw), wx = -sy * -JOY.y + cy * JOY.x, wz = -cy * -JOY.y - sy * JOY.x;
    const da = wrapA(Math.atan2(wx, wz) - PL.dir); wantTurn = Math.max(-3, Math.min(3, da * 4)); fwd = (Math.abs(da) < 1.3 ? 1 : 0.2) * Math.min(1, jm * 1.15);
    PL.joyFwd = Math.max(0, -JOY.y / jm); PL.far = jm > 0.85; }
  // 点地面：转向目标再走过去，远的地方会跑过去
  if (!fwd && !turn && PL.tx !== null) { const dx = PL.tx - PL.x, dz = PL.tz - PL.z, l = Math.hypot(dx, dz);
    if (l > 0.5 + PL.len * 0.12) { const da = wrapA(Math.atan2(dx, dz) - PL.dir); wantTurn = Math.max(-3, Math.min(3, da * 4)); fwd = Math.abs(da) < 1.2 ? 1 : 0.15; if (l < PL.len * 1.5) fwd *= 0.5; PL.far = l > PL.len * 3; }
    else { PL.tx = null; marker.visible = false; } }
  const moving = fwd !== 0;
  PL.holdT = moving && fwd > 0 ? PL.holdT + dt : 0;
  const run = fwd > 0 && (keys.Shift || (JOY.on ? (PL.far && PL.holdT > 0.35) : PL.holdT > 0.9) || (PL.tx !== null && PL.far && PL.holdT > 0.3));
  let target = fwd > 0 ? (run ? PL.runSpd : PL.walkSpd * (JOY.on ? 1.6 : 1)) * fwd : fwd < 0 ? -PL.walkSpd : 0;
  if (PL.eatT > 0) target *= 0.3;
  const acc = target > PL.spd ? (run ? 1.6 : 4) : 5; PL.spd += (target - PL.spd) * Math.min(1, dt * acc);
  // 跑得越快转得越慢一点，看起来更有重量
  const turnK = 1 / (1 + Math.abs(PL.spd) / (PL.len * 1.2));
  PL.turnV = (PL.turnV || 0) + (wantTurn * (0.45 + 0.55 * turnK) - (PL.turnV || 0)) * Math.min(1, dt * 7);
  PL.dir = wrapA(PL.dir + PL.turnV * dt);
  if (PL.bump > 0) PL.bump -= dt;
  PL.vx = Math.sin(PL.dir) * PL.spd + (PL.pushX || 0); PL.vz = Math.cos(PL.dir) * PL.spd + (PL.pushZ || 0);
  PL.pushX = (PL.pushX || 0) * Math.max(0, 1 - dt * 4); PL.pushZ = (PL.pushZ || 0) * Math.max(0, 1 - dt * 4);
  // 移动 + 碰撞（沿障碍物滑开，不会卡住）
  const r = PL.len * 0.25;
  let nx = PL.x + PL.vx * dt, nz = PL.z + PL.vz * dt; const ox = PL.x, oz = PL.z;
  if (!blocked(nx, nz, r)) { PL.x = nx; PL.z = nz; }
  else if (!blocked(nx, PL.z, r)) { PL.x = nx; }
  else if (!blocked(PL.x, nz, r)) { PL.z = nz; }
  else { const s = blocked(nx, nz, r); if (s && s.x !== undefined) { const dx = PL.x - s.x, dz = PL.z - s.z, d = Math.hypot(dx, dz) || 1; const tx = -dz / d, tz = dx / d, dot = PL.vx * tx + PL.vz * tz; const mx = PL.x + tx * dot * dt, mz = PL.z + tz * dot * dt; if (!blocked(mx, mz, r)) { PL.x = mx; PL.z = mz; } } }
  const inS = blocked(PL.x, PL.z, r); if (inS && inS.x !== undefined) { const dx = PL.x - inS.x, dz = PL.z - inS.z, d = Math.hypot(dx, dz) || 1; PL.x += dx / d * dt * 4; PL.z += dz / d * dt * 4; }
  // 真实移动的速度（被挡住时脚步也跟着慢下来，不会原地踏步滑行）
  const realV = ((PL.x - ox) * Math.sin(PL.dir) + (PL.z - oz) * Math.cos(PL.dir)) / Math.max(dt, 1e-4);
  PL.animV = (PL.animV || 0) + (realV - (PL.animV || 0)) * Math.min(1, dt * 10);
  const D = PL.D, y = H(PL.x, PL.z);
  // 身体：顺着坡度抬头低头，转弯时往里侧倾
  const fy = H(PL.x + Math.sin(PL.dir) * PL.len * 0.35, PL.z + Math.cos(PL.dir) * PL.len * 0.35), by = H(PL.x - Math.sin(PL.dir) * PL.len * 0.35, PL.z - Math.cos(PL.dir) * PL.len * 0.35);
  PL.pitch += (Math.atan2(by - fy, PL.len * 0.7) * 0.8 - PL.pitch) * Math.min(1, dt * 6);
  PL.lean += (-PL.turnV * Math.min(1, Math.abs(PL.spd) / (PL.len * 0.8)) * 0.09 - PL.lean) * Math.min(1, dt * 6);
  D.holder.rotation.order = 'YXZ'; D.holder.position.set(PL.x, y, PL.z); D.holder.rotation.set(PL.pitch, PL.dir, PL.lean);
  PL.scaleAnim += (1 - PL.scaleAnim) * Math.min(1, dt * 3); D.holder.scale.setScalar(PL.scaleAnim);
  locomote(D, PL.animV, dt);
  // 跑步扬起尘土
  if (Math.abs(PL.animV) > PL.walkSpd * 1.6 && (PL.dustT = (PL.dustT || 0) - dt) < 0) { PL.dustT = 0.09; dust(PL.x - Math.sin(PL.dir) * PL.len * 0.15, y, PL.z - Math.cos(PL.dir) * PL.len * 0.15, PL.len); }
  // 扭头看最近的食物
  let la = 0, best = 1e9;
  for (const it of G.items) { if (it.eaten) continue; const dx = it.x - PL.x, dz = it.z - PL.z, d = dx * dx + dz * dz; const R = PL.len * 2.2 + 5; if (d > R * R || d > best) continue;
    const a = wrapA(Math.atan2(dx, dz) - PL.dir); if (Math.abs(a) > 1.9) continue; best = d; la = a; }
  if (best === 1e9) la = Math.sin(G.t * 0.4) * 0.25 * (Math.abs(PL.spd) < 0.3 ? 1 : 0);
  PL.look += (Math.max(-0.9, Math.min(0.9, la)) - PL.look) * Math.min(1, dt * 4);
  PL.eatT = Math.max(0, PL.eatT - dt);
  // 吃东西
  const mx = PL.x + Math.sin(PL.dir) * PL.len * 0.42, mz = PL.z + Math.cos(PL.dir) * PL.len * 0.42;
  const tierNow = SV.stage + 1;
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i], f = FOOD[it.type]; if (it.eaten) continue;
    const d = Math.hypot(it.x - mx, it.z - mz), reach = PL.len * 0.3 + f.r;
    const nearBody = Math.hypot(it.x - PL.x, it.z - PL.z) < PL.len * 0.7 + f.r;
    if (f.tier > tierNow) { it.lockVis = Math.hypot(it.x - PL.x, it.z - PL.z) < PL.len + 6; if ((d < reach || nearBody) && !it.told) { it.told = true; tip(`${f.icon} ${f.name}太大了，长大一点才能吃哦`); } continue; }
    if (d < reach || nearBody) { eat(it, i); if (G.paused) return; }
  }
  // 碰到比自己大的恐龙：被轻轻推开
  for (const n of G.npcs) { const nl = NPC_LEN[n.id]; if (nl <= PL.len * 1.15) continue;
    const d = Math.hypot(n.x - PL.x, n.z - PL.z); if (d < nl * 0.35 + PL.len * 0.25) { const dx = (PL.x - n.x) / (d || 1), dz = (PL.z - n.z) / (d || 1); PL.pushX = dx * 6; PL.pushZ = dz * 6;
      if (PL.bump <= 0) { PL.bump = 6; tip(`${spInfo(n.id).name}：“小家伙，小心哦！” 😊`); tone([330, 392], 0.04); } } }
  // 地区提示
  const b = biomeAt(PL.x, PL.z); if (b !== G.curBiome) { if (G.curBiome !== null) { const B = BIOMES[b]; tip(`${B.icon} 来到了<b>${B.name}</b><br><span class="small">${B.fact}</span>`, 4500); } G.curBiome = b; }
}

/* ---------- 食物 ---------- */
function dropFood(it) { scene.remove(it.obj); it.obj.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); else if (o.isMesh && o.material.userData.own) o.material.dispose(); }); }
function spawnFood(near) {
  const st = SV.stage + 1;
  const w = FOOD_KEYS.map(k => { const tr = FOOD[k].tier; return tr <= st ? (tr === st ? 3 : tr === st - 1 ? 1.5 : 0.4) : (tr === st + 1 ? 0.8 : 0.2); });
  let r = Math.random() * w.reduce((a, b) => a + b), k = 0; while (r > w[k]) { r -= w[k]; k++; }
  const type = FOOD_KEYS[k], f = FOOD[type];
  let p = null;
  for (let i = 0; i < 80 && !p; i++) {
    let x, z;
    if (near) { const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 40; x = PL.x + Math.cos(a) * d; z = PL.z + Math.sin(a) * d; }
    else { x = BOUND.x0 + 8 + Math.random() * (BOUND.x1 - BOUND.x0 - 16); z = BOUND.z0 + 8 + Math.random() * (BOUND.z1 - BOUND.z0 - 16); }
    if (x < BOUND.x0 + 5 || x > BOUND.x1 - 5 || z < BOUND.z0 + 5 || z > BOUND.z1 - 5) continue;
    const h = H(x, z);
    if (f.water) { if (h > -0.45 || h < -1.0) continue; } else if (h < -0.15) continue;
    if (f.biomes && !f.biomes.includes(biomeAt(x, z))) continue;
    if (G.solids.some(s => Math.hypot(s.x - x, s.z - z) < s.r + f.r + 0.6)) continue;
    p = {x, z, h};
  }
  if (!p) { if (near) spawnFood(false); return; }
  const obj = makeFood(type); const y = f.water ? WATER_Y : p.h;
  obj.position.set(p.x, y, p.z); obj.rotation.y = Math.random() * 6; scene.add(obj);
  G.items.push({type, x: p.x, z: p.z, y, obj, ph: Math.random() * 6, eaten: 0});
}
function eat(it, i) {
  const f = FOOD[it.type], sp = spInfo(curId()); let xp = f.xp, bonus = false;
  if ((f.kind === 'meat' && sp.diet === 'meat') || (f.kind === 'plant' && sp.diet === 'plant')) { xp = Math.round(xp * 1.5 + 0.4); bonus = true; }
  it.eaten = 0.0001; it.told = true;
  bite(PL.D); PL.eatT = 0.45;
  burstAt(it.x, it.y + f.r, it.z, f.kind === 'meat' ? '#ffd76a' : '#b8f27a', 10);
  floatText(`+${xp}${bonus ? ' ⭐' : ''}`, it.x, it.y + f.r + 1, it.z);
  tone(bonus ? [660, 880] : [587], 0.045, 0.07);
  if (!SV.firstEat) { SV.firstEat = 1; tip('吃到啦！⭐ 表示这是你最擅长吃的食物，长得更快'); }
  if (G.evoPending) return;
  if (SV.stage < STAGES.length - 1) { SV.xp += xp; if (SV.xp >= NEED[SV.stage]) { SV.xp = NEED[SV.stage]; save(); updHud(); setTimeout(evolveOffer, 600); G.evoPending = true; return; } }
  else SV.xp += xp;
  save(); updHud();
}
function updateItems(dt) {
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i], f = FOOD[it.type];
    if (it.eaten) { it.eaten += dt * 3; const s = Math.max(0, 1 - it.eaten); it.obj.scale.setScalar(s); it.obj.position.y = it.y + it.eaten * 0.8;
      if (it.eaten >= 1) { dropFood(it); G.items.splice(i, 1); spawnFood(true); } continue; }
    const dx = it.x - PL.x, dz = it.z - PL.z; if (dx * dx + dz * dz > 120 * 120) { it.obj.visible = false; continue; } it.obj.visible = true;
    f.anim && f.anim(it.obj, G.t + it.ph, it);
    const lock = it.obj.userData.lock; if (lock) lock.visible = f.tier > SV.stage + 1 && !!it.lockVis;
    const ring = it.obj.userData.ring; if (ring) { ring.visible = f.tier <= SV.stage + 1; ring.material.opacity = 0.35 + 0.2 * Math.sin(G.t * 2 + it.ph); }
  }
}

/* ---------- 粒子和飘字 ---------- */
const partGeo = new THREE.SphereGeometry(0.12, 6, 4);
function burstAt(x, y, z, col, n, spread = 1) {
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({color: col, transparent: true}));
    m.position.set(x, y, z); m.scale.setScalar(spread); scene.add(m); G.parts.push({m, vx: (Math.random() - 0.5) * 4 * spread, vy: 2 + Math.random() * 3 * spread, vz: (Math.random() - 0.5) * 4 * spread, life: 0.8 + Math.random() * 0.5}); }
}
function floatText(t, x, y, z) {
  const e = document.createElement('div'); e.className = 'ftxt'; e.textContent = t; $('fx').appendChild(e);
  G.parts.push({el: e, x, y, z, life: 1.3});
}
function updateParts(dt) {
  const v = new THREE.Vector3();
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt;
    if (p.sp) { p.sp.position.y += p.vy * dt; p.k += dt * 1.2; p.sp.scale.setScalar(p.k); p.sp.material.opacity = Math.max(0, p.life * 0.65); }
    else if (p.m) { p.vy -= 6 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.material.opacity = Math.min(1, p.life * 2); }
    else { p.y += dt * 1.2; v.set(p.x, p.y, p.z).project(camera); p.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px,${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`; p.el.style.opacity = Math.min(1, p.life * 1.5); }
    if (p.life <= 0) { if (p.sp) { scene.remove(p.sp); p.sp.material.dispose(); } else if (p.m) { scene.remove(p.m); p.m.material.dispose(); } else p.el.remove(); G.parts.splice(i, 1); } }
}

/* ---------- 生气：尘土、蝴蝶、找食物的箭头 ---------- */
let puffTex = null;
function dust(x, y, z, len) {
  if (!puffTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); puffTex = new THREE.CanvasTexture(c); }
  const b = biomeAt(x, z), col = b === 'mesa' ? '#e7a77a' : b === 'palm' ? '#f2e2b8' : '#d9d2b0';
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: puffTex, color: col, transparent: true, opacity: 0.6, depthWrite: false}));
  const k = 0.35 + len * 0.12; sp.position.set(x + (Math.random() - 0.5) * len * 0.2, y + k * 0.4, z + (Math.random() - 0.5) * len * 0.2); sp.scale.setScalar(k); scene.add(sp);
  G.parts.push({sp, life: 0.9, k, vy: 0.4});
}
const BUGS = [];
function makeButterflies() {
  const cols = ['#ffb13b', '#62c3ff', '#ff6fb1', '#fff27a', '#b98cff'];
  const wg = new THREE.CircleGeometry(0.22, 8, 0, Math.PI).rotateX(-Math.PI / 2).translate(0, 0, 0);
  for (let i = 0; i < (MOB ? 8 : 16); i++) { const m = new THREE.MeshStandardMaterial({color: cols[i % cols.length], side: THREE.DoubleSide, roughness: 0.6});
    const b = new THREE.Group(), l = new THREE.Mesh(wg, m), r = new THREE.Mesh(wg, m); l.rotation.y = Math.PI / 2; r.rotation.y = -Math.PI / 2; const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(l); wr.add(r); b.add(wl, wr);
    b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({color: '#333'})));
    scene.add(b); BUGS.push({b, wl, wr, cx: 0, cz: 0, ph: Math.random() * 6, sp: 0.6 + Math.random() * 0.5, init: false}); }
}
function updateLife(dt) {
  WIND.value = G.t; NEAR.value = camPos.distanceTo(camLook) * 0.72;
  for (const u of BUGS) {
    if (!u.init || Math.hypot(u.cx - PL.x, u.cz - PL.z) > 45) { const a = Math.random() * 6.28, d = 8 + Math.random() * 25; u.cx = PL.x + Math.cos(a) * d; u.cz = PL.z + Math.sin(a) * d; u.init = true; }
    const t = G.t * u.sp + u.ph, x = u.cx + Math.sin(t * 0.7) * 4 + Math.sin(t * 1.9) * 1.2, z = u.cz + Math.cos(t * 0.5) * 4, y = Math.max(H(x, z), WATER_Y) + 1.1 + Math.sin(t * 2.3) * 0.4;
    const ox = u.b.position.x, oz = u.b.position.z; u.b.position.set(x, y, z); u.b.rotation.y = Math.atan2(x - ox, z - oz);
    const f = Math.sin(G.t * 18 + u.ph) * 0.9; u.wl.rotation.z = f; u.wr.rotation.z = -f;
    u.b.visible = biomeAt(x, z) !== 'mesa';
  }
  // 屏幕边上的小箭头：指向最近的、能吃的食物
  let best = null, bd = 70 * 70;
  for (const it of G.items) { if (it.eaten || FOOD[it.type].tier > SV.stage + 1) continue; const d = (it.x - PL.x) ** 2 + (it.z - PL.z) ** 2; if (d < bd) { bd = d; best = it; } }
  const el = $('foodArrow');
  if (best && !G.paused) { const v = new THREE.Vector3(best.x, best.y + 0.5, best.z).project(camera); const behind = v.z > 1;
    let sx = v.x, sy = v.y; if (behind) { sx = -sx; sy = -sy; }
    const on = !behind && Math.abs(sx) < 0.9 && Math.abs(sy) < 0.85;
    if (on) el.style.display = 'none';
    else { const ang = Math.atan2(sy, sx), m = Math.max(Math.abs(Math.cos(ang)) / 0.88, Math.abs(Math.sin(ang)) / 0.8); const ex = Math.cos(ang) / m, ey = Math.sin(ang) / m;
      el.style.display = 'flex'; el.style.left = ((ex * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-ey * 0.5 + 0.5) * innerHeight) + 'px';
      el.firstChild.style.transform = `rotate(${-ang}rad)`; el.lastChild.textContent = FOOD[best.type].icon; } }
  else el.style.display = 'none';
}

/* ---------- 其他恐龙 ---------- */
function updateNPCs(dt) {
  for (const n of G.npcs) {
    const dPl = Math.hypot(n.x - PL.x, n.z - PL.z), far = dPl > 140, g = DINO[n.id].gait, walkV = g.Walk * NPC_LEN[n.id] * 1.25;
    let v = 0;
    if (n.st === 'walk') { const dx = n.tx - n.x, dz = n.tz - n.z, l = Math.hypot(dx, dz);
      if (l < 1) { n.st = 'idle'; n.timer = 3 + Math.random() * 6; }
      else { const da = wrapA(Math.atan2(dx, dz) - n.dir); n.dir = wrapA(n.dir + Math.max(-1, Math.min(1, da * 2)) * dt * 0.9);
        v = walkV * (Math.abs(da) < 1 ? 1 : 0.3); const nx = n.x + Math.sin(n.dir) * v * dt, nz = n.z + Math.cos(n.dir) * v * dt;
        if (H(nx, nz) < -0.6 || G.solids.some(s => s.r > 3 && Math.hypot(s.x - nx, s.z - nz) < s.r + NPC_LEN[n.id] * 0.3)) { n.st = 'idle'; n.timer = 1; v = 0; }
        else { n.x = nx; n.z = nz; } } }
    else { n.timer -= dt; if (n.timer <= 0) { const p = randomSpotNear(n); n.tx = p.x; n.tz = p.z; n.st = 'walk'; } }
    n.v = (n.v || 0) + (v - (n.v || 0)) * Math.min(1, dt * 4);
    n.D.holder.position.set(n.x, H(n.x, n.z), n.z); n.D.holder.rotation.y = n.dir;
    n.D.holder.visible = !far;
    if (!far) { locomote(n.D, n.v, dt); n.D.mixer.update(dt);
      // 玩家走近时，扭头看看你
      let la = 0; if (dPl < NPC_LEN[n.id] * 2.5 + 6) la = wrapA(Math.atan2(PL.x - n.x, PL.z - n.z) - n.dir); if (Math.abs(la) > 1.8) la = 0;
      n.look = (n.look || 0) + (Math.max(-0.8, Math.min(0.8, la)) - (n.look || 0)) * Math.min(1, dt * 3); if (Math.abs(n.look) > 0.01) headTurn(n.D, n.look); }
  }
}
function randomSpotNear(n) { for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, d = 8 + Math.random() * 25, x = n.x + Math.cos(a) * d, z = n.z + Math.sin(a) * d;
  if (biomeAt(x, z) === n.home && H(x, z) > -0.3 && x > BOUND.x0 + 5 && x < BOUND.x1 - 5 && z > BOUND.z0 + 5 && z < BOUND.z1 - 5) return {x, z}; } return randomSpot(n.home, 4); }

/* ---------- 进化 ---------- */
function holdOff(ms = 1300) { const b = $('box'); b.classList.add('wait'); clearTimeout(holdOff.t); holdOff.t = setTimeout(() => b.classList.remove('wait'), ms); }
let evolving = false;
function evolveOffer() {
  if (SV.stage >= STAGES.length - 1) return;
  G.paused = true; clearInput(); PL.tx = null; marker.visible = false; G.evoPending = false;
  const opts = STAGES[SV.stage + 1].opts;
  $('box').innerHTML = `<h1>✨ 可以进化啦！</h1><p>你吃得饱饱的，长大了。选一种恐龙变身吧：</p>
   <div class="choices">${opts.map(id => { const s = spInfo(id); return `<button class="choice" data-id="${id}"><img src="${THUMB[id]}" alt=""><b>${s.name}</b><div><span class="tag">🕰️ ${s.period}</span><span class="tag">📏 ${s.len}</span><span class="tag">🍽️ ${s.dietTxt}</span></div><div class="tr">${s.diet === 'meat' ? '⭐ 吃虫子和鱼长得更快' : '⭐ 吃植物和果子长得更快'}</div></button>`; }).join('')}</div>`;
  $('overlay').classList.add('show'); holdOff();
  document.querySelectorAll('.choice').forEach(b => b.onclick = () => evolveTo(b.dataset.id));
  tone([523, 659, 784, 1046], 0.05, 0.14); say('可以进化啦，选一种恐龙吧');
}
function evolveTo(id) {
  if (evolving || SV.stage >= STAGES.length - 1 || !STAGES[SV.stage + 1].opts.includes(id)) return;
  evolving = true; setTimeout(() => evolving = false, 800); holdOff(1200);
  SV.stage++; SV.path[SV.stage] = id; SV.path.length = SV.stage + 1; SV.xp = 0; if (!SV.done.includes(id)) SV.done.push(id); save();
  const s = spInfo(id), oldLen = PL.len;
  spawnPlayer(false); PL.scaleAnim = oldLen / PL.len; PL.D.holder.scale.setScalar(PL.scaleAnim);
  const y = H(PL.x, PL.z); burstAt(PL.x, y + PL.len * 0.3, PL.z, '#fff3a8', 26, 1.6); burstAt(PL.x, y + PL.len * 0.3, PL.z, '#9ff0ff', 16, 1.4);
  $('box').innerHTML = `<h1>🎉 变成${s.name}了！</h1><img class="big" src="${THUMB[id]}" alt=""><p>💡 ${s.facts[0]}</p>
    ${SV.stage === STAGES.length - 1 ? '<p><b>这是最终形态！</b>继续在世界里散步、吃东西、看看其他恐龙吧。想换一条路线，可以在菜单里“重新长大”。</p>' : ''}
    <button class="btn" id="goOn">继续冒险 ➜</button>`;
  say('变成' + s.name + '了');
  $('goOn').onclick = () => { $('overlay').classList.remove('show'); G.paused = false;
    // 太小的食物换成合适的
    for (let i = G.items.length - 1; i >= 0; i--) { const it = G.items[i]; if (FOOD[it.type].tier < SV.stage) { dropFood(it); G.items.splice(i, 1); } }
    while (G.items.length < 90) spawnFood(Math.random() < 0.5);
    G.items.forEach(it => it.told = false); updHud(); };
  updHud();
}

/* ---------- HUD ---------- */
function updHud() {
  const id = curId(), s = spInfo(id);
  $('whoName').textContent = s.name; $('whoImg').src = THUMB[id] || '';
  $('whoSub').textContent = SV.stage < STAGES.length - 1 ? `第 ${SV.stage + 1} 阶段 · 成长 ${SV.xp}/${NEED[SV.stage]}` : `最终形态 · 已吃 ${SV.xp}`;
  $('xpBar').style.width = (SV.stage < STAGES.length - 1 ? SV.xp / NEED[SV.stage] * 100 : 100) + '%';
  $('stages').innerHTML = STAGES.map((_, i) => `<i class="${i <= SV.stage ? 'on' : ''}"></i>`).join('');
  $('soundBtn').textContent = SV.sound ? '🔊' : '🔇';
}
let mapBg = null;
function buildMinimap() {
  const c = document.createElement('canvas'), S = 150; c.width = S; c.height = S; const x = c.getContext('2d');
  const W = BOUND.x1 - BOUND.x0, Hh = BOUND.z1 - BOUND.z0;
  for (let i = 0; i < S; i += 3) for (let j = 0; j < S; j += 3) { const wx = BOUND.x0 + i / S * W, wz = BOUND.z0 + j / S * Hh, h = H(wx, wz);
    x.fillStyle = h < -0.4 ? (wz > 80 ? '#2f8fd6' : '#45c4d4') : BIOMES[biomeAt(wx, wz)].map; x.fillRect(i, j, 3, 3); }
  x.fillStyle = '#b8552f'; for (const M of MESAS) { if (M.x < BOUND.x0 || M.x > BOUND.x1 || M.z < BOUND.z0 || M.z > BOUND.z1) continue; x.beginPath(); x.arc((M.x - BOUND.x0) / W * S, (M.z - BOUND.z0) / Hh * S, M.r / W * S, 0, 7); x.fill(); }
  mapBg = c;
}
function drawMinimap() {
  const c = $('map'), x = c.getContext('2d'), S = c.width, W = BOUND.x1 - BOUND.x0, Hh = BOUND.z1 - BOUND.z0;
  x.clearRect(0, 0, S, S); x.drawImage(mapBg, 0, 0, S, S);
  x.fillStyle = '#ffd23f'; for (const it of G.items) { if (it.eaten || FOOD[it.type].tier > SV.stage + 1) continue; x.fillRect((it.x - BOUND.x0) / W * S - 1.5, (it.z - BOUND.z0) / Hh * S - 1.5, 3, 3); }
  x.fillStyle = 'rgba(255,255,255,.85)'; for (const n of G.npcs) { x.beginPath(); x.arc((n.x - BOUND.x0) / W * S, (n.z - BOUND.z0) / Hh * S, 2.2, 0, 7); x.fill(); }
  const px = (PL.x - BOUND.x0) / W * S, pz = (PL.z - BOUND.z0) / Hh * S;
  x.save(); x.translate(px, pz); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 22, -Math.PI / 2 - CAM.yaw - 0.5, -Math.PI / 2 - CAM.yaw + 0.5); x.closePath(); x.fill(); x.rotate(-PL.dir + Math.PI); x.fillStyle = '#ff5a3c'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 5); x.lineTo(-5, 5); x.closePath(); x.stroke(); x.fill(); x.restore();
}

/* ---------- 菜单 / 开场 ---------- */
function intro() {
  G.paused = true;
  $('box').innerHTML = `<h1>🥚 恐龙长大记</h1><p>你是一只刚出生的小恐龙。在大陆上走来走去，<b>吃东西长大</b>，吃饱了就能<b>进化</b>成更大的恐龙！</p>
   <div class="legend">${MOB ? '<span>🕹️ 左下角摇杆 = 走路，推到底会跑</span><span>👆 轻点地面 = 走过去</span><span>☝️ 单指滑动 = 转视角</span><span>🤏 双指捏合 = 拉近拉远</span><span>➤ 屏幕边的箭头指向最近的食物</span><span>🔒 太大的食物，要长大才能吃</span>' : `<span>🖱️ 点地面 = 走过去</span><span>🖱️ 按住拖动 = 转动视角</span><span>⌨️ ↑ 往前走（走久了会跑）← → 转身</span><span>⌨️ Q / E 转视角</span><span>🔍 滚轮 = 拉近拉远</span><span>➤ 屏幕边的箭头指向最近的食物</span><span>🔒 太大的食物，要长大才能吃</span><span>⭐ 选对擅长的食物长得更快</span>`}</div>
   <p>大陆上有 5 个地方：🌿蕨类森林、🌼开花草原、💧大河湿地、🌴苏铁海岸、🏜️红岩台地。</p>
   <p style="color:#6c7563">这里没有时间限制，也不会输。碰到大恐龙只会被轻轻推开。</p>
   <button class="btn" id="startBtn">${SV.seen ? '继续冒险' : '出发！'}</button>`;
  $('overlay').classList.add('show');
  $('startBtn').onclick = () => { SV.seen = true; save(); $('overlay').classList.remove('show'); G.paused = false; G.curBiome = null; };
}
$('menuBtn').onclick = () => {
  if (G.evoPending) return;
  G.paused = true;
  $('box').innerHTML = `<h1>☰ 菜单</h1>
   <p>我的进化路线：${SV.path.map(id => spInfo(id).name).join(' → ')}</p>
   <p class="credits">素材来源（全部是 CC0 公共领域授权，可以免费使用）：恐龙模型 — Quaternius「Animated Dinosaur Pack」；树、棕榈、花、石头 — Quaternius「Ultimate Nature Pack」和「Stylized Nature MegaKit」。鳞片质感、配色、地形、河流、红岩、天空、食物都是程序里原创画的。</p>
   <button class="btn" id="resume">继续</button><button class="btn light" id="howBtn">怎么玩</button><button class="btn light" id="restart">重新长大</button>`;
  $('overlay').classList.add('show');
  $('resume').onclick = () => { $('overlay').classList.remove('show'); G.paused = false; };
  $('howBtn').onclick = intro;
  let armed = false; $('restart').onclick = e => { if (!armed) { armed = true; e.target.textContent = '再按一次确认'; return; }
    SV.stage = 0; SV.path = ['baby']; SV.xp = 0; save(); spawnPlayer(false); PL.scaleAnim = 1; updHud(); $('overlay').classList.remove('show'); G.paused = false; tip('又变回恐龙宝宝啦，这次试试另一条路线吧！'); };
};
$('soundBtn').onclick = () => { SV.sound = !SV.sound; save(); updHud(); if (SV.sound) tone([523, 659], 0.04); };

/* ---------- 主循环 ---------- */
let last = 0, slowT = 0, fastT = 0, mapT = 0, saveT = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
  if (G.paused && G.drawnPaused) return; // 弹窗时不重画，省电
  G.t += dt;
  if (!G.paused) { updatePlayer(dt); updateNPCs(dt); updateItems(dt); }
  PL.D.mixer.update(G.paused ? 0 : dt); if (Math.abs(PL.look) > 0.01) headTurn(PL.D, PL.look);
  updateLife(dt);
  updateParts(dt);
  if (G.water) G.water.uT.value = G.t;
  if (marker.visible) { marker.userData.t += dt; marker.scale.setScalar(1 + 0.15 * Math.sin(marker.userData.t * 5)); }
  // 相机：在恐龙身后，走路时慢慢转到身后；拖动鼠标或 Q/E 可以自己转
  const behind = PL.dir + Math.PI;
  if (G.t - CAM.manualT > 2.5 && (Math.abs(PL.spd) > 0.5 || PL.tx !== null)) CAM.yaw += wrapA(behind - CAM.yaw) * Math.min(1, dt * (PL.spd < 0 ? 0.3 : 1.4) * (JOY.on ? Math.pow(PL.joyFwd || 0, 2) * 0.8 : 1));
  if (!G.camInit) CAM.yaw = behind;
  const dist = (5 + PL.len * 1.35) * (G.zoom || 1), y0 = H(PL.x, PL.z);
  const cp = Math.cos(CAM.pitch), spch = Math.sin(CAM.pitch);
  const fx = -Math.sin(CAM.yaw), fz = -Math.cos(CAM.yaw); // 镜头朝向
  camLook.set(PL.x + fx * dist * 0.22, y0 + PL.len * 0.32 + dist * 0.1, PL.z + fz * dist * 0.22);
  const want = new THREE.Vector3(PL.x + Math.sin(CAM.yaw) * dist * cp, y0 + PL.len * 0.3 + dist * spch, PL.z + Math.cos(CAM.yaw) * dist * cp);
  want.y = Math.max(want.y, H(want.x, want.z) + 1.2, WATER_Y + 1.2);
  if (!G.camInit) { camPos.copy(want); G.camInit = true; } else camPos.lerp(want, Math.min(1, dt * 5));
  camera.position.copy(camPos); camera.lookAt(camLook);
  // 阴影跟着玩家
  const sr = 18 + PL.len * 2.5; const sc = sun.shadow.camera; if (sc.right !== sr) { sc.left = -sr; sc.right = sr; sc.top = sr; sc.bottom = -sr; sc.near = 1; sc.far = 220; sc.updateProjectionMatrix(); }
  sun.target.position.set(PL.x, y0, PL.z); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 100);
  renderer.render(scene, camera);
  G.drawnPaused = G.paused;
  if ((mapT += dt) > 0.2) { mapT = 0; drawMinimap(); cullChunks(PL.x, PL.z); }
  if ((saveT += dt) > 5) { saveT = 0; SV.px = PL.x; SV.pz = PL.z; save(); }
  // 自动画质：太卡就降低分辨率和阴影
  if (dt > 0.034) { slowT += dt; fastT = 0; } else { fastT += dt; slowT = Math.max(0, slowT - dt * 0.5); }
  if (slowT > 2) { slowT = 0; if (PR > 1) { PR = 1; renderer.setPixelRatio(PR); } else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); } else if (PR > 0.7) { PR = 0.7; renderer.setPixelRatio(PR); } }
}
window.__G = {G, PL, SV, FOOD, NEED, STAGES, evolveTo, H, renderer, scene, CAM, keys};
const unpause = () => { G.drawnPaused = false; };
new MutationObserver(unpause).observe($('overlay'), {attributes: true});
init().catch(e => { $('loadTxt').textContent = '加载出错了：' + e.message; console.error(e); });
