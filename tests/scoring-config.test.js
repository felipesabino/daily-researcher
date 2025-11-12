import test from 'node:test';
import assert from 'node:assert/strict';
import { deepMerge } from '../src/scoring-config.js';

test('deepMerge combines arrays with dedupe and merges nested objects', () => {
  const base = {
    weights: { sourceQuality: 0.2 },
    officialDomains: ['a.com'],
    relevance: {
      mustHaveAny: ['alpha'],
      themes: {
        diplomacy: ['summit'],
      },
    },
  };

  const override = {
    weights: { relevance: 0.3 },
    officialDomains: ['b.com', 'a.com'],
    relevance: {
      themes: {
        diplomacy: ['summit'],
        energy: ['oil'],
      },
    },
  };

  const merged = deepMerge(base, override);
  assert.equal(merged.weights.sourceQuality, 0.2);
  assert.equal(merged.weights.relevance, 0.3);
  assert.deepEqual(merged.officialDomains.sort(), ['a.com', 'b.com']);
  assert.deepEqual(Object.keys(merged.relevance.themes).sort(), ['diplomacy', 'energy']);
});
