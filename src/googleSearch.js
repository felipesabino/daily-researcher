import axios from 'axios';
import { loadCache, saveCache } from './cache.js';
import { fetchAndExtract } from './contentExtractor.js';

const GOOGLE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

export async function searchGoogleForQuery(topicId, queryConfig = {}, { todayISO, days = 1, cacheDir } = {}) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const defaultCx = process.env.GOOGLE_SEARCH_CX_DEFAULT;
  if (!apiKey) {
    throw new Error('GOOGLE_SEARCH_API_KEY is required.');
  }
  if (!defaultCx) {
    throw new Error('GOOGLE_SEARCH_CX_DEFAULT is required.');
  }

  const cx = defaultCx;
  const num = Math.min(Math.max(Number(queryConfig.num) || 10, 1), 10);
  const dateRestrict = queryConfig.dateRestrict || (days ? `d${Math.max(1, Math.round(days))}` : undefined);
  const params = {
    key: apiKey,
    cx,
    q: queryConfig.query,
    num,
    safe: 'off',
    dateRestrict,
  };
  const cachePayload = { ...params };
  const label = queryConfig.name || queryConfig.query || 'query';

  try {
    const cached = await loadCache({ cacheDir, topicId, label, payload: cachePayload });
    if (cached?.items) {
      console.log(`[google] ${label} cache hit with ${cached.items.length} items`);
      return normalizeItems(cached.items);
    }
  } catch (error) {
    console.warn(`[google] cache read failed for ${label}: ${error.message}`);
  }

  try {
    const response = await axios.get(GOOGLE_ENDPOINT, { params });
    const items = response.data?.items || [];
    console.log(`[google] ${label} returned ${items.length} items`);
    await saveCache({ cacheDir, topicId, label, payload: cachePayload, response: { items } });
    return normalizeItems(items);
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    console.warn(`[google] Query "${label}" failed: ${msg}`);
    return [];
  }
}

async function normalizeItems(items) {
  const results = [];
  for (const item of items) {
    const title = item.title || '';
    const url = item.link || '';
    const source = item.displayLink || '';
    const publishedAt = extractPublishedAt(item);
    let summary = item.snippet || item.htmlSnippet || '';
    let mediaType;
    let mediaUrl;
    let skipReason;

    if (!summary || summary.length < 500) {
      try {
        const extracted = await fetchAndExtract(url);
        if (extracted?.content) {
          summary = extracted.content;
          console.log(`[google] Fallback extraction used for ${url} (${summary.length} chars)`);
        } else {
          mediaType = extracted?.mediaType;
          mediaUrl = extracted?.mediaUrl;
          skipReason = extracted?.skipReason;
          if (skipReason) {
            console.log(`[google] Extraction skipped for ${url}: ${skipReason}`);
          }
        }
      } catch {
        // ignore extraction errors
      }
    }

    results.push({ title, summary, url, source, publishedAt, mediaType, mediaUrl, skipReason });
  }
  return results;
}

function extractPublishedAt(item) {
  const meta = item.pagemap?.metatags?.[0];
  const news = item.pagemap?.newsarticle?.[0];
  const candidates = [
    meta?.['article:published_time'],
    meta?.['og:updated_time'],
    news?.datepublished,
    news?.datemodified,
  ].filter(Boolean);
  if (!candidates.length) return undefined;
  const parsed = Date.parse(candidates[0]);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}
