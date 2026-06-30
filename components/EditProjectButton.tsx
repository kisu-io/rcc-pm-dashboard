'use client';
import { useRouter } from 'next/navigation';
import { Project } from '@/lib/supabase';
import AddProjectModal from './AddProjectModal';

export default function EditProjectButton({ project }: { project: Project }) {
  const router = useRouter();
  return (
    <AddProjectModal
      project={project}
      trigger="edit"
      onSaved={() => router.refresh()}
    />
  );
}