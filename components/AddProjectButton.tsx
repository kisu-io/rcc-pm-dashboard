'use client';
import { useRouter } from 'next/navigation';
import AddProjectModal from './AddProjectModal';

export default function AddProjectButton() {
  const router = useRouter();
  return <AddProjectModal onSaved={() => router.refresh()} />;
}