import fs from 'fs/promises';
import path from 'path';
import { loadEnv, loadTopics, filterTopics, DEFAULT_TOPICS_PATH } from './config.js';
import { dedupeItems, formatWindowLabel, sortByPublishedAtDesc } from './util.js';
import { createSummarizer } from './summarize.js';
import { saveToday } from './persistence.js';
import { loadScoringConfig, deepMerge } from './scoring-config.js';
import { scoreItems } from './scoring.js';
import { renderHtmlReport } from './html-report.js';
import { searchGoogleForQuery } from './googleSearch.js';

export async function runDailyResearcher(options = {}) {
  loadEnv();

  const {
    topics: topicsPath = DEFAULT_TOPICS_PATH,
    topicId,
    days = 1,
    dryRun = false,
    maxItems = 80,
    dataDir = './data',
    cacheDir,
    distDir = './dist',
    scoringConfigPath = './config/scoring.json',
    scoringOverridesPath,
    archive = true,
  } = options;

  const topics = await loadTopics(topicsPath);
  const selectedTopics = filterTopics(topics, topicId);
  if (!selectedTopics.length) {
    throw new Error(
      topicId
        ? `Topic with id "${topicId}" was not found in ${path.resolve(topicsPath)}.`
        : 'No topics configured.'
    );
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required.');
  }

  const summarizer = createSummarizer({ apiKey: openAiApiKey, model: process.env.OPENAI_MODEL });
  const scoringOverrides = await loadOverrides(scoringOverridesPath);

  const windowLabel = formatWindowLabel(days);
  const todayISO = new Date().toISOString().slice(0, 10);
  const resolvedCacheDir = cacheDir || path.resolve(dataDir, '.cache', 'google');
  const runResults = [];

  for (const topic of selectedTopics) {
    console.log(`\n[topic:${topic.id}] Fetching news for the ${windowLabel}...`);
    const articles = [];
    for (const query of topic.queries || []) {
      const items = await searchGoogleForQuery(topic.id, query, {
        todayISO,
        days,
        cacheDir: resolvedCacheDir,
        openAiApiKey,
      });
      articles.push(...items);
    }
    let curated = dedupeItems(sortByPublishedAtDesc(articles));

    console.log(`[topic:${topic.id}] ${curated.length} curated articles.`);

    const topicOverrides = resolveTopicOverrides(scoringOverrides, topic.id);
    const scoringConfig = await loadScoringConfig(topic.id, {
      configPath: scoringConfigPath,
      overrides: topicOverrides,
    });

    const scoredItems = scoreItems(curated, scoringConfig);
    let filtered = scoredItems
      // .filter(
      //   (item) => (item.signal?.score || 0) >= (scoringConfig.thresholds?.minScoreForInclusion ?? 0)
      // );
    filtered.sort((a, b) => (b.signal?.score || 0) - (a.signal?.score || 0));

    if (!filtered.length) {
      filtered = [...scoredItems].sort((a, b) => (b.signal?.score || 0) - (a.signal?.score || 0));
    }

    const topK = scoringConfig.thresholds?.topK ?? filtered.length;
    const limit = Math.min(topK, maxItems ?? topK);
    const topItems = filtered.slice(0, limit);

    console.log(
      `[topic:${topic.id}] Scoring complete. kept=${topItems.length} (threshold >= ${
        scoringConfig.thresholds?.minScoreForInclusion ?? 0
      })`
    );

    console.log(`[topic:${topic.id}] Generating brief via OpenAI...`);
    const brief = await summarizer({
      researchPrompt: topic.researchPrompt,
      windowLabel,
      topicId: topic.id,
      topicName: topic.name,
      items: topItems,
      metadata: {
        topicId: topic.id,
        topicName: topic.name,
        scoring: {
          thresholds: scoringConfig.thresholds,
        },
      },
    });
    console.log(`[topic:${topic.id}] Brief ready (${brief.length} chars).`);

    if (dryRun) {
      console.log(`\n[topic:${topic.id}] Dry run output:\n${brief}\n`);
    }

    if (archive) {
      try {
        const archiveInfo = await saveToday({
          dataDir,
          topicId: topic.id,
          todayISO,
          items: scoredItems,
          selectedItems: topItems,
          brief,
        });
        console.log(
          `[topic:${topic.id}] Archived items to ${archiveInfo.jsonPath} and brief to ${archiveInfo.markdownPath}`
        );
      } catch (error) {
        console.warn(`[topic:${topic.id}] Failed to archive items: ${error.message}`);
      }
    }

    runResults.push({
      topicId: topic.id,
      topicName: topic.name,
      researchPrompt: topic.researchPrompt,
      brief,
      items: topItems,
    });
  }

  if (runResults.length) {
    try {
      const htmlPath = await renderHtmlReport({
        distDir,
        dateISO: todayISO,
        results: runResults,
      });
      console.log(`[report] Static HTML page saved to ${htmlPath}`);
    } catch (error) {
      console.warn(`[report] Failed to render HTML page: ${error.message}`);
    }
  }
}

async function loadOverrides(overridesPath) {
  try {
    if (overridesPath) {
      const raw = await fs.readFile(path.resolve(overridesPath), 'utf-8');
      return JSON.parse(raw);
    }
    if (process.env.SCORING_OVERRIDES) {
      return JSON.parse(process.env.SCORING_OVERRIDES);
    }
  } catch (error) {
    console.warn(`[scoring] Failed to load overrides: ${error.message}`);
  }
  return null;
}

function resolveTopicOverrides(overrides, topicId) {
  if (!overrides) {
    return undefined;
  }
  const globalOverride = overrides.global || {};
  const topicOverride = overrides.topics?.[topicId] || overrides[topicId] || {};
  if (!Object.keys(globalOverride).length) {
    return Object.keys(topicOverride).length ? topicOverride : undefined;
  }
  return deepMerge(globalOverride, topicOverride);
}
