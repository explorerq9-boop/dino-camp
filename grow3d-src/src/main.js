import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SPECIES, GOB, prepDino, prepGob, makeDino, measureGait, locomote, bite, headTurn, DINO} from './dinos.js';
import {createLife} from './life.js';
import {createEnv} from './env.js';
import {createHome, DECOR} from './home.js';
import {SEASONS, SEASON, createFlakes} from './season.js';
import {RNG, WATER_Y, H, biomeAt, BIOMES, CH, createWorld, makeKind, buildWater, buildSky, WIND, NEAR} from './world.js';
import {FOOD, FOOD_KEYS, makeFood} from './food.js';

const $ = id => document.getElementById(id);
const KEY = 'dinogrow3d_v1';
const SV = Object.assign({stage: 0, path: ['baby'], xp: 0, sound: false, seen: false, done: [], hunt: true, book: {}}, JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => localStorage.setItem(KEY, JSON.stringify(SV));

// 阶段：0 宝宝 → 1 二选一 → 2 二选一 → 3 最终形态
const STAGES = [{opts: ['baby']}, {opts: ['raptor', 'para']}, {opts: ['steg', 'tri']}, {opts: ['trex', 'apato']}];
const NEED = [10, 18, 28, Infinity];
const LEN = {baby: 1.9, raptor: 3.4, para: 4.6, steg: 6.4, tri: 6.4, trex: 9.5, apato: 13};
const NPC_LEN = {raptor: 3.6, para: 7, steg: 7.5, tri: 7.5, trex: 10.5, apato: 17, anky: 6.5, pachy: 4.6, ovi: 2.6, spino: 12};
const nameOf = id => (SPECIES[id] || GOB[id]).name;
const BOOK = ['raptor', 'para', 'steg', 'tri', 'trex', 'apato', 'anky', 'pachy', 'ovi', 'spino', 'ptero', 'plesio'];
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
scene.fog = new THREE.Fog('#c4e6f8', MOB ? 45 : 55, MOB ? 150 : 165);
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

const G = {t: 0, paused: true, items: [], npcs: [], prey: [], parts: [], curBiome: null};
const PL = {x: -40, z: -40, dir: 0, vx: 0, vz: 0, D: null, len: 2, tx: null, tz: null, bump: 0, eatT: 0, scaleAnim: 1};

let WORLD = null, LIFE = null, ENV = null, HOME = null, FLAKES = null;
async function init() {
  const prog = (t) => { $('loadTxt').textContent = t; };
  prog('正在搭建世界…');
  WORLD = createWorld(scene, {mobile: MOB}); G.water = buildWater(scene); G.skyo = buildSky(scene);
  prog('正在请恐龙们过来…');
  for (const id of Object.keys(SPECIES)) { prepDino(id, await loadGLB('dino/' + SPECIES[id].file + '.glb')); measureGait(id); }
  for (const id of Object.keys(GOB)) { prepGob(id, await loadGLB('gob/' + GOB[id].file + '.glb')); measureGait(id); }
  await loadKinds();
  makeThumbs();
  // 出生点：第一次来就找一块离原点近的绿地
  if (SV.px === undefined || !isFinite(SV.px)) { const p = findLand(0, 0, ['fern', 'flower']); PL.x = p.x; PL.z = p.z; } else { PL.x = SV.px; PL.z = SV.pz; }
  prog('正在长出大陆…');
  WORLD.update(PL.x, PL.z, true);
  spawnPlayer(true);
  // 其他恐龙：散布在你周围，走远了会在前方重新遇到新的
  LIFE = createLife({scene, PL, G, MOB, SV, tip, burstAt, floatText, gainXP, questEvent, tone, blocked, placeNear, onDiscover: discover, toHome: f => { HOME.addBaby(f.id); scene.remove(f.D.holder); tip(`🏠 小${({ovi: '窃蛋龙', gtri: '三角龙', gsteg: '剑龙', anky: '甲龙', pachy: '肿头龙', gtrex: '霸王龙'})[f.id] || '恐龙'}先回小窝等你了。`, 3000); }});
  ENV = createEnv({scene, renderer, hemi, sun, SUN_DIR, sky: G.skyo.sky, clouds: G.skyo.clouds, PL, G, SV, MOB, tip, ripple: LIFE.ripple, snowy: () => SEASON.value.z > 0.5});
  FLAKES = createFlakes(scene, PL, MOB, H); seasonInit();
  const plan = MOB ? ['raptor', 'para', 'para', 'tri', 'steg', 'apato', 'trex', 'anky', 'pachy', 'ovi', 'spino', 'tri'] : ['raptor', 'raptor', 'para', 'para', 'tri', 'steg', 'apato', 'apato', 'trex', 'tri', 'para', 'steg', 'anky', 'anky', 'pachy', 'pachy', 'ovi', 'ovi', 'spino'];
  for (const id of plan) { const D = makeDino(id, NPC_LEN[id], (Math.random() - 0.5) * 2); scene.add(D.holder); const n = {D, id, x: 0, z: 0, dir: Math.random() * 6, st: 'idle', timer: Math.random() * 4, tx: 0, tz: 0}; placeNear(n, 25, 110); G.npcs.push(n); LIFE.addBabies(n, NPC_LEN[id]); }
  for (let i = 0; i < FOOD_N; i++) spawnFood(false);
  HOME = createHome({world: WORLD, scene, PL, G, SV, MOB, tip, burstAt, floatText, tone, save, questEvent, findLand, blocked, glowTex: glowTex()});
  makeButterflies(); updHud(); newQuest(true);
  prog('正在准备画面…'); await new Promise(r => setTimeout(r, 30)); try { camera.position.set(PL.x, H(PL.x, PL.z) + 6, PL.z - 10); camera.lookAt(PL.x, 0, PL.z); renderer.compile(scene, camera); } catch (e) {}
  $('loading').style.display = 'none';
  intro();
  requestAnimationFrame(frame);
}
const FOOD_N = MOB ? 60 : 80;
// 在 (cx,cz) 附近找一块陆地
function findLand(cx, cz, biomes, rmin = 0, rmax = 60) {
  for (let i = 0; i < 600; i++) { const a = Math.random() * 6.283, d = rmin + Math.random() * (rmax - rmin + i * 0.5), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (biomes && !biomes.includes(biomeAt(x, z))) continue; if (H(x, z) < -0.1) continue; if (blocked(x, z, 2)) continue; return {x, z}; }
  return {x: cx + 5, z: cz + 5};
}
function placeNear(n, rmin, rmax) {
  // 优先放在玩家前方（看得到的地方）
  const a0 = PL.dir;
  for (let i = 0; i < 80; i++) { const a = a0 + (Math.random() - 0.5) * (i < 40 ? 2.2 : 6.28), d = rmin + Math.random() * (rmax - rmin), x = PL.x + Math.sin(a) * d, z = PL.z + Math.cos(a) * d;
    if (H(x, z) < -0.1 || blocked(x, z, 3)) continue; n.x = x; n.z = z; n.home = biomeAt(x, z); n.st = 'idle'; n.timer = Math.random() * 3; return true; }
  return false;
}
async function loadKinds() {
  const sets = [
    ['nat/CommonTree_1.glb', 11, {shadow: 1, saturate: 1.25, sway: 0.005, tall: 1}, ['fern'], 11, 2.5, 1.2], ['nat/CommonTree_2.glb', 12, {shadow: 1, saturate: 1.25, sway: 0.005, tall: 1}, ['fern', 'flower'], 10, 2.5, 1.2],
    ['nat/CommonTree_3.glb', 9, {shadow: 1, saturate: 1.25, sway: 0.005, tall: 1}, ['fern', 'flower'], 9, 2.5, 1.2], ['nat/CommonTree_4.glb', 9, {shadow: 1, saturate: 1.25, sway: 0.005, tall: 1}, ['fern'], 8, 2.5, 1.2],
    ['nat/CommonTree_5.glb', 10, {shadow: 1, saturate: 1.25, sway: 0.005, tall: 1}, ['fern'], 8, 2.5, 1.2],
    ['nat/PalmTree_1.glb', 11, {shadow: 1, saturate: 1.3, sway: 0.006, tall: 1}, ['palm'], 11, 2, 0.8], ['nat/PalmTree_2.glb', 10, {shadow: 1, saturate: 1.3, sway: 0.006, tall: 1}, ['palm', 'river'], 11, 2, 0.8],
    ['nat/PalmTree_3.glb', 12, {shadow: 1, saturate: 1.3, sway: 0.006, tall: 1}, ['palm'], 9, 2, 0.8], ['nat/PalmTree_4.glb', 9, {shadow: 1, saturate: 1.3, sway: 0.006, tall: 1}, ['palm', 'mesa'], 8, 2, 0.8],
    ['nat/Willow_1.glb', 10, {shadow: 1, saturate: 1.2, sway: 0.008, tall: 1}, ['river'], 6, 3, 1.2], ['nat/Willow_3.glb', 8, {shadow: 1, saturate: 1.2, sway: 0.008, tall: 1}, ['river'], 5, 3, 1.2],
    ['mega/Fern.glb', 1.25, {bright: 1.7, sway: 0.05, far: 120}, ['fern', 'palm', 'river'], 110, 0.5], ['mega/Flower Group.glb', 1.1, {far: 80, sway: 0.12}, ['flower'], 70, 0.3], ['mega/Bush with Flowers.glb', 1.6, {far: 100}, ['flower', 'fern'], 30, 0.6],
    ['mega/Tall Grass.glb', 1.3, {bright: 1.4, far: 80, sway: 0.12}, ['river', 'flower', 'fern'], 100, 0.2], ['mega/Mushroom.glb', 0.6, {far: 70}, ['fern'], 20, 0.3], ['mega/Plant Big.glb', 0.4, {bright: 1.5, far: 80}, ['fern', 'river'], 45, 0.3],
    ['nat/Flowers.glb', 0.9, {saturate: 1.4, far: 80, sway: 0.14}, ['flower', 'river'], 80, 0.2], ['nat/Plant_1.glb', 1.2, {saturate: 1.3, sway: 0.05, far: 100}, ['fern', 'palm'], 40, 0.3], ['nat/Plant_4.glb', 1.6, {saturate: 1.3, sway: 0.05, far: 110}, ['fern', 'palm', 'river'], 35, 0.4],
    ['nat/Bush_1.glb', 0.9, {saturate: 1.2, bright: 1.35, far: 110}, ['mesa', 'palm'], 20, 0.8], ['nat/BushBerries_1.glb', 1.6, {saturate: 1.3, far: 110}, ['fern', 'flower'], 20, 0.8],
    ['nat/Rock_Moss_2.glb', 1.4, {shadow: 1}, ['fern', 'river'], 20, 0.8, 0.7], ['nat/Rock_3.glb', 1.8, {shadow: 1, saturate: 0.6}, ['mesa', 'palm'], 20, 0.8, 0.8], ['nat/Rock_6.glb', 2.6, {shadow: 1}, ['mesa'], 13, 1, 1.2],
    ['nat/CactusFlowers_2.glb', 1.6, {saturate: 1.3, far: 90}, ['mesa'], 15, 0.6], ['nat/CactusFlowers_4.glb', 1.3, {saturate: 1.3, far: 90}, ['mesa'], 13, 0.6],
    ['nat/WoodLog_Moss.glb', 0.9, {shadow: 1, far: 100}, ['fern'], 6, 1],
    ['usn/PineTree_1.glb', 14, {shadow: 1, saturate: 1.1, sway: 0.004, tall: 1}, ['fern', 'river'], 6, 2.5, 1.0], ['usn/PineTree_3.glb', 12, {shadow: 1, saturate: 1.1, sway: 0.004, tall: 1}, ['fern', 'mesa'], 5, 2.5, 1.0],
    ['usn/Bush_Large.glb', 1.6, {far: 110, saturate: 1.2}, ['fern', 'river', 'palm'], 9, 0.8], ['usn/Bush_Flowers.glb', 1.5, {far: 100, saturate: 1.2}, ['flower', 'river'], 14, 0.6],
    ['usn/Flower_1_Clump.glb', 0.8, {far: 75, sway: 0.12, saturate: 1.2}, ['flower', 'fern'], 26, 0.2], ['usn/Flower_2_Clump.glb', 0.7, {far: 75, sway: 0.12, saturate: 1.2}, ['flower', 'palm'], 24, 0.2],
    ['nat/Rock_Moss_3.glb', 1.6, {shadow: 1}, ['river', 'fern'], 6, 0.8, 0.8], ['nat/TreeStump_Moss.glb', 1.0, {shadow: 1, far: 110}, ['fern', 'river'], 4, 0.8, 0.6],
    ['nat/Plant_5.glb', 1.3, {saturate: 1.3, sway: 0.05, far: 100}, ['river', 'palm'], 20, 0.3], ['nat/CactusFlowers_3.glb', 1.4, {saturate: 1.3, far: 90}, ['mesa'], 10, 0.6], ['nat/Grass_Short.glb', 0.6, {saturate: 1.3, far: 70, sway: 0.2}, ['fern', 'flower', 'river'], 150, 0.1],
  ];
  let done = 0;
  for (const [p, h, opt, biomes, n, margin, solidR] of sets) {
    if (MOB && opt.far) opt.far *= 0.8;
    const kd = makeKind((await loadGLB(p)).scene, h, opt); kd.name = p; WORLD.addKind(kd, biomes, n, margin, solidR);
    done++; $('loadTxt').textContent = `正在种树和种花… ${Math.round(done / sets.length * 100)}%`;
  }
  WORLD.lily = makeKind((await loadGLB('nat/Lilypad.glb')).scene, 0.12, {saturate: 1.3});
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
  for (const id of ['anky', 'pachy', 'ovi', 'spino', 'ptero', 'plesio']) {
    const D = makeDino(id, 6); D.holder.rotation.y = Math.PI * 0.42; D.mixer.update(0.3); s.add(D.holder); D.holder.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(D.holder, true), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), R0 = Math.max(sz.x, sz.y * 1.5, sz.z) * 0.75;
    cam.position.set(c.x + 0.6, c.y + R0 * 0.35, c.z + R0 / Math.tan(14 * Math.PI / 180) * 0.62); cam.lookAt(c);
    r.render(s, cam); THUMB[id] = r.domElement.toDataURL(); s.remove(D.holder);
  }
  r.dispose(); r.forceContextLoss && r.forceContextLoss();
}

/* ---------- 玩家 ---------- */
// 每吃一口都会长大一点：本阶段从 85% 慢慢长到 100%；最终形态还能继续长大一点
const growTarget = () => SV.stage < STAGES.length - 1 ? 0.85 + 0.15 * Math.min(1, SV.xp / NEED[SV.stage]) : 1 + Math.min(0.35, SV.xp / 400);
function spawnPlayer(first) {
  const old = PL.D; if (old) scene.remove(old.holder);
  PL.len = LEN[curId()]; PL.D = makeDino(modelOf(curId()), PL.len); scene.add(PL.D.holder);
  if (first) PL.dir = 0;
  const g = DINO[modelOf(curId())].gait, RM = {baby: 1.55, raptor: 1.15, para: 1.0, steg: 1.25, tri: 1.15, trex: 1.0, apato: 1.45};
  PL.walkSpd = g.Walk * PL.len * 1.35; PL.runSpd = g.Run * PL.len * RM[curId()]; PL.spd = 0; PL.holdT = 0; PL.look = 0; PL.lean = 0; PL.pitch = 0; PL.grow = growTarget();
}
const keys = {};
const keyName = e => (e.key || '').length === 1 ? e.key.toLowerCase() : e.key;
addEventListener('keydown', e => { const k = keyName(e); keys[k] = true; if (e.key.startsWith('Arrow') || k === ' ') e.preventDefault(); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { PL.tx = null; marker.visible = false; } });
addEventListener('keyup', e => { keys[keyName(e)] = false; });
$('callBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (G.fly) G.flyDown = 1; else callOut(); });
$('callBtn').addEventListener('pointerup', () => { G.flyDown = 0; }); $('callBtn').addEventListener('pointerleave', () => { G.flyDown = 0; });
$('flyBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (G.paused) return; G.fly ? endFly() : startFly(); });
$('homeBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.paused = true; $('overlay').classList.add('show'); HOME.ui($('box'), () => { $('overlay').classList.remove('show'); G.paused = false; }); });
addEventListener('keydown', e => { if (keyName(e) === 'c' && !e.repeat && !G.fly) callOut(); if (keyName(e) === 'f' && !e.repeat && !G.paused) G.fly ? endFly() : startFly(); });
$('dashBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (G.fly) G.flyUp = 1; else if (!G.paused) G.dashReq = true; });
$('dashBtn').addEventListener('pointerup', () => { G.flyUp = 0; }); $('dashBtn').addEventListener('pointerleave', () => { G.flyUp = 0; });
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
function setTarget() { const p = groundPoint(ptr.x, ptr.y); if (p) { PL.tx = p.x; PL.tz = p.z; marker.position.set(PL.tx, Math.max(H(PL.tx, PL.tz), WATER_Y) + 0.08, PL.tz); marker.visible = true; marker.userData.t = 0; } }
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
  if (H(x, z) < -1.0) return true; // 太深的湖
  for (const s of WORLD.solidsNear(x, z)) { const rr = s.r + r * 0.6; if (Math.abs(s.x - x) < rr && Math.abs(s.z - z) < rr && Math.hypot(s.x - x, s.z - z) < rr) return s; }
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
  if ((keys[' '] || G.dashReq) && (PL.dashCD || 0) <= 0 && fwd >= 0) { G.dashReq = false; PL.dashT = 0.7; PL.dashCD = 3; if (!fwd) fwd = 1; tone([392, 523], 0.04, 0.05); }
  G.dashReq = false; PL.dashCD = Math.max(0, (PL.dashCD || 0) - dt); if (PL.dashT > 0) { PL.dashT -= dt; if (!fwd) fwd = 1; }
  const run = fwd > 0 && ((PL.dashT > 0) || keys.Shift || (JOY.on ? (PL.far && PL.holdT > 0.35) : PL.holdT > 0.9) || (PL.tx !== null && PL.far && PL.holdT > 0.3));
  let target = fwd > 0 ? (run ? PL.runSpd : PL.walkSpd * (JOY.on ? 1.6 : 1)) * fwd : fwd < 0 ? -PL.walkSpd : 0;
  if (PL.dashT > 0) target = PL.runSpd * 1.7;
  if (PL.eatT > 0) target *= PL.dashT > 0 ? 0.7 : 0.3;
  const acc = target > PL.spd ? (PL.dashT > 0 ? 6 : run ? 1.6 : 4) : 5; PL.spd += (target - PL.spd) * Math.min(1, dt * acc);
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
  PL.scaleAnim += (1 - PL.scaleAnim) * Math.min(1, dt * 3); PL.grow += (growTarget() - PL.grow) * Math.min(1, dt * 2); D.holder.scale.setScalar(PL.scaleAnim * PL.grow);
  locomote(D, PL.animV, dt);
  // 跑步扬起尘土
  if (Math.abs(PL.animV) > PL.walkSpd * 1.6 && (PL.dustT = (PL.dustT || 0) - dt) < 0) { PL.dustT = PL.dashT > 0 ? 0.04 : 0.09; dust(PL.x - Math.sin(PL.dir) * PL.len * 0.15, y, PL.z - Math.cos(PL.dir) * PL.len * 0.15, PL.len); }
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
  const b = biomeAt(PL.x, PL.z); if (b !== G.curBiome) { if (G.curBiome !== null) { const B = BIOMES[b]; tip(`${B.icon} 来到了<b>${B.name}</b><br><span class="small">${B.fact}</span>`, 4500); } G.curBiome = b; questEvent('visit', b); }
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
    // 新食物大多出现在前方，走到哪里都有得吃
    const a = PL.dir + (Math.random() - 0.5) * (Math.random() < 0.6 ? 2.4 : 6.28), d = near ? 22 + Math.random() * 70 : 6 + Math.random() * 100;
    const x = PL.x + Math.sin(a) * d, z = PL.z + Math.cos(a) * d, h = H(x, z);
    if (f.water) { if (h > -0.45 || h < -1.0) continue; } else if (h < -0.15) continue;
    if (f.biomes && !f.biomes.includes(biomeAt(x, z))) continue;
    if (WORLD.solidsNear(x, z).some(s => Math.hypot(s.x - x, s.z - z) < s.r + f.r + 0.6)) continue;
    p = {x, z, h};
  }
  if (!p) return false;
  const obj = makeFood(type); const y = f.water ? WATER_Y : p.h;
  obj.position.set(p.x, y, p.z); obj.rotation.y = Math.random() * 6; scene.add(obj);
  const it = {type, x: p.x, z: p.z, y, obj, ph: Math.random() * 6, eaten: 0};
  // 偶尔出现闪闪发光的金色食物
  if (f.tier <= st && Math.random() < 0.05) { it.gold = true; const gm = new THREE.MeshStandardMaterial({color: '#ffd23f', emissive: '#ff9d00', emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.3}); gm.userData.own = true;
    obj.userData.body.traverse(o => { if (o.isMesh) o.material = gm; }); obj.userData.body.scale.multiplyScalar(1.15); }
  G.items.push(it); return true;
}
function eat(it, i) {
  const f = FOOD[it.type], sp = spInfo(curId()); let xp = f.xp, bonus = false;
  if ((f.kind === 'meat' && sp.diet === 'meat') || (f.kind === 'plant' && sp.diet === 'plant')) { xp = Math.round(xp * 1.5 + 0.4); bonus = true; }
  if (it.gold) xp *= 3;
  it.eaten = 0.0001; it.told = true;
  bite(PL.D); PL.eatT = 0.45;
  burstAt(it.x, it.y + f.r, it.z, it.gold ? '#ffe066' : f.kind === 'meat' ? '#ffd76a' : '#b8f27a', it.gold ? 22 : 10, it.gold ? 1.4 : 1);
  const cb = combo(); if (cb >= 3) xp += 1;
  floatText(`+${xp}${bonus ? ' ⭐' : ''}${it.gold ? ' ✨' : ''}${cb >= 3 ? ` 连吃×${cb}` : ''}`, it.x, it.y + f.r + 1, it.z);
  tone(it.gold ? [784, 988, 1175] : bonus ? [660, 880] : [587], 0.045, 0.07);
  if (it.gold) tip('✨ 金色食物！成长 ×3');
  else if (!SV.firstEat) { SV.firstEat = 1; tip('吃到啦！⭐ 表示这是你最擅长吃的食物，长得更快'); }
  questEvent('eat', it.type); if (it.gold) questEvent('gold'); questEvent('combo', cb);
  gainXP(xp);
}
// 连吃：2.5 秒内接着吃，数字往上加
function combo() { const now = G.t; G.combo = now - (G.lastEat || -9) < 2.5 ? (G.combo || 1) + 1 : 1; G.lastEat = now; if (G.combo >= 3) { const e = $('comboTxt'); e.textContent = `连吃 ×${G.combo}!`; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); } return G.combo; }
function gainXP(xp) {
  if (G.evoPending) return;
  if (SV.stage < STAGES.length - 1) { SV.xp += xp; if (SV.xp >= NEED[SV.stage]) { SV.xp = NEED[SV.stage]; save(); updHud(); setTimeout(evolveOffer, 600); G.evoPending = true; return; } }
  else SV.xp += xp;
  save(); updHud();
}
function updateItems(dt) {
  for (let k = 0; k < 3 && G.items.length < FOOD_N; k++) spawnFood(true);
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i], f = FOOD[it.type];
    if (it.eaten) { it.eaten += dt * 3; const s = Math.max(0, 1 - it.eaten); it.obj.scale.setScalar(s); it.obj.position.y = it.y + it.eaten * 0.8;
      if (it.eaten >= 1) { dropFood(it); G.items.splice(i, 1); } continue; }
    const dx = it.x - PL.x, dz = it.z - PL.z, d2 = dx * dx + dz * dz; if (d2 > 135 * 135) { dropFood(it); G.items.splice(i, 1); continue; } it.obj.visible = d2 < 120 * 120; if (!it.obj.visible) continue;
    if (it.gold) it.obj.userData.body.rotation.y += dt * 2;
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
    if (p.sp) { p.sp.position.y += p.vy * dt; p.k += dt * (p.note ? 0.15 : 1.2); if (p.note) p.sp.position.x += Math.sin(p.life * 4) * dt * 0.6; p.sp.scale.setScalar(p.k); p.sp.material.opacity = Math.max(0, p.life * 0.65); }
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
    let dPl = Math.hypot(n.x - PL.x, n.z - PL.z); if (dPl > 160 && !n.keep) { placeNear(n, 70, 130); dPl = Math.hypot(n.x - PL.x, n.z - PL.z); } const far = dPl > 140, g = DINO[n.id].gait, walkV = g.Walk * NPC_LEN[n.id] * 1.25;
    let v = 0;
    if (n.st === 'walk') { const dx = n.tx - n.x, dz = n.tz - n.z, l = Math.hypot(dx, dz);
      if (l < 1) { n.st = 'idle'; n.timer = 3 + Math.random() * 6; }
      else { const da = wrapA(Math.atan2(dx, dz) - n.dir); n.dir = wrapA(n.dir + Math.max(-1, Math.min(1, da * 2)) * dt * 0.9);
        v = walkV * (Math.abs(da) < 1 ? 1 : 0.3); const nx = n.x + Math.sin(n.dir) * v * dt, nz = n.z + Math.cos(n.dir) * v * dt;
        if (H(nx, nz) < -0.6 || WORLD.solidsNear(nx, nz).some(s => s.big && Math.hypot(s.x - nx, s.z - nz) < s.r + NPC_LEN[n.id] * 0.3)) { n.st = 'idle'; n.timer = 1; v = 0; }
        else { n.x = nx; n.z = nz; } } }
    else { n.timer -= dt; if (n.timer <= 0) { const p = randomSpotNear(n); n.tx = p.x; n.tz = p.z; n.st = 'walk'; }
      // 吃植物的恐龙停下来时会低头啃几口叶子
      if (!far && dPl < 70 && (SPECIES[n.id] || GOB[n.id]).diet === 'plant' && (n.grazeT = (n.grazeT ?? Math.random() * 4) - dt) < 0) { n.grazeT = 2.5 + Math.random() * 4; bite(n.D); const hx = n.x + Math.sin(n.dir) * NPC_LEN[n.id] * 0.45, hz = n.z + Math.cos(n.dir) * NPC_LEN[n.id] * 0.45; setTimeout(() => burstAt(hx, H(hx, hz) + 0.4, hz, '#7ccf52', 4, 0.5), 300); } }
    if (n.reply !== undefined && (n.reply -= dt) < 0) { n.reply = undefined; bite(n.D); notesAt(n.x, H(n.x, n.z) + NPC_LEN[n.id] * 0.55, n.z, 2); n.lookT = 3; if (SV.sound) tone([180 + 600 / NPC_LEN[n.id] * 3, 140 + 600 / NPC_LEN[n.id] * 3], 0.035, 0.16); }
    n.v = (n.v || 0) + (v - (n.v || 0)) * Math.min(1, dt * 4);
    n.D.holder.position.set(n.x, H(n.x, n.z), n.z); n.D.holder.rotation.y = n.dir;
    n.D.holder.visible = !far;
    if (!far) { locomote(n.D, n.v, dt); n.D.mixer.update(dt);
      // 玩家走近时，扭头看看你
      let la = 0; if ((n.lookT = (n.lookT || 0) - dt) > 0 || dPl < NPC_LEN[n.id] * 2.5 + 6) la = wrapA(Math.atan2(PL.x - n.x, PL.z - n.z) - n.dir); if (Math.abs(la) > 1.8) la = 0;
      n.look = (n.look || 0) + (Math.max(-0.8, Math.min(0.8, la)) - (n.look || 0)) * Math.min(1, dt * 3); if (Math.abs(n.look) > 0.01) headTurn(n.D, n.look); }
  }
}
function randomSpotNear(n) { for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, d = 8 + Math.random() * 25, x = n.x + Math.cos(a) * d, z = n.z + Math.sin(a) * d;
  if (H(x, z) > -0.3 && !WORLD.solidsNear(x, z).some(s => s.big && Math.hypot(s.x - x, s.z - z) < s.r + 3)) return {x, z}; } return {x: n.x, z: n.z}; }

/* ---------- 四季 ---------- */
const SEASON_LEN = 13.5 * 60; // 每个季节约 13 分钟
const S_TARGET = {spring: [1, 0, 0], summer: [0, 0, 0], autumn: [0, 1, 0], winter: [0, 0, 1]};
function curSeason() { const m = SV.seasonMode || 'auto'; if (m !== 'auto') return m; return SEASONS[Math.floor((SV.seasonClock || 0) / SEASON_LEN) % 4].id; }
function seasonInit() { G.season = curSeason(); SEASON.value.set(...S_TARGET[G.season]); updSeasonBadge(); }
function updSeasonBadge() { const S = SEASONS.find(x => x.id === G.season); $('seasonTag').textContent = S.icon + ' ' + S.name; }
function seasonUpdate(dt) {
  SV.seasonClock = (SV.seasonClock || 0) + dt;
  const s = curSeason();
  if (s !== G.season) { G.season = s; const S = SEASONS.find(x => x.id === s); tip(`${S.icon} ${S.tip}<br><span class="small">${S.fact}</span>`, 5500); updSeasonBadge(); }
  const T = S_TARGET[G.season], v = SEASON.value, k = Math.min(1, dt * 0.08);
  v.x += (T[0] - v.x) * k; v.y += (T[1] - v.y) * k; v.z += (T[2] - v.z) * k;
  const kind = v.z > 0.3 ? 'snow' : v.y > 0.3 ? 'leaf' : v.x > 0.3 ? 'petal' : 'none', amt = kind === 'snow' ? v.z : kind === 'leaf' ? v.y : v.x;
  FLAKES.set(kind, amt * (kind === 'snow' ? 0.9 : 0.8)); FLAKES.update(dt, G.t, ENV.rain || 0);
}
let _glow = null; function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c)); }

/* ---------- 回家 ---------- */
function goHome() {
  if (G.fly) endFly(true);
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => { const p = findLand(SV.home.x + 4, SV.home.z + 5, null, 0, 12); PL.x = p.x; PL.z = p.z; PL.tx = null; marker.visible = false; PL.dir = Math.atan2(SV.home.x - PL.x, SV.home.z - PL.z); G.camInit = false;
    WORLD.update(PL.x, PL.z, true); for (const it of [...G.items]) { dropFood(it); } G.items.length = 0; for (let i = 0; i < FOOD_N; i++) spawnFood(false); for (const n of G.npcs) placeNear(n, 25, 110);
    setTimeout(() => f.classList.remove('on'), 150); }, 600);
}

/* ---------- 变成翼龙飞 ---------- */
function startFly() {
  if (G.fly || G.evoPending || G.paused) return;
  G.fly = true; PL.saveLen = PL.len; const old = PL.D; scene.remove(old.holder); old.mixer.stopAllAction();
  PL.len = 2.6 + SV.stage * 0.9; PL.D = makeDino('ptero', PL.len); scene.add(PL.D.holder); PL.D.mixer.stopAllAction(); PL.D.acts.Walk.play();
  PL.fy = Math.max(H(PL.x, PL.z), WATER_Y) + 1; PL.alt = 17; PL.fspd = 6; PL.spd = 0; PL.animV = 0; PL.tx = null; marker.visible = false;
  burstAt(PL.x, PL.fy, PL.z, '#ffffff', 14, 1.2); tone([523, 659, 784, 1046], 0.04, 0.08);
  $('dashBtn').innerHTML = '⬆️<small>飞高</small>'; $('callBtn').innerHTML = '⬇️<small>飞低</small>'; $('flyBtn').innerHTML = '🦖<small>变回</small>';
  discover('ptero'); questEvent('fly');
  if (!SV.flyTip) { SV.flyTip = 1; tip(`🪽 变成翼龙啦！${MOB ? '摇杆转方向，⬆️⬇️ 飞高飞低' : '← → 转方向，↑ 快 ↓ 慢，空格飞高，C 飞低'}。低低地飞过水面能抓鱼。<br><span class="small">翼龙不是恐龙，是和恐龙同时代、会飞的爬行动物。</span>`, 6000); }
}
function endFly(quiet) {
  if (!G.fly) return; G.fly = false; scene.remove(PL.D.holder); PL.D.mixer.stopAllAction();
  spawnPlayer(false); PL.scaleAnim = 0.6; G.flyUp = G.flyDown = 0;
  const p = findLand(PL.x, PL.z, null, 0, 30); PL.x = p.x; PL.z = p.z;
  $('dashBtn').innerHTML = '💨<small>冲刺</small>'; $('callBtn').innerHTML = '🎵<small>叫一声</small>'; $('flyBtn').innerHTML = '🪽<small>飞</small>';
  if (!quiet) { burstAt(PL.x, H(PL.x, PL.z) + 1, PL.z, '#ffffff', 12, 1); tip('🦖 落地，变回恐龙啦！', 2000); }
}
function updateFly(dt) {
  let turn = 0, sp = 1;
  if (keys.ArrowLeft || keys.a) turn += 1; if (keys.ArrowRight || keys.d) turn -= 1;
  if (keys.ArrowUp || keys.w) sp = 1.7; else if (keys.ArrowDown || keys.s) sp = 0.5;
  if (keys.q) { CAM.yaw += dt * 1.8; CAM.manualT = G.t; } if (keys.e) { CAM.yaw -= dt * 1.8; CAM.manualT = G.t; }
  let wantTurn = turn * 1.4;
  const jm = Math.hypot(JOY.x, JOY.y);
  if (JOY.on && jm > 0.15) { const sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw), wx = -sy * -JOY.y + cy * JOY.x, wz = -cy * -JOY.y - sy * JOY.x;
    const da = wrapA(Math.atan2(wx, wz) - PL.dir); wantTurn = Math.max(-1.6, Math.min(1.6, da * 2)); sp = 0.7 + jm; }
  if (!turn && !(JOY.on && jm > 0.15) && PL.tx !== null) { const da = wrapA(Math.atan2(PL.tx - PL.x, PL.tz - PL.z) - PL.dir); wantTurn = Math.max(-1.6, Math.min(1.6, da * 2)); if (Math.hypot(PL.tx - PL.x, PL.tz - PL.z) < 4) { PL.tx = null; marker.visible = false; } }
  if (keys[' '] || G.flyUp) PL.alt = Math.min(45, PL.alt + dt * 9); if (keys.c || G.flyDown) PL.alt = Math.max(1.2, PL.alt - dt * 9);
  const base = 7 + SV.stage * 1.8; PL.fspd += (base * sp - PL.fspd) * Math.min(1, dt * 1.5);
  PL.turnV = (PL.turnV || 0) + (wantTurn - (PL.turnV || 0)) * Math.min(1, dt * 4); PL.dir = wrapA(PL.dir + PL.turnV * dt);
  PL.x += Math.sin(PL.dir) * PL.fspd * dt; PL.z += Math.cos(PL.dir) * PL.fspd * dt;
  // 高度：跟着地面起伏，飞过红岩台地会自己抬高
  let floor = Math.max(H(PL.x, PL.z), WATER_Y); for (const s of WORLD.solidsNear(PL.x, PL.z)) if (s.big && Math.hypot(s.x - PL.x, s.z - PL.z) < s.r + 3) floor = Math.max(floor, H(s.x, s.z) + 14);
  const wantY = floor + PL.alt; PL.fy += (wantY - PL.fy) * Math.min(1, dt * 1.6);
  const D = PL.D; D.holder.position.set(PL.x, PL.fy, PL.z); D.holder.rotation.set(0, PL.dir, 0); D.holder.rotation.z = -PL.turnV * 0.35;
  D.acts.Walk.timeScale = (keys[" "] || G.flyUp) ? 1.6 : 0.8 + sp * 0.2;
  PL.spd = 0; PL.animV = 0; PL.look = 0;
  // 低飞时可以吃东西（翼龙最爱抓鱼）
  if (PL.fy - floor < 3.2) for (let i = G.items.length - 1; i >= 0; i--) { const it = G.items[i]; if (it.eaten || FOOD[it.type].tier > SV.stage + 1) continue; if (Math.hypot(it.x - PL.x, it.z - PL.z) < 1.8 + PL.len * 0.2) { eat(it, i); } }
  if (PL.fy - floor < 1.8 && floor <= WATER_Y + 0.01 && (G.splT = (G.splT || 0) - dt) < 0) { G.splT = 0.25; LIFE.ripple(PL.x, PL.z, 1.2); }
}

/* ---------- 叫一声：附近的恐龙会回应你 ---------- */
let noteTex = null;
function notesAt(x, y, z, n) {
  if (!noteTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#7a4fd0'; g.lineWidth = 6; g.strokeText('♪', 32, 34); g.fillText('♪', 32, 34); noteTex = new THREE.CanvasTexture(c); }
  for (let i = 0; i < n; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: noteTex, transparent: true, depthWrite: false})); sp.position.set(x + (Math.random() - 0.5) * 1.2, y + i * 0.5, z + (Math.random() - 0.5) * 1.2); scene.add(sp); G.parts.push({sp, life: 1.6 + i * 0.2, k: 0.8, vy: 1.3, note: 1}); }
}
const CALL_TONE = {baby: [880, 1046], raptor: [660, 880], para: [196, 262, 330], steg: [247, 294], tri: [220, 277], trex: [147, 196], apato: [110, 147, 196]};
function callOut() {
  if (G.paused || G.evoPending || G.t - (G.callT || -9) < 2) return; G.callT = G.t;
  bite(PL.D); const y = H(PL.x, PL.z) + PL.len * 0.6; notesAt(PL.x + Math.sin(PL.dir) * PL.len * 0.4, y, PL.z + Math.cos(PL.dir) * PL.len * 0.4, 3);
  tone(CALL_TONE[curId()] || [440, 660], 0.05, 0.14);
  let k = 0; for (const n of G.npcs) { const d = Math.hypot(n.x - PL.x, n.z - PL.z); if (d < 45 && n.D.holder.visible) { n.reply = 0.5 + d / 30 + Math.random() * 0.5; k++; } }
  for (const b of LIFE.followers) notesAt(b.x, H(b.x, b.z) + b.len * 0.7, b.z, 1);
  const heard = LIFE.heard();
  if (!SV.callTip) { SV.callTip = 1; if (!heard) tip(k ? '🎵 你叫了一声，附近的恐龙也回应你了！' : '🎵 你叫了一声。走到别的恐龙旁边再叫，它们会回应你。', 3500); }
  questEvent('call', k);
}

/* ---------- 捕猎：吃肉的恐龙可以追比自己小的恐龙 ---------- */
const PREY_KINDS = ['para', 'steg', 'tri', 'raptor', 'pachy', 'ovi', 'anky'];
const PREY_N = MOB ? 3 : 5;
const canHunt = () => SV.hunt && !G.fly && spInfo(curId()).diet === 'meat';
function spawnPrey() {
  const id = PREY_KINDS[Math.floor(Math.random() * PREY_KINDS.length)], len = Math.max(0.9, PL.len * (0.4 + Math.random() * 0.25));
  const D = makeDino(id, len); const n = {D, id, len, x: 0, z: 0, dir: Math.random() * 6, st: 'idle', timer: 1, tx: 0, tz: 0, v: 0, stamina: 4, tired: 0, prey: true};
  if (!placeNear(n, 30, 90)) return; scene.add(D.holder); G.prey.push(n);
}
function dropPrey(n) { scene.remove(n.D.holder); n.D.mixer.stopAllAction(); G.prey.splice(G.prey.indexOf(n), 1); }
function updatePrey(dt) {
  if (G.prey.length < PREY_N && Math.random() < dt * 0.5) spawnPrey();
  const hunt = canHunt(), mx = PL.x + Math.sin(PL.dir) * PL.len * 0.42, mz = PL.z + Math.cos(PL.dir) * PL.len * 0.42;
  for (const n of [...G.prey]) {
    const dPl = Math.hypot(n.x - PL.x, n.z - PL.z);
    if (dPl > 150 || n.len > PL.len * 0.85) { dropPrey(n); continue; }
    const g = DINO[n.id].gait, walkV = g.Walk * n.len * 1.3, runV = Math.min(g.Run * n.len * 1.4, PL.runSpd * 0.72);
    let v = 0, wantDir = n.dir;
    const scared = hunt && dPl < PL.len * 2.5 + 9 && n.tired <= 0;
    if (scared) { // 逃跑：跑一会儿会累，所以一定追得上
      wantDir = Math.atan2(n.x - PL.x, n.z - PL.z) + Math.sin(G.t * 1.3 + n.len * 7) * 0.5; v = runV; n.stamina -= dt; if (n.stamina <= 0) { n.tired = 1.8; n.stamina = 3.5; }
      if (!n.told && dPl < PL.len * 2 + 6) { n.told = true; if (!SV.huntTip) { SV.huntTip = 1; tip(`小${nameOf(n.id)}比你小，追上它！${MOB ? '点「冲刺」' : '按空格'}可以冲刺 💨`, 4000); } } }
    else { if (n.tired > 0) n.tired -= dt;
      if (n.st === 'walk') { const dx = n.tx - n.x, dz = n.tz - n.z; if (Math.hypot(dx, dz) < 1) { n.st = 'idle'; n.timer = 2 + Math.random() * 4; } else { wantDir = Math.atan2(dx, dz); v = walkV * (n.tired > 0 ? 0.5 : 1); } }
      else { n.timer -= dt; if (n.timer <= 0) { const p = randomSpotNear(n); n.tx = p.x; n.tz = p.z; n.st = 'walk'; } } }
    const da = wrapA(wantDir - n.dir); n.dir = wrapA(n.dir + Math.max(-1, Math.min(1, da * 3)) * dt * (scared ? 4 : 1.2));
    const nx = n.x + Math.sin(n.dir) * v * dt, nz = n.z + Math.cos(n.dir) * v * dt;
    if (H(nx, nz) < -0.6 || blocked(nx, nz, n.len * 0.3)) { n.dir += 1.2 * dt * 3; n.st = 'idle'; n.timer = 0.3; v *= 0.2; } else { n.x = nx; n.z = nz; }
    n.v += (v - n.v) * Math.min(1, dt * 5);
    n.D.holder.position.set(n.x, H(n.x, n.z), n.z); n.D.holder.rotation.y = n.dir; n.D.holder.visible = dPl < 140;
    if (dPl < 140) { locomote(n.D, n.v, dt); n.D.mixer.update(dt); }
    // 抓到了
    if (hunt && !G.evoPending && Math.hypot(n.x - mx, n.z - mz) < PL.len * 0.35 + n.len * 0.4) catchPrey(n);
  }
}
function catchPrey(n) {
  bite(PL.D); PL.eatT = 0.5; const y = H(n.x, n.z) + n.len * 0.25;
  burstAt(n.x, y, n.z, '#fff3a8', 18, 1.3); burstAt(n.x, y, n.z, '#ffffff', 10, 1.1);
  const cb = combo(); let xp = Math.round((3 + SV.stage * 2) * 1.5) + (cb >= 3 ? 1 : 0);
  floatText(`+${xp} ⭐ 抓到小${nameOf(n.id)}!`, n.x, y + 1.2, n.z); tone([523, 784, 1046], 0.05, 0.08);
  if (!SV.firstCatch) { SV.firstCatch = 1; tip('抓到啦！吃肉的恐龙会捕猎比自己小的恐龙 🌟'); }
  dropPrey(n); questEvent('prey'); questEvent('combo', cb); gainXP(xp);
}

/* ---------- 小任务：给一个小目标，完成有奖励 ---------- */
let Q = null;
function newQuest(first) {
  const st = SV.stage + 1, edible = FOOD_KEYS.filter(k => FOOD[k].tier <= st && FOOD[k].tier >= st - 1 && !FOOD[k].water);
  const here = biomeAt(PL.x, PL.z), others = Object.keys(BIOMES).filter(b => b !== here);
  const pool = [];
  const t = edible[Math.floor(Math.random() * edible.length)]; if (t) pool.push({kind: 'eat', type: t, need: 3 + Math.floor(Math.random() * 3), text: n => `吃 ${n} 个${FOOD[t].icon}${FOOD[t].name}`});
  pool.push({kind: 'eatany', need: 8 + SV.stage * 2, text: n => `吃 ${n} 口任何食物`});
  pool.push({kind: 'combo', need: 3, text: () => '连吃 3 口（2.5 秒内接着吃）'});
  const b = others[Math.floor(Math.random() * others.length)]; pool.push({kind: 'visit', biome: b, need: 1, text: () => `去找 ${BIOMES[b].icon}${BIOMES[b].name}`});
  if (canHunt()) pool.push({kind: 'prey', need: 2, text: n => `抓到 ${n} 只小恐龙`});
  if (!first) pool.push({kind: 'gold', need: 1, text: () => '找到一个 ✨金色食物'});
  pool.push({kind: 'collect', need: 2, text: n => `捡 ${n} 个装饰品（闪着光的东西）`});
  if (Math.hypot(PL.x - SV.home.x, PL.z - SV.home.z) > 60) pool.push({kind: 'home', need: 1, text: () => '回 🏠 小窝看看（菜单里也能直接回家）'});
  if (!G.fly) pool.push({kind: 'fly', need: 1, text: () => '变成翼龙，在天上飞一会儿 🪽'});
  pool.push({kind: 'call', need: 1, text: () => `对着别的恐龙「叫一声」🎵`});
  if (LIFE && LIFE.lost) pool.push({kind: 'lost', need: 1, text: () => '带迷路的恐龙宝宝找到妈妈 💗'});
  pool.push({kind: 'nest', need: 1, text: () => '找到一个 🥚 恐龙蛋窝（看小地图）'});
  if (Object.keys(SV.book).length < BOOK.length) pool.push({kind: 'book', need: 1, text: () => '发现一种新的恐龙 📖'});
  Q = pool[Math.floor(Math.random() * pool.length)]; Q.have = 0;
  if (Q.kind === 'visit') Q.target = searchBiome(Q.biome);
  showQuest();
}
function searchBiome(b) { for (let r = 40; r < 900; r += 25) for (let a = 0; a < 6.28; a += 0.25) { const x = PL.x + Math.sin(a) * r, z = PL.z + Math.cos(a) * r; if (biomeAt(x, z) === b && H(x, z) > -0.1) return {x, z}; } return null; }
function showQuest() { if (!Q) return; $('questTxt').textContent = `🎯 ${Q.text(Q.need)}` + (Q.need > 1 ? `（${Q.have}/${Q.need}）` : ''); }
function questEvent(kind, arg) {
  if (!Q || G.evoPending) return;
  let hit = false;
  if (Q.kind === 'eat' && kind === 'eat' && arg === Q.type) hit = true;
  if (Q.kind === 'eatany' && kind === 'eat') hit = true;
  if (Q.kind === 'prey' && kind === 'prey') hit = true;
  if (Q.kind === 'gold' && kind === 'gold') hit = true;
  if (Q.kind === 'nest' && kind === 'nest') hit = true;
  if (Q.kind === 'lost' && kind === 'lost') hit = true;
  if ((Q.kind === 'collect' && kind === 'collect') || (Q.kind === 'home' && kind === 'home') || (Q.kind === 'fly' && kind === 'fly')) hit = true;
  if (Q.kind === 'call' && kind === 'call' && arg > 0) hit = true;
  if (Q.kind === 'book' && kind === 'book') hit = true;
  if (Q.kind === 'visit' && kind === 'visit' && arg === Q.biome) hit = true;
  if (Q.kind === 'combo' && kind === 'combo') { Q.have = Math.max(Q.have, arg); if (Q.have >= Q.need) { Q.have = Q.need; done(); } else showQuest(); return; }
  if (!hit) return; Q.have++; showQuest(); if (Q.have >= Q.need) done();
  function done() { const xp = 4 + SV.stage * 3; tip(`🎉 任务完成：${Q.text(Q.need)}！成长 +${xp}`, 3500); tone([523, 659, 784, 1046], 0.05, 0.1); $('quest').classList.add('done');
    burstAt(PL.x, H(PL.x, PL.z) + PL.len * 0.6, PL.z, '#ffe27a', 24, 1.5); Q = null; setTimeout(() => { $('quest').classList.remove('done'); newQuest(); }, 2500); setTimeout(() => gainXP(xp), 300); }
}
function updateQuestArrow() {
  const el = $('questArrow'); if (!Q || Q.kind !== 'visit' || !Q.target) { el.style.display = 'none'; return; }
  const a = Math.atan2(Q.target.x - PL.x, Q.target.z - PL.z), rel = wrapA(a - (CAM.yaw + Math.PI)); el.style.display = 'inline-block'; el.style.transform = `rotate(${-rel}rad)`;
}

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
  if (G.fly) endFly(true);
  if (evolving || SV.stage >= STAGES.length - 1 || !STAGES[SV.stage + 1].opts.includes(id)) return;
  evolving = true; setTimeout(() => evolving = false, 800); holdOff(1200);
  SV.stage++; SV.path[SV.stage] = id; SV.path.length = SV.stage + 1; SV.xp = 0; if (!SV.done.includes(id)) SV.done.push(id); save();
  const s = spInfo(id), oldLen = PL.len * PL.grow;
  spawnPlayer(false); PL.scaleAnim = oldLen / (PL.len * PL.grow); PL.D.holder.scale.setScalar(PL.scaleAnim);
  const y = H(PL.x, PL.z); burstAt(PL.x, y + PL.len * 0.3, PL.z, '#fff3a8', 26, 1.6); burstAt(PL.x, y + PL.len * 0.3, PL.z, '#9ff0ff', 16, 1.4);
  $('box').innerHTML = `<h1>🎉 变成${s.name}了！</h1><img class="big" src="${THUMB[id]}" alt=""><p>💡 ${s.facts[0]}</p>
    ${SV.stage === STAGES.length - 1 ? '<p><b>这是最终形态！</b>继续在世界里散步、吃东西、看看其他恐龙吧。想换一条路线，可以在菜单里“重新长大”。</p>' : ''}
    <button class="btn" id="goOn">继续冒险 ➜</button>`;
  say('变成' + s.name + '了');
  $('goOn').onclick = () => { $('overlay').classList.remove('show'); G.paused = false;
    // 太小的食物换成合适的
    for (let i = G.items.length - 1; i >= 0; i--) { const it = G.items[i]; if (FOOD[it.type].tier < SV.stage) { dropFood(it); G.items.splice(i, 1); } }
    while (G.items.length < FOOD_N) if (!spawnFood(false)) break;
    for (const n of [...G.prey]) dropPrey(n); newQuest();
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
let mapBg = null, mapCx = 1e9, mapCz = 1e9; const MAPR = 110;
function buildMinimap() {
  const c = mapBg || document.createElement('canvas'), S = 150; c.width = S; c.height = S; const x = c.getContext('2d'); mapCx = PL.x; mapCz = PL.z;
  for (let i = 0; i < S; i += 3) for (let j = 0; j < S; j += 3) { const wx = mapCx + (i / S * 2 - 1) * MAPR, wz = mapCz + (j / S * 2 - 1) * MAPR, h = H(wx, wz);
    x.fillStyle = h < -0.4 ? '#45c4d4' : BIOMES[biomeAt(wx, wz)].map; x.fillRect(i, j, 3, 3); }
  mapBg = c;
}
function drawMinimap() {
  if (Math.hypot(PL.x - mapCx, PL.z - mapCz) > 25) buildMinimap();
  const c = $('map'), x = c.getContext('2d'), S = c.width, k = S / (2 * MAPR), toX = wx => S / 2 + (wx - PL.x) * k, toY = wz => S / 2 + (wz - PL.z) * k;
  x.clearRect(0, 0, S, S); x.drawImage(mapBg, toX(mapCx - MAPR), toY(mapCz - MAPR), S, S);
  x.fillStyle = '#ffd23f'; for (const it of G.items) { if (it.eaten || FOOD[it.type].tier > SV.stage + 1) continue; x.fillRect(toX(it.x) - 1.5, toY(it.z) - 1.5, 3, 3); }
  x.fillStyle = 'rgba(255,255,255,.85)'; for (const n of G.npcs) { x.beginPath(); x.arc(toX(n.x), toY(n.z), 2.4, 0, 7); x.fill(); }
  if (canHunt()) { x.fillStyle = '#ff7a59'; for (const n of G.prey) { x.beginPath(); x.arc(toX(n.x), toY(n.z), 2.6, 0, 7); x.fill(); } }
  { const hx = SV.home.x, hz = SV.home.z, a = Math.atan2(hx - PL.x, hz - PL.z), d = Math.min(S / 2 - 9, Math.hypot(hx - PL.x, hz - PL.z) * k); x.font = '15px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🏠', S / 2 + Math.sin(a) * d, S / 2 + Math.cos(a) * d); }
  x.fillStyle = '#c58cff'; for (const it of HOME.items) { x.beginPath(); x.arc(toX(it.x), toY(it.z), 3, 0, 7); x.fill(); }
  if (LIFE.lost) { const B = LIFE.lost, T = B.st === 'wait' ? B : B.mom, a = Math.atan2(T.x - PL.x, T.z - PL.z), d = Math.min(S / 2 - 9, Math.hypot(T.x - PL.x, T.z - PL.z) * k); x.font = '14px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(B.st === 'wait' ? '❓' : '💗', S / 2 + Math.sin(a) * d, S / 2 + Math.cos(a) * d); }
  if (LIFE.nest) { const a = Math.atan2(LIFE.nest.x - PL.x, LIFE.nest.z - PL.z), d = Math.min(S / 2 - 9, Math.hypot(LIFE.nest.x - PL.x, LIFE.nest.z - PL.z) * k); x.font = '14px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🥚', S / 2 + Math.sin(a) * d, S / 2 + Math.cos(a) * d); }
  if (Q && Q.kind === 'visit' && Q.target) { const a = Math.atan2(Q.target.x - PL.x, Q.target.z - PL.z); x.fillStyle = '#ffe066'; x.font = '16px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const d = Math.min(S / 2 - 10, Math.hypot(Q.target.x - PL.x, Q.target.z - PL.z) * k); x.fillText('🎯', S / 2 + Math.sin(a) * d, S / 2 + Math.cos(a) * d); }
  x.save(); x.translate(S / 2, S / 2); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 22, -Math.PI / 2 - CAM.yaw - 0.5, -Math.PI / 2 - CAM.yaw + 0.5); x.closePath(); x.fill(); x.rotate(-PL.dir + Math.PI); x.fillStyle = '#ff5a3c'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 5); x.lineTo(-5, 5); x.closePath(); x.stroke(); x.fill(); x.restore();
}

/* ---------- 恐龙图鉴：见过的恐龙都会记下来 ---------- */
const infoOf = id => SPECIES[id] || GOB[id];
function discover(id) {
  if (!BOOK.includes(id) || SV.book[id]) return; SV.book[id] = 1; save(); G.bookQ = (G.bookQ || []).concat(id); questEvent('book'); $('menuBtn').classList.add('new');
}
function showDiscover() {
  if (!G.bookQ || !G.bookQ.length || G.t - (G.bookTipT || -99) < 5.5) return; G.bookTipT = G.t; const id = G.bookQ.shift();
  const I = infoOf(id), f = I.facts[Math.floor(Math.random() * I.facts.length)];
  tip(`📖 新发现：<b>${I.name}</b>！（图鉴 ${Object.keys(SV.book).length}/${BOOK.length}）<br><span class="small">${f}</span>`, 5000); tone([659, 784, 988], 0.04, 0.1);
}
function checkBook() {
  showDiscover();
  discover(modelOf(curId()));
  for (const n of G.npcs) if (n.D.holder.visible && Math.hypot(n.x - PL.x, n.z - PL.z) < 26 + NPC_LEN[n.id]) discover(n.id);
  for (const f of LIFE.fliers) if (Math.hypot(f.D.holder.position.x - PL.x, f.D.holder.position.z - PL.z) < 50) discover('ptero');
  for (const w of LIFE.swimmers) if (w.D.holder.visible && Math.hypot(w.x - PL.x, w.z - PL.z) < 40) discover('plesio');
}
function showBook() {
  G.paused = true; $('menuBtn').classList.remove('new');
  const n = Object.keys(SV.book).length;
  $('box').innerHTML = `<h1>📖 恐龙图鉴 <small style="font-size:18px;color:#6c7563">${n}/${BOOK.length}</small></h1><p style="color:#6c7563">走近没见过的恐龙，它就会被记进图鉴。点卡片看资料。</p>
   <div class="book">${BOOK.map(id => { const I = infoOf(id), got = SV.book[id]; return `<button class="bcard${got ? '' : ' lock'}" data-id="${id}"><img src="${THUMB[id] || ''}" alt=""><b>${got ? I.name : '？？？'}</b>${got && I.notDino ? '<small>不是恐龙哦</small>' : ''}</button>`; }).join('')}</div>
   <div id="bookInfo"></div><button class="btn" id="resume">继续</button>`;
  $('overlay').classList.add('show');
  $('resume').onclick = () => { $('overlay').classList.remove('show'); G.paused = false; };
  document.querySelectorAll('.bcard').forEach(b => b.onclick = () => { const id = b.dataset.id, I = infoOf(id);
    $('bookInfo').innerHTML = SV.book[id] ? `<h2>${I.name}</h2><p class="tags"><span>🕰️ ${I.period}</span><span>📏 ${I.len}</span><span>🍽️ ${{meat: '吃肉', plant: '吃植物', fish: '吃鱼', all: '什么都吃一点'}[I.diet]}</span></p><ul>${I.facts.map(f => `<li>${f}</li>`).join('')}</ul>` : '<p>还没遇到过这种恐龙，到处走走找找看吧！</p>'; });
}

/* ---------- 菜单 / 开场 ---------- */
function intro() {
  G.paused = true;
  $('box').innerHTML = `<h1>🥚 恐龙长大记</h1><p>你是一只刚出生的小恐龙。在大陆上走来走去，<b>吃东西长大</b>，吃饱了就能<b>进化</b>成更大的恐龙！</p>
   <div class="legend">${MOB ? '<span>🕹️ 左下角摇杆 = 走路，推到底会跑</span><span>👆 轻点地面 = 走过去</span><span>☝️ 单指滑动 = 转视角</span><span>🤏 双指捏合 = 拉近拉远</span><span>➤ 屏幕边的箭头指向最近的食物</span><span>🔒 太大的食物，要长大才能吃</span><span>💨 冲刺按钮 = 跑得更快</span><span>🎵 叫一声按钮</span>' : `<span>🖱️ 点地面 = 走过去</span><span>🖱️ 按住拖动 = 转动视角</span><span>⌨️ ↑ 往前走（走久了会跑）← → 转身</span><span>⌨️ Q / E 转视角</span><span>🔍 滚轮 = 拉近拉远</span><span>➤ 屏幕边的箭头指向最近的食物</span><span>🔒 太大的食物，要长大才能吃</span><span>⭐ 选对擅长的食物长得更快</span><span>💨 空格 = 冲刺</span><span>🎵 C 键 = 叫一声</span>`}</div>
   <p>这片大陆<b>没有边界</b>，可以一直走下去：🌿蕨类森林、🌼开花草原、💧大河湿地、🌴苏铁海岸、🏜️红岩台地会一片接一片出现。</p><p>🎯 左上角有小任务；✨金色食物成长 ×3；连续吃会有“连吃”奖励；吃肉的恐龙还可以追小恐龙。</p><p>🥚 小地图上的蛋是恐龙蛋窝，走过去会孵出恐龙宝宝跟着你；❓ 是迷路的恐龙宝宝，带它去找 💗 妈妈；📖 遇到新恐龙会记进菜单里的图鉴。</p><p>🏠 你有自己的小窝（小地图上的 🏠）：路上捡到闪着光的装饰品可以带回家摆，孵出来的宝宝也会住在家里。🪽 右边的按钮可以变成翼龙在天上飞。一年四季会慢慢变化。</p><p>🎵 「叫一声」附近的恐龙会回应你。天会慢慢变黑再变亮，偶尔下小雨，雨后有彩虹（菜单里可以关掉）。</p>
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
   <p class="credits">素材来源（全部是 CC0 公共领域授权，可以免费使用）：恐龙模型 — Quaternius「Animated Dinosaur Pack」和 Gobkit「Free Dinosaur Pack」；树、棕榈、松树、花、石头 — Quaternius「Ultimate Nature Pack」「Ultimate Stylized Nature」和「Stylized Nature MegaKit」。鳞片质感、配色、地形、河流、红岩、天空、食物都是程序里原创画的。</p>
   <p><button class="btn light" id="bookBtn">📖 恐龙图鉴（${Object.keys(SV.book).length}/${BOOK.length}）</button></p>
   <p><button class="btn light" id="goHome">🏠 回家</button> <button class="btn light" id="setHome">📍 在这里安家</button> <button class="btn light" id="flyMenu">${G.fly ? '🦖 变回恐龙' : '🪽 变成翼龙飞'}</button></p>
   <p>🍃 季节：${['auto', ...SEASONS.map(x => x.id)].map(id => `<button class="sbtn${(SV.seasonMode || 'auto') === id ? ' on' : ''}" data-s="${id}">${id === 'auto' ? '🔄 会变化' : SEASONS.find(x => x.id === id).icon + ' 一直' + SEASONS.find(x => x.id === id).name}</button>`).join('')}</p>
   <p><button class="btn light" id="dayBtn">🌗 白天黑夜：${SV.daynight !== false ? '会变化' : '一直白天'}</button> <button class="btn light" id="wxBtn">🌧️ 下雨：${SV.weather !== false ? '会下' : '不下'}</button></p>
   <p><button class="btn light" id="huntBtn">🦖 捕猎小恐龙：${SV.hunt ? '开' : '关'}</button></p>
   <button class="btn" id="resume">继续</button><button class="btn light" id="howBtn">怎么玩</button><button class="btn light" id="restart">重新长大</button>`;
  $('overlay').classList.add('show');
  $('resume').onclick = () => { $('overlay').classList.remove('show'); G.paused = false; };
  $('howBtn').onclick = intro;
  $('bookBtn').onclick = showBook;
  $('goHome').onclick = () => { $('overlay').classList.remove('show'); G.paused = false; goHome(); };
  let armH = false; $('setHome').onclick = e => { if (!armH) { armH = true; e.target.textContent = '再按一次：搬到这里'; return; } const p = findLand(PL.x + Math.sin(PL.dir) * 6, PL.z + Math.cos(PL.dir) * 6, null, 0, 20); HOME.setHome(p.x, p.z); $('overlay').classList.remove('show'); G.paused = false; tip('📍 新家安好啦！装饰和宝宝都搬过来了。'); };
  $('flyMenu').onclick = () => { $('overlay').classList.remove('show'); G.paused = false; G.fly ? endFly() : startFly(); };
  document.querySelectorAll('.sbtn').forEach(b => b.onclick = () => { SV.seasonMode = b.dataset.s; save(); document.querySelectorAll('.sbtn').forEach(x => x.classList.toggle('on', x === b)); });
  $('dayBtn').onclick = e => { SV.daynight = SV.daynight === false; save(); e.target.textContent = `🌗 白天黑夜：${SV.daynight !== false ? '会变化' : '一直白天'}`; };
  $('wxBtn').onclick = e => { SV.weather = SV.weather === false; save(); e.target.textContent = `🌧️ 下雨：${SV.weather !== false ? '会下' : '不下'}`; };
  $('huntBtn').onclick = e => { SV.hunt = !SV.hunt; save(); e.target.textContent = `🦖 捕猎小恐龙：${SV.hunt ? '开' : '关'}`; if (Q && Q.kind === 'prey' && !SV.hunt) newQuest(); };
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
  if (!G.paused) { if (G.fly) updateFly(dt); else updatePlayer(dt); updateNPCs(dt); updatePrey(dt); updateItems(dt); updateQuestArrow(); LIFE.update(dt); if ((G.bookT = (G.bookT || 0) - dt) < 0) { G.bookT = 0.5; checkBook(); } }
  WORLD.update(PL.x, PL.z);
  if (!G.paused) { ENV.update(dt); seasonUpdate(dt); HOME.update(dt, LIFE.followers); $('homeBtn').style.display = HOME.near ? '' : 'none'; }
  PL.D.mixer.update(G.paused ? 0 : dt); if (Math.abs(PL.look) > 0.01) headTurn(PL.D, PL.look);
  updateLife(dt);
  updateParts(dt);
  if (G.water) { G.water.uT.value = G.t; G.water.mesh.position.x = PL.x; G.water.mesh.position.z = PL.z; }
  if (marker.visible) { marker.userData.t += dt; marker.scale.setScalar(1 + 0.15 * Math.sin(marker.userData.t * 5)); }
  // 相机：在恐龙身后，走路时慢慢转到身后；拖动鼠标或 Q/E 可以自己转
  const behind = PL.dir + Math.PI;
  if (G.t - CAM.manualT > 2.5 && (Math.abs(PL.spd) > 0.5 || PL.tx !== null)) CAM.yaw += wrapA(behind - CAM.yaw) * Math.min(1, dt * (PL.spd < 0 ? 0.3 : 1.4) * (JOY.on ? Math.pow(PL.joyFwd || 0, 2) * 0.8 : 1));
  if (!G.camInit) CAM.yaw = behind;
  const dist = (5 + PL.len * 1.35) * (G.zoom || 1), y0 = G.fly ? PL.fy - PL.len * 0.3 : H(PL.x, PL.z);
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
  G.skyo.sky.position.copy(camera.position); G.skyo.clouds.position.set(PL.x, 0, PL.z);
  if (PL.dashCD !== G.lastCD) { G.lastCD = PL.dashCD; const b = $('dashBtn'); b.classList.toggle('cd', PL.dashCD > 0); }
  renderer.render(scene, camera);
  G.drawnPaused = G.paused;
  if ((mapT += dt) > 0.2) { mapT = 0; drawMinimap(); WORLD.cull(PL.x, PL.z); }
  if ((saveT += dt) > 5) { saveT = 0; SV.px = PL.x; SV.pz = PL.z; save(); }
  // 自动画质：太卡就降低分辨率和阴影
  if (dt > 0.034) { slowT += dt; fastT = 0; } else { fastT += dt; slowT = Math.max(0, slowT - dt * 0.5); }
  if (slowT > 2) { slowT = 0; if (PR > 1) { PR = 1; renderer.setPixelRatio(PR); } else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); } else if (PR > 0.7) { PR = 0.7; renderer.setPixelRatio(PR); } }
}
window.__G = {get HOME() { return HOME; }, startFly, endFly, goHome, SEASON, get FLAKES() { return FLAKES; }, get LIFE() { return LIFE; }, get ENV() { return ENV; }, callOut, discover, showBook, G, PL, SV, FOOD, NEED, STAGES, evolveTo, H, renderer, scene, CAM, keys, get WORLD() { return WORLD; }, get Q() { return Q; }, biomeAt, spawnPrey, newQuest, camera};
const unpause = () => { G.drawnPaused = false; };
new MutationObserver(unpause).observe($('overlay'), {attributes: true});
init().catch(e => { $('loadTxt').textContent = '加载出错了：' + e.message; console.error(e); });
