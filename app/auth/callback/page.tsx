'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/');
      }
    });
    // Also try to get session immediately (hash-based callback)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/');
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0F1B3D] flex items-center justify-center text-white">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto mb-3" size={32} />
        <p className="text-sm">Signing in…</p>
      </div>
    </div>
  );
}