'use client';
import { useSignedUrl } from '@/lib/storage';
import { parseStorageRef } from '@/lib/documents';

/**
 * Renders a project cover from either an external image URL or a reference to an
 * object in a private bucket (`storage://bucket/path`), which has to be signed
 * before the browser can fetch it.
 */
export default function ProjectCoverImage({ coverUrl, alt }: { coverUrl: string | null; alt: string }) {
  const ref = parseStorageRef(coverUrl);
  const { url: signed } = useSignedUrl(ref?.bucket ?? null, ref?.path ?? null);
  const src = ref ? signed : coverUrl;
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
}
