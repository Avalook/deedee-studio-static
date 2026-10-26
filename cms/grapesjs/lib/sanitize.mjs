import sanitizeHtmlLib from 'sanitize-html';
import { LIMITS } from './config.mjs';

export class ContentPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContentPolicyError';
    this.code = 'CONTENT_POLICY';
  }
}

const ALLOWED_TAGS = [
  'a',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'button',
  'caption',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'u',
  'ul',
];

const GLOBAL_ATTRIBUTES = [
  'class',
  'id',
  'style',
  'title',
  'role',
  'aria-label',
  'aria-hidden',
  'aria-describedby',
];

const EXTRA_ATTRIBUTES = {
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  ol: ['start', 'type'],
  ul: ['type'],
};

const allowedAttributes = { '*': GLOBAL_ATTRIBUTES };
for (const [tag, extra] of Object.entries(EXTRA_ATTRIBUTES)) {
  allowedAttributes[tag] = [...GLOBAL_ATTRIBUTES, ...extra];
}

const ALLOWED_ASSET_PATH = /^\/(?:demo-art\.svg|media\/[a-f0-9-]{36}\.(?:png|jpg|jpeg|webp|gif))$/i;
const ALLOWED_CSS_URL_PATH = /^\/(?:demo-art\.svg|media\/[a-f0-9-]{36}\.(?:png|jpg|jpeg|webp|gif))$/i;

const FORBIDDEN_CSS_PATTERNS = [
  /<\/?style/i,
  /@import\b/i,
  /expression\s*\(/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /(?:^|[;{\s])behavior\s*:/i,
  /-moz-binding/i,
];

function withoutOrigin(value, origin) {
  if (!value) return '';
  if (origin && value.startsWith(origin)) return value.slice(origin.length) || '/';
  return value;
}

export function isAllowedAssetUrl(value, origin = '') {
  if (typeof value !== 'string' || value.length > 500) return false;
  const normalized = withoutOrigin(value.trim(), origin);
  return ALLOWED_ASSET_PATH.test(normalized);
}

function isAllowedCssUrl(value, origin = '') {
  const trimmed = String(value || '').trim();
  if (trimmed.startsWith('#')) return true;
  return ALLOWED_CSS_URL_PATH.test(withoutOrigin(trimmed, origin));
}

function assertSafeCssValue(value, origin, { inline = false } = {}) {
  const css = String(value || '');
  for (const pattern of FORBIDDEN_CSS_PATTERNS) {
    if (pattern.test(css)) {
      if (inline) return null;
      throw new ContentPolicyError('CSS contains a forbidden construct');
    }
  }

  const urlPattern = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match;
  while ((match = urlPattern.exec(css))) {
    if (!isAllowedCssUrl(match[2], origin)) {
      if (inline) return null;
      throw new ContentPolicyError('CSS references a non-allowlisted URL');
    }
  }
  return css;
}

export function sanitizeCss(input, { origin = '' } = {}) {
  if (typeof input !== 'string') throw new ContentPolicyError('CSS must be a string');
  if (input.length > LIMITS.css) throw new ContentPolicyError('CSS is too large');
  return assertSafeCssValue(input, origin);
}

function transformTag(tagName, attribs, origin) {
  const next = { ...attribs };

  if (next.style) {
    const cleanStyle = assertSafeCssValue(next.style, origin, { inline: true });
    if (cleanStyle === null) delete next.style;
  }

  if (tagName === 'img') {
    if (!isAllowedAssetUrl(next.src, origin)) {
      return {
        tagName: 'span',
        attribs: { class: next.class || 'poc-image-removed' },
        text: next.alt ? `[${next.alt}]` : '[image removed by sanitizer]',
      };
    }
    next.src = withoutOrigin(next.src.trim(), origin);
    next.loading = 'lazy';
  }

  if (tagName === 'a') {
    const href = next.href || '';
    if (/^https?:\/\//i.test(href)) {
      next.rel = 'noopener noreferrer';
    }
  }

  return { tagName, attribs: next };
}

function buildTransformTags(origin) {
  const transformTags = {};
  for (const tag of ALLOWED_TAGS) {
    transformTags[tag] = (tagName, attribs) => transformTag(tagName, attribs, origin);
  }
  return transformTags;
}

export function sanitizeHtml(input, { origin = '' } = {}) {
  if (typeof input !== 'string') throw new ContentPolicyError('HTML must be a string');
  if (input.length > LIMITS.html) throw new ContentPolicyError('HTML is too large');

  return sanitizeHtmlLib(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template'],
    transformTags: buildTransformTags(origin),
    parser: { lowerCaseTags: true },
  });
}
