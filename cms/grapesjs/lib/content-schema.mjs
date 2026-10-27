import sanitizeHtml from 'sanitize-html';
import { HttpError } from './http.mjs';

const IMAGE = /\.(?:png|jpe?g|gif|webp|avif|svg)$/i;
const UPLOAD = /^\/media\/[a-f0-9-]{36}\.(?:png|jpe?g|gif|webp)$/i;
const TEXT_LIMITS = { title: 180, summary: 1000, category: 100, author: 120, client: 180, year: 4, services: 1000 };

function invalid(message) { throw new HttpError(400, message, 'CONTENT_INVALID'); }

function text(value, name, max, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid(`${name} is invalid or too long`);
  return value.trim();
}

/** URLs are displayed by the browser; the CMS never fetches remote media. */
export function safeContentUrl(value, { image = false } = {}) {
  const url = text(value, 'URL', 2000);
  if (!url) return '';
  if (image && UPLOAD.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//') && !/[\\%?#]/.test(url)) {
    if (url.split('/').some((part) => part === '.' || part === '..')) invalid('Unsafe local URL');
    if (image && /^\/(?:deedee-studio-static\/)?assets\/[a-zA-Z0-9._/-]+$/.test(url) && IMAGE.test(url)) return url;
    if (!image && /^\/[a-zA-Z0-9_/-]*$/.test(url)) return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* Invalid URLs fail below. */ }
  invalid('Only safe local paths or HTTPS URLs are allowed');
}

export function sanitizeContentBody(value) {
  const html = text(value, 'bodyHtml', 200_000);
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption', 'hr', 'code', 'pre'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading'], ol: ['start'] },
    allowedSchemes: ['https', 'mailto', 'tel'], allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => {
        let href = '';
        try { href = /^mailto:|^tel:/.test(attrs.href || '') ? attrs.href : safeContentUrl(attrs.href); } catch { /* Remove unsafe links. */ }
        return { tagName: 'a', attribs: { href, rel: 'noopener noreferrer', ...(attrs.target === '_blank' ? { target: '_blank' } : {}) } };
      },
      img: (_tag, attrs) => {
        let src = '';
        try { src = safeContentUrl(attrs.src, { image: true }); } catch { /* Remove unsafe image source. */ }
        return { tagName: 'img', attribs: { src, alt: text(attrs.alt, 'alt', 500), loading: 'lazy' } };
      },
    },
  });
}

/** Return a new, bounded entity; output routes never come from client-supplied paths. */
export function validateContent(input, previous = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Content must be an object');
  const type = input.type ?? previous?.type ?? 'article';
  const language = input.language ?? previous?.language ?? 'vi';
  if (!['article', 'project'].includes(type) || !['vi', 'en'].includes(language)) invalid('Invalid content type or language');
  if (previous && (type !== previous.type || language !== previous.language)) invalid('Content type and language cannot change');
  const slug = text(input.slug, 'slug', 100, previous?.slug || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) invalid('slug must contain lowercase letters, numbers and single hyphens');
  const title = text(input.title, 'title', 180, previous?.title || '');
  if (!title) invalid('title is required');
  const fields = Object.fromEntries(Object.entries(TEXT_LIMITS).map(([name, max]) => [name, text(input[name], name, max, previous?.[name] || '')]));
  const gallery = input.gallery ?? previous?.gallery ?? [];
  if (!Array.isArray(gallery) || gallery.length > 40) invalid('gallery must contain at most 40 images');
  const featured = input.featured ?? previous?.featured ?? false;
  if (typeof featured !== 'boolean') invalid('featured must be true or false');
  const publishedAt = text(input.publishedAt, 'publishedAt', 40, previous?.publishedAt || new Date().toISOString());
  if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) invalid('publishedAt must be a valid date');
  if (fields.year && !/^(?:19|20|21)\d{2}$/.test(fields.year)) invalid('year must be a four-digit year');
  return { ...fields, title, type, language, slug, featured,
    publishedAt: new Date(publishedAt).toISOString(),
    bodyHtml: sanitizeContentBody(input.bodyHtml ?? previous?.bodyHtml ?? ''),
    cover: safeContentUrl(input.cover ?? previous?.cover, { image: true }),
    videoUrl: safeContentUrl(input.videoUrl ?? previous?.videoUrl),
    gallery: gallery.map((url) => safeContentUrl(url, { image: true })),
    route: `${language === 'en' ? '/en' : ''}/${type === 'article' ? 'post' : 'all-project'}/${slug}`,
  };
}
