import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('uses archived original images on the Storyboard 101 post page', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const page = manifest.pages.find(({ route }) =>
    decodeURIComponent(route).includes('khóa-đào-tạo-nội-bộ-storyboard-101'),
  );
  assert.ok(page, 'Storyboard 101 route exists in the manifest');

  const html = await readFile(path.join(root, page.file), 'utf8');
  const imageCounts = [
    ['6dc3f9480c6759f7a9c092ed', 1],
    ['ecd8c069780b3860a03c994a', 1],
    ['0d70c2876a83a92b4fc45667', 2],
  ];

  for (const [hash, count] of imageCounts) {
    const localPath = `/deedee-studio-static/assets/${hash}.png`;
    assert.equal(html.split(`src="${localPath}"`).length - 1, count);
    assert.ok((await readFile(path.join(root, 'assets', `${hash}.png`))).byteLength > 0);
    assert.doesNotMatch(
      html,
      new RegExp(`(?:/deedee-studio-static)?/assets/${hash}\\.png/v1/fill/`),
    );
  }
});
