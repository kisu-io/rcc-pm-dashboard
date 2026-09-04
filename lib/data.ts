import { Project, Task, Milestone, DocumentRow, Material } from './supabase';

// ===== Demo data (single sample project with all attributes populated) =====

export const demoProjects: Project[] = [
  {
    id: '1',
    name: 'Le Meridien Fit-out',
    location: 'HCMC',
    status: 'In Progress',
    progress_pct: 0, // 0 = auto-calc from Done/total tasks
    // Matches production, where no budget has been set and cost_entries is
    // empty. Keeping a mock 5e9 here meant dev and CI exercised a code path
    // real users never hit, which is how the project page kept rendering
    // "Budget used 0% / Remaining 0" unnoticed.
    budget: null,
    spent: 0,
    start_date: '2026-06-01',
    target_end: '2026-12-31',
    pm: 'Mr Phán',
    cover_url: 'https://images.unsplash.com/photo-1566073771259-6a760f3f6d2b?w=1200',
    pct_legal: 80,
    pct_design: 95,
    pct_procurement: 45,
    pct_construction: 35,
    pct_sales: 10,
  },
];

export const demoTasks: Task[] = [
  // Pháp lý (Legal)
  { id: 't1', project_id: '1', title: 'Xin giấy phép xây dựng', phase: 'Legal', zone: 'All', owner: 'Phòng pháp chế', priority: 'High', kanban_status: 'Done', planned_start: '2026-06-01', planned_end: '2026-06-15', actual_start: '2026-06-01', actual_end: '2026-06-14', progress_pct: 100, due_date: '2026-06-15', constraint_note: null, notes: 'Đã nhận GPXD số 123/GPXD' },
  { id: 't2', project_id: '1', title: 'Phê duyệt PCCC', phase: 'Legal', zone: 'All', owner: 'Phòng pháp chế', priority: 'High', kanban_status: 'In Progress', planned_start: '2026-06-16', planned_end: '2026-07-10', actual_start: '2026-06-17', actual_end: null, progress_pct: 60, due_date: '2026-07-10', constraint_note: 'Chờ cơ quan PCCC duyệt hồ sơ', notes: null },

  // Thiết kế (Design)
  { id: 't3', project_id: '1', title: 'Bản vẽ thi công (Shop drawings)', phase: 'Design', zone: 'All', owner: 'KTS. Nguyễn Văn A', priority: 'High', kanban_status: 'Done', planned_start: '2026-06-01', planned_end: '2026-06-20', actual_start: '2026-06-02', actual_end: '2026-06-19', progress_pct: 100, due_date: '2026-06-20', constraint_note: null, notes: 'Đã ký duyệt' },
  { id: 't4', project_id: '1', title: 'Mock-up phòng khách sạn', phase: 'Design', zone: 'Floor 12', owner: 'KTS. Nguyễn Văn A', priority: 'Medium', kanban_status: 'Review', planned_start: '2026-06-21', planned_end: '2026-07-05', actual_start: '2026-06-22', actual_end: null, progress_pct: 90, due_date: '2026-07-05', constraint_note: null, notes: 'Chờ chủ đầu tư confirm' },

  // Cung ứng-Đấu thầu (Procurement)
  { id: 't5', project_id: '1', title: 'Đấu thầu gói MEP', phase: 'Procurement', zone: 'All', owner: 'Phòng mua hàng', priority: 'High', kanban_status: 'Done', planned_start: '2026-06-05', planned_end: '2026-06-25', actual_start: '2026-06-05', actual_end: '2026-06-24', progress_pct: 100, due_date: '2026-06-25', constraint_note: null, notes: 'Trúng thầu: Công ty MEP Việt' },
  { id: 't6', project_id: '1', title: 'Đặt hàng vật tư nội thất (Furniture)', phase: 'Procurement', zone: 'All', owner: 'Phòng mua hàng', priority: 'Medium', kanban_status: 'In Progress', planned_start: '2026-06-26', planned_end: '2026-08-15', actual_start: '2026-06-28', actual_end: null, progress_pct: 30, due_date: '2026-08-15', constraint_note: 'Lead time 8 tuần từ Ý', notes: null },

  // Thi công (Construction)
  { id: 't7', project_id: '1', title: 'Demo & dọn mặt bằng', phase: 'Construction', zone: 'Lobby', owner: 'Đội A', priority: 'High', kanban_status: 'Done', planned_start: '2026-06-01', planned_end: '2026-06-10', actual_start: '2026-06-01', actual_end: '2026-06-09', progress_pct: 100, due_date: '2026-06-10', constraint_note: null, notes: null },
  { id: 't8', project_id: '1', title: 'MEP rough-in', phase: 'Construction', zone: 'Floor 2', owner: 'Đội B', priority: 'High', kanban_status: 'In Progress', planned_start: '2026-06-11', planned_end: '2026-07-05', actual_start: '2026-06-12', actual_end: null, progress_pct: 45, due_date: '2026-07-05', constraint_note: 'Chờ vật tư ống đồng', notes: null },
  { id: 't9', project_id: '1', title: 'Drywall partition', phase: 'Construction', zone: 'Floor 2', owner: 'Đội C', priority: 'Medium', kanban_status: 'To Do', planned_start: '2026-07-06', planned_end: '2026-07-20', actual_start: null, actual_end: null, progress_pct: 0, due_date: '2026-07-20', constraint_note: null, notes: null },
  { id: 't10', project_id: '1', title: 'Nghiệm thu PCCC', phase: 'Inspection', zone: 'All', owner: 'QA', priority: 'High', kanban_status: 'Review', planned_start: '2026-06-20', planned_end: '2026-06-28', actual_start: '2026-06-21', actual_end: null, progress_pct: 80, due_date: '2026-06-28', constraint_note: 'Chờ lịch cơ quan PCCC', notes: null },

  // Sales & marketing
  { id: 't11', project_id: '1', title: 'Booking website & launch campaign', phase: 'Sales', zone: 'All', owner: 'Marketing team', priority: 'Medium', kanban_status: 'To Do', planned_start: '2026-09-01', planned_end: '2026-10-15', actual_start: null, actual_end: null, progress_pct: 0, due_date: '2026-10-15', constraint_note: null, notes: 'Soft launch Q4' },
  { id: 't12', project_id: '1', title: 'Press release & KOL tour', phase: 'Marketing', zone: 'All', owner: 'Marketing team', priority: 'Low', kanban_status: 'To Do', planned_start: '2026-11-01', planned_end: '2026-12-01', actual_start: null, actual_end: null, progress_pct: 0, due_date: '2026-12-01', constraint_note: null, notes: null },
];

export const demoMilestones: Milestone[] = [
  { id: 'm1', project_id: '1', name: 'Design sign-off', due_date: '2026-05-15', status: 'Reached', type: 'Permit' },
  { id: 'm2', project_id: '1', name: 'PCCC acceptance', due_date: '2026-06-28', status: 'Pending', type: 'Inspection' },
  { id: 'm3', project_id: '1', name: 'Handover to client', due_date: '2026-12-20', status: 'Pending', type: 'Handover' },
];

// ===== HELPERS =====

export function formatVND(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

export function daysFromNow(d: string | null): number {
  if (!d) return Infinity;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export function isOverdue(t: Task): boolean {
  return t.due_date != null && t.kanban_status !== 'Done' && daysFromNow(t.due_date) < 0;
}

export function isLookAhead(t: Task): boolean {
  return t.kanban_status !== 'Done' && daysFromNow(t.due_date) <= 14;
}

// SPI (Schedule Performance Index) — earned/planned
export function computeSPI(tasks: Task[]): number {
  const planned = tasks.reduce((s, t) => s + (t.planned_end ? Math.max(0, 100 - Math.max(0, daysFromNow(t.planned_end)) * 2) : 0), 0);
  const actual = tasks.reduce((s, t) => s + t.progress_pct, 0);
  return planned > 0 ? actual / planned : 1;
}