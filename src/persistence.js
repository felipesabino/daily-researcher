import path from 'path';
import fs from 'fs/promises';

export async function saveToday({ dataDir, topicId, todayISO, items, selectedItems, brief }) {
  const dateISO = todayISO || new Date().toISOString().slice(0, 10);
  const dir = path.resolve(dataDir);
  const jsonPath = path.join(dir, `${topicId}.json`);
  const markdownPath = path.join(dir, `${topicId}.md`);
  await fs.mkdir(dir, { recursive: true });
  const payload = { dateISO, topicId, items, selectedItems };
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
  if (typeof brief === 'string') {
    await fs.writeFile(markdownPath, brief, 'utf-8');
  }
  return { jsonPath, markdownPath };
}
