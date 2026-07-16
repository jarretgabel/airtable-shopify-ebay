import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductImageFilename } from '../../../../../aws/src/shared/imageNaming.js';

test('normalizeProductImageFilename lowercases, kebab-cases, and removes camera/version tokens', () => {
  assert.equal(
    normalizeProductImageFilename('IMG_4829 Final Edit V2.JPG'),
    'final-edit-product-hero-image.jpg',
  );
});

test('normalizeProductImageFilename preserves meaningful alphanumeric model tokens', () => {
  assert.equal(
    normalizeProductImageFilename('Bowers Wilkins 802D3 Rear Panel.jpeg'),
    'bowers-wilkins-802d3-rear-panel.jpg',
  );
});
