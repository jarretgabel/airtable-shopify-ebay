import type { UserRole } from '@/stores/auth/authTypes';

const FULL_ACCESS = ['What items are in testing?', 'What items are awaiting pre-listing review?', 'How many items are at each stage?', 'How do I create a new intake item?'];

const SUGGESTIONS_BY_ROLE: Record<UserRole, string[]> = {
  admin: FULL_ACCESS,
  owner: FULL_ACCESS,
  developer: FULL_ACCESS,
  processor: ['What items are awaiting pre-listing review?', 'What items are in testing?', 'How many items are at each stage?', 'Help me create a new intake item'],
  tester: ['What items are left to test?', 'What happens after testing?', 'Help me fill out the testing form for this item'],
  photographer: ['What items need to be photographed?', 'What happens after photography?', 'Help me fill out the photography form for this item'],
};

export function getAssistantSuggestions(role: UserRole | undefined): string[] {
  return (role && SUGGESTIONS_BY_ROLE[role]) || SUGGESTIONS_BY_ROLE.admin;
}
