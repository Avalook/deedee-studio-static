import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = file => readFileSync(resolve(ROOT, file), 'utf8');

// VI and EN service pages share Wix component ids, so they share one phone gallery rule set.
// A separate VI stylesheet used `height: auto` on the gallery boxes and clipped everything after the first tile.
test('Vietnamese service mobile galleries use the shared one-per-row 16:9 rules', () => {
  const page = read('service/index.html');
  const styles = read('assets/project-gallery-parity.css');

  assert.match(page, /data-deedee-service-gallery="true"/);
  assert.doesNotMatch(page, /service-mobile-parity\.css/);
  assert.match(styles, /@media \(min-width: 320px\) and \(max-width: 600px\) \{\s*body\[data-deedee-service-gallery="true"\] #comp-l9qgdb88/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(styles, /aspect-ratio:\s*16\s*\/\s*9\s*!important/);
  assert.doesNotMatch(styles, /data-deedee-en-service-gallery="true"\] #comp-l9qgdb88 \{\s*height:\s*168/);
});
