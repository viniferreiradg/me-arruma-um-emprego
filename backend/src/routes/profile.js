import { Router } from 'express';
import db from '../db/schema.js';

const router = Router();

router.get('/', (req, res) => {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  if (!profile) return res.json({});

  const parse = (field) => {
    try { return JSON.parse(field); } catch { return field; }
  };

  res.json({
    ...profile,
    work_history: parse(profile.work_history),
    education: parse(profile.education),
    certifications: parse(profile.certifications),
    hard_skills: parse(profile.hard_skills),
    soft_skills: parse(profile.soft_skills),
    languages: parse(profile.languages),
    company_types: parse(profile.company_types),
    company_sizes: parse(profile.company_sizes),
    sectors_interest: parse(profile.sectors_interest),
    sectors_avoid: parse(profile.sectors_avoid),
    dealbreakers: parse(profile.dealbreakers),
  });
});

router.post('/', (req, res) => {
  const data = req.body;
  const stringify = (v) => typeof v === 'object' ? JSON.stringify(v) : v;

  const existing = db.prepare('SELECT id FROM profile WHERE id = 1').get();

  if (existing) {
    db.prepare(`UPDATE profile SET
      name=?, email=?, phone=?, location=?, linkedin=?, portfolio=?,
      profession=?, level=?, modality=?, commute_radius=?,
      salary_min=?, salary_max=?, availability=?, summary=?,
      work_history=?, education=?, certifications=?,
      hard_skills=?, soft_skills=?, languages=?,
      company_types=?, company_sizes=?, sectors_interest=?,
      sectors_avoid=?, dealbreakers=?, updated_at=datetime('now')
      WHERE id=1`).run(
      data.name, data.email, data.phone, data.location, data.linkedin, data.portfolio,
      data.profession, data.level, data.modality, data.commute_radius,
      data.salary_min, data.salary_max, data.availability, data.summary,
      stringify(data.work_history), stringify(data.education), stringify(data.certifications),
      stringify(data.hard_skills), stringify(data.soft_skills), stringify(data.languages),
      stringify(data.company_types), stringify(data.company_sizes), stringify(data.sectors_interest),
      stringify(data.sectors_avoid), stringify(data.dealbreakers)
    );
  } else {
    db.prepare(`INSERT INTO profile (id, name, email, phone, location, linkedin, portfolio,
      profession, level, modality, commute_radius, salary_min, salary_max, availability, summary,
      work_history, education, certifications, hard_skills, soft_skills, languages,
      company_types, company_sizes, sectors_interest, sectors_avoid, dealbreakers)
      VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      data.name, data.email, data.phone, data.location, data.linkedin, data.portfolio,
      data.profession, data.level, data.modality, data.commute_radius,
      data.salary_min, data.salary_max, data.availability, data.summary,
      stringify(data.work_history), stringify(data.education), stringify(data.certifications),
      stringify(data.hard_skills), stringify(data.soft_skills), stringify(data.languages),
      stringify(data.company_types), stringify(data.company_sizes), stringify(data.sectors_interest),
      stringify(data.sectors_avoid), stringify(data.dealbreakers)
    );
  }

  res.json({ ok: true });
});

export default router;
