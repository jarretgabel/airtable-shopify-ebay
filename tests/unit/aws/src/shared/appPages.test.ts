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

test('non-tester roles get Image Lab according to their role bundle', () => {
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'developer'), ['dashboard', 'jotform', 'market', 'settings', 'notifications', 'imagelab']);
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'processor'), ['dashboard', 'parking-lot-1', 'parking-lot-2', 'trash-review', 'inventory', 'testing-queue', 'photography-queue', 'manual-intake', 'incoming-gear', 'testing', 'photos', 'market', 'imagelab']);
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'photographer'), ['dashboard', 'photography-queue', 'photos', 'imagelab']);
  assert.deepEqual(normalizeAllowedPages([...APP_PAGES], 'tester'), ['dashboard', 'testing-queue', 'testing']);
});