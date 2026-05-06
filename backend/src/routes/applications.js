import { Router } from 'express';
import db from '../db/schema.js';

const router = Router();

const STATUSES = ['pdf_pending', 'pdf_generated', 'applied', 'responded', 'interview', 'offer', 'rejected'];

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, j.title, j.company, j.location, j.modality, j.url, j.score,
           p.file_path as pdf_path, p.observacoes, p.version as pdf_version, p.created_at as pdf_created_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    LEFT JOIN pdfs p ON p.id = (SELECT id FROM pdfs WHERE job_id = j.id ORDER BY version DESC LIMIT 1)
    ORDER BY a.updated_at DESC
  `).all();
  res.json(rows);
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  db.prepare('UPDATE applications SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(status, req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/notes', (req, res) => {
  db.prepare('UPDATE applications SET notes = ? WHERE id = ?').run(req.body.notes, req.params.id);
  res.json({ ok: true });
});

export default router;
