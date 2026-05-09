import { query } from '../db/neon.js';
import { evaluateJob, searchJobLinks } from './gemini.js';
import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeJobLinks(pageUrl, urlPattern, selector = null) {
  const base = new URL(pageUrl).origin;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
    const waitSel = selector || `a[href*="${urlPattern}"]`;
    await page.waitForSelector(waitSel, { timeout: 12000 }).catch(() => {});
    const links = await page.evaluate(({ pattern, sel, baseUrl }) => {
      const seen = new Set();
      const results = [];
      const anchors = sel ? document.querySelectorAll(sel) : document.querySelectorAll('a[href]');
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : baseUrl + href;
        if (!fullUrl.includes(pattern) || seen.has(fullUrl)) continue;
        seen.add(fullUrl);
        const titleEl = a.querySelector('h1,h2,h3,h4');
        const title = (titleEl?.textContent || a.textContent).trim().replace(/\s+/g, ' ').slice(0, 120) || 'Vaga';
        let company = 'N/A';
        let el = a.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!el) break;
          const c = el.querySelector('a.company');
          if (c) { company = c.getAttribute('title') || c.textContent.trim() || 'N/A'; break; }
          el = el.parentElement;
        }
        results.push({ url: fullUrl, title, company });
      }
      return results.slice(0, 20);
    }, { pattern: urlPattern, sel: selector, baseUrl: base });
    return links;
  } catch (e) {
    console.error(`scrapeJobLinks error (${pageUrl}):`, e.message);
    return [];
  } finally {
    await browser.close();
  }
}

function getKeywords(profile) {
  if (profile?.profession) {
    return profile.profession.split(',').map(k => k.trim()).filter(Boolean);
  }
  return ['UX Designer'];
}

function titleRelevant(title, keywords) {
  if (!keywords?.length) return true;
  const t = title.toLowerCase();
  return keywords.some(kw =>
    kw.toLowerCase().split(/\s+/).some(word => word.length > 2 && t.includes(word))
  );
}

function levelMismatch(title, profileLevel) {
  if (!profileLevel || !title) return false;
  const t = title.toLowerCase();
  const isSenior = /\bsenior\b|\bsênior\b|\bsr\.?\b/.test(t);
  const isJunior = /\bjunior\b|\bjúnior\b|\bjr\.?\b/.test(t);
  const isPleno  = /\bpleno\b|\bmid\b|\bmidlevel\b/.test(t);
  if (profileLevel === 'junior' && (isSenior || isPleno)) return true;
  if (profileLevel === 'pleno'  && isSenior) return true;
  if (profileLevel === 'senior' && isJunior) return true;
  return false;
}

function passesFilters(job, profile, keywords) {
  if (!titleRelevant(job.title, keywords)) return false;
  if (profile?.level && levelMismatch(job.title, profile.level)) return false;
  if (profile?.dealbreakers) {
    let raw;
    try { raw = JSON.parse(profile.dealbreakers); } catch { raw = profile.dealbreakers; }
    const terms = (Array.isArray(raw) ? raw : String(raw).split(',')).map(t => t.trim().toLowerCase()).filter(Boolean);
    if (terms.find(t => job.title.toLowerCase().includes(t))) return false;
  }
  return true;
}

async function filterNewJobs(jobs) {
  if (!jobs.length) return [];
  const urls = jobs.map(j => j.url);
  const { rows } = await query('SELECT url FROM jobs WHERE url = ANY($1)', [urls]);
  const existingUrls = new Set(rows.map(r => r.url));
  return jobs.filter(j => !existingUrls.has(j.url));
}

async function saveJob(job, sourceName, profile, onProgress) {
  const { rows: existing } = await query('SELECT id FROM jobs WHERE url=$1', [job.url]);
  if (existing.length) return false;

  const keywords = getKeywords(profile);
  if (!titleRelevant(job.title, keywords)) {
    console.log(`[skip] título irrelevante: ${job.title}`);
    return false;
  }

  if (profile?.level && levelMismatch(job.title, profile.level)) {
    console.log(`[skip] nível incompatível: ${job.title}`);
    return false;
  }

  if (profile?.dealbreakers) {
    let raw;
    try { raw = JSON.parse(profile.dealbreakers); } catch { raw = profile.dealbreakers; }
    const terms = (Array.isArray(raw) ? raw : String(raw).split(',')).map(t => t.trim().toLowerCase()).filter(Boolean);
    const matched = terms.find(t => job.title.toLowerCase().includes(t));
    if (matched) {
      console.log(`[skip] dealbreaker "${matched}": ${job.title}`);
      return false;
    }
  }

  const { rows: inserted, rowCount } = await query(
    `INSERT INTO jobs (title, company, url, source, status) VALUES ($1,$2,$3,$4,'pending') ON CONFLICT (url) DO NOTHING RETURNING id`,
    [job.title, job.company, job.url, sourceName]
  );
  if (!rowCount) return false;
  const jobId = inserted[0].id;

  onProgress({ type: 'progress', source: sourceName, message: `Avaliando: ${job.title} · ${job.company}`, jobId });

  try {
    const evaluated = profile
      ? await evaluateJob(job.url, profile)
      : { ...job, score: null, score_reason: null, description: null, modality: null, level: null, location: null, country: 'brazil' };

    const { rows: current } = await query('SELECT status FROM jobs WHERE id=$1', [jobId]);
    if (current[0]?.status === 'pending') {
      await query(
        `UPDATE jobs SET title=$1, company=$2, location=$3, country=$4, modality=$5, level=$6,
         description=$7, score=$8, score_reason=$9, status='new' WHERE id=$10`,
        [evaluated.title || job.title, evaluated.company || job.company,
         evaluated.location, evaluated.country || 'brazil',
         evaluated.modality, evaluated.level,
         evaluated.description, evaluated.score, evaluated.score_reason, jobId]
      );
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Erro ao avaliar ${job.url}:`, e.message);
    await query('DELETE FROM jobs WHERE id=$1 AND status=$2', [jobId, 'pending']);
    return false;
  }
}

// ── LinkedIn BR ───────────────────────────────────────────────────────────────
async function fetchLinkedInJobs(keyword) {
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=Brazil&f_WT=2&f_TPR=r86400`;
  const response = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' } });
  const html = await response.text();
  const jobs = [];
  const seen = new Set();
  const urlRegex = /(https?:\/\/(?:br|www)\.linkedin\.com\/jobs\/view\/([^"?&\s]+))/g;
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const jobUrl = m[1].replace('br.linkedin.com', 'www.linkedin.com');
    if (seen.has(jobUrl)) continue;
    seen.add(jobUrl);
    const slug = decodeURIComponent(m[2]).replace(/-\d+$/, '');
    const atIdx = slug.lastIndexOf('-at-');
    const cap = s => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const title = cap(atIdx !== -1 ? slug.slice(0, atIdx) : slug);
    const company = atIdx !== -1 ? cap(slug.slice(atIdx + 4)) : 'N/A';
    jobs.push({ url: jobUrl, title, company });
  }
  return jobs;
}

async function scanLinkedIn(onProgress = () => {}, limit = 10) {
  const { rows } = await query("SELECT * FROM sources WHERE name='LinkedIn BR'");
  const source = rows[0];
  if (!source?.active) { onProgress({ type: 'skipped', source: 'LinkedIn BR' }); return 0; }

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  await query("UPDATE sources SET last_scan=NOW()::text, last_status='running', jobs_today=0 WHERE id=$1", [source.id]);
  onProgress({ type: 'start', source: 'LinkedIn BR', limit });

  let found = 0, error = null;
  try {
    const keywords = getKeywords(profile);
    const seen = new Set();
    let allJobs = [];
    for (const keyword of keywords) {
      onProgress({ type: 'progress', source: 'LinkedIn BR', message: `Buscando "${keyword}" no LinkedIn...` });
      const jobs = await fetchLinkedInJobs(keyword);
      for (const j of jobs) { if (!seen.has(j.url)) { seen.add(j.url); allJobs.push(j); } }
    }
    const newJobs = await filterNewJobs(allJobs);
    onProgress({ type: 'progress', source: 'LinkedIn BR', message: `${newJobs.length} vagas novas para avaliar...` });
    for (const job of newJobs) {
      if (found >= limit) break;
      if (await saveJob(job, 'LinkedIn BR', profile, onProgress)) {
        found++;
        onProgress({ type: 'count', source: 'LinkedIn BR', found, limit });
      }
    }
    await query('UPDATE sources SET last_status=$1, jobs_today=$2 WHERE id=$3', ['ok', found, source.id]);
  } catch (e) {
    error = e.message;
    await query("UPDATE sources SET last_status='error' WHERE id=$1", [source.id]);
    onProgress({ type: 'error', source: 'LinkedIn BR', message: e.message });
  }
  await query('INSERT INTO scan_log (source_id, status, jobs_found, error) VALUES ($1,$2,$3,$4)',
    [source.id, error ? 'error' : 'ok', found, error]);
  if (!error) onProgress({ type: 'done', source: 'LinkedIn BR', found });
  return found;
}

// ── Remotar ───────────────────────────────────────────────────────────────────
async function fetchRemotar(keyword) {
  return scrapeJobLinks(`https://remotar.com.br/search/jobs?q=${encodeURIComponent(keyword)}`, 'remotar.com.br/job/', 'a.job-title');
}

async function scanRemotar(onProgress = () => {}, limit = 10) {
  const { rows } = await query("SELECT * FROM sources WHERE name='Remotar'");
  const source = rows[0];
  if (!source?.active) { onProgress({ type: 'skipped', source: 'Remotar' }); return 0; }

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  await query("UPDATE sources SET last_scan=NOW()::text, last_status='running', jobs_today=0 WHERE id=$1", [source.id]);
  onProgress({ type: 'start', source: 'Remotar', limit });

  let found = 0, error = null;
  try {
    const keywords = getKeywords(profile);
    const seen = new Set();
    let allJobs = [];
    for (const keyword of keywords) {
      onProgress({ type: 'progress', source: 'Remotar', message: `Buscando "${keyword}" no Remotar...` });
      const jobs = await fetchRemotar(keyword);
      for (const j of jobs) { if (!seen.has(j.url)) { seen.add(j.url); allJobs.push(j); } }
    }
    const newJobs = await filterNewJobs(allJobs);
    onProgress({ type: 'progress', source: 'Remotar', message: `${newJobs.length} vagas novas para avaliar...` });
    for (const job of newJobs) {
      if (found >= limit) break;
      if (await saveJob(job, 'Remotar', profile, onProgress)) {
        found++;
        onProgress({ type: 'count', source: 'Remotar', found, limit });
      }
    }
    await query('UPDATE sources SET last_status=$1, jobs_today=$2 WHERE id=$3', ['ok', found, source.id]);
  } catch (e) {
    error = e.message;
    await query("UPDATE sources SET last_status='error' WHERE id=$1", [source.id]);
    onProgress({ type: 'error', source: 'Remotar', message: e.message });
  }
  await query('INSERT INTO scan_log (source_id, status, jobs_found, error) VALUES ($1,$2,$3,$4)',
    [source.id, error ? 'error' : 'ok', found, error]);
  if (!error) onProgress({ type: 'done', source: 'Remotar', found });
  return found;
}

// ── Layers.to ─────────────────────────────────────────────────────────────────
async function fetchLayers(keyword) {
  return scrapeJobLinks(`https://layers.to/jobs?q=${encodeURIComponent(keyword)}`, 'layers.to/jobs/');
}

async function scanLayers(onProgress = () => {}, limit = 10) {
  const { rows } = await query("SELECT * FROM sources WHERE name='Layers.to'");
  const source = rows[0];
  if (!source?.active) { onProgress({ type: 'skipped', source: 'Layers.to' }); return 0; }

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  await query("UPDATE sources SET last_scan=NOW()::text, last_status='running', jobs_today=0 WHERE id=$1", [source.id]);
  onProgress({ type: 'start', source: 'Layers.to', limit });

  let found = 0, error = null;
  try {
    const keywords = getKeywords(profile);
    const seen = new Set();
    let allJobs = [];
    for (const keyword of keywords) {
      onProgress({ type: 'progress', source: 'Layers.to', message: `Buscando "${keyword}" no Layers...` });
      const jobs = await fetchLayers(keyword);
      for (const j of jobs) { if (!seen.has(j.url)) { seen.add(j.url); allJobs.push(j); } }
    }
    const newJobs = await filterNewJobs(allJobs);
    onProgress({ type: 'progress', source: 'Layers.to', message: `${newJobs.length} vagas novas para avaliar...` });
    for (const job of newJobs) {
      if (found >= limit) break;
      if (await saveJob(job, 'Layers.to', profile, onProgress)) {
        found++;
        onProgress({ type: 'count', source: 'Layers.to', found, limit });
      }
    }
    await query('UPDATE sources SET last_status=$1, jobs_today=$2 WHERE id=$3', ['ok', found, source.id]);
  } catch (e) {
    error = e.message;
    await query("UPDATE sources SET last_status='error' WHERE id=$1", [source.id]);
    onProgress({ type: 'error', source: 'Layers.to', message: e.message });
  }
  await query('INSERT INTO scan_log (source_id, status, jobs_found, error) VALUES ($1,$2,$3,$4)',
    [source.id, error ? 'error' : 'ok', found, error]);
  if (!error) onProgress({ type: 'done', source: 'Layers.to', found });
  return found;
}

// ── Trampos.co ────────────────────────────────────────────────────────────────
async function fetchTrampos(keyword) {
  return scrapeJobLinks(`https://trampos.co/oportunidades/?tr=${encodeURIComponent(keyword)}`, 'trampos.co/oportunidades/', 'a.ember-view.inner');
}

async function scanTrampos(onProgress = () => {}, limit = 10) {
  const { rows } = await query("SELECT * FROM sources WHERE name='Trampos.co'");
  const source = rows[0];
  if (!source?.active) { onProgress({ type: 'skipped', source: 'Trampos.co' }); return 0; }

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  await query("UPDATE sources SET last_scan=NOW()::text, last_status='running', jobs_today=0 WHERE id=$1", [source.id]);
  onProgress({ type: 'start', source: 'Trampos.co', limit });

  let found = 0, error = null;
  try {
    const keywords = getKeywords(profile);
    const seen = new Set();
    let allJobs = [];
    for (const keyword of keywords) {
      onProgress({ type: 'progress', source: 'Trampos.co', message: `Buscando "${keyword}" no Trampos...` });
      const jobs = await fetchTrampos(keyword);
      for (const j of jobs) { if (!seen.has(j.url)) { seen.add(j.url); allJobs.push(j); } }
    }
    const newJobs = await filterNewJobs(allJobs);
    onProgress({ type: 'progress', source: 'Trampos.co', message: `${newJobs.length} vagas novas para avaliar...` });
    for (const job of newJobs) {
      if (found >= limit) break;
      if (await saveJob(job, 'Trampos.co', profile, onProgress)) {
        found++;
        onProgress({ type: 'count', source: 'Trampos.co', found, limit });
      }
    }
    await query('UPDATE sources SET last_status=$1, jobs_today=$2 WHERE id=$3', ['ok', found, source.id]);
  } catch (e) {
    error = e.message;
    await query("UPDATE sources SET last_status='error' WHERE id=$1", [source.id]);
    onProgress({ type: 'error', source: 'Trampos.co', message: e.message });
  }
  await query('INSERT INTO scan_log (source_id, status, jobs_found, error) VALUES ($1,$2,$3,$4)',
    [source.id, error ? 'error' : 'ok', found, error]);
  if (!error) onProgress({ type: 'done', source: 'Trampos.co', found });
  return found;
}

// ── Gupy ──────────────────────────────────────────────────────────────────────
async function fetchGupy(keyword) {
  const url = `https://portal.gupy.io/job-search/term=${encodeURIComponent(keyword)}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, locale: 'pt-BR' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const jobs = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const cards = document.querySelectorAll('a[href*="gupy.io/jobs/"]');
      for (const a of cards) {
        const href = a.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);
        const titleEl = a.querySelector('h2, h3, h4, strong, [class*="title"], [class*="job-name"]');
        const title = (titleEl?.textContent || '').trim().replace(/\s+/g, ' ');
        const companyEl = a.querySelector('[class*="company"], [class*="employer"], [class*="organization"]');
        const company = (companyEl?.textContent || '').trim().replace(/\s+/g, ' ');
        if (title) results.push({ url: href, title, company: company || 'N/A' });
      }
      return results.slice(0, 20);
    });
    if (jobs.length === 0) {
      const fallback = await page.evaluate(() =>
        [...document.querySelectorAll('a[href]')]
          .filter(a => a.href.includes('gupy.io/jobs/'))
          .slice(0, 20)
          .map(a => ({ url: a.href, title: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 100) || 'Vaga', company: 'N/A' }))
      );
      return fallback;
    }
    return jobs;
  } catch (e) {
    console.error('fetchGupy error:', e.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scanGupy(onProgress = () => {}, limit = 10) {
  const { rows } = await query("SELECT * FROM sources WHERE name='Gupy'");
  const source = rows[0];
  if (!source?.active) { onProgress({ type: 'skipped', source: 'Gupy' }); return 0; }

  const { rows: profileRows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = profileRows[0];
  await query("UPDATE sources SET last_scan=NOW()::text, last_status='running', jobs_today=0 WHERE id=$1", [source.id]);
  onProgress({ type: 'start', source: 'Gupy', limit });

  let found = 0, error = null;
  try {
    const keywords = getKeywords(profile);
    const seen = new Set();
    let allJobs = [];
    for (const keyword of keywords) {
      onProgress({ type: 'progress', source: 'Gupy', message: `Buscando "${keyword}" no Gupy...` });
      const jobs = await fetchGupy(keyword);
      for (const j of jobs) { if (!seen.has(j.url)) { seen.add(j.url); allJobs.push(j); } }
    }
    const newJobs = await filterNewJobs(allJobs);
    onProgress({ type: 'progress', source: 'Gupy', message: `${newJobs.length} vagas novas para avaliar...` });
    for (const job of newJobs) {
      if (found >= limit) break;
      if (await saveJob(job, 'Gupy', profile, onProgress)) {
        found++;
        onProgress({ type: 'count', source: 'Gupy', found, limit });
      }
    }
    await query('UPDATE sources SET last_status=$1, jobs_today=$2 WHERE id=$3', ['ok', found, source.id]);
  } catch (e) {
    error = e.message;
    await query("UPDATE sources SET last_status='error' WHERE id=$1", [source.id]);
    onProgress({ type: 'error', source: 'Gupy', message: e.message });
  }
  await query('INSERT INTO scan_log (source_id, status, jobs_found, error) VALUES ($1,$2,$3,$4)',
    [source.id, error ? 'error' : 'ok', found, error]);
  if (!error) onProgress({ type: 'done', source: 'Gupy', found });
  return found;
}

// ── scanAll ───────────────────────────────────────────────────────────────────
export async function scanAll(onProgress = () => {}, limit = 10) {
  await query("DELETE FROM jobs WHERE status='pending'");
  await scanLinkedIn(onProgress, limit);
  await scanRemotar(onProgress, limit);
  await scanLayers(onProgress, limit);
  await scanTrampos(onProgress, limit);
  await scanGupy(onProgress, limit);
  onProgress({ type: 'complete' });
}
