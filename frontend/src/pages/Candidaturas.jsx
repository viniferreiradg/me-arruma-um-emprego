import { useState, useEffect } from 'react';
import axios from 'axios';

const STATUSES = [
  { key: 'pdf_pending', label: 'PDF pendente', color: 'bg-slate-600' },
  { key: 'pdf_generated', label: 'PDF pronto', color: 'bg-blue-600' },
  { key: 'applied', label: 'Aplicado', color: 'bg-indigo-600' },
  { key: 'responded', label: 'Respondido', color: 'bg-yellow-600' },
  { key: 'interview', label: 'Entrevista', color: 'bg-orange-600' },
  { key: 'offer', label: 'Oferta', color: 'bg-green-600' },
  { key: 'rejected', label: 'Rejeitado', color: 'bg-red-700' },
];

const statusMap = Object.fromEntries(STATUSES.map(s => [s.key, s]));

const scoreColor = (s) => {
  if (!s) return 'text-slate-500';
  if (s >= 4) return 'text-green-400';
  if (s >= 3) return 'text-yellow-400';
  return 'text-red-400';
};

const fmt = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

function VersionsModal({ jobId, onClose, onDeleted }) {
  const [versions, setVersions] = useState([]);

  const load = () => axios.get(`/api/pdfs/versions/${jobId}`).then(r => setVersions(r.data));

  useEffect(() => { load(); }, [jobId]);

  const deleteVersion = async (pdfId) => {
    await axios.delete(`/api/pdfs/version/${pdfId}`);
    const updated = versions.filter(v => v.id !== pdfId);
    setVersions(updated);
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-base">Versões do PDF</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>
        {versions.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhuma versão encontrada.</p>
        ) : (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="bg-slate-700 rounded-lg px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-white text-sm font-medium">v{v.version}</span>
                    <span className="text-slate-400 text-xs ml-3">{fmt(v.created_at)}</span>
                    {v.custom_prompt && (
                      <p className="text-indigo-400 text-xs mt-1 leading-snug italic">"{v.custom_prompt}"</p>
                    )}
                    {v.observacoes && (
                      <p className="text-slate-400 text-xs mt-1 leading-snug">{v.observacoes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={`/api/pdfs/download-version/${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors font-medium"
                    >
                      Baixar
                    </a>
                    <button
                      onClick={() => deleteVersion(v.id)}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-red-900 hover:text-red-300 text-slate-300 text-xs rounded-lg transition-colors font-medium"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RegerarModal({ app, onConfirm, onClose }) {
  const [prompt, setPrompt] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-base">Regerar PDF</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>
        <p className="text-slate-400 text-sm">{app.title} · {app.company}</p>
        <div className="space-y-1.5">
          <label className="text-slate-300 text-xs font-medium uppercase tracking-wider">
            Pedido de alteração <span className="text-slate-500 normal-case font-normal">(opcional)</span>
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Ex: use um tom mais formal, destaque mais a experiência com pesquisa de usuário..."
            rows={4}
            className="w-full bg-slate-700 text-white placeholder-slate-500 border border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <p className="text-slate-500 text-xs">Específico para esta versão — não altera o prompt padrão.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(prompt.trim() || null)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
          >
            Gerar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Candidaturas() {
  const [apps, setApps] = useState([]);
  const [editNotes, setEditNotes] = useState({});
  const [generating, setGenerating] = useState(new Set());
  const [versionsModal, setVersionsModal] = useState(null);
  const [regerarModal, setRegerarModal] = useState(null);
  const [filter, setFilter] = useState('sem_rejeitados');

  const load = async () => {
    const { data } = await axios.get('/api/applications');
    setApps(data);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await axios.patch(`/api/applications/${id}/status`, { status });
    load();
  };

  const saveNotes = async (id) => {
    await axios.patch(`/api/applications/${id}/notes`, { notes: editNotes[id] });
    load();
  };

  const generatePDF = async (jobId, customPrompt = null) => {
    setRegerarModal(null);
    setGenerating(g => new Set(g).add(jobId));
    try {
      await axios.post(`/api/pdfs/generate/${jobId}`, { custom_prompt: customPrompt });
      await load();
    } catch (e) {
      alert('Erro ao gerar PDF: ' + (e.response?.data?.error || e.message));
    } finally {
      setGenerating(g => { const next = new Set(g); next.delete(jobId); return next; });
    }
  };

  const FILTERS = [
    { key: 'todos', label: 'Todos' },
    { key: 'sem_rejeitados', label: 'Sem rejeitados' },
    ...STATUSES.map(s => ({ key: s.key, label: s.label, color: s.color })),
  ];

  const filtered = apps.filter(app => {
    if (filter === 'todos') return true;
    if (filter === 'sem_rejeitados') return app.status !== 'rejected';
    return app.status === filter;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Candidaturas</h1>
        <span className="text-slate-500 text-sm">{filtered.length} candidatura{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {f.color && <span className={`w-2 h-2 rounded-full ${f.color}`} />}
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-500 py-16">
          {apps.length === 0
            ? 'Nenhuma candidatura ainda. Marque vagas como "Tenho interesse" na aba Vagas.'
            : 'Nenhuma candidatura nesta categoria.'}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(app => {
          const st = statusMap[app.status] || STATUSES[0];
          const isGenerating = generating.has(app.job_id);
          return (
            <div key={app.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
              {/* Cabeçalho */}
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <a href={app.url} target="_blank" rel="noreferrer"
                    className="text-slate-900 dark:text-white font-semibold hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
                    {app.title}
                  </a>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{app.company} · {app.location}</p>
                </div>
                {app.score && (
                  <span className={`text-lg font-bold shrink-0 ${scoreColor(app.score)}`}>
                    {app.score.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => updateStatus(app.id, s.key)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      app.status === s.key
                        ? `${s.color} text-white`
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Ações */}
              <div className="flex gap-2 items-center flex-wrap">
                {app.pdf_path ? (
                  <>
                    <a
                      href={`/api/pdfs/download/${app.job_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
                    >
                      Baixar PDF
                    </a>
                    <span className="text-xs text-slate-400 font-medium">v{app.pdf_version}</span>
                    <button
                      onClick={() => setVersionsModal(app.job_id)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg transition-colors font-medium"
                    >
                      Versões
                    </button>
                  </>
                ) : null}
                <button
                  onClick={() => app.pdf_path ? setRegerarModal(app) : generatePDF(app.job_id)}
                  disabled={isGenerating}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium flex items-center gap-2 ${
                    isGenerating
                      ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                      : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isGenerating && (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {isGenerating ? 'Gerando com Gemini...' : app.pdf_path ? 'Regerar PDF' : 'Gerar PDF'}
                </button>
              </div>

              {/* Observações do Gemini */}
              {app.observacoes && (
                <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">O que o Gemini ajustou</p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{app.observacoes}</p>
                </div>
              )}

              {/* Notas */}
              <div className="flex gap-2">
                <input
                  value={editNotes[app.id] ?? (app.notes || '')}
                  onChange={e => setEditNotes(n => ({ ...n, [app.id]: e.target.value }))}
                  placeholder="Anotações sobre esta candidatura..."
                  className="flex-1 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {editNotes[app.id] !== undefined && (
                  <button
                    onClick={() => saveNotes(app.id)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-white text-sm rounded-lg transition-colors"
                  >
                    Salvar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {versionsModal && (
        <VersionsModal jobId={versionsModal} onClose={() => setVersionsModal(null)} onDeleted={load} />
      )}
      {regerarModal && (
        <RegerarModal
          app={regerarModal}
          onConfirm={(customPrompt) => generatePDF(regerarModal.job_id, customPrompt)}
          onClose={() => setRegerarModal(null)}
        />
      )}
    </div>
  );
}
