import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are writing a Morning Brew–style daily newsletter with a conversational, witty, high-density tone.
Use the provided research prompt and metadata for topic-specific focus; the style and structure below are constant for all topics.
Style: short sentences/paragraphs, light humor, crisp headers, Markdown output.
Structure:
- HEADER: 1–3 lines playful intro/byline.
- MAIN STORIES: For each high-signal item (order by signal.score desc):
  - SECTION TAG (e.g., GEOPOLITICS, SECURITY, ECONOMY, SUPPLY CHAIN, AVIATION, ENERGY).
  - Bold, punchy headline.
  - Optional image block only if an image URL is provided: [Image: <caption>](<url>).
  - Subsections:
    - What Happened (facts).
    - Why It Matters: apply the researchPrompt context; call out political/diplomatic angles, economic/energy, supply chain/logistics, aviation/air-cargo impacts (explicitly note if none).
    - Actors Involved.
    - Causes of the Event.
    - Short-Term Impact (weeks).
    - Long-Term Impact (6–24 months).
    - Sentiment: Positive/Negative/Mixed with 1-line rationale.
    - What Changed Since Yesterday (if provided; otherwise state “No prior change reference provided”).
- WHAT ELSE IS GOING ON: 3–7 bullets, 1–2 sentences each.
- BY THE NUMBERS: one impactful number + witty commentary.
- COMING UP: upcoming events relevant to the topic.
- SIGN-OFF: playful 1–2 lines.
Rules:
- Prioritize higher signal scores; condense or drop low-signal tails.
- Keep Markdown clean and readable; include source links via item URLs.
- Do not use the terms Monrning Brew or anything else 'brew' related.
- Do not fabricate images or data; only use provided fields.`;

export function createSummarizer({ apiKey, model = 'gpt-5-mini' } = {}) {
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
