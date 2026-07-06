'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Shield, ArrowUp, ArrowDown, Mail, UserPlus } from 'lucide-react';

type UserRow = {
  user_id: string;
  email: string;
  created_at: string;
  role: string;
};

const ROLES = ['viewer', 'pm', 'admin'];

const ROLE_BADGE: Record<string, string> = {
  viewer: 'bg-slate-100 text-slate-600',
  pm: 'bg-blue-100 text-blue-700',
  admin: 'bg-purple-100 text-purple-700',
};

/** Admin-only: list users, promote/demote, magic-link invite. */
export default function AdminUsersTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function setRole(uid: string, newRole: string) {
    setBusyId(uid);
    setMsg(null);
    // Upsert the role
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: uid, role: newRole }, { onConflict: 'user_id' });
    setBusyId(null);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    setUsers((prev) => prev.map((u) => (u.user_id === uid ? { ...u, role: newRole } : u)));
    setMsg({ kind: 'ok', text: 'Role updated' });
  }

  async function invite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setInviting(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    setMsg({ kind: 'ok', text: `Magic link sent to ${inviteEmail.trim()} — they'll appear here after first login.` });
    setInviteEmail('');
  }

  return (
    <div className="space-y-4">
      {/* Invite */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><UserPlus size={14} /> Invite user</h3>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 text-xs md:text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <button
            onClick={invite}
            disabled={inviting || !inviteEmail.trim()}
            className="inline-flex items-center gap-1.5 text-xs bg-[#2563eb] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send magic link
          </button>
        </div>
      </div>

      {msg && (
        <div className={`text-xs rounded-lg p-2 ${msg.kind === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Users list */}
      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm overflow-x-auto">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Shield size={14} /> Users ({users.length})</h3>
        <table className="w-full text-xs md:text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-slate-400 text-[10px]">
              <th className="pb-2">Email</th><th>Joined</th><th>Role</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{u.email}</td>
                <td className="text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ROLE_BADGE[u.role] || 'bg-slate-100'}`}>{u.role}</span>
                </td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => setRole(u.user_id, ROLES[ROLES.indexOf(u.role) + 1])}
                        disabled={busyId === u.user_id}
                        className="inline-flex items-center gap-1 text-[10px] text-blue-600 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50"
                        title="Promote"
                      >
                        {busyId === u.user_id ? <Loader2 size={12} className="animate-spin" /> : <ArrowUp size={12} />} Promote
                      </button>
                    )}
                    {u.role !== 'viewer' && (
                      <button
                        onClick={() => setRole(u.user_id, ROLES[ROLES.indexOf(u.role) - 1])}
                        disabled={busyId === u.user_id}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-600 px-2 py-1 rounded hover:bg-slate-50 disabled:opacity-50"
                        title="Demote"
                      >
                        <ArrowDown size={12} /> Demote
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}