// Phase 2: era vibes. Each room's surfaces, frames, labels, set pieces, the memorial
// treatment of the Affect walls, time-warp doorways, Freedom Wall shells, the final room,
// the credits corridor and DIWA (the 2030 smart-glasses guide).
import * as THREE from 'three';
import { H, DOOR_H, DOORS, SLOTS, WALL_T, wallPoint, roomById, obstacles, blocks } from './world.js';
import { canvasTex, wrapLines, roundRect } from './util.js';

const rand = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
let scene, animators, clickables, camera, ui;

function put(mesh, roomId, side, along, y, out = 0.06) {
  const { pos, rotY } = wallPoint(roomId, side, along, y, out);
  mesh.position.copy(pos); mesh.rotation.y = rotY; scene.add(mesh); return mesh;
}
function plane(w, h, tex, o = {}) {
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.transparent, depthWrite: !o.transparent, side: o.double ? THREE.DoubleSide : THREE.FrontSide });
  if (o.additive) m.blending = THREE.AdditiveBlending;
  if (o.opacity != null) m.opacity = o.opacity;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}
const lambert = c => new THREE.MeshLambertMaterial({ color: c });
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1, ...o });

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------
function repeatTex(w, h, draw) { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

const SURF = {
  lobby: () => ({
    wall: new THREE.MeshLambertMaterial({ map: repeatTex(512, 512, (c, w, h) => {
      c.fillStyle = '#ece4d5'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(150,125,80,.18)'; c.lineWidth = 3; c.strokeRect(30, 60, w - 60, h - 150);
      c.fillStyle = '#c8a24f'; c.fillRect(0, h - 40, w, 6);
      c.fillStyle = '#3a312a'; c.fillRect(0, h - 34, w, 34);
    }) }),
    wallRepeat: 5,
    floor: new THREE.MeshLambertMaterial({ map: repeatTex(512, 512, (c, w, h) => {
      const r = rand(3);
      for (let i = 0; i < 8; i++) { const t = 38 + r() * 10; c.fillStyle = `rgb(${t + 8},${t},${t - 6})`; c.fillRect(0, i * h / 8, w, h / 8); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, i * h / 8, w, 2); }
    }) }), floorRepeat: 4,
    ceil: new THREE.MeshBasicMaterial({ color: '#f5efe4' }),
  }),
  past: () => ({
    wall: new THREE.MeshLambertMaterial({ map: repeatTex(512, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#9fdcff'); g.addColorStop(0.55, '#cdbdff'); g.addColorStop(1, '#ffc0e6');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const r = rand(42);
      for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.14})`; c.beginPath(); c.arc(r() * w, r() * h, 2 + r() * 7, 0, 7); c.fill(); }
      for (let i = 0; i < 22; i++) {
        const x = r() * w, y = r() * h, s = 6 + r() * 12;
        c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath();
        c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill();
      }
    }) }),
    wallRepeat: 6,
    floor: new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.05, map: repeatTex(256, 256, (c, w, h) => {
      const s = w / 2; c.fillStyle = '#f4fbff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#39c6dc'; c.fillRect(0, 0, s, s); c.fillRect(s, s, s, s);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(8, 8, s - 40, 8); c.fillRect(s + 8, s + 8, s - 40, 8);
    }) }), floorRepeat: 2,
    ceil: new THREE.MeshBasicMaterial({ color: '#e3f3ff' }),
  }),
  present: () => ({
    wall: new THREE.MeshLambertMaterial({ map: repeatTex(256, 256, (c, w, h) => {
      c.fillStyle = '#dcdae2'; c.fillRect(0, 0, w, h); // soft grey so the RGB light reads on it
      const r = rand(7); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(0,0,0,${r() * 0.02})`; c.fillRect(r() * w, r() * h, 2, 2); }
    }) }),
    floor: new THREE.MeshLambertMaterial({ map: repeatTex(512, 512, (c, w, h) => {
      const r = rand(11), pw = h / 8;
      for (let i = 0; i < 8; i++) {
        const t = 190 + r() * 25; c.fillStyle = `rgb(${t + 18},${t - 8},${t - 48})`; c.fillRect(0, i * pw, w, pw);
        c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(0, i * pw, w, 2); c.fillRect(r() * w, i * pw, 2, pw);
      }
    }) }), floorRepeat: 5,
    ceil: new THREE.MeshBasicMaterial({ color: '#1d1b24' }), // dark ceiling, like a studio / modern café
  }),
  future: () => ({
    wall: new THREE.MeshLambertMaterial({ emissive: '#ffffff', emissiveIntensity: 0.0, map: repeatTex(512, 512, (c, w, h) => {
      c.fillStyle = '#070b18'; c.fillRect(0, 0, w, h);
      const r = rand(5); c.strokeStyle = 'rgba(0,229,255,.25)'; c.lineWidth = 2;
      for (let i = 0; i < 36; i++) {
        let x = Math.round(r() * 16) * 32, y = Math.round(r() * 16) * 32; c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 4; k++) { if (r() > .5) x += (r() > .5 ? 1 : -1) * 64; else y += (r() > .5 ? 1 : -1) * 64; c.lineTo(x, y); }
        c.stroke(); c.fillStyle = 'rgba(0,229,255,.7)'; c.fillRect(x - 3, y - 3, 6, 6);
      }
    }) }),
    wallRepeat: 6,
    floor: new THREE.MeshBasicMaterial({ map: repeatTex(256, 256, (c, w, h) => {
      c.fillStyle = '#04060d'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(0,229,255,.55)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
    }) }), floorRepeat: 2,
    ceil: new THREE.MeshBasicMaterial({ color: '#04060c' }),
  }),
  final: () => ({
    wall: new THREE.MeshLambertMaterial({ color: '#2a2521' }),
    floor: new THREE.MeshStandardMaterial({ color: '#1d1915', roughness: 0.7, metalness: 0.1 }),
    ceil: new THREE.MeshBasicMaterial({ color: '#12100e' }),
  }),
  corridor: () => ({
    wall: new THREE.MeshLambertMaterial({ color: '#3a302a' }),
    floor: new THREE.MeshLambertMaterial({ color: '#5a1f22' }),
    ceil: new THREE.MeshBasicMaterial({ color: '#221c18' }),
  }),
};
const surfCache = {};
export function lookFor(id) {
  const key = id.startsWith('corridor') ? 'corridor' : id;
  return (surfCache[key] ||= SURF[key]());
}

export const SKY = {
  lobby: { bg: '#1c1916', fog: [16, 60], hemi: 1.0 },
  past: { bg: '#a9d6f5', fog: [18, 64], hemi: 1.1 },
  present: { bg: '#2a2733', fog: [18, 64], hemi: 0.82 },
  future: { bg: '#03050c', fog: [10, 40], hemi: 0.45 },
  final: { bg: '#0e0c0a', fog: [14, 50], hemi: 0.85 },
  corridorV: { bg: '#16120f', fog: [8, 30], hemi: 0.7 },
  corridorH: { bg: '#16120f', fog: [8, 30], hemi: 0.7 },
};

// ---------------------------------------------------------------------------
// Frames and labels per era
// ---------------------------------------------------------------------------
const PAST_COLORS = ['#ff5fb8', '#4fc3ff', '#9be15d', '#ffb347', '#b18cff'];
export function frameStyle(roomId, aspectKey, idx) {
  if (aspectKey === 'affect') return { color: '#1b1714', metal: 0.2, rough: 0.6, border: 0.14, memorial: true };
  if (roomId === 'past') return { color: PAST_COLORS[idx % 5], metal: 0.3, rough: 0.15, border: 0.2, sticker: true };
  if (roomId === 'present') return { color: '#0d0d0d', metal: 0.5, rough: 0.25, border: 0.13, phone: true };
  if (roomId === 'future') return { color: '#00e5ff', border: 0.08, holo: true, out: 0.55 };
  return { color: '#2a2622', metal: 0.2, rough: 0.6, border: 0.12 };
}

export function labelTexture(roomId, item, aspect, touch) {
  const hint = touch ? 'Tap to read more' : 'Click to read more';
  return canvasTex(600, 210, (c, w, h) => {
    const top = ((item.year ? item.year + '  ·  ' : '') + aspect.label).toUpperCase();
    if (aspect.key === 'affect') {
      c.fillStyle = '#211d1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#b89a5a'; c.fillRect(0, 0, 6, h);
      c.textBaseline = 'top'; c.fillStyle = '#b89a5a'; c.font = '600 18px Inter'; c.fillText(top, 28, 22);
      c.fillStyle = '#efe6d6'; c.font = '700 33px "Playfair Display"';
      wrapLines(c, item.title, w - 56, 2).forEach((l, i) => c.fillText(l, 28, 56 + i * 40));
      c.fillStyle = '#9d927f'; c.font = '500 16px Inter'; c.fillText(hint, 28, h - 32);
    } else if (roomId === 'past') {
      roundRect(c, 4, 4, w - 8, h - 8, 28); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#ff5fb8'; c.stroke();
      c.textBaseline = 'top'; c.fillStyle = '#c2188b'; c.font = '26px VT323'; c.fillText(top, 28, 18);
      c.fillStyle = '#2a1050'; c.font = '30px Bungee';
      wrapLines(c, item.title, w - 56, 2).forEach((l, i) => c.fillText(l, 28, 54 + i * 40));
      c.fillStyle = '#7a4fb5'; c.font = '24px VT323'; c.fillText('~*~ ' + hint + ' ~*~', 28, h - 36);
    } else if (roomId === 'present') {
      roundRect(c, 4, 4, w - 8, h - 8, 22); c.fillStyle = '#ffffff'; c.fill();
      c.textBaseline = 'top'; c.fillStyle = '#fe2c55'; c.font = '700 18px Inter'; c.fillText(top, 28, 22);
      c.fillStyle = '#111'; c.font = '800 33px Inter';
      wrapLines(c, item.title, w - 56, 2).forEach((l, i) => c.fillText(l, 28, 54 + i * 40));
      c.fillStyle = '#888'; c.font = '600 17px Inter'; c.fillText('♥  💬  ↗   ' + hint, 28, h - 34);
    } else {
      roundRect(c, 4, 4, w - 8, h - 8, 12); c.fillStyle = 'rgba(2,20,34,.92)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#00e5ff'; c.stroke();
      c.textBaseline = 'top'; c.fillStyle = '#7df9ff'; c.font = '500 17px Orbitron'; c.fillText(top, 28, 22);
      c.fillStyle = '#e6fdff'; c.font = '800 27px Orbitron';
      wrapLines(c, item.title, w - 56, 2).forEach((l, i) => c.fillText(l, 28, 56 + i * 38));
      c.fillStyle = '#7df9ff'; c.font = '500 15px Orbitron'; c.fillText(hint.toUpperCase(), 28, h - 32);
    }
  });
}

// Extras added once an exhibit's image size is known.
export function decorateExhibit(ex, style) {
  const { group: g, size } = ex;
  if (style.sticker) {
    const star = plane(0.46, 0.46, canvasTex(128, 128, c => {
      c.translate(64, 64); c.rotate(-0.3); c.fillStyle = '#fff36b'; c.strokeStyle = '#ff5fb8'; c.lineWidth = 6; c.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 24 : 54, a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); c.stroke();
    }), { transparent: true });
    star.position.set(size.w / 2, size.h / 2, 0.09); g.add(star);
    animators.push(t => { star.rotation.z = Math.sin(t * 2 + ex.idx) * 0.18; });
  }
  if (style.phone) {
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.1), new THREE.MeshBasicMaterial({ color: '#2b2b2b' }));
    notch.position.set(0, size.h / 2 + 0.065, 0.03); g.add(notch);
  }
  if (style.holo) {
    const glow = plane(size.w + 0.9, size.h + 0.9, canvasTex(128, 128, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,229,255,.55)'); gr.addColorStop(1, 'rgba(0,229,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }), { transparent: true, additive: true });
    glow.position.z = -0.08; g.add(glow);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.5, 1.4, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(0, -size.h / 2 - 1.2, 0); g.add(beam);
    const base = g.position.y;
    animators.push(t => { g.position.y = base + Math.sin(t * 1.1 + ex.idx + ex.aspect.key.length) * 0.07; });
  }
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------
const BANNER = {
  lobby(c, w, h, t, s) {
    c.fillStyle = '#1f1b17'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a24f'; c.lineWidth = h * 0.03; c.strokeRect(h * .06, h * .06, w - h * .12, h - h * .12);
    c.fillStyle = '#f3ead8'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${h * (s ? .36 : .42)}px "Playfair Display"`; c.fillText(t, w / 2, h * (s ? .42 : .52));
    if (s) { c.font = `600 ${h * .14}px Inter`; c.fillStyle = '#c8a24f'; c.fillText(s.toUpperCase(), w / 2, h * .77); }
  },
  past(c, w, h, t, s) {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ff5fb8'); g.addColorStop(1, '#4fc3ff');
    roundRect(c, 6, 6, w - 12, h - 12, h / 2.4); c.fillStyle = g; c.fill(); c.lineWidth = h * .05; c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(80,0,120,.55)'; c.shadowOffsetY = h * .04;
    c.font = `${h * (s ? .36 : .42)}px Bungee`; c.fillText(t, w / 2, h * (s ? .42 : .53));
    if (s) { c.shadowColor = 'transparent'; c.font = `${h * .2}px VT323`; c.fillText(s, w / 2, h * .78); }
  },
  present(c, w, h, t, s) {
    roundRect(c, 4, 4, w - 8, h - 8, h * .2); c.fillStyle = '#111'; c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${h * (s ? .36 : .42)}px Inter`; const y = h * (s ? .42 : .53);
    c.fillStyle = '#25f4ee'; c.fillText(t, w / 2 - h * .025, y - h * .02); c.fillStyle = '#fe2c55'; c.fillText(t, w / 2 + h * .025, y + h * .02);
    c.fillStyle = '#fff'; c.fillText(t, w / 2, y);
    if (s) { c.font = `600 ${h * .14}px Inter`; c.fillStyle = '#bbb'; c.fillText(s, w / 2, h * .79); }
  },
  future(c, w, h, t, s) {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#00e5ff'; c.lineWidth = h * .03; c.shadowColor = '#00e5ff'; c.shadowBlur = h * .12;
    roundRect(c, h * .08, h * .08, w - h * .16, h - h * .16, h * .08); c.stroke(); c.fillStyle = 'rgba(0,30,50,.6)'; c.fill();
    c.shadowBlur = h * .08; c.fillStyle = '#d9fdff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${h * (s ? .32 : .38)}px Orbitron`; c.fillText(t, w / 2, h * (s ? .42 : .53));
    if (s) { c.shadowBlur = 0; c.font = `500 ${h * .13}px Orbitron`; c.fillStyle = '#7df9ff'; c.fillText(s, w / 2, h * .76); }
  },
  memorial(c, w, h, t, s) {
    c.fillStyle = '#1b1714'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8f7a4c'; c.lineWidth = h * .025; c.strokeRect(h * .07, h * .07, w - h * .14, h - h * .14);
    c.fillStyle = '#efe6d6'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${h * (s ? .32 : .4)}px "Playfair Display"`; c.fillText(t, w / 2, h * (s ? .41 : .52));
    if (s) { c.font = `500 ${h * .15}px Inter`; c.fillStyle = '#b89a5a'; c.fillText(s, w / 2, h * .74); }
  },
  final(c, w, h, t, s) { BANNER.lobby(c, w, h, t, s); },
};
export function eraBanner(style, text, sub, w, h, px = 180) {
  const tex = canvasTex(Math.round(px * w / h), px, (c, cw, ch) => BANNER[style](c, cw, ch, text, sub));
  return plane(w, h, tex, { transparent: style === 'future' });
}

function neon(text, w, h, colors, font = '800 {s}px Inter') {
  const tex = canvasTex(Math.round(200 * w / h), 200, (c, cw, ch) => {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = font.replace('{s}', ch * 0.58);
    for (const [blur, col] of [[40, colors[0]], [18, colors[0]], [0, colors[1]]]) { c.shadowColor = colors[0]; c.shadowBlur = blur; c.fillStyle = col; c.fillText(text, cw / 2, ch / 2); }
  });
  return plane(w, h, tex, { transparent: true });
}

// ---------------------------------------------------------------------------
// Memorial Affect walls (all three eras)
// ---------------------------------------------------------------------------
function memorialWall(roomId) {
  const s = SLOTS[roomId].affect;
  const lo = Math.min(...s.along) - 2.4, hi = Math.max(...s.along) + 2.4;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(hi - lo, 4.9), lambert(roomId === 'future' ? '#0b0d16' : '#2a2420'));
  put(panel, roomId, s.side, (lo + hi) / 2, 3.05, 0.03);
  const head = eraBanner('memorial', 'Affect, Senses & Feelings', 'Presented in remembrance', 8.5, 0.95, 150);
  put(head, roomId, s.side, (lo + hi) / 2, 5.15, 0.05);
  // Candles at the foot of the wall: one pair per exhibit.
  const flameTex = canvasTex(64, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * .65, 2, w / 2, h * .6, w / 2);
    g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(.4, 'rgba(255,190,80,.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(w / 2, h * .6, w * .32, h * .38, 0, 0, 7); c.fill();
  });
  const wax = new THREE.MeshLambertMaterial({ color: '#efe6d2' });
  const flames = [];
  for (const a of s.along) for (const off of [-0.45, 0.45]) {
    const { pos } = wallPoint(roomId, s.side, a + off, 0.13, 0.45);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 12), wax);
    candle.position.copy(pos); scene.add(candle);
    const f = plane(0.12, 0.22, flameTex, { transparent: true, additive: true, double: true });
    f.position.set(pos.x, 0.38, pos.z); scene.add(f); flames.push(f);
  }
  const mid = wallPoint(roomId, s.side, (lo + hi) / 2, 1.2, 1.5).pos;
  const glow = new THREE.PointLight('#ffb35c', 6, 10, 1.6); glow.position.copy(mid); scene.add(glow);
  animators.push(t => {
    flames.forEach((f, i) => { f.quaternion.copy(camera.quaternion); f.scale.y = 1 + Math.sin(t * 13 + i * 1.7) * 0.12; });
    glow.intensity = 6 + Math.sin(t * 9) * 0.6;
  });
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
function aspectHeadings(roomId, style) {
  for (const key of ['body', 'performance']) {
    const s = SLOTS[roomId][key];
    const label = key === 'body' ? 'Body & Self-Image' : 'Performance';
    let mid = (Math.min(...s.along) + Math.max(...s.along)) / 2;
    if (roomId === 'past' && key === 'performance') mid = 5.6;
    put(eraBanner(style, label, null, key === 'body' ? 7.5 : 6.5, 0.85, 140), roomId, s.side, mid, 5.25, 0.05);
  }
}

function buildPast() {
  const r = roomById.past;
  aspectHeadings('past', 'past');
  const welcome = eraBanner('past', 'Welcome to the 2000s!', '~*~ texting · telefantasyas · low-rise jeans ~*~', 11, 1.8);
  welcome.position.set(13, 5.25, 55); scene.add(welcome);
  const mq = canvasTex(2048, 64, (c, w, h) => {
    c.fillStyle = '#16063a'; c.fillRect(0, 0, w, h); c.font = '46px VT323'; c.fillStyle = '#7dff6b'; c.textBaseline = 'middle';
    c.fillText('★ add me on Friendster! ★ unli-text til midnight ★ txt PBB to vote ★ Kapamilya or Kapuso? ★ Snake high score: 2001 ★ Meteor Garden marathon ★ brb, LAN shop ★', 10, h / 2 + 2);
  });
  mq.wrapS = THREE.RepeatWrapping;
  const marquee = plane(11, 0.34, mq); marquee.position.set(13, 4.15, 55); scene.add(marquee);
  animators.push((t, dt) => { mq.offset.x = (mq.offset.x + dt * 0.06) % 1; });

  // Giant Nokia on a pedestal.
  const nz = 44, nokia = nokiaModel(1);
  nokia.position.set(13, 2.35, nz); scene.add(nokia);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 1.0, 32), std('#ffffff', { roughness: 0.15 }));
  ped.position.set(13, 0.5, nz); scene.add(ped);
  obstacles.push({ x: 13, z: nz, r: 1.1 });
  animators.push(t => { nokia.rotation.y = t * 0.5; });

  // CRT TV with static.
  const tz = 52, tx = 19;
  const tv = new THREE.Group();
  tv.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.25, 1.2), std('#d3cec3', { roughness: 0.6 })));
  const st = canvasTex(160, 120, () => {});
  const screen = plane(1.25, 0.95, st); screen.position.z = 0.61; tv.add(screen);
  tv.position.set(tx, 1.62, tz); tv.rotation.y = -0.5; scene.add(tv);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.3), std('#5b3b2a')); stand.position.set(tx, 0.5, tz); stand.rotation.y = -0.5; scene.add(stand);
  obstacles.push({ x: tx, z: tz, r: 1.1 });
  const msgs = ['SexBomb!', 'PBB Teens', 'Encantadia', 'Mulawin', 'Meteor Garden'];
  let n = 0;
  animators.push(t => {
    if (n++ % 4) return;
    const { ctx: c, canvas: cv } = st.userData, img = c.createImageData(cv.width, cv.height);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 200; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 30; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 44, cv.width, 34);
    c.font = '28px VT323'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(msgs[Math.floor(t / 2.5) % msgs.length], cv.width / 2, 70); st.needsUpdate = true;
  });

  // Bubbles, kept away from the memorial (west) wall.
  const bm = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.6, emissive: '#8fd6ff', emissiveIntensity: 0.3 });
  const rr = rand(77);
  for (let i = 0; i < 24; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12 + rr() * 0.25, 18, 12), bm);
    const bx = 8 + rr() * 16, bz = 32 + rr() * 26, by = 1.2 + rr() * 4, sp = 0.3 + rr() * 0.5;
    b.position.set(bx, by, bz); scene.add(b);
    animators.push(t => { b.position.y = by + Math.sin(t * sp + i) * 0.4; b.position.x = bx + Math.cos(t * sp * .7 + i) * .25; });
  }
  const sun = new THREE.PointLight('#ffffff', 40, 40, 1.2); sun.position.set(16, 5.6, 45); scene.add(sun);

  // The Freedom Wall for this room is built by freedom.js.
}

function nokiaModel(scale) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.32), std('#2a3e66', { roughness: 0.35, metalness: 0.2 })));
  const face = canvasTex(256, 560, (c, w, h) => {
    c.fillStyle = '#c9d4e6'; roundRect(c, 0, 0, w, h, 60); c.fill();
    c.fillStyle = '#1f2a44'; c.font = '700 26px Inter'; c.textAlign = 'center'; c.fillText('N O K I A', w / 2, 52);
    c.fillStyle = '#9fbf6a'; roundRect(c, 34, 76, w - 68, 170, 10); c.fill();
    c.fillStyle = '#1d2a10'; for (let i = 0; i < 9; i++) c.fillRect(70 + i * 12, 150, 10, 10); c.fillRect(178, 150, 10, 10); c.fillRect(120, 110, 10, 10);
    c.font = '22px VT323'; c.textAlign = 'left'; c.fillText('SNAKE II   2001', 46, 228);
    c.fillStyle = '#8a95ab'; roundRect(c, 70, 270, w - 140, 54, 26); c.fill();
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { c.fillStyle = '#e8edf6'; roundRect(c, 38 + k * 64, 350 + r * 50, 52, 38, 16); c.fill(); }
  });
  const f = plane(0.86, 1.95, face, { transparent: true }); f.position.z = 0.17; g.add(f);
  g.scale.setScalar(scale);
  return g;
}

function buildPresent() {
  aspectHeadings('present', 'present');
  const welcome = eraBanner('present', 'NOW: 2025–2026', 'for you · trending · live', 10, 1.6);
  welcome.position.set(13, 5.3, 25.5); scene.add(welcome);

  // 2025 lighting: colour-shifting RGB LED strips along every wall (top cove + floor), hexagon light panels,
  // and smart-bulb room lights slowly cycling TikTok cyan / pink / purple.
  const ledTex = canvasTex(512, 8, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    ['#25f4ee', '#7b6cff', '#fe2c55', '#ff8ad8', '#25f4ee'].forEach((col, i, arr) => g.addColorStop(i / (arr.length - 1), col));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  ledTex.wrapS = THREE.RepeatWrapping;
  const washTex = ledTex;
  const fade = up => canvasTex(4, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(up ? 1 : 0, '#fff'); g.addColorStop(up ? 0 : 1, '#000'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const fadeDown = fade(false), fadeUp = fade(true);
  const ledMats = [];
  const r = roomById.present, inset = WALL_T / 2 + 0.03;
  const walls = [ // [x0, z0, x1, z1] along each wall face
    [r.x0 + inset, r.z0 + inset, r.x1 - inset, r.z0 + inset], [r.x1 - inset, r.z0 + inset, r.x1 - inset, r.z1 - inset],
    [r.x1 - inset, r.z1 - inset, r.x0 + inset, r.z1 - inset], [r.x0 + inset, r.z1 - inset, r.x0 + inset, r.z0 + inset],
  ];
  for (const [x0, z0, x1, z1] of walls) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (const y of [H - 0.12, 0.08]) {
      const t = ledTex.clone(); t.needsUpdate = true; t.repeat.x = len / 9;
      const m = new THREE.MeshBasicMaterial({ map: t }); ledMats.push(m);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.04), m);
      strip.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); strip.rotation.y = -Math.atan2(z1 - z0, x1 - x0); scene.add(strip);
      // Soft coloured wash the strip throws onto the wall (fades away from the strip).
      const wt = washTex.clone(); wt.needsUpdate = true; wt.repeat.x = len / 9; const top = y > 1;
      const wm = new THREE.MeshBasicMaterial({ map: wt, alphaMap: top ? fadeDown : fadeUp, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
      ledMats.push(wm);
      const wash = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), wm);
      const ang = Math.atan2(z1 - z0, x1 - x0), nx = Math.sin(ang), nz = -Math.cos(ang); // wall normal into the room
      wash.position.set((x0 + x1) / 2 - nx * 0.015, top ? y - 0.55 : y + 0.55, (z0 + z1) / 2 - nz * 0.015);
      wash.rotation.y = -ang; scene.add(wash);
    }
  }
  // Hexagon light panels (gaming / creator-room style) on the south wall, east of the entrance.
  const hexMats = ['#25f4ee', '#fe2c55', '#b18cff', '#ff8ad8'].map(c => new THREE.MeshBasicMaterial({ color: c }));
  const hexes = [];
  [[0, 0], [0.62, 0.36], [0.62, -0.36], [1.24, 0], [1.86, 0.36], [-0.62, 0.36], [1.24, 0.72]].forEach(([dx, dy], i) => {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.34, 6), hexMats[i % 4]); h.rotation.z = Math.PI / 6;
    put(h, 'present', 'south', 21.5 - dx, 3.3 + dy, 0.04); hexes.push({ h, p: i * 0.9 });
  });
  const smartA = new THREE.PointLight('#25f4ee', 22, 22, 1.3); smartA.position.set(7, 5.6, 12); scene.add(smartA);
  const smartB = new THREE.PointLight('#fe2c55', 22, 22, 1.3); smartB.position.set(19, 5.6, 12); scene.add(smartB);
  const ca = new THREE.Color(), cb = new THREE.Color();
  animators.push(t => {
    for (const m of ledMats) m.map.offset.x = (t * 0.05) % 1;
    ca.setHSL((0.5 + Math.sin(t * 0.12) * 0.12 + 1) % 1, 0.85, 0.6); cb.setHSL((0.93 + Math.cos(t * 0.1) * 0.08 + 1) % 1, 0.85, 0.6);
    smartA.color.copy(ca); smartB.color.copy(cb);
    hexes.forEach(({ h, p }) => { h.material.opacity = 1; h.scale.setScalar(0.96 + Math.sin(t * 1.4 + p) * 0.04); });
  });

  // Creator corner (south-east, by the Body wall): ring light with a phone on a tripod, an LED panel,
  // a chair for the creator and a glowing LIVE sign.
  {
    const cx = 21.5, cz = 24.6; // the tripod; the creator sits behind it to the south
    const dark = std('#1d1d1f', { metalness: 0.5, roughness: 0.35 });
    const tripod = new THREE.Group(); tripod.position.set(cx, 0, cz); scene.add(tripod);
    const topJ = new THREE.Vector3(0, 1.12, 0);
    for (let i = 0; i < 3; i++) { // legs splayed from the top joint down to the floor
      const a = i / 3 * Math.PI * 2 + Math.PI / 2, foot = new THREE.Vector3(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38);
      const dir = foot.clone().sub(topJ), len = dir.length();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 6), dark);
      leg.position.copy(topJ).addScaledVector(dir, 0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); tripod.add(leg);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), dark); mast.position.y = 1.52; tripod.add(mast);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 16, 48), new THREE.MeshBasicMaterial({ color: '#fffaf0' })); ring.position.y = 1.95; tripod.add(ring);
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.012), dark); phone.position.set(0, 1.95, 0.02); tripod.add(phone);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.165), new THREE.MeshBasicMaterial({ color: '#fe2c55' })); screen.position.set(0, 1.95, 0.027); tripod.add(screen);
    const ringLight = new THREE.PointLight('#fff4e0', 6, 4, 1.5); ringLight.position.set(0, 1.95, 0.4); tripod.add(ringLight);
    tripod.rotation.y = 0; // ring + phone face south, toward the creator's chair
    // LED panel (softbox) on a stand, angled toward the chair.
    const panelStand = new THREE.Group(); panelStand.position.set(cx - 1.5, 0, cz + 1.5); panelStand.rotation.y = Math.atan2(1.5, 0.5); scene.add(panelStand); // faces the chair
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), dark); pole.position.y = 0.85; panelStand.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.05), dark); panel.position.y = 1.8; panelStand.add(panel);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.49), new THREE.MeshBasicMaterial({ color: '#dff1ff' })); glow.position.set(0, 1.8, 0.027); panelStand.add(glow);
    const panelLight = new THREE.PointLight('#dff1ff', 5, 4, 1.5); panelLight.position.set(0, 1.8, 0.4); panelStand.add(panelLight);
    // Chair where the creator sits, facing the phone (north).
    const chair = new THREE.Group(); chair.position.set(cx, 0, cz + 2.0); scene.add(chair);
    const seatMat = std('#fe2c55', { roughness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), seatMat); seat.position.y = 0.48; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.07), seatMat); back.position.set(0, 0.8, 0.22); chair.add(back);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 8), dark); stem.position.y = 0.24; chair.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 20), dark); base.position.y = 0.02; chair.add(base);
    obstacles.push({ x: cx, z: cz, r: 0.45 }, { x: cx - 1.5, z: cz + 1.5, r: 0.35 }, { x: cx, z: cz + 2.0, r: 0.4 });
    // LIVE sign on the south wall behind the chair, with a pulsing red dot.
    const live = neon('● LIVE', 2.8, 0.9, ['#ff2a4d', '#ffe3e8']); put(live, 'present', 'south', 21.5, 1.95, 0.05); // between the chair back and the hexagons
    animators.push(t => { live.material.opacity = 0.75 + Math.abs(Math.sin(t * 2.2)) * 0.25; });
  }
  // Neon hashtags on the entrance wall (seen when you turn around).
  [['#fyp', 6, ['#25f4ee', '#d6fffd']], ['#PPOP', 13, ['#fe2c55', '#ffd6df']], ['#OPM', 20, ['#25f4ee', '#d6fffd']]].forEach(([t, x, col]) =>
    put(neon(t, 3.2, 0.9, col), 'present', 'south', x, 5.0, 0.05));
  const fill = new THREE.PointLight('#ffffff', 20, 40, 1.2); fill.position.set(13, 5.8, 16); scene.add(fill);

  // The Freedom Wall for this room is built by freedom.js.
}

function buildFuture() {
  aspectHeadings('future', 'future');
  const welcome = eraBanner('future', '2030', 'predictions · projections · possibilities', 7, 1.6);
  welcome.position.set(30.5, 5.3, 9); welcome.rotation.y = -Math.PI / 2; scene.add(welcome);

  // Central hologram.
  const cx = 39.5, cz = 15;
  const holo = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), new THREE.MeshBasicMaterial({ color: '#00e5ff', wireframe: true }));
  holo.add(core);
  const rings = [1.45, 1.85, 2.25].map((r, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 8, 96), new THREE.MeshBasicMaterial({ color: i === 1 ? '#8b6cff' : '#7df9ff' }));
    m.rotation.x = Math.PI / 2 + i * 0.4; holo.add(m); return m;
  });
  holo.position.set(cx, 2.7, cz); scene.add(holo);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.18, 48), new THREE.MeshBasicMaterial({ color: '#0a2a3a' }));
  pad.position.set(cx, 0.09, cz); scene.add(pad);
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.45, 48), new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(cx, 0.19, cz); scene.add(glow);
  obstacles.push({ x: cx, z: cz, r: 1.8 });
  const cl = new THREE.PointLight('#00e5ff', 30, 18, 1.4); cl.position.set(cx, 3, cz); scene.add(cl);
  // Ceiling light strips.
  const strip = new THREE.MeshBasicMaterial({ color: '#00e5ff' });
  for (let z = 4; z < 30; z += 6.5) { const s = new THREE.Mesh(new THREE.BoxGeometry(22, 0.04, 0.1), strip); s.position.set(39, H - 0.03, z); scene.add(s); }
  // Particles.
  const N = 380, pos = new Float32Array(N * 3), rr = rand(99);
  for (let i = 0; i < N; i++) { pos[i * 3] = 27 + rr() * 24; pos[i * 3 + 1] = rr() * H; pos[i * 3 + 2] = 1 + rr() * 28; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#7df9ff', size: 0.05, transparent: true, opacity: 0.8 })));
  animators.push((t, dt) => {
    core.rotation.y = t * 0.4; core.rotation.x = t * 0.25;
    rings.forEach((m, i) => { m.rotation.z = t * (0.3 + i * 0.2) * (i % 2 ? -1 : 1); });
    holo.position.y = 2.7 + Math.sin(t) * 0.1; glow.material.opacity = 0.45 + Math.sin(t * 2) * 0.2;
    const a = g.attributes.position.array; for (let i = 1; i < a.length; i += 3) { a[i] += dt * 0.25; if (a[i] > H) a[i] = 0; }
    g.attributes.position.needsUpdate = true;
  });

  // The Freedom Wall for this room is built by freedom.js.
}

function buildFinal() {
  // Neon sign over the exit, rising pedestals with the phone evolution, floor marker.
  put(neon('Culture Collective', 12, 1.9, ['#e6c376', '#fff4d6'], '900 italic {s}px "Playfair Display"'), 'final', 'south', 39, 5.25, 0.05);
  const peds = [
    // Seen from the photo spot (facing south), +x is on the left, so the 2000s pedestal sits at the highest x.
    { x: 44.5, h: 0.9, col: '#ff7ac6', cap: '2000s: Text, Snake & Friendster', make: () => nokiaModel(0.85) },
    { x: 39, h: 1.35, col: '#fe2c55', cap: 'Now: Scroll, post, go viral', make: () => { const m = phoneModel(); m.scale.setScalar(1.5); return m; } },
    { x: 33.5, h: 1.8, col: '#00e5ff', cap: '2030: See the world through AI', make: () => { const m = glassesModel(); m.scale.multiplyScalar(1.5); return m; } },
  ];
  const pz = 50;
  peds.forEach((p, i) => {
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.8, p.h, 1.8), std('#f1ebe0', { roughness: 0.35 }));
    ped.position.set(p.x, p.h / 2, pz); scene.add(ped);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.06, 1.86), new THREE.MeshBasicMaterial({ color: p.col }));
    rim.position.set(p.x, p.h + 0.03, pz); scene.add(rim);
    const obj = p.make(); obj.position.set(p.x, p.h + 1.2, pz); scene.add(obj);
    const light = new THREE.PointLight(p.col, 14, 6, 1.5); light.position.set(p.x, p.h + 2.4, pz - 1.2); scene.add(light);
    const cap = canvasTex(520, 110, (c, w, h) => {
      c.fillStyle = '#1f1b17'; c.fillRect(0, 0, w, h); c.fillStyle = p.col; c.fillRect(0, h - 8, w, 8);
      c.fillStyle = '#f3ead8'; c.font = '700 30px "Playfair Display"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.cap, w / 2, h / 2 - 2);
    });
    const capM = plane(1.7, 0.36, cap); capM.position.set(p.x, Math.min(0.6, p.h - 0.25), pz - 0.91); capM.rotation.y = Math.PI; scene.add(capM);
    obstacles.push({ x: p.x, z: pz, r: 1.25 });
    animators.push(t => { obj.rotation.y = t * 0.6 + i; });
  });
  const marker = plane(2.6, 2.6, canvasTex(512, 512, (c, w, h) => {
    c.strokeStyle = '#e6c376'; c.lineWidth = 12; c.shadowColor = '#e6c376'; c.shadowBlur = 30; c.beginPath(); c.arc(w / 2, h / 2, 220, 0, 7); c.stroke();
    c.shadowBlur = 0; c.fillStyle = '#fff4d6'; c.font = '800 46px Inter'; c.textAlign = 'center'; c.fillText('STAND HERE', w / 2, h / 2 - 4);
    c.font = '600 28px Inter'; c.fillStyle = '#e6c376'; c.fillText('#CultureCollective', w / 2, h / 2 + 44);
  }), { transparent: true });
  marker.rotation.x = -Math.PI / 2; marker.rotation.z = Math.PI; marker.position.set(39, 0.02, 41); scene.add(marker);
  const amb = new THREE.PointLight('#fff2dc', 45, 34, 1.2); amb.position.set(39, 6, 44); scene.add(amb);

  // Thank-you wall (west).
  const ty = canvasTex(1300, 760, (c, w, h) => {
    c.fillStyle = '#1f1b17'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a24f'; c.lineWidth = 4; c.strokeRect(18, 18, w - 36, h - 36);
    c.textAlign = 'center'; c.fillStyle = '#f3ead8'; c.font = '900 92px "Playfair Display"'; c.fillText('Salamat sa pagbisita!', w / 2, 170);
    c.fillStyle = '#c8a24f'; c.font = '600 26px Inter'; c.fillText('THANK YOU FOR VISITING CULTURE COLLECTIVE', w / 2, 230);
    c.fillStyle = '#e4d9c4'; c.font = '700 34px "Playfair Display"';
    const names = window.CC_DATA.site.curators;
    if (names.length === 1) { c.font = '700 64px "Playfair Display"'; c.fillText(names[0], w / 2, 440); }
    else names.forEach((n, i) => c.fillText(n, w / 2 + (i % 2 ? 300 : -300), 330 + Math.floor(i / 2) * 80));
    c.fillStyle = '#8a7a5c'; c.font = '600 22px Inter'; c.fillText(names.length === 1 ? 'CURATOR' : 'CURATORS', w / 2, h - 60);
  });
  put(plane(9, 5.26, ty), 'final', 'west', 45, 3.1, 0.06);
}

function phoneModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.25, 0.07), std('#0b0b0b', { metalness: 0.6, roughness: 0.25 })));
  const s = canvasTex(300, 600, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#25f4ee'); gr.addColorStop(1, '#fe2c55'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = '800 26px Inter'; c.fillText('For You', w / 2, 60); c.font = '80px Inter'; c.fillText('♪', w / 2, 330);
    c.font = '34px Inter'; ['♥', '💬', '↗'].forEach((ic, i) => c.fillText(ic, w - 34, 380 + i * 64));
    c.textAlign = 'left'; c.font = '700 20px Inter'; c.fillText('@culturecollective', 20, h - 60);
  });
  const f = plane(0.56, 1.17, s); f.position.z = 0.04; g.add(f);
  const b = plane(0.56, 1.17, s); b.position.z = -0.04; b.rotation.y = Math.PI; g.add(b);
  return g;
}

function glassesModel() {
  const g = new THREE.Group();
  const frame = std('#111', { metalness: 0.6, roughness: 0.3 });
  const lens = new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.45 });
  for (const x of [-0.27, 0.27]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 12, 40), frame); rim.position.x = x; g.add(rim);
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), lens); l.position.x = x; g.add(l);
    const l2 = l.clone(); l2.rotation.y = Math.PI; g.add(l2);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), frame); g.add(bridge);
  for (const x of [-0.48, 0.48]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.55), frame); arm.position.set(x, 0, -0.27); g.add(arm); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: '#7df9ff' }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.35; g.add(ring);
  g.scale.setScalar(1.25);
  return g;
}

function buildCorridor() {
  const light = new THREE.PointLight('#ffd9a8', 12, 14, 1.4); light.position.set(37, 4.5, 68); scene.add(light);
  const light2 = new THREE.PointLight('#ffd9a8', 8, 10, 1.4); light2.position.set(39, 4.5, 62); scene.add(light2);
  const credits = canvasTex(700, 860, (c, w, h) => {
    c.fillStyle = '#1f1b17'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a24f'; c.lineWidth = 3; c.strokeRect(14, 14, w - 28, h - 28);
    c.textAlign = 'center'; c.fillStyle = '#f3ead8'; c.font = '900 52px "Playfair Display"'; c.fillText('Credits', w / 2, 100);
    const lines = [['MUSEUM', 'Culture Collective'], ['COURSE', 'MO-HUM080 · H1102 · Group 2'], ['SCHOOL', 'Mapúa Malayan Digital College'],
      ['EXHIBITS', 'Phase 3 workbook entries'], ['IMAGES', 'Credited on each exhibit card'], ['BUILT WITH', 'Three.js · Railway']];
    lines.forEach(([k, v], i) => { c.fillStyle = '#c8a24f'; c.font = '600 20px Inter'; c.fillText(k, w / 2, 190 + i * 105); c.fillStyle = '#e4d9c4'; c.font = '700 30px "Playfair Display"'; c.fillText(v, w / 2, 228 + i * 105); });
  });
  put(plane(4.2, 5.16, credits), 'corridorV', 'east', 63.5, 3.0, 0.06);
  put(eraBanner('lobby', 'Back to the Lobby →', null, 4.4, 0.9, 140), 'corridorH', 'north', 31, 4.6, 0.05);
}

function buildLobby() {
  const s = new THREE.PointLight('#ffe7c2', 30, 40, 1.2); s.position.set(13, 5.8, 70); scene.add(s);
  // A gold floor line leading toward the first doorway.
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 9), new THREE.MeshBasicMaterial({ color: '#c8a24f' }));
  line.rotation.x = -Math.PI / 2; line.position.set(13, 0.01, 65.5); scene.add(line);
}

// ---------------------------------------------------------------------------
// Time-warp doorways
// ---------------------------------------------------------------------------
function portals() {
  const tex = canvasTex(256, 512, (c, w, h) => {
    for (let i = 0; i < 26; i++) {
      const g = c.createLinearGradient(0, 0, 0, h); const hue = 180 + i * 7;
      g.addColorStop(0, `hsla(${hue},100%,70%,0)`); g.addColorStop(.5, `hsla(${hue},100%,70%,.35)`); g.addColorStop(1, `hsla(${hue},100%,70%,0)`);
      c.fillStyle = g; c.fillRect((i * 37) % w, 0, 3 + (i % 4) * 2, h);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  for (const d of DOORS.filter(x => x.to && ['present', 'future', 'final', 'past'].includes(x.to))) {
    const p = plane(d.w, DOOR_H, tex, { transparent: true, additive: true, double: true, opacity: 0.55 });
    if (d.axis === 'z') p.position.set(d.c, DOOR_H / 2, d.at); else { p.position.set(d.at, DOOR_H / 2, d.c); p.rotation.y = Math.PI / 2; }
    scene.add(p);
  }
  animators.push((t, dt) => { tex.offset.x = (tex.offset.x + dt * 0.25) % 1; });
}

const WARP = {
  past: ['Welcome to the 2000s', 'Room 1 · 2000–2010'],
  present: ['Now Trending', 'Room 2 · 2025–2026'],
  future: ['Year 2030', 'Room 3 · Next'],
  final: ['Then · Now · Next', 'Final Room'],
};
export function onEnterRoom(id) {
  if (WARP[id]) {
    const el = document.getElementById('warp');
    el.dataset.era = id;
    el.querySelector('.w1').textContent = WARP[id][0];
    el.querySelector('.w2').textContent = WARP[id][1];
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }
  diwa.onEnter(id);
}

// ---------------------------------------------------------------------------
// DIWA: the 2030 smart-glasses guide (scripted)
// ---------------------------------------------------------------------------
export const DIWA_SCRIPT = {
  greet: 'Hi! Ako si DIWA, your AI guide for 2030. Tara, silipin natin ang future ng Pinoy pop culture!',
  affect: 'Sa left wall, ang mga pakiramdam natin sa 2030: climate, politics at safety. Medyo heavy, pero importante \'to.',
  body: 'Sa right wall naman, fashion at self-image! Spoiler: babalik ang skinny jeans. Cycles talaga ang fashion, \'no?',
  performance: 'Sa harap mo, ang performance ng 2030: AI creators, virtual P-pop at immersive storyworlds. Ikaw na ang part ng show!',
  wall: 'Bago ka umalis, mag-iwan ng message sa holo wall. Ano sa tingin mo ang mangyayari sa 2030?',
  bye: 'Salamat sa pagsama! Tatanggalin ko na ang glasses pagpasok mo sa Final Room. Ingat!',
};
const diwa = {
  asked: false, on: false, said: new Set(), timer: 0,
  onEnter(id) {
    if (id === 'future' && !this.asked) { this.asked = true; ui.modal('glasses'); }
    if (id === 'final' && this.on) { this.say('bye'); setTimeout(() => this.set(false), 4500); }
  },
  set(on) {
    this.on = on;
    document.getElementById('glasses').classList.toggle('hidden', !on);
    document.getElementById('btn-glasses').classList.toggle('on', on);
    if (on) { this.said.clear(); this._t = 0; this.say('greet'); }
  },
  say(key) {
    if (!this.on || this.said.has(key)) return;
    this.said.add(key);
    const b = document.getElementById('diwa-text');
    b.textContent = DIWA_SCRIPT[key];
    const box = document.getElementById('diwa');
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    clearTimeout(this.timer); this.timer = setTimeout(() => box.classList.remove('show'), 7000);
  },
  tick(p) {
    if (!this.on || p.x < 26 || p.z > 30) return;
    if (this.said.has('greet') && Date.now() - (this._t ||= Date.now()) < 5000) return;
    if (p.z < 7 && p.x > 29) this.say('affect');
    else if (p.z > 22 && p.x < 44) this.say('body');
    else if (p.x > 45 && p.z < 22) this.say('performance');
    else if (p.x > 42 && p.z > 22) this.say('wall');
  },
};
export const glasses = diwa;

// ---------------------------------------------------------------------------
export function decorate(ctx) {
  ({ scene, animators, clickables, camera, ui } = ctx);
  for (const id of ['past', 'present', 'future']) memorialWall(id);
  buildLobby(); buildPast(); buildPresent(); buildFuture(); buildFinal(); buildCorridor(); portals();
  animators.push(() => diwa.tick(camera.position));
}
