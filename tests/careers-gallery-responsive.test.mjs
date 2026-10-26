import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../careers/index.html', import.meta.url), 'utf8');
const stylesheet = readFileSync(
  new URL('../assets/careers-gallery-responsive.css', import.meta.url),
  'utf8',
);

test('careers page loads a scoped responsive gallery stylesheet', () => {
  assert.match(page, /careers-gallery-responsive\.css\?v=6/);
  assert.match(stylesheet, /#pro-gallery-comp-m8cy9ggi/);
});

// Measured on the live site at 320-1920px: every card stays visible and the grid is 1 to 8 columns with a 32px pitch.
// An earlier version hid cards per breakpoint, from a measurement taken before Wix had built them all.
test('careers gallery follows the live Wix column breakpoints and never hides a card', () => {
  assert.match(stylesheet, /aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(stylesheet, /column-gap:\s*32px/);
  assert.match(stylesheet, /row-gap:\s*32px/);
  assert.match(stylesheet, /#pro-gallery-comp-m8cy9ggi \[data-hook="item-container"\]\s*\{\s*margin-bottom:\s*0\s*!important/);
  assert.doesNotMatch(stylesheet, /visibility:\s*hidden/);
  assert.doesNotMatch(stylesheet, /data-idx/);

  const blocks = stylesheet.split(/(?=@media\s)/).slice(1).map((block) => {
    const conditions = [...block.match(/^@media\s+([^{]+)/)[1].matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
    const columns = Number(block.match(/grid-template-columns:\s*repeat\((\d+),/)?.[1] ?? 0);
    return { conditions, columns };
  }).filter(({ columns }) => columns > 0);

  const columnsAt = (width) => blocks
    .filter(({ conditions }) => conditions.every(([, edge, value]) => (
      edge === 'min' ? width >= Number(value) : width <= Number(value)
    )))
    .map(({ columns }) => columns);

  const expected = new Map([[320, 1], [400, 1], [401, 2], [419, 2], [749, 2], [750, 3], [1037, 3], [1079, 3], [1080, 4], [1437, 4], [1438, 5], [1731, 5]]);
  for (const [width, columns] of expected) {
    assert.deepEqual(columnsAt(width), [columns], `columns at ${width}px`);
  }
  assert.deepEqual(columnsAt(1440), [5]);
  assert.deepEqual(columnsAt(1900).at(-1), 6);
  assert.deepEqual(columnsAt(2560).at(-1), 8);
});
