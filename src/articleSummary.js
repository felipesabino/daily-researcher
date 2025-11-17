import crypto from 'crypto';
import OpenAI from 'openai';
import { loadCache, saveCache } from './cache.js';

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const SYSTEM_PROMPT = `You are a news assistant. Given article text, produce a concise summary (3-5 sentences) capturing who/what/when/where/why and key impacts. Keep it factual and avoid speculation.`;

export async function summarizeContent({ url, content, cacheDir, topicId = 'global', model = DEFAULT_MODEL, apiKey }) {
  if (!content) return { summary: '', skipReason: 'empty content' };
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for article summarization.');

  const cachePayload = {
    url,
    hash: hashText(content),
    model,
  };
  const label = 'content-summary';
  try {
    const cached = await loadCache({ cacheDir, topicId, label, payload: cachePayload });
    if (cached?.summary) {
      return cached;
    }
  } catch (error) {
    console.warn(`[summary] cache read failed for ${url}: ${error.message}`);
  }

  const client = new OpenAI({ apiKey });
  try {
    const response = await client.responses.create({
      model,
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: content.slice(0, 8000) },
      ],
    });
    const summary = response?.output_text?.trim() || '';
    const record = { summary };
    await saveCache({ cacheDir, topicId, label, payload: cachePayload, response: record });
    return record;
  } catch (error) {
    console.warn(`[summary] Failed to summarize ${url}: ${error.message}`);
    return { summary: '', skipReason: error.message || 'summary failed' };
  }
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
