import { LucideIcon } from 'lucide-react';

export default function KpiCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string | number; icon: LucideIcon; accent: string }) {
  return (
    <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-3 md:gap-4">
      <div className="rounded-lg p-2 md:p-3 shrink-0" style={{ background: accent + '1a' }}>
        <Icon size={18} className="md:hidden" style={{ color: accent }} />
        <Icon size={22} className="hidden md:block" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <div className="text-lg md:text-2xl font-bold truncate">{value}</div>
        <div className="text-[10px] md:text-xs text-slate-500 truncate">{label}</div>
      </div>
    </div>
  );
}