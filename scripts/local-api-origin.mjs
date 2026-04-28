import net from 'node:net';

function normalizeOrigin(value) {
  return value.replace(/\/$/, '');
}

function isLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

function isTcpPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(250);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
    socket.connect(port, host);
  });
}

export async function resolveLocalApiOrigin(getOptionalEnv) {
  const explicitOrigin = getOptionalEnv('LAMBDA_API_ORIGIN') || getOptionalEnv('VITE_APP_API_PROXY_TARGET') || getOptionalEnv('VITE_APP_API_BASE_URL');
  if (explicitOrigin) {
    return normalizeOrigin(explicitOrigin);
  }

  const candidatePorts = [
    Number(getOptionalEnv('LOCAL_API_PORT') || '0'),
    3001,
    3002,
  ].filter((port, index, ports) => Number.isInteger(port) && port > 0 && ports.indexOf(port) === index);

  for (const port of candidatePorts) {
    if (await isTcpPortOpen(port)) {
      return `http://127.0.0.1:${port}`;
    }
  }

  return 'http://127.0.0.1:3001';
}

export async function requireReadyLocalApiOrigin(getOptionalEnv, options = {}) {
  const purpose = options.purpose || 'This command';
  const origin = await resolveLocalApiOrigin(getOptionalEnv);
  const portHint = new URL(origin).port || '3001';

  if (!isLocalOrigin(origin)) {
    return origin;
  }

  let response;
  try {
    response = await fetch(`${origin}/health`, {
      signal: AbortSignal.timeout(1500),
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new Error(`${purpose} requires the no-Docker local API, but ${origin} is not responding. Start it with \`LOCAL_API_PORT=${portHint} npm run local:api\`.`);
  }

  if (response.ok) {
    return origin;
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 404 && body?.service === 'local-api' && body?.code === 'LOCAL_ROUTE_NOT_FOUND') {
    return origin;
  }

  throw new Error(`${purpose} requires the no-Docker local API, but ${origin}/health returned ${response.status}. Start or restart it with \`LOCAL_API_PORT=${portHint} npm run local:api\`.`);

}