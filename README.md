# France–Africa Daily Researcher

CLI tool that aggregates Perigon news search results for configured research topics, summarizes them with OpenAI, and delivers the output via email.

## Requirements

- Node.js 18+
- Perigon API key
- OpenAI API key (GPT-4 class model recommended)
- SMTP credentials (Gmail, SES, Mailgun, etc.)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the secrets:

   ```bash
   cp .env.example .env
   ```

3. Edit `config/topics.json` to add/update topics, destination emails, and queries.

## Usage

Run every configured topic:

```bash
node cli.js --topics ./config/topics.json --days 1
```

Run a single topic and skip the email send (dry run prints the brief to stdout):

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
| `--dry-run` | Skip SMTP send, print output locally | `false` |
| `--max-items` | Max curated items per topic sent to OpenAI | `80` |
| `--data-dir` | Directory for reading/writing archives used for diffs | `./data` |
| `--no-archive` | Skip writing today’s snapshot (useful during testing) | `archive=true` |

## Flow Summary

1. Load `.env` + topics config.
2. For each topic (or the selected one):
   - Execute each Perigon query (parallelized w/ `p-limit`).
   - Normalize, dedupe by URL/title, sort by recency, and trim to `max-items`.
   - Load yesterday’s archived snapshot (if it exists) and compute a diff (New / Updated / Watchlist / Resolved).
   - Send the topic prompt + today/yesterday datasets + diff summary to OpenAI (`gpt-4o-mini` default) for a Markdown brief that highlights changes.
   - Email the Markdown brief to the destination address (or print in dry-run).
   - Persist today’s curated items under `./data/YYYY-MM-DD/{topicId}.json` (unless `--no-archive`).

Errors during Perigon calls are logged per-query but do not stop the run; OpenAI or SMTP failures surface and exit non-zero so they can be retried.

## Scheduling

Once tested manually, invoke the CLI from cron, GitHub Actions, or another scheduler (ensure secrets are available in each environment). Persisting raw data under `./data/YYYY-MM-DD/<topicId>.json` can be added later for diffing or auditing.
