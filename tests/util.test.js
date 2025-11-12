import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  normalizeTitle,
  buildKey,
  isMaterialUpdate,
  computeDiff,
} from '../src/util.js';

const fixturePath = (file) => path.resolve('tests/fixtures', file);

const loadFixture = async (file) => {
  const raw = await fs.readFile(fixturePath(file), 'utf-8');
  return JSON.parse(raw);
};

test('normalizeTitle lowercases and strips punctuation', () => {
  assert.equal(normalizeTitle('  Breaking: France — Africa! '), 'breaking france africa');
});

test('buildKey prefers normalized title but falls back to URL host/path', () => {
  const itemNoTitle = { url: 'https://example.com/path/Story' };
  assert.equal(buildKey(itemNoTitle), 'example.com/path/story');

  const itemWithTitle = { title: 'Diplomatic Summit Update', url: 'https://foo' };
  assert.equal(buildKey(itemWithTitle), 'diplomatic summit update');
});

test('isMaterialUpdate detects summary growth and publication time jumps', () => {
  const prev = {
    title: 'France briefing',
    summary: 'Short note',
    publishedAt: '2025-11-11T00:00:00Z',
  };
  const longer = {
    title: 'France briefing',
    summary: 'This is a substantially longer explanation that should trigger the diff.',
    publishedAt: '2025-11-11T05:00:00Z',
  };
  assert.equal(isMaterialUpdate(prev, longer), true);

  const sameSummaryNewerTime = {
    title: 'France briefing',
    summary: 'Short note',
    publishedAt: '2025-11-12T13:00:00Z',
  };
  assert.equal(isMaterialUpdate(prev, sameSummaryNewerTime), true);

  const unchanged = {
    title: 'France briefing',
    summary: 'Short note',
    publishedAt: '2025-11-11T01:00:00Z',
  };
  assert.equal(isMaterialUpdate(prev, unchanged), false);
});

test('computeDiff categorizes New, Updated, Watchlist, and Resolved/Quiet', async () => {
  const today = await loadFixture('today.json');
  const yesterday = await loadFixture('yesterday.json');

  const diff = computeDiff(today.items, yesterday.items);
  assert.equal(diff.New.length, 1);
  assert.equal(diff.New[0].title.includes('AU, France'), true);
  assert.equal(diff.Updated.length, 1);
  assert.equal(diff.Updated[0].current.title.includes('Niger advances'), true);
  assert.equal(diff.ResolvedQuiet.length, 1);
  assert.equal(diff.ResolvedQuiet[0].title.includes('advisory'), true);
  assert.equal(diff.Watchlist.length, 0);
});
