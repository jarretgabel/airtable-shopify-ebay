import { spawn } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';

const cwd = process.cwd();
const children = [];
let viteStarted = false;
let shuttingDown = false;
const localApiPort = Number(process.env.LOCAL_API_PORT || '3001');
const localApiHost = process.env.LOCAL_API_HOST || '127.0.0.1';

function startCommand(name, command, args) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.push(child);

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    if (signal) {
      console.error(`[${name}] exited due to signal ${signal}`);
    } else if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }

    shutdown(typeof code === 'number' ? code : 1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 500);
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function startVite() {
  if (viteStarted) return;
  viteStarted = true;
  startCommand('dev', npmCommand, ['run', 'dev']);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function main() {
  const localApiAlreadyRunning = await isPortOpen(localApiHost, localApiPort);

  if (localApiAlreadyRunning) {
    console.log(`[dev:full] reusing existing local API on http://${localApiHost}:${localApiPort}`);
    startVite();
    return;
  }

  const api = startCommand('local:api', npmCommand, ['run', 'local:api']);

  api.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.includes('Local API server listening on')) {
      startVite();
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
});
