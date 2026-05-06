import { Router } from 'express';
import db from '../db/schema.js';
import { evaluateJob } from '../services/gemini.js';

const router = Router();

// Estado em memória do scan atual
const scanState = { events: [], running: false };

function pushEvent(ev) {
  scanState.events.push(ev);
  console.log('[scan]', ev.type, ev.source || '', ev.message?.slice(0, 60) || '');
}

router.get('/', (req, res) => {
  const { status, min_score } = req.query;
  const profile = db.prepare('SELECT country_preference FROM profile WHERE id = 1').get();
  const countryPref = profile?.country_preference || 'brazil';

  let query = countryPref === 'brazil'
    ? "SELECT * FROM jobs WHERE (country = 'brazil' OR country IS NULL) AND status != 'pending'"
    : "SELECT * FROM jobs WHERE status != 'pending'";
  const params = [];
  if (status)    { query += ' AND status = ?';    params.push(status); }
  if (min_score) { query += ' AND score >= ?';    params.push(parseFloat(min_score)); }
  query += ' ORDER BY found_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Inicia scan em background
router.post('/scan', async (req, res) => {
  if (scanState.running) return res.json({ ok: true, already: true });

  scanState.events.length = 0; // limpa array sem reatribuir
  scanState.running = true;
  res.json({ ok: true });
  console.log('[scan] iniciado');

  // importa dinâmico pra não quebrar no load da rota
  const { scanAll } = await import('../services/scanner.js');

  try {
    await scanAll(pushEvent);
  } catch (e) {
    console.error('[scan error]', e.message);
    pushEvent({ type: 'error', source: 'Sistema', message: e.message });
    pushEvent({ type: 'complete' });
  } finally {
    scanState.running = false;
    console.log('[scan] fim, eventos:', scanState.events.length);
  }
});

// Polling – retorna eventos desde o índice 'after'
router.get('/scan/events', (req, res) => {
  const after = parseInt(req.query.after || '0');
  console.log(`[poll] running=${scanState.running} total=${scanState.events.length} after=${after}`);
  res.json({
    events: scanState.events.slice(after),
    total:  scanState.events.length,
    running: scanState.running,
  });
});

router.post('/manual', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });

  const existing = db.prepare('SELECT id FROM jobs WHERE url = ?').get(url);
  if (existing) return res.status(409).json({ error: 'Vaga já existe' });

  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  if (!profile) return res.status(400).json({ error: 'Preencha seu perfil primeiro' });

  try {
    const { evaluateJob: eval2 } = await import('../services/gemini.js');
    const result = await eval2(url, profile);
    const info = db.prepare(`INSERT INTO jobs (title, company, location, modality, level, url, description, source, score, score_reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`).run(
      result.title, result.company, result.location, result.modality,
      result.level, url, result.description, 'manual', result.score, result.score_reason
    );
    res.json({ id: info.lastInsertRowid, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/all', (req, res) => {
  db.prepare('DELETE FROM applications').run();
  db.prepare('DELETE FROM pdfs').run();
  db.prepare('DELETE FROM jobs').run();
  res.json({ ok: true });
});

router.post('/:id/evaluate', async (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  try {
    const result = await evaluateJob(job.url, profile);
    db.prepare(`UPDATE jobs SET title=?, company=?, location=?, country=?, modality=?, level=?, description=?, score=?, score_reason=?, status='new' WHERE id=?`).run(
      result.title || job.title, result.company || job.company, result.location,
      result.country || 'brazil', result.modality, result.level,
      result.description, result.score, result.score_reason, job.id
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/interest', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });
  db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run('interested', job.id);
  const existing = db.prepare('SELECT id FROM applications WHERE job_id = ?').get(job.id);
  if (!existing) db.prepare('INSERT INTO applications (job_id, status) VALUES (?, ?)').run(job.id, 'pdf_pending');
  res.json({ ok: true });
});

router.post('/:id/ignore', (req, res) => {
  db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run('ignored', req.params.id);
  res.json({ ok: true });
});

export default router;
