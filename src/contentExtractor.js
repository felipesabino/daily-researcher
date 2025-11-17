import got from 'got';
import { load } from 'cheerio';
import { loadCache, saveCache } from './cache.js';

const BLOCKED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.mp4',
  '.mp3',
  '.wav',
  '.avi',
  '.mov',
  '.pdf',
  '.zip',
  '.rar',
];

export async function fetchAndExtract(url, { cacheDir, topicId = 'global', label = 'content' } = {}) {
  if (!url) return { content: '', skipReason: 'missing url' };
  const cachePayload = { url };
  try {
    const cached = await loadCache({ cacheDir, topicId, label: `${label}-extract`, payload: cachePayload });
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn(`[content] cache read failed for ${url}: ${error.message}`);
  }
  const nonText = isNonTextUrl(url);
  if (nonText.skip) {
    console.log(`[content] Skipping ${url} (${nonText.reason})`);
    return {
      content: '',
      skipReason: nonText.reason,
      mediaType: nonText.mediaType,
      mediaUrl: url,
    };
  }

  let targetUrl = url;
  if (url.includes('www.reddit.com')) {
    targetUrl = url.replace('www.reddit.com', 'old.reddit.com');
  }

  try {
    const response = await got(targetUrl, {
      timeout: { request: 10000 },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
      },
    });
    const contentType = response.headers['content-type'] || '';
    if (isBinaryContentType(contentType)) {
      console.log(`[content] Skipping ${url} due to content-type ${contentType}`);
      return {
        content: '',
        skipReason: `Non-text content type: ${contentType}`,
        mediaType: classifyMediaType(contentType),
        mediaUrl: url,
      };
    }

    const html = response.body;
    const $ = load(html);

    const iframeCount = $('iframe').length;
    const videoEmbeds = $('video, .video-container, .youtube-container, [class*="video"], [id*="video"]').length;
    const imageCount = $('img').length;
    const audioEmbeds = $('audio, [class*="audio"], [id*="audio"]').length;

    const bodyText = $('body').text().trim();
    const textLength = bodyText.length;

    const mediaSkip = evaluateMediaSkip({ iframeCount, videoEmbeds, imageCount, audioEmbeds, textLength }, $, url);
    if (mediaSkip) return mediaSkip;

    $('script, style, noscript, iframe, header, footer, nav, aside').remove();

    const possibleContainers = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      'main',
    ];

    let content = '';
    for (const selector of possibleContainers) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        if (content.length) break;
      }
    }
    if (!content) {
      content = $('body').text().trim();
    }

    if (content.length < 50) {
      console.log(`[content] ${url} insufficient text (${content.length} chars)`);
      return { content: '', skipReason: `Insufficient text content (${content.length} chars)`, mediaUrl: url };
    }

    const compressed = compressWhitespace(content);
    const meaningful = compressed.replace(/[\s\n\r\t.,;:!?()[\]{}'"\/\\<>+\-=_*&^%$#@~`|]/g, '');
    if (meaningful.length < 50) {
      console.log(`[content] ${url} lacks meaningful text (${meaningful.length} chars)`);
      return { content: '', skipReason: `Insufficient textual content (${meaningful.length} meaningful chars)`, mediaUrl: url };
    }

    const truncated = compressed.slice(0, 10000);
    console.log(`[content] Extracted ${truncated.length} chars from ${url}`);
    const record = { content: truncated };
    await saveCache({
      cacheDir,
      topicId,
      label: `${label}-extract`,
      payload: cachePayload,
      response: record,
    });
    return record;
  } catch (error) {
    console.warn(`[content] Failed to extract from ${url}: ${error.message || error}`);
    return { content: '', skipReason: error.message || 'fetch error', mediaUrl: url };
  }
}

function isNonTextUrl(url) {
  const lower = url.split('?')[0].toLowerCase();
  const ext = BLOCKED_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (ext) {
    return { skip: true, reason: `Non-text extension: ${ext}`, mediaType: classifyMediaType(ext) };
  }
  return { skip: false };
}

function isBinaryContentType(contentType) {
  const lowered = contentType.toLowerCase();
  return (
    lowered.includes('image/') ||
    lowered.includes('video/') ||
    lowered.includes('audio/') ||
    lowered.includes('application/pdf') ||
    lowered.includes('application/zip') ||
    lowered.includes('application/x-rar')
  );
}

function classifyMediaType(contentType = '') {
  const lowered = contentType.toLowerCase();
  if (lowered.includes('image/')) return 'image';
  if (lowered.includes('video/')) return 'video';
  if (lowered.includes('audio/')) return 'audio';
  if (lowered.includes('pdf')) return 'document';
  if (lowered.includes('zip') || lowered.includes('rar')) return 'archive';
  return 'media';
}

function evaluateMediaSkip(counts, $, url) {
  const { iframeCount, videoEmbeds, imageCount, audioEmbeds, textLength } = counts;
  if ((iframeCount > 0 || videoEmbeds > 0) && textLength < 1000) {
    let mediaUrl = url;
    const youtubeEmbed = $('iframe[src*="youtube"], iframe[src*="youtu.be"]').first();
    const vimeoEmbed = $('iframe[src*="vimeo"]').first();
    if (youtubeEmbed.length && youtubeEmbed.attr('src')) {
      mediaUrl = youtubeEmbed.attr('src');
    } else if (vimeoEmbed.length && vimeoEmbed.attr('src')) {
      mediaUrl = vimeoEmbed.attr('src');
    }
    return {
      content: '',
      skipReason: `Media embed with limited text (${textLength} chars)`,
      mediaType: 'video',
      mediaUrl,
    };
  }

  if (imageCount > 5 && textLength < 1000) {
    let mediaUrl = url;
    const firstImage = $('img').first();
    if (firstImage.length && firstImage.attr('src')) {
      mediaUrl = absolutize(firstImage.attr('src'), url);
    }
    return {
      content: '',
      skipReason: `Image-heavy content with limited text (${textLength} chars)`,
      mediaType: 'image',
      mediaUrl,
    };
  }

  if (audioEmbeds > 0 && textLength < 800) {
    let mediaUrl = url;
    const audio = $('audio source').first();
    if (audio.length && audio.attr('src')) {
      mediaUrl = absolutize(audio.attr('src'), url);
    }
    return {
      content: '',
      skipReason: 'Audio content with limited text',
      mediaType: 'audio',
      mediaUrl,
    };
  }

  return null;
}

function compressWhitespace(text) {
  return text.replace(/[\s\n\r\t]+/g, ' ').trim();
}

function absolutize(value, baseUrl) {
  if (!value) return baseUrl;
  if (value.startsWith('http')) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch (error) {
    return baseUrl;
  }
}
