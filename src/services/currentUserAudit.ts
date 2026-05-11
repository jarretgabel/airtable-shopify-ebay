import { getCurrentUser } from '@/stores/auth/authContextHelpers';
import { useAuthStore } from '@/stores/auth/authStore';

export function resolveCurrentActorName(): string | null {
  const { users, currentUserId } = useAuthStore.getState();
  const currentUser = getCurrentUser(users, currentUserId);
  if (!currentUser) return null;

  const displayName = currentUser.name.trim();
  if (displayName.length > 0) return displayName;

  const email = currentUser.email.trim();
  return email.length > 0 ? email : null;
}