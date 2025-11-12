# France–Africa Daily Researcher

CLI tool that aggregates Perigon news search results for configured research topics, summarizes them with OpenAI, and stores each daily brief (JSON + Markdown) under the `data/` directory.

## Requirements

- Node.js 18+
- Perigon API key
- OpenAI API key (GPT-4 class model recommended)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the secrets:

   ```bash
   cp .env.example .env
   ```

3. Edit `config/topics.json` to add/update topics and queries.
4. Optionally tweak `config/scoring.json` to adjust source tiers, relevance keywords, and thresholds.

## Usage

Run every configured topic:

```bash
node cli.js --topics ./config/topics.json --days 1
```

Run a single topic and just print the brief instead of inspecting the saved file (dry run still writes archives):

```bash
node cli.js --topics ./config/topics.json --topic-id france-africa --dry-run
```

Run with a custom archive directory:

```bash
node cli.js --topics ./config/topics.json --data-dir ./data --days 1
```

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--topics, -t` | Path to topics configuration JSON | `./config/topics.json` |
| `--topic-id` | Only run the topic with this id | all topics |
| `--days, -d` | Lookback window for Perigon queries | `1` |
| `--dry-run` | Print the generated brief to stdout in addition to writing files | `false` |
| `--max-items` | Max curated items per topic sent to OpenAI | `80` |
| `--data-dir` | Directory for reading/writing archives | `./data` |
| `--cache-dir` | Directory for caching Perigon API responses (defaults to `<dataDir>/.cache/perigon`) | derived |
| `--dist-dir` | Directory for writing the static HTML report | `./dist` |
| `--scoring-config` | Path to scoring configuration JSON | `./config/scoring.json` |
| `--scoring-overrides` | Path to runtime overrides merged on top of the scoring config | `undefined` |
| `--no-archive` | Skip writing today’s snapshot (useful during testing) | `archive=true` |

## Flow Summary

1. Load `.env` + topics config.
2. For each topic (or the selected one):
   - Execute each Perigon query (parallelized w/ `p-limit`). Each request/response is cached locally, so reruns reuse cached results unless the payload changes.
   - Normalize, dedupe by URL/title, sort by recency, and trim to `max-items`.
   - Load the scoring policy (`global` merged with topic-specific overrides, plus any runtime overrides) and compute per-article signal scores.
   - Filter/sort the articles based on the scoring thresholds, keep the top-K signals, and send them (ordered by score) to OpenAI (`gpt-4o-mini` default) for a Markdown brief.
   - Persist the full scored list (plus which items were selected) under `./data/YYYY-MM-DD/{topicId}.json`, save the rendered Markdown brief as `./data/YYYY-MM-DD/{topicId}.md`, and generate `./dist/YYYY-MM-DD/index.html` – a static newspaper-style page with toggles for prompts/sources (unless `--no-archive`).

### Topic-aware scoring config

- `config/scoring.json` defines a `global` policy plus per-topic overrides.
- At runtime the loader deep-merges `global -> topic -> overrides` (from `--scoring-overrides` or `SCORING_OVERRIDES`).
- Arrays merge with de-duplication (e.g., source domains), objects merge deeply (e.g., theme vocab).
- Thresholds (`minScoreForInclusion`, `minScoreForTopDevelopments`, `topK`) control how many high-signal items make it into the brief.

Errors during Perigon calls are logged per-query but do not stop the run; OpenAI or SMTP failures surface and exit non-zero so they can be retried.

## Scheduling

Once tested manually, invoke the CLI from cron, GitHub Actions, or another scheduler (ensure secrets are available in each environment). Persisting raw data under `./data/YYYY-MM-DD/<topicId>.json` can be added later for auditing or manual comparisons.
