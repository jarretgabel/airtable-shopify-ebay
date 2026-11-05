import { create } from 'zustand';
import type { AssistantIntakeDraft } from '@/services/app-api/ai';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const ASSISTANT_IDLE_RESET_MS = 30 * 60 * 1000;

function isIdleExpired(lastActiveAt: number, now = Date.now()): boolean {
  return now - lastActiveAt > ASSISTANT_IDLE_RESET_MS;
}

interface AssistantStore {
  ownerId: string | null;
  /** Last time the conversation changed; an old conversation is dropped so stale answers don't steer new questions. */
  lastActiveAt: number;
  open: boolean;
  messages: AssistantMessage[];
  draft: AssistantIntakeDraft | null;
  /** Images dropped on the chat, waiting to be taken by the active draft card. Not persisted. */
  pendingFiles: File[];
  addPendingFiles: (files: File[]) => void;
  clearPendingFiles: () => void;
  setDraft: (draft: AssistantIntakeDraft | null) => void;
  setOpen: (open: boolean) => void;
  setMessages: (messages: AssistantMessage[]) => void;
  /** Drops a previous user's conversation when a different user signs in. */
  claim: (userId: string) => void;
}

export const useAssistantStore = create<AssistantStore>()(
  persist(
    (set, get) => ({
      ownerId: null,
      lastActiveAt: Date.now(),
      open: false,
      messages: [],
      draft: null,
      pendingFiles: [],
      addPendingFiles: (files) => set((state) => ({ pendingFiles: [...state.pendingFiles, ...files] })),
      clearPendingFiles: () => set({ pendingFiles: [] }),
      setDraft: (draft) => set(draft ? { draft } : { draft, pendingFiles: [] }),
      setOpen: (open) => {
        if (open && isIdleExpired(get().lastActiveAt)) set({ messages: [], draft: null, pendingFiles: [] });
        set({ open });
      },
      setMessages: (messages) => set({ messages, lastActiveAt: Date.now() }),
      claim: (userId) => {
        if (get().ownerId !== userId) set({ ownerId: userId, open: false, messages: [], draft: null, lastActiveAt: Date.now() });
        else if (isIdleExpired(get().lastActiveAt)) set({ messages: [], draft: null });
      },
    }),
    {
      name: 'assistant-chat',
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ ownerId, open, messages, draft, lastActiveAt }) => ({ ownerId, open, messages, draft, lastActiveAt }),
    },
  ),
);
