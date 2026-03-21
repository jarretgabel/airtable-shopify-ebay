import { useMemo } from 'react';
import { getAccessiblePages, getCurrentUser } from '@/stores/auth/authContextHelpers';
import { useAuthStore } from '@/stores/auth/authStore';

export function useAuthSession() {
  const users = useAuthStore((state) => state.users);
  const currentUserId = useAuthStore((state) => state.currentUserId);
  const canAccessPage = useAuthStore((state) => state.canAccessPage);
  const logout = useAuthStore((state) => state.logout);

  const currentUser = useMemo(() => getCurrentUser(users, currentUserId), [users, currentUserId]);
  const accessiblePages = useMemo(() => getAccessiblePages(currentUser), [currentUser]);

  return {
    users,
    currentUser,
    accessiblePages,
    canAccessPage,
    logout,
  };
}
