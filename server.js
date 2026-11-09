// Culture Collective web server.
// Serves the museum from public/. The Freedom Wall posts API and Postgres are added in Phase 3.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8123;

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders(res, filePath) {
    // Images rarely change; everything else revalidates so updates show up right away.
    if (/\.(jpe?g|png|webp)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=86400');
    else res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.listen(PORT, () => console.log(`Culture Collective running at http://localhost:${PORT}`));
