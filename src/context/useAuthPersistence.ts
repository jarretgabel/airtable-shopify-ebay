import { Dispatch, SetStateAction, useEffect } from 'react';
import { RESET_KEY, SESSION_KEY, USERS_KEY } from '@/context/authStorage';
import { pruneExpiredTokens } from '@/context/authContextHelpers';
import type { AppUser, PasswordResetToken } from '@/context/authTypes';

interface UseAuthPersistenceParams {
  users: AppUser[];
  currentUserId: string | null;
  resetTokens: PasswordResetToken[];
  setResetTokens: Dispatch<SetStateAction<PasswordResetToken[]>>;
}

export function useAuthPersistence({ users, currentUserId, resetTokens, setResetTokens }: UseAuthPersistenceParams): void {
  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(SESSION_KEY, currentUserId);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [currentUserId]);

  useEffect(() => {
    const activeTokens = pruneExpiredTokens(resetTokens);
    localStorage.setItem(RESET_KEY, JSON.stringify(activeTokens));
    if (activeTokens.length !== resetTokens.length) {
      setResetTokens(activeTokens);
    }
  }, [resetTokens, setResetTokens]);
}