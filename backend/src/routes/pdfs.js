import { Router } from 'express';
import { createReadStream, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db/schema.js';
import { generatePDF } from '../services/pdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfsDir = join(__dirname, '../../pdfs');
mkdirSync(pdfsDir, { recursive: true });
const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, j.title, j.company, j.url, j.score
    FROM pdfs p JOIN jobs j ON p.job_id = j.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(rows);
});

router.post('/generate/:jobId', async (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Vaga não encontrada' });

  const curriculum = db.prepare('SELECT * FROM curriculum WHERE id = 1').get();
  if (!curriculum) return res.status(400).json({ error: 'Preencha seu currículo na aba "Meu Currículo" primeiro.' });

  const customPrompt = req.body?.custom_prompt?.trim() || null;

  try {
    const { filePath, observacoes } = await generatePDF(job, curriculum, customPrompt);
    const versionRow = db.prepare('SELECT MAX(version) as maxV FROM pdfs WHERE job_id = ?').get(job.id);
    const nextVersion = (versionRow?.maxV ?? 0) + 1;
    db.prepare('INSERT INTO pdfs (job_id, file_path, observacoes, version, custom_prompt) VALUES (?, ?, ?, ?, ?)')
      .run(job.id, filePath, observacoes, nextVersion, customPrompt);
    db.prepare('UPDATE applications SET status = ? WHERE job_id = ? AND status = ?')
      .run('pdf_generated', job.id, 'pdf_pending');
    res.json({ ok: true, observacoes });
  } catch (e) {
    console.error('[generate error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/download/:jobId', (req, res) => {
  const pdf = db.prepare('SELECT * FROM pdfs WHERE job_id = ? ORDER BY version DESC LIMIT 1').get(req.params.jobId);
  if (!pdf || !existsSync(pdf.file_path)) return res.status(404).json({ error: 'PDF não encontrado' });
  res.setHeader('Content-Type', 'application/pdf');
  const fileName = pdf.file_path.split(/[\\/]/).pop();
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  createReadStream(pdf.file_path).pipe(res);
});

router.get('/versions/:jobId', (req, res) => {
  const versions = db.prepare('SELECT * FROM pdfs WHERE job_id = ? ORDER BY version DESC').all(req.params.jobId);
  res.json(versions);
});

router.delete('/version/:pdfId', (req, res) => {
  const pdf = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(req.params.pdfId);
  if (!pdf) return res.status(404).json({ error: 'Versão não encontrada' });
  try { if (existsSync(pdf.file_path)) unlinkSync(pdf.file_path); } catch {}
  db.prepare('DELETE FROM pdfs WHERE id = ?').run(pdf.id);
  const remaining = db.prepare('SELECT COUNT(*) as c FROM pdfs WHERE job_id = ?').get(pdf.job_id).c;
  if (remaining === 0) {
    db.prepare("UPDATE applications SET status = 'pdf_pending' WHERE job_id = ?").run(pdf.job_id);
  }
  res.json({ ok: true });
});

router.get('/download-version/:pdfId', (req, res) => {
  const pdf = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(req.params.pdfId);
  if (!pdf || !existsSync(pdf.file_path)) return res.status(404).json({ error: 'PDF não encontrado' });
  res.setHeader('Content-Type', 'application/pdf');
  const fileName = pdf.file_path.split(/[\\/]/).pop();
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  createReadStream(pdf.file_path).pipe(res);
});

// ── Template de layout ────────────────────────────────────────────────────────
router.get('/template', (req, res) => {
  const row = db.prepare('SELECT * FROM pdf_templates WHERE id = 1').get();
  if (!row) return res.json({});
  res.json(row);
});

router.post('/template', (req, res) => {
  const { data, name } = req.body;
  if (!data) return res.status(400).json({ error: 'Sem dados' });

  const content = Buffer.from(data, 'base64').toString('utf8');
  const filePath = join(pdfsDir, `template-${Date.now()}.html`);
  writeFileSync(filePath, content, 'utf8');

  const existing = db.prepare('SELECT id FROM pdf_templates WHERE id = 1').get();
  if (existing) {
    db.prepare(`UPDATE pdf_templates SET name=?, file_path=?, uploaded_at=datetime('now') WHERE id=1`)
      .run(name, filePath);
  } else {
    db.prepare(`INSERT INTO pdf_templates (id, name, file_path) VALUES (1, ?, ?)`)
      .run(name, filePath);
  }
  res.json({ ok: true });
});

router.get('/template/download', (req, res) => {
  const row = db.prepare('SELECT * FROM pdf_templates WHERE id = 1').get();
  if (!row || !existsSync(row.file_path)) return res.status(404).json({ error: 'Template não encontrado' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${row.name}"`);
  createReadStream(row.file_path).pipe(res);
});
// ─────────────────────────────────────────────────────────────────────────────

export default router;
