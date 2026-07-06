import { getServerRole, getActivityLog } from '@/lib/data-server';
import { ShieldAlert, ScrollText } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ACTION_COLOR: Record<string, string> = {
  insert: 'text-green-600',
  update: 'text-blue-600',
  delete: 'text-red-600',
};

export default async function AdminActivityPage() {
  const role = await getServerRole();

  if (role !== 'admin') {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><ShieldAlert size={20} /> Admin · Activity</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <ShieldAlert className="text-red-500 mx-auto mb-2" size={32} />
          <h2 className="font-semibold text-sm text-red-700">Admin only</h2>
          <p className="text-xs text-red-600 mt-1">Bạn cần role <strong>admin</strong> để xem activity log.</p>
        </div>
      </div>
    );
  }

  const log = await getActivityLog(100);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2"><ScrollText size={20} /> Admin · Activity Log</h1>
        <p className="text-xs md:text-sm text-slate-500">Recent 100 writes across all tables (append-only, trigger-backed)</p>
      </div>

      {log.length === 0 ? (
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <ScrollText className="text-slate-300 mx-auto mb-2" size={32} />
          <p className="text-xs text-slate-400">No activity yet. Run the <code>supabase-phase5.sql</code> migration to enable logging.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm overflow-x-auto">
          <table className="w-full text-xs md:text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-slate-400 text-[10px]">
                <th className="pb-2">Time</th><th>Actor</th><th>Action</th><th>Table</th><th>Row</th><th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {log.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-2 whitespace-nowrap text-slate-500">{new Date(row.ts).toLocaleString()}</td>
                  <td className="py-2 pr-2 font-mono text-[10px] text-slate-500">{row.actor ? row.actor.slice(0, 8) : '—'}</td>
                  <td className={`py-2 pr-2 font-medium ${ACTION_COLOR[row.action] || ''}`}>{row.action}</td>
                  <td className="py-2 pr-2">{row.table_name}</td>
                  <td className="py-2 pr-2 font-mono text-[10px] text-slate-400">{row.row_id ? row.row_id.slice(0, 8) : '—'}</td>
                  <td className="py-2 pr-2 text-slate-600 max-w-md">
                    {row.action === 'delete' && row.before?.name ? String(row.before.name) :
                     row.after?.name ? String(row.after.name) :
                     row.after?.title ? String(row.after.title) :
                     row.after?.description ? String(row.after.description) :
                     row.after?.email ? String(row.after.email) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}