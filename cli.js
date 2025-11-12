#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runDailyResearcher } from './src/index.js';

const argv = yargs(hideBin(process.argv))
  .scriptName('daily-researcher')
  .usage('$0 --topics ./config/topics.json [--topic-id france-africa] [--days 1]')
  .option('topics', {
    alias: 't',
    type: 'string',
    describe: 'Path to topics configuration JSON file',
    default: './config/topics.json',
  })
  .option('topic-id', {
    type: 'string',
    describe: 'Run a single topic (matching id from config)',
  })
  .option('days', {
    alias: 'd',
    type: 'number',
    describe: 'Lookback window in days for Perigon queries',
    default: 1,
  })
  .option('dry-run', {
    type: 'boolean',
    describe: 'Print the generated brief to stdout (files are still written)',
    default: false,
  })
  .option('max-items', {
    type: 'number',
    describe: 'Maximum curated items to send to OpenAI per topic',
    default: 80,
  })
  .option('data-dir', {
    type: 'string',
    describe: 'Directory used to read/write daily archives',
    default: './data',
  })
  .option('cache-dir', {
    type: 'string',
    describe: 'Directory used to cache Perigon API responses',
    default: undefined,
  })
  .option('scoring-config', {
    type: 'string',
    describe: 'Path to scoring configuration JSON',
    default: './config/scoring.json',
  })
  .option('scoring-overrides', {
    type: 'string',
    describe: 'Path to JSON file with scoring overrides applied at runtime',
  })
  .option('archive', {
    type: 'boolean',
    describe: 'Persist today\'s curated items and brief to disk (use --no-archive to disable)',
    default: true,
  })
  .strict()
  .help()
  .parse();

runDailyResearcher({
  topics: argv.topics,
  topicId: argv.topicId,
  days: argv.days,
  dryRun: argv.dryRun,
  maxItems: argv.maxItems,
  dataDir: argv.dataDir,
  cacheDir: argv.cacheDir,
  scoringConfigPath: argv.scoringConfig,
  scoringOverridesPath: argv.scoringOverrides,
  archive: argv.archive,
})
  .then(() => {
    console.log('\nAll topics processed.');
  })
  .catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  });
