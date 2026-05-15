const LOCAL_TEST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const REMOTE_TESTS_ALLOWED = (process.env.ALLOW_REMOTE_TESTS || '').toLowerCase() === 'true';

function normalizeTargets(targets) {
  return targets
    .filter(Boolean)
    .map((target) => (typeof target === 'string' ? { label: target, url: target } : target))
    .filter((target) => target?.url);
}

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return LOCAL_TEST_HOSTNAMES.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function enforceLocalOnlyIntegrationTargets(scriptName, targets) {
  if (REMOTE_TESTS_ALLOWED) {
    return;
  }

  const remoteTargets = normalizeTargets(targets).filter((target) => !isLocalUrl(target.url));
  if (remoteTargets.length === 0) {
    return;
  }

  const formattedTargets = remoteTargets.map((target) => `${target.label}: ${target.url}`).join('\n');
  throw new Error(
    `${scriptName} is blocked in local development because it targets remote services.\n${formattedTargets}\n\nUse local endpoints instead, or set ALLOW_REMOTE_TESTS=true only when you intentionally want a live external smoke test.`,
  );
}