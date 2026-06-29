import { LucideIcon } from 'lucide-react';

export default function KpiCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string | number; icon: LucideIcon; accent: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
      <div className="rounded-lg p-3" style={{ background: accent + '1a' }}>
        <Icon size={22} style={{ color: accent }} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}
