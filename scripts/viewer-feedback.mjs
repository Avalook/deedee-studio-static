/**
 * Layout changes asked for by the people who reviewed the clone (Notion "Feedback vibe code website DeeDee").
 * These deliberately differ from the live Wix site, so they live in one place and are easy to revert.
 */
export const FOOTER_FEEDBACK_CSS = `
/* Contact's replacement phone footer was captured without its desktop hide rule.
   The archived desktop footer already hides itself at 750px and below. */
@media (min-width: 751px) {
  #comp-mq7qhpf3 { display: none !important; }
}
@media (min-width: 1001px) {
  /* Footer menu: keep "Tuyển dụng" on the same row instead of wrapping it under the other labels. */
  footer nav ul { flex-wrap: nowrap !important; column-gap: 0 !important; }
  footer nav [data-part="label"] { font-size: clamp(12px, 1.31vw, 18px) !important; }
  /* Footer text block: bring the copyright and privacy lines closer together. */
  footer [id$="_r_comp-mehzue58"] { margin-top: -36px !important; }
}`;

export const CAREERS_HEADING_CSS = `
/* Careers hero: "ĐỘI NGŨ DEEDEE" stays together and starts the second line. */
#comp-m7786fs2 .color_22 { display: inline-block; }`;

export const VIEWER_FEEDBACK_CSS = `${FOOTER_FEEDBACK_CSS}\n${CAREERS_HEADING_CSS}\n`;

/** The pixel-diff tools add ?deedee-live-layout=1 to compare against the unmodified live layout. */
export function installViewerFeedbackStyles(doc = globalThis.document, win = globalThis.window) {
  if (new URLSearchParams(win?.location?.search ?? '').has('deedee-live-layout')) return false;
  if (!doc?.createElement || doc.querySelector?.('style[data-deedee-viewer-feedback]')) return false;
  const style = doc.createElement('style');
  style.setAttribute('data-deedee-viewer-feedback', '');
  style.textContent = VIEWER_FEEDBACK_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
  return true;
}
