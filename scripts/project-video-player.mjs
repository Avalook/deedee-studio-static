/* Restores the Wix video player on project routes whose markup was mirrored as an empty div.
   Sources are limited to embeds verified in the live Wix DOM, one entry per route. */
export const VERIFIED_PLAYERS = [
  {
    route: '/freefirehack',
    containerId: 'comp-l9pb1lco4',
    src: 'https://www.youtube.com/embed/I8aDHqsLAGE',
    title: 'NÊN LÀM GÌ KHI GẶP HACK? | GARENA FREE FIRE',
  },
  {
    route: '/en/freefirehack',
    containerId: 'comp-l9pb1lco4',
    src: 'https://www.youtube.com/embed/I8aDHqsLAGE',
    title: 'NÊN LÀM GÌ KHI GẶP HACK? | GARENA FREE FIRE',
  },
  {
    route: '/all-project/let-victory-make-history',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/IZis5cqW0dM',
    title: 'LET VICTORY MAKE HISTORY - @RhymasticOfficial ft. GDucky | Bài hát chủ đề AIC 2020',
  },
];

const EMBED_HOSTS = new Set(['www.youtube.com']);
const ALLOW = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share';

export function normalizePageRoute(pathname) {
  let route = String(pathname || '/').replace(/^\/deedee-studio-static(?=\/|$)/, '').replace(/\/$/, '') || '/';
  try {
    route = decodeURI(route);
  } catch {
    /* Keep a malformed encoded path stable so it simply matches no player. */
  }
  return route;
}

export function createEmbedFrame(doc, player) {
  let url;
  try {
    url = new URL(player.src);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !EMBED_HOSTS.has(url.hostname)) return null;
  if (!/^\/embed\/[\w-]+$/.test(url.pathname)) return null;

  const frame = doc.createElement('iframe');
  frame.setAttribute('src', url.href);
  frame.setAttribute('title', player.title);
  frame.setAttribute('allow', ALLOW);
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  frame.setAttribute('width', '100%');
  frame.setAttribute('height', '100%');
  frame.style.display = 'block';
  frame.style.position = 'absolute';
  frame.style.inset = '0px';
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.border = '0';
  return frame;
}

export function installProjectVideoPlayer(doc = document, pathname = typeof location === 'undefined' ? '/' : location.pathname) {
  const route = normalizePageRoute(pathname);
  for (const player of VERIFIED_PLAYERS) {
    if (player.route !== route) continue;
    const container = doc.getElementById(player.containerId);
    if (!container) continue;
    const frame = createEmbedFrame(doc, player);
    if (!frame) continue;
    container.style.position = 'relative';
    container.replaceChildren(frame);
  }
}

if (typeof document !== 'undefined') installProjectVideoPlayer();
