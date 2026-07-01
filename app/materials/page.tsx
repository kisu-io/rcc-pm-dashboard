import { getMaterials, getProjects } from '@/lib/data-server';
import { formatVND } from '@/lib/data';
import { Boxes, Clock, AlertTriangle, Package, Truck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  'Pending': '#f59e0b',
  'Ordered': '#2563eb',
  'Delivered': '#22c55e',
  'Delayed': '#ef4444',
};

const STATUS_BG: Record<string, string> = {
  'Pending': 'bg-amber-100 text-amber-700',
  'Ordered': 'bg-blue-100 text-blue-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Delayed': 'bg-red-100 text-red-700',
};

function daysFromNow(d: string | null): number {
  if (!d) return Infinity;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default async function MaterialsPage() {
  const [materials, projects] = await Promise.all([getMaterials(), getProjects()]);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name || '—';

  const stats = {
    total: materials.length,
    pending: materials.filter((m) => m.status === 'Pending').length,
    ordered: materials.filter((m) => m.status === 'Ordered').length,
    delivered: materials.filter((m) => m.status === 'Delivered').length,
    delayed: materials.filter((m) => {
      if (!m.expected_delivery || m.actual_delivery) return false;
      return new Date(m.expected_delivery) < new Date() && m.status !== 'Delivered';
    }).length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Materials</h1>
        <p className="text-xs md:text-sm text-slate-500">Material & equipment tracking — lead times, status, delivery</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase"><Boxes size={12} /> Total</div>
          <div className="text-lg md:text-2xl font-bold mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase"><Clock size={12} /> Pending</div>
          <div className="text-lg md:text-2xl font-bold mt-1 text-amber-500">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase"><Truck size={12} /> Ordered</div>
          <div className="text-lg md:text-2xl font-bold mt-1 text-blue-600">{stats.ordered}</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase"><CheckCircle2 size={12} /> Delivered</div>
          <div className="text-lg md:text-2xl font-bold mt-1 text-green-600">{stats.delivered}</div>
        </div>
      </div>

      {/* Delayed alerts */}
      {stats.delayed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div className="text-xs text-red-700">
            <span className="font-semibold">{stats.delayed} material(s) delayed:</span>{' '}
            {materials.filter((m) => {
              if (!m.expected_delivery || m.actual_delivery) return false;
              return new Date(m.expected_delivery) < new Date() && m.status !== 'Delivered';
            }).map((m) => m.name).join(' · ')}
          </div>
        </div>
      )}

      {/* Materials table */}
      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm overflow-x-auto">
        <h3 className="font-semibold text-sm mb-3">All materials ({materials.length})</h3>
        {materials.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <Boxes size={36} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">No materials yet. Add via Supabase or link from task constraints.</p>
          </div>
        ) : (
          <table className="w-full text-xs md:text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-slate-400 text-[10px]">
                <th className="pb-2">Material</th>
                <th>Project</th>
                <th>Supplier</th>
                <th>Qty</th>
                <th>Lead time</th>
                <th>Ordered</th>
                <th>Expected</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const d = daysFromNow(m.expected_delivery);
                const isDelayed = !m.actual_delivery && m.expected_delivery && new Date(m.expected_delivery) < new Date() && m.status !== 'Delivered';
                return (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2 font-medium">{m.name}{m.notes && <div className="text-[9px] text-slate-400 truncate max-w-[150px]" title={m.notes}>{m.notes}</div>}</td>
                    <td className="text-slate-500 truncate max-w-[120px]">{projName(m.project_id)}</td>
                    <td className="text-slate-500">{m.supplier || '—'}</td>
                    <td className="text-slate-500">{m.quantity ? `${m.quantity} ${m.unit || ''}` : '—'}</td>
                    <td className="text-slate-500">{m.lead_time_days ? `${m.lead_time_days}d` : '—'}</td>
                    <td className="text-slate-500">{m.order_date || '—'}</td>
                    <td className={isDelayed ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                      {m.expected_delivery || '—'}
                      {isDelayed ? ' (delayed)' : d !== Infinity && m.status !== 'Delivered' ? ` (${d}d)` : ''}
                    </td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BG[m.status] || 'bg-slate-100'}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Hint to link constraints */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Link material delays to task constraints</h3>
        <p className="text-xs text-slate-500 mb-3">When a material is delayed, you can update the related task's <code className="px-1 bg-slate-100 rounded">constraint_note</code> to reference it.</p>
        <Link href="/tasks" className="text-xs text-blue-600 hover:underline">Open Kanban →</Link>
      </div>
    </div>
  );
}