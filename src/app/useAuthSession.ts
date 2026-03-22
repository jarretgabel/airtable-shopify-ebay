import { useEffect, useMemo } from 'react';
import { getAccessiblePages, getCurrentUser } from '@/stores/auth/authContextHelpers';
import { useAuthStore } from '@/stores/auth/authStore';

export function useAuthSession() {
  const users = useAuthStore((state) => state.users);
  const usersLoading = useAuthStore((state) => state.usersLoading);
  const usersReady = useAuthStore((state) => state.usersReady);
  const initializeUsers = useAuthStore((state) => state.initializeUsers);
  const currentUserId = useAuthStore((state) => state.currentUserId);
  const requiresPasswordChange = useAuthStore((state) => state.requiresPasswordChange);
  const canAccessPage = useAuthStore((state) => state.canAccessPage);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    void initializeUsers();
  }, [initializeUsers]);

  const currentUser = useMemo(() => getCurrentUser(users, currentUserId), [users, currentUserId]);
  const accessiblePages = useMemo(() => getAccessiblePages(currentUser), [currentUser]);

  return {
    users,
    usersLoading,
    usersReady,
    currentUser,
    requiresPasswordChange,
    accessiblePages,
    canAccessPage,
    logout,
  };
}
