'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, ListTodo, Calendar,
  FileText, Wallet, Boxes, Users, HardHat, Menu, X, CalendarDays, LogOut,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks', label: 'Tasks (Kanban)', icon: ListTodo },
  { href: '/gantt', label: 'Gantt', icon: Calendar },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/budget', label: 'Budget & Cost', icon: Wallet },
  { href: '/materials', label: 'Materials', icon: Boxes },
  { href: '/team', label: 'Team', icon: Users },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { user, role, signOut } = useAuth();

  const roleBadge: Record<string, string> = {
    pm: 'bg-blue-500/20 text-blue-300',
    admin: 'bg-purple-500/20 text-purple-300',
    viewer: 'bg-slate-500/20 text-slate-300',
    anonymous: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-[#0F1B3D] text-white flex items-center justify-between px-4 h-14 shadow-md">
        <div className="flex items-center gap-2">
          <HardHat className="text-[#22c55e]" size={22} />
          <span className="font-bold">RCC PM</span>
        </div>
        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-lg hover:bg-white/10"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Overlay (mobile) */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on md+ */}
      <aside
        className={`fixed md:static top-14 md:top-0 left-0 z-50 md:z-auto
          w-60 bg-[#0F1B3D] text-white flex flex-col py-5 px-3 shrink-0
          h-[calc(100vh-3.5rem)] md:h-screen
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="flex items-center gap-2 px-3 mb-8">
          <HardHat className="text-[#22c55e]" size={26} />
          <span className="font-bold text-lg">RCC PM</span>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-[#2563eb] text-white' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-3 space-y-3">
          {/* User info + logout */}
          {user && (
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{user.email}</div>
                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full mt-0.5 ${roleBadge[role] || roleBadge.anonymous}`}>
                    {role}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-1.5 rounded hover:bg-white/10 text-slate-300"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          )}
          <div className="text-xs text-slate-400">
            Royal Canary Corp © 2026
          </div>
        </div>
      </aside>

      {/* Spacer for mobile top bar */}
      <div className="md:hidden h-14" />
    </>
  );
}