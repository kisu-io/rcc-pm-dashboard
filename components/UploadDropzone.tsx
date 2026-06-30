'use client';
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UploadCloud, Loader2 } from 'lucide-react';

const BUCKETS = ['documents', 'site-photos', 'reports'] as const;
type Bucket = typeof BUCKETS[number];

export default function UploadDropzone({
  projectId, bucket, folderPath = '', onUploaded,
}: {
  projectId?: string;
  bucket: Bucket;
  folderPath?: string;
  onUploaded?: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState(0);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    setUploading(true);
    let ok = 0;
    const filesArr = Array.from(files);
    for (const file of filesArr) {
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Storage path includes folder path for organization
      const storagePath = folderPath ? `${folderPath}/${ts}-${safeName}` : `${ts}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: false });
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      // Insert metadata row with folder_path, size, mimetype
      if (projectId) {
        await supabase.from('documents').insert({
          project_id: projectId,
          name: file.name,
          bucket,
          path: storagePath,
          folder_path: folderPath,
          size: file.size,
          mimetype: file.type || null,
          is_folder: false,
          uploaded_by: 'web',
        });
      }
      ok++;
    }
    setUploading(false);
    setLastCount(ok);
    onUploaded?.();
  }, [projectId, bucket, folderPath, onUploaded]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
      }}
      className={`border-2 border-dashed rounded-xl p-4 md:p-6 text-center transition cursor-pointer
        ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
      onClick={() => document.getElementById('upload-input')?.click()}
    >
      <input
        id="upload-input"
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-blue-500" size={28} />
          <p className="text-xs text-slate-500">Uploading…</p>
        </div>
      ) : (
        <>
          <UploadCloud className="mx-auto text-slate-400 mb-2" size={28} />
          <p className="text-xs md:text-sm text-slate-600 font-medium">
            Kéo-thả file vào đây hoặc bấm để chọn
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {bucket}{folderPath ? ` / ${folderPath}` : ''} · nhiều file OK
          </p>
          {error && <p className="text-[10px] text-red-600 mt-2 break-words">⚠ {error}</p>}
          {lastCount > 0 && !error && <p className="text-[10px] text-green-600 mt-2">✓ {lastCount} file uploaded</p>}
        </>
      )}
    </div>
  );
}