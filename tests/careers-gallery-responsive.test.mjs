import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../careers/index.html', import.meta.url), 'utf8');
const stylesheet = readFileSync(
  new URL('../assets/careers-gallery-responsive.css', import.meta.url),
  'utf8',
);

test('careers page loads a scoped responsive gallery stylesheet', () => {
  assert.match(page, /careers-gallery-responsive\.css\?v=1/);
  assert.match(stylesheet, /#pro-gallery-comp-m8cy9ggi/);
});

test('careers gallery follows Wix column and exact card visibility breakpoints', () => {
  for (const columns of [1, 2, 3, 4]) {
    assert.match(stylesheet, new RegExp(`grid-template-columns:\\s*repeat\\(${columns},`));
  }
  assert.match(stylesheet, /aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(stylesheet, /row-gap:\s*22px/);

  const mediaBlocks = stylesheet.split(/(?=@media\s)/).slice(1).map((block) => {
    const query = block.match(/^@media\s+([^\{]+)/)[1];
    const conditions = [...query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
    const hiddenIndices = block.includes('visibility: hidden')
      ? [...block.matchAll(/\[data-idx="(\d+)"\]/g)].map((match) => Number(match[1]))
      : [];
    return { conditions, hiddenIndices };
  });

  const hiddenAtWidth = (width) => [...new Set(mediaBlocks
    .filter(({ conditions }) => conditions.every(([, edge, value]) => (
      edge === 'min' ? width >= Number(value) : width <= Number(value)
    )))
    .flatMap(({ hiddenIndices }) => hiddenIndices))].sort((a, b) => a - b);

  const expected = new Map([
    [390, [2, 3, 4, 5, 6, 7, 8, 9]],
    [600, [4, 5, 6, 7, 8, 9]],
    [768, [6, 7, 8, 9]],
    [1024, [6, 7, 8, 9]],
    [1440, []],
  ]);
  const expectedVisibleCounts = new Map([[390, 2], [600, 4], [768, 6], [1024, 6], [1440, 10]]);

  for (const [width, expectedHidden] of expected) {
    const hidden = hiddenAtWidth(width);
    assert.deepEqual(hidden, expectedHidden, `hidden card indices at ${width}px`);
    assert.equal(10 - hidden.length, expectedVisibleCounts.get(width), `visible count at ${width}px`);
  }
});
