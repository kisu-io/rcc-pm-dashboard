'use client';
import { useAuth } from '@/components/AuthProvider';

/** Returns true if the current user can mutate (PM or admin). */
export function useCanEdit(): boolean {
  const { role } = useAuth();
  return role === 'pm' || role === 'admin';
}

/** Returns true if the current user is logged in at all. */
export function useIsAuthed(): boolean {
  const { user } = useAuth();
  return !!user;
}