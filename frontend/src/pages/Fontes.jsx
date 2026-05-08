import { useState, useEffect } from 'react';
import axios from 'axios';

const statusInfo = {
  pending: { label: 'Aguardando', color: 'text-slate-400', dot: 'bg-slate-500' },
  running: { label: 'Escaneando', color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' },
  ok: { label: 'Funcionando', color: 'text-green-400', dot: 'bg-green-400' },
  error: { label: 'Erro', color: 'text-red-400', dot: 'bg-red-400' },
};

const fmt = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Fontes() {
  const [sources, setSources] = useState([]);
  const [logs, setLogs] = useState({});
  const [openLog, setOpenLog] = useState(null);

  const load = async () => {
    const { data } = await axios.get('/api/sources');
    setSources(data);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id) => {
    await axios.patch(`/api/sources/${id}/toggle`);
    load();
  };

  const loadLog = async (id) => {
    if (openLog === id) { setOpenLog(null); return; }
    const { data } = await axios.get(`/api/sources/${id}/logs`);
    setLogs(l => ({ ...l, [id]: data }));
    setOpenLog(id);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Fontes de vagas</h1>
        <p className="text-slate-500 text-sm">Scan automático todo dia às 8h</p>
      </div>

      <div className="space-y-3">
        {sources.map(src => {
          const st = statusInfo[src.last_status] || statusInfo.pending;
          return (
            <div key={src.id} className="bg-slate-800 rounded-xl overflow-hidden">
              <div className="p-5 flex items-center gap-4">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold">{src.name}</p>
                    <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                    {src.jobs_today > 0 && (
                      <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">
                        {src.jobs_today} hoje
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{src.url}</p>
                  <p className="text-slate-600 text-xs mt-0.5">Último scan: {fmt(src.last_scan)}</p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => loadLog(src.id)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Histórico
                  </button>
                  <button
                    onClick={() => toggle(src.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                      src.active
                        ? 'bg-green-900 text-green-300 hover:bg-red-900 hover:text-red-300'
                        : 'bg-slate-700 text-slate-400 hover:bg-green-900 hover:text-green-300'
                    }`}
                  >
                    {src.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>

              {openLog === src.id && (
                <div className="border-t border-slate-700 p-4 space-y-2">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Últimos scans</p>
                  {(logs[src.id] || []).length === 0 && (
                    <p className="text-slate-600 text-sm">Nenhum scan registrado ainda.</p>
                  )}
                  {(logs[src.id] || []).map(log => (
                    <div key={log.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-slate-400 w-32 shrink-0">{fmt(log.ran_at)}</span>
                      <span className="text-slate-300">{log.jobs_found} vagas encontradas</span>
                      {log.error && <span className="text-red-400 truncate">{log.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
