export function getDateRange(days = 1) {
  const now = new Date();
  const normalizedTo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  const fromTime = normalizedTo.getTime() - Math.max(days, 1) * 24 * 60 * 60 * 1000;
  const fromDate = new Date(fromTime);
  const from = fromDate.toISOString();
  const to = normalizedTo.toISOString();
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

// Diff helpers removed (no longer needed).
