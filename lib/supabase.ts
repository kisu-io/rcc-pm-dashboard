import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

export type Project = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  progress_pct: number;
  budget: number | null;
  spent: number;
  start_date: string | null;
  target_end: string | null;
  pm: string | null;
  cover_url: string | null;
  created_at?: string;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  phase: string | null;
  zone: string | null;
  owner: string | null;
  priority: string;
  kanban_status: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  progress_pct: number;
  due_date: string | null;
  constraint_note: string | null;
  notes: string | null;
  depends_on?: string[] | null;
  lead_time_days?: number | null;
};

export type Milestone = {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  status: string;
  type: string | null;
};

export type DocumentRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  name: string;
  bucket: string;
  path: string;
  uploaded_by: string | null;
  created_at: string;
  size?: number | null;
  mimetype?: string | null;
  folder_path?: string | null;
  is_folder?: boolean;
};

export type Material = {
  id: string;
  project_id: string;
  task_id: string | null;
  name: string;
  category: string | null;
  supplier: string | null;
  quantity: number | null;
  unit: string | null;
  lead_time_days: number | null;
  order_date: string | null;
  expected_delivery: string | null;
  actual_delivery: string | null;
  status: string;
  notes: string | null;
  created_at?: string;
};