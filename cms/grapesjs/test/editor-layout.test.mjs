import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the page preview stays reachable when it is wider than its panel', async () => {
  const css = await readFile(new URL('../public/admin/site-editor.css', import.meta.url), 'utf8');
  // Plain "center" pushes the overflow past the left edge, where scrolling cannot reach it.
  assert.match(css, /\.frame-scroll\{[^}]*justify-content:safe center/);
});
