import path from 'path';
import { loadEnv, loadTopics, filterTopics, DEFAULT_TOPICS_PATH } from './config.js';
import { fetchTopicArticles } from './perigon.js';
import {
  capItems,
  computeDiff,
  dedupeItems,
  formatWindowLabel,
  sortByPublishedAtDesc,
} from './util.js';
import { createSummarizer } from './summarize.js';
import { createMailer } from './mailer.js';
import { loadYesterday, saveToday } from './persistence.js';

export async function runDailyResearcher(options = {}) {
  loadEnv();

  const {
    topics: topicsPath = DEFAULT_TOPICS_PATH,
    topicId,
    days = 1,
    dryRun = false,
    maxItems = 80,
    dataDir = './data',
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

  const perigonApiKey = process.env.PERIGON_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const mailFrom = process.env.MAIL_FROM;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!perigonApiKey) {
    throw new Error('PERIGON_API_KEY is required.');
  }
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required.');
  }
  if (!dryRun && (!mailFrom || !smtpHost || !smtpUser || !smtpPass)) {
    throw new Error('SMTP credentials are missing; set them in .env or run with --dry-run for testing.');
  }

  const summarizer = createSummarizer({ apiKey: openAiApiKey, model: process.env.OPENAI_MODEL });
  const mailer = dryRun
    ? null
    : createMailer({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        from: mailFrom,
      });

  const windowLabel = formatWindowLabel(days);
  const todayISO = new Date().toISOString().slice(0, 10);

  for (const topic of selectedTopics) {
    console.log(`\n[topic:${topic.id}] Fetching news for the ${windowLabel}...`);
    const articles = await fetchTopicArticles(topic, { apiKey: perigonApiKey, days });
    let curated = dedupeItems(sortByPublishedAtDesc(articles));
    curated = capItems(curated, maxItems);

    console.log(`[topic:${topic.id}] ${curated.length} curated articles.`);

    const todayPayload = { dateISO: todayISO, topicId: topic.id, items: curated };
    const yesterdayPayload = await loadYesterday({ dataDir, topicId: topic.id, todayISO });
    const diff = computeDiff(todayPayload.items, yesterdayPayload.items);

    const brief = await summarizer({
      researchPrompt: topic.researchPrompt,
      windowLabel,
      topicId: topic.id,
      topicName: topic.name,
      today: todayPayload,
      yesterday: yesterdayPayload,
      previousDateLabel: yesterdayPayload?.dateISO,
      diff,
    });

    const subject = `${topic.name || topic.id} Daily – ${todayISO}`;

    if (dryRun) {
      console.log(`\n[topic:${topic.id}] Dry run output (email suppressed):\n${brief}\n`);
    } else {
      await mailer.send({
        to: topic.destinationEmail,
        subject,
        markdown: brief,
      });

      console.log(`[topic:${topic.id}] Newsletter sent to ${topic.destinationEmail}.`);
    }

    if (archive) {
      try {
        const archivePath = await saveToday({
          dataDir,
          topicId: topic.id,
          todayISO,
          items: todayPayload.items,
        });
        console.log(`[topic:${topic.id}] Archived items to ${archivePath}`);
      } catch (error) {
        console.warn(`[topic:${topic.id}] Failed to archive items: ${error.message}`);
      }
    }
  }
}
