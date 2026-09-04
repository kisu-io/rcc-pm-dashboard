import { getMaterials, getProjects } from '@/lib/data-server';
import { Boxes, Clock, AlertTriangle, Truck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import MaterialsTable from '@/components/MaterialsTable';

export const dynamic = 'force-dynamic';

export default async function MaterialsPage() {
  const [materials, projects] = await Promise.all([getMaterials(), getProjects()]);

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

      {/* Four zero counters and an empty table read as "nothing is late"; they
          should read "nothing is tracked". */}
      {stats.total === 0 && (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <Boxes size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-base font-medium">No materials tracked yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Chưa theo dõi vật tư. Add a material below to track its supplier, lead time and
            delivery against the opening date.
          </p>
        </div>
      )}

      {/* Stats */}
      <div
        className={`grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 ${
          stats.total === 0 ? 'hidden' : ''
        }`}
      >
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

      {/* Materials table (client — add/edit/delete gated to editors) */}
      <MaterialsTable materials={materials} projects={projects} />

      {/* The permanent how-to card that used to sit here explained how to copy a
          material delay into a task's constraint_note. Documentation belongs in
          the repo, not in a card that occupies the page on every visit. */}
    </div>
  );
}