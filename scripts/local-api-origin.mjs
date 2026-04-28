import net from 'node:net';

function normalizeOrigin(value) {
  return value.replace(/\/$/, '');
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