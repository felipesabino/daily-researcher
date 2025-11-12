import { URL } from 'url';

export function scoreItems(items = [], scoringConfig = {}) {
  const context = buildContext(items, scoringConfig);
  return items.map((item) => {
    const signal = computeSignal(item, scoringConfig, context);
    return { ...item, signal };
  });
}

function computeSignal(item, config, context) {
  const domain = extractDomain(item.url);
  const weights = config.weights || {};
  const breakdown = {
    sourceQuality: calcSourceQuality(domain, config.sourceTiers),
    eventfulness: calcEventfulness(item, config.eventfulness),
    relevance: calcRelevance(item, config.relevance),
    recency: calcRecency(item, config.recency),
    corroboration: calcCorroboration(item, domain, context, config.corroboration),
    officialdom: calcOfficialdom(domain, config.officialDomains),
    impactHints: calcImpactHints(item, config.impactHints),
  };

  const weightEntries = Object.entries(weights);
  const totalWeight = weightEntries.reduce((sum, [, value]) => sum + (value || 0), 0) || 1;
  const weightedSum = weightEntries.reduce((sum, [key, value]) => {
    const weight = value || 0;
    const subScore = breakdown[key] ?? 0;
    return sum + weight * subScore;
  }, 0);

  const normalizedScore = weightedSum / totalWeight;
  return {
    score: Number(normalizedScore.toFixed(3)),
    breakdown,
    domain,
  };
}

function buildContext(items, config) {
  const storyMap = new Map();
  for (const item of items) {
    const key = storyKey(item);
    if (!key) continue;
    const domain = extractDomain(item.url);
    const publishedAt = Date.parse(item.publishedAt || item.date || 0);
    if (!storyMap.has(key)) {
      storyMap.set(key, []);
    }
    storyMap.get(key).push({ domain, publishedAt });
  }
  return { storyMap, config };
}

function storyKey(item) {
  const title = normalizeText(item.title);
  if (title) return title;
  const url = (item.url || '').trim().toLowerCase();
  return url;
}

function extractDomain(rawUrl = '') {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch (error) {
    return rawUrl.replace(/^https?:\/\//, '').split('/')[0]?.toLowerCase() || '';
  }
}

function calcSourceQuality(domain, sourceTiers = {}) {
  if (!domain) return 0;
  const tiers = ['tier1', 'tier2', 'tier3'];
  for (const tier of tiers) {
    const tierInfo = sourceTiers[tier];
    if (tierInfo?.domains?.includes(domain)) {
      return tierInfo.score ?? 1;
    }
  }
  const otherScore = sourceTiers.other?.score ?? 0.4;
  return otherScore;
}

function calcEventfulness(item, eventfulness = {}) {
  const text = combinedText(item);
  if (!text) return 0;
  const strongVerbs = eventfulness.verbsStrong || [];
  const mediumVerbs = eventfulness.verbsMedium || [];
  if (containsAny(text, strongVerbs)) {
    return eventfulness.strong ?? 1;
  }
  if (containsAny(text, mediumVerbs)) {
    return eventfulness.medium ?? 0.6;
  }
  return 0;
}

function calcRelevance(item, relevance = {}) {
  const text = combinedText(item);
  if (!text) return 0;
  const mustHaveAny = relevance.mustHaveAny || [];
  if (mustHaveAny.length && !containsAny(text, mustHaveAny)) {
    return 0;
  }
  let score = mustHaveAny.length ? 0.4 : 0.2;
  const africaSet = relevance.africaSet || [];
  if (africaSet.length && containsAny(text, africaSet)) {
    score += 0.2;
  }
  const themes = relevance.themes || {};
  const themeBoost = relevance.themeBoost ?? 0.15;
  for (const keywords of Object.values(themes)) {
    if (containsAny(text, keywords)) {
      score += themeBoost;
    }
  }
  return Math.min(1, score);
}

function calcRecency(item, recency = {}) {
  const publishedAt = Date.parse(item.publishedAt || item.date || 0);
  if (Number.isNaN(publishedAt)) return 0;
  const now = Date.now();
  const diffHours = Math.max(0, (now - publishedAt) / (60 * 60 * 1000));
  const { halfLifeHours = 24, maxHours = 168 } = recency;
  if (diffHours >= maxHours) return 0;
  const decay = Math.pow(0.5, diffHours / halfLifeHours);
  return Number(Math.min(1, Math.max(0, decay)).toFixed(3));
}

function calcCorroboration(item, domain, context, config = {}) {
  const key = storyKey(item);
  if (!key || !context.storyMap.has(key)) return 0;
  const entries = context.storyMap.get(key);
  const windowHours = config.sameStoryWindowHours ?? 24;
  const boostPer = config.boostPerDistinctDomain ?? 0.1;
  const maxBoost = config.maxBoost ?? 0.4;
  const publishedAt = Date.parse(item.publishedAt || item.date || 0);
  const distinct = new Set();
  for (const entry of entries) {
    if (!entry.domain) continue;
    if (Number.isNaN(entry.publishedAt) || Number.isNaN(publishedAt)) continue;
    const diffHours = Math.abs(entry.publishedAt - publishedAt) / (60 * 60 * 1000);
    if (diffHours <= windowHours) {
      distinct.add(entry.domain);
    }
  }
  distinct.delete(domain);
  const boost = Math.min(maxBoost, distinct.size * boostPer);
  return boost;
}

function calcOfficialdom(domain, officialDomains = []) {
  if (!domain || !officialDomains.length) return 0;
  return officialDomains.includes(domain) ? 1 : 0;
}

function calcImpactHints(item, impactHints = {}) {
  const text = combinedText(item);
  if (!text) return 0;
  let score = 0;
  const { sovereign = [], corporate = [], max = 1 } = impactHints;
  if (containsAny(text, sovereign)) {
    score += 0.6;
  }
  if (containsAny(text, corporate)) {
    score += 0.4;
  }
  return Math.min(max ?? 1, score);
}

function combinedText(item) {
  return [item.title, item.summary, item.description]
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join(' ');
}

function containsAny(text, keywords = []) {
  if (!text || !keywords.length) return false;
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function normalizeText(value = '') {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
