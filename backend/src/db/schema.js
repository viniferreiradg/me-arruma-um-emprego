import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(join(__dirname, '../../data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT, email TEXT, phone TEXT, location TEXT,
    linkedin TEXT, portfolio TEXT, profession TEXT, level TEXT,
    modality TEXT, commute_radius INTEGER, salary_min INTEGER, salary_max INTEGER,
    availability TEXT, summary TEXT, work_history TEXT, education TEXT,
    certifications TEXT, hard_skills TEXT, soft_skills TEXT, languages TEXT,
    company_types TEXT, company_sizes TEXT, sectors_interest TEXT,
    sectors_avoid TEXT, dealbreakers TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, company TEXT NOT NULL, location TEXT,
    country TEXT DEFAULT 'brazil',
    modality TEXT, level TEXT, url TEXT UNIQUE NOT NULL,
    description TEXT, source TEXT, score REAL, score_reason TEXT,
    status TEXT DEFAULT 'new',
    found_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER REFERENCES jobs(id),
    status TEXT DEFAULT 'pdf_pending',
    notes TEXT, applied_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER REFERENCES jobs(id),
    file_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, url TEXT NOT NULL,
    active INTEGER DEFAULT 1, last_scan TEXT,
    last_status TEXT DEFAULT 'pending', jobs_today INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pdf_templates (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT,
    file_path TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS curriculum (
    id INTEGER PRIMARY KEY DEFAULT 1,
    title TEXT, subtitle TEXT, links TEXT,
    summary TEXT, competencies TEXT,
    work_history TEXT, education TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scan_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES sources(id),
    status TEXT, jobs_found INTEGER DEFAULT 0, error TEXT,
    ran_at TEXT DEFAULT (datetime('now'))
  );
`);

const count = db.prepare('SELECT COUNT(*) as c FROM sources').get().c;
if (count === 0) {
  const ins = db.prepare('INSERT INTO sources (name, url, active) VALUES (?, ?, ?)');
  ins.run('LinkedIn BR', 'https://www.linkedin.com/jobs/search/?keywords=UX+Designer&location=Brazil&f_WT=2&f_TPR=r86400', 1);
  ins.run('Remotar', 'https://remotar.com.br', 1);
  ins.run('Layers.to', 'https://layers.to/jobs', 1);
  ins.run('Trampos.co', 'https://trampos.co/oportunidades', 1);
}

if (!db.prepare('SELECT id FROM sources WHERE name = ?').get('Gupy')) {
  db.prepare('INSERT INTO sources (name, url, active) VALUES (?, ?, ?)').run('Gupy', 'https://portal.gupy.io/job-search/term=UX+Designer', 1);
}

try { db.exec('ALTER TABLE pdfs ADD COLUMN observacoes TEXT'); } catch {}
try { db.exec('ALTER TABLE pdfs ADD COLUMN version INTEGER DEFAULT 1'); } catch {}
try { db.exec('ALTER TABLE pdfs ADD COLUMN custom_prompt TEXT'); } catch {}

export default db;
