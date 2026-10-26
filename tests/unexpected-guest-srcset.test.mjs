import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeFile = path.join(root, 'en/all-project/an-unexpected-guest/index.html');
const base = '/deedee-studio-static/';

test('Unexpected Guest picture sources use verified local candidates', () => {
  const html = readFileSync(routeFile, 'utf8');
  const srcsets = [...html.matchAll(/<source\b[^>]*\bsrcset="([^"]+)"/g)].map((match) => match[1]);

  assert.equal(srcsets.length, 19, 'the route keeps all captured picture source entries');
  assert.equal(
    (html.match(/\/deedee-studio-static\/en\/all-project\/(?:h_|w_|q_|al_|enc_|usm_)/g) ?? []).length,
    0,
    'Wix transform fragments must not be interpreted as local routes',
  );

  for (const srcset of srcsets) {
    assert.match(srcset, /^\/deedee-studio-static\/assets\/[^,\s"]+\s+1x$/);
    const assetPath = path.join(root, srcset.slice(base.length).replace(/\s+1x$/, ''));
    assert.ok(existsSync(assetPath), 'missing local candidate: ' + srcset);
  }

  const pairedSources = [...html.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/g)]
    .map(([, picture]) => ({
      srcset: picture.match(/<source\b[^>]*\bsrcset="([^"]+)"/)?.[1],
      imageSrc: picture.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1],
    }))
    .filter(({ srcset }) => srcset);
  assert.equal(pairedSources.length, 19);
  for (const { srcset, imageSrc } of pairedSources) {
    assert.equal(srcset.replace(/\s+1x$/, ''), imageSrc, 'the responsive candidate is the paired img fallback');
  }

  assert.match(
    html,
    /<img loading="lazy" src="\/deedee-studio-static\/assets\/project-detail-ecd8c069780b3860a03c994a\.webp" alt="Frame 1171276725\.png"/,
    'the blank logo keeps its verified local image fallback',
  );
});
