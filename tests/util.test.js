import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSummary, dedupeItems, formatWindowLabel, getDateRange } from '../src/util.js';

test('cleanSummary collapses whitespace and strips boilerplate', () => {
  const result = cleanSummary('Line one.  \n\n Subscribe for more.');
  assert.equal(result, 'Line one.');
});

test('dedupeItems removes items by url/title order', () => {
  const items = [
    { title: 'Story', url: 'https://example.com/a' },
    { title: 'Story', url: 'https://example.com/a' },
    { title: 'Story', url: 'https://duplicate-less.com' },
  ];
  const deduped = dedupeItems(items);
  assert.equal(deduped.length, 2);
});

test('formatWindowLabel renders friendly strings', () => {
  assert.equal(formatWindowLabel(1), 'past 24 hours');
  assert.equal(formatWindowLabel(3), 'past 3 days');
});

test('getDateRange snaps boundaries to midnight UTC', () => {
  const { from, to } = getDateRange(2);
  const fromDate = new Date(from);
  const toDate = new Date(to);
  assert.equal(fromDate.getUTCHours(), 0);
  assert.equal(fromDate.getUTCMinutes(), 0);
  assert.equal(toDate.getUTCHours(), 0);
  assert.equal(toDate.getUTCMinutes(), 0);
  const diffDays = Math.round((toDate - fromDate) / (24 * 60 * 60 * 1000));
  assert.equal(diffDays, 2);
});
