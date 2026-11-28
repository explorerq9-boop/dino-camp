// 天空和天气：白天黑夜慢慢变化、偶尔下小雨、雨后彩虹、夜里的星星和萤火虫
// 所有变化都很慢，不闪烁；夜里也保持足够亮
import * as THREE from 'three';
import {H, WATER_Y} from './world.js';

const C = s => new THREE.Color(s);
// 一天的关键时刻（0~1 循环）
const KEYS = [
  {t: 0.00, top: '#5d84c9', hor: '#ffd3ae', fog: '#e9d6c6', sun: '#ffd2a0', si: 1.6, hs: '#e6e2ff', hg: '#b89a7a', hi: 1.15, ex: 1.0},   // 清晨
  {t: 0.10, top: '#2985ea', hor: '#b8e6ff', fog: '#c4e6f8', sun: '#fff1d6', si: 2.5, hs: '#dff1ff', hg: '#c8a874', hi: 1.35, ex: 1.0},   // 白天
  {t: 0.55, top: '#2985ea', hor: '#b8e6ff', fog: '#c4e6f8', sun: '#fff1d6', si: 2.5, hs: '#dff1ff', hg: '#c8a874', hi: 1.35, ex: 1.0},
  {t: 0.66, top: '#4a6cb5', hor: '#ffb07a', fog: '#f0c6a4', sun: '#ffaa66', si: 1.8, hs: '#ffe0c8', hg: '#b8876a', hi: 1.1, ex: 1.0},    // 日落
  {t: 0.74, top: '#1b2c66', hor: '#6a6fb0', fog: '#5b6aa6', sun: '#c8d2ff', si: 0.8, hs: '#a9b8f0', hg: '#5b5f7e', hi: 0.95, ex: 1.05},  // 傍晚
  {t: 0.80, top: '#0f1d48', hor: '#3c5890', fog: '#3f5a8c', sun: '#c2d0ff', si: 0.75, hs: '#9fb4ee', hg: '#4c5674', hi: 0.9, ex: 1.1},   // 夜里（月光）
  {t: 0.93, top: '#0f1d48', hor: '#3c5890', fog: '#3f5a8c', sun: '#c2d0ff', si: 0.75, hs: '#9fb4ee', hg: '#4c5674', hi: 0.9, ex: 1.1},
  {t: 1.00, top: '#5d84c9', hor: '#ffd3ae', fog: '#e9d6c6', sun: '#ffd2a0', si: 1.6, hs: '#e6e2ff', hg: '#b89a7a', hi: 1.15, ex: 1.0},
].map(k => Object.assign({}, k, {top: C(k.top), hor: C(k.hor), fog: C(k.fog), sun: C(k.sun), hs: C(k.hs), hg: C(k.hg)}));
const DAY_LEN = 9 * 60; // 一整天 9 分钟

export function createEnv(E) {
  // E: {scene, renderer, hemi, sun, SUN_DIR, sky, clouds, PL, G, SV, MOB, tip, ripple}
  const {scene, PL, MOB} = E;
  const V = {t: E.SV.tod ?? 0.12, rain: 0, rainOn: false, rainT: 140 + Math.random() * 120, bow: 0, night: 0};

  // 天空：换成能变色的版本
  const U = {uTop: {value: C('#2985ea')}, uHor: {value: C('#b8e6ff')}, uSun: {value: new THREE.Vector3(0.45, 0.55, -0.7)}, uSunCol: {value: C('#fff1d6')}, uNight: {value: 0}, uGrey: {value: 0}};
  E.sky.material = new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `varying vec3 vP; uniform vec3 uTop, uHor, uSun, uSunCol; uniform float uNight, uGrey;
      float hs(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
      void main(){ float y=max(vP.y,0.0); vec3 c=mix(uHor, uTop, pow(y,0.55));
        vec3 sd=normalize(uSun); float s=max(dot(vP,sd),0.0); c+=uSunCol*(pow(s,350.0)*1.6+pow(s,10.0)*0.22)*(1.0-uGrey*0.8);
        // 月亮（夜里在天空另一边）
        vec3 md=normalize(vec3(-sd.x, max(0.35, -sd.y), -sd.z)); float m=max(dot(vP,md),0.0); c+=vec3(0.95,0.95,1.0)*smoothstep(0.9993,0.9996,m)*uNight + vec3(0.5,0.6,0.9)*pow(m,40.0)*0.25*uNight;
        // 星星：固定的小点，不闪
        vec3 q=floor(vP*180.0); float st=step(0.9965,hs(q)); c+=vec3(0.9,0.92,1.0)*st*uNight*smoothstep(0.05,0.3,vP.y)*(0.5+0.5*hs(q+1.0));
        c=mix(c, vec3(0.62,0.66,0.72)*(1.0-uNight*0.55), uGrey*0.75);
        if(vP.y<0.0) c=mix(uHor, vec3(0.62,0.66,0.72)*(1.0-uNight*0.55), uGrey*0.75);
        gl_FragColor=vec4(c,1.0);
#include <colorspace_fragment>
      }`});

  // 雨：很多细细的雨丝，一次画完
  const RN = MOB ? 350 : 900, rPos = new Float32Array(RN * 6), rSpd = new Float32Array(RN);
  for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 70, y = Math.random() * 30, z = (Math.random() - 0.5) * 70; rPos.set([x, y, z, x + 0.1, y - 1.3, z], i * 6); rSpd[i] = 22 + Math.random() * 8; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({color: '#dbe8f5', transparent: true, opacity: 0, depthWrite: false}));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  // 彩虹：半个圆环，七种颜色柔和过渡
  const bowMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, uniforms: {uA: {value: 0}},
    vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `varying vec2 vU; uniform float uA; void main(){ float r=vU.y; vec3 c = r<0.0?vec3(0): mix(mix(vec3(0.58,0.35,0.9),vec3(0.25,0.45,1.0),smoothstep(0.0,0.2,r)), mix(vec3(0.3,0.85,0.4),mix(vec3(1.0,0.9,0.3),vec3(1.0,0.35,0.3),smoothstep(0.65,0.95,r)),smoothstep(0.45,0.7,r)), smoothstep(0.2,0.45,r));
      float a = smoothstep(0.0,0.12,r)*smoothstep(1.0,0.85,r)*uA*0.55; gl_FragColor=vec4(c,a);
#include <colorspace_fragment>
    }`});
  const bowGeo = new THREE.RingGeometry(260, 300, 64, 1, 0, Math.PI);
  { const uv = bowGeo.attributes.uv, pos = bowGeo.attributes.position; for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, 0, (r - 260) / 40); } }
  const bow = new THREE.Mesh(bowGeo, bowMat); bow.visible = false; bow.renderOrder = 0; scene.add(bow);

  // 夜里的萤火虫：慢慢亮、慢慢暗（不闪）
  const FN = MOB ? 40 : 90, fPos = new Float32Array(FN * 3), fPh = new Float32Array(FN);
  for (let i = 0; i < FN; i++) { fPos.set([(Math.random() - 0.5) * 50, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 50], i * 3); fPh[i] = Math.random() * 6.28; }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fg.setAttribute('ph', new THREE.BufferAttribute(fPh, 1));
  const fMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uT: {value: 0}, uA: {value: 0}},
    vertexShader: 'attribute float ph; uniform float uT; varying float vA; void main(){ vec3 p=position; p.x+=sin(uT*0.4+ph)*1.2; p.y+=sin(uT*0.6+ph*2.0)*0.4; p.z+=cos(uT*0.35+ph)*1.2; vA=0.55+0.45*sin(uT*0.9+ph); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=min(14.0, 90.0/-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uA; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vec3(0.85,1.0,0.45)*a, a*vA*uA); }'});
  const flies = new THREE.Points(fg, fMat); flies.frustumCulled = false; flies.visible = false; scene.add(flies);

  const lerpK = (t) => { let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++; const a = KEYS[i], b = KEYS[i + 1], k = (t - a.t) / (b.t - a.t), s = k * k * (3 - 2 * k); return {a, b, s}; };
  const _c = new THREE.Color(), _grey = C('#9aa3ad'), _greyN = C('#4a5570');
  let ripT = 0, saveT = 0;

  V.update = (dt) => {
    const dayOn = E.SV.daynight !== false, rainOK = E.SV.weather !== false;
    if (dayOn) V.t = (V.t + dt / DAY_LEN) % 1; else V.t += ((V.t > 0.5 ? 1.12 : 0.12) - V.t) * Math.min(1, dt * 0.2), V.t %= 1;
    if ((saveT += dt) > 5) { saveT = 0; E.SV.tod = V.t; }
    // 天气：偶尔下一阵小雨
    V.rainT -= dt;
    if (V.rainT < 0) { if (V.rainOn) { V.rainOn = false; V.rainT = 200 + Math.random() * 160; if (rainOK && V.night < 0.5) { V.bow = 45; E.tip('🌈 雨停了，天上出现了彩虹！', 4000); } }
      else if (rainOK) { V.rainOn = true; V.rainT = 50 + Math.random() * 40; E.tip('🌧️ 下小雨啦。恐龙的皮很结实，不怕淋雨。<br><span class="small">雨停以后，看看天上会不会有彩虹。</span>', 4500); }
      else V.rainT = 60; }
    if (!rainOK) V.rainOn = false;
    V.rain += ((V.rainOn ? 1 : 0) - V.rain) * Math.min(1, dt * 0.15);
    V.bow = Math.max(0, V.bow - dt);
    const {a, b, s} = lerpK(V.t);
    const night = THREE.MathUtils.clamp((V.t - 0.68) / 0.1, 0, 1) * THREE.MathUtils.clamp((1.0 - V.t) / 0.06, 0, 1);
    if (night > 0.5 && V.night <= 0.5 && dayOn) E.tip('🌙 天黑了，萤火虫出来了。<br><span class="small">科学家在 9900 万年前的琥珀里发现过会发光的小甲虫，恐龙可能也见过这样的光。</span>', 5000);
    if (night < 0.5 && V.night >= 0.5 && dayOn) E.tip('🌅 天亮啦，新的一天！', 3000);
    V.night = night;
    const R = V.rain;
    // 光和雾
    E.sun.color.copy(a.sun).lerp(b.sun, s); E.sun.intensity = THREE.MathUtils.lerp(a.si, b.si, s) * (1 - R * 0.45);
    E.hemi.color.copy(a.hs).lerp(b.hs, s); E.hemi.groundColor.copy(a.hg).lerp(b.hg, s); E.hemi.intensity = THREE.MathUtils.lerp(a.hi, b.hi, s) * (1 - R * 0.1);
    _c.copy(a.fog).lerp(b.fog, s).lerp(night > 0.5 ? _greyN : _grey, R * 0.6); scene.fog.color.copy(_c);
    scene.fog.far = (MOB ? 150 : 165) * (1 - R * 0.3); scene.fog.near = (MOB ? 45 : 55) * (1 - R * 0.5);
    E.renderer.toneMappingExposure = 1.08 * THREE.MathUtils.lerp(a.ex, b.ex, s);
    U.uTop.value.copy(a.top).lerp(b.top, s); U.uHor.value.copy(a.hor).lerp(b.hor, s); U.uSunCol.value.copy(E.sun.color); U.uNight.value = night; U.uGrey.value = R;
    // 太阳方向：白天从东边升到西边；夜里换成月光，从另一边照过来
    const day = THREE.MathUtils.clamp((V.t - 0.0) / 0.74, 0, 1), ang = -1.1 + day * 2.2;
    const sunV = new THREE.Vector3(Math.sin(ang) * 0.75, 0.4 + Math.cos(ang) * 0.5, 0.45).normalize();
    const moonV = new THREE.Vector3(-0.4, 0.8, -0.45).normalize();
    E.SUN_DIR.copy(sunV).lerp(moonV, night).normalize();
    U.uSun.value.set(sunV.x, sunV.y, -sunV.z);
    // 云：日落时偏橙，下雨时变灰
    for (const c of E.clouds.children) { c.material.color.copy(a.hor).lerp(b.hor, s).lerp(C('#ffffff'), 0.55 * (1 - night)).lerp(_greyN, night * 0.5).lerp(_grey, R * 0.7); }
    // 雨丝
    rain.visible = R > 0.02; rain.material.opacity = R * 0.75;
    if (rain.visible) { const A = rg.attributes.position.array, gy = Math.max(H(PL.x, PL.z), WATER_Y);
      rain.position.set(PL.x, gy, PL.z);
      for (let i = 0; i < RN; i++) { const o = i * 6, d = rSpd[i] * dt; A[o + 1] -= d; A[o + 4] -= d; if (A[o + 1] < -1) { A[o + 1] += 30; A[o + 4] += 30; } }
      rg.attributes.position.needsUpdate = true;
      if ((ripT -= dt) < 0 && E.ripple) { ripT = 0.12 / R; for (let k = 0; k < 2; k++) { const x = PL.x + (Math.random() - 0.5) * 40, z = PL.z + (Math.random() - 0.5) * 40; if (H(x, z) < WATER_Y - 0.05) E.ripple(x, z, 0.5); } } }
    // 彩虹：出现在太阳对面
    bow.visible = V.bow > 0; if (bow.visible) { bowMat.uniforms.uA.value = Math.min(1, V.bow / 6, (45 - V.bow) / 6); const bx = -sunV.x, bz = sunV.z; const l = Math.hypot(bx, bz) || 1;
      bow.position.set(PL.x + bx / l * 420, -40, PL.z - bz / l * 420); bow.lookAt(PL.x, -40, PL.z); }
    // 萤火虫
    flies.visible = night > 0.05; if (flies.visible) { fMat.uniforms.uT.value = E.G.t; fMat.uniforms.uA.value = night * (1 - R);
      const A = fg.attributes.position.array; let moved = false;
      for (let i = 0; i < FN; i++) { const o = i * 3; let x = A[o] + flies.position.x - PL.x, z = A[o + 2] + flies.position.z - PL.z;
        if (Math.abs(x) > 26 || Math.abs(z) > 26) { const nx = PL.x + (Math.random() - 0.5) * 50, nz = PL.z + (Math.random() - 0.5) * 50; A[o] = nx - flies.position.x; A[o + 2] = nz - flies.position.z; A[o + 1] = Math.max(H(nx, nz), WATER_Y) + 0.6 + Math.random() * 2.5; moved = true; } }
      if (moved) fg.attributes.position.needsUpdate = true; }
  };
  V.isNight = () => V.night > 0.5;
  return V;
}
