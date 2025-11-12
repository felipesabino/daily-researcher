import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';

export async function renderHtmlReport({ distDir, dateISO, results }) {
  const dir = path.resolve(distDir, dateISO);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'index.html');
  const html = buildHtmlDocument(dateISO, results);
  await fs.writeFile(filePath, html, 'utf-8');
  return filePath;
}

function buildHtmlDocument(dateISO, results) {
  const sections = results.map(renderTopicSection).join('\n');
  const toc = renderToc(results);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Daily Researcher – ${escapeHtml(dateISO)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f7f5ef;
      --fg: #1e1b16;
      --card: #ffffff;
      --border: #d8d2c4;
      --accent: #2f4c7a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Georgia', 'Times New Roman', serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
    }
    header {
      padding: 2rem 1rem;
      text-align: center;
      border-bottom: 1px solid var(--border);
      background: #fffef8;
    }
    header h1 {
      margin: 0;
      font-size: clamp(1.8rem, 3vw, 2.6rem);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    header p {
      margin: 0.4rem 0 0;
      font-size: 0.95rem;
      color: #5a5245;
    }
    .toc {
      background: #fffef8;
      border-bottom: 1px solid var(--border);
      padding: 0.75rem 1rem;
    }
    .toc-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      font-size: 0.9rem;
    }
    .toc-inner strong {
      margin-right: 0.5rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 0.8rem;
    }
    .toc-inner ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .toc-inner a {
      color: var(--accent);
      text-decoration: none;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .toc-inner a:hover {
      border-color: var(--border);
      background: #f4f0e6;
    }
    main {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem;
      max-width: 900px;
      margin: 0 auto;
    }
    .topic-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.5rem;
      box-shadow: 0 10px 28px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .topic-heading {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .topic-heading h2 {
      margin: 0;
      font-size: 1.45rem;
      letter-spacing: 0.06em;
    }
    .topic-id {
      margin: 0;
      color: #6c6456;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: flex-start;
    }
    button.toggle {
      border: 1px solid var(--border);
      background: #fff;
      color: var(--accent);
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button.toggle:hover,
    button.toggle[aria-expanded="true"] {
      background: #eef2fb;
    }
    .topic-body {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: minmax(0, 1fr);
    }
    .main-column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .prompt-box {
      border-top: 1px dashed var(--border);
      padding-top: 0.75rem;
    }
    .prompt-text {
      white-space: pre-wrap;
      font-family: 'Georgia', serif;
      font-size: 0.95rem;
      margin: 0;
    }
    .brief-body {
      background: #fcfbf7;
      border-left: 4px solid var(--border);
      padding: 0.9rem 1.1rem;
      font-size: 0.97rem;
    }
    .brief-body h1,
    .brief-body h2,
    .brief-body h3,
    .brief-body h4 {
      font-family: 'Playfair Display', 'Georgia', serif;
    }
    .sources-panel {
      border-left: 1px dashed var(--border);
      padding-left: 1rem;
    }
    .sources-panel[hidden] { display: none; }
    .sources-panel h3 {
      margin-top: 0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.85rem;
      color: #766b59;
    }
    .source-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .source-item {
      border: 1px solid #eee8dc;
      border-radius: 6px;
      padding: 0.75rem;
      background: #fff;
    }
    .source-item h3 {
      margin: 0 0 0.2rem;
      font-size: 1rem;
    }
    .source-item a {
      color: var(--accent);
      text-decoration: none;
    }
    .source-item a:hover {
      text-decoration: underline;
    }
    .source-meta {
      font-size: 0.8rem;
      color: #6f6558;
      margin-bottom: 0.4rem;
    }
    .summary-text {
      margin: 0.5rem 0 0;
      font-size: 0.9rem;
      background: #f4f2ec;
      padding: 0.5rem;
      border-radius: 4px;
      white-space: pre-wrap;
    }
    .topic-card.sources-visible .topic-body {
      grid-template-columns: minmax(0, 1fr) minmax(260px, 0.8fr);
    }
    .back-to-top {
      margin: 0;
      text-align: right;
      font-size: 0.85rem;
    }
    .back-to-top a {
      color: var(--accent);
      text-decoration: none;
    }
    .back-to-top a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <header id="top">
    <h1>Daily Researcher</h1>
    <p>Edition for ${escapeHtml(dateISO)}</p>
  </header>
  ${toc}
  <main>
    ${sections}
  </main>
  <script>
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-toggle]');
      if (!toggle) return;
      const targetId = toggle.getAttribute('data-toggle');
      const target = document.getElementById(targetId);
      if (!target) return;
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', (!expanded).toString());
      target.hidden = expanded;
      if (target.classList.contains('sources-panel')) {
        const card = toggle.closest('.topic-card');
        if (card) {
          card.classList.toggle('sources-visible', !expanded);
        }
      }
    });
  </script>
</body>
</html>`;
}

function renderTopicSection(result) {
  const safeId = sanitizeId(result.topicId || result.topicName || 'topic');
  const promptId = `prompt-${safeId}`;
  const sourcesId = `sources-${safeId}`;
  const briefHtml = renderMarkdown(result.brief || '');
  const promptHtml = escapeHtml(result.researchPrompt || '');
  const sourcesHtml = renderSources(result.items || [], safeId);
  return `<section class="topic-card" id="${safeId}">
    <div class="topic-heading">
      <div>
        <h2>${escapeHtml(result.topicName || result.topicId)}</h2>
        <p class="topic-id">ID: ${escapeHtml(result.topicId)}</p>
      </div>
      <div class="toolbar">
        <button class="toggle" data-toggle="${promptId}" aria-expanded="false">Prompt</button>
        <button class="toggle" data-toggle="${sourcesId}" aria-expanded="false">Sources (${result.items?.length || 0})</button>
      </div>
    </div>
    <div class="topic-body">
      <div class="main-column">
        <div class="prompt-box" id="${promptId}" hidden>
          <pre class="prompt-text">${promptHtml}</pre>
        </div>
        <article class="brief">
          <div class="brief-body">${briefHtml}</div>
        </article>
      </div>
      <aside class="sources-panel" id="${sourcesId}" hidden>
        <h3>Sources</h3>
        ${sourcesHtml}
      </aside>
    </div>
    <p class="back-to-top"><a href="#top">Back to top ↑</a></p>
  </section>`;
}

function renderToc(results) {
  if (!results.length) {
    return '';
  }
  const links = results
    .map((result) => {
      const safeId = sanitizeId(result.topicId || result.topicName || 'topic');
      return `<li><a href="#${safeId}">${escapeHtml(result.topicName || result.topicId || safeId)}</a></li>`;
    })
    .join('\n');
  return `<nav class="toc">
    <div class="toc-inner">
      <strong>Topics</strong>
      <ul>
        ${links}
      </ul>
    </div>
  </nav>`;
}

function renderSources(items, safeId) {
  if (!items.length) {
    return '<p>No sources available.</p>';
  }
  const listItems = items
    .map((item, index) => {
      const summaryId = `summary-${safeId}-${index}`;
      const title = escapeHtml(item.title || 'Untitled');
      const url = escapeHtml(item.url || '#');
      const summary = formatMultiline(item.summary || 'No summary provided.');
      return `<li class="source-item">
        <h3><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></h3>
        <div class="source-meta">Score: ${item.signal?.score ?? 'n/a'}</div>
        <button class="toggle" data-toggle="${summaryId}" aria-expanded="false">Summary</button>
        <div id="${summaryId}" class="summary-text" hidden>${summary}</div>
      </li>`;
    })
    .join('\n');
  return `<ul class="source-list">${listItems}</ul>`;
}

function sanitizeId(value) {
  return (value || 'section').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(value = '') {
  return marked.parse(value || '', { mangle: false, headerIds: false });
}

function formatMultiline(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br />');
}
