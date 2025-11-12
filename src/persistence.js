import path from 'path';
import fs from 'fs/promises';

export async function loadYesterday({ dataDir, topicId, todayISO }) {
  const todayDate = todayISO || new Date().toISOString().slice(0, 10);
  const yesterdayISO = new Date(Date.parse(`${todayDate}T00:00:00Z`) - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const file = path.resolve(dataDir, yesterdayISO, `${topicId}.json`);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const json = JSON.parse(raw);
    if (!json || !Array.isArray(json.items)) {
      return { dateISO: yesterdayISO, items: [] };
    }
    return json;
  } catch (error) {
    return { dateISO: yesterdayISO, items: [] };
  }
}

export async function saveToday({ dataDir, topicId, todayISO, items }) {
  const dateISO = todayISO || new Date().toISOString().slice(0, 10);
  const dir = path.resolve(dataDir, dateISO);
  const file = path.join(dir, `${topicId}.json`);
  await fs.mkdir(dir, { recursive: true });
  const payload = { dateISO, topicId, items };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8');
  return file;
}
