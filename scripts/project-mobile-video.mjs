/**
 * On phones the project pages show a poster with a play button, and the player itself sits in a section hidden at
 * that width. The button links to the home page, on live Wix too, so a visitor can never reach the video.
 * Play it in an overlay instead, and drop the button on projects that have no video.
 */
const PLAY_BUTTON = '#comp-m7r8escp';
const PLAYER = 'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"], iframe[src*="player.vimeo.com/video"]';
const STYLE_ID = 'deedee-mobile-video-style';
const STYLES = `
[data-deedee-video-overlay] { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .9); }
[data-deedee-video-overlay] iframe { width: 100%; aspect-ratio: 16 / 9; border: 0; }
[data-deedee-video-overlay] button { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); right: 12px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: #fff; color: #000; font-size: 24px; line-height: 44px; cursor: pointer; }
`;

export function autoplayUrl(src) {
  const url = new URL(src);
  url.searchParams.set('autoplay', '1');
  url.searchParams.set('playsinline', '1');
  // The captured value names the Wix domain, which is not where this page runs.
  url.searchParams.delete('origin');
  return url.href;
}

function openOverlay(doc, src) {
  const overlay = doc.createElement('div');
  overlay.setAttribute('data-deedee-video-overlay', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Video');
  const frame = doc.createElement('iframe');
  frame.setAttribute('src', autoplayUrl(src));
  frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  frame.setAttribute('allowfullscreen', '');
  const close = doc.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  const dismiss = () => overlay.remove();
  close.addEventListener('click', dismiss);
  overlay.addEventListener('click', event => { if (event.target === overlay) dismiss(); });
  overlay.append(frame, close);
  doc.body.append(overlay);
  return overlay;
}

export function installProjectMobileVideo(doc = document) {
  const button = doc?.querySelector?.(PLAY_BUTTON);
  if (!button) return false;
  // The route's verified player may be added after this runs, so look it up on each tap.
  const source = () => doc.querySelector(PLAYER)?.getAttribute('src') ?? null;
  doc.addEventListener('click', event => {
    if (!event.target?.closest?.(PLAY_BUTTON)) return;
    event.preventDefault();
    event.stopPropagation();
    const src = source();
    if (src) openOverlay(doc, src);
  }, true);
  if (doc.head && !doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;
    doc.head.append(style);
  }
  const hideWithoutVideo = () => { if (!source()) button.style.setProperty('visibility', 'hidden'); };
  doc.defaultView?.setTimeout?.(hideWithoutVideo, 1500);
  return true;
}
