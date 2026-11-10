// Phase 3: shared Freedom Walls, one per era room, styled for its era.
// The 3D wall shows the latest posts; clicking it opens a panel to read, post and report.
import * as THREE from 'three';
import { wallPoint } from './world.js';
import { canvasTex, wrapLines, roundRect } from './util.js';

const ERA = {
  past: {
    kicker: 'Room 1 · 2000–2010 · Freedom Wall', title: 'Testimonials', button: 'Post testimonial',
    prompt: 'Leave a testimonial for the 2000s. What do you remember, or what did you love in this room?',
    place: { side: 'east', along: 33.8, y: 2.6, out: 0.06, w: 6.2, h: 4.24, px: [1200, 820] },
  },
  present: {
    kicker: 'Room 2 · 2025–2026 · Freedom Wall', title: 'Comments', button: 'Post comment',
    prompt: 'Add a comment about Now. What do you love about Pinoy pop culture today?',
    place: { side: 'east', along: 8.6, y: 2.55, out: 0.06, w: 5.8, h: 4.06, px: [1200, 840] },
  },
  future: {
    kicker: 'Room 3 · 2030 · Freedom Wall', title: 'Messages to the future', button: 'Transmit',
    prompt: 'Send a message to 2030. What do you think will happen?',
    place: { side: 'south', along: 44.9, y: 2.6, out: 0.25, w: 3.6, h: 3.98, px: [760, 840], transparent: true },
  },
};

const posts = { past: [], present: [], future: [] };
const walls = {};
let ui, openRoom = null;

export function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Wall artwork
// ---------------------------------------------------------------------------
const DRAW = {
  past(c, w, h, list) {
    c.fillStyle = '#e8f0fb'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#3b6fc4'; c.fillRect(0, 0, w, 110);
    c.fillStyle = '#fff'; c.font = '700 54px Arial'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('friendster-style', 40, 58);
    c.font = '28px VT323'; c.textAlign = 'right'; c.fillText('home · profile · friends · testimonials', w - 40, 60); c.textAlign = 'left';
    c.fillStyle = '#ff7a00'; c.fillRect(40, 136, w - 80, 66);
    c.fillStyle = '#fff'; c.font = '700 34px Arial'; c.fillText(`★ Testimonials (${list.length}) · Freedom Wall ★`, 64, 170);
    const shown = list.slice(0, 4);
    if (!shown.length) { c.fillStyle = '#5b6b86'; c.font = 'italic 30px Arial'; c.fillText('No testimonials yet. Be the first! Click here to write one.', 64, 270); }
    shown.forEach((p, i) => {
      const y = 228 + i * 140;
      c.fillStyle = '#fff'; c.fillRect(56, y, w - 112, 124); c.strokeStyle = '#9db6df'; c.lineWidth = 2; c.strokeRect(56, y, w - 112, 124);
      c.fillStyle = ['#ffd1ea', '#cdeaff', '#d9f7c4', '#ffe2b8'][i % 4]; c.fillRect(74, y + 18, 88, 88);
      c.fillStyle = '#3b6fc4'; c.font = '700 44px Arial'; c.textAlign = 'center'; c.fillText(p.nickname[0]?.toUpperCase() || '?', 118, y + 63); c.textAlign = 'left';
      c.fillStyle = '#3b6fc4'; c.font = '700 26px Arial'; c.fillText(`${p.nickname} wrote:`, 186, y + 30);
      c.fillStyle = '#8899b3'; c.font = '22px VT323'; c.textAlign = 'right'; c.fillText(ago(p.created_at), w - 76, y + 30); c.textAlign = 'left';
      c.fillStyle = '#222'; c.font = '25px Arial';
      wrapLines(c, p.message, w - 280, 2).forEach((l, k) => c.fillText(l, 186, y + 68 + k * 30));
    });
    c.fillStyle = '#3b6fc4'; c.font = '28px VT323'; c.textAlign = 'center'; c.fillText('~*~ click to read all & write a testimonial ~*~', w / 2, h - 24); c.textAlign = 'left';
  },
  present(c, w, h, list) {
    c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1e1e1e'; roundRect(c, 40, 40, 400, h - 80, 28); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; c.font = '800 30px Inter'; c.fillText('Freedom Wall', 240, 100);
    c.fillStyle = '#25f4ee'; c.font = '700 22px Inter'; c.fillText('#CultureCollective', 240, 140);
    c.fillStyle = '#fe2c55'; c.font = '120px Inter'; c.fillText('♥', 240, 380);
    c.fillStyle = '#fff'; c.font = '800 40px Inter'; c.fillText(String(list.length), 240, 480);
    c.fillStyle = '#aaa'; c.font = '600 22px Inter'; c.fillText(list.length === 1 ? 'comment' : 'comments', 240, 520);
    c.fillText('What do you love about Now?', 240, h - 120);
    c.textAlign = 'left';
    c.fillStyle = '#fff'; c.font = '800 34px Inter'; c.fillText(`Comments`, 490, 80);
    const shown = list.slice(0, 5);
    if (!shown.length) { c.fillStyle = '#888'; c.font = '600 26px Inter'; c.fillText('No comments yet. Click to be the first!', 490, 160); }
    shown.forEach((p, i) => {
      const y = 140 + i * 118;
      c.fillStyle = ['#fe2c55', '#25f4ee', '#b18cff', '#ffb347', '#9be15d'][i % 5]; c.beginPath(); c.arc(522, y + 26, 28, 0, 7); c.fill();
      c.fillStyle = '#111'; c.font = '800 28px Inter'; c.textAlign = 'center'; c.fillText(p.nickname[0]?.toUpperCase() || '?', 522, y + 28); c.textAlign = 'left';
      c.fillStyle = '#aaa'; c.font = '700 22px Inter'; c.fillText(`${p.nickname} · ${ago(p.created_at)}`, 570, y + 12);
      c.fillStyle = '#fff'; c.font = '500 25px Inter';
      wrapLines(c, p.message, w - 650, 2).forEach((l, k) => c.fillText(l, 570, y + 46 + k * 30));
    });
    c.fillStyle = '#fe2c55'; roundRect(c, 490, h - 96, 670, 58, 29); c.fill();
    c.fillStyle = '#fff'; c.font = '700 26px Inter'; c.fillText('Add comment…', 520, h - 67);
  },
  future(c, w, h, list) {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#00e5ff'; c.lineWidth = 4; c.shadowColor = '#00e5ff'; c.shadowBlur = 20;
    roundRect(c, 14, 14, w - 28, h - 28, 22); c.stroke(); c.fillStyle = 'rgba(0,30,50,.6)'; c.fill(); c.shadowBlur = 0;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#d9fdff'; c.font = '800 40px Orbitron'; c.fillText('MESSAGES', w / 2, 80);
    c.font = '500 19px Orbitron'; c.fillStyle = '#7df9ff'; c.fillText(`TO THE FUTURE · ${list.length} RECEIVED`, w / 2, 118);
    const shown = list.slice(0, 4);
    if (!shown.length) { c.fillStyle = '#7df9ff'; c.font = '500 22px Orbitron'; c.fillText('NO MESSAGES YET', w / 2, 300); c.fillText('BE THE FIRST TO TRANSMIT', w / 2, 340); }
    shown.forEach((p, i) => {
      const x = 60 + (i % 2) * 40, y = 160 + i * 150, bw = w - 160;
      c.strokeStyle = 'rgba(125,249,255,.75)'; c.lineWidth = 2; c.shadowColor = '#00e5ff'; c.shadowBlur = 10;
      roundRect(c, x, y, bw, 124, 40); c.stroke(); c.fillStyle = 'rgba(0,229,255,.08)'; c.fill(); c.shadowBlur = 0;
      c.textAlign = 'left'; c.fillStyle = '#7df9ff'; c.font = '500 17px Orbitron'; c.fillText(`${p.nickname.toUpperCase()} · ${ago(p.created_at).toUpperCase()}`, x + 30, y + 26);
      c.fillStyle = '#e6fdff'; c.font = '500 24px Inter';
      wrapLines(c, p.message, bw - 60, 2).forEach((l, k) => c.fillText(l, x + 30, y + 62 + k * 30));
    });
    c.textAlign = 'center'; c.fillStyle = '#7df9ff'; c.font = '500 18px Orbitron'; c.fillText('CLICK TO READ ALL · TRANSMIT', w / 2, h - 44);
  },
};

function redraw(room) {
  const wall = walls[room]; if (!wall) return;
  const { ctx, canvas } = wall.tex.userData;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  DRAW[room](ctx, canvas.width, canvas.height, posts[room]); ctx.restore();
  wall.tex.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export async function refresh(room) {
  try {
    const r = await fetch(`/api/posts?room=${room}`);
    if (!r.ok) throw new Error(r.status);
    posts[room] = (await r.json()).posts || [];
  } catch { /* offline: keep what we have */ }
  redraw(room);
  if (openRoom === room) renderList();
}

const REPORTED_KEY = 'cc.reported';
function reportedIds() { try { return new Set(JSON.parse(localStorage.getItem(REPORTED_KEY) || '[]')); } catch { return new Set(); } }
function remember(id) { try { const s = reportedIds(); s.add(id); localStorage.setItem(REPORTED_KEY, JSON.stringify([...s])); } catch {} }

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
function buildPanel() {
  const wrap = document.createElement('div');
  wrap.id = 'wallwrap'; wrap.className = 'overlay hidden'; wrap.dataset.state = 'wall';
  wrap.innerHTML = `
    <div class="panel wallpanel" role="dialog" aria-modal="true" aria-labelledby="wall-title">
      <p class="kicker" id="wall-kicker"></p>
      <h2 id="wall-title"></h2>
      <p class="lede" id="wall-prompt"></p>
      <form id="wallform" autocomplete="off">
        <input id="wall-nick" maxlength="30" placeholder="Nickname (optional)" aria-label="Nickname (optional)">
        <textarea id="wall-msg" maxlength="200" required placeholder="Your message (up to 200 characters)" aria-label="Your message"></textarea>
        <div class="formrow"><span id="wall-count">0 / 200</span><span id="wall-error" role="alert"></span></div>
        <div class="row"><button class="btn" id="wall-submit" type="submit"></button><button class="btn ghost" id="wall-close" type="button">Back to the museum</button></div>
      </form>
      <div class="posts" id="wall-posts"></div>
    </div>`;
  document.body.appendChild(wrap);
  try { $('wall-nick').value = localStorage.getItem('cc.nick') || ''; } catch {}
  $('wall-msg').addEventListener('input', () => { $('wall-count').textContent = `${$('wall-msg').value.length} / 200`; $('wall-error').textContent = ''; });
  $('wall-close').onclick = () => { openRoom = null; ui.play(); };
  wrap.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') $('wall-close').click(); });
  $('wallform').onsubmit = async e => {
    e.preventDefault();
    const message = $('wall-msg').value.trim();
    if (message.length < 2) { $('wall-error').textContent = 'Write a message first.'; return; }
    const nickname = $('wall-nick').value.trim();
    try { localStorage.setItem('cc.nick', nickname); } catch {}
    $('wall-submit').disabled = true;
    try {
      const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room: openRoom, nickname, message }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { $('wall-error').textContent = data.error || 'Could not post. Try again.'; return; }
      $('wall-msg').value = ''; $('wall-count').textContent = '0 / 200';
      await refresh(openRoom);
      ui.toast?.('Posted!', 'Your message is on the wall');
    } catch { $('wall-error').textContent = 'You seem to be offline. Try again.'; }
    finally { $('wall-submit').disabled = false; }
  };
}

function renderList() {
  const box = $('wall-posts'); box.innerHTML = '';
  const list = posts[openRoom];
  if (!list.length) { box.innerHTML = '<p class="empty">No posts yet. Be the first!</p>'; return; }
  const done = reportedIds();
  for (const p of list) {
    const el = document.createElement('article'); el.className = 'post';
    const head = document.createElement('header');
    const name = document.createElement('b'); name.textContent = p.nickname;
    const time = document.createElement('span'); time.textContent = ago(p.created_at);
    const rep = document.createElement('button'); rep.type = 'button'; rep.className = 'report';
    rep.textContent = done.has(p.id) ? 'Reported' : 'Report'; rep.disabled = done.has(p.id);
    rep.onclick = async () => {
      rep.disabled = true; rep.textContent = 'Reporting…';
      try {
        const r = await fetch(`/api/posts/${p.id}/report`, { method: 'POST' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error();
        remember(p.id); rep.textContent = 'Reported';
        if (d.hidden) await refresh(openRoom);
      } catch { rep.disabled = false; rep.textContent = 'Report'; }
    };
    head.append(name, time, rep);
    const msg = document.createElement('p'); msg.textContent = p.message;
    el.append(head, msg); box.appendChild(el);
  }
}

export function open(room) {
  openRoom = room;
  const e = ERA[room];
  const wrap = $('wallwrap'); wrap.dataset.era = room;
  $('wall-kicker').textContent = e.kicker; $('wall-title').textContent = e.title;
  $('wall-prompt').textContent = e.prompt; $('wall-submit').textContent = e.button; $('wall-error').textContent = '';
  renderList(); refresh(room);
  ui.modal('wall');
  setTimeout(() => $('wall-msg').focus(), 60);
}

// ---------------------------------------------------------------------------
export function initFreedom(ctx) {
  ui = ctx.ui;
  buildPanel();
  for (const room of Object.keys(ERA)) {
    const p = ERA[room].place;
    const tex = canvasTex(p.px[0], p.px[1], (c, w, h) => DRAW[room](c, w, h, []));
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !!p.transparent, depthWrite: !p.transparent });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
    const { pos, rotY } = wallPoint(room, p.side, p.along, p.y, p.out);
    mesh.position.copy(pos); mesh.rotation.y = rotY; ctx.scene.add(mesh);
    mesh.userData = { type: 'wall', room };
    ctx.clickables.push(mesh);
    walls[room] = { mesh, tex };
    if (p.transparent) ctx.animators.push(t => { mat.opacity = 0.88 + Math.sin(t * 5) * 0.07; });
    refresh(room);
  }
  // Keep the wall in the visitor's current room fresh.
  setInterval(() => { const r = ctx.currentRoom(); if (r && posts[r] && openRoom !== r) refresh(r); }, 30000);
}
