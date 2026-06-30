import { getProjects, getTasks, formatVND } from '@/lib/data';
import { Wallet, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  'Complete': 'bg-green-100 text-green-700',
  'Not Started': 'bg-slate-100 text-slate-600',
  'Pending': 'bg-purple-100 text-purple-700',
  'Upcoming': 'bg-cyan-100 text-cyan-700',
};

export default async function BudgetPage() {
  const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);

  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);
  const remaining = totalBudget - totalSpent;
  const utilPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  // At-risk: spent > 80% budget AND not complete
  const atRisk = projects.filter((p) => p.budget && p.status !== 'Complete' && (p.spent / p.budget) > 0.8);
  // Over-budget
  const overBudget = projects.filter((p) => p.budget != null && p.spent > p.budget);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Budget & Cost</h1>
        <p className="text-xs md:text-sm text-slate-500">Portfolio budget vs actual across all projects</p>
      </div>

      {/* Alerts */}
      {(atRisk.length > 0 || overBudget.length > 0) && (
        <div className="space-y-2">
          {overBudget.map((p) => (
            <div key={p.id} className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-red-700">
                <span className="font-semibold">{p.name}</span> vượt ngân sách: {formatVND(p.spent)} / {formatVND(p.budget)}
              </div>
            </div>
          ))}
          {atRisk.filter((p) => !overBudget.includes(p)).map((p) => (
            <div key={p.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-amber-700">
                <span className="font-semibold">{p.name}</span> sắp vượt ngân sách ({Math.round((p.spent / (p.budget || 1)) * 100)}% used)
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase"><Wallet size={12} /> Total committed</div>
          <div className="text-lg md:text-2xl font-bold mt-1">{formatVND(totalBudget)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase"><TrendingDown size={12} /> Spent</div>
          <div className="text-lg md:text-2xl font-bold mt-1 text-amber-600">{formatVND(totalSpent)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase"><TrendingUp size={12} /> Remaining</div>
          <div className="text-lg md:text-2xl font-bold mt-1 text-green-600">{formatVND(remaining)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase">Utilization</div>
          <div className="text-lg md:text-2xl font-bold mt-1">{utilPct}%</div>
          <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, utilPct)}%` }} />
          </div>
        </div>
      </div>

      {/* Per-project table */}
      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm overflow-x-auto">
        <h3 className="font-semibold text-sm mb-3">Per-project breakdown</h3>
        <table className="w-full text-xs md:text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-slate-400 text-[10px]">
              <th className="pb-2">Project</th><th>Status</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const pb = p.budget || 0;
              const pct = pb > 0 ? Math.round((p.spent / pb) * 100) : 0;
              const rem = pb - p.spent;
              const over = p.budget != null && p.spent > p.budget;
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[p.status] || 'bg-slate-100'}`}>{p.status}</span>
                  </td>
                  <td className="text-slate-600">{formatVND(p.budget)}</td>
                  <td className="text-amber-600">{formatVND(p.spent)}</td>
                  <td className={over ? 'text-red-600 font-semibold' : 'text-green-600'}>{formatVND(rem)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e' }} />
                      </div>
                      <span className={over ? 'text-red-600 font-semibold' : ''}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}