import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain ESM script helper without type declarations
import { buildEbayConsentUrl, EBAY_OAUTH_SCOPES, extractAuthorizationCode, replaceEnvValue, resolveScopes } from '../../../../scripts/lib/ebayOAuth.mjs';

test('default scopes keep the existing three and add fulfillment, notifications, cancellation and return', () => {
  const base = 'https://api.ebay.com/oauth/api_scope';
  assert.deepEqual([...EBAY_OAUTH_SCOPES], [
    base,
    `${base}/sell.inventory`,
    `${base}/sell.account`,
    `${base}/sell.fulfillment`,
    `${base}/commerce.notification.subscription`,
    `${base}/sell.cancellation`,
    `${base}/sell.return`,
  ]);
});

test('configured scopes override the defaults and are split on whitespace', () => {
  assert.deepEqual(resolveScopes('  a   b\nc '), ['a', 'b', 'c']);
  assert.deepEqual(resolveScopes(''), [...EBAY_OAUTH_SCOPES]);
  assert.deepEqual(resolveScopes(undefined), [...EBAY_OAUTH_SCOPES]);
});

test('the consent URL encodes scopes with %20 (eBay rejects +) and carries client, RuName and state', () => {
  const url = buildEbayConsentUrl({ authBase: 'https://auth.ebay.com', clientId: 'CID', ruName: 'Ru-Name-1', scopes: ['s1', 's2/x'] });
  assert.equal(url, 'https://auth.ebay.com/oauth2/authorize?client_id=CID&redirect_uri=Ru-Name-1&response_type=code&scope=s1%20s2%2Fx&state=ebay_oauth');
  assert.ok(!url.includes('+'));
});

test('the authorization code is taken from a pasted redirect URL, an encoded code, or a raw code', () => {
  const code = 'v^1.1#i^1#r^1#p^3#f^0#I^3#t^Ul4xMF8w';
  assert.equal(extractAuthorizationCode(`http://localhost:3000/?code=${encodeURIComponent(code)}&expires_in=299&state=ebay_oauth`), code);
  assert.equal(extractAuthorizationCode(encodeURIComponent(code)), code);
  assert.equal(extractAuthorizationCode(`  ${code}  `), code);
  assert.equal(extractAuthorizationCode('http://localhost:3000/?state=x'), '');
  assert.equal(extractAuthorizationCode(''), '');
});

test('replaceEnvValue changes only the named line and keeps everything else byte-for-byte', () => {
  const before = '# note\nVITE_EBAY_ENV=production\nVITE_EBAY_REFRESH_TOKEN=old$&token\nOTHER=1\n';
  assert.equal(replaceEnvValue(before, 'VITE_EBAY_REFRESH_TOKEN', 'new$&value'), '# note\nVITE_EBAY_ENV=production\nVITE_EBAY_REFRESH_TOKEN=new$&value\nOTHER=1\n');
  assert.equal(replaceEnvValue('A=1\n', 'B', '2'), 'A=1\nB=2\n');
  assert.equal(replaceEnvValue('A=1', 'B', '2'), 'A=1\nB=2\n');
});
