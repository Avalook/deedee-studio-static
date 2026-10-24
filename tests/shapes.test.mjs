import assert from 'node:assert/strict';
import test from 'node:test';
import { collectShapeBackgrounds, repairFooterHtml, FOOTER_REPAIR_CSS } from '../scripts/shape-backgrounds.mjs';

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

test('footer correction is scoped to desktop footer only and is idempotent', () => {
  const html = '<html><head></head><body><nav>Header</nav><footer><nav>Footer</nav></footer></body></html>';
  const result = repairFooterHtml(html);
  assert.equal(result.match(/data-deedee-footer-repairs/g).length, 1);
  assert.equal(repairFooterHtml(result), result);
  assert.ok(result.includes('<nav>Header</nav>'));
  assert.match(FOOTER_REPAIR_CSS, /@media\s*\(min-width:\s*1001px\)/);
  assert.match(FOOTER_REPAIR_CSS, /footer nav/);
});

test('does not inject footer fixes into a page without an actual footer', () => {
  const html = '<html><head></head><body><script>const example="<footer>";</script></body></html>';
  assert.equal(repairFooterHtml(html), html);
});
