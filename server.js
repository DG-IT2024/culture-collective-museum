// Culture Collective web server.
// Serves the museum from public/. The Freedom Wall posts API and Postgres are added in Phase 3.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8123;

app.disable('x-powered-by');

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Local development only: save a canvas screenshot (data URL) to the OS temp folder for visual checks.
app.post('/__dev/shot', express.json({ limit: '15mb' }), async (req, res) => {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!local || process.env.RAILWAY_ENVIRONMENT) return res.status(404).end();
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
    // Images rarely change; everything else revalidates so updates show up right away.
    if (/\.(jpe?g|png|webp)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=86400');
    else res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.listen(PORT, () => console.log(`Culture Collective running at http://localhost:${PORT}`));
