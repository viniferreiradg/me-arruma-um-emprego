import { Router } from 'express';
import db from '../db/schema.js';

const router = Router();

const parse = (f) => { try { return JSON.parse(f); } catch { return f; } };
const str = (v) => typeof v === 'object' ? JSON.stringify(v) : (v ?? '');

router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM curriculum WHERE id = 1').get();
  if (!row) return res.json({});
  res.json({
    ...row,
    links: parse(row.links),
    competencies: parse(row.competencies),
    work_history: parse(row.work_history),
    education: parse(row.education),
  });
});

router.post('/', (req, res) => {
  const d = req.body;
  const existing = db.prepare('SELECT id FROM curriculum WHERE id = 1').get();
  if (existing) {
    db.prepare(`UPDATE curriculum SET
      title=?, subtitle=?, links=?, summary=?, competencies=?,
      work_history=?, education=?, updated_at=datetime('now') WHERE id=1`)
      .run(d.title, d.subtitle, str(d.links), d.summary, str(d.competencies),
           str(d.work_history), str(d.education));
  } else {
    db.prepare(`INSERT INTO curriculum (id,title,subtitle,links,summary,competencies,work_history,education)
      VALUES (1,?,?,?,?,?,?,?)`)
      .run(d.title, d.subtitle, str(d.links), d.summary, str(d.competencies),
           str(d.work_history), str(d.education));
  }
  res.json({ ok: true });
});

export default router;
