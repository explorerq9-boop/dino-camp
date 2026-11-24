// 恐龙模型：加载、上色、鳞片质感、动画
import * as THREE from 'three';
import {clone as skClone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 每种恐龙：名字、真实资料、配色（按模型材质名）、体长（游戏单位≈米的缩小版）
export const SPECIES = {
  raptor: {file:'Velociraptor', name:'迅猛龙', diet:'meat', dietTxt:'吃小动物和虫子', period:'白垩纪晚期', len:'约 2 米',
    colors:{LightBrown:'#f0d2a0', Brown:'#d0702f', Black:'#2b1d16'}, pattern:'stripe', patCol:'#7a3418', size:2.6, speed:7.5,
    facts:['迅猛龙只有火鸡那么大，身上其实长着羽毛。','迅猛龙生活在今天的蒙古，后脚上有一个特别弯的大爪子。','迅猛龙跑得很快，脑子在恐龙里算比较大的。']},
  para: {file:'Parasaurolophus', name:'副栉龙', diet:'plant', dietTxt:'吃树叶和果子', period:'白垩纪晚期', len:'约 9 米',
    colors:{LightYellow:'#f6e7b0', Green:'#3f9d63', LightGreen:'#9ad46e', Red:'#ef6b3a'}, pattern:'spot', patCol:'#1f6b47', size:3.6, speed:6.8,
    facts:['副栉龙头上有一根长长的空心头冠，可以像号角一样发出低沉的声音。','副栉龙可以用两条腿走，也可以四条腿走。','副栉龙是鸭嘴龙的一种，嘴巴扁扁的，有几百颗磨牙。']},
  steg: {file:'Stegosaurus', name:'剑龙', diet:'plant', dietTxt:'吃低矮的植物', period:'侏罗纪晚期', len:'约 9 米',
    colors:{LightBrown:'#f2d58e', DarkBrown:'#86a83e', Brown:'#e8673a'}, pattern:'spot', patCol:'#4d6b22', size:4.6, speed:5.6,
    facts:['剑龙背上有两排骨板，尾巴上有四根尖刺。','剑龙身体有公交车那么长，脑子却只有核桃大小。','剑龙生活在侏罗纪晚期，比霸王龙早了大约 8000 万年。']},
  tri: {file:'Triceratops', name:'三角龙', diet:'plant', dietTxt:'吃低矮的植物', period:'白垩纪晚期', len:'约 9 米',
    colors:{LightBrown:'#f3dcae', Purple:'#3f86c9', Brown:'#9a6a3c'}, pattern:'stripe', patCol:'#5c3a1e', size:4.8, speed:5.6,
    facts:['三角龙有三只角和一个大大的颈盾。','三角龙的头骨是陆地动物里最大的之一，有 2 米多长。','三角龙和霸王龙生活在同一个时代。']},
  trex: {file:'Trex', name:'霸王龙', diet:'meat', dietTxt:'吃大型动物', period:'白垩纪晚期', len:'约 12 米',
    colors:{LightYellow:'#f2dcae', LightGreen:'#c98a4a', Green:'#7a5634', Black:'#1e1612', Red:'#d4565c'}, pattern:'stripe', patCol:'#d0561f', size:6.6, speed:6.4,
    facts:['霸王龙的咬合力是陆地动物里最强的之一。','霸王龙的小前肢只有两根手指，但很有力气。','霸王龙的嗅觉特别好，能闻到很远的气味。']},
  apato: {file:'Apatosaurus', name:'迷惑龙', diet:'plant', dietTxt:'吃高处的树叶', period:'侏罗纪晚期', len:'约 22 米',
    colors:{Material:'#e7d39a', Brown:'#6aa07a'}, pattern:'spot', patCol:'#3f6e53', size:9.5, speed:5.2,
    facts:['迷惑龙以前也被叫做“雷龙”。','迷惑龙的脖子和尾巴都特别长，身体有好几头大象那么重。','迷惑龙的尾巴尖细细的，可能能像鞭子一样甩出声音。']},
};

const scaleShader = (mat, freq, patCol, pattern) => {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFreq = {value:freq}; sh.uniforms.uPat = {value:new THREE.Color(patCol)}; sh.uniforms.uMode = {value:pattern==='stripe'?1:0};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vOP; uniform float uFreq; uniform vec3 uPat; uniform float uMode;
vec3 h3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}
vec2 cell(vec3 p){vec3 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(x,y,z);vec3 o=h3(i+g);float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return vec2(d1,d2);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h3(i).x,b=h3(i+vec3(1,0,0)).x,c=h3(i+vec3(0,1,0)).x,d=h3(i+vec3(1,1,0)).x,e=h3(i+vec3(0,0,1)).x,f2=h3(i+vec3(1,0,1)).x,g=h3(i+vec3(0,1,1)).x,h=h3(i+vec3(1,1,1)).x;return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,f2,f.x),mix(g,h,f.x),f.y),f.z);}
`).replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 q=vOP*uFreq; vec2 c=cell(q); float edge=smoothstep(0.0,0.16,c.y-c.x);
  float big = uMode>0.5 ? smoothstep(0.55,0.7, sin(vOP.z*uFreq*0.18 + vn(vOP*uFreq*0.08)*3.0)*0.5+0.5) : smoothstep(0.62,0.72, vn(vOP*uFreq*0.22));
  float top = smoothstep(-0.1,0.5,normalize(vOP).y);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPat, big*0.55*top*step(0.25,length(diffuseColor.rgb-uPat)));
  diffuseColor.rgb *= mix(0.72,1.06,edge) * (0.94+0.12*h3(floor(q)).x); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.,0.,1.)),0.0), 2.5); totalEmissiveRadiance += diffuseColor.rgb*rim*0.35; }`);
  };
  mat.customProgramCacheKey = () => 'dino'+pattern;
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
export function makeDino(id, len) {
  const d = DINO[id], obj = skClone(d.root), k = len / d.rawLen;
  const holder = new THREE.Group(); obj.scale.multiplyScalar(k); obj.position.set(0, -d.rawMinY * k, -d.rawCz * k);
  holder.add(obj);
  const mixer = new THREE.AnimationMixer(obj), acts = {};
  for (const n of ['Idle', 'Walk', 'Run', 'Attack', 'Jump']) if (d.clips[n]) { acts[n] = mixer.clipAction(d.clips[n]); }
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
