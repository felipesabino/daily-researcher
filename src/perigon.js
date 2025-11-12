import pLimit from 'p-limit';
import { Configuration, V1Api } from '@goperigon/perigon-ts';
import { cleanSummary, getDateRange } from './util.js';
import { loadPerigonCache, savePerigonCache } from './cache.js';

const DEFAULT_EXCLUDES = ['facebook.com', 'youtube.com'];

const clientCache = new Map();

export async function fetchTopicArticles(
  topic,
  {
    apiKey,
    days = 1,
    concurrency = 3,
    sourceGroup = 'news',
    excludeDomains = DEFAULT_EXCLUDES,
    cacheDir,
  } = {}
) {
  if (!apiKey) {
    throw new Error('PERIGON_API_KEY is not set.');
  }
  if (!topic || !Array.isArray(topic.queries) || topic.queries.length === 0) {
    return [];
  }

  const { from, to } = getDateRange(days);
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const limit = pLimit(concurrency);
  const client = getPerigonClient(apiKey);

  const queryTasks = topic.queries.map((query) =>
    limit(async () => {
      try {
        const label = query.name || query.query?.slice(0, 60) || 'unnamed query';
        console.log(
          `[perigon] Topic "${topic.id}" running "${label}" (from ${from} to ${to})`
        );
        const payload = buildSearchPayload(query, {
          fromDate,
          toDate,
          defaultSourceGroup: sourceGroup,
          defaultExcludeDomains: excludeDomains,
        });
        const cached = await loadPerigonCache({
          cacheDir,
          topicId: topic.id,
          label,
          payload,
        });
        if (cached) {
          const cachedArticles = cached.articles || [];
          console.log(
            `[perigon] "${label}" cache hit with ${cachedArticles.length} articles`
          );
          return cachedArticles.map(normalizeArticle);
        }
        const resp = await client.searchArticles(payload);
        const { articles = [], numResults } = resp;
        console.log(
          `[perigon] "${label}" responded with ${articles.length} articles (numResults=${
            typeof numResults === 'number' ? numResults : 'n/a'
          })`
        );
        await savePerigonCache({
          cacheDir,
          topicId: topic.id,
          label,
          payload,
          response: resp,
        });
        return articles.map(normalizeArticle);
      } catch (error) {
        console.warn(
          `[perigon] Query "${query.name || query.query}" failed: ${
            error?.message || error
          }`
        );
        return [];
      }
    })
  );

  const settled = await Promise.all(queryTasks);
  return settled.flat();
}

function normalizeArticle(article = {}) {
  return {
    title: article.title?.trim() || 'Untitled',
    summary: cleanSummary(article.summary || article.description || ''),
    url: article.url,
    publishedAt: article.publishedAt || article.dateTimePub || article.date,
    source: article.source?.name || article.domain,
  };
}

function getPerigonClient(apiKey) {
  if (clientCache.has(apiKey)) {
    return clientCache.get(apiKey);
  }
  const client = new V1Api(
    new Configuration({
      apiKey,
    })
  );
  clientCache.set(apiKey, client);
  return client;
}

function buildSearchPayload(
  query,
  { fromDate, toDate, defaultSourceGroup, defaultExcludeDomains }
) {
  const {
    query: queryString,
    lang,
    language,
    pageSize,
    size,
    sourceGroup,
    excludeSource,
    category,
    topic,
    topics,
    ...rest
  } = query;

  const payload = {
    ...rest,
    q: queryString ?? rest.q,
    from: fromDate,
    to: toDate,
    size: size ?? pageSize ?? 50,
    sourceGroup: normalizeArray(sourceGroup),
    excludeSource: normalizeArray(excludeSource),
    showReprints: false,
  };

  const normalizedLanguage = normalizeArray(language ?? lang);
  if (normalizedLanguage) {
    payload.language = normalizedLanguage;
  }

  const normalizedCategory = normalizeArray(category ?? topic ?? topics);
  if (normalizedCategory) {
    payload.category = normalizedCategory;
  }

  if (!payload.sourceGroup && defaultSourceGroup) {
    payload.sourceGroup = normalizeArray(defaultSourceGroup);
  }
  if (!payload.excludeSource && defaultExcludeDomains?.length) {
    payload.excludeSource = normalizeArray(defaultExcludeDomains);
  }

  return payload;
}

function normalizeArray(input) {
  if (input === undefined || input === null) return undefined;
  const arr = Array.isArray(input) ? input.filter(Boolean) : [input];
  return arr.length ? arr : undefined;
}
