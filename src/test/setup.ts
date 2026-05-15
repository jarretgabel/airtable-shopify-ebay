import '@testing-library/jest-dom/vitest';

const LOCAL_TEST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const REMOTE_TESTS_ALLOWED = (import.meta.env.ALLOW_REMOTE_TESTS || '').toLowerCase() === 'true';

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
	try {
		if (typeof input === 'string') {
			return new URL(input, window.location.origin);
		}
		if (input instanceof URL) {
			return input;
		}
		return new URL(input.url, window.location.origin);
	} catch {
		return null;
	}
}

function assertLocalTestRequest(input: RequestInfo | URL): void {
	if (REMOTE_TESTS_ALLOWED) return;

	const requestUrl = resolveRequestUrl(input);
	if (!requestUrl) return;
	if (LOCAL_TEST_HOSTNAMES.has(requestUrl.hostname.toLowerCase())) return;

	throw new Error(`Remote network request blocked during tests: ${requestUrl.toString()}. Mock the request or route it through a local endpoint. To intentionally allow remote calls, set ALLOW_REMOTE_TESTS=true.`);
}

const originalFetch = globalThis.fetch?.bind(globalThis);
if (originalFetch) {
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		assertLocalTestRequest(input);
		return originalFetch(input, init);
	}) as typeof fetch;
}
