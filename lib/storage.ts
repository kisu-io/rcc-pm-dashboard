'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
export { toStorageRef, parseStorageRef } from './documents';

/** How long a signed object URL stays valid. Long enough to read a document, short
 *  enough that a copied link is not a permanent bypass of the bucket policy. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Mint a short-lived signed URL for a private object. Returns null on failure so
 *  callers can render a real error instead of a broken image. */
export async function getSignedUrl(
  bucket: string,
  path: string,
  opts?: { download?: string },
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, opts?.download ? { download: opts.download } : undefined);
  if (error || !data?.signedUrl) {
    console.error('[storage] createSignedUrl failed', bucket, path, error?.message);
    return null;
  }
  return data.signedUrl;
}

/** Resolve a signed URL for use in src/href. `null` while loading or on failure. */
export function useSignedUrl(bucket: string | null, path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!(bucket && path));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!bucket || !path) {
      setUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getSignedUrl(bucket, path).then((signed) => {
      if (cancelled) return;
      setUrl(signed);
      setError(signed ? null : 'Không tạo được link truy cập file.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [bucket, path]);

  return { url, loading, error };
}

/** Download a private object by minting a signed URL at click time. */
export async function downloadFile(bucket: string, path: string, filename: string): Promise<void> {
  const url = await getSignedUrl(bucket, path, { download: filename });
  if (!url) {
    alert('Không tải được file. Bạn có thể không còn quyền truy cập.');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Open a private object in a new tab via a signed URL. */
export async function openFile(bucket: string, path: string): Promise<void> {
  const url = await getSignedUrl(bucket, path);
  if (!url) {
    alert('Không mở được file. Bạn có thể không còn quyền truy cập.');
    return;
  }
  window.open(url, '_blank', 'noreferrer');
}
