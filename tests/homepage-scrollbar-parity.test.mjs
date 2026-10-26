import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('homepage takes its scrollbar width from the runtime sync, not a forced 15px', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  // The body keeps Wix's captured value as the no-JS fallback; site-controls.mjs overwrites it with the real width.
  assert.match(html, /<body[^>]*style="--scrollbar-width:\s*15px;"/);
  // Forcing 15px on #aestk made the 751-1100px layout ~5px narrower than live wherever scrollbars are overlays.
  assert.doesNotMatch(html, /#aestk\{--scrollbar-width/);
  assert.doesNotMatch(html, /#aestk\s*\{\s*--scrollbar-width:0px\s*!important;\s*\}/);
  assert.doesNotMatch(html, /#comp-m7st7as9\{padding-bottom:1px!important;\}/);
});

test('mobile homepage hero offsets align with measured Wix positions', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /@media screen and \(min-width:320px\) and \(max-width:750px\)/);
  assert.match(html, /#comp-ms5wzsh8 h2\.wixui-rich-text__text\{font-size:8vw!important\}/);
  assert.doesNotMatch(html, /#comp-ms5wzsh8\{translate:/);
  assert.doesNotMatch(html, /#comp-mqoqnftt1\{translate:/);
  assert.doesNotMatch(html, /#comp-mseh4j1x\{translate:/);
  assert.doesNotMatch(html, /#comp-mseh40ur\{translate:/);
});
