import assert from 'node:assert/strict';
import test from 'node:test';
import { repairBackgrounds } from '../scripts/backgrounds.mjs';

const uri = '7181ac_cdb39d9a44de432aa1512b03efc83681~mv2.png';
const target = '/assets/home-services-original.png';
const sources = { [uri]: target };
const info = JSON.stringify({ imageData: { uri } }).replaceAll('"', '&quot;');
const sample = `<wow-image class="bgImage" data-image-info="${info}"><img src="/assets/cropped.png" style="width:1425px;height:736px;object-fit:cover;object-position:42% 0%" alt="curve"></wow-image>`;

test('background fills its responsive container using the uncropped source', () => {
  const result = repairBackgrounds(sample, sources);
  assert.match(result, /src="\/assets\/home-services-original.png"/);
  assert.match(result, /width:100%;height:100%;object-fit:cover;object-position:42% 0%/);
  assert.doesNotMatch(result, /1425px|736px/);
});

test('supports the project subpath without prefixing it twice', () => {
  const result = repairBackgrounds(sample, sources, '/deedee-studio-static');
  assert.match(result, /src="\/deedee-studio-static\/assets\/home-services-original.png"/);
  assert.equal(repairBackgrounds(result, sources, '/deedee-studio-static'), result);
});

test('preserves unrelated images, scripts and all bytes outside the target img', () => {
  const ordinary = sample.replace('class="bgImage"', 'class="cardImage"');
  const content = `<script>const example = '${sample}';</script>\n${ordinary}\n${sample}`;
  const result = repairBackgrounds(content, sources);
  assert.ok(result.startsWith(`<script>const example = '${sample}';</script>\n${ordinary}\n`));
  assert.equal(repairBackgrounds(sample, {}), sample);
});

test('handles absent styles and removes stale srcset from a known background', () => {
  const input = sample.replace(/ style="[^"]*"/, ' srcset="/assets/cropped.png 1x"');
  const result = repairBackgrounds(input, sources);
  assert.match(result, /style="width:100%;height:100%/);
  assert.doesNotMatch(result, /srcset=/);
});

test('reports malformed metadata instead of guessing a source', () => {
  assert.throws(() => repairBackgrounds('<wow-image class="bgImage" data-image-info="oops"><img src="x"></wow-image>', sources), /background metadata/i);
});

test('leaves empty backgrounds untouched', () => {
  const empty = `<wow-image class="bgImage" data-image-info="${info}"></wow-image>`;
  assert.equal(repairBackgrounds(empty, sources), empty);
});


test('rejects unsafe base paths and asset mappings', () => {
  assert.throws(() => repairBackgrounds(sample, sources, '//example.com'), /Invalid base path/);
  assert.throws(() => repairBackgrounds(sample, { [uri]: 'https://example.com/x' }), /Invalid background asset/);
});
