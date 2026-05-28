import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const cwd = process.cwd();
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const GOOGLE_DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};

function requireEnv(name) {
  const value = mergedEnv[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function maybeOpenBrowser(url) {
  if (process.platform !== 'darwin') {
    return;
  }

  const child = spawn('open', [url], { stdio: 'ignore', detached: true });
  child.unref();
}

async function exchangeCodeForTokens(code, redirectUri) {
  const response = await fetch(GOOGLE_DRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: requireEnv('VITE_GOOGLE_DRIVE_CLIENT_ID'),
      client_secret: requireEnv('VITE_GOOGLE_DRIVE_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange OAuth code: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

async function main() {
  requireEnv('VITE_GOOGLE_DRIVE_CLIENT_ID');
  requireEnv('VITE_GOOGLE_DRIVE_CLIENT_SECRET');

  let redirectUri = '';
  const codePromise = new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(`Google OAuth failed: ${error}`);
        server.close();
        reject(new Error(`Google OAuth failed: ${error}`));
        return;
      }

      if (!code) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Missing OAuth code.');
        return;
      }

      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Google Drive authorization complete. Return to the terminal.');
      server.close();
      resolve(code);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine local OAuth callback port.'));
        return;
      }

      redirectUri = `http://127.0.0.1:${address.port}/oauth2/callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', requireEnv('VITE_GOOGLE_DRIVE_CLIENT_ID'));
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', GOOGLE_DRIVE_SCOPE);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      console.log('Open this URL if the browser does not launch automatically:');
      console.log(authUrl.toString());
      maybeOpenBrowser(authUrl.toString());
    });
  });

  const code = await codePromise;
  const tokenResponse = await exchangeCodeForTokens(code, redirectUri);
  const refreshToken = tokenResponse.refresh_token?.trim();

  if (!refreshToken) {
    throw new Error('Google did not return a refresh token. Re-run the command and approve consent again.');
  }

  console.log('Refresh token received. Add this to .env.local:');
  console.log(`VITE_GOOGLE_DRIVE_REFRESH_TOKEN=${refreshToken}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});