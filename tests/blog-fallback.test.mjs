import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Wix sends /blog to an /explore 404; the Vietnamese alias is repaired to the news listing (see common-shell-image-paths.test.mjs).
const fallbacks = [
  ['blog/index.html', '/deedee-studio-static/news/'],
  ['en/blog/index.html', '../explore/'],
];

for (const [file, target] of fallbacks) {
  test(`${file} routes the Wix missing blog page without exposing a directory listing`, async () => {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(html, /http-equiv=["']refresh["']/i);
    assert.ok(html.includes(target), `Expected fallback destination ${target}`);
    assert.doesNotMatch(html, /Directory listing for/i);
  });
}
