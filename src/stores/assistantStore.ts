import { create } from 'zustand';
import type { AssistantIntakeDraft } from '@/services/app-api/ai';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantStore {
  ownerId: string | null;
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
      open: false,
      messages: [],
      draft: null,
      pendingFiles: [],
      addPendingFiles: (files) => set((state) => ({ pendingFiles: [...state.pendingFiles, ...files] })),
      clearPendingFiles: () => set({ pendingFiles: [] }),
      setDraft: (draft) => set(draft ? { draft } : { draft, pendingFiles: [] }),
      setOpen: (open) => set({ open }),
      setMessages: (messages) => set({ messages }),
      claim: (userId) => {
        if (get().ownerId !== userId) set({ ownerId: userId, open: false, messages: [], draft: null });
      },
    }),
    {
      name: 'assistant-chat',
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ ownerId, open, messages, draft }) => ({ ownerId, open, messages, draft }),
    },
  ),
);
