import assert from 'node:assert/strict';
import test from 'node:test';
import { fixHtml } from '../scripts/fix-root-absolute-assets.mjs';

test('puts the Pages prefix back on root-absolute asset URLs only', () => {
  const html = '<source srcset="/deedee-studio-static/assets/a.png 165w, /assets/a.png 330w"><img src="../assets/b.png"><a href="/deedee-studio-static/assets/c.png"><div style="background:url(/assets/d.png)">';
  const { html: fixed, count } = fixHtml(html);
  assert.equal(count, 2);
  assert.equal(fixed, '<source srcset="/deedee-studio-static/assets/a.png 165w, /deedee-studio-static/assets/a.png 330w"><img src="../assets/b.png"><a href="/deedee-studio-static/assets/c.png"><div style="background:url(/deedee-studio-static/assets/d.png)">');
  assert.equal(fixHtml(fixed).count, 0, 'running it again changes nothing');
});
