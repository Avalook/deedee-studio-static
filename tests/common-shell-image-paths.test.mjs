import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
