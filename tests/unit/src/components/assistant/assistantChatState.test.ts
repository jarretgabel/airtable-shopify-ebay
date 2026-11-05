import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAssistantSuggestions } from '@/components/assistant/assistantSuggestions';
import { ASSISTANT_IDLE_RESET_MS, useAssistantStore } from '@/stores/assistantStore';

describe('assistant suggestions', () => {
  it('gives testers and photographers stage-specific questions', () => {
    expect(getAssistantSuggestions('tester')[0]).toMatch(/left to test/);
    expect(getAssistantSuggestions('photographer')[0]).toMatch(/photographed/);
    expect(getAssistantSuggestions(undefined).length).toBeGreaterThan(0);
  });
});

describe('assistant idle reset', () => {
  beforeEach(() => {
    vi.useRealTimers();
    useAssistantStore.setState({ ownerId: 'u1', open: false, messages: [], draft: null, lastActiveAt: Date.now() });
  });

  it('keeps a recent conversation and drops one idle longer than the limit', () => {
    useAssistantStore.getState().setMessages([{ role: 'user', content: 'hi' }]);
    useAssistantStore.getState().claim('u1');
    expect(useAssistantStore.getState().messages).toHaveLength(1);

    useAssistantStore.setState({ lastActiveAt: Date.now() - ASSISTANT_IDLE_RESET_MS - 1000 });
    useAssistantStore.getState().setOpen(true);
    expect(useAssistantStore.getState().messages).toHaveLength(0);
  });
});
