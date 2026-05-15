import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const localApiOriginModulePath = '../../../../scripts/local-api-origin.mjs';

describe('local-api-origin', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('node:net');
    vi.restoreAllMocks();
  });

  it('ignores a remote VITE_APP_API_BASE_URL when resolving the local api origin', async () => {
    const connectMock = vi.fn();
    const Socket = class {
      handlers = new Map<string, () => void>();

      setTimeout() {}

      once(event: string, handler: () => void) {
        this.handlers.set(event, handler);
        return this;
      }

      connect() {
        connectMock();
        this.handlers.get('connect')?.();
      }

      destroy() {}
    };

    vi.doMock('node:net', () => ({
      default: { Socket },
      Socket,
    }));

    const { resolveLocalApiOrigin } = await import(localApiOriginModulePath) as {
      resolveLocalApiOrigin: (getOptionalEnv: (name: string) => string) => Promise<string>;
    };

    const origin = await resolveLocalApiOrigin((name: string) => {
      if (name === 'VITE_APP_API_BASE_URL') return 'https://example.execute-api.us-east-1.amazonaws.com';
      return '';
    });

    expect(origin).toBe('http://127.0.0.1:3001');
    expect(connectMock).toHaveBeenCalled();
  });

  it('rejects a remote explicit origin for local-only script checks', async () => {
    const { requireReadyLocalApiOrigin } = await import(localApiOriginModulePath) as {
      requireReadyLocalApiOrigin: (
        getOptionalEnv: (name: string) => string,
        options?: { purpose?: string },
      ) => Promise<string>;
    };

    await expect(
      requireReadyLocalApiOrigin((name: string) => (name === 'LAMBDA_API_ORIGIN' ? 'https://example.execute-api.us-east-1.amazonaws.com' : ''), {
        purpose: 'local verification',
      }),
    ).rejects.toThrow('local verification requires the no-Docker local API');
  });
});