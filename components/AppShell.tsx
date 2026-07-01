'use client';
import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
import LoginGate from '@/components/LoginGate';
import { Loader2 } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1B3D] flex items-center justify-center text-white">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-3" size={32} />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginGate />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 w-full min-w-0 p-4 md:p-6 pt-20 md:pt-6 overflow-x-hidden">{children}</main>
    </div>
  );
}