import assert from 'node:assert/strict';
import test from 'node:test';
import { planHtmlAttachmentRemoval, toAirtableImages } from './cleanHtmlAttachments.js';

test('plans removal of text/html attachments only', () => {
  assert.equal(planHtmlAttachmentRemoval(undefined), null);
  assert.equal(planHtmlAttachmentRemoval([{ id: 'a', type: 'image/jpeg' }]), null);
  const plan = planHtmlAttachmentRemoval([{ id: 'a', type: 'image/jpeg' }, { id: 'b', type: 'text/html' }, { id: 'c', type: 'TEXT/HTML; charset=utf-8' }]);
  assert.deepEqual(plan?.keep.map((i) => i.id), ['a']);
  assert.deepEqual(plan?.remove.map((i) => i.id), ['b', 'c']);
});

test('sends only ids to Airtable, and refuses entries without one', () => {
  assert.deepEqual(toAirtableImages([{ id: 'a' }, { id: 'b' }]), [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(toAirtableImages([]), []);
  assert.equal(toAirtableImages([{ id: 'a' }, {}]), null);
});
