import { useState, useEffect } from 'react';
import axios from 'axios';

const inputCls = "w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500";

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

const Input = (props) => <input {...props} className={inputCls} />;

const Textarea = (props) => (
  <textarea {...props} className={`${inputCls} resize-none`} />
);

const Select = ({ children, ...props }) => (
  <select {...props} className={inputCls}>{children}</select>
);

const addBtn = "w-full border border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-3 text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2";

const removeBtn = "shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-base leading-none";

function LinkList({ links, onChange }) {
  const inputBase = "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500";
  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={link.label}
            onChange={e => onChange(links.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
            placeholder="Label"
            className={`${inputBase} w-28 shrink-0`}
          />
          <input
            value={link.url}
            onChange={e => onChange(links.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
            placeholder="URL"
            className={`${inputBase} flex-1 min-w-0`}
          />
          <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} className={removeBtn} title="Remover">
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...links, { label: '', url: '' }])} className={addBtn}>
        ⊕ Adicionar link
      </button>
    </div>
  );
}

function CompetencyList({ items, onChange }) {
  const inputBase = "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500";
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={item}
            onChange={e => onChange(items.map((v, j) => j === i ? e.target.value : v))}
            placeholder="Competência"
            className={`${inputBase} flex-1 min-w-0`}
          />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className={removeBtn} title="Remover">
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className={addBtn}>
        ⊕ Adicionar competência
      </button>
    </div>
  );
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const YEARS = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - i));

function WorkEntry({ entry, onChange, onRemove, index }) {
  const s = (k) => (e) => onChange({ ...entry, [k]: e.target.value });
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Experiência {index + 1}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors">
          🗑 Remover
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
        <Textarea value={entry.description} onChange={s('description')} placeholder="Responsável por..." rows={5} />
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
          🗑 Remover
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

const emptyJob = () => ({ company: '', role: '', start: '', end: '', current: false, description: '' });
const emptyEdu = () => ({ type: '', status: '', institution: '', course: '', start_month: '', start_year: '', end_month: '', end_year: '' });

const defaultState = {
  title: 'Vinicios Ferreira',
  subtitle: 'UX/UI Designer',
  links: [
    { label: 'LinkedIn', url: 'linkedin.com/in/viniferreiradg' },
    { label: 'Portfólio', url: 'viniferreiradg.com.br' },
  ],
  summary: 'UX/UI Designer com mais de 10 anos de atuação em design digital, especializado em produtos complexos: sistemas SaaS, dashboards, aplicativos mobile e plataformas B2B. Conduz o processo completo de design, da descoberta ao handoff, com sólida experiência em UX Research, arquitetura da informação, design systems e prototipagem de alta fidelidade. Formação em Design pela UDESC e base estratégica em branding que aprofunda a visão de consistência, comunicação e identidade nos produtos digitais desenvolvidos. Atualmente na Plathanus, onde já liderou o design de mais de 5 produtos digitais em segmentos como fintech, gestão de RH, field service e imobiliário.',
  competencies: [
    'UX Research e entrevistas com usuários',
    'Figma, FigJam, Framer, Miro',
    'Arquitetura da informação e fluxos',
    'HTML, CSS, WordPress, Elementor',
    'Design Systems e bibliotecas de componentes',
    'Adobe Creative Suite (Ps, Ai, XD, Pr, Ae)',
    'Wireframes e prototipagem (low e high fidelity)',
    'Webflow, Sketch',
    'Testes de usabilidade e análise heurística',
    'Claude Code (Vibe coding), ChatGPT, Midjourney e IA aplicada ao design',
    'Design Thinking e Double Diamond',
    'Handoff e documentação para desenvolvimento',
    'Personas, jornadas e mapeamento de fluxos',
    'Microsoft Clarity, A/B testing, heatmaps',
  ],
  work_history: [
    {
      company: 'Plathanus',
      role: 'UX/UI Designer',
      start: 'Abril 2024',
      end: '',
      current: true,
      description: 'Condução do processo completo de design em mais de 5 produtos digitais: discovery, UX Research, arquitetura da informação, wireframes, prototipagem de alta fidelidade e handoff para desenvolvimento.\n\nArenaGo (plataforma B2B de field service): redesign do app mobile e dashboard de gestão, resultando em 30% de redução nas etapas do fluxo principal, 23% menos tempo no preenchimento de relatórios e 28% de redução em registros com informações incorretas.\n\nLaunch (gestão de lançamentos imobiliários): produto criado do zero com três perfis de usuário integrados (admin, corretor e cliente final), alcançando 32% de redução no tempo de apresentação de imóveis e 33% de aumento nos clientes atendidos por dia.\n\nBeeWell (plataforma de gestão de pessoas e saúde mental/NR-1): centralização de um serviço antes distribuído entre WhatsApp, Slack e Discord em uma plataforma única, com processo completo de discovery, entrevistas com usuários, arquitetura da informação e design system.\n\nNetCred (sistema financeiro de travas de recebíveis): redesign focado em usabilidade de um sistema existente onde a falta de UX causava dependência total do suporte técnico.\n\nDeltaE (controle de qualidade de cores em impressão): agregação de funcionalidades antes dispersas em múltiplos sistemas.',
    },
    {
      company: 'Milvus',
      role: 'UX/UI Designer',
      start: 'Julho 2023',
      end: 'Fevereiro 2025',
      current: false,
      description: 'Atuação como designer único da empresa, responsável por toda a frente de UX/UI para a plataforma SaaS e o site institucional.\n\nAplicação de UX Research, arquitetura da informação, wireframes e prototipagem para evolução contínua da plataforma e do site.\n\nCriação de personas, jornadas de usuário e testes de usabilidade para embasar decisões de produto.\n\nUso de Microsoft Clarity, A/B testing e análise de mapas de calor para identificar fricções e oportunidades de melhoria nas interfaces.\n\nParticipação estratégica no Milvus Summit 2023 (MASP, 300+ participantes): identidade visual do evento, materiais de comunicação e coordenação de produção.',
    },
    {
      company: 'Bradda Design',
      role: 'Designer',
      start: 'Fevereiro 2014',
      end: 'Julho 2023',
      current: false,
      description: 'Desenvolvimento de sites e produtos digitais: arquitetura da informação, wireframes, prototipagem, layout, programação front-end e publicação, com mais de 50 projetos entregues.\n\nImplementação de ferramentas e processos modernos na equipe, incluindo Figma, animações em HTML5, WordPress e Elementor.\n\nEnvolvimento em mais de 200 projetos de branding e identidade visual para clientes como Cheesecake Labs, Facility, Plathanus, Aurum e Huggy, construindo base sólida em comunicação estratégica e consistência visual.',
    },
  ],
  education: [
    {
      type: 'Graduação',
      status: 'Completo',
      institution: 'UDESC - Universidade do Estado de Santa Catarina',
      course: 'Bacharelado em Design Gráfico',
      start_month: '',
      start_year: '2014',
      end_month: '',
      end_year: '2019',
    },
    {
      type: 'Técnico',
      status: 'Completo',
      institution: 'CEDUP - Centro de Educação Profissional Diomício Freitas',
      course: 'Técnico em Sistemas de Informação (Programação)',
      start_month: '',
      start_year: '2009',
      end_month: '',
      end_year: '2010',
    },
  ],
};

export default function Curriculo() {
  const [form, setForm] = useState(defaultState);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get('/api/curriculum').then(r => {
      if (!r.data || !Object.keys(r.data).length) return;
      const d = r.data;
      setForm({
        title: d.title ?? defaultState.title,
        subtitle: d.subtitle ?? defaultState.subtitle,
        links: Array.isArray(d.links) && d.links.length ? d.links : defaultState.links,
        summary: d.summary ?? defaultState.summary,
        competencies: Array.isArray(d.competencies) && d.competencies.length ? d.competencies : defaultState.competencies,
        work_history: Array.isArray(d.work_history) && d.work_history.length ? d.work_history : defaultState.work_history,
        education: Array.isArray(d.education) && d.education.length ? d.education : defaultState.education,
      });
    });
  }, []);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    await axios.post('/api/curriculum', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Meu Currículo</h1>
        <button onClick={save} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg font-medium transition-colors">
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      <Section title="Identificação">
        <Field label="Título (nome)">
          <Input value={form.title} onChange={setField('title')} placeholder="Vinicios Ferreira" />
        </Field>
        <Field label="Subtítulo (cargo)">
          <Input value={form.subtitle} onChange={setField('subtitle')} placeholder="UX/UI Designer" />
        </Field>
        <Field label="Links">
          <LinkList links={form.links} onChange={set('links')} />
        </Field>
      </Section>

      <Section title="Resumo profissional">
        <Textarea value={form.summary} onChange={setField('summary')} rows={6} placeholder="Breve descrição da sua experiência e diferenciais..." />
      </Section>

      <Section title="Competências">
        <CompetencyList items={form.competencies} onChange={set('competencies')} />
      </Section>

      <Section title="Experiências">
        <div className="space-y-3">
          {form.work_history.map((job, i) => (
            <WorkEntry
              key={i} entry={job} index={i}
              onChange={v => setForm(f => ({ ...f, work_history: f.work_history.map((e, j) => j === i ? v : e) }))}
              onRemove={() => setForm(f => ({ ...f, work_history: f.work_history.filter((_, j) => j !== i) }))}
            />
          ))}
          <button onClick={() => setForm(f => ({ ...f, work_history: [...f.work_history, emptyJob()] }))} className={addBtn}>
            ⊕ Adicionar experiência
          </button>
        </div>
      </Section>

      <Section title="Formação acadêmica">
        <div className="space-y-3">
          {form.education.map((edu, i) => (
            <EduEntry
              key={i} entry={edu} index={i}
              onChange={v => setForm(f => ({ ...f, education: f.education.map((e, j) => j === i ? v : e) }))}
              onRemove={() => setForm(f => ({ ...f, education: f.education.filter((_, j) => j !== i) }))}
            />
          ))}
          <button onClick={() => setForm(f => ({ ...f, education: [...f.education, emptyEdu()] }))} className={addBtn}>
            ⊕ Adicionar formação
          </button>
        </div>
      </Section>

      <div className="flex justify-end pb-6">
        <button onClick={save} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg font-medium transition-colors">
          {saved ? 'Salvo!' : 'Salvar currículo'}
        </button>
      </div>
    </div>
  );
}
