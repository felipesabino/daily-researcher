export function getDateRange(days = 1) {
  const now = new Date();
  const to = now.toISOString();
  const fromTime = now.getTime() - Math.max(days, 1) * 24 * 60 * 60 * 1000;
  const from = new Date(fromTime).toISOString();
  return { from, to };
}

export function cleanSummary(summary = '') {
  return summary
    .replace(/\s+/g, ' ')
    .replace(/(Subscribe|Sign up).*$/i, '')
    .trim();
}

export function dedupeItems(items = []) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const normalized = [];

  for (const item of items) {
    const urlKey = item.url ? item.url.trim().toLowerCase() : '';
    const titleKey = item.title ? item.title.trim().toLowerCase() : '';

    if ((urlKey && seenUrls.has(urlKey)) || (!urlKey && titleKey && seenTitles.has(titleKey))) {
      continue;
    }

    if (urlKey) {
      seenUrls.add(urlKey);
    }
    if (titleKey) {
      seenTitles.add(titleKey);
    }

    normalized.push(item);
  }

  return normalized;
}

export function sortByPublishedAtDesc(items = []) {
  return [...items].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });
}

export function capItems(items = [], max = 80) {
  return items.slice(0, Math.max(max, 1));
}

export function formatWindowLabel(days) {
  const n = Number(days) || 1;
  if (n === 1) {
    return 'past 24 hours';
  }
  return `past ${n} days`;
}

export function normalizeTitle(title = '') {
  return (title || '').toLowerCase().replace(/\W+/g, ' ').trim();
}

export function buildKey(item = {}) {
  const titleKey = normalizeTitle(item.title);
  if (titleKey) {
    return titleKey;
  }
  return buildUrlKey(item.url);
}

export function buildKeyVariants(item = {}) {
  const variants = [];
  const titleKey = normalizeTitle(item.title);
  if (titleKey) {
    variants.push(`title:${titleKey}`);
  }
  const urlKey = buildUrlKey(item.url);
  if (urlKey) {
    variants.push(`url:${urlKey}`);
  }
  if (!variants.length) {
    variants.push('');
  }
  return variants;
}

function buildUrlKey(rawUrl = '') {
  const url = rawUrl?.trim();
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch (error) {
    return url.toLowerCase();
  }
}

export function indexByKey(items = []) {
  const map = new Map();
  for (const item of items) {
    for (const key of buildKeyVariants(item)) {
      if (!key) {
        continue;
      }
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(item);
    }
  }
  return map;
}

export function isMaterialUpdate(previous = {}, current = {}) {
  const prevTitle = normalizeTitle(previous.title);
  const curTitle = normalizeTitle(current.title);
  if (prevTitle && curTitle && prevTitle !== curTitle) {
    return true;
  }

  const prevSummary = (previous.summary || '').trim();
  const curSummary = (current.summary || '').trim();
  const prevLen = prevSummary.length || 1;
  const lenDiff = Math.abs(prevSummary.length - curSummary.length);
  if (prevSummary && lenDiff / prevLen > 0.2) {
    return true;
  }

  const prevTime = Date.parse(previous.publishedAt || previous.date || 0);
  const curTime = Date.parse(current.publishedAt || current.date || 0);
  if (
    !Number.isNaN(prevTime) &&
    !Number.isNaN(curTime) &&
    curTime - prevTime >= 12 * 60 * 60 * 1000
  ) {
    return true;
  }

  return false;
}

export function computeDiff(todayItems = [], yesterdayItems = []) {
  const yesterdayIndex = indexByKey(yesterdayItems);
  const matchedPrevItems = new Set();
  const New = [];
  const Updated = [];
  const WatchlistCandidates = [];

  for (const current of todayItems) {
    const keys = buildKeyVariants(current).filter(Boolean);
    let previous;
    for (const key of keys) {
      const candidates = yesterdayIndex.get(key) || [];
      previous = candidates.find((candidate) => !matchedPrevItems.has(candidate));
      if (previous) {
        matchedPrevItems.add(previous);
        break;
      }
    }

    if (!previous) {
      New.push(current);
      continue;
    }

    if (isMaterialUpdate(previous, current)) {
      Updated.push({ previous, current });
    } else {
      WatchlistCandidates.push(current);
    }
  }

  const ResolvedQuiet = yesterdayItems.filter((item) => !matchedPrevItems.has(item));

  return {
    New,
    Updated,
    Watchlist: WatchlistCandidates.slice(0, 5),
    ResolvedQuiet: ResolvedQuiet.slice(0, 3),
  };
}
