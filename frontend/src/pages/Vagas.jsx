import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const scoreColor = (s) => {
  if (s >= 4) return 'text-green-400';
  if (s >= 3) return 'text-yellow-400';
  return 'text-red-400';
};

const modalityLabel = { remoto: 'Remoto', presencial: 'Presencial', hibrido: 'Híbrido' };

// ── Ícones inline ────────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);
const IconSpinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);
const IconClock = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
  </svg>
);
const IconError = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── Modal de scan ────────────────────────────────────────────────────────────
function ScanModal({ onClose, onDone }) {
  const [sources, setSources] = useState([]);
  const [currentMsg, setCurrentMsg] = useState('');
  const [currentJobId, setCurrentJobId] = useState(null);
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    const start = async () => {
      try {
        const r = await axios.get('/api/sources');
        if (cancelled) return;
        const active = r.data.filter(s => s.active);
        setSources(active.map(s => ({ id: s.id, name: s.name, status: 'pending', found: 0, count: 0, limit: 10, msg: '' })));

        await axios.post('http://localhost:3001/api/scan');
        if (cancelled) return;

        intervalId = setInterval(async () => {
          if (cancelled) { clearInterval(intervalId); return; }
          try {
            const { data } = await axios.get(`http://localhost:3001/api/scan/events?after=${indexRef.current}`);
            if (cancelled) { clearInterval(intervalId); return; }
            if (data.events.length > 0) {
              data.events.forEach(ev => {
                setSources(prev => prev.map(s => {
                  if (s.name !== ev.source) return s;
                  if (ev.type === 'start')    return { ...s, status: 'running', count: 0, limit: ev.limit || 10, msg: '' };
                  if (ev.type === 'progress') return { ...s, status: 'running', msg: ev.message };
                  if (ev.type === 'count')    return { ...s, count: ev.found, limit: ev.limit };
                  if (ev.type === 'done')     return { ...s, status: 'done', found: ev.found, msg: '' };
                  if (ev.type === 'error')    return { ...s, status: 'error', msg: ev.message };
                  if (ev.type === 'skipped')  return { ...s, status: 'skipped', msg: '' };
                  return s;
                }));
                if (ev.type === 'progress' && ev.message) {
                  setCurrentMsg(ev.message);
                  setCurrentJobId(ev.jobId || null);
                }
                if (ev.type === 'done')  { setCurrentMsg(''); setCurrentJobId(null); }
                if (ev.type === 'error') { setCurrentMsg(ev.message); setCurrentJobId(null); }
              });
              indexRef.current += data.events.length;
            }
            if (!data.running && indexRef.current >= data.total && indexRef.current > 0) {
              clearInterval(intervalId);
              cancelled = true;
              setDone(true);
              setCurrentMsg('');
              setCurrentJobId(null);
              onDone();
            }
          } catch (e) {
            clearInterval(intervalId);
            cancelled = true;
            setCurrentMsg('Erro ao comunicar com o servidor.');
            setDone(true);
          }
        }, 600);
      } catch (e) {
        setCurrentMsg('Erro ao iniciar scan.');
        setDone(true);
      }
    };

    start();
    return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
  }, []);

  const handleSkip = async () => {
    if (!currentJobId) return;
    const idToSkip = currentJobId;
    setCurrentJobId(null);
    setCurrentMsg('Pulando vaga, aguardando próxima...');
    try { await axios.post(`http://localhost:3001/api/jobs/${idToSkip}/ignore`); } catch {}
  };

  const running = sources.find(s => s.status === 'running');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-base">Escaneando portais</h2>
          <p className="text-slate-400 text-xs mt-0.5">A IA está avaliando cada vaga com seu perfil</p>
        </div>

        {/* Lista de fontes */}
        <div className="px-6 py-4 space-y-3">
          {sources.map(s => (
            <div key={s.id} className="flex items-start gap-3">
              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                ${s.status === 'done'    ? 'bg-green-500/20 text-green-400' : ''}
                ${s.status === 'running' ? 'bg-indigo-500/20 text-indigo-400' : ''}
                ${s.status === 'error'   ? 'bg-red-500/20 text-red-400' : ''}
                ${s.status === 'pending' || s.status === 'skipped' ? 'bg-slate-700 text-slate-500' : ''}
              `}>
                {s.status === 'done'    && <IconCheck />}
                {s.status === 'running' && <IconSpinner />}
                {s.status === 'error'   && <IconError />}
                {(s.status === 'pending' || s.status === 'skipped') && <span className="w-2 h-2 rounded-full bg-slate-600 block" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${s.status === 'pending' ? 'text-slate-500' : 'text-white'}`}>{s.name}</span>
                  {s.status === 'done' && (
                    <span className="text-xs text-green-400 font-medium">
                      {s.found === 0 ? 'nenhuma nova' : `${s.found} nova${s.found > 1 ? 's' : ''}`}
                    </span>
                  )}
                  {s.status === 'skipped' && <span className="text-xs text-slate-600">desativada</span>}
                </div>
                {s.status === 'running' && s.count > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((s.count / s.limit) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 tabular-nums">{s.count}/{s.limit}</span>
                  </div>
                )}
                {s.status === 'running' && s.msg && <p className="text-xs text-slate-400 mt-0.5 truncate">{s.msg}</p>}
                {s.status === 'error'   && s.msg && <p className="text-xs text-red-400 mt-0.5 truncate">{s.msg}</p>}
              </div>
            </div>
          ))}
          {sources.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Carregando fontes...</p>}
        </div>

        {/* Mensagem atual + botão Pular */}
        {running && currentMsg && (
          <div className="mx-6 mb-4 px-3 py-2 bg-slate-800 rounded-lg flex items-center justify-between gap-3">
            <p className="text-xs text-slate-300 leading-relaxed flex-1">{currentMsg}</p>
            {currentJobId && (
              <button
                onClick={handleSkip}
                className="shrink-0 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 rounded px-2 py-1 transition-colors"
              >
                Pular
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          {done ? (
            <button onClick={onClose} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
              Ver vagas encontradas
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-xs py-1">
              <IconSpinner /><span>Isso pode levar alguns minutos...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Vagas() {
  const [jobs, setJobs] = useState([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('new');
  const [minScore, setMinScore] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  // Carrega nível do perfil como filtro padrão
  useEffect(() => {
    axios.get('/api/profile').then(r => {
      if (r.data?.level) setLevelFilter(r.data.level);
    });
  }, []);

  // Busca última vez escaneado
  const loadLastScan = async () => {
    try {
      const { data } = await axios.get('/api/sources');
      const scanned = data.filter(s => s.last_scan).map(s => s.last_scan);
      if (scanned.length > 0) {
        const latest = scanned.sort().at(-1);
        setLastScan(latest);
      }
    } catch {}
  };

  const load = async () => {
    const params = { status: filter };
    if (minScore) params.min_score = minScore;
    const { data } = await axios.get('/api/jobs', { params });
    const filtered = levelFilter ? data.filter(j => !j.level || j.level === levelFilter) : data;
    setJobs(filtered);
  };

  useEffect(() => { load(); loadLastScan(); }, [filter, minScore, levelFilter]);

  const addManual = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await axios.post('/api/jobs/manual', { url });
      setUrl('');
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao adicionar vaga');
    } finally {
      setLoading(false);
    }
  };

  const markInterest = async (id) => {
    await axios.post(`/api/jobs/${id}/interest`);
    load();
  };

  const ignore = async (id) => {
    await axios.post(`/api/jobs/${id}/ignore`);
    load();
  };

  const clearAllJobs = async () => {
    await axios.delete('/api/jobs/all');
    setShowClearConfirm(false);
    load();
  };

  const formatLastScan = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'Z'); // SQLite salva sem timezone
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)} dia${Math.floor(diff / 86400) > 1 ? 's' : ''}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {showScanModal && (
        <ScanModal
          onDone={() => { load(); loadLastScan(); }}
          onClose={() => setShowScanModal(false)}
        />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-white font-semibold text-base mb-1">Apagar todas as vagas?</h3>
            <p className="text-slate-400 text-sm mb-6">Isso remove todas as vagas do banco, incluindo as que você marcou como interessante. Não tem como desfazer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={clearAllJobs}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Apagar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Vagas</h1>
          {lastScan && (
            <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
              <IconClock />
              <span>Último scan {formatLastScan(lastScan)}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white text-sm rounded-lg font-medium transition-colors"
            title="Apagar todas as vagas"
          >
            Apagar vagas
          </button>
          <button
            onClick={() => setShowScanModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Escanear agora
          </button>
        </div>
      </div>

      {/* Adicionar manual */}
      <div className="bg-slate-800 rounded-xl p-4 flex gap-3">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addManual()}
          placeholder="Cole a URL de uma vaga aqui..."
          className="flex-1 bg-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={addManual}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {loading ? 'Analisando...' : 'Analisar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {[['new', 'Novas'], ['interested', 'Interessantes'], ['ignored', 'Ignoradas']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="0" max="5" step="0.5"
          value={minScore}
          onChange={e => setMinScore(e.target.value)}
          placeholder="Score mín."
          className="bg-slate-800 text-white placeholder-slate-500 rounded-lg px-3 py-1.5 text-sm w-28 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {[['', 'Todos'], ['junior', 'Júnior'], ['pleno', 'Pleno'], ['senior', 'Sênior']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setLevelFilter(v)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${levelFilter === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {jobs.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            Nenhuma vaga encontrada. Cole uma URL ou clique em "Escanear agora".
          </div>
        )}
        {jobs.map(job => (
          <div key={job.id} className="bg-slate-800 rounded-xl p-5 flex gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <a href={job.url} target="_blank" rel="noreferrer"
                    className="text-white font-semibold hover:text-indigo-400 transition-colors">
                    {job.title}
                  </a>
                  <p className="text-slate-400 text-sm mt-0.5">{job.company} · {job.location}</p>
                </div>
                {job.score != null && (
                  <span className={`text-lg font-bold shrink-0 ${scoreColor(job.score)}`}>
                    {job.score.toFixed(1)}
                  </span>
                )}
              </div>
              {job.description && (
                <p className="text-slate-400 text-sm mt-2 line-clamp-3">{job.description}</p>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {job.modality && (
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                    {modalityLabel[job.modality] || job.modality}
                  </span>
                )}
                {job.level && (
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full capitalize">
                    {job.level}
                  </span>
                )}
                <span className="text-xs bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                  {job.source}
                </span>
              </div>
            </div>
            {filter === 'new' && (
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => markInterest(job.id)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg font-medium transition-colors"
                >
                  Tenho interesse
                </button>
                <button
                  onClick={() => ignore(job.id)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                >
                  Ignorar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
