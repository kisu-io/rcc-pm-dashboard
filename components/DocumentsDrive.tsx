'use client';
import { useState, useMemo, useCallback } from 'react';
import { supabase, DocumentRow, Project } from '@/lib/supabase';
import UploadDropzone from '@/components/UploadDropzone';
import { FileText, Image as ImageIcon, Trash2, Download, Folder } from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eyxqbpcgrunksmirsiia.supabase.co';
const BUCKETS = ['documents', 'site-photos', 'reports'] as const;
type Bucket = typeof BUCKETS[number];

function fileIcon(name: string) {
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(name)) return <ImageIcon size={20} className="text-blue-500" />;
  return <FileText size={20} className="text-slate-500" />;
}

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export default function DocumentsDrive({ initialDocs, projects }: { initialDocs: DocumentRow[]; projects: Project[] }) {
  const [docs, setDocs] = useState(initialDocs);
  const [bucket, setBucket] = useState<Bucket>('documents');
  const [projFilter, setProjFilter] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    let q = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (projFilter !== 'all') q = q.eq('project_id', projFilter);
    const { data } = await q;
    if (data) setDocs(data as DocumentRow[]);
  }, [projFilter]);

  const filtered = useMemo(() => docs.filter((d) => d.bucket === bucket), [docs, bucket]);

  async function deleteDoc(d: DocumentRow) {
    if (!confirm(`Delete ${d.name}?`)) return;
    await supabase.storage.from(d.bucket).remove([d.path]);
    await supabase.from('documents').delete().eq('id', d.id);
    setRefreshKey((k) => k + 1);
    refresh();
  }

  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  return (
    <div className="space-y-4" key={refreshKey}>
      {/* Bucket tabs */}
      <div className="flex flex-wrap gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b}
            onClick={() => setBucket(b)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5
              ${bucket === b ? 'bg-[#0F1B3D] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Folder size={14} /> {b}
          </button>
        ))}
        <select
          value={projFilter}
          onChange={(e) => { setProjFilter(e.target.value); setTimeout(refresh, 0); }}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 ml-auto"
        >
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <UploadDropzone bucket={bucket} onUploaded={refresh} />

      {/* Files grid */}
      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-3">{filtered.length} files in {bucket}</h3>
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No files yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
            {filtered.map((d) => (
              <div key={d.id} className="border border-slate-200 rounded-lg p-2 hover:bg-slate-50 group">
                <div className="flex items-start justify-between mb-1">
                  {fileIcon(d.name)}
                  <button
                    onClick={() => deleteDoc(d)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <a
                  href={publicUrl(d.bucket, d.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium truncate block hover:underline"
                  title={d.name}
                >
                  {d.name}
                </a>
                <div className="text-[10px] text-slate-400 truncate">{projName(d.project_id)}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-slate-400">{new Date(d.created_at).toLocaleDateString()}</span>
                  <a
                    href={publicUrl(d.bucket, d.path)}
                    download
                    className="text-slate-400 hover:text-blue-600"
                    aria-label="Download"
                  >
                    <Download size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}