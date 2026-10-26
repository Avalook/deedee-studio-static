import assert from 'node:assert/strict';
import test from 'node:test';
import { installGalleryScaling, scaleBakedGalleries } from '../scripts/gallery-scale.mjs';

function gallery({ baked = 1421, natural = baked, container = 1436 } = {}) {
  const props = {};
  const host = {
    style: { zoom: '', setProperty: (name, value) => { props[name] = value; }, removeProperty: name => { delete props[name]; } },
    parentElement: { getBoundingClientRect: () => ({ width: container }) },
  };
  const margin = {
    style: { width: baked ? `${baked}px` : '' },
    closest: () => host,
    getBoundingClientRect: () => ({ width: natural }),
  };
  return { margin, host, props };
}
const rootWith = (...items) => ({ querySelectorAll: () => items.map(item => item.margin) });

test('scales a gallery that still has its frozen capture width to the width it really has', () => {
  const g = gallery({ baked: 1421, container: 1436 });
  assert.equal(scaleBakedGalleries(rootWith(g)), 1);
  assert.ok(Math.abs(Number(g.host.style.zoom) - 1436 / 1421) < 1e-9);
  assert.ok(Math.abs(Number(g.props['--gallery-text-zoom']) - 1421 / 1436) < 1e-9);
});

test('leaves galleries that CSS already re-flows, and ones that already fit', () => {
  const reflowed = gallery({ baked: 1421, natural: 787, container: 787 });
  const fits = gallery({ baked: 1436, container: 1436 });
  assert.equal(scaleBakedGalleries(rootWith(reflowed, fits)), 0);
  assert.equal(reflowed.host.style.zoom, '');
  assert.equal(fits.host.style.zoom, '');
});

test('ignores scroll strips far wider than their container and galleries without a frozen width', () => {
  const marquee = gallery({ baked: 2534, container: 1440 });
  const unmeasured = gallery({ baked: 0, container: 1440 });
  assert.equal(scaleBakedGalleries(rootWith(marquee, unmeasured)), 0);
  assert.equal(marquee.host.style.zoom, '');
});

test('rescaling resets the previous zoom before measuring', () => {
  const g = gallery({ baked: 1421, container: 1436 });
  const root = rootWith(g);
  scaleBakedGalleries(root);
  g.host.parentElement.getBoundingClientRect = () => ({ width: 1421 });
  assert.equal(scaleBakedGalleries(root), 0);
  assert.equal(g.host.style.zoom, '');
  assert.equal(g.props['--gallery-text-zoom'], undefined);
});

test('installGalleryScaling scales once and again on resize', () => {
  const g = gallery({ baked: 1421, container: 1436 });
  const listeners = [];
  installGalleryScaling(rootWith(g), { addEventListener: (type, fn) => listeners.push([type, fn]) });
  assert.notEqual(g.host.style.zoom, '');
  assert.deepEqual(listeners.map(([type]) => type), ['resize']);
  g.host.parentElement.getBoundingClientRect = () => ({ width: 1421 });
  listeners[0][1]();
  assert.equal(g.host.style.zoom, '');
});

test('does not touch nodes that cannot report their gallery host', () => {
  const stub = { style: { width: '1421px' }, getBoundingClientRect: () => ({ width: 1421 }) };
  assert.equal(scaleBakedGalleries({ querySelectorAll: () => [stub] }), 0);
});
