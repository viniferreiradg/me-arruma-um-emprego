import { Router } from 'express';
import { query } from '../db/neon.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM sources ORDER BY id');
  res.json(rows);
});

router.patch('/:id/toggle', async (req, res) => {
  const { rows } = await query('SELECT * FROM sources WHERE id=$1', [req.params.id]);
  const source = rows[0];
  if (!source) return res.status(404).json({ error: 'Fonte não encontrada' });
  await query('UPDATE sources SET active=$1 WHERE id=$2', [source.active ? 0 : 1, source.id]);
  res.json({ ok: true, active: !source.active });
});

router.get('/:id/logs', async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM scan_log WHERE source_id=$1 ORDER BY ran_at DESC LIMIT 20',
    [req.params.id]
  );
  res.json(rows);
});

export default router;
