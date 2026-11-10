// Museum layout: rooms, doorways, walls and walkable areas (the loop floor plan).
//
//  x →        0        26        52
//  z ↓   0  ┌─────────┬─────────┐
//           │ present │ future  │
//       30  ├────↑────┼────↓────┤
//           │  past   │  final  │
//       60  ├────↑────┼──┐ ↓ ┌──┤
//           │  lobby  ←──┘    (corridor)
//       90  └─────────┘
// "North" is -z. A yaw of 0 looks north.
import * as THREE from 'three';

export const H = 6.5;
export const EYE = 1.7;
export const DOOR_H = 4.2;
export const R = 0.35; // visitor radius
export const WALL_T = 0.3; // wall thickness: each room's wall face sits WALL_T/2 inside its boundary

export const ROOMS = [
  { id: 'lobby',     name: 'Lobby',            sub: 'Culture Collective',  x0: 0,  x1: 26, z0: 60, z1: 90 },
  { id: 'past',      name: 'Room 1 · Then',    sub: '2000–2010',           x0: 0,  x1: 26, z0: 30, z1: 60, era: true },
  { id: 'present',   name: 'Room 2 · Now',     sub: '2025–2026',           x0: 0,  x1: 26, z0: 0,  z1: 30, era: true },
  { id: 'future',    name: 'Room 3 · Next',    sub: '2030',                x0: 26, x1: 52, z0: 0,  z1: 30, era: true },
  { id: 'final',     name: 'Final Room',       sub: 'Then · Now · Next',   x0: 26, x1: 52, z0: 30, z1: 60 },
  { id: 'corridorV', name: 'Credits Corridor', sub: 'Salamat sa pagbisita', x0: 36, x1: 42, z0: 60, z1: 67, corridor: true },
  { id: 'corridorH', name: 'Credits Corridor', sub: 'Salamat sa pagbisita', x0: 26, x1: 42, z0: 67, z1: 73, corridor: true },
];
export const roomById = Object.fromEntries(ROOMS.map(r => [r.id, r]));

// Doorways. axis 'z' = the doorway sits on a wall line z = at (centered on x = c); axis 'x' = on x = at (centered on z = c).
// open = full-height opening (no lintel), used inside the corridor.
export const DOORS = [
  { id: 'lobby-past',     axis: 'z', at: 60, c: 13, w: 4, to: 'past' },
  { id: 'past-present',   axis: 'z', at: 30, c: 13, w: 4, to: 'present' },
  { id: 'present-future', axis: 'x', at: 26, c: 3,  w: 4, to: 'future' },
  { id: 'future-final',   axis: 'z', at: 30, c: 49, w: 4, to: 'final' },
  { id: 'final-corridor', axis: 'z', at: 60, c: 39, w: 6, open: true },
  { id: 'corridor-turn',  axis: 'z', at: 67, c: 39, w: 6, open: true },
  { id: 'corridor-lobby', axis: 'x', at: 26, c: 70, w: 6, open: true, to: 'lobby' },
];

// Where the visitor lands when teleporting to a room (position + yaw).
export const SPAWNS = {
  lobby:   { x: 13, z: 86, yaw: 0 },
  past:    { x: 13, z: 57.5, yaw: 0 },
  present: { x: 13, z: 27.5, yaw: 0 },
  future:  { x: 28.5, z: 3, yaw: -Math.PI / 2 },
  final:   { x: 49, z: 32.5, yaw: Math.PI },
};

// Each wall of a room: line, span and which side faces into the room.
function roomWalls(r) {
  return [
    { side: 'north', axis: 'z', at: r.z0, from: r.x0, to: r.x1, normal: [0, 1] },
    { side: 'south', axis: 'z', at: r.z1, from: r.x0, to: r.x1, normal: [0, -1] },
    { side: 'west',  axis: 'x', at: r.x0, from: r.z0, to: r.z1, normal: [1, 0] },
    { side: 'east',  axis: 'x', at: r.x1, from: r.z0, to: r.z1, normal: [-1, 0] },
  ];
}

// Build floors, ceilings and inward-facing walls with doorway gaps.
// `look(roomId)` returns { wall, floor, ceil } materials for that room.
export function buildShell(scene, look) {
  for (const r of ROOMS) {
    const m = look(r.id);
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m.ceil);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); scene.add(ceil);
    if (m.floorRepeat) { const t = m.floor.map; if (t) t.repeat.set(w / m.floorRepeat, d / m.floorRepeat); }

    for (const wall of roomWalls(r)) {
      const gaps = DOORS.filter(dr => dr.axis === wall.axis && Math.abs(dr.at - wall.at) < 0.01 && dr.c > wall.from && dr.c < wall.to)
        .map(dr => ({ a: dr.c - dr.w / 2, b: dr.c + dr.w / 2, open: dr.open }))
        .sort((p, q) => p.a - q.a);
      let cur = wall.from;
      const pieces = [];
      for (const g of gaps) {
        if (g.a > cur) pieces.push({ a: cur, b: g.a, y0: 0, y1: H });
        if (!g.open) pieces.push({ a: g.a, b: g.b, y0: DOOR_H, y1: H });
        cur = g.b;
      }
      if (cur < wall.to) pieces.push({ a: cur, b: wall.to, y0: 0, y1: H });
      for (const p of pieces) {
        const len = p.b - p.a, ht = p.y1 - p.y0;
        const mat = m.wall.clone();
        if (mat.map) { mat.map = mat.map.clone(); mat.map.needsUpdate = true; mat.map.repeat.set(len / (m.wallRepeat || 6), ht / H); }
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, ht), mat);
        const mid = (p.a + p.b) / 2, y = (p.y0 + p.y1) / 2;
        const inset = WALL_T / 2;
        if (wall.axis === 'z') mesh.position.set(mid, y, wall.at + wall.normal[1] * inset);
        else mesh.position.set(wall.at + wall.normal[0] * inset, y, mid);
        mesh.rotation.y = Math.atan2(wall.normal[0], wall.normal[1]);
        scene.add(mesh);
      }
    }
  }
  // Door frames: side posts (and a header on lintel doors) through the wall's thickness, so openings show depth.
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a322b', roughness: 0.55, metalness: 0.1 });
  const POST = 0.12, DEPTH = WALL_T + 0.06;
  for (const d of DOORS) {
    const top = d.open ? H : DOOR_H;
    const along = (a, y, z) => d.axis === 'z' ? [a, y, z] : [z, y, a];
    const size = (a, y, z) => d.axis === 'z' ? [a, y, z] : [z, y, a];
    for (const sgn of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(...size(POST, top, DEPTH)), frameMat);
      post.position.set(...along(d.c + sgn * (d.w / 2 - POST / 2), top / 2, d.at));
      scene.add(post);
    }
    if (!d.open) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(...size(d.w, POST, DEPTH)), frameMat);
      head.position.set(...along(d.c, DOOR_H - POST / 2, d.at));
      scene.add(head);
    }
  }
}

// A point on a wall, a little in front of it, with the rotation that faces into the room.
export function wallPoint(roomId, side, along, y, out = 0.12) {
  const r = roomById[roomId];
  const wall = roomWalls(r).find(w => w.side === side);
  out += WALL_T / 2; // measured from the wall's face, not the room boundary
  const pos = wall.axis === 'z'
    ? new THREE.Vector3(along, y, wall.at + wall.normal[1] * out)
    : new THREE.Vector3(wall.at + wall.normal[0] * out, y, along);
  return { pos, rotY: Math.atan2(wall.normal[0], wall.normal[1]) };
}

// ---------------------------------------------------------------------------
// Walkable areas and collision
// ---------------------------------------------------------------------------
const WALK = [
  ...ROOMS.map(r => { const m = R + WALL_T / 2; return { x0: r.x0 + m, x1: r.x1 - m, z0: r.z0 + m, z1: r.z1 - m }; }),
  ...DOORS.map(d => { const m = R + 0.12; return d.axis === 'z'
    ? { x0: d.c - d.w / 2 + m, x1: d.c + d.w / 2 - m, z0: d.at - 1, z1: d.at + 1 }
    : { x0: d.at - 1, x1: d.at + 1, z0: d.c - d.w / 2 + m, z1: d.c + d.w / 2 - m }; }),
];
export const obstacles = []; // circles {x, z, r}
export const blocks = [];    // rectangles {x0, x1, z0, z1} (stages, desks)

export function walkable(x, z) {
  if (blocks.some(b => x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R)) return false;
  return WALK.some(a => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1);
}

// Move from p by (dx, dz), sliding along walls and around round obstacles.
export function moveWithCollision(p, dx, dz) {
  let nx = p.x + dx, nz = p.z + dz;
  for (const o of obstacles) {
    let ox = nx - o.x, oz = nz - o.z, d = Math.hypot(ox, oz);
    const min = o.r + R;
    if (d >= min) continue;
    // Walking dead-center into an obstacle: nudge sideways so the visitor slides around it.
    const cross = dx * (p.z - o.z) - dz * (p.x - o.x);
    if (Math.abs(cross) < 1e-3) { ox += -dz * 0.05 || 0.01; oz += dx * 0.05; d = Math.hypot(ox, oz); }
    nx = o.x + ox / d * min; nz = o.z + oz / d * min;
  }
  if (walkable(nx, nz)) { p.x = nx; p.z = nz; return; }
  if (walkable(nx, p.z)) p.x = nx;
  else if (walkable(p.x, nz)) p.z = nz;
}

export function roomAt(x, z) {
  return ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null;
}

// ---------------------------------------------------------------------------
// Exhibit slots: Affect on the left wall, Body on the right, Performance on the back
// (left/right as you face the room from its entrance).
// ---------------------------------------------------------------------------
export const SLOTS = {
  past: {      // entered from the south, facing north
    affect:      { side: 'west',  along: [54, 49.5, 45, 40.5, 36], maxW: 3.0, maxH: 2.3 },
    body:        { side: 'east',  along: [55.5, 51.4, 47.3, 43.2, 39.1], maxW: 2.9, maxH: 2.3 },
    performance: { side: 'north', along: [2.4, 5.6, 8.8, 17.2, 20.4], maxW: 2.5, maxH: 2.1 },
  },
  present: {   // entered from the south, facing north; exit on the east wall near the north corner
    affect:      { side: 'west',  along: [26, 21.5, 17, 12.5, 8], maxW: 3.0, maxH: 2.3 },
    body:        { side: 'east',  along: [28, 24.25, 20.5, 16.75, 13], maxW: 2.6, maxH: 2.3 },
    performance: { side: 'north', along: [3.5, 8.25, 13, 17.75, 22.5], maxW: 3.2, maxH: 2.3 },
  },
  future: {    // entered from the west, facing east; exit on the south wall near the east corner
    affect:      { side: 'north', along: [31, 35.5, 40, 44.5, 49], maxW: 3.0, maxH: 2.3 },
    body:        { side: 'south', along: [28.6, 31.8, 35, 38.2, 41.4], maxW: 2.5, maxH: 2.2 },
    performance: { side: 'east',  along: [4, 9.5, 15, 20.5, 26], maxW: 3.6, maxH: 2.4 },
  },
};
