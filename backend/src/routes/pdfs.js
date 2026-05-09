import { Router } from 'express';
import { createReadStream, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/neon.js';
import { generatePDF } from '../services/pdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfsDir = join(__dirname, '../../pdfs');
mkdirSync(pdfsDir, { recursive: true });
const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await query(`
    SELECT p.*, j.title, j.company, j.url, j.score
    FROM pdfs p JOIN jobs j ON p.job_id = j.id
    ORDER BY p.created_at DESC
  `);
  res.json(rows);
});

router.post('/generate/:jobId', async (req, res) => {
  const { rows: jobRows } = await query('SELECT * FROM jobs WHERE id=$1', [req.params.jobId]);
  const job = jobRows[0];
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

  const { rows: currRows } = await query('SELECT * FROM curriculum WHERE id = 1');
  const curriculum = currRows[0];
  if (!curriculum) return res.status(400).json({ error: 'Preencha seu currículo na aba "Meu Currículo" primeiro.' });

  const customPrompt = req.body?.custom_prompt?.trim() || null;

  try {
    const { filePath, observacoes } = await generatePDF(job, curriculum, customPrompt);
    const { rows: vRows } = await query('SELECT MAX(version) AS maxv FROM pdfs WHERE job_id=$1', [job.id]);
    const nextVersion = (vRows[0]?.maxv ?? 0) + 1;
    await query(
      'INSERT INTO pdfs (job_id, file_path, observacoes, version, custom_prompt) VALUES ($1,$2,$3,$4,$5)',
      [job.id, filePath, observacoes, nextVersion, customPrompt]
    );
    await query(
      "UPDATE applications SET status='pdf_generated' WHERE job_id=$1 AND status='pdf_pending'",
      [job.id]
    );
    res.json({ ok: true, observacoes });
  } catch (e) {
    console.error('[generate error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/download/:jobId', async (req, res) => {
  const { rows } = await query('SELECT * FROM pdfs WHERE job_id=$1 ORDER BY version DESC LIMIT 1', [req.params.jobId]);
  const pdf = rows[0];
  if (!pdf || !existsSync(pdf.file_path)) return res.status(404).json({ error: 'PDF não encontrado' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdf.file_path.split(/[\\/]/).pop()}"`);
  createReadStream(pdf.file_path).pipe(res);
});

router.get('/versions/:jobId', async (req, res) => {
  const { rows } = await query('SELECT * FROM pdfs WHERE job_id=$1 ORDER BY version DESC', [req.params.jobId]);
  res.json(rows);
});

router.delete('/version/:pdfId', async (req, res) => {
  const { rows } = await query('SELECT * FROM pdfs WHERE id=$1', [req.params.pdfId]);
  const pdf = rows[0];
  if (!pdf) return res.status(404).json({ error: 'Versão não encontrada' });
  try { if (existsSync(pdf.file_path)) unlinkSync(pdf.file_path); } catch {}
  await query('DELETE FROM pdfs WHERE id=$1', [pdf.id]);
  const { rows: remaining } = await query('SELECT COUNT(*) AS c FROM pdfs WHERE job_id=$1', [pdf.job_id]);
  if (parseInt(remaining[0].c) === 0) {
    await query("UPDATE applications SET status='pdf_pending' WHERE job_id=$1", [pdf.job_id]);
  }
  res.json({ ok: true });
});

router.get('/download-version/:pdfId', async (req, res) => {
  const { rows } = await query('SELECT * FROM pdfs WHERE id=$1', [req.params.pdfId]);
  const pdf = rows[0];
  if (!pdf || !existsSync(pdf.file_path)) return res.status(404).json({ error: 'PDF não encontrado' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdf.file_path.split(/[\\/]/).pop()}"`);
  createReadStream(pdf.file_path).pipe(res);
});

router.get('/template', async (req, res) => {
  const { rows } = await query('SELECT * FROM pdf_templates WHERE id = 1');
  if (!rows[0]) return res.json({});
  res.json(rows[0]);
});

router.post('/template', async (req, res) => {
  const { data, name } = req.body;
  if (!data) return res.status(400).json({ error: 'Sem dados' });

  const content = Buffer.from(data, 'base64').toString('utf8');
  const filePath = join(pdfsDir, `template-${Date.now()}.html`);
  writeFileSync(filePath, content, 'utf8');

  await query(`
    INSERT INTO pdf_templates (id, name, file_path) VALUES (1,$1,$2)
    ON CONFLICT (id) DO UPDATE SET name=$1, file_path=$2, uploaded_at=NOW()
  `, [name, filePath]);
  res.json({ ok: true });
});

router.get('/template/download', async (req, res) => {
  const { rows } = await query('SELECT * FROM pdf_templates WHERE id = 1');
  const row = rows[0];
  if (!row || !existsSync(row.file_path)) return res.status(404).json({ error: 'Template não encontrado' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${row.name}"`);
  createReadStream(row.file_path).pipe(res);
});

export default router;
