import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_PAGES, normalizeAllowedPages } from '../../../../../aws/src/shared/appPages.js';

test('admin page normalization excludes HiFi Shark while preserving Image Lab', () => {
  const pages = normalizeAllowedPages([...APP_PAGES], 'admin');

  assert.equal(pages.includes('market'), false);
  assert.equal(pages.includes('imagelab'), true);
});

test('owner keeps HiFi Shark access', () => {
  const pages = normalizeAllowedPages([...APP_PAGES], 'owner');

  assert.equal(pages.includes('market'), true);
});

test('developers keep the full page bundle', () => {
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'developer'), [...APP_PAGES]);
});

test('non-tester roles get Image Lab according to their role bundle', () => {
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'processor'), ['dashboard', 'manual-intake', 'jotform', 'parking-lot-1', 'trash-review', 'inventory', 'testing-queue', 'photography-queue', 'testing', 'photos', 'listings', 'post-publish', 'archive', 'shopify', 'ebay', 'market', 'settings', 'notifications', 'imagelab']);
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'photographer'), ['dashboard', 'photography-queue', 'photos', 'imagelab']);
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'tester'), ['dashboard', 'testing-queue', 'testing']);
});

test('processor normalization restores commerce and account pages when legacy inventory access is present', () => {
  const pages = normalizeAllowedPages(['dashboard', 'inventory'], 'processor');

  assert.equal(pages.includes('jotform'), true);
  assert.equal(pages.includes('listings'), true);
  assert.equal(pages.includes('shopify'), true);
  assert.equal(pages.includes('ebay'), true);
  assert.equal(pages.includes('settings'), true);
  assert.equal(pages.includes('notifications'), true);
});