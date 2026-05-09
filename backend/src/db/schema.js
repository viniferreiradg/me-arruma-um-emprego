import { query } from './neon.js';

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS profile (
      id BIGINT PRIMARY KEY DEFAULT 1,
      name TEXT, email TEXT, phone TEXT, location TEXT,
      linkedin TEXT, portfolio TEXT, profession TEXT, level TEXT,
      modality TEXT, commute_radius INTEGER, salary_min INTEGER, salary_max INTEGER,
      availability TEXT, summary TEXT, work_history TEXT, education TEXT,
      certifications TEXT, hard_skills TEXT, soft_skills TEXT, languages TEXT,
      company_types TEXT, company_sizes TEXT, sectors_interest TEXT,
      sectors_avoid TEXT, dealbreakers TEXT, country_preference TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      country TEXT DEFAULT 'brazil',
      modality TEXT,
      level TEXT,
      url TEXT UNIQUE NOT NULL,
      description TEXT,
      source TEXT,
      score REAL,
      score_reason TEXT,
      status TEXT DEFAULT 'new',
      found_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS applications (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT REFERENCES jobs(id),
      status TEXT DEFAULT 'pdf_pending',
      notes TEXT,
      applied_at TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pdfs (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT REFERENCES jobs(id),
      file_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      observacoes TEXT,
      version INTEGER DEFAULT 1,
      custom_prompt TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sources (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      last_scan TEXT,
      last_status TEXT DEFAULT 'pending',
      jobs_today INTEGER DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pdf_templates (
      id BIGINT PRIMARY KEY DEFAULT 1,
      name TEXT,
      file_path TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS curriculum (
      id BIGINT PRIMARY KEY DEFAULT 1,
      title TEXT, subtitle TEXT, links TEXT,
      summary TEXT, competencies TEXT,
      work_history TEXT, education TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS scan_log (
      id BIGSERIAL PRIMARY KEY,
      source_id BIGINT REFERENCES sources(id),
      status TEXT,
      jobs_found INTEGER DEFAULT 0,
      error TEXT,
      ran_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed sources if empty
  const { rows } = await query('SELECT COUNT(*) AS c FROM sources');
  if (parseInt(rows[0].c) === 0) {
    await query(`INSERT INTO sources (name, url, active) VALUES
      ('LinkedIn BR', 'https://www.linkedin.com/jobs/search/?keywords=UX+Designer&location=Brazil&f_WT=2&f_TPR=r86400', 1),
      ('Remotar', 'https://remotar.com.br', 1),
      ('Layers.to', 'https://layers.to/jobs', 1),
      ('Trampos.co', 'https://trampos.co/oportunidades', 1),
      ('Gupy', 'https://portal.gupy.io/job-search/term=UX+Designer', 1)
    `);
  }
}
