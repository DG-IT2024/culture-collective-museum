// Phase 4: trivia stands + era passport (with a shareable card), mini-map with
// tap-to-teleport, and the photo button.
import * as THREE from 'three';
import { ROOMS, obstacles } from './world.js';
import { canvasTex, wrapLines, roundRect } from './util.js';

const $ = id => document.getElementById(id);
const SITE = () => window.CC_DATA.site;
let ctx;

// ---------------------------------------------------------------------------
// Passport state (kept in this browser)
// ---------------------------------------------------------------------------
const ERAS = ['past', 'present', 'future'];
const ERA_NAME = { past: '2000–2010', present: '2025–2026', future: '2030' };
const KEY = 'cc.passport';
let stamps = {};
try { stamps = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { stamps = {}; }
function saveStamps() { try { localStorage.setItem(KEY, JSON.stringify(stamps)); } catch {} }
const stampCount = () => ERAS.filter(e => stamps[e]).length;

function updateChip() {
  const el = $('passport-chip');
  el.innerHTML = `<b>Passport</b> ${ERAS.map(e => `<i class="${stamps[e] ? 'on' : ''}" data-era="${e}" title="${ERA_NAME[e]}"></i>`).join('')}`;
}

// ---------------------------------------------------------------------------
// 3D props: trivia stands and the passport desk
// ---------------------------------------------------------------------------
const STANDS = {
  past: { x: 17, z: 34.5, rotY: 0, col: '#ff5fb8', title: '2000s Trivia' },
  present: { x: 21.5, z: 6.8, rotY: -Math.PI / 2, col: '#fe2c55', title: 'Now Trivia' },
  future: { x: 49, z: 23.5, rotY: Math.PI, col: '#00e5ff', title: '2030 Trivia' },
};

function standTex(title, sub, col, font) {
  return canvasTex(512, 340, (c, w, h) => {
    c.fillStyle = '#16120f'; roundRect(c, 4, 4, w - 8, h - 8, 26); c.fill();
    c.strokeStyle = col; c.lineWidth = 8; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = col; c.font = `600 26px Inter`; c.fillText('PASSPORT STAMP', w / 2, 62);
    c.fillStyle = '#fff'; c.font = font; c.fillText(title, w / 2, 140);
    c.fillStyle = '#d9cfbd'; c.font = '500 26px Inter';
    wrapLines(c, sub, w - 60, 2).forEach((l, i) => c.fillText(l, w / 2, 220 + i * 34));
  });
}

function addStand(era) {
  const s = STANDS[era];
  const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.rotY;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.5), new THREE.MeshStandardMaterial({ color: '#1f1b17', roughness: 0.5 }));
  post.position.y = 0.52; g.add(post);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.56), new THREE.MeshBasicMaterial({ color: s.col })); rim.position.y = 1.07; g.add(rim);
  const font = era === 'past' ? '44px Bungee' : era === 'future' ? '800 42px Orbitron' : '800 46px Inter';
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.86),
    new THREE.MeshBasicMaterial({ map: standTex(s.title, matchMedia('(pointer: coarse)').matches ? 'Tap to answer one question' : 'Click here to answer one question', s.col, font) }));
  screen.position.set(0, 1.55, 0.05); screen.rotation.x = -0.25; g.add(screen);
  ctx.scene.add(g);
  obstacles.push({ x: s.x, z: s.z, r: 0.55 });
  for (const m of [post, screen]) { m.userData = { type: 'trivia', era }; ctx.clickables.push(m); }
}

function addDesk() {
  const g = new THREE.Group(); g.position.set(49.6, 0, 42.5); g.rotation.y = -Math.PI / 2;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 0.9), new THREE.MeshStandardMaterial({ color: '#efe7d8', roughness: 0.4 }));
  desk.position.y = 0.52; g.add(desk);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.06, 0.96), new THREE.MeshStandardMaterial({ color: '#c8a24f', metalness: 0.7, roughness: 0.3 }));
  trim.position.y = 1.07; g.add(trim);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.9), new THREE.MeshBasicMaterial({ map: canvasTex(1000, 300, (c, w, h) => {
    c.fillStyle = '#1f1b17'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a24f'; c.lineWidth = 6; c.strokeRect(12, 12, w - 24, h - 24);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f3ead8'; c.font = '900 72px "Playfair Display"'; c.fillText('Passport Check-out', w / 2, 120);
    c.fillStyle = '#c8a24f'; c.font = '600 30px Inter'; c.fillText('COLLECT YOUR CULTURE COLLECTIVE PASSPORT', w / 2, 210);
  }) }));
  sign.position.set(0, 1.6, -0.25); g.add(sign); // sits right above the desk, at eye level
  ctx.scene.add(g);
  const lamp = new THREE.PointLight('#ffe2b0', 16, 7, 1.5); lamp.position.set(47.6, 3.2, 42.5); ctx.scene.add(lamp);
  obstacles.push({ x: 49.6, z: 41.3, r: 0.75 }, { x: 49.6, z: 42.5, r: 0.75 }, { x: 49.6, z: 43.7, r: 0.75 });
  for (const m of [desk, sign]) { m.userData = { type: 'passport' }; ctx.clickables.push(m); }
}

// ---------------------------------------------------------------------------
// Trivia
// ---------------------------------------------------------------------------
let trivia = null;
export function openTrivia(era) {
  const q = SITE().trivia[era];
  const correct = q.choices[0];
  const choices = [...q.choices].sort(() => Math.random() - 0.5);
  trivia = { era, correct, wrong: 0 };
  const el = $('trivia-overlay'); el.dataset.era = era;
  $('trivia-kicker').textContent = `${ERA_NAME[era]} · Passport stamp`;
  $('trivia-q').textContent = q.q;
  $('trivia-feedback').textContent = stamps[era] ? 'You already have this stamp. Answer again for fun!' : 'Answer correctly to earn this room\'s stamp.';
  const box = $('trivia-choices'); box.innerHTML = '';
  choices.forEach(ch => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.textContent = ch;
    b.onclick = () => answer(b, ch);
    box.appendChild(b);
  });
  $('trivia-done').textContent = 'Back to the museum';
  ctx.ui.modal('trivia');
}
function answer(btn, ch) {
  if (!trivia || trivia.finished) return;
  if (ch === trivia.correct) {
    btn.classList.add('right'); finishTrivia(`Tama! You earned the ${ERA_NAME[trivia.era]} stamp.`);
  } else {
    btn.classList.add('wrong'); btn.disabled = true; trivia.wrong++;
    if (trivia.wrong >= 2) {
      [...$('trivia-choices').children].forEach(b => { if (b.textContent === trivia.correct) b.classList.add('right'); });
      finishTrivia(`The answer is "${trivia.correct}". Nice try! Here's your stamp anyway.`);
    } else $('trivia-feedback').textContent = 'Not quite. Try one more time! (Hint: check the exhibit labels.)';
  }
}
function finishTrivia(msg) {
  trivia.finished = true;
  [...$('trivia-choices').children].forEach(b => { b.disabled = true; });
  const was = stamps[trivia.era];
  stamps[trivia.era] = stamps[trivia.era] || new Date().toISOString(); saveStamps(); updateChip();
  $('trivia-feedback').textContent = msg + (stampCount() === 3 && !was ? ' Passport complete! Collect it at the Final Room desk.' : ` (${stampCount()}/3 stamps)`);
}

// ---------------------------------------------------------------------------
// Passport card
// ---------------------------------------------------------------------------
function stampArt(c, x, y, r, era, on) {
  c.save(); c.translate(x, y); c.rotate(on ? (era === 'past' ? -0.18 : era === 'present' ? 0.12 : -0.06) : 0);
  if (!on) {
    c.setLineDash([14, 12]); c.strokeStyle = 'rgba(243,234,216,.35)'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(243,234,216,.4)'; c.font = '600 30px Inter'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ERA_NAME[era], 0, 0);
    c.restore(); return;
  }
  const col = { past: '#ff5fb8', present: '#fe2c55', future: '#00e5ff' }[era];
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
  c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r - 16, 0, 7); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (era === 'past') { c.font = '40px Bungee'; c.fillText('2000s', 0, -18); c.font = '30px VT323'; c.fillText('~*~ THEN ~*~', 0, 26); }
  if (era === 'present') { c.font = '800 44px Inter'; c.fillStyle = '#25f4ee'; c.fillText('NOW', -3, -14); c.fillStyle = col; c.fillText('NOW', 3, -10); c.font = '700 24px Inter'; c.fillText('2025–2026', 0, 34); }
  if (era === 'future') { c.font = '800 46px Orbitron'; c.fillText('2030', 0, -12); c.font = '500 20px Orbitron'; c.fillText('NEXT', 0, 32); }
  c.restore();
}

function makeCard(nick) {
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350;
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  c.fillStyle = '#1c1916'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#c8a24f'; c.lineWidth = 10; c.strokeRect(40, 40, w - 80, h - 80);
  c.lineWidth = 2; c.strokeRect(62, 62, w - 124, h - 124);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#c8a24f'; c.font = '600 30px Inter'; c.fillText('·  EST. 2026  ·', w / 2, 150);
  c.fillStyle = '#f3ead8'; c.font = '900 120px "Playfair Display"'; c.fillText('Culture', w / 2, 260); c.fillText('Collective', w / 2, 380);
  c.fillStyle = '#c8a24f'; c.font = '700 44px Inter'; c.fillText('P A S S P O R T', w / 2, 480);
  c.fillStyle = '#b5aa97'; c.font = '600 28px Inter'; c.fillText('ISSUED TO', w / 2, 570);
  c.fillStyle = '#f3ead8'; c.font = 'italic 900 76px "Playfair Display"';
  let size = 76; while (c.measureText(nick).width > w - 220 && size > 36) { size -= 4; c.font = `italic 900 ${size}px "Playfair Display"`; }
  c.fillText(nick, w / 2, 640);
  ERAS.forEach((e, i) => stampArt(c, 250 + i * 290, 860, 118, e, !!stamps[e]));
  c.fillStyle = '#b5aa97'; c.font = '600 26px Inter';
  c.fillText(`Visited ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`, w / 2, 1060);
  c.fillStyle = '#c8a24f'; c.font = '700 34px Inter'; c.fillText('#CultureCollective', w / 2, 1150);
  c.fillStyle = '#8a7f6e'; c.font = '500 22px Inter'; c.fillText('Then · Now · Next  ·  ' + SITE().course, w / 2, 1210);
  return cv.toDataURL('image/png');
}

export function openPassport() {
  const n = stampCount();
  $('passport-status').textContent = n === 3
    ? 'All three stamps collected! Enter your name for the card.'
    : `You have ${n} of 3 stamps. Answer the trivia stand near each era room's exit to collect the rest.`;
  $('passport-missing').innerHTML = ERAS.map(e => `<li class="${stamps[e] ? 'on' : ''}">${stamps[e] ? '✓' : '○'} ${ERA_NAME[e]}</li>`).join('');
  $('passport-form').classList.toggle('hidden', n < 3);
  $('passport-result').classList.add('hidden');
  try { $('passport-nick').value = $('passport-nick').value || localStorage.getItem('cc.nick') || ''; } catch {}
  ctx.ui.modal('passport');
}

// ---------------------------------------------------------------------------
// Photo button
// ---------------------------------------------------------------------------
export function takePhoto() {
  const src = ctx.renderer.domElement;
  ctx.renderNow();
  const pad = Math.round(src.width * 0.035), bar = Math.round(src.width * 0.09);
  const cv = document.createElement('canvas'); cv.width = src.width + pad * 2; cv.height = src.height + pad + bar;
  const c = cv.getContext('2d');
  c.fillStyle = '#f3ead8'; c.fillRect(0, 0, cv.width, cv.height);
  c.drawImage(src, pad, pad);
  c.strokeStyle = '#c8a24f'; c.lineWidth = Math.max(2, pad * 0.12); c.strokeRect(pad, pad, src.width, src.height);
  const y = src.height + pad + bar / 2;
  c.fillStyle = '#1c1916'; c.textBaseline = 'middle';
  c.font = `900 ${Math.round(bar * 0.42)}px "Playfair Display"`; c.textAlign = 'left'; c.fillText('Culture Collective', pad, y);
  c.fillStyle = '#8a7a5c'; c.textAlign = 'right'; c.font = `600 ${Math.round(bar * 0.2)}px Inter`;
  const room = ctx.currentRoomName();
  c.fillText(`${room}  ·  #CultureCollective`, cv.width - pad, y);
  const url = cv.toDataURL('image/jpeg', 0.92);
  $('photo-img').src = url;
  $('photo-download').href = url;
  $('photo-download').download = `culture-collective-${room.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;
  ctx.ui.modal('photo');
}

// ---------------------------------------------------------------------------
// Mini-map (HUD) and big map (pause menu), both tap-to-teleport
// ---------------------------------------------------------------------------
const MAP_W = 52, MAP_H = 90;
const ROOM_FILL = { lobby: '#c8a24f', past: '#ff7ac6', present: '#fe2c55', future: '#00b8d4', final: '#e6c376', corridorV: '#6b5a4c', corridorH: '#6b5a4c' };
function drawMap(cv, highlight) {
  const c = cv.getContext('2d'), s = cv.width / MAP_W;
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = 'rgba(20,17,14,.72)'; roundRect(c, 0, 0, cv.width, cv.height, 10); c.fill();
  for (const r of ROOMS) {
    const on = highlight === r.id;
    c.fillStyle = ROOM_FILL[r.id]; c.globalAlpha = on ? 0.95 : 0.55;
    c.fillRect(r.x0 * s + 1, r.z0 * s + 1, (r.x1 - r.x0) * s - 2, (r.z1 - r.z0) * s - 2);
    c.globalAlpha = 1;
    if (!r.corridor && cv.width > 100) {
      c.fillStyle = '#16120f'; c.font = `700 ${Math.max(9, s * 3)}px Inter`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const label = { lobby: 'Lobby', past: '2000s', present: 'Now', future: '2030', final: 'Final' }[r.id];
      c.fillText(label, (r.x0 + r.x1) / 2 * s, (r.z0 + r.z1) / 2 * s);
    }
  }
  const p = ctx.camera.position, yaw = ctx.getYaw();
  const px = p.x * s, pz = p.z * s, fx = -Math.sin(yaw), fz = -Math.cos(yaw), L = Math.max(7, s * 2.6);
  c.fillStyle = '#ffffff'; c.strokeStyle = '#16120f'; c.lineWidth = 2; c.beginPath();
  c.moveTo(px + fx * L, pz + fz * L);
  c.lineTo(px - fx * L * 0.6 + fz * L * 0.55, pz - fz * L * 0.6 - fx * L * 0.55);
  c.lineTo(px - fx * L * 0.6 - fz * L * 0.55, pz - fz * L * 0.6 + fx * L * 0.55);
  c.closePath(); c.fill(); c.stroke();
}
function mapClick(cv, e) {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * MAP_W, z = (e.clientY - r.top) / r.height * MAP_H;
  const room = ROOMS.find(q => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
  if (!room) return;
  const id = room.corridor ? 'lobby' : room.id;
  ctx.teleport(id); ctx.ui.play();
}

// ---------------------------------------------------------------------------
function buildDom() {
  const add = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstChild; document.body.appendChild(el); return el; };
  add(`<div id="trivia-overlay" class="overlay hidden" data-state="trivia"><div class="panel trivia-panel" role="dialog" aria-modal="true" aria-labelledby="trivia-q">
    <p class="kicker" id="trivia-kicker"></p><h2 id="trivia-q"></h2>
    <div class="choices" id="trivia-choices"></div><p class="feedback" id="trivia-feedback" role="status"></p>
    <div class="row"><button class="btn" id="trivia-done" type="button"></button></div></div></div>`);
  add(`<div id="passport-overlay" class="overlay hidden" data-state="passport"><div class="panel" role="dialog" aria-modal="true" aria-labelledby="passport-title">
    <p class="kicker">Final Room · Check-out</p><h2 id="passport-title">Your Culture Collective Passport</h2>
    <p id="passport-status"></p><ul class="stamplist" id="passport-missing"></ul>
    <form id="passport-form" class="hidden"><input id="passport-nick" maxlength="30" placeholder="Your name or nickname" aria-label="Name for your passport">
      <div class="row"><button class="btn" type="submit">Make my passport</button></div></form>
    <div id="passport-result" class="hidden"><img id="passport-img" alt="Your Culture Collective passport card">
      <div class="row"><a class="btn" id="passport-download" download="culture-collective-passport.png">Download card</a></div></div>
    <div class="row"><button class="btn ghost" id="passport-close" type="button">Back to the museum</button></div></div></div>`);
  add(`<div id="photo-overlay" class="overlay hidden" data-state="photo"><div class="panel photo-panel" role="dialog" aria-modal="true" aria-label="Your photo">
    <p class="kicker">Photo mode</p><img id="photo-img" alt="Your photo from Culture Collective">
    <div class="row"><a class="btn" id="photo-download" download="culture-collective.jpg">Download photo</a><button class="btn ghost" id="photo-close" type="button">Back to the museum</button></div></div></div>`);

  const tools = $('tools');
  const chip = document.createElement('div'); chip.id = 'passport-chip'; tools.prepend(chip);
  const cam = document.createElement('button'); cam.id = 'btn-photo'; cam.type = 'button'; cam.textContent = 'Photo'; cam.title = 'Take a photo (P)';
  tools.insertBefore(cam, $('btn-map'));
  const mini = document.createElement('canvas'); mini.id = 'minimap'; mini.width = 104; mini.height = 180; mini.setAttribute('aria-label', 'Mini-map: tap a room to go there');
  $('hud').appendChild(mini);
  const big = document.createElement('canvas'); big.id = 'bigmap'; big.width = 208; big.height = 360; big.setAttribute('aria-label', 'Museum map: click a room to go there');
  $('maplist').before(big);

  cam.onclick = takePhoto;
  mini.addEventListener('click', e => mapClick(mini, e));
  big.addEventListener('click', e => mapClick(big, e));
  $('trivia-done').onclick = () => ctx.ui.play();
  $('passport-close').onclick = () => ctx.ui.play();
  $('photo-close').onclick = () => ctx.ui.play();
  $('passport-form').onsubmit = e => {
    e.preventDefault();
    const nick = $('passport-nick').value.trim() || 'Museum Visitor';
    try { localStorage.setItem('cc.nick', nick); } catch {}
    const url = makeCard(nick);
    $('passport-img').src = url; $('passport-download').href = url;
    $('passport-download').download = `culture-collective-passport-${nick.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    $('passport-result').classList.remove('hidden');
  };
  for (const id of ['trivia-overlay', 'passport-overlay', 'photo-overlay']) $(id).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') ctx.ui.play(); });
}

export function initExtras(c) {
  ctx = c;
  buildDom(); updateChip();
  for (const e of ERAS) addStand(e);
  addDesk();
  let acc = 0;
  ctx.animators.push((t, dt) => {
    acc += dt; if (acc < 0.1) return; acc = 0;
    const id = ctx.currentRoom();
    drawMap($('minimap'), id);
    if (!$('pause').classList.contains('hidden')) drawMap($('bigmap'), id);
  });
}
