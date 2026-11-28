// 恐龙模型：加载、上色、鳞片质感、动画
import * as THREE from 'three';
import {AnimationUtils} from 'three';
import {SEASON, DINO_GLSL} from './season.js';
import {clone as skClone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 每种恐龙：名字、真实资料、配色（按模型材质名）、体长（游戏单位≈米的缩小版）
export const SPECIES = {
  raptor: {file:'Velociraptor', name:'迅猛龙', diet:'meat', dietTxt:'吃小动物和虫子', period:'白垩纪晚期', len:'约 2 米',
    colors:{LightBrown:'#d8c6a4', Brown:'#8b6040', Black:'#1e1510'}, pattern:'stripe', patCol:'#3e2818', size:2.6, speed:7.5,
    facts:['迅猛龙只有火鸡那么大，身上其实长着羽毛。','迅猛龙生活在今天的蒙古，后脚上有一个特别弯的大爪子。','迅猛龙跑得很快，脑子在恐龙里算比较大的。']},
  para: {file:'Parasaurolophus', name:'副栉龙', diet:'plant', dietTxt:'吃树叶和果子', period:'白垩纪晚期', len:'约 9 米',
    colors:{LightYellow:'#d6cba6', Green:'#6b7650', LightGreen:'#8f9268', Red:'#9c5636'}, pattern:'spot', patCol:'#3b4129', size:3.6, speed:6.8,
    facts:['副栉龙头上有一根长长的空心头冠，可以像号角一样发出低沉的声音。','副栉龙可以用两条腿走，也可以四条腿走。','副栉龙是鸭嘴龙的一种，嘴巴扁扁的，有几百颗磨牙。']},
  steg: {file:'Stegosaurus', name:'剑龙', diet:'plant', dietTxt:'吃低矮的植物', period:'侏罗纪晚期', len:'约 9 米',
    colors:{LightBrown:'#d2c49e', DarkBrown:'#757049', Brown:'#9b6038'}, pattern:'spot', patCol:'#3e3b26', size:4.6, speed:5.6,
    facts:['剑龙背上有两排骨板，尾巴上有四根尖刺。','剑龙身体有公交车那么长，脑子却只有核桃大小。','剑龙生活在侏罗纪晚期，比霸王龙早了大约 8000 万年。']},
  tri: {file:'Triceratops', name:'三角龙', diet:'plant', dietTxt:'吃低矮的植物', period:'白垩纪晚期', len:'约 9 米',
    colors:{LightBrown:'#d8c9a6', Purple:'#80705a', Brown:'#5f4934'}, pattern:'stripe', patCol:'#463626', size:4.8, speed:5.6,
    facts:['三角龙有三只角和一个大大的颈盾。','三角龙的头骨是陆地动物里最大的之一，有 2 米多长。','三角龙和霸王龙生活在同一个时代。']},
  trex: {file:'Trex', name:'霸王龙', diet:'meat', dietTxt:'吃大型动物', period:'白垩纪晚期', len:'约 12 米',
    colors:{LightYellow:'#d4c4a2', LightGreen:'#86704f', Green:'#564634', Black:'#1a1410', Red:'#a8484c'}, pattern:'stripe', patCol:'#3a2c1e', size:6.6, speed:6.4,
    facts:['霸王龙的咬合力是陆地动物里最强的之一。','霸王龙的小前肢只有两根手指，但很有力气。','霸王龙的嗅觉特别好，能闻到很远的气味。']},
  apato: {file:'Apatosaurus', name:'迷惑龙', diet:'plant', dietTxt:'吃高处的树叶', period:'侏罗纪晚期', len:'约 22 米',
    colors:{Material:'#cdc09e', Brown:'#727565'}, pattern:'spot', patCol:'#4a4d40', size:9.5, speed:5.2,
    facts:['迷惑龙以前也被叫做“雷龙”。','迷惑龙的脖子和尾巴都特别长，身体有好几头大象那么重。','迷惑龙的尾巴尖细细的，可能能像鞭子一样甩出声音。']},
};

export const scaleShader = (mat, freq, patCol, pattern, nat = null) => {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSeason = SEASON; sh.uniforms.uFreq = {value:freq}; sh.uniforms.uPat = {value:new THREE.Color(patCol)}; sh.uniforms.uMode = {value:pattern==='stripe'?1:0}; sh.uniforms.uNat = {value:new THREE.Color(nat || '#ffffff')}; sh.uniforms.uDes = {value: nat ? 0.78 : 0};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = objectNormal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vOP; varying vec3 vON; uniform float uFreq; uniform vec3 uPat; uniform float uMode; uniform vec3 uSeason; uniform vec3 uNat; uniform float uDes;
vec3 h3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}
vec2 cell(vec3 p){vec3 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(x,y,z);vec3 o=h3(i+g);float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return vec2(d1,d2);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h3(i).x,b=h3(i+vec3(1,0,0)).x,c=h3(i+vec3(0,1,0)).x,d=h3(i+vec3(1,1,0)).x,e=h3(i+vec3(0,0,1)).x,f2=h3(i+vec3(1,0,1)).x,g=h3(i+vec3(0,1,1)).x,h=h3(i+vec3(1,1,1)).x;return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,f2,f.x),mix(g,h,f.x),f.y),f.z);}
`).replace('#include <color_fragment>', `#include <color_fragment>
{ float lu=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11)); float mx=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)), mn=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
  float wh = uDes * smoothstep(0.7,0.85,lu) * (1.0-smoothstep(0.06,0.16,mx-mn)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42,0.36,0.22), wh*0.8); lu = mix(lu, 0.35, wh);
  diffuseColor.rgb=mix(diffuseColor.rgb, uNat*(0.35+lu*0.95), uDes);
  vec3 q=vOP*uFreq; vec2 c=cell(q); float edge=smoothstep(0.0,0.16,c.y-c.x);
  float big = uMode>0.5 ? smoothstep(0.55,0.7, sin(vOP.z*uFreq*0.18 + vn(vOP*uFreq*0.08)*3.0)*0.5+0.5) : smoothstep(0.62,0.72, vn(vOP*uFreq*0.22));
  float top = smoothstep(-0.35,0.65,normalize(vON).y);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPat, big*0.55*top*step(0.25,length(diffuseColor.rgb-uPat)));
  diffuseColor.rgb *= mix(0.74,1.05,edge) * (0.93+0.14*h3(floor(q)).x) * (0.9+0.2*vn(vOP*uFreq*0.5));
  diffuseColor.rgb *= mix(1.1, 0.8, top); }
${DINO_GLSL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.,0.,1.)),0.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb*rim*0.12; }`);
  };
  mat.customProgramCacheKey = () => 'dino'+pattern+(nat?'n':'');
};

export const DINO = {}; // id -> {gltf, base, clips, len}
export function prepDino(id, gltf) {
  const sp = SPECIES[id], root = gltf.scene;
  root.updateMatrixWorld(true);
  const b = new THREE.Box3(); root.traverse(m=>{ if(m.isBone) b.expandByPoint(m.getWorldPosition(new THREE.Vector3())); });
  const size = b.getSize(new THREE.Vector3());
  root.traverse(m => {
    if (!m.isMesh) return;
    let g = m.geometry; g.deleteAttribute('normal'); if (g.attributes.uv) g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4); g.computeVertexNormals(); m.geometry = g;
    g.computeBoundingBox(); const gs = g.boundingBox.getSize(new THREE.Vector3()); const glen = Math.max(gs.x, gs.y, gs.z);
    const old = m.material, nm = new THREE.MeshStandardMaterial({color: sp.colors[old.name] || '#a07850', roughness: 0.62, metalness: 0.0});
    const dark = /Black/.test(old.name), mouth = old.name === 'Red' && id === 'trex';
    if (!dark && !mouth) scaleShader(nm, 38 / glen, sp.patCol, sp.pattern); else nm.roughness = 0.35;
    nm.name = old.name; m.material = nm; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
  });
  const clips = {};
  for (const a of gltf.animations) { const n = a.name.split('_').pop(); clips[n] = a; }
  DINO[id] = {root, clips, rawLen: size.z, rawMinY: b.min.y, rawCz: (b.min.z + b.max.z) / 2};
}

// 生成一只恐龙实例；scale 让身长 = len 单位
import {makePtero} from './ptero.js';
export function makeDino(id, len, tint = 0) {
  if (id === 'ptero') return makePtero(len, tint);
  const d = DINO[id], obj = skClone(d.root), k = len / d.rawLen;
  if (tint) { const cache = new Map(); obj.traverse(m => { if (!m.isMesh) return; let n = cache.get(m.material); if (!n) { n = m.material.clone(); n.onBeforeCompile = m.material.onBeforeCompile; n.customProgramCacheKey = m.material.customProgramCacheKey; if (!d.gob && !/Black/.test(n.name)) n.color.offsetHSL(tint * 0.06, tint * 0.08, tint * 0.03); else if (d.gob) n.color.offsetHSL(tint * 0.05, 0, 0); n.userData.own = true; cache.set(m.material, n); } m.material = n; }); }
  const holder = new THREE.Group(); obj.scale.multiplyScalar(k); obj.position.set(0, -d.rawMinY * k, -d.rawCz * k);
  holder.add(obj);
  const mixer = new THREE.AnimationMixer(obj), acts = {};
  for (const n of ['Idle', 'Walk', 'Run', 'Attack', 'Jump']) if (d.clips[n]) { acts[n] = mixer.clipAction(d.clips[n]); }
  if (d.gob) { obj.rotation.y = 0; const baby = !!GOB[id].baby;
    // 卡通模型的大眼睛和大头缩小，比例更接近真实的恐龙
    obj.traverse(o => { if (!o.isBone) return; if (/Eye$/.test(o.name)) o.scale.setScalar(0.42); if (o.name === 'Head') o.scale.setScalar(baby ? 0.9 : 0.8); }); }
  acts.Idle.play();
  return {holder, obj, mixer, acts, cur: 'Idle', id, len};
}
export function setAnim(D, name, fade = 0.25) {
  if (D.cur === name || !D.acts[name]) return;
  const a = D.acts[name], o = D.acts[D.cur];
  a.reset().setEffectiveWeight(1).play(); if (o) a.crossFadeFrom(o, fade, false);
  D.cur = name;
}
export function playOnce(D, name, then = 'Idle') {
  const a = D.acts[name]; if (!a) return;
  const o = D.acts[D.cur]; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.play(); if (o && o !== a) a.crossFadeFrom(o, 0.15, false);
  D.cur = name; D.onceUntil = performance.now() + a.getClip().duration * 1000 / (a.timeScale || 1) - 120; D.after = then;
}

// 测量每种恐龙的步幅：动画在原地播放，算出脚踩地时向后移动的速度，
// 这样就能让动画速度和真实移动速度一致，脚不会“打滑”
export function measureGait(id) {
  const D = makeDino(id, 1), out = {};
  const feet = []; D.obj.traverse(o => { if (o.isBone && (DINO[id].feet || /^BackFoot[RL]$/).test(o.name)) feet.push(o); });
  for (const name of ['Walk', 'Run']) {
    const a = D.acts[name]; if (!a) continue;
    D.mixer.stopAllAction(); a.reset().play(); const dur = a.getClip().duration, N = 90, samples = [];
    for (let i = 0; i <= N; i++) { D.mixer.setTime(dur * i / N); D.holder.updateMatrixWorld(true);
      samples.push(feet.map(f => { const p = f.getWorldPosition(new THREE.Vector3()); return [p.y, p.z]; })); }
    const vs = [];
    feet.forEach((_, fi) => { const ys = samples.map(s => s[fi][0]), minY = Math.min(...ys), maxY = Math.max(...ys);
      for (let i = 0; i < N; i++) { const y = samples[i][fi][0]; if (y < minY + (maxY - minY) * 0.15) { const dz = samples[i + 1][fi][1] - samples[i][fi][1]; vs.push(-dz / (dur / N)); } } });
    vs.sort((a, b) => a - b); out[name] = Math.max(0.05, vs[Math.floor(vs.length / 2)] || 0.3);
  }
  D.mixer.stopAllAction();
  DINO[id].gait = out; return out;
}

// 走/跑/站 三种动画按速度混合，每种动画的播放速度跟真实速度对齐（不打滑）
export function locomote(D, v, dt) {
  const g = DINO[D.id].gait, len = D.len, A = D.acts;
  if (!D.loco) { D.mixer.stopAllAction(); for (const n of ['Idle', 'Walk', 'Run']) { A[n].reset().play(); A[n].setEffectiveWeight(0); A[n].setLoop(THREE.LoopRepeat, Infinity); } D.loco = {w: {Idle: 1, Walk: 0, Run: 0}, att: 0}; D.cur = 'loco'; }
  const av = Math.abs(v), walkV = g.Walk * len, runV = g.Run * len;
  const tw = {Idle: 0, Walk: 0, Run: 0};
  if (av < walkV * 0.25) tw.Idle = 1;
  else { const r = Math.max(0, Math.min(1, (av - walkV * 1.4) / (runV * 0.7 - walkV * 1.4))); tw.Walk = 1 - r; tw.Run = r; const idle = Math.max(0, 1 - av / (walkV * 0.6)); tw.Idle = idle; tw.Walk *= 1 - idle; tw.Run *= 1 - idle; }
  const k = Math.min(1, dt * 8), L = D.loco;
  const att = D.acts.Attack;
  if (L.att > 0) L.att = Math.max(0, L.att - dt);
  // 张嘴动作只轻轻混进去一半，慢慢进慢慢出，不会猛甩头
  const aw = L.att > 0 ? 0.5 * Math.min(1, L.att * 3, (L.attDur - L.att) * 3 + 0.1) : 0;
  for (const n of ['Idle', 'Walk', 'Run']) { L.w[n] += (tw[n] - L.w[n]) * k; A[n].setEffectiveWeight(L.w[n] * (1 - aw)); }
  const sgn = v < 0 ? -1 : 1;
  A.Walk.timeScale = sgn * Math.max(0.35, Math.min(2.2, av / walkV));
  A.Run.timeScale = sgn * Math.max(0.5, Math.min(1.8, av / runV));
  if (att) att.setEffectiveWeight(aw);
  return L.w;
}
export function bite(D) {
  const a = D.acts.Attack; if (!a || !D.loco) return; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play();
  D.loco.attDur = 1.3; D.loco.att = D.loco.attDur; a.timeScale = a.getClip().duration / D.loco.attDur;
}

// 扭头：把脖子和头绕竖直方向转一个角度（看食物、看玩家）
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const _rt = new THREE.Vector3();
export function headTurn(D, angle, pitch = 0) {
  if (D.neck === undefined) { D.neck = null; D.head = null; D.obj.traverse(o => { if (o.isBone && o.name === 'Neck') D.neck = o; if (o.isBone && o.name === 'Head') D.head = o; }); }
  if (!D.neck && !D.head) return;
  D.holder.updateMatrixWorld(true);
  for (const [b, share] of D.neck ? [[D.neck, 0.45], [D.head, 0.55]] : [[D.head, 0.8]]) {
    if (!b) continue; b.parent.getWorldQuaternion(_pq);
    _q.setFromAxisAngle(_up, angle * share);
    if (pitch) { _rt.set(1, 0, 0).applyQuaternion(D.holder.quaternion); _pq.setFromAxisAngle(_rt, pitch * share); _q.premultiply(_pq); b.parent.getWorldQuaternion(_pq); }
    const loc = _pq.clone().invert().multiply(_q).multiply(_pq); b.quaternion.premultiply(loc);
    b.updateMatrixWorld(true);
  }
}

/* ---------- 第二套恐龙（Gobkit Free Dinosaur Pack，CC0）：圆滚滚的卡通造型 ---------- */
// 一个模型只有一条动画轨道：0-29 帧待机，30-59 张嘴，60-89 倒下（不用），90-119 走路（24 帧/秒）
export const GOB = {
  anky: {file: 'Ankylosaurus', name: '甲龙', diet: 'plant', period: '白垩纪晚期', len: '约 7 米', where: 'land',
    facts: ['甲龙全身披着骨板，像一辆小坦克。', '甲龙尾巴末端有一个骨头做的“尾锤”，用来保护自己。', '甲龙的腿很短，走得慢慢的，吃低矮的植物。']},
  pachy: {file: 'Pachycephalosaurus', name: '肿头龙', diet: 'plant', period: '白垩纪晚期', len: '约 4.5 米', where: 'land',
    facts: ['肿头龙头顶有一块圆圆的厚骨头，有 20 多厘米厚。', '肿头龙的名字意思是“厚头的蜥蜴”。', '肿头龙头顶周围还有一圈小小的骨刺。']},
  ovi: {file: 'Oviraptor', name: '窃蛋龙', diet: 'all', period: '白垩纪晚期', len: '约 2 米', where: 'land',
    facts: ['窃蛋龙的化石被发现趴在一窝蛋上，后来才知道那是它自己的蛋，它在孵蛋，不是偷蛋。', '窃蛋龙没有牙齿，只有一张像鹦鹉一样的硬嘴。', '窃蛋龙身上长着羽毛，生活在今天的蒙古。']},
  spino: {file: 'Spinosaurus', name: '棘龙', diet: 'fish', period: '白垩纪中期', len: '约 14 米', where: 'river',
    facts: ['棘龙背上有一面像帆一样的大骨板。', '棘龙特别爱吃鱼，大部分时间待在河边和水里。', '棘龙比霸王龙还要长，是已知最长的肉食恐龙之一。']},
  ptero: {file: '', name: '翼龙', diet: 'fish', period: '侏罗纪到白垩纪', len: '翅膀展开约 1～7 米', where: 'sky', notDino: true,
    facts: ['翼龙不是恐龙，是和恐龙同时代、会飞的爬行动物。', '翼龙的翅膀是一层皮膜，用特别长的第四根手指撑开。', '翼龙是第一种会飞的脊椎动物，比鸟类还早。']},
  plesio: {file: 'Plesiosaurus', name: '蛇颈龙', diet: 'fish', period: '侏罗纪早期', len: '约 3.5 米', where: 'water', notDino: true,
    facts: ['蛇颈龙不是恐龙，是生活在海里的爬行动物。', '蛇颈龙用四只像船桨一样的鳍游泳。', '蛇颈龙的脖子很长，要浮到水面上呼吸空气。']},
  gtri: {file: 'Triceratops', baby: true}, gsteg: {file: 'Stegosaurus', baby: true}, gtrex: {file: 'Trex', baby: true},
};
// Gobkit 的卡通大眼睛：所有模型的眼白和眼珠都用贴图上同样的两个色块，
// 找到这些顶点，左右各自向中心收缩，眼睛变小，更像真的爬行动物
function shrinkEyes(m) {
  const P = m.geometry.attributes.position, UV = m.geometry.attributes.uv; if (!UV) return;
  const isEye = i => { const u = Math.floor(UV.getX(i) * 16), w = Math.floor(UV.getY(i) * 16); return (u === 10 && w === 11) || (u === 12 && w === 12); };
  for (const side of [-1, 1]) {
    const ids = []; const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) if (isEye(i) && Math.sign(P.getX(i)) === side) { ids.push(i); c.add(v.fromBufferAttribute(P, i)); }
    if (ids.length < 6) continue; c.divideScalar(ids.length);
    for (const i of ids) { v.fromBufferAttribute(P, i).sub(c).multiplyScalar(0.45).add(c); P.setXYZ(i, v.x, v.y, v.z); }
  }
  P.needsUpdate = true;
}
export function prepGob(id, gltf) {
  const root = gltf.scene; root.updateMatrixWorld(true);
  const b = new THREE.Box3(); root.traverse(m => { if (m.isBone) b.expandByPoint(m.getWorldPosition(new THREE.Vector3())); });
  root.traverse(m => {
    if (!m.isMesh) return;
    const old = m.material, nm = new THREE.MeshStandardMaterial({map: old.map, roughness: 0.7, metalness: 0});
    if (m.isSkinnedMesh) shrinkEyes(m);
    m.geometry.computeBoundingBox(); const gs = m.geometry.boundingBox.getSize(new THREE.Vector3()), glen = Math.max(gs.x, gs.y, gs.z);
    const NAT = {anky: ['#a08a68', '#43382a'], pachy: ['#a89276', '#4f3e2c'], ovi: ['#9a8670', '#3a2e22'], spino: ['#8f8c72', '#3c3a2c'], plesio: ['#7f8f94', '#2c383c'], gtri: ['#a09078', '#463626'], gsteg: ['#8f8a66', '#3e3b26'], gtrex: ['#9a8464', '#3a2c1e']}[id] || ['#9a8a70', '#3e3428'];
    scaleShader(nm, 38 / glen, NAT[1], 'spot', NAT[0]);
    m.material = nm; m.castShadow = true; m.frustumCulled = false;
  });
  // 包围盒用蒙皮后的真实顶点算（骨架被缩放过，直接用骨头位置不准）
  const mix0 = new THREE.AnimationMixer(root); mix0.clipAction(gltf.animations[0]).play(); mix0.setTime(0.2); root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root, true); mix0.stopAllAction(); mix0.uncacheRoot(root);
  const full = gltf.animations[0], F = 24;
  const sub = (n, a, z) => { const c = AnimationUtils.subclip(full, n, a, z, F); return c; };
  const clips = {Idle: sub('Idle', 0, 29), Attack: sub('Attack', 30, 59), Walk: sub('Walk', 90, 119)};
  clips.Run = clips.Walk.clone(); clips.Run.name = 'Run';
  const sz = bb.getSize(new THREE.Vector3());
  DINO[id] = {root, clips, rawLen: Math.max(sz.z, sz.x * 0.8), rawMinY: bb.min.y, rawCz: (bb.min.z + bb.max.z) / 2, feet: /^(Left|Right)LegB$/, gob: true};
}
