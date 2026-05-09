import { Router } from 'express';
import { query } from '../db/neon.js';

const router = Router();

const parse = (f) => { try { return JSON.parse(f); } catch { return f; } };
const str = (v) => typeof v === 'object' ? JSON.stringify(v) : (v ?? '');

router.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM curriculum WHERE id = 1');
  const row = rows[0];
  if (!row) return res.json({});
  res.json({
    ...row,
    links: parse(row.links),
    competencies: parse(row.competencies),
    work_history: parse(row.work_history),
    education: parse(row.education),
  });
});

router.post('/', async (req, res) => {
  const d = req.body;
  await query(`
    INSERT INTO curriculum (id, title, subtitle, links, summary, competencies, work_history, education)
    VALUES (1,$1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET
      title=$1, subtitle=$2, links=$3, summary=$4, competencies=$5,
      work_history=$6, education=$7, updated_at=NOW()
  `, [d.title, d.subtitle, str(d.links), d.summary, str(d.competencies), str(d.work_history), str(d.education)]);
  res.json({ ok: true });
});

export default router;
