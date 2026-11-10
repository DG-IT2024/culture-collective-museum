// Freedom Wall posts: storage (Postgres on Railway, memory locally), filtering and moderation.
import pg from 'pg';

export const ROOMS = ['past', 'present', 'future'];
export const HIDE_AT = 3;          // reports needed to hide a post
const MAX_MSG = 200, MAX_NICK = 30;

// English + Filipino words masked as ★. Matched on letters only, so "g@go" style tricks are
// partly caught by the normaliser below.
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'pussy', 'nigger', 'nigga', 'slut', 'whore', 'bastard',
  'putangina', 'putang ina', 'tangina', 'tang ina', 'puta', 'gago', 'gaga', 'ulol', 'tarantado', 'pakyu', 'pakshet',
  'kupal', 'bobo', 'tanga', 'leche', 'punyeta', 'hayop ka', 'tite', 'puke', 'kantot', 'jakol', 'burat', 'pokpok'];
const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '$': 's', '5': 's', '7': 't' };

export function clean(text) {
  let out = String(text ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const norm = out.toLowerCase().replace(/[@4310!$57]/g, ch => LEET[ch] || ch);
  for (const w of BAD) {
    const re = new RegExp(`(^|[^a-z])(${w.replace(/ /g, '\\s*')})(?=$|[^a-z])`, 'g');
    let m;
    while ((m = re.exec(norm))) {
      const start = m.index + m[1].length, len = m[2].length;
      out = out.slice(0, start) + out[start] + '★'.repeat(len - 1) + out.slice(start + len);
    }
  }
  return out;
}

export function validate(body) {
  const room = String(body?.room || '');
  if (!ROOMS.includes(room)) return { error: 'Unknown room.' };
  const message = clean(body?.message).slice(0, MAX_MSG);
  if (message.length < 2) return { error: 'Write a message first.' };
  const nickname = clean(body?.nickname).slice(0, MAX_NICK) || 'Anonymous';
  return { room, message, nickname };
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
function memoryStore() {
  const rows = []; let id = 0;
  return {
    kind: 'memory',
    async init() {},
    async list(room, limit) {
      return rows.filter(r => r.room === room && r.reports < HIDE_AT).slice(-limit).reverse()
        .map(({ id, nickname, message, created_at }) => ({ id, nickname, message, created_at }));
    },
    async add({ room, nickname, message }) {
      const row = { id: ++id, room, nickname, message, reports: 0, created_at: new Date().toISOString() };
      rows.push(row); return { id: row.id, nickname, message, created_at: row.created_at };
    },
    async report(postId) {
      const r = rows.find(x => x.id === postId); if (!r) return null;
      r.reports++; return { hidden: r.reports >= HIDE_AT };
    },
  };
}

function pgStore(url) {
  const ssl = /sslmode=require/.test(url) || process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false;
  const pool = new pg.Pool({ connectionString: url, ssl, max: 5 });
  return {
    kind: 'postgres',
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        room TEXT NOT NULL CHECK (room IN ('past','present','future')),
        nickname TEXT NOT NULL,
        message TEXT NOT NULL,
        reports INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
      await pool.query('CREATE INDEX IF NOT EXISTS posts_room_created ON posts (room, created_at DESC)');
    },
    async list(room, limit) {
      const { rows } = await pool.query(
        'SELECT id, nickname, message, created_at FROM posts WHERE room = $1 AND reports < $2 ORDER BY created_at DESC, id DESC LIMIT $3',
        [room, HIDE_AT, limit]);
      return rows;
    },
    async add({ room, nickname, message }) {
      const { rows } = await pool.query(
        'INSERT INTO posts (room, nickname, message) VALUES ($1, $2, $3) RETURNING id, nickname, message, created_at',
        [room, nickname, message]);
      return rows[0];
    },
    async report(postId) {
      const { rows } = await pool.query('UPDATE posts SET reports = reports + 1 WHERE id = $1 RETURNING reports', [postId]);
      return rows[0] ? { hidden: rows[0].reports >= HIDE_AT } : null;
    },
  };
}

export function makeStore() {
  return process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : memoryStore();
}
