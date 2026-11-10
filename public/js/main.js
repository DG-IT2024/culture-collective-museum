// Culture Collective: the walkable museum (Phase 1 core).
import * as THREE from 'three';
import { H, EYE, ROOMS, DOORS, SPAWNS, buildShell, wallPoint, moveWithCollision, roomAt, walkable, obstacles, SLOTS } from './world.js';
import { canvasTex, wrapLines, roundRect } from './util.js';
import { setRoom as setSoundRoom, whoosh, setEnabled as setSound, isEnabled as soundOn, wantsSound, resume as resumeSound, isBlocked as soundBlocked } from './audio.js';
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
// Lobby: rotating logo, welcome wall, curator statue
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

  // Curator (east wall, away from the corridor door at z 67–73): one marble statue on a plinth.
  {
    const curator = { name: 'Danilo Giltendez', role: 'Curator' };
    const sx = 24.0, sz = 82;
    const marble = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.35, metalness: 0.05 });
    const stone = new THREE.MeshStandardMaterial({ color: '#d6cebf', roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: '#c8a24f', metalness: 0.7, roughness: 0.3 });
    const statue = new THREE.Group(); // built facing local +z, turned to face into the lobby (-x)
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, s) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      if (s) m.scale.set(...s); statue.add(m); return m;
    };
    // Plinth: base, block, cap, with a gold name plate on the front.
    add(new THREE.BoxGeometry(1.25, 0.1, 1.25), stone, 0, 0.05, 0);
    add(new THREE.BoxGeometry(1.0, 0.9, 1.0), stone, 0, 0.55, 0);
    add(new THREE.BoxGeometry(1.15, 0.1, 1.15), stone, 0, 1.05, 0);
    const plate = canvasTex(600, 260, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#b8913f'); g.addColorStop(0.5, '#e6cb84'); g.addColorStop(1, '#b8913f');
      c.fillStyle = g; roundRect(c, 6, 6, w - 12, h - 12, 14); c.fill();
      c.strokeStyle = '#7a5f24'; c.lineWidth = 3; roundRect(c, 20, 20, w - 40, h - 40, 8); c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#2a2010'; c.font = '700 54px "Playfair Display", Georgia, serif'; c.fillText(curator.name, w / 2, h / 2 - 22);
      c.fillStyle = '#4a3a18'; c.font = '600 28px Inter, sans-serif'; c.fillText(curator.role.toUpperCase(), w / 2, h / 2 + 44);
    });
    add(new THREE.PlaneGeometry(0.8, 0.35), new THREE.MeshBasicMaterial({ map: plate }), 0, 0.6, 0.502);
    // Figure: a standing man in a jacket, holding a book (catalogue) in his left arm.
    const y0 = 1.1;
    for (const sd of [-1, 1]) {
      add(new THREE.BoxGeometry(0.15, 0.09, 0.3), marble, sd * 0.11, y0 + 0.045, 0.04);           // shoe
      add(new THREE.CylinderGeometry(0.105, 0.085, 0.88, 20), marble, sd * 0.105, y0 + 0.52, 0);   // trouser leg
      add(new THREE.SphereGeometry(0.09, 20, 16), marble, sd * 0.25, y0 + 1.46, 0);               // shoulder
    }
    add(new THREE.CylinderGeometry(0.21, 0.215, 0.2, 28), marble, 0, y0 + 0.98, 0, 0, 0, 0, [1, 1, 0.7]); // hips
    add(new THREE.CylinderGeometry(0.215, 0.235, 0.16, 28), marble, 0, y0 + 0.9, 0, 0, 0, 0, [1, 1, 0.68]); // jacket hem
    const torso = new THREE.LatheGeometry([
      new THREE.Vector2(0.2, 0), new THREE.Vector2(0.205, 0.12), new THREE.Vector2(0.23, 0.32),
      new THREE.Vector2(0.27, 0.46), new THREE.Vector2(0.22, 0.53), new THREE.Vector2(0.07, 0.56), new THREE.Vector2(0, 0.56),
    ], 32);
    add(torso, marble, 0, y0 + 0.95, 0, 0, 0, 0, [1, 1, 0.62]);
    // Jacket lapels and buttons on the chest.
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.3, 0.02), marble, sd * 0.07, y0 + 1.33, 0.16, 0.12, 0, sd * -0.35);
    for (let i = 0; i < 2; i++) add(new THREE.SphereGeometry(0.014, 8, 8), marble, 0, y0 + 1.12 + i * 0.09, 0.15);
    // Right arm hangs; left arm bends to hold the book.
    add(new THREE.CylinderGeometry(0.066, 0.056, 0.34, 18), marble, 0.29, y0 + 1.29, 0, 0, 0, 0.08);
    add(new THREE.CylinderGeometry(0.055, 0.045, 0.32, 18), marble, 0.31, y0 + 0.97, 0.01, 0, 0, 0.03);
    add(new THREE.SphereGeometry(0.05, 14, 12), marble, 0.315, y0 + 0.79, 0.02, 0, 0, 0, [0.9, 1.2, 0.8]);
    add(new THREE.CylinderGeometry(0.066, 0.056, 0.34, 18), marble, -0.29, y0 + 1.29, 0, 0, 0, -0.08);
    add(new THREE.CylinderGeometry(0.055, 0.045, 0.3, 18), marble, -0.27, y0 + 1.13, 0.14, Math.PI / 2 - 0.25, 0, 0);
    add(new THREE.SphereGeometry(0.05, 14, 12), marble, -0.24, y0 + 1.17, 0.29);
    add(new THREE.BoxGeometry(0.06, 0.32, 0.24), marble, -0.19, y0 + 1.22, 0.24, 0, 0, 0.12);    // book
    // Neck, head, hair, nose, ears.
    add(new THREE.CylinderGeometry(0.058, 0.065, 0.12, 16), marble, 0, y0 + 1.56, 0);
    add(new THREE.SphereGeometry(0.12, 28, 24), marble, 0, y0 + 1.73, 0.01, 0, 0, 0, [0.88, 1.08, 0.98]);
    add(new THREE.SphereGeometry(0.124, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), marble, 0, y0 + 1.75, -0.01, -0.25, 0, 0, [0.92, 1.0, 1.02]);
    add(new THREE.BoxGeometry(0.03, 0.05, 0.04), marble, 0, y0 + 1.72, 0.125, 0.2);
    for (const sd of [-1, 1]) add(new THREE.SphereGeometry(0.03, 10, 8), marble, sd * 0.105, y0 + 1.72, 0, 0, 0, 0, [0.5, 1, 0.8]);
    // Thin gold ring on the plinth cap.
    add(new THREE.BoxGeometry(1.16, 0.02, 1.16), gold, 0, 1.0, 0);
    statue.position.set(sx, 0, sz); statue.rotation.y = -Math.PI / 2; scene.add(statue);
    const sLight = new THREE.PointLight('#ffe7b8', 16, 8, 1.5); sLight.position.set(sx - 2.2, 4.6, sz); scene.add(sLight);
    obstacles.push({ x: sx, z: sz, r: 0.9 });

    // Small "Curated by" panel on the wall above the statue, same look as the welcome wall.
    const cur = canvasTex(1100, 480, (c, w, h) => {
      c.fillStyle = '#1f1b17'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c8a24f'; c.lineWidth = 4; c.strokeRect(18, 18, w - 36, h - 36);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#f3ead8'; c.font = '900 64px "Playfair Display", Georgia, serif'; c.fillText('Curated by', w / 2, 120);
      c.fillStyle = '#e6cb84'; c.font = '700 76px "Playfair Display", Georgia, serif'; c.fillText(curator.name, w / 2, 250);
      c.fillStyle = '#c8a24f'; c.font = '600 22px Inter, sans-serif'; c.fillText(site.school.toUpperCase(), w / 2, 370);
    });
    placeOnWall(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.92), new THREE.MeshBasicMaterial({ map: cur })), 'lobby', 'east', sz, 4.6);
  }
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
  $('crosshair').classList.add('hidden'); // free cursor now; no centre crosshair
  if (s !== 'playing') { for (const k in keys) keys[k] = false; drag = null; ring.visible = false; }
}
// Free cursor (Artsteps-style): no pointer lock. These stay as no-ops so overlays can call them.
function lock() {}
function unlock() {}
function play() { setState('playing'); }

function teleport(id) { try { cancelAuto(); } catch {} const s = SPAWNS[id]; camera.position.set(s.x, EYE, s.z); yaw = s.yaw; pitch = 0; }
teleport('lobby');

$('btn-enter').onclick = () => { if (wantsSound()) setSound(true); play(); updateRoom(true); };
$('btn-sound').onclick = () => setSound(!soundOn());
$('btn-sound-pause').onclick = () => setSound(!soundOn());
$('btn-sound-start').onclick = () => setSound(!soundOn());
// Start-screen music: try to play right away; if the browser blocks autoplay, the first click/tap/key starts it.
setSoundRoom('start');
const musicHint = () => $('music-hint').classList.toggle('hidden', !(state === 'start' && soundBlocked()));
document.addEventListener('cc-sound', musicHint);
if (wantsSound()) setSound(true);
setTimeout(musicHint, 400);
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => { resumeSound(); setTimeout(musicHint, 50); }, { capture: true, passive: true });
$('btn-resume').onclick = play;
$('btn-map').onclick = () => { unlock(); setState('paused'); };
// Smart glasses (2030): asked once on entering the room; the HUD button toggles them later.
$('glasses-yes').onclick = () => { glasses.set(true); play(); };
$('glasses-no').onclick = () => { glasses.set(false); play(); };
$('btn-glasses').onclick = () => glasses.set(!glasses.on);
const ui = { modal(name) { unlock(); setState(name); }, play: () => play(), toast: (a, b) => toast(a, b) };


for (const id of ['lobby', 'past', 'present', 'future', 'final']) {
  const r = ROOMS.find(x => x.id === id);
  const b = document.createElement('button');
  b.type = 'button'; b.innerHTML = `${r.name}<small>${r.sub}</small>`;
  b.onclick = () => { cancelAuto(); teleport(id); play(); };
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
  if (e.target.closest?.('input, textarea')) return;
  const wasPlaying = state === 'playing';
  keys[e.code] = true;
  if (wasPlaying && e.code === 'KeyE') interact(target);
  if (wasPlaying && e.code === 'KeyP') takePhoto();
  if (e.code === 'KeyM') { if (wasPlaying) setState('paused'); else if (state === 'paused') play(); }
  if (wasPlaying && e.code === 'Escape') setState('paused');
  if (state === 'card') {
    if (e.code === 'ArrowRight') stepCard(1);
    if (e.code === 'ArrowLeft') stepCard(-1);
    if (e.code === 'Escape' || e.code === 'KeyE') play();
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });

// ---------------------------------------------------------------------------
// Click-to-walk: drag to look, click the floor to glide there, click art to walk up to it.
// ---------------------------------------------------------------------------
const mouse = new THREE.Vector2(9, 9); // NDC of the cursor (9 = off-screen)
let drag = null;
const ring = new THREE.Group();
{
  const m = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 48), m('#ffffff'));
  const r2 = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), m('#c8a24f')); r2.material.opacity = 0.35;
  for (const r of [r1, r2]) { r.rotation.x = -Math.PI / 2; ring.add(r); }
  ring.position.y = 0.03; ring.visible = false; ring.renderOrder = 5; scene.add(ring);
}
const dest = ring.clone(); dest.visible = false; scene.add(dest); // marker where you're heading

// Every solid mesh blocks the ray (so you can't click art through walls); see-through effects don't.
let solids = null;
function buildSolids() {
  solids = [];
  const click = new Set(clickables);
  scene.traverse(o => {
    if (!o.isMesh || o === ring || ring.children.includes(o) || dest.children.includes(o)) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const seeThrough = mat && (mat.blending === THREE.AdditiveBlending || (mat.transparent && mat.opacity < 0.9));
    if (click.has(o) || !seeThrough) solids.push(o);
  });
}
function hitAt(ndc) {
  if (!solids) buildSolids();
  ray.setFromCamera(ndc, camera); ray.far = 60;
  for (const h of ray.intersectObjects(solids, false)) {
    if (!h.object.visible) continue;
    if (h.object.userData?.type) return { obj: h.object, point: h.point };
    if (h.point.y < 0.06 && walkable(h.point.x, h.point.z)) return { floor: h.point };
    return null; // a wall, plinth or ceiling
  }
  return null;
}

// Route between rooms through doorway centres.
const LINKS = DOORS.map(d => {
  const n = d.axis === 'z' ? [0, 1] : [1, 0];
  const x = d.axis === 'z' ? d.c : d.at, z = d.axis === 'z' ? d.at : d.c;
  return { x, z, n, a: roomAt(x - n[0] * 1.5, z - n[1] * 1.5)?.id, b: roomAt(x + n[0] * 1.5, z + n[1] * 1.5)?.id };
});
function planPath(tx, tz) {
  const from = roomAt(camera.position.x, camera.position.z)?.id, to = roomAt(tx, tz)?.id;
  const pts = [];
  if (from && to && from !== to) {
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const r = q.shift(); if (r === to) break;
      for (const L of LINKS) {
        const nxt = L.a === r ? L.b : L.b === r ? L.a : null;
        if (nxt && !(nxt in prev)) { prev[nxt] = { r, L }; q.push(nxt); }
      }
    }
    const steps = []; for (let r = to; prev[r]; r = prev[r].r) steps.unshift({ from: prev[r].r, L: prev[r].L });
    for (const { from: r, L } of steps) {
      const s = L.a === r ? 1 : -1;
      pts.push({ x: L.x - L.n[0] * 1.6 * s, z: L.z - L.n[1] * 1.6 * s, via: true }, { x: L.x + L.n[0] * 1.6 * s, z: L.z + L.n[1] * 1.6 * s, via: true });
    }
  }
  pts.push({ x: tx, z: tz });
  return pts;
}
const auto = { path: [], face: null, then: null, stuck: 0 };
function cancelAuto() { auto.path = []; auto.face = null; auto.then = null; dest.visible = false; }
function goTo(x, z, face = null, then = null) {
  auto.path = planPath(x, z); auto.face = face; auto.then = then; auto.stuck = 0;
  dest.position.set(x, 0.03, z); dest.visible = true;
}

// Where to stand to view something: in front of an exhibit, or just before any other clickable.
function approach(obj) {
  const d = obj.userData;
  if (d.type === 'exhibit') {
    const g = d.ex.group, n = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
    const h = d.ex.size?.h || 1.6;
    let dist = Math.max(2.6, h * 1.35);
    while (dist > 1.4 && !walkable(g.position.x + n.x * dist, g.position.z + n.z * dist)) dist -= 0.2;
    const cy = g.position.y - 0.25;
    return { x: g.position.x + n.x * dist, z: g.position.z + n.z * dist, face: { yaw: g.rotation.y, pitch: Math.atan2(cy - EYE, dist) }, then: () => openCard(d.ex) };
  }
  const p = new THREE.Vector3(); obj.getWorldPosition(p);
  const v = new THREE.Vector3(camera.position.x - p.x, 0, camera.position.z - p.z);
  if (v.length() < 3.2) return { x: camera.position.x, z: camera.position.z, face: null, then: () => interact(obj) };
  v.normalize();
  let dist = 2.4; while (dist < 4 && !walkable(p.x + v.x * dist, p.z + v.z * dist)) dist += 0.3;
  const x = p.x + v.x * dist, z = p.z + v.z * dist;
  return { x, z, face: { yaw: Math.atan2(-(p.x - x), -(p.z - z)), pitch: Math.atan2(p.y - EYE, dist) * 0.6 }, then: () => interact(obj) };
}
function clickAt(ndc) {
  const h = hitAt(ndc);
  if (!h) return;
  if (h.obj) { const a = approach(h.obj); goTo(a.x, a.z, a.face, a.then); }
  else goTo(h.floor.x, h.floor.z);
}

canvas.addEventListener('mousedown', e => {
  if (isTouch || state !== 'playing' || e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
});
addEventListener('mousemove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (!drag || state !== 'playing') return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 5) {
    yaw -= dx * 0.0035; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.0035));
    if (auto.face) auto.face = null; // you took over the view
  }
});
addEventListener('mouseup', e => {
  if (!drag) return;
  const wasClick = drag.moved <= 5; drag = null;
  if (wasClick && state === 'playing' && e.target === canvas) clickAt(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
});
canvas.addEventListener('mouseleave', () => mouse.set(9, 9));

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
      clickAt(new THREE.Vector2(t.clientX / innerWidth * 2 - 1, -(t.clientY / innerHeight) * 2 + 1));
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

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (state === 'playing') {
    let fx = 0, fz = 0;
    if (keys.KeyW || keys.ArrowUp) fz -= 1;
    if (keys.KeyS || keys.ArrowDown) fz += 1;
    if (keys.KeyA || keys.ArrowLeft) fx -= 1;
    if (keys.KeyD || keys.ArrowRight) fx += 1;
    if (joy.id !== null) { fx += joy.x; fz += joy.y; }
    const len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; }
    if (len > 0.05) cancelAuto(); // keys or joystick take over from click-to-walk
    const speed = keys.ShiftLeft || keys.ShiftRight ? 8 : 4.2;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    let wx = (fx * c + fz * s) * speed, wz = (-fx * s + fz * c) * speed;
    if (auto.path.length) {
      const p = auto.path[0], dx = p.x - camera.position.x, dz = p.z - camera.position.z, d = Math.hypot(dx, dz);
      if (d < (p.via ? 0.6 : 0.12)) { auto.path.shift(); auto.stuck = 0; if (!auto.path.length) dest.visible = false; }
      else {
        const sp = p.via ? 4.2 : Math.min(4.2, 0.6 + d * 2.2);
        wx = dx / d * sp; wz = dz / d * sp;
        if (d > 1.2) { // turn gently toward where you're going
          const want = Math.atan2(-dx, -dz); let dy = want - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          if (!drag) yaw += dy * Math.min(1, dt * 1.8);
        }
      }
    } else if (auto.face) {
      wx = wz = 0;
      let dy = auto.face.yaw - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const dp = auto.face.pitch - pitch, kf = Math.min(1, dt * 5);
      yaw += dy * kf; pitch += dp * kf;
      if (Math.abs(dy) < 0.02 && Math.abs(dp) < 0.02) { const then = auto.then; auto.face = null; auto.then = null; then?.(); }
    } else if (auto.then) { const then = auto.then; auto.then = null; then(); }
    const k = Math.min(1, dt * 10);
    vel.x += (wx - vel.x) * k;
    vel.y += (wz - vel.y) * k;
    const bx = camera.position.x, bz = camera.position.z;
    moveWithCollision(camera.position, vel.x * dt, vel.y * dt);
    if (auto.path.length) { // blocked (e.g. walked into a stage)? give up instead of pushing forever
      const moved = Math.hypot(camera.position.x - bx, camera.position.z - bz), sp = vel.length();
      auto.stuck = sp > 1 && moved < sp * dt * 0.3 ? auto.stuck + dt : 0;
      if (auto.stuck > 0.6) cancelAuto();
    }
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

  if (state === 'playing' && !isTouch && mouse.x < 2) {
    const h = drag?.moved > 5 ? null : hitAt(mouse);
    target = h?.obj || null;
    const d = target?.userData;
    ring.visible = !!h?.floor;
    if (h?.floor) ring.position.set(h.floor.x, 0.03, h.floor.z);
    canvas.style.cursor = drag?.moved > 5 ? 'grabbing' : d ? 'pointer' : 'default';
    $('hint').classList.toggle('hidden', !d);
    if (d?.type === 'exhibit') $('hint').textContent = `Click · ${d.ex.item.title}`;
    else if (d?.type === 'wall') $('hint').textContent = 'Click · Freedom Wall: read & post';
    else if (d?.type === 'trivia') $('hint').textContent = 'Click · Answer trivia for a passport stamp';
    else if (d?.type === 'passport') $('hint').textContent = 'Click · Passport check-out';
  } else { $('hint').classList.add('hidden'); ring.visible = false; }
  if (dest.visible) { const s = 1 + Math.sin(t * 6) * 0.12; dest.scale.set(s, 1, s); }

  for (const a of animators) a(t, dt);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

decorate({ scene, animators, clickables, camera, ui });
initFreedom({ scene, animators, clickables, ui, currentRoom: () => currentRoom?.id });
initExtras({ scene, animators, clickables, ui, camera, renderer, teleport, getYaw: () => yaw,
  renderNow: () => renderer.render(scene, camera), currentRoom: () => currentRoom?.id || 'lobby', currentRoomName: () => currentRoom?.name || 'Lobby' });

if (isTouch) { $('controls-desktop').classList.add('hidden'); $('controls-touch').classList.remove('hidden'); }
setState('start');
window.__cc = { camera, teleport, exhibits, setYaw: v => { yaw = v; }, setPitch: v => { pitch = v; }, renderer, scene, openCard, glasses, clickAt: (x, y) => clickAt(new THREE.Vector2(x, y)), hitAt: (x, y) => hitAt(new THREE.Vector2(x, y)), auto, _frame: frame, get state() { return state; } };
