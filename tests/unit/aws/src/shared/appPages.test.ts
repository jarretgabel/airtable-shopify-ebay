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
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'processor'), ['dashboard', 'workflow-guide', 'manual-intake', 'create-intake-item', 'jotform', 'jotform-audit', 'parking-lot', 'trash-review', 'inventory', 'testing-queue', 'photography-queue', 'testing', 'photos', 'listings', 'post-publish', 'archive', 'shopify', 'ebay', 'market', 'settings', 'notifications', 'imagelab']);
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'photographer'), ['dashboard', 'workflow-guide', 'photography-queue', 'photos', 'imagelab']);
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'tester'), ['dashboard', 'workflow-guide', 'testing-queue', 'testing']);
});

test('manual intake and jotform access restore companion intake pages', () => {
  const pages = normalizeAllowedPages(['dashboard', 'manual-intake', 'jotform'], 'processor');

  assert.equal(pages.includes('create-intake-item'), true);
  assert.equal(pages.includes('jotform-audit'), true);
});

test('processor normalization does not expand beyond the provided bundle', () => {
  const pages = normalizeAllowedPages(['dashboard', 'inventory'], 'processor');

  assert.equal(pages.includes('dashboard'), true);
  assert.equal(pages.includes('inventory'), true);
  assert.equal(pages.includes('shopify'), false);
  assert.equal(pages.includes('ebay'), false);
});