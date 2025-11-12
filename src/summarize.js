import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an analyst producing a concise daily brief.
Use the researchPrompt and curated items to describe the most important developments (who/what/when/where/why) grouped by themes such as diplomacy, policy, military, economic, public opinion, or notable statements.
Keep tone factual, compact, and ready for email delivery. Include Markdown links for cited sources.
After the main brief, append a section titled exactly "What changed from previous brief (from <previousDateLabel>)" using the provided previousDateLabel value.
Inside that section, summarize the diff arrays (New, Updated, Watchlist, ResolvedQuiet). For each non-empty category, list bullet points referencing titles and key changes; if empty, state "None".
Use the diff metadata plus today/yesterday data to explain what changed.`;

export function createSummarizer({ apiKey, model = 'gpt-4o-mini' } = {}) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const client = new OpenAI({ apiKey });

  return async function summarizeTopic({
    researchPrompt,
    windowLabel,
    topicId,
    topicName,
    today,
    yesterday,
    previousDateLabel,
    diff,
  }) {
    if (!researchPrompt) {
      throw new Error('Topic researchPrompt is required for summarization.');
    }

    const todayItems = today?.items || [];
    const yesterdayItems = yesterday?.items || [];

    if (!todayItems.length && !yesterdayItems.length) {
      return `No relevant articles were retrieved for the ${windowLabel}.`;
    }

    const payload = {
      topicId,
      topicName,
      researchPrompt,
      window: windowLabel,
      previousDateLabel: previousDateLabel || yesterday?.dateISO,
      today: {
        dateISO: today?.dateISO,
        items: todayItems,
      },
      yesterday: {
        dateISO: yesterday?.dateISO,
        items: yesterdayItems,
      },
      diff,
    };

    const response = await client.responses.create({
      model,
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload, null, 2) },
      ],
    });

    const content = response?.output_text?.trim();
    if (!content) {
      throw new Error('OpenAI returned an empty response.');
    }
    return content;
  };
}
