'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase, DocumentRow, Project } from '@/lib/supabase';
import UploadDropzone from '@/components/UploadDropzone';
import {
  FileText, Image as ImageIcon, File, Video, Music, FileSpreadsheet,
  Folder, Trash2, Download, Pencil, Search, ChevronRight, Home,
  Grid3x3, List, X, ExternalLink, MoreVertical, FolderPlus, Loader2,
} from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eyxqbpcgrunksmirsiia.supabase.co';
const BUCKETS = ['documents', 'site-photos', 'reports'] as const;
type Bucket = typeof BUCKETS[number];

// ===== Helpers =====

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function fileIcon(name: string, isFolder?: boolean, size = 20) {
  if (isFolder) return <Folder size={size} className="text-blue-500" />;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(name)) return <ImageIcon size={size} className="text-blue-500" />;
  if (/\.(mp4|mov|webm|avi|mkv)$/i.test(name)) return <Video size={size} className="text-purple-500" />;
  if (/\.(mp3|wav|ogg|m4a)$/i.test(name)) return <Music size={size} className="text-pink-500" />;
  if (/\.(xlsx|xls|csv)$/i.test(name)) return <FileSpreadsheet size={size} className="text-green-600" />;
  if (/\.pdf$/i.test(name)) return <FileText size={size} className="text-red-500" />;
  return <File size={size} className="text-slate-500" />;
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-CA'); } catch { return '—'; }
}

function fileExt(name: string) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toUpperCase() : 'FILE';
}

function isPreviewable(name: string) {
  return /\.(png|jpe?g|webp|gif|svg|pdf|mp4|webm|mov|mp3|wav|ogg)$/i.test(name);
}

// ===== Main Component =====

type SortKey = 'name' | 'date' | 'size';

export default function DocumentsDrive({ initialDocs = [], projects }: { initialDocs?: DocumentRow[]; projects: Project[] }) {
  const [docs, setDocs] = useState<DocumentRow[]>(initialDocs);
  const [loading, setLoading] = useState(initialDocs.length === 0);
  const [bucket, setBucket] = useState<Bucket>('documents');
  const [projFilter, setProjFilter] = useState<string>('all');
  const [folder, setFolder] = useState<string>('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<SortKey>('date');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DocumentRow | null>(null);
  const [moving, setMoving] = useState<DocumentRow | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch all documents client-side (bypasses SSR caching issues)
  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (projFilter !== 'all') query = query.eq('project_id', projFilter);
    const { data, error } = await query;
    if (error) {
      console.error('[DocumentsDrive] fetch error:', error.message);
    }
    setDocs((data as DocumentRow[]) || []);
    setLoading(false);
    setMenuOpen(null);
  }, [projFilter]);

  useEffect(() => { refresh(); }, [refreshKey, projFilter]);

  // Filter by bucket + current folder
  const inBucket = useMemo(() => docs.filter((d) => d.bucket === bucket), [docs, bucket]);

  const visible = useMemo(() => {
    let arr: DocumentRow[];
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = inBucket.filter((d) => d.name.toLowerCase().includes(s));
    } else {
      arr = inBucket.filter((d) => (d.folder_path || '') === folder);
    }
    arr.sort((a, b) => {
      if ((a.is_folder ? 1 : 0) !== (b.is_folder ? 1 : 0)) return (b.is_folder ? 1 : 0) - (a.is_folder ? 1 : 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return (b.size || 0) - (a.size || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return arr;
  }, [inBucket, folder, q, sort]);

  const breadcrumb = useMemo(() => {
    if (!folder) return [];
    const parts = folder.split('/').filter(Boolean);
    const crumbs: { name: string; path: string }[] = [];
    let p = '';
    for (const part of parts) {
      p = p ? `${p}/${part}` : part;
      crumbs.push({ name: part, path: p });
    }
    return crumbs;
  }, [folder]);

  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  // ===== Actions =====

  function openFolder(d: DocumentRow) {
    if (!d.is_folder) return;
    const newPath = d.folder_path ? `${d.folder_path}/${d.name}` : d.name;
    setFolder(newPath);
    setMenuOpen(null);
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    const safeName = newFolderName.trim().replace(/[^a-zA-Z0-9._\-\s\u00C0-\u024F]/g, '_');
    const path = folder ? `${folder}/${safeName}` : safeName;
    const projectId = projFilter !== 'all' ? projFilter : projects[0]?.id;
    if (!projectId) {
      alert('Cần chọn project trước khi tạo folder');
      return;
    }
    const { error } = await supabase.from('documents').insert({
      project_id: projectId,
      name: safeName,
      bucket,
      path: `_folders/${path}`,
      folder_path: folder,
      is_folder: true,
      uploaded_by: 'web',
    });
    if (error) { alert(error.message); return; }
    setNewFolderName('');
    setShowNewFolder(false);
    setRefreshKey((k) => k + 1);
  }

  async function deleteDoc(d: DocumentRow) {
    if (!confirm(`Delete ${d.is_folder ? 'folder' : 'file'} "${d.name}"?${d.is_folder ? ' All files inside will also be deleted.' : ''}`)) return;
    if (!d.is_folder) {
      await supabase.storage.from(d.bucket).remove([d.path]);
    } else {
      const { data: children } = await supabase
        .from('documents')
        .select('id,path,bucket')
        .eq('bucket', d.bucket)
        .like('folder_path', `${d.folder_path ? d.folder_path + '/' : ''}${d.name}%`);
      if (children && children.length) {
        const paths = children.map((c) => c.path).filter((p) => !p.startsWith('_folders/'));
        if (paths.length) await supabase.storage.from(d.bucket).remove(paths);
        await supabase.from('documents').delete().in('id', children.map((c) => c.id));
      }
    }
    await supabase.from('documents').delete().eq('id', d.id);
    setRefreshKey((k) => k + 1);
    setSelected(null);
  }

  async function renameDoc(d: DocumentRow, newName: string) {
    if (!newName.trim() || newName === d.name) { setRenaming(null); return; }
    const safe = newName.trim();
    if (d.is_folder) {
      await supabase.from('documents').update({ name: safe }).eq('id', d.id);
      const oldPrefix = d.folder_path ? `${d.folder_path}/${d.name}` : d.name;
      const newPrefix = d.folder_path ? `${d.folder_path}/${safe}` : safe;
      const { data: children } = await supabase.from('documents').select('id, folder_path').like('folder_path', `${oldPrefix}%`);
      if (children) {
        for (const c of children) {
          const newFp = c.folder_path ? c.folder_path.replace(oldPrefix, newPrefix) : c.folder_path;
          await supabase.from('documents').update({ folder_path: newFp }).eq('id', c.id);
        }
      }
    } else {
      const oldPath = d.path;
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = `${Date.now()}-${safe.replace(/\s+/g, '_')}`;
      const newPath = pathParts.join('/');
      const { error: mvErr } = await supabase.storage.from(d.bucket).move(oldPath, newPath);
      if (mvErr) { alert(mvErr.message); return; }
      await supabase.from('documents').update({ name: safe, path: newPath }).eq('id', d.id);
    }
    setRenaming(null);
    setRefreshKey((k) => k + 1);
  }

  async function moveDoc(d: DocumentRow, newFolder: string) {
    await supabase.from('documents').update({ folder_path: newFolder }).eq('id', d.id);
    setMoving(null);
    setRefreshKey((k) => k + 1);
  }

  // ===== UI =====

  const selectCls = 'text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="space-y-4" key={refreshKey}>
      {/* Bucket tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        {BUCKETS.map((b) => (
          <button
            key={b}
            onClick={() => { setBucket(b); setFolder(''); setQ(''); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5
              ${bucket === b ? 'bg-[#0F1B3D] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Folder size={14} /> {b}
          </button>
        ))}
        <select
          value={projFilter}
          onChange={(e) => { setProjFilter(e.target.value); setFolder(''); }}
          className={selectCls + ' ml-auto'}
        >
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search files in this bucket…"
            className="w-full text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <button
          onClick={() => setShowNewFolder(true)}
          className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <FolderPlus size={14} /> New folder
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
          <option value="date">Sort: Date</option>
          <option value="name">Sort: Name</option>
          <option value="size">Sort: Size</option>
        </select>
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5">
          <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-slate-100' : ''}`} aria-label="Grid view"><Grid3x3 size={14} /></button>
          <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-slate-100' : ''}`} aria-label="List view"><List size={14} /></button>
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2">
          <Folder size={18} className="text-blue-500" />
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
            placeholder="Folder name…"
            className="flex-1 text-sm bg-transparent border-0 focus:outline-none"
          />
          <button onClick={createFolder} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded">Create</button>
          <button onClick={() => setShowNewFolder(false)} className="text-xs px-2 py-1 text-slate-500">Cancel</button>
        </div>
      )}

      {/* Breadcrumb */}
      {(folder || breadcrumb.length > 0) && (
        <div className="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
          <button onClick={() => { setFolder(''); setQ(''); }} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100">
            <Home size={12} /> Root
          </button>
          {breadcrumb.map((c, i) => (
            <span key={c.path} className="flex items-center gap-1">
              <ChevronRight size={12} className="text-slate-400" />
              <button onClick={() => { setFolder(c.path); setQ(''); }} className={`px-1.5 py-0.5 rounded hover:bg-slate-100 ${i === breadcrumb.length - 1 ? 'font-semibold' : ''}`}>
                {c.name}
              </button>
            </span>
          ))}
          {q.trim() && <span className="ml-2 text-slate-400">· searching across all folders</span>}
        </div>
      )}

      {/* Upload dropzone */}
      {!q.trim() && (
        <UploadDropzone
          bucket={bucket}
          projectId={projFilter !== 'all' ? projFilter : undefined}
          folderPath={folder}
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Files list */}
      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">
            {loading ? 'Loading…' : q.trim() ? `Search results (${visible.length})` : `${visible.length} items`}
          </h3>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400">
            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
            <p className="text-xs">Loading files…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <Folder size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Empty folder. Upload files or create a subfolder.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
            {visible.map((d) => (
              <div key={d.id} className="border border-slate-200 rounded-lg p-2 hover:bg-slate-50 group relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === d.id ? null : d.id); }}
                  className="absolute top-1 right-1 p-1 rounded hover:bg-slate-200 opacity-0 group-hover:opacity-100"
                  aria-label="File actions"
                ><MoreVertical size={14} /></button>
                {menuOpen === d.id && (
                  <div className="absolute top-7 right-1 z-20 bg-white shadow-lg border border-slate-200 rounded-lg text-xs w-36 py-1">
                    {!d.is_folder && isPreviewable(d.name) && (
                      <button onClick={() => { setSelected(d); setMenuOpen(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2"><ExternalLink size={12} /> Preview</button>
                    )}
                    {!d.is_folder && (
                      <a href={publicUrl(d.bucket, d.path)} download className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2"><Download size={12} /> Download</a>
                    )}
                    <button onClick={() => { setRenaming(d); setMenuOpen(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2"><Pencil size={12} /> Rename</button>
                    <button onClick={() => { setMoving(d); setMenuOpen(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2"><Folder size={12} /> Move</button>
                    <button onClick={() => deleteDoc(d)} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={12} /> Delete</button>
                  </div>
                )}
                <div
                  onClick={() => d.is_folder ? openFolder(d) : isPreviewable(d.name) && setSelected(d)}
                  onDoubleClick={() => d.is_folder ? openFolder(d) : null}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-center h-12 mb-1">{fileIcon(d.name, d.is_folder, 32)}</div>
                  <div className="text-xs font-medium truncate" title={d.name}>{d.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{d.is_folder ? 'Folder' : formatSize(d.size)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="text-left text-slate-400 text-[10px] border-b border-slate-100">
                  <th className="pb-2 pl-1">Name</th><th>Project</th><th>Type</th><th>Size</th><th>Modified</th><th className="text-right pr-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-50 hover:bg-slate-50 group"
                    onClick={() => d.is_folder ? openFolder(d) : isPreviewable(d.name) && setSelected(d)}
                  >
                    <td className="py-2 pl-1">
                      <div className="flex items-center gap-2">
                        {fileIcon(d.name, d.is_folder, 16)}
                        <span className="font-medium truncate max-w-[200px]" title={d.name}>{d.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 truncate max-w-[120px]">{projName(d.project_id)}</td>
                    <td className="text-slate-500">{d.is_folder ? 'Folder' : fileExt(d.name)}</td>
                    <td className="text-slate-500">{d.is_folder ? '—' : formatSize(d.size)}</td>
                    <td className="text-slate-500">{formatDate(d.created_at)}</td>
                    <td className="text-right pr-1">
                      <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        {!d.is_folder && isPreviewable(d.name) && (
                          <button onClick={(e) => { e.stopPropagation(); setSelected(d); }} className="p-1 hover:bg-slate-200 rounded" title="Preview"><ExternalLink size={12} /></button>
                        )}
                        {!d.is_folder && (
                          <a href={publicUrl(d.bucket, d.path)} download onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-slate-200 rounded" title="Download"><Download size={12} /></a>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setRenaming(d); }} className="p-1 hover:bg-slate-200 rounded" title="Rename"><Pencil size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setMoving(d); }} className="p-1 hover:bg-slate-200 rounded" title="Move"><Folder size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteDoc(d); }} className="p-1 hover:bg-red-100 text-red-600 rounded" title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {selected && !selected.is_folder && <PreviewModal doc={selected} onClose={() => setSelected(null)} />}

      {/* Rename modal */}
      {renaming && <RenameModal doc={renaming} onClose={() => setRenaming(null)} onSubmit={(n) => renameDoc(renaming, n)} />}

      {/* Move modal */}
      {moving && (
        <MoveModal
          doc={moving}
          allFolders={inBucket.filter((d) => d.is_folder)}
          onClose={() => setMoving(null)}
          onSubmit={(f) => moveDoc(moving, f)}
        />
      )}
    </div>
  );
}

// ===== Preview Modal =====
function PreviewModal({ doc, onClose }: { doc: DocumentRow; onClose: () => void }) {
  const url = publicUrl(doc.bucket, doc.path);
  const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.name);
  const isPdf = /\.pdf$/i.test(doc.name);
  const isVideo = /\.(mp4|webm|mov)$/i.test(doc.name);
  const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(doc.name);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/80" onClick={onClose}>
      <div className="relative bg-white rounded-xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            {fileIcon(doc.name, false, 18)}
            <span className="text-sm font-medium truncate">{doc.name}</span>
            <span className="text-[10px] text-slate-400">{formatSize(doc.size)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={url} download className="text-xs px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"><Download size={14} /> Download</a>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"><ExternalLink size={14} /> Open</a>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 flex items-center justify-center p-4 min-h-[300px]">
          {isImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={doc.name} className="max-w-full max-h-[80vh] object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={doc.name} className="w-full h-[80vh] border-0" />
          ) : isVideo ? (
            <video src={url} controls className="max-w-full max-h-[80vh]" />
          ) : isAudio ? (
            <audio src={url} controls />
          ) : (
            <div className="text-center text-slate-500">
              <File size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Preview not available for {fileExt(doc.name)} files</p>
              <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">Download to view</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Rename Modal =====
function RenameModal({ doc, onClose, onSubmit }: { doc: DocumentRow; onClose: () => void; onSubmit: (n: string) => void }) {
  const [name, setName] = useState(doc.name);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Rename {doc.is_folder ? 'folder' : 'file'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="p-4">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(name); }} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </div>
        <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded hover:bg-slate-100">Cancel</button>
          <button onClick={() => onSubmit(name)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}

// ===== Move Modal =====
function MoveModal({ doc, allFolders, onClose, onSubmit }: {
  doc: DocumentRow; allFolders: DocumentRow[]; onClose: () => void; onSubmit: (folder: string) => void;
}) {
  const folderPaths = useMemo(() => {
    const set = new Set<string>();
    set.add('');
    for (const f of allFolders) {
      const full = f.folder_path ? `${f.folder_path}/${f.name}` : f.name;
      set.add(full);
    }
    return Array.from(set).sort();
  }, [allFolders]);
  const [target, setTarget] = useState(doc.folder_path || '');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Move "{doc.name}"</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
          {folderPaths.map((p) => (
            <button
              key={p || 'root'}
              onClick={() => setTarget(p)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${target === p ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}
            >
              <Folder size={14} /> {p || 'Root'}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded hover:bg-slate-100">Cancel</button>
          <button onClick={() => onSubmit(target)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Move here</button>
        </div>
      </div>
    </div>
  );
}