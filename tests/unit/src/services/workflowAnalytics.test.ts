const { mockCheckOptionalEnv, mockPostJson } = vi.hoisted(() => ({
  mockCheckOptionalEnv: vi.fn<(name: string) => string>(() => ''),
  mockPostJson: vi.fn<(path: string, body: unknown) => Promise<{ accepted: boolean }>>(),
}));

vi.mock('@/config/runtimeEnv', () => ({
  checkOptionalEnv: mockCheckOptionalEnv,
}));

vi.mock('@/services/app-api/http', () => ({
  postJson: mockPostJson,
}));

describe('workflowAnalytics', () => {
  beforeEach(() => {
    mockCheckOptionalEnv.mockReset();
    mockCheckOptionalEnv.mockImplementation(() => '');
    mockPostJson.mockReset();
    mockPostJson.mockResolvedValue({ accepted: true });
  });

  it('posts analytics events through the app-api helper when enabled', async () => {
    const { trackWorkflowEvent } = await import('@/services/workflowAnalytics');

    trackWorkflowEvent('tab_viewed', { tab: 'inventory' });
    await Promise.resolve();

    expect(mockPostJson).toHaveBeenCalledTimes(1);
    expect(mockPostJson).toHaveBeenCalledWith('/api/analytics/events', expect.objectContaining({
      name: 'tab_viewed',
      payload: { tab: 'inventory' },
    }));
  });

  it('skips analytics posts when disabled', async () => {
    mockCheckOptionalEnv.mockImplementation((name: string) => (name === 'VITE_ANALYTICS_ENABLED' ? 'false' : ''));
    const { trackWorkflowEvent } = await import('@/services/workflowAnalytics');

    trackWorkflowEvent('tab_viewed', { tab: 'inventory' });
    await Promise.resolve();

    expect(mockPostJson).not.toHaveBeenCalled();
  });
});