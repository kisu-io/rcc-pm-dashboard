import { redirect } from 'next/navigation';
import { getServerRole, listUsersWithRoles } from '@/lib/data-server';
import AdminUsersTable from '@/components/AdminUsersTable';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const role = await getServerRole();

  if (role !== 'admin') {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><ShieldAlert size={20} /> Admin</h1>
          <p className="text-xs md:text-sm text-slate-500">User management</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <ShieldAlert className="text-red-500 mx-auto mb-2" size={32} />
          <h2 className="font-semibold text-sm text-red-700">Admin only</h2>
          <p className="text-xs text-red-600 mt-1">
            Bạn cần role <strong>admin</strong> để truy cập trang này.
          </p>
          <p className="text-[10px] text-red-500 mt-2">
            Yêu cầu admin hiện tại promote role cho bạn trong Supabase Studio → <code>user_roles</code> table.
          </p>
        </div>
      </div>
    );
  }

  const users = await listUsersWithRoles();

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><ShieldAlert size={20} /> Admin · Users</h1>
        <p className="text-xs md:text-sm text-slate-500">Manage users, roles, and invitations</p>
      </div>
      <AdminUsersTable initialUsers={users} />
    </div>
  );
}