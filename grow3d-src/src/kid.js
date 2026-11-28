// 给弟弟的简单玩法：大图片 + 一句话语音、和恐龙一起跳舞、数一数（数数和 20 以内加减法，答错不扣分）
import * as THREE from 'three';

const $ = id => document.getElementById(id);

export function createKid(C) {
  // C: {SV, G, PL, say, tone, burstAt, floatText, gainXP, save, H, nearDinos(), bite, notesAt, playerD()}
  const K = {};

  /* ---------- 大图片卡片 + 语音 ---------- */
  let cardT = 0;
  K.card = (icon, line, ms = 2600, speak = true) => {
    const e = $('kidCard'); e.innerHTML = `<span>${icon}</span><b>${line}</b>`; e.classList.add('show'); e.classList.toggle('low', !!C.G.dance);
    clearTimeout(cardT); cardT = setTimeout(() => e.classList.remove('show'), ms);
    if (speak) C.say(line.replace(/<[^>]+>/g, ''));
  };
  // 把普通提示变成“一个图标 + 一句短话”
  K.simplify = html => {
    const first = html.split('<br>')[0].replace(/<[^>]+>/g, '').trim();
    const m = first.match(/^(\p{Extended_Pictographic}️?|\S{1,2}️?)\s*/u);
    let icon = '🦕', rest = first;
    if (m && /\p{Extended_Pictographic}/u.test(m[1])) { icon = m[1]; rest = first.slice(m[0].length); }
    const s = rest.match(/^[^！。？]*[！。？]?/); let line = (s ? s[0] : rest).replace(/[（(].*?[）)]/g, '');
    if (line.length > 16) line = line.slice(0, 15) + '…';
    return {icon, line};
  };

  /* ---------- 跳舞 ---------- */
  const MOVES = [
    {k: 'clap', icon: '👏', word: '拍拍手'}, {k: 'jump', icon: '⬆️', word: '跳一跳'}, {k: 'sway', icon: '↔️', word: '摇一摇'},
    {k: 'bow', icon: '🙇', word: '弯弯腰'}, {k: 'nod', icon: '🙂', word: '点点头'}, {k: 'step', icon: '👣', word: '踏踏步'},
    {k: 'jump', icon: '⬆️', word: '跳一跳'}, {k: 'clap', icon: '👏', word: '拍拍手'},
  ];
  const BPM = 92, BEAT = 60 / BPM, PER = 8; // 每个动作 8 拍
  let actx = null, nextNote = 0;
  const MEL = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 0], BASS = [0, 0, 5, 5, 7, 7, 5, 5];
  const f0 = 262;
  function note(freq, t, dur, vol, type = 'triangle') {
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  K.dancing = () => !!K.D;
  K.startDance = () => {
    if (K.D) return; C.G.dance = true;
    K.D = {t: -1.5, mi: -1, beat: -1};
    $('danceBox').classList.add('show');
    K.card('💃', '一起跳舞吧！', 1800);
    if (C.SV.sound) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); nextNote = actx.currentTime + 1.5; } catch (e) { actx = null; } }
    for (const n of C.nearDinos(45)) { n.st = 'idle'; n.timer = 60; n.danceDir = Math.atan2(C.PL.x - n.x, C.PL.z - n.z); }
  };
  K.stopDance = (done) => {
    if (!K.D) return; K.D = null; C.G.dance = false; $('danceBox').classList.remove('show');
    for (const o of K.dancers || []) { o.rotation.z = 0; o.rotation.x = 0; }
    for (const n of C.nearDinos(60)) { n.timer = 1 + Math.random() * 3; }
    if (done) { K.card('🌟', '跳得真棒！', 2600); const p = C.PL; C.burstAt(p.x, C.H(p.x, p.z) + p.len * 0.6, p.z, '#ffe27a', 24, 1.5); C.gainXP(3); C.questEvent('dance'); }
  };
  K.updateDance = dt => {
    const D = K.D; if (!D) return;
    D.t += dt; if (D.t < 0) return;
    const beatF = D.t / BEAT, beat = Math.floor(beatF), mi = Math.floor(beat / PER), ph = beatF - beat;
    if (mi >= MOVES.length) { K.stopDance(true); return; }
    const M = MOVES[mi];
    if (mi !== D.mi) { D.mi = mi; $('danceIcon').textContent = M.icon; $('danceWord').textContent = M.word; C.say(M.word); $('danceNext').textContent = MOVES[mi + 1] ? '下一个：' + MOVES[mi + 1].icon : '最后一个！'; }
    if (beat !== D.beat) { D.beat = beat; const e = $('danceIcon'); e.classList.remove('beat'); void e.offsetWidth; e.classList.add('beat');
      $('danceDots').innerHTML = Array.from({length: PER}, (_, i) => `<i class="${i <= beat % PER ? 'on' : ''}"></i>`).join(''); }
    // 音乐（只有开了声音才有）
    if (actx && C.SV.sound) { while (nextNote < actx.currentTime + 0.25) { const i = D.ni = (D.ni || 0) + 1; note(f0 * Math.pow(2, MEL[i % 16] / 12), nextNote, 0.35, 0.05); if (i % 2 === 0) note(f0 / 2 * Math.pow(2, BASS[(i >> 1) % 8] / 12), nextNote, 0.5, 0.06, 'sine'); nextNote += BEAT; } }
    // 所有恐龙一起跳
    const list = [{o: C.playerD().holder, D: C.playerD(), len: C.PL.len, base: C.PL.dir}, ...C.nearDinos(45).map(n => ({o: n.D.holder, D: n.D, len: n.D.len, base: n.danceDir ?? n.dir, n}))];
    K.dancers = list.map(d => d.o);
    const s = Math.sin(ph * Math.PI), sw = Math.sin(beatF * Math.PI);
    for (const d of list) {
      const o = d.o, L = d.len; o.rotation.z = 0; o.rotation.x = 0;
      if (d.n) { d.n.dir = d.base; }
      if (M.k === 'jump') o.position.y += s * L * 0.18;
      if (M.k === 'clap') { o.position.y += s * L * 0.05; if (ph < dt / BEAT + 0.01 && beat % 4 === 0 && d.D.loco) C.bite(d.D); }
      if (M.k === 'sway') o.rotation.z = sw * 0.22;
      if (M.k === 'bow') o.rotation.x = s * 0.22;
      if (M.k === 'nod') o.rotation.x = s * 0.1;
      if (M.k === 'step') { o.position.y += s * L * 0.04; o.rotation.z = (beat % 2 ? 1 : -1) * s * 0.06; }
      o.rotation.y = d.base;
    }
    if (beat % 4 === 0 && ph < 0.05) { const p = C.PL; C.notesAt(p.x, C.H(p.x, p.z) + p.len * 0.8, p.z, 1); }
  };

  /* ---------- 数一数 ---------- */
  const THINGS = ['🫐', '🥚', '🍃', '🍓', '🦕', '🌸', '🍄', '⭐'];
  const CN = n => n === 2 ? '两' : NUM[n];
  const NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  C.SV.mathLv = C.SV.mathLv || 1;
  let Qm = null, streak = 0, miss = 0, count = 0;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function makeQ() {
    const lv = C.SV.mathLv, th = THINGS[rnd(0, THINGS.length - 1)];
    if (lv <= 1) { const n = rnd(1, 5); return {kind: 'count', a: n, ans: n, th, say: `有几个${nameOf(th)}？`}; }
    if (lv === 2) { const n = rnd(4, 10); return {kind: 'count', a: n, ans: n, th, say: `有几个${nameOf(th)}？`}; }
    if (lv === 3) { const a = rnd(1, 5), b = rnd(1, 5); return {kind: 'add', a, b, ans: a + b, th, say: `${CN(a)}个，又来了${CN(b)}个，一共几个？`}; }
    if (lv === 4) { const a = rnd(3, 10), b = rnd(1, a - 1); return {kind: 'sub', a, b, ans: a - b, th, say: `有${CN(a)}个，走了${CN(b)}个，还剩几个？`}; }
    if (lv === 5) { const a = rnd(3, 12), b = rnd(2, 20 - a); return {kind: 'add', a, b, ans: a + b, th, say: `${CN(a)}个，又来了${CN(b)}个，一共几个？`}; }
    const a = rnd(8, 20), b = rnd(2, a - 2); return {kind: 'sub', a, b, ans: a - b, th, say: `有${CN(a)}个，走了${CN(b)}个，还剩几个？`};
  }
  function nameOf(th) { return {'🫐': '果子', '🥚': '恐龙蛋', '🍃': '叶子', '🍓': '草莓', '🦕': '恐龙', '🌸': '花', '🍄': '蘑菇', '⭐': '星星'}[th]; }
  function opts(ans) { const s = new Set([ans]); let d = 1; while (s.size < 3) { const c = ans + (Math.random() < 0.5 ? -d : d); if (c >= 0 && c <= 20) s.add(c); d = d === 1 ? 2 : 1 + Math.floor(Math.random() * 2); if (s.size < 3 && d > 3) s.add(ans + s.size + 1); } return [...s].sort((a, b) => a - b); }
  function row(n, th, cls = '') { let h = ''; for (let i = 0; i < n; i++) h += `<span class="it ${cls}" data-i="${i}">${th}</span>${(i + 1) % 5 === 0 && i + 1 < n ? '<span class="gap"></span>' : ''}`; return h; }
  function render() {
    const q = Qm; let pic;
    if (q.kind === 'count') pic = `<div class="mrow">${row(q.a, q.th)}</div>`;
    if (q.kind === 'add') pic = `<div class="mrow">${row(q.a, q.th)}</div><div class="mop">➕</div><div class="mrow">${row(q.b, q.th, 'b')}</div>`;
    if (q.kind === 'sub') pic = `<div class="mrow">${row(q.a - q.b, q.th)}${row(q.b, q.th, 'gone')}</div><div class="mtip">${'👋'} 走了 ${q.b} 个</div>`;
    $('box').innerHTML = `<div class="math"><button class="mx" id="mClose">✖</button><div class="mstars">${'⭐'.repeat(count)}</div>
      <h2>${q.say.replace(/[一两二三四五六七八九十]+(?=个)/g, m => m === '两' ? 2 : NUM.indexOf(m) >= 0 ? NUM.indexOf(m) : m)}</h2>${pic}
      <div class="mans">${opts(q.ans).map(n => `<button class="mn" data-n="${n}">${n}</button>`).join('')}</div>
      <button class="btn light" id="mSay">🔊 再说一遍</button></div>`;
    $('mClose').onclick = K.closeMath; $('mSay').onclick = () => C.say(q.say);
    document.querySelectorAll('.mn').forEach(b => b.onclick = () => answer(+b.dataset.n, b));
    C.say(q.say);
  }
  function answer(n, b) {
    if (Qm.busy) return;
    if (n === Qm.ans) {
      Qm.busy = true; b.classList.add('ok'); count++; streak++; miss = 0; C.tone([659, 880, 1046], 0.05, 0.1); C.say(['对啦！', '真棒！', '答对了！'][rnd(0, 2)]);
      if (streak >= 3 && C.SV.mathLv < 6) { C.SV.mathLv++; streak = 0; } C.save();
      C.gainXP(1); setTimeout(() => { if (count >= 5) done(); else { Qm = makeQ(); render(); } }, 1400);
    } else {
      // 答错没关系：一起数一数
      Qm.busy = true; streak = 0; miss++; b.classList.add('try'); C.say('我们一起数一数');
      if (miss >= 2 && C.SV.mathLv > 1) { C.SV.mathLv--; miss = 0; C.save(); }
      const its = [...document.querySelectorAll('.math .it:not(.gone)')]; let i = 0;
      const step = () => { if (i < its.length) { its[i].classList.add('lit'); its[i].insertAdjacentHTML('beforeend', `<small>${i + 1}</small>`); C.say(NUM[i + 1]); i++; setTimeout(step, 750); }
        else { document.querySelectorAll('.mn').forEach(x => { if (+x.dataset.n === Qm.ans) x.classList.add('hint'); }); C.say(`是${CN(Qm.ans)}个`); Qm.busy = false; } };
      setTimeout(step, 900);
    }
  }
  function done() { $('box').innerHTML = `<div class="math"><h1>🌟 数完啦！</h1><div class="mstars big">${'⭐'.repeat(count)}</div><p>你得到了 ${count} 颗星星</p><button class="btn" id="mOk">好</button></div>`; C.say('数完啦，真棒！'); C.questEvent('math'); $('mOk').onclick = K.closeMath; }
  K.openMath = () => { count = 0; streak = 0; miss = 0; Qm = makeQ(); C.G.paused = true; $('overlay').classList.add('show', 'mathMode'); render(); };
  K.closeMath = () => { $('overlay').classList.remove('show', 'mathMode'); C.G.paused = false; };
  return K;
}
