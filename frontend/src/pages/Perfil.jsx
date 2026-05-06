import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Section = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
    <h2 className="text-slate-900 dark:text-white font-semibold text-base border-b border-slate-200 dark:border-slate-700 pb-3">{title}</h2>
    <div className="space-y-3">{children}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500";

const Input = (props) => <input {...props} className={inputCls} />;

const Textarea = (props) => (
  <textarea {...props} rows={3} className={`${inputCls} resize-none`} />
);

const Select = ({ children, ...props }) => (
  <select {...props} className={inputCls}>
    {children}
  </select>
);

function OptionalField({ label, skipped, onSkip, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={skipped}
            onChange={e => onSkip(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-400 dark:text-slate-500">Prefiro não responder</span>
        </label>
      </div>
      <div className={skipped ? 'opacity-30 pointer-events-none select-none' : ''}>
        {children}
      </div>
    </div>
  );
}

// Máscara de telefone brasileiro: (XX) XXXXX-XXXX
function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

// Input de tags — vira tag ao apertar vírgula ou Enter
function TagInput({ tags: rawTags, onChange, placeholder }) {
  const tags = Array.isArray(rawTags) ? rawTags : [];
  const [input, setInput] = useState('');
  const ref = useRef();

  const addTag = (val) => {
    const v = val.trim().replace(/,$/, '');
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };

  const onKey = (e) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const onChange_ = (e) => {
    const v = e.target.value;
    if (v.includes(',')) { addTag(v); } else { setInput(v); }
  };

  return (
    <div
      onClick={() => ref.current?.focus()}
      className="flex flex-wrap gap-1.5 min-h-[40px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 cursor-text focus-within:ring-2 focus-within:ring-indigo-500"
    >
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2 py-1 rounded-md">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-indigo-900 dark:hover:text-white leading-none">&times;</button>
        </span>
      ))}
      <input
        ref={ref}
        value={input}
        onChange={onChange_}
        onKeyDown={onKey}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none"
      />
    </div>
  );
}

const emptyJob = () => ({ company: '', role: '', start: '', end: '', current: false, description: '' });
const emptyEdu = () => ({ type: '', status: '', institution: '', course: '', start_month: '', start_year: '', end_month: '', end_year: '' });

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const YEARS = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - i));

function WorkEntry({ entry, onChange, onRemove, index }) {
  const s = (k) => (e) => onChange({ ...entry, [k]: e.target.value });
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Experiência {index + 1}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors">
          🗑 Remover experiência
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Empresa"><Input value={entry.company} onChange={s('company')} placeholder="Nome da empresa" /></Field>
        <Field label="Cargo"><Input value={entry.role} onChange={s('role')} placeholder="Product Designer" /></Field>
        <Field label="Início"><Input value={entry.start} onChange={s('start')} placeholder="Jan 2022" /></Field>
        <Field label="Fim">
          <Input value={entry.current ? 'Atual' : entry.end} onChange={s('end')} placeholder="Dez 2024" disabled={entry.current} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
        <input type="checkbox" checked={entry.current} onChange={e => onChange({ ...entry, current: e.target.checked, end: '' })} className="rounded" />
        Trabalho aqui atualmente
      </label>
      <Field label="Descrição das atividades">
        <Textarea value={entry.description} onChange={s('description')} placeholder="Responsável por..." rows={2} />
      </Field>
    </div>
  );
}

function EduEntry({ entry, onChange, onRemove, index }) {
  const s = (k) => (e) => onChange({ ...entry, [k]: e.target.value });
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Formação {index + 1}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors">
          🗑 Remover formação
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select value={entry.type} onChange={s('type')}>
            <option value="">Selecione...</option>
            {['Ensino médio','Técnico','Graduação','Pós-graduação','MBA','Mestrado','Doutorado','Curso livre'].map(o => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={entry.status} onChange={s('status')}>
            <option value="">Selecione...</option>
            {['Cursando','Completo','Incompleto','Trancado'].map(o => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Instituição"><Input value={entry.institution} onChange={s('institution')} placeholder="Nome da instituição" /></Field>
        <Field label="Curso"><Input value={entry.course} onChange={s('course')} placeholder="Nome do curso" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início">
          <div className="flex gap-2">
            <Select value={entry.start_month} onChange={s('start_month')}>
              <option value="">Mês</option>
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </Select>
            <Select value={entry.start_year} onChange={s('start_year')}>
              <option value="">Ano</option>
              {YEARS.map(y => <option key={y}>{y}</option>)}
            </Select>
          </div>
        </Field>
        <Field label="Fim">
          <div className="flex gap-2">
            <Select value={entry.end_month} onChange={s('end_month')}>
              <option value="">Mês</option>
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </Select>
            <Select value={entry.end_year} onChange={s('end_year')}>
              <option value="">Ano</option>
              {YEARS.map(y => <option key={y}>{y}</option>)}
            </Select>
          </div>
        </Field>
      </div>
    </div>
  );
}

const initialState = {
  name: '', email: '', phone: '', city: '', state: '',
  linkedin: '', portfolio: '',
  professions: [],
  level: '', modality: '', country_preference: 'brazil', commute_radius: '',
  salary_min: '', salary_max: '', availability: '', summary: '',
  work_history: [emptyJob()],
  education: [emptyEdu()],
  certifications: [],
  hard_skills: [], soft_skills: [], languages: [],
  company_types: '', company_sizes: '', sectors_interest: '',
  sectors_avoid: '', dealbreakers: '',
  skip_company_types: false, skip_company_sizes: false,
  skip_sectors_interest: false, skip_sectors_avoid: false, skip_dealbreakers: false,
};

export default function Perfil() {
  const [form, setForm] = useState(initialState);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get('/api/profile').then(r => {
      if (!r.data || !Object.keys(r.data).length) return;
      const d = r.data;
      setForm(f => ({
        ...f,
        ...d,
        city: d.city || '',
        state: d.state || '',
        professions: Array.isArray(d.professions) ? d.professions : (d.profession ? [d.profession] : []),
        hard_skills: Array.isArray(d.hard_skills) ? d.hard_skills : (d.hard_skills ? d.hard_skills.split(',').map(s => s.trim()).filter(Boolean) : []),
        soft_skills: Array.isArray(d.soft_skills) ? d.soft_skills : (d.soft_skills ? d.soft_skills.split(',').map(s => s.trim()).filter(Boolean) : []),
        languages: Array.isArray(d.languages) ? d.languages : (d.languages ? d.languages.split(',').map(s => s.trim()).filter(Boolean) : []),
        certifications: Array.isArray(d.certifications) ? d.certifications : (d.certifications ? d.certifications.split(',').map(s => s.trim()).filter(Boolean) : []),
        work_history: Array.isArray(d.work_history) && d.work_history.length ? d.work_history : [emptyJob()],
        education: Array.isArray(d.education) && d.education.length ? d.education : [emptyEdu()],
      }));
    });
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    const payload = {
      ...form,
      location: [form.city, form.state].filter(Boolean).join(', '),
      profession: form.professions.join(', '),
    };
    await axios.post('/api/profile', payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Meu Perfil</h1>
        <button onClick={save} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg font-medium transition-colors">
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      <Section title="Dados pessoais">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><Input value={form.name} onChange={set('name')} placeholder="Seu nome completo" /></Field>
          <Field label="Email"><Input value={form.email} onChange={set('email')} placeholder="email@exemplo.com" /></Field>
          <Field label="Telefone">
            <Input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
            />
          </Field>
          <div />
          <Field label="Cidade"><Input value={form.city} onChange={set('city')} placeholder="São Paulo" /></Field>
          <Field label="Estado"><Input value={form.state} onChange={set('state')} placeholder="SP" maxLength={2} /></Field>
          <Field label="LinkedIn"><Input value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/seu-perfil" /></Field>
          <Field label="Portfolio"><Input value={form.portfolio} onChange={set('portfolio')} placeholder="behance.net/seu-perfil" /></Field>
        </div>
      </Section>

      <Section title="Cargo desejado">
        <Field label="Profissão (vírgula ou Enter para adicionar)">
          <TagInput
            tags={form.professions}
            onChange={v => setForm(f => ({ ...f, professions: v }))}
            placeholder="Product Designer, UX Designer, UI Designer..."
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nível">
            <Select value={form.level} onChange={set('level')}>
              <option value="">Selecione...</option>
              <option value="junior">Júnior</option>
              <option value="pleno">Pleno</option>
              <option value="senior">Sênior</option>
            </Select>
          </Field>
          <Field label="Modalidade">
            <Select value={form.modality} onChange={set('modality')}>
              <option value="">Selecione...</option>
              <option value="remoto">Remoto</option>
              <option value="presencial">Presencial</option>
              <option value="hibrido">Híbrido</option>
            </Select>
          </Field>
          <Field label="Onde quer trabalhar">
            <Select value={form.country_preference} onChange={set('country_preference')}>
              <option value="brazil">Só no Brasil</option>
              <option value="any">Brasil ou exterior</option>
            </Select>
          </Field>
          {form.modality === 'hibrido' && (
            <Field label="Raio máximo (km)"><Input type="number" value={form.commute_radius} onChange={set('commute_radius')} placeholder="30" /></Field>
          )}
          <Field label="Disponibilidade"><Input value={form.availability} onChange={set('availability')} placeholder="Imediato / 30 dias" /></Field>
          <Field label="Salário mínimo (R$)"><Input type="number" value={form.salary_min} onChange={set('salary_min')} placeholder="5000" /></Field>
          <Field label="Salário máximo (R$)"><Input type="number" value={form.salary_max} onChange={set('salary_max')} placeholder="10000" /></Field>
        </div>
      </Section>

      <Section title="Sobre você">
        <Field label="Resumo profissional">
          <Textarea value={form.summary} onChange={set('summary')} placeholder="Breve descrição da sua experiência e diferenciais..." />
        </Field>
      </Section>

      <Section title="Habilidades">
        <Field label="Hard skills (vírgula ou Enter para adicionar)">
          <TagInput tags={form.hard_skills} onChange={v => setForm(f => ({ ...f, hard_skills: v }))} placeholder="Figma, Maze, Hotjar, Design System..." />
        </Field>
        <Field label="Soft skills (vírgula ou Enter para adicionar)">
          <TagInput tags={form.soft_skills} onChange={v => setForm(f => ({ ...f, soft_skills: v }))} placeholder="Comunicação, colaboração..." />
        </Field>
        <Field label="Idiomas (vírgula ou Enter para adicionar)">
          <TagInput tags={form.languages} onChange={v => setForm(f => ({ ...f, languages: v }))} placeholder="Português nativo, Inglês intermediário..." />
        </Field>
      </Section>

      <Section title="Certificações">
        <Field label="Certificações (vírgula ou Enter para adicionar)">
          <TagInput tags={form.certifications} onChange={v => setForm(f => ({ ...f, certifications: v }))} placeholder="Google UX Design Certificate, Interaction Design Foundation..." />
        </Field>
        <p className="text-xs text-slate-400 dark:text-slate-500">Experiências e formação acadêmica ficam na aba <strong>Meu Currículo</strong>.</p>
      </Section>

      <Section title="Preferências">
        <OptionalField label="Tipo de empresa" skipped={form.skip_company_types} onSkip={v => setForm(f => ({ ...f, skip_company_types: v }))}>
          <Input value={form.company_types} onChange={set('company_types')} placeholder="Startup, produto, scale-up..." />
        </OptionalField>
        <OptionalField label="Tamanho da empresa" skipped={form.skip_company_sizes} onSkip={v => setForm(f => ({ ...f, skip_company_sizes: v }))}>
          <Input value={form.company_sizes} onChange={set('company_sizes')} placeholder="Pequena (até 50), Média (50-200)..." />
        </OptionalField>
        <OptionalField label="Segmentos de interesse" skipped={form.skip_sectors_interest} onSkip={v => setForm(f => ({ ...f, skip_sectors_interest: v }))}>
          <Input value={form.sectors_interest} onChange={set('sectors_interest')} placeholder="Fintech, educação, saúde, SaaS..." />
        </OptionalField>
        <OptionalField label="Segmentos a evitar" skipped={form.skip_sectors_avoid} onSkip={v => setForm(f => ({ ...f, skip_sectors_avoid: v }))}>
          <Input value={form.sectors_avoid} onChange={set('sectors_avoid')} placeholder="Apostas, tabaco, armas..." />
        </OptionalField>
        <OptionalField label="Termos para ignorar vagas" skipped={form.skip_dealbreakers} onSkip={v => setForm(f => ({ ...f, skip_dealbreakers: v }))}>
          <TagInput
            tags={form.dealbreakers}
            onChange={v => setForm(f => ({ ...f, dealbreakers: v }))}
            placeholder="CLT obrigatório, estagiário, desenvolvedor... (Enter para adicionar)"
          />
          <p className="text-xs text-slate-500 mt-1">Se qualquer um desses termos aparecer no título da vaga, ela é ignorada antes de gastar token.</p>
        </OptionalField>
      </Section>

      <div className="flex justify-end pb-6">
        <button onClick={save} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg font-medium transition-colors">
          {saved ? 'Salvo!' : 'Salvar perfil'}
        </button>
      </div>
    </div>
  );
}
