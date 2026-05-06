import { Router } from 'express';
import db from '../db/schema.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM sources ORDER BY id').all());
});

router.patch('/:id/toggle', (req, res) => {
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).json({ error: 'Fonte não encontrada' });
  db.prepare('UPDATE sources SET active = ? WHERE id = ?').run(source.active ? 0 : 1, source.id);
  res.json({ ok: true, active: !source.active });
});

router.get('/:id/logs', (req, res) => {
  res.json(db.prepare('SELECT * FROM scan_log WHERE source_id = ? ORDER BY ran_at DESC LIMIT 20').all(req.params.id));
});

export default router;
