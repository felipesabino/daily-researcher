import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

export const DEFAULT_TOPICS_PATH = './config/topics.json';

export function loadEnv() {
  dotenv.config();
}

export async function loadTopics(topicsPath = DEFAULT_TOPICS_PATH) {
  const resolvedPath = path.resolve(process.cwd(), topicsPath);
  const raw = await fs.readFile(resolvedPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.topics)) {
    throw new Error(`Invalid topics file at ${resolvedPath}`);
  }
  return parsed.topics;
}

export function filterTopics(topics, topicId) {
  if (!topicId) {
    return topics;
  }
  return topics.filter((topic) => topic.id === topicId);
}
