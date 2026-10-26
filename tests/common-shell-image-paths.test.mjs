import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const shellAssets = [
  '6dc3f9480c6759f7a9c092ed.png',
  'ecd8c069780b3860a03c994a.png',
  '0d70c2876a83a92b4fc45667.png',
];

test('shared shell images use archived base assets instead of Wix transform URLs', () => {
  for (const asset of shellAssets) {
    assert.equal(existsSync(new URL(`../assets/${asset}`, import.meta.url)), true);
  }

  const pattern = `(${shellAssets.join('|')})/v1/fill/`;
  let matches = '';
  try {
    matches = execFileSync('git', ['grep', '-l', '-E', pattern, '--', '*.html'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (error.status !== 1) throw error;
  }

  assert.equal(matches, '', `Found stale shared image URLs: ${matches.split('\n')[0]}`);
});


// Wix currently sends this CTA through /blog to an /explore 404; the static alias repairs it to the existing news listing.
test('article “Xem tất cả” links resolve through the blog alias to the news listing', () => {
  const postsDirectory = new URL('../post/', import.meta.url);
  const postDirectories = readdirSync(postsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  assert.ok(postDirectories.length > 0, 'Expected archived article pages');
  for (const entry of postDirectories) {
    const articlePath = new URL(`../post/${entry.name}/index.html`, import.meta.url);
    const html = readFileSync(articlePath, 'utf8');
    const cta = html.match(/<a href="([^"]+)" class="vz0Mhy">Xem tất cả<\/a>/);
    assert.ok(cta, `Missing “Xem tất cả” CTA in ${entry.name}`);
    assert.equal(cta[1], '/deedee-studio-static/blog/');
  }

  const aliasHtml = readFileSync(new URL('../blog/index.html', import.meta.url), 'utf8');
  assert.match(aliasHtml, /url=\/deedee-studio-static\/news\//i);
  assert.ok(existsSync(new URL('../news/index.html', import.meta.url)));
});
