'use client';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// S-curve: Planned vs Actual cumulative completion
const data = [
  { week: 'W1', planned: 5, actual: 4 },
  { week: 'W2', planned: 12, actual: 10 },
  { week: 'W3', planned: 22, actual: 18 },
  { week: 'W4', planned: 35, actual: 30 },
  { week: 'W5', planned: 50, actual: 42 },
  { week: 'W6', planned: 65, actual: 55 },
];

export default function ProgressChart() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <h3 className="font-semibold mb-3 text-sm">Project Progress (S-curve)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="planned" stroke="#2563eb" fill="url(#p)" name="Planned" />
          <Area type="monotone" dataKey="actual" stroke="#22c55e" fill="url(#a)" name="Actual" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
