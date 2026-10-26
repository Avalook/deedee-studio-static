import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('homepage wrapper preserves Wix 15px scrollbar scaling only across the measured tablet breakpoint', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<body[^>]*style="--scrollbar-width:\s*15px;"/);
  assert.match(html, /@media screen and \(min-width:751px\) and \(max-width:1100px\)\s*\{#aestk\{--scrollbar-width:15px!important;\}\}/);
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
