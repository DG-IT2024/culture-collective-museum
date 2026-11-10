// Culture Collective web server: serves the museum and the Freedom Wall posts API.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeStore, validate } from './posts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8123;
const store = makeStore();

app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway sits behind one proxy; needed for per-visitor rate limits.

app.get('/healthz', (_req, res) => res.json({ ok: true, store: store.kind }));

// ---------------------------------------------------------------------------
// Freedom Wall API
// ---------------------------------------------------------------------------
const json = express.json({ limit: '4kb' });
const recentPosts = new Map();   // ip -> timestamps of recent posts
const reported = new Set();      // `${ip}:${postId}` so one visitor reports a post once
const POSTS_PER_MINUTE = 4;

function rateLimited(ip) {
  const now = Date.now();
  const list = (recentPosts.get(ip) || []).filter(t => now - t < 60_000);
  if (list.length >= POSTS_PER_MINUTE) { recentPosts.set(ip, list); return true; }
  list.push(now); recentPosts.set(ip, list);
  if (recentPosts.size > 5000) recentPosts.clear();
  return false;
}

app.get('/api/posts', async (req, res) => {
  const room = String(req.query.room || '');
  if (!['past', 'present', 'future'].includes(room)) return res.status(400).json({ error: 'Unknown room.' });
  try { res.set('Cache-Control', 'no-store').json({ posts: await store.list(room, 60) }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not load posts.' }); }
});

app.post('/api/posts', json, async (req, res) => {
  const v = validate(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Slow down a little. Try again in a minute.' });
  try { res.status(201).json({ post: await store.add(v) }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not save your post.' }); }
});

app.post('/api/posts/:id/report', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Bad post id.' });
  const key = `${req.ip}:${id}`;
  if (reported.has(key)) return res.json({ ok: true, already: true });
  try {
    const r = await store.report(id);
    if (!r) return res.status(404).json({ error: 'Post not found.' });
    reported.add(key); if (reported.size > 50000) reported.clear();
    res.json({ ok: true, hidden: r.hidden });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not report the post.' }); }
});

// Local development only: save a canvas screenshot (data URL) to the OS temp folder for visual checks.
app.post('/__dev/shot', express.json({ limit: '15mb' }), async (req, res) => {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const onRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
  if (!local || onRailway) return res.status(404).end();
  const { name = 'shot', data = '' } = req.body || {};
  const fs = await import('node:fs/promises'); const os = await import('node:os');
  const dir = path.join(os.tmpdir(), 'cc-shots'); await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${String(name).replace(/[^\w-]/g, '')}.jpg`);
  await fs.writeFile(file, Buffer.from(data.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  res.json({ file });
});

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (/\.(jpe?g|png|webp)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=86400');
    else res.setHeader('Cache-Control', 'no-cache');
  },
}));

store.init()
  .then(() => app.listen(PORT, () => console.log(`Culture Collective on http://localhost:${PORT} (posts: ${store.kind})`)))
  .catch(err => { console.error('Database setup failed:', err); process.exit(1); });
