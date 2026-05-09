import { Router } from 'express';
import { query } from '../db/neon.js';
import { evaluateJob, evaluateJobFromText } from '../services/gemini.js';

const router = Router();

router.get('/', async (req, res) => {
  const { status, min_score } = req.query;
  const { rows: profileRows } = await query('SELECT country_preference FROM profile WHERE id = 1');
  const countryPref = profileRows[0]?.country_preference || 'brazil';

  let sql = countryPref === 'brazil'
    ? "SELECT * FROM jobs WHERE (country = 'brazil' OR country IS NULL) AND status != 'pending'"
    : "SELECT * FROM jobs WHERE status != 'pending'";
  const params = [];
  let idx = 1;
  if (status)    { sql += ` AND status = $${idx++}`;           params.push(status); }
  if (min_score) { sql += ` AND score >= $${idx++}`;           params.push(parseFloat(min_score)); }
  sql += ' ORDER BY found_at DESC';

  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/manual', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });

  const { rows: existing } = await query('SELECT id FROM jobs WHERE url=$1', [url]);
  if (existing.length) return res.status(409).json({ error: 'Vaga já existe' });

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  if (!profile) return res.status(400).json({ error: 'Preencha seu perfil primeiro' });

  try {
    const result = await evaluateJob(url, profile);
    if (!result.title) throw new Error('Não foi possível extrair as informações da vaga. Tente novamente.');
    const { rows } = await query(`
      INSERT INTO jobs (title, company, location, modality, level, url, description, source, score, score_reason, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING id
    `, [result.title, result.company || 'N/A', result.location, result.modality,
        result.level, url, result.description, 'manual', result.score, result.score_reason]);
    res.json({ id: rows[0].id, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/manual-text', async (req, res) => {
  const { url, title, company, text } = req.body;
  if (!title || !company) return res.status(400).json({ error: 'Nome da vaga e empresa são obrigatórios' });

  const jobUrl = url?.trim() || `manual:${Date.now()}`;
  const { rows: existing } = await query('SELECT id FROM jobs WHERE url=$1', [jobUrl]);
  if (existing.length) return res.status(409).json({ error: 'Vaga já existe' });

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  if (!profile) return res.status(400).json({ error: 'Preencha seu perfil primeiro' });

  try {
    const result = text?.trim()
      ? await evaluateJobFromText(text, jobUrl, profile)
      : { title, company, location: null, modality: null, level: null, description: text || null, score: null, score_reason: null };

    const { rows } = await query(`
      INSERT INTO jobs (title, company, location, modality, level, url, description, source, score, score_reason, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING id
    `, [result.title || title, result.company || company, result.location, result.modality,
        result.level, jobUrl, result.description || text, 'manual', result.score, result.score_reason]);
    res.json({ id: rows[0].id, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/all', async (req, res) => {
  await query('DELETE FROM applications');
  await query('DELETE FROM pdfs');
  await query('DELETE FROM jobs');
  res.json({ ok: true });
});

router.post('/:id/evaluate', async (req, res) => {
  const { rows: jobRows } = await query('SELECT * FROM jobs WHERE id=$1', [req.params.id]);
  const job = jobRows[0];
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  try {
    const result = await evaluateJob(job.url, profile);
    await query(`
      UPDATE jobs SET title=$1, company=$2, location=$3, country=$4, modality=$5, level=$6,
        description=$7, score=$8, score_reason=$9, status='new' WHERE id=$10
    `, [result.title || job.title, result.company || job.company, result.location,
        result.country || 'brazil', result.modality, result.level,
        result.description, result.score, result.score_reason, job.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/interest', async (req, res) => {
  const { rows: jobRows } = await query('SELECT * FROM jobs WHERE id=$1', [req.params.id]);
  const job = jobRows[0];
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

  await query("UPDATE jobs SET status='interested' WHERE id=$1", [job.id]);
  const { rows: existing } = await query('SELECT id FROM applications WHERE job_id=$1', [job.id]);
  if (!existing.length) {
    await query("INSERT INTO applications (job_id, status) VALUES ($1, 'pdf_pending')", [job.id]);
  }
  res.json({ ok: true });
});

router.post('/:id/ignore', async (req, res) => {
  await query("UPDATE jobs SET status='ignored' WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

export default router;
