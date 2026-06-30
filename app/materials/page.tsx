import { Boxes, Clock, AlertTriangle, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function MaterialsPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Materials</h1>
        <p className="text-xs md:text-sm text-slate-500">Material & equipment tracking — phase 2</p>
      </div>

      <div className="bg-white rounded-xl p-8 md:p-12 text-center shadow-sm">
        <Boxes size={48} className="mx-auto mb-3 text-slate-300" />
        <h2 className="text-base md:text-lg font-semibold text-slate-700">Coming in Phase 4</h2>
        <p className="text-xs md:text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Material lead-time tracking, link constraints to material delays, equipment logistics, and PO management will land here.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 max-w-lg mx-auto">
          <div className="border border-slate-200 rounded-lg p-3">
            <Clock size={18} className="mx-auto text-slate-400 mb-1" />
            <div className="text-[10px] text-slate-400 uppercase">Lead times</div>
            <div className="text-xs text-slate-500 mt-1">Track supplier delivery windows</div>
          </div>
          <div className="border border-slate-200 rounded-lg p-3">
            <AlertTriangle size={18} className="mx-auto text-slate-400 mb-1" />
            <div className="text-[10px] text-slate-400 uppercase">Delay links</div>
            <div className="text-xs text-slate-500 mt-1">Tie constraints to material shortages</div>
          </div>
          <div className="border border-slate-200 rounded-lg p-3">
            <Package size={18} className="mx-auto text-slate-400 mb-1" />
            <div className="text-[10px] text-slate-400 uppercase">PO tracking</div>
            <div className="text-xs text-slate-500 mt-1">Purchase orders & equipment</div>
          </div>
        </div>
      </div>
    </div>
  );
}