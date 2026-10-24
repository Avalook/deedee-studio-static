import { installPartnerMarquee } from './partner-marquee.mjs';

const VIDEO_HOSTS = new Set(['video.wixstatic.com']);
const EMBED_HOSTS = new Set(['www.youtube.com', 'player.vimeo.com']);

export function animationDuration(width) { return Number.isFinite(width) && width > 0 ? width / 40 * 1000 : 0; }


export function normalizePageRoute(pathname) {
  let route = String(pathname || '/').replace(/^\/deedee-studio-static(?=\/|$)/, '').replace(/\/$/, '') || '/';
  try { route = decodeURI(route); } catch { /* Keep malformed encoded path stable for a 404. */ }
  return route;
}
export function safeMediaSource(media) {
  if (!media || !['video', 'iframe'].includes(media.kind) || typeof media.src !== 'string') return null;
  try {
    const url = new URL(media.src);
    if (url.protocol !== 'https:') return null;
    if (media.kind === 'video' && VIDEO_HOSTS.has(url.hostname) && url.pathname.endsWith('.mp4')) return { kind: 'video', src: url.href };
    if (media.kind === 'iframe' && EMBED_HOSTS.has(url.hostname) && (url.hostname === 'player.vimeo.com' ? /^\/video\/\d+$/.test(url.pathname) : /^\/embed\/[\w-]+$/.test(url.pathname))) return { kind: 'iframe', src: url.href };
  } catch { return null; }
  return null;
}
export function partnerItems(root) {
  const seen = new Set();
  return [...root.querySelectorAll('img')].flatMap(image => {
    const url = image.currentSrc || image.src;
    const width = Number.parseFloat(image.style.width);
    const height = Number.parseFloat(image.style.height);
    if (!url || seen.has(url) || !(width > 0 && height > 0)) return [];
    seen.add(url);
    return [{ image, ratio: width / height }];
  });
}
export function createPlayer(doc, source) {
  const safe = safeMediaSource(source);
  if (!safe) return null;
  if (safe.kind === 'video') {
    const video = doc.createElement('video');
    video.src = safe.src; video.controls = true; video.playsInline = true; video.autoplay = true;
    video.style.cssText = 'width:100%;height:auto;';
    return video;
  }
  const iframe = doc.createElement('iframe');
  const url = new URL(safe.src); url.searchParams.set('autoplay', '1');
  iframe.src = url.href; iframe.allow = 'autoplay; fullscreen; picture-in-picture'; iframe.allowFullscreen = true;
  return iframe;
}

export function installMediaMotion(root = document, pathname = location.pathname) {
  installPartnerMarquee(root);
  root.addEventListener('click', async event => {
    const preview = event.target.closest?.('[data-hook="video-player"] .react-player__preview');
    if (!preview) return;
    const route = normalizePageRoute(pathname);
    const wrapper = preview.closest('[data-hook="video-player"]');
    const players = [...root.querySelectorAll('[data-hook="video-player"]')];
    const index = players.indexOf(wrapper);
    if (!wrapper || index < 0) return;
    event.preventDefault();
    const response = await fetch('/deedee-studio-static/media-sources.json');
    if (!response.ok) return;
    const data = await response.json();
    const player = createPlayer(root, data.pages?.[route]?.[index]);
    if (player) wrapper.replaceChildren(player);
  });
}

if (typeof document !== 'undefined') installMediaMotion();
