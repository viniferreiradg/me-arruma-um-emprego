import { Router } from 'express';
import { query } from '../db/neon.js';

const router = Router();

const STATUSES = ['pdf_pending', 'pdf_generated', 'applied', 'responded', 'interview', 'offer', 'rejected'];

router.get('/', async (req, res) => {
  const { rows } = await query(`
    SELECT a.*, j.title, j.company, j.location, j.modality, j.url, j.score,
           p.file_path AS pdf_path, p.observacoes, p.version AS pdf_version, p.created_at AS pdf_created_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    LEFT JOIN pdfs p ON p.id = (SELECT id FROM pdfs WHERE job_id = j.id ORDER BY version DESC LIMIT 1)
    ORDER BY a.updated_at DESC
  `);
  res.json(rows);
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  await query('UPDATE applications SET status=$1, updated_at=NOW() WHERE id=$2', [status, req.params.id]);
  res.json({ ok: true });
});

router.patch('/:id/notes', async (req, res) => {
  await query('UPDATE applications SET notes=$1 WHERE id=$2', [req.body.notes, req.params.id]);
  res.json({ ok: true });
});

export default router;
