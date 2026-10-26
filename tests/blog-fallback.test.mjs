import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fallbacks = [
  ['blog/index.html', '../explore/'],
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
