import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const fmt = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function TemplateUpload() {
  const [template, setTemplate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    axios.get('/api/pdfs/template').then(r => {
      if (r.data && r.data.name) setTemplate(r.data);
    });
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1];
      await axios.post('/api/pdfs/template', { data: base64, name: file.name });
      const r = await axios.get('/api/pdfs/template');
      setTemplate(r.data);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-slate-900 dark:text-white font-semibold text-base">Template de layout</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          O Gemini vai usar este HTML como base de layout ao gerar currículos personalizados para cada vaga.
        </p>
      </div>

      {template ? (
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3">
          <div className="w-9 h-9 shrink-0 bg-red-100 dark:bg-red-950 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{template.name}</p>
            <p className="text-slate-400 text-xs mt-0.5">Enviado em {fmt(template.uploaded_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/api/pdfs/template/download"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Visualizar
            </a>
            <button
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              Substituir
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors disabled:opacity-50"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-sm font-medium">{uploading ? 'Enviando...' : 'Clique para enviar o HTML de template'}</span>
          <span className="text-xs">Apenas arquivos .html</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".html"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export default function Curriculos() {
  const [pdfs, setPdfs] = useState([]);

  useEffect(() => {
    axios.get('/api/pdfs').then(r => setPdfs(r.data));
  }, []);

  const scoreColor = (s) => {
    if (s >= 4) return 'text-green-400';
    if (s >= 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Currículos</h1>

      <TemplateUpload />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-slate-900 dark:text-white font-semibold text-base border-b border-slate-200 dark:border-slate-700 pb-3">
          Gerados para vagas
        </h2>

        {pdfs.length === 0 ? (
          <p className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">
            Nenhum currículo gerado ainda. Marque vagas como interessantes e gere os PDFs na aba Candidaturas.
          </p>
        ) : (
          <div className="space-y-3">
            {pdfs.map(pdf => (
              <div key={pdf.id} className="flex items-center gap-4 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white font-semibold truncate">{pdf.title}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{pdf.company}</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Gerado em {fmt(pdf.created_at)}</p>
                </div>
                {pdf.score && (
                  <span className={`text-lg font-bold shrink-0 ${scoreColor(pdf.score)}`}>
                    {pdf.score.toFixed(1)}
                  </span>
                )}
                <a
                  href={`/api/pdfs/download/${pdf.job_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg font-medium transition-colors"
                >
                  Baixar PDF
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
