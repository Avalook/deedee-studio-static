// Browser context options per viewport width.
// Wix chooses its phone layout from the user agent, not only the width, so a narrow desktop window renders a
// layout real phones never see (e.g. /news at 419px: 1982px tall on desktop-narrow, 3977px on a phone).
// Widths under PHONE_MAX are therefore emulated as a phone; tablet and desktop widths stay desktop.
import { devices } from 'playwright-core';

export const PHONE_MAX = 600;

export function contextOptions(width, height = 900) {
  const base = { viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'vi-VN' };
  if (width >= PHONE_MAX) return base;
  return { ...base, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent };
}

// CLASSIC_SCROLLBARS=1 shows real 15px scrollbars like Windows and macOS with a mouse, instead of hidden/overlay ones.
// Wix scales many sizes with the scrollbar width, so both environments need checking.
export function launchOptions() {
  const base = { channel: 'chrome', headless: true };
  if (process.env.CLASSIC_SCROLLBARS !== '1') return base;
  return { ...base, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--disable-features=OverlayScrollbar,OverlayScrollbarFlashAfterAnyScrollUpdate'] };
}
