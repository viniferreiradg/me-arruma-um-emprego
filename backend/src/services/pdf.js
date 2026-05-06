import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { adaptCurriculumForJob, injectAdaptationsIntoHTML } from './gemini.js';
import db from '../db/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_DIR = join(__dirname, '../../pdfs');

if (!existsSync(PDF_DIR)) mkdirSync(PDF_DIR, { recursive: true });

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export async function generatePDF(job, curriculum, customPrompt = null) {
  const templateRow = db.prepare('SELECT * FROM pdf_templates WHERE id = 1').get();
  if (!templateRow || !existsSync(templateRow.file_path)) {
    throw new Error('Template HTML não encontrado. Envie um template na aba Currículos.');
  }
  const templateHtml = readFileSync(templateRow.file_path, 'utf8');

  console.log('[pdf] adaptando currículo para vaga:', job.title);
  const adaptations = await adaptCurriculumForJob(job, curriculum, customPrompt);
  console.log('[pdf] adaptações:', adaptations.observacoes);

  console.log('[pdf] injetando no template HTML...');
  const modifiedHtml = await injectAdaptationsIntoHTML(templateHtml, adaptations);

  console.log('[pdf] renderizando PDF...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(modifiedHtml, { waitUntil: 'networkidle' });

    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const empresa = slugify(job.company);
    const titulo = slugify(job.title);
    const fileName = `${yy}-${mm}-${dd}-vinicios-ferreira-${titulo}-${empresa}.pdf`;
    const filePath = join(PDF_DIR, fileName);

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '2.5cm', right: '0', bottom: '2.5cm', left: '0' },
    });

    console.log('[pdf] gerado:', fileName);
    return { filePath, observacoes: adaptations.observacoes };
  } finally {
    await browser.close();
  }
}
