import fs from 'fs/promises';
import path from 'path';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(base = {}, override = {}) {
  if (!isObject(base)) {
    return Array.isArray(override) ? [...override] : override;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (Array.isArray(value)) {
      const current = Array.isArray(base[key]) ? base[key] : [];
      out[key] = Array.from(new Set([...current, ...value]));
    } else if (isObject(value)) {
      out[key] = deepMerge(isObject(base[key]) ? base[key] : {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function loadScoringConfig(topicId, { configPath = 'config/scoring.json', overrides } = {}) {
  const resolvedPath = path.resolve(configPath);
  const raw = await fs.readFile(resolvedPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const globalCfg = parsed.global || {};
  const topicCfg = parsed.topics?.[topicId] || {};
  const merged = deepMerge(globalCfg, topicCfg);
  const finalConfig = overrides ? deepMerge(merged, overrides) : merged;
  finalConfig.thresholds = finalConfig.thresholds || {
    minScoreForInclusion: 0.45,
    minScoreForTopDevelopments: 0.6,
    topK: 60,
  };
  finalConfig.weights = finalConfig.weights || {};
  finalConfig.relevance = finalConfig.relevance || {};
  finalConfig.sourceTiers = finalConfig.sourceTiers || {};
  finalConfig.officialDomains = finalConfig.officialDomains || [];
  return finalConfig;
}
