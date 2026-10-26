import assert from 'node:assert/strict';
import test from 'node:test';
import { collectShapeBackgrounds, repairFooterHtml } from '../scripts/shape-backgrounds.mjs';

const info = { displayMode: 'fill', alignType: 'center', imageData: { uri: 'abc_shape~mv2.png', width: 1425, height: 811, hasAnimation: false, focalPoint: { x: 50, y: 70 } } };
const node = (data, attrs = '') => `<wow-image class="bgImage" data-image-info="${JSON.stringify(data).replaceAll('"', '&quot;')}" ${attrs}><img src="/assets/crop.png"></wow-image>`;

test('collects static authored fill backgrounds without changing metadata', () => {
  const original = structuredClone(info);
  const result = collectShapeBackgrounds(node(info));
  assert.equal(result.length, 1);
  assert.equal(result[0].uri, 'abc_shape~mv2.png');
  assert.deepEqual(info, original);
});

test('skips posters, animated media, unsupported effects and non-background images', () => {
  assert.equal(collectShapeBackgrounds(node({ imageData: info.imageData })).length, 0);
  assert.equal(collectShapeBackgrounds(node({ ...info, imageData: { ...info.imageData, hasAnimation: true } })).length, 0);
  assert.equal(collectShapeBackgrounds(node(info, 'data-bg-effect-name="parallax"')).length, 0);
  assert.equal(collectShapeBackgrounds(node(info).replace('class="bgImage"', 'class="card"')).length, 0);
});

test('does not infer a source from invalid metadata or path-like URIs', () => {
  assert.throws(() => collectShapeBackgrounds('<wow-image class="bgImage" data-image-info="oops"></wow-image>'), /metadata/i);
  assert.throws(() => collectShapeBackgrounds(node({ ...info, imageData: { ...info.imageData, uri: '../private.png' } })), /media/i);
});

test('removes the footer feedback override so the footer follows the live Wix wrapping', () => {
  const css = '@media (min-width: 1001px) { footer nav ul { flex-wrap: nowrap !important; } }';
  const html = `<html><head><style>a{}</style><style data-deedee-footer-repairs>${css}</style></head><body><footer><nav>Footer</nav></footer></body></html>`;
  const result = repairFooterHtml(html);
  assert.ok(!result.includes('data-deedee-footer-repairs'));
  assert.ok(!result.includes('flex-wrap: nowrap'));
  assert.ok(result.includes('<style>a{}</style>'));
  assert.equal(repairFooterHtml(result), result);
});
