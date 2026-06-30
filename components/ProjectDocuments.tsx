'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase, DocumentRow, Project } from '@/lib/supabase';
import UploadDropzone from '@/components/UploadDropzone';
import UniversalPreview from '@/components/UniversalPreview';
import {
  FileText, Image as ImageIcon, File, Video, Music, FileSpreadsheet,
  Folder, Trash2, Download, Pencil, MoreVertical, ExternalLink, Loader2,
  ChevronRight, Home, FolderPlus, Search,
} from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eyxqbpcgrunksmirsiia.supabase.co';
const BUCKETS = ['documents', 'site-photos', 'reports'] as const;
type Bucket = typeof BUCKETS[number];

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function fileIcon(name: string, isFolder?: boolean, size = 18) {
  if (isFolder) return <Folder size={size} className="text-blue-500" />;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(name)) return <ImageIcon size={size} className="text-blue-500" />;
  if (/\.(mp4|mov|webm|avi|mkv)$/i.test(name)) return <Video size={size} className="text-purple-500" />;
  if (/\.(mp3|wav|ogg|m4a)$/i.test(name)) return <Music size={size} className="text-pink-500" />;
  if (/\.(xlsx|xls|csv)$/i.test(name)) return <FileSpreadsheet size={size} className="text-green-600" />;
  if (/\.pdf$/i.test(name)) return <FileText size={size} className="text-red-500" />;
  if (/\.(docx?|rtf|odt)$/i.test(name)) return <FileText size={size} className="text-indigo-500" />;
  return <File size={size} className="text-slate-500" />;
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isPreviewable(name: string) {
  return /\.(png|jpe?g|webp|gif|svg|pdf|docx?|xlsx|xls|csv|mp4|webm|mov|mp3|wav|ogg|txt|md)$/i.test(name);
}

export default function ProjectDocuments({ project }: { project: Project }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>('documents');
  const [folder, setFolder] = useState('');
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSetCover, setShowSetCover] = useState<DocumentRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    if (error) console.error('[ProjectDocuments] fetch error:', error.message);
    setDocs((data as DocumentRow[]) || []);
    setLoading(false);
    setMenuOpen(null);
  }, [project.id]);

  useEffect(() => { refresh(); }, [refreshKey, refresh]);

  const inBucket = docs.filter((d) => d.bucket === bucket);
  const visible = folder
    ? inBucket.filter((d) => (d.folder_path || '') === folder)
    : inBucket.filter((d) => !d.folder_path); // root only

  // Folders first, then files; sort by date desc
  visible.sort((a, b) => {
    if ((a.is_folder ? 1 : 0) !== (b.is_folder ? 1 : 0)) return (b.is_folder ? 1 : 0) - (a.is_folder ? 1 : 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  async function openFolder(d: DocumentRow) {
    if (!d.is_folder) return;
    const newPath = d.folder_path ? `${d.folder_path}/${d.name}` : d.name;
    setFolder(newPath);
    setMenuOpen(null);
  }

  async function deleteDoc(d: DocumentRow) {
    if (!confirm(`Delete ${d.is_folder ? 'folder' : 'file'} "${d.name}"?`)) return;
    if (!d.is_folder) await supabase.storage.from(d.bucket).remove([d.path]);
    await supabase.from('documents').delete().eq('id', d.id);
    setRefreshKey((k) => k + 1);
    setSelected(null);
  }

  async function setAsCover(d: DocumentRow) {
    if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(d.name)) {
      alert('Cover phải là file ảnh');
      return;
    }
    const url = publicUrl(d.bucket, d.path);
    const { error } = await supabase.from('projects').update({ cover_url: url }).eq('id', project.id);
    if (error) { alert(error.message); return; }
    setShowSetCover(null);
    alert('Cover updated. Reload page to see.');
    window.location.reload();
  }

  const breadcrumb = folder ? folder.split('/').filter(Boolean).map((part, i, arr) => {
    const p = arr.slice(0, i + 1).join('/');
    return { name: part, path: p };
  }) : [];

  return (
    <div className="space-y-3">
      {/* Bucket tabs */}
      <div className="flex flex-wrap gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b}
            onClick={() => { setBucket(b); setFolder(''); }}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1
              ${bucket === b ? 'bg-[#0F1B3D] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Folder size={12} /> {b}
          </button>
        ))}
      </div>

      {/* Breadcrumb */}
      {folder && (
        <div className="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
          <button onClick={() => setFolder('')} className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-100">
            <Home size={11} /> Root
          </button>
          {breadcrumb.map((c, i) => (
            <span key={c.path} className="flex items-center gap-1">
              <ChevronRight size={11} className="text-slate-400" />
              <button onClick={() => setFolder(c.path)} className={`px-1 py-0.5 rounded hover:bg-slate-100 ${i === breadcrumb.length - 1 ? 'font-semibold' : ''}`}>
                {c.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Upload — always into current folder, auto-attach to project */}
      {!folder || folder === '' ? (
        <UploadDropzone
          bucket={bucket}
          projectId={project.id}
          folderPath={folder}
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
      ) : (
        <UploadDropzone
          bucket={bucket}
          projectId={project.id}
          folderPath={folder}
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Files */}
      <div className="bg-white rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">
            {loading ? 'Loading…' : `${visible.length} items in ${bucket}`}
          </h3>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400">
            <Loader2 className="animate-spin mx-auto mb-2" size={22} />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Folder size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">No files yet. Upload above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {visible.map((d) => (
              <div key={d.id} className="border border-slate-200 rounded-lg p-2 hover:bg-slate-50 group relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === d.id ? null : d.id); }}
                  className="absolute top-1 right-1 p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100"
                  aria-label="Actions"
                ><MoreVertical size={12} /></button>
                {menuOpen === d.id && (
                  <div className="absolute top-6 right-1 z-20 bg-white shadow-lg border border-slate-200 rounded-lg text-xs w-36 py-1">
                    {!d.is_folder && isPreviewable(d.name) && (
                      <button onClick={() => { setSelected(d); setMenuOpen(null); }} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1.5"><ExternalLink size={11} /> Preview</button>
                    )}
                    {!d.is_folder && (
                      <a href={publicUrl(d.bucket, d.path)} download className="w-full text-left px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1.5"><Download size={11} /> Download</a>
                    )}
                    {!d.is_folder && /\.(png|jpe?g|webp|gif|svg)$/i.test(d.name) && (
                      <button onClick={() => { setShowSetCover(d); setMenuOpen(null); }} className="w-full text-left px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1.5"><ImageIcon size={11} /> Set as cover</button>
                    )}
                    <button onClick={() => deleteDoc(d)} className="w-full text-left px-2 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-1.5"><Trash2 size={11} /> Delete</button>
                  </div>
                )}
                <div
                  onClick={() => d.is_folder ? openFolder(d) : isPreviewable(d.name) && setSelected(d)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-center h-10 mb-1">{fileIcon(d.name, d.is_folder, 28)}</div>
                  <div className="text-xs font-medium truncate" title={d.name}>{d.name}</div>
                  <div className="text-[10px] text-slate-400">{d.is_folder ? 'Folder' : formatSize(d.size)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal — universal */}
      {selected && !selected.is_folder && (
        <UniversalPreview doc={selected} onClose={() => setSelected(null)} />
      )}

      {/* Set cover confirmation */}
      {showSetCover && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowSetCover(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-2">Set "{showSetCover.name}" as project cover?</h3>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowSetCover(null)} className="text-xs px-3 py-1.5 rounded hover:bg-slate-100">Cancel</button>
              <button onClick={() => setAsCover(showSetCover)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Set cover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}