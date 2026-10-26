import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Careers archive uses the measured single-column Wix layout on narrow screens', async () => {
  const [page, styles] = await Promise.all([
    readFile(path.join(ROOT, 'careers/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'assets/careers-responsive-parity.css'), 'utf8'),
  ]);

  assert.ok(page.includes('careers-responsive-parity.css'));
  assert.match(styles, /max-width:\s*600px/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /grid-auto-rows:\s*642\.5px/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /grid-auto-rows:\s*525\.5px/);
  assert.match(styles, /grid-auto-rows:\s*586\.25px/);
  assert.match(styles, /max-width:\s*1359px/);
  assert.match(styles, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /grid-auto-rows:\s*544px/);
  assert.match(styles, /min-height:\s*1121px/);
});

test('Careers mobile thumbnails stretch their Wix 4:3 image wrappers across the full card', async () => {
  const styles = await readFile(path.join(ROOT, 'assets/careers-responsive-parity.css'), 'utf8');

  assert.match(
    styles,
    /#pro-gallery-margin-container-comp-m8cy9ggi \.gallery-item-wrapper[\s\S]*?width:\s*100%\s*!important/,
  );
  assert.match(
    styles,
    /#pro-gallery-margin-container-comp-m8cy9ggi \.gallery-item-wrapper,\s*#pro-gallery-margin-container-comp-m8cy9ggi \.gallery-item-content\s*\{[^}]*margin:\s*0\s*!important/,
  );
  assert.match(
    styles,
    /#pro-gallery-margin-container-comp-m8cy9ggi \.gallery-item-content[\s\S]*?width:\s*100%\s*!important/,
  );
  assert.match(
    styles,
    /#pro-gallery-margin-container-comp-m8cy9ggi \[data-hook="item-container"\] > div:nth-child\(2\)[\s\S]*?width:\s*calc\(100% \+ 2px\)\s*!important/,
  );
});

test('Careers tablet grid matches the Wix three-column masonry measurements', async () => {
  const styles = await readFile(path.join(ROOT, 'assets/careers-responsive-parity.css'), 'utf8');
  const tablet = styles.match(/@media screen and \(min-width: 768px\) and \(max-width: 900px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const responsive = styles.match(/@media screen and \(min-width: 601px\) and \(max-width: 1359px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(tablet, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(tablet, /grid-auto-rows:\s*525\.5px/);
  assert.match(responsive, /gallery-item-wrapper[\s\S]*?width:\s*100%\s*!important/);
  assert.match(responsive, /gallery-item-content\s*\{[^}]*margin:\s*0\s*!important/);
  assert.match(responsive, /item-container"\] > div:nth-child\(2\)[\s\S]*?width:\s*calc\(100% \+ 2px\)\s*!important/);
});

test('Careers five-column desktop gallery stays responsive above 1600px', async () => {
  const styles = await readFile(path.join(ROOT, 'assets/careers-responsive-parity.css'), 'utf8');
  const desktop = styles.match(/@media screen and \(min-width: 1360px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(desktop, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(desktop, /item-link-wrapper[\s\S]*?width:\s*100%\s*!important/);
  assert.match(desktop, /item-container"\] > div:nth-child\(2\)[\s\S]*?width:\s*calc\(100% \+ 2px\)\s*!important/);
});
