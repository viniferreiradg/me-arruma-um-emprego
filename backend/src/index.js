import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, v] = line.split('=');
    if (k && v) process.env[k.trim()] = v.trim();
  }
} catch {}

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import './db/schema.js';
import profileRoutes from './routes/profile.js';
import jobsRoutes from './routes/jobs.js';
import applicationsRoutes from './routes/applications.js';
import pdfsRoutes from './routes/pdfs.js';
import sourcesRoutes from './routes/sources.js';
import curriculumRoutes from './routes/curriculum.js';
import { scanAll } from './services/scanner.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Scan com polling ─────────────────────────────────────────────────────────
const scanState = { events: [], running: false };
function pushEvent(ev) {
  scanState.events.push(ev);
  console.log('[scan]', ev.type, ev.source || '', (ev.message || '').slice(0, 80));
}

app.post('/api/scan', async (req, res) => {
  if (scanState.running) return res.json({ ok: true, already: true });
  scanState.events.length = 0;
  scanState.running = true;
  res.json({ ok: true });
  try {
    await scanAll(pushEvent, 10);
  } catch (e) {
    console.error('[scan error]', e.message);
    pushEvent({ type: 'error', source: 'Sistema', message: e.message });
  } finally {
    scanState.running = false;
  }
});

app.get('/api/scan/events', (req, res) => {
  const after = parseInt(req.query.after || '0');
  res.json({
    events: scanState.events.slice(after),
    total: scanState.events.length,
    running: scanState.running,
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/pdfs', pdfsRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/curriculum', curriculumRoutes);

// Scan diário às 8h
cron.schedule('0 8 * * *', () => {
  console.log('Iniciando scan diário...');
  scanLinkedIn().catch(console.error);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
