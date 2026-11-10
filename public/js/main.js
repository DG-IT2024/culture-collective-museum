// Culture Collective: the walkable museum (Phase 1 core).
import * as THREE from 'three';
import { H, EYE, ROOMS, SPAWNS, buildShell, wallPoint, moveWithCollision, roomAt, obstacles, SLOTS } from './world.js';
import { canvasTex, wrapLines, roundRect } from './util.js';
import { setRoom as setSoundRoom, whoosh, setEnabled as setSound, isEnabled as soundOn, wantsSound } from './audio.js';
import { initExtras, openTrivia, openPassport, takePhoto } from './extras.js';
import { initFreedom, open as openWall, refresh as refreshWall } from './freedom.js';
import { lookFor, SKY, frameStyle, labelTexture, decorateExhibit, eraBanner, decorate, onEnterRoom, glasses } from './vibes.js';

const DATA = window.CC_DATA;
const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1c1916');
scene.fog = new THREE.Fog('#1c1916', 12, 55);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
camera.rotation.order = 'YXZ';
const hemi = new THREE.HemisphereLight('#ffffff', '#5a5048', 1.0);
scene.add(hemi);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

export const clickables = [];
export const animators = [];

// ---------------------------------------------------------------------------
// Room looks come from vibes.js (era surfaces, sky/fog per room).
// ---------------------------------------------------------------------------
buildShell(scene, lookFor);

// ---------------------------------------------------------------------------
// Exhibits
// ---------------------------------------------------------------------------
const texLoader = new THREE.TextureLoader();
export const exhibits = []; // { room, aspect, item, idx, mesh, tex }
let loadedCount = 0, toLoad = 0;
function progress() {
  const el = $('loading');
  if (el) el.textContent = loadedCount >= toLoad ? 'Ready' : `Loading exhibits… ${loadedCount}/${toLoad}`;
  if (loadedCount >= toLoad) $('btn-enter').disabled = false;
}

function addExhibit(room, aspect, item, idx, slot) {
  const along = slot.along[idx];
  const style = frameStyle(room.id, aspect.key, idx);
  const { pos, rotY } = wallPoint(room.id, slot.side, along, 2.85, style.out || 0.12);
  const g = new THREE.Group();
  g.position.copy(pos); g.rotation.y = rotY; scene.add(g);

  const frameMat = style.holo
    ? new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.85 })
    : new THREE.MeshStandardMaterial({ color: style.color, roughness: style.rough, metalness: style.metal });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.08), frameMat);
  frame.position.z = 0.0; g.add(frame);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#444' }));
  pic.position.z = 0.05; g.add(pic);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.51), new THREE.MeshBasicMaterial({ map: labelTexture(room.id, item, aspect, isTouch) }));
  label.position.set(0, -1.6, 0.03); g.add(label);

  const ex = { room, aspect, item, idx, group: g, frame, pic, label, tex: null };
  exhibits.push(ex);
  for (const m of [pic, frame, label]) { m.userData = { type: 'exhibit', ex }; clickables.push(m); }

  toLoad++;
  texLoader.load(item.img, tex => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
    const a = tex.image.width / tex.image.height;
    let w = slot.maxW, h = w / a;
    if (h > slot.maxH) { h = slot.maxH; w = h * a; }
    pic.material = new THREE.MeshBasicMaterial({ map: tex });
    pic.scale.set(w, h, 1);
    frame.scale.set(w + style.border * 2, h + style.border * 2, 1);
    label.position.y = -h / 2 - 0.5;
    ex.tex = tex; ex.size = { w, h };
    decorateExhibit(ex, style);
    loadedCount++; progress();
  }, undefined, () => { loadedCount++; progress(); });
}

// Big text banners (room titles, wall headings).
export function banner(text, sub, w, h, style = {}) {
  const px = style.px || 200;
  const tex = canvasTex(Math.round(px * w / h), px, (c, cw, ch) => {
    c.fillStyle = style.bg || '#1f1b17'; c.fillRect(0, 0, cw, ch);
    if (style.border !== false) { c.strokeStyle = style.accent || '#c8a24f'; c.lineWidth = Math.max(4, ch * 0.03); c.strokeRect(ch * 0.06, ch * 0.06, cw - ch * 0.12, ch - ch * 0.12); }
    c.fillStyle = style.color || '#f3ead8'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${style.weight || 900} ${ch * (sub ? 0.36 : 0.42)}px ${style.font || '"Playfair Display", Georgia, serif'}`;
    c.fillText(text, cw / 2, ch * (sub ? 0.42 : 0.52));
    if (sub) { c.font = `600 ${ch * 0.14}px Inter, sans-serif`; c.fillStyle = style.accent || '#c8a24f'; c.fillText(sub.toUpperCase(), cw / 2, ch * 0.76); }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

function placeOnWall(mesh, roomId, side, along, y, out = 0.06) {
  const { pos, rotY } = wallPoint(roomId, side, along, y, out);
  mesh.position.copy(pos); mesh.rotation.y = rotY; scene.add(mesh); return mesh;
}

for (const room of DATA.rooms) {
  const slots = SLOTS[room.id];
  room.aspects.forEach(aspect => aspect.items.forEach((item, idx) => addExhibit(room, aspect, item, idx, slots[aspect.key])));
}
progress();

// Room title signs above each doorway, seen as you approach.
[
  ['lobby', 'north', 13, '2000–2010', 'Room 1 · Then', 'past'],
  ['past', 'north', 13, '2025–2026', 'Room 2 · Now', 'present'],
  ['present', 'east', 3, '2030', 'Room 3 · Next', 'future'],
  ['future', 'south', 49, 'Final Room', 'Then · Now · Next', 'lobby'],
].forEach(([room, side, along, t, s, style]) => {
  placeOnWall(eraBanner(style, t, s, 3.8, 1.1, 160), room, side, along, 4.85, 0.04);
});

// ---------------------------------------------------------------------------
// Lobby: rotating logo, welcome wall, curators
// ---------------------------------------------------------------------------
{
  const cx = 13, cz = 75;
  const logoTex = canvasTex(900, 900, (c, w, h) => {
    c.fillStyle = '#1f1b17'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#c8a24f'; c.lineWidth = 14; c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 40, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#c8a24f'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '600 34px Inter, sans-serif'; c.fillText('·  EST. 2026  ·', w / 2, 210);
    c.fillStyle = '#f3ead8'; c.font = '900 138px "Playfair Display", Georgia, serif';
    c.fillText('Culture', w / 2, 390); c.fillText('Collective', w / 2, 530);
    c.fillStyle = '#c8a24f'; c.font = '600 30px Inter, sans-serif';
    c.fillText('THEN  ·  NOW  ·  NEXT', w / 2, 680);
  });
  logoTex.center.set(0.5, 0.5); logoTex.rotation = Math.PI / 2; // cylinder caps map UVs sideways
  const logo = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.16, 64),
    [new THREE.MeshStandardMaterial({ color: '#c8a24f', metalness: 0.7, roughness: 0.3 }),
     new THREE.MeshBasicMaterial({ map: logoTex }), new THREE.MeshBasicMaterial({ map: logoTex })]);
  disc.rotation.x = Math.PI / 2; logo.add(disc);
  logo.position.set(cx, 2.6, cz); scene.add(logo);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.0, 48), new THREE.MeshStandardMaterial({ color: '#efe7d8', roughness: 0.5 }));
  plinth.position.set(cx, 0.5, cz); scene.add(plinth);
  const spot = new THREE.PointLight('#ffe7b8', 18, 9, 1.5); spot.position.set(cx, 5, cz + 2); scene.add(spot);
  obstacles.push({ x: cx, z: cz, r: 1.2 });
  animators.push(t => { logo.rotation.y = t * 0.35; logo.position.y = 2.6 + Math.sin(t * 0.8) * 0.06; });

  // Welcome wall (west).
  const site = DATA.site;
  const welcome = canvasTex(1260, 900, (c, w, h) => {
    c.fillStyle = '#1f1b17'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c8a24f'; c.lineWidth = 4; c.strokeRect(18, 18, w - 36, h - 36);
    c.textBaseline = 'top'; c.fillStyle = '#c8a24f'; c.font = '600 22px Inter, sans-serif';
    c.fillText(site.course.toUpperCase(), 70, 70);
    c.fillStyle = '#f3ead8'; c.font = '900 76px "Playfair Display", Georgia, serif'; c.fillText('Welcome', 70, 110);
    c.font = '400 30px Inter, sans-serif'; c.fillStyle = '#e4d9c4';
    let y = 230;
    for (const p of site.welcome) { for (const l of wrapLines(c, p, w - 140)) { c.fillText(l, 70, y); y += 42; } y += 22; }
  });
  const ww = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 6), new THREE.MeshBasicMaterial({ map: welcome }));
  placeOnWall(ww, 'lobby', 'west', 75, 3.2);

  // Curators (east wall, away from the corridor door at z 67–73).
  const cur = canvasTex(1100, 1000, (c, w, h) => {
    c.fillStyle = '#ebe3d4'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#1f1b17'; c.font = '900 64px "Playfair Display", Georgia, serif'; c.fillText('Curated by', w / 2, 90);
    c.fillStyle = '#8a7a5c'; c.font = '600 20px Inter, sans-serif'; c.fillText(site.school.toUpperCase(), w / 2, 150);
    site.curators.forEach((name, i) => {
      const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4;
      const x = col === 0 ? w * 0.27 : w * 0.73, y = 260 + row * 175 + (col === 1 ? 88 : 0);
      const pw = 440, ph = 130;
      const g = c.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
      g.addColorStop(0, '#b8913f'); g.addColorStop(0.5, '#e6cb84'); g.addColorStop(1, '#b8913f');
      c.fillStyle = g; roundRect(c, x - pw / 2, y - ph / 2, pw, ph, 10); c.fill();
      c.strokeStyle = '#7d6024'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#2a2010'; c.font = '700 30px "Playfair Display", Georgia, serif'; c.fillText(name, x, y - 14);
      c.font = '600 18px Inter, sans-serif'; c.fillStyle = '#4a3a18'; c.fillText('CURATOR', x, y + 28);
    });
  });
  const cw = new THREE.Mesh(new THREE.PlaneGeometry(7.7, 7), new THREE.MeshBasicMaterial({ map: cur }));
  placeOnWall(cw, 'lobby', 'east', 82, 3.3);
}

// ---------------------------------------------------------------------------
// UI state, cards, map
// ---------------------------------------------------------------------------
let state = 'start'; // start | playing | paused | card
let yaw = 0, pitch = 0;
const keys = {};

function setState(s) {
  state = s;
  document.querySelectorAll('.overlay[data-state]').forEach(el => el.classList.toggle('hidden', el.dataset.state !== s));
  $('hud').classList.toggle('hidden', s === 'start');
  $('joy').classList.toggle('hidden', !(s === 'playing' && isTouch));
  $('lookhint').classList.toggle('hidden', !(s === 'playing' && isTouch));
  $('crosshair').classList.toggle('hidden', isTouch);
  if (s !== 'playing') for (const k in keys) keys[k] = false;
}
function lock() { if (isTouch) return; try { const p = canvas.requestPointerLock(); p?.catch?.(() => {}); } catch {} }
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
function play() { setState('playing'); lock(); }

function teleport(id) { const s = SPAWNS[id]; camera.position.set(s.x, EYE, s.z); yaw = s.yaw; pitch = 0; }
teleport('lobby');

$('btn-enter').onclick = () => { if (wantsSound()) setSound(true); play(); updateRoom(true); };
$('btn-sound').onclick = () => setSound(!soundOn());
$('btn-resume').onclick = play;
$('btn-map').onclick = () => { unlock(); setState('paused'); };
// Smart glasses (2030): asked once on entering the room; the HUD button toggles them later.
$('glasses-yes').onclick = () => { glasses.set(true); play(); };
$('glasses-no').onclick = () => { glasses.set(false); play(); };
$('btn-glasses').onclick = () => glasses.set(!glasses.on);
const ui = { modal(name) { unlock(); setState(name); }, play: () => play(), toast: (a, b) => toast(a, b) };

document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state === 'playing' && !isTouch) setState('paused'); });

for (const id of ['lobby', 'past', 'present', 'future', 'final']) {
  const r = ROOMS.find(x => x.id === id);
  const b = document.createElement('button');
  b.type = 'button'; b.innerHTML = `${r.name}<small>${r.sub}</small>`;
  b.onclick = () => { teleport(id); play(); };
  $('maplist').appendChild(b);
}

let cardEx = null;
function openCard(ex) {
  cardEx = ex;
  const { item, aspect, room } = ex;
  $('card-img').src = item.img; $('card-img').alt = item.title;
  $('card-kicker').textContent = `${room.years} · ${aspect.label}`;
  $('card-title').textContent = item.title;
  $('card-meta').textContent = [item.year, `Curator: ${item.curator}`].filter(Boolean).join(' · ');
  const t = $('card-text'); t.innerHTML = '';
  for (const p of item.text.split(/\n+/)) if (p.trim()) { const el = document.createElement('p'); el.textContent = p; t.appendChild(el); }
  $('card-credit').textContent = item.credit || '';
  unlock(); setState('card');
}
function stepCard(d) {
  const list = exhibits.filter(e => e.room === cardEx.room);
  openCard(list[(list.indexOf(cardEx) + d + list.length) % list.length]);
}
$('card-prev').onclick = () => stepCard(-1);
$('card-next').onclick = () => stepCard(1);
$('card-close').onclick = play;

function interact(obj) {
  const d = obj?.userData;
  if (d?.type === 'exhibit') openCard(d.ex);
  else if (d?.type === 'wall') openWall(d.room);
  else if (d?.type === 'trivia') openTrivia(d.era);
  else if (d?.type === 'passport') openPassport();
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state === 'playing' && e.code === 'KeyE') interact(target);
  if (state === 'playing' && e.code === 'KeyP') takePhoto();
  if (e.code === 'KeyM') { if (state === 'playing') { unlock(); setState('paused'); } else if (state === 'paused') play(); }
  if (state === 'card') {
    if (e.code === 'ArrowRight') stepCard(1);
    if (e.code === 'ArrowLeft') stepCard(-1);
    if (e.code === 'Escape' || e.code === 'KeyE') play();
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousemove', e => {
  if (state !== 'playing' || document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0022; pitch = Math.max(-1.3, Math.min(1.3, pitch - e.movementY * 0.0022));
});
canvas.addEventListener('click', () => {
  if (isTouch || state !== 'playing') return;
  if (document.pointerLockElement !== canvas) lock(); else interact(target);
});

// Touch: left joystick to walk, drag elsewhere to look, tap to open.
const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
const looks = new Map();
const joyEl = $('joy'), knob = joyEl.querySelector('i');
joyEl.addEventListener('touchstart', e => {
  const t = e.changedTouches[0], r = joyEl.getBoundingClientRect();
  joy.id = t.identifier; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchstart', e => {
  if (state !== 'playing') return;
  for (const t of e.changedTouches) looks.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now() });
  e.preventDefault();
}, { passive: false });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy; const m = Math.hypot(dx, dy), max = 48;
      if (m > max) { dx *= max / m; dy *= max / m; }
      joy.x = dx / max; joy.y = dy / max; knob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (looks.has(t.identifier) && state === 'playing') {
      const l = looks.get(t.identifier);
      yaw -= (t.clientX - l.x) * 0.006; pitch = Math.max(-1.2, Math.min(1.2, pitch - (t.clientY - l.y) * 0.006));
      l.x = t.clientX; l.y = t.clientY;
    }
  }
}, { passive: true });
function touchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
    const l = looks.get(t.identifier);
    if (!l) continue;
    looks.delete(t.identifier);
    if (state === 'playing' && Math.hypot(t.clientX - l.sx, t.clientY - l.sy) < 10 && performance.now() - l.t < 350) {
      interact(pick(new THREE.Vector2(t.clientX / innerWidth * 2 - 1, -(t.clientY / innerHeight) * 2 + 1), 10));
    }
  }
}
addEventListener('touchend', touchEnd);
addEventListener('touchcancel', touchEnd);

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const ray = new THREE.Raycaster();
function pick(ndc, far = 7) {
  ray.setFromCamera(ndc, camera); ray.far = far;
  return ray.intersectObjects(clickables, false)[0]?.object || null;
}

let currentRoom = null, toastTimer;
function toast(t1, t2) {
  const el = $('toast');
  el.querySelector('.t1').textContent = t1; el.querySelector('.t2').textContent = t2;
  el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
function updateRoom(force) {
  const r = roomAt(camera.position.x, camera.position.z);
  if (!r || (r.name === currentRoom?.name && !force)) { if (r) currentRoom = r; return; }
  const prev = currentRoom;
  currentRoom = r;
  $('room').innerHTML = `<b>${r.name}</b><span>${r.sub}</span>`;
  setSoundRoom(r.id);
  if (['past', 'present', 'future', 'final'].includes(r.id) && prev?.id !== r.id && prev) whoosh();
  $('btn-glasses').classList.toggle('hidden', r.id !== 'future');
  if (['past', 'present', 'future', 'final'].includes(r.id)) { if (prev?.id !== r.id) { onEnterRoom(r.id); if (r.id !== 'final') refreshWall(r.id); } }
  else toast(r.id === 'lobby' ? 'Culture Collective' : r.name, r.sub);
}

let target = null;
const clock = new THREE.Clock();
const vel = new THREE.Vector2();
const bgTo = new THREE.Color();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (state === 'playing') {
    let fx = 0, fz = 0;
    if (keys.KeyW || keys.ArrowUp) fz -= 1;
    if (keys.KeyS || keys.ArrowDown) fz += 1;
    if (keys.KeyA || keys.ArrowLeft) fx -= 1;
    if (keys.KeyD || keys.ArrowRight) fx += 1;
    if (joy.id !== null) { fx += joy.x; fz += joy.y; }
    const len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; }
    const speed = keys.ShiftLeft || keys.ShiftRight ? 8 : 4.2;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const k = Math.min(1, dt * 10);
    vel.x += ((fx * c + fz * s) * speed - vel.x) * k;
    vel.y += ((-fx * s + fz * c) * speed - vel.y) * k;
    moveWithCollision(camera.position, vel.x * dt, vel.y * dt);
    camera.position.y = EYE + Math.sin(t * 9) * 0.025 * Math.min(1, vel.length() / 4);
    updateRoom();
  }
  camera.rotation.set(pitch, yaw, 0);

  const look = SKY[currentRoom?.id || 'lobby'];
  bgTo.set(look.bg);
  hemi.intensity += (look.hemi - hemi.intensity) * Math.min(1, dt * 2.5);
  const k2 = Math.min(1, dt * 2.5);
  scene.background.lerp(bgTo, k2); scene.fog.color.copy(scene.background);
  scene.fog.near += (look.fog[0] - scene.fog.near) * k2; scene.fog.far += (look.fog[1] - scene.fog.far) * k2;

  if (state === 'playing' && !isTouch) {
    target = pick(new THREE.Vector2(0, 0));
    const d = target?.userData;
    $('crosshair').classList.toggle('on', !!d);
    $('hint').classList.toggle('hidden', !d);
    if (d?.type === 'exhibit') $('hint').textContent = `E · ${d.ex.item.title}`;
    else if (d?.type === 'wall') $('hint').textContent = 'E · Freedom Wall: read & post';
    else if (d?.type === 'trivia') $('hint').textContent = 'E · Answer trivia for a passport stamp';
    else if (d?.type === 'passport') $('hint').textContent = 'E · Passport check-out';
  } else $('hint').classList.add('hidden');

  for (const a of animators) a(t, dt);
  renderer.render(scene, camera);
});

decorate({ scene, animators, clickables, camera, ui });
initFreedom({ scene, animators, clickables, ui, currentRoom: () => currentRoom?.id });
initExtras({ scene, animators, clickables, ui, camera, renderer, teleport, getYaw: () => yaw,
  renderNow: () => renderer.render(scene, camera), currentRoom: () => currentRoom?.id || 'lobby', currentRoomName: () => currentRoom?.name || 'Lobby' });

if (isTouch) { $('controls-desktop').classList.add('hidden'); $('controls-touch').classList.remove('hidden'); }
setState('start');
window.__cc = { camera, teleport, exhibits, setYaw: v => { yaw = v; }, setPitch: v => { pitch = v; }, renderer, scene, openCard, glasses, get state() { return state; } };
