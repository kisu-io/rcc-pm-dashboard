'use client';
import { useEffect, useState } from 'react';
import { DocumentRow } from '@/lib/supabase';
import {
  X, Download, ExternalLink, Loader2, File as FileIcon, AlertTriangle,
} from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eyxqbpcgrunksmirsiia.supabase.co';

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UniversalPreview({ doc, onClose }: { doc: DocumentRow; onClose: () => void }) {
  const url = publicUrl(doc.bucket, doc.path);
  const name = doc.name.toLowerCase();

  const isImg = /\.(png|jpe?g|webp|gif|svg)$/.test(name);
  const isPdf = /\.pdf$/.test(name);
  const isVideo = /\.(mp4|webm|mov)$/.test(name);
  const isAudio = /\.(mp3|wav|ogg|m4a)$/.test(name);
  const isDocx = /\.docx$/.test(name);
  const isXlsx = /\.(xlsx|xls|csv)$/.test(name);
  const isText = /\.(txt|md|csv|json|log)$/.test(name);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/80" onClick={onClose}>
      <div
        className="relative bg-white rounded-xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{doc.name}</span>
            <span className="text-[10px] text-slate-400">{formatSize(doc.size)}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a href={url} download className="text-xs px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"><Download size={13} /> Download</a>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"><ExternalLink size={13} /> Open</a>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-50 flex items-center justify-center p-3 min-h-[280px]">
          {isImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={doc.name} className="max-w-full max-h-[80vh] object-contain" />
          )}
          {isPdf && (
            <iframe src={url} title={doc.name} className="w-full h-[80vh] border-0 bg-white" />
          )}
          {isVideo && (
            <video src={url} controls className="max-w-full max-h-[80vh]" />
          )}
          {isAudio && (
            <audio src={url} controls className="w-full" />
          )}
          {isDocx && <DocxPreview url={url} />}
          {isXlsx && <XlsxPreview url={url} fileName={doc.name} />}
          {isText && <TextPreview url={url} />}
          {!isImg && !isPdf && !isVideo && !isAudio && !isDocx && !isXlsx && !isText && (
            <div className="text-center text-slate-500">
              <FileIcon size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No preview for this file type</p>
              <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">Download to view</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== DOCX preview (Mammoth.js) =====
function DocxPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const mammoth = await import('mammoth/mammoth.browser');
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (cancelled) return;
        setHtml(result.value);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load DOCX');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="text-slate-400"><Loader2 className="animate-spin mx-auto" size={24} /></div>;
  if (error) return <div className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>;
  return (
    <div
      className="prose prose-sm max-w-none p-4 bg-white rounded shadow-sm overflow-auto max-h-[80vh]"
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  );
}

// ===== XLSX/CSV preview (SheetJS) =====
function XlsxPreview({ url, fileName }: { url: string; fileName: string }) {
  const [sheets, setSheets] = useState<{ name: string; rows: any[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buf, { type: 'array' });
        if (cancelled) return;
        const out = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: '' });
          return { name, rows: rows as any[][] };
        });
        setSheets(out);
        setActiveSheet(0);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load spreadsheet');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="text-slate-400"><Loader2 className="animate-spin mx-auto" size={24} /></div>;
  if (error) return <div className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>;
  if (sheets.length === 0) return <div className="text-slate-400 text-sm">Empty spreadsheet</div>;

  const sheet = sheets[activeSheet];

  return (
    <div className="w-full max-h-[80vh] overflow-auto bg-white rounded shadow-sm">
      {sheets.length > 1 && (
        <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={`text-xs px-2.5 py-1 rounded whitespace-nowrap ${i === activeSheet ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <table className="w-full text-xs border-collapse">
        <tbody>
          {sheet.rows.slice(0, 500).map((row, ri) => (
            <tr key={ri} className={ri === 0 ? 'bg-slate-100 font-semibold' : ''}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-slate-100 px-2 py-1 align-top whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                  title={String(cell)}
                >
                  {String(cell ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sheet.rows.length > 500 && <div className="p-2 text-center text-[10px] text-slate-400">Showing first 500 rows of {sheet.rows.length}</div>}
    </div>
  );
}

// ===== Text/CSV/JSON preview =====
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();
        if (cancelled) return;
        setText(txt.slice(0, 100000)); // cap to 100k chars
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load text');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="text-slate-400"><Loader2 className="animate-spin mx-auto" size={24} /></div>;
  if (error) return <div className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>;
  return (
    <pre className="text-xs p-4 bg-white rounded shadow-sm overflow-auto max-h-[80vh] w-full font-mono whitespace-pre-wrap break-words">
      {text}
    </pre>
  );
}