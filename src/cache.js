import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

function sanitize(segment = '') {
  return (segment || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100) || 'default';
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function getCacheLocation({ cacheDir, topicId, label, hash }) {
  const safeTopic = sanitize(topicId);
  const safeLabel = sanitize(label);
  const dir = path.resolve(cacheDir, safeLabel, safeTopic);
  const file = path.join(dir, `${hash}.json`);
  return { dir, file };
}

export async function loadCache({ cacheDir, topicId, label, payload }) {
  if (!cacheDir) return null;
  const hash = hashPayload(payload);
  const { file } = getCacheLocation({ cacheDir, topicId, label, hash });
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const record = JSON.parse(raw);
    if (record.requestHash !== hash) {
      return null;
    }
    return record.response;
  } catch (error) {
    return null;
  }
}

export async function saveCache({ cacheDir, topicId, label, payload, response }) {
  if (!cacheDir) return;
  const hash = hashPayload(payload);
  const { dir, file } = getCacheLocation({ cacheDir, topicId, label, hash });
  const record = {
    savedAt: new Date().toISOString(),
    requestHash: hash,
    request: payload,
    response,
  };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(record, null, 2), 'utf-8');
}
