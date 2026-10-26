import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('Vietnamese service mobile galleries render one full-width 16:9 image per row', () => {
  const page = readFileSync(resolve(ROOT, 'service/index.html'), 'utf8');
  const styles = readFileSync(resolve(ROOT, 'assets/service-mobile-parity.css'), 'utf8');

  assert.match(page, /data-deedee-vi-service-mobile-parity="true"/);
  assert.match(page, /assets\/service-mobile-parity\.css/);
  assert.match(styles, /body\[data-deedee-vi-service-mobile-parity="true"\]/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(styles, /width:\s*100%\s*!important/);
  assert.match(styles, /#comp-l9qg9eww[^}]*min-height:\s*1133px/);
  assert.match(styles, /#comp-l9qgpdv1[^}]*min-height:\s*707px/);
  assert.match(styles, /#comp-l9qgtn61[^}]*min-height:\s*710px/);
});
