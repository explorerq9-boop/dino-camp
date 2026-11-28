// 四季：春天开花、夏天、秋天树叶变黄变红、冬天下雪
// 所有材质共用同一组 uniform，季节切换时慢慢过渡
import * as THREE from 'three';

export const SEASONS = [
  {id: 'spring', name: '春天', icon: '🌸', tip: '春天到了，到处开满了花！', fact: '开花植物是在白垩纪才出现的，有些恐龙见过地球上最早的花。'},
  {id: 'summer', name: '夏天', icon: '☀️', tip: '夏天到了，树叶绿油油的。', fact: '恐龙时代大部分时候比现在暖和，连南极附近都长着森林。'},
  {id: 'autumn', name: '秋天', icon: '🍂', tip: '秋天到了，树叶变黄变红，慢慢飘下来。', fact: '银杏这样会落叶的树，在恐龙时代就已经有了。'},
  {id: 'winter', name: '冬天', icon: '❄️', tip: '冬天到了，下雪啦！', fact: '在美国阿拉斯加发现过恐龙化石，那里的恐龙也会过下雪的冬天。'},
];
// x=春 y=秋 z=雪
export const SEASON = {value: new THREE.Vector3(0, 0, 0)};

// 植物：秋天绿叶变黄变红，冬天朝上的面盖上雪，春天更嫩绿
export const PLANT_GLSL = `
{ vec3 wn = normalize(cross(dFdx(vSWP), dFdy(vSWP))); wn.y = abs(wn.y);
  float green = smoothstep(0.02, 0.12, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
  float hv = fract(sin(dot(floor(vSWP.xz * 0.15), vec2(12.9898, 78.233))) * 43758.5453);
  vec3 au = mix(vec3(0.95, 0.62, 0.16), vec3(0.88, 0.30, 0.14), hv) * (0.55 + 0.6 * length(diffuseColor.rgb));
  diffuseColor.rgb = mix(diffuseColor.rgb, au, green * uSeason.y * 0.85);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.95, 1.12, 0.85), green * uSeason.x * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.97, 1.0), uSeason.z * smoothstep(0.25, 0.75, wn.y) * 0.85); }`;
// 地面：冬天积雪；秋天草地变金黄并有落叶；春天草地上点点小花
export const GROUND_GLSL = `
{ vec3 wn = normalize(cross(dFdx(vWP), dFdy(vWP))); wn.y = abs(wn.y); float above = step(-0.25, vWP.y);
  float grassy = smoothstep(0.0, 0.08, diffuseColor.g - diffuseColor.r);
  vec2 cell = floor(vWP.xz * 1.6); float r1 = hh(cell), r2 = hh(cell + 7.0); vec2 f = fract(vWP.xz * 1.6) - 0.5; float dotm = smoothstep(0.2, 0.1, length(f));
  vec3 fc = r2 < 0.33 ? vec3(1.0, 0.55, 0.75) : r2 < 0.66 ? vec3(1.0, 0.92, 0.35) : vec3(1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, fc, uSeason.x * grassy * dotm * step(0.88, r1) * above);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.25, 1.0, 0.55), uSeason.y * grassy * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, r2 < 0.5 ? vec3(0.9, 0.45, 0.15) : vec3(0.95, 0.7, 0.2), uSeason.y * grassy * dotm * step(0.75, r1) * above);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0) * (0.95 + 0.05 * r1), uSeason.z * smoothstep(0.55, 0.85, wn.y) * above * 0.92); }`;
// 恐龙：跟着季节换一点颜色（春天更鲜艳，秋天偏暖，冬天变浅、像换了冬毛）
export const DINO_GLSL = `
{ float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(l), diffuseColor.rgb, 1.25), uSeason.x * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 0.95, 0.78), uSeason.y * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.98), 0.2), uSeason.z); }`;

// 季节粒子：春天粉色花瓣、秋天落叶、冬天雪花
export function createFlakes(scene, PL, MOB, Hf) {
  const N = MOB ? 140 : 320, pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos.set([(Math.random() - 0.5) * 60, Math.random() * 22, (Math.random() - 0.5) * 60], i * 3); ph[i] = Math.random() * 6.28; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const U = {uT: {value: 0}, uCol: {value: new THREE.Color('#fff')}, uCol2: {value: new THREE.Color('#fff')}, uA: {value: 0}, uSize: {value: 1}, uKind: {value: 0}};
  const mat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: U,
    vertexShader: `attribute float ph; uniform float uT, uSize; varying float vPh; void main(){ vec3 p=position; p.x+=sin(uT*0.7+ph)*0.8; p.z+=cos(uT*0.5+ph*1.3)*0.8; vPh=ph;
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=min(26.0, uSize*140.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol, uCol2; uniform float uA, uKind, uT; varying float vPh; void main(){ vec2 c=gl_PointCoord-0.5; float a;
      if(uKind<0.5){ a=smoothstep(0.5,0.15,length(c)); }
      else { float an=vPh+uT*(0.6+fract(vPh)*0.8); vec2 r=vec2(cos(an)*c.x-sin(an)*c.y, sin(an)*c.x+cos(an)*c.y); a=smoothstep(0.5,0.4,length(r*vec2(1.0,2.2))); }
      if(a<0.05) discard; gl_FragColor=vec4(mix(uCol,uCol2,fract(vPh*3.7)), a*uA);
#include <colorspace_fragment>
    }`});
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; scene.add(pts);
  const SP = new Float32Array(N); for (let i = 0; i < N; i++) SP[i] = 0.6 + Math.random() * 0.8;
  return {
    U, pts,
    set(kind, amount) { // kind: 'petal' 'leaf' 'snow' 'none'
      pts.visible = amount > 0.02 && kind !== 'none'; U.uA.value = amount;
      if (kind === 'snow') { U.uKind.value = 0; U.uCol.value.set('#ffffff'); U.uCol2.value.set('#eef4ff'); U.uSize.value = 0.9; }
      if (kind === 'petal') { U.uKind.value = 1; U.uCol.value.set('#ffb3cf'); U.uCol2.value.set('#ffffff'); U.uSize.value = 1.1; }
      if (kind === 'leaf') { U.uKind.value = 1; U.uCol.value.set('#f2a033'); U.uCol2.value.set('#d8532b'); U.uSize.value = 1.4; }
      this.kind = kind;
    },
    update(dt, t, heavy) {
      if (!pts.visible) return; U.uT.value = t; const gy = Math.max(Hf(PL.x, PL.z), -0.35);
      const A = g.attributes.position.array, fall = this.kind === 'snow' ? 1.6 + heavy * 1.5 : this.kind === 'leaf' ? 1.2 : 0.7;
      for (let i = 0; i < N; i++) { const o = i * 3; A[o + 1] -= fall * SP[i] * dt; A[o] += (this.kind === 'snow' ? 0.2 : 0.6) * dt;
        let x = A[o] - PL.x, z = A[o + 2] - PL.z;
        if (A[o + 1] < gy - 2 || Math.abs(x) > 30 || Math.abs(z) > 30) { A[o] = PL.x + (Math.random() - 0.5) * 60; A[o + 2] = PL.z + (Math.random() - 0.5) * 60; A[o + 1] = gy + 8 + Math.random() * 14; } }
      g.attributes.position.needsUpdate = true;
    },
  };
}
