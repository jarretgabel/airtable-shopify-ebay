import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { parseGscCredentials, syncSearchConsole, type GscFetcher } from '../../../../../aws/src/seo/searchConsole.js';

const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const credentials = { client_email: 'bot@example.iam.gserviceaccount.com', private_key: privateKey };

test('parseGscCredentials accepts raw and base64 JSON and rejects junk', () => {
  const json = JSON.stringify(credentials);
  assert.equal(parseGscCredentials(json)?.client_email, credentials.client_email);
  assert.equal(parseGscCredentials('nope'), null);
  assert.equal(parseGscCredentials(''), null);
});

test('syncSearchConsole stores rows and uses the sc-domain property', async () => {
  const urls: string[] = [];
  const fetcher: GscFetcher = async (url, init) => {
    urls.push(url);
    if (url.includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 't' }) };
    const dims = (JSON.parse(init.body) as { dimensions: string[] }).dimensions[0];
    return { ok: true, status: 200, json: async () => ({ rows: [{ keys: [dims === 'date' ? '2026-01-01' : `${dims}-a`], clicks: 3, impressions: 30, ctr: 0.1, position: 4 }] }) };
  };
  const statements: string[] = [];
  const db = { query: async (sql: string) => { statements.push(sql); return { rows: [] }; } };
  const result = await syncSearchConsole(db as never, 'resolutionav', { fetcher, credentials, nowMs: Date.parse('2026-02-01') });
  assert.deepEqual(result, { synced: true, days: 1, queries: 1, pages: 1 });
  assert.ok(urls.some((url) => url.includes(encodeURIComponent('sc-domain:resolutionavnyc.com'))));
  assert.ok(statements.some((sql) => sql.includes('seo_gsc_queries')));
});

test('syncSearchConsole records a failure instead of throwing', async () => {
  const fetcher: GscFetcher = async (url) =>
    url.includes('oauth2')
      ? { ok: true, status: 200, json: async () => ({ access_token: 't' }) }
      : { ok: false, status: 403, json: async () => ({ error: { message: 'no access' } }) };
  const statements: string[] = [];
  const db = { query: async (sql: string) => { statements.push(sql); return { rows: [] }; } };
  const result = await syncSearchConsole(db as never, 'stereobuyers', { fetcher, credentials });
  assert.equal(result.synced, false);
  assert.ok(statements.some((sql) => sql.includes('seo_gsc_syncs')));
  assert.deepEqual(await syncSearchConsole(db as never, 'stereobuyers', { credentials: null }), { synced: false, reason: 'Search Console credentials are not configured' });
});
