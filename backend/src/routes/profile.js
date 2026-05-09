import { Router } from 'express';
import { query } from '../db/neon.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM profile WHERE id = 1');
  const profile = rows[0];
  if (!profile) return res.json({});

  const parse = (f) => { try { return JSON.parse(f); } catch { return f; } };
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

router.post('/', async (req, res) => {
  const d = req.body;
  const s = (v) => typeof v === 'object' ? JSON.stringify(v) : v;

  await query(`
    INSERT INTO profile (
      id, name, email, phone, location, linkedin, portfolio,
      profession, level, modality, commute_radius, salary_min, salary_max,
      availability, summary, work_history, education, certifications,
      hard_skills, soft_skills, languages, company_types, company_sizes,
      sectors_interest, sectors_avoid, dealbreakers, country_preference
    ) VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
    ON CONFLICT (id) DO UPDATE SET
      name=$1, email=$2, phone=$3, location=$4, linkedin=$5, portfolio=$6,
      profession=$7, level=$8, modality=$9, commute_radius=$10,
      salary_min=$11, salary_max=$12, availability=$13, summary=$14,
      work_history=$15, education=$16, certifications=$17,
      hard_skills=$18, soft_skills=$19, languages=$20,
      company_types=$21, company_sizes=$22, sectors_interest=$23,
      sectors_avoid=$24, dealbreakers=$25, country_preference=$26,
      updated_at=NOW()
  `, [
    d.name, d.email, d.phone, d.location, d.linkedin, d.portfolio,
    d.profession, d.level, d.modality, d.commute_radius,
    d.salary_min, d.salary_max, d.availability, d.summary,
    s(d.work_history), s(d.education), s(d.certifications),
    s(d.hard_skills), s(d.soft_skills), s(d.languages),
    s(d.company_types), s(d.company_sizes), s(d.sectors_interest),
    s(d.sectors_avoid), s(d.dealbreakers), d.country_preference,
  ]);

  res.json({ ok: true });
});

export default router;
