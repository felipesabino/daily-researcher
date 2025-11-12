import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an analyst producing a concise daily brief.
Use the researchPrompt and curated items to describe the most important developments (who/what/when/where/why) grouped by themes such as diplomacy, policy, military, economic, public opinion, or notable statements.
Items include signal scores; prioritize higher scores when structuring the brief.
Keep tone factual, compact, newsletter-style, and include Markdown links for cited sources.`;

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
    items,
    metadata,
  }) {
    if (!researchPrompt) {
      throw new Error('Topic researchPrompt is required for summarization.');
    }

    const todayItems = items || [];

    if (!todayItems.length) {
      return `No relevant articles were retrieved for the ${windowLabel}.`;
    }

    const payload = {
      topicId,
      topicName,
      researchPrompt,
      window: windowLabel,
      items: todayItems,
      metadata,
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
