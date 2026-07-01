'use client';
import { useCanEdit } from '@/lib/useRole';
import { ReactNode } from 'react';

/** Renders children only if current user can edit (pm/admin role). */
export default function EditGuard({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const canEdit = useCanEdit();
  if (!canEdit) return <>{fallback}</>;
  return <>{children}</>;
}