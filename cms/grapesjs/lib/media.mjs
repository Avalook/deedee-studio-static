import path from 'node:path';

/** Uploaded media: images and short videos. Videos are served by the static site, so keep them modest. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const IMAGE_EXTENSIONS = 'png|jpe?g|webp|gif';
export const VIDEO_EXTENSIONS = 'mp4|webm';
export const MEDIA_EXTENSIONS = `${IMAGE_EXTENSIONS}|${VIDEO_EXTENSIONS}`;
export const MEDIA_FILE = new RegExp(`^[a-f0-9-]{36}\\.(?:${MEDIA_EXTENSIONS})$`, 'i');

/** Identify an upload from its bytes (never from the client-supplied name or type). */
export function detectMedia(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: 'image', ext: 'png', mime: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { kind: 'image', ext: 'webp', mime: 'image/webp' };
  }
  const gifHead = buffer.length >= 6 ? buffer.toString('ascii', 0, 6) : '';
  if (gifHead === 'GIF87a' || gifHead === 'GIF89a') return { kind: 'image', ext: 'gif', mime: 'image/gif' };
  // MP4/MOV family: a size, then "ftyp" at byte 4.
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
  // WebM/Matroska: EBML header.
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { kind: 'video', ext: 'webm', mime: 'video/webm' };
  }
  return null;
}

export function limitFor(kind) { return kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES; }

/**
 * Optional separate repository that holds uploaded media, so the website repository stays small.
 * Both values are required: a local checkout of that repository and the public URL it is served from.
 */
export function mediaSettings(env = process.env) {
  const dir = env.CMS_MEDIA_REPO_DIR || '';
  const baseUrl = (env.CMS_MEDIA_BASE_URL || '').replace(/\/+$/, '');
  if (!dir && !baseUrl) return null;
  if (!path.isAbsolute(dir)) throw new Error('CMS_MEDIA_REPO_DIR must be an absolute path');
  let url;
  try { url = new URL(baseUrl); } catch { throw new Error('CMS_MEDIA_BASE_URL must be an https URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('CMS_MEDIA_BASE_URL must be a plain https URL');
  return { dir: path.resolve(dir), baseUrl };
}

/** Where a published upload lives: the media repository when configured, else the website's assets/cms. */
export function mediaLayout({ outDir, media }) {
  return media
    ? { root: media.dir, relative: (file) => `media/${file}`, url: (file) => `${media.baseUrl}/media/${file}` }
    : { root: outDir, relative: (file) => `assets/cms/${file}`, url: null };
}
