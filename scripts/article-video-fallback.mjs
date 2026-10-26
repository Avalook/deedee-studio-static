/**
 * Some articles were mirrored with their video as a bare link (<a data-hook="video-ssr-viewer">) that shows the raw
 * URL instead of a player. Replace it with an embedded player. Only YouTube, Vimeo and Facebook video URLs of the
 * exact expected shape are accepted; anything else is left as the link.
 */
const YOUTUBE_ID = /^[\w-]{6,20}$/;

export function videoEmbedFor(href) {
  let url;
  try { url = new URL(String(href)); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^(www|m)\./, '');
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : null;
    return id && YOUTUBE_ID.test(id) ? { src: `https://www.youtube.com/embed/${id}`, title: 'YouTube video' } : null;
  }
  if (host === 'vimeo.com') {
    const id = /^\/(\d{4,12})\/?$/.exec(url.pathname)?.[1];
    return id ? { src: `https://player.vimeo.com/video/${id}`, title: 'Vimeo video' } : null;
  }
  if (host === 'facebook.com' && /^\/[\w.-]+\/videos\/\d{6,20}\/?$/.test(url.pathname)) {
    const page = `https://www.facebook.com${url.pathname}`;
    return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(page)}&show_text=false`, title: 'Facebook video' };
  }
  return null;
}

export function installArticleVideoFallback(root = globalThis.document) {
  if (!root?.querySelectorAll) return 0;
  let replaced = 0;
  for (const link of root.querySelectorAll('[data-hook="video-player"] a[data-hook="video-ssr-viewer"]')) {
    if (typeof link.getAttribute !== 'function') continue;
    const embed = videoEmbedFor(link.getAttribute('href'));
    const holder = link.parentElement;
    if (!embed || !holder) continue;
    const frame = root.createElement('iframe');
    frame.setAttribute('src', embed.src);
    frame.setAttribute('title', embed.title);
    frame.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.style.cssText = 'display:block;width:100%;aspect-ratio:16/9;border:0;';
    holder.replaceChildren(frame);
    replaced += 1;
  }
  return replaced;
}
