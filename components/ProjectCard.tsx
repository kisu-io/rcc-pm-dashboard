import Link from 'next/link';
import { Project } from '@/lib/supabase';
import { formatVND, daysFromNow } from '@/lib/data';
import { MapPin, Calendar, User } from 'lucide-react';
import ProjectCoverImage from './ProjectCoverImage';
import { projectStatusBadge } from '@/lib/ui';

export default function ProjectCard({ project, effProgress }: { project: Project; effProgress?: number }) {
  const due = daysFromNow(project.target_end);
  const budgetUtil = project.budget ? Math.round((project.spent / project.budget) * 100) : 0;
  // If effProgress provided (from server), use it; else fall back to stored progress_pct
  const effPct = effProgress != null ? effProgress : (project.progress_pct || 0);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition block"
    >
      {/* Cover */}
      <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 relative">
        <ProjectCoverImage coverUrl={project.cover_url} alt={project.name} />
        <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${projectStatusBadge(project.status)}`}>
          {project.status}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{project.name}</h3>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
            <MapPin size={12} /> <span className="truncate">{project.location || '—'}</span>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>Progress</span>
            <span className="font-semibold text-slate-600">{effPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#2563eb]" style={{ width: `${effPct}%` }} />
          </div>
        </div>

        {/* Budget */}
        {project.budget != null && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Budget {formatVND(project.budget)}</span>
              <span>{budgetUtil}% used</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, budgetUtil)}%` }} />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Spent {formatVND(project.spent)} / {formatVND(project.budget)}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2">
          <div className="flex items-center gap-1 min-w-0">
            <User size={11} className="shrink-0" /> <span className="truncate">{project.pm || '—'}</span>
          </div>
          {project.target_end && (
            <div className={`flex items-center gap-1 shrink-0 ${due < 0 && project.status !== 'Complete' ? 'text-red-600 font-semibold' : ''}`}>
              <Calendar size={11} />
              {due < 0 ? 'quá hạn' : `${due}d`}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}