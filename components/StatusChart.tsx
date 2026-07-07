'use client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const COLORS: Record<string, string> = {
  'Not Started': '#94a3b8',
  'In Progress': '#2563eb',
  'On Hold': '#f59e0b',
  'Complete': '#22c55e',
  'Pending': '#a855f7',
  'Upcoming': '#06b6d4',
};

type Datum = { status: string; count: number; projects: string[] };

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  if (!d.count) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 max-w-[220px] text-xs">
      <div className="font-semibold mb-1 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: COLORS[d.status] || '#2563eb' }} />
        {d.status} · {d.count}
      </div>
      {d.projects.length > 0 ? (
        <ul className="space-y-0.5 text-[10px] text-slate-600">
          {d.projects.map((n) => (
            <li key={n} className="truncate">• {n}</li>
          ))}
        </ul>
      ) : (
        <div className="text-[10px] text-slate-400">No projects</div>
      )}
    </div>
  );
}

export default function StatusChart({ data }: { data: Datum[] }) {
  const hasData = data.some((d) => d.count > 0);
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold mb-3 text-sm">Project by Status</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
          <XAxis dataKey="status" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.status} fill={COLORS[d.status] || '#2563eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend with project names */}
      {hasData && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 max-h-[120px] overflow-y-auto">
          {data.filter((d) => d.count > 0).map((d) => (
            <div key={d.status} className="text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[d.status] || '#2563eb' }} />
                <span className="font-medium text-slate-700">{d.status}</span>
                <span className="text-slate-400">({d.count})</span>
              </div>
              {d.projects.length > 0 && (
                <div className="ml-3.5 text-[10px] text-slate-500 truncate">
                  {d.projects.join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}