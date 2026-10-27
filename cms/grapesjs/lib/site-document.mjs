const MAX_OPERATIONS = 1000;
const MAX_TEXT_LENGTH = 10_000;
const SELECTOR_ID = /^#[A-Za-z][A-Za-z0-9_-]{0,127}$/;
const SELECTOR_PATH = /^(?:#[A-Za-z][A-Za-z0-9_-]{0,127}|html|body|[a-z][a-z0-9-]*)(?::nth-of-type\([1-9]\d{0,3}\))?(?: > (?:#[A-Za-z][A-Za-z0-9_-]{0,127}|html|body|[a-z][a-z0-9-]*)(?::nth-of-type\([1-9]\d{0,3}\))?){0,40}$/;
const LOCAL_IMAGE = /^\/deedee-studio-static\/assets\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
const UPLOADED_IMAGE = /^\/media\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|gif)$/i;
const DEVICE_NAMES = ['desktop', 'laptop', 'tablet', 'mobile'];

const STYLE_FIELDS = new Set(['width', 'height', 'fontSize', 'color', 'backgroundColor']);
const OPERATION_FIELDS = new Set([
  'selector', 'text', 'image', 'href', 'hidden', 'deleted', 'width', 'height', 'fontSize', 'color', 'backgroundColor', 'offsets', 'responsive',
]);

/** Error raised when a CMS page override does not match its supported schema. */
export class SiteDocumentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SiteDocumentValidationError';
    this.code = 'INVALID_SITE_DOCUMENT';
  }
}

/** Create a new empty page model for the managed DeeDee home route. */
function normalizePageId(value) {
  if (value === 'home') return '/';
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith('/') || value.startsWith('//') || /[?#\\\\]/.test(value)) {
    throw new SiteDocumentValidationError('Page route is invalid');
  }
  const segments = value.split('/').filter(Boolean);
  try {
    if (segments.some((segment) => {
      const decoded = decodeURIComponent(segment);
      const containsControl = Array.from(decoded).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      });
      return ['.', '..'].includes(decoded) || decoded.includes('/') || decoded.includes(String.fromCharCode(92)) || containsControl;
    })) {
      throw new SiteDocumentValidationError('Page route is invalid');
    }
  } catch (error) {
    if (error instanceof SiteDocumentValidationError) throw error;
    throw new SiteDocumentValidationError('Page route encoding is invalid');
  }
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function createEmptySiteDocument(pageId = '/') {
  return { schemaVersion: 1, pageId: normalizePageId(pageId), operations: [], insertions: [] };
}

/** Validate and copy the allowlisted page override model. */
export function validateSiteDocument(value) {
  assertRecord(value, 'document');
  assertKeys(value, new Set(['schemaVersion', 'pageId', 'operations', 'insertions']), 'document');
  if (value.schemaVersion !== 1) throw new SiteDocumentValidationError('Only schema version 1 is supported');
  const pageId = normalizePageId(value.pageId);
  if (!Array.isArray(value.operations) || value.operations.length > MAX_OPERATIONS) {
    throw new SiteDocumentValidationError(`Too many operations (maximum ${MAX_OPERATIONS})`);
  }
  const insertionsInput = value.insertions === undefined ? [] : value.insertions;
  if (!Array.isArray(insertionsInput) || insertionsInput.length > 100) {
    throw new SiteDocumentValidationError('Too many inserted components (maximum 100)');
  }

  const selectors = new Set();
  const operations = value.operations.map((operation, index) => {
    assertRecord(operation, `operation ${index}`);
    assertKeys(operation, OPERATION_FIELDS, `operation ${index}`);
    const selector = validateSelector(operation.selector);
    if (selectors.has(selector)) throw new SiteDocumentValidationError(`Duplicate operation selector: ${selector}`);
    selectors.add(selector);
    if (operation.deleted === true && /^(?:html|body|main|nav|header|footer|#SITE_[A-Za-z0-9_-]+|#PAGES_CONTAINER|#masterPage)(?:$|:)/.test(selector)) {
      throw new SiteDocumentValidationError('Deleting the page structure is not allowed');
    }
    return Object.fromEntries([
      ['selector', selector], ['text', validateText(operation.text)], ['image', validateImage(operation.image)],
      ['href', validateHref(operation.href)], ['hidden', validateBoolean(operation.hidden)], ['deleted', validateBoolean(operation.deleted)],
      ['width', validateDimension(operation.width, 'width')], ['height', validateDimension(operation.height, 'height')],
      ['fontSize', validateFontSize(operation.fontSize)], ['color', validateColor(operation.color, 'color')],
      ['backgroundColor', validateColor(operation.backgroundColor, 'backgroundColor')],
      ['offsets', validateOffsets(operation.offsets)], ['responsive', validateResponsiveStyles(operation.responsive)],
    ].filter(([, field]) => field !== undefined));
  });

  const insertionIds = new Set();
  const insertions = insertionsInput.map((insertion, index) => {
    assertRecord(insertion, `insertion ${index}`);
    assertKeys(insertion, new Set(['id', 'type', 'text', 'image', 'href']), `insertion ${index}`);
    if (typeof insertion.id !== 'string' || !/^add_[a-f0-9-]{36}$/.test(insertion.id)) throw new SiteDocumentValidationError('Inserted component id is invalid');
    if (insertionIds.has(insertion.id)) throw new SiteDocumentValidationError('Duplicate inserted component id');
    insertionIds.add(insertion.id);
    if (!['text', 'button', 'image'].includes(insertion.type)) throw new SiteDocumentValidationError('Inserted component type is not allowed');
    const text = validateText(insertion.text);
    const image = validateImage(insertion.image);
    const href = validateHref(insertion.href);
    if (insertion.type === 'image' && !image) throw new SiteDocumentValidationError('Inserted image requires a local image');
    if (insertion.type !== 'image' && text === undefined) throw new SiteDocumentValidationError('Inserted text and button components require text');
    return Object.fromEntries([['id', insertion.id], ['type', insertion.type], ['text', text], ['image', image], ['href', href]].filter(([, field]) => field !== undefined));
  });
  return { schemaVersion: 1, pageId, operations, insertions };
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SiteDocumentValidationError(`${label} must be an object`);
  }
}

function assertKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new SiteDocumentValidationError(`${label} contains unsupported field: ${key}`);
    }
  }
}

function validateSelector(value) {
  const addedSelector = /^\[data-cms-added="add_[a-f0-9-]{36}"\]$/;
  if (typeof value !== 'string' || value.length > 1024 || value.includes('..')) {
    throw new SiteDocumentValidationError('Target selector is invalid');
  }
  if (!SELECTOR_ID.test(value) && !SELECTOR_PATH.test(value) && !addedSelector.test(value)) {
    throw new SiteDocumentValidationError('Target selector is not allowed');
  }
  return value;
}

function validateText(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
    throw new SiteDocumentValidationError(`Text must be a string up to ${MAX_TEXT_LENGTH} characters`);
  }
  return value;
}

function validateImage(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || (!LOCAL_IMAGE.test(value) && !UPLOADED_IMAGE.test(value)) || value.includes('..')) {
    throw new SiteDocumentValidationError('Image must reference an approved local asset');
  }
  return value;
}


function validateHref(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value) || value.includes(String.fromCharCode(92))) {
    throw new SiteDocumentValidationError('Link is invalid');
  }
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..')) return value;
  if (/^(mailto:|tel:)/i.test(value) && !/[\r\n]/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return value;
  } catch {
    // Reject malformed links below.
  }
  throw new SiteDocumentValidationError('Links must be local paths or safe HTTPS URLs');
}

function validateBoolean(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new SiteDocumentValidationError('hidden must be boolean');
  return value;
}

function validateDimension(value, field) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0 || value > 5000) {
    throw new SiteDocumentValidationError(`${field} must be between 0 and 5000 pixels`);
  }
  return Math.round(value * 100) / 100;
}

function validateFontSize(value) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 8 || value > 200) {
    throw new SiteDocumentValidationError('fontSize must be between 8 and 200 pixels');
  }
  return Math.round(value * 100) / 100;
}

function validateColor(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^#[a-f\d]{3}(?:[a-f\d]{3}|[a-f\d]{5})?$/i.test(value)) {
    throw new SiteDocumentValidationError(`${field} must be a hex color`);
  }
  return value;
}

function validateResponsiveStyles(value) {
  if (value === undefined) return undefined;
  assertRecord(value, 'responsive styles');
  const result = {};
  for (const [device, style] of Object.entries(value)) {
    if (!DEVICE_NAMES.includes(device)) throw new SiteDocumentValidationError(`Unsupported viewport: ${device}`);
    assertRecord(style, `${device} styles`);
    assertKeys(style, STYLE_FIELDS, `${device} styles`);
    const normalized = Object.fromEntries([
      ['width', validateDimension(style.width, `${device}.width`)],
      ['height', validateDimension(style.height, `${device}.height`)],
      ['fontSize', validateFontSize(style.fontSize)],
      ['color', validateColor(style.color, `${device}.color`)],
      ['backgroundColor', validateColor(style.backgroundColor, `${device}.backgroundColor`)],
    ].filter(([, field]) => field !== undefined));
    if (Object.keys(normalized).length) result[device] = normalized;
  }
  return result;
}

function validateOffsets(value) {
  if (value === undefined) return undefined;
  assertRecord(value, 'offsets');
  const offsets = {};
  for (const [device, point] of Object.entries(value)) {
    if (!DEVICE_NAMES.includes(device)) {
      throw new SiteDocumentValidationError(`Unsupported viewport: ${device}`);
    }
    assertRecord(point, `${device} offset`);
    assertKeys(point, new Set(['x', 'y']), `${device} offset`);
    const x = validateOffset(point.x, `${device}.x`);
    const y = validateOffset(point.y, `${device}.y`);
    offsets[device] = { x, y };
  }
  return offsets;
}

function validateOffset(value, field) {
  if (!Number.isFinite(value) || Math.abs(value) > 5000) {
    throw new SiteDocumentValidationError(`${field} must be between -5000 and 5000 pixels`);
  }
  return Math.round(value * 100) / 100;
}
