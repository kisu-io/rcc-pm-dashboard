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

export default function StatusChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold mb-3 text-sm">Project by Status</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
          <XAxis dataKey="status" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
          <Tooltip />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.status} fill={COLORS[d.status] || '#2563eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
