import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  addMobileMenuStylesheet,
  installMobileMenuStylesheets,
} from '../scripts/mobile-menu-parity.mjs';

const root = new URL('../', import.meta.url);

test('adds the mobile menu stylesheet once inside the document head', () => {
  const html = '<html><head><title>Test</title></head><body></body></html>';
  const updated = addMobileMenuStylesheet(html);

  assert.ok(updated.indexOf('data-deedee-mobile-menu-parity') < updated.indexOf('</head>'));
  assert.equal(addMobileMenuStylesheet(updated), updated);
});

test('reports missing head tags instead of silently skipping a page', () => {
  assert.throws(() => addMobileMenuStylesheet('<html><body></body></html>'), /head tag/);
});

test('stylesheet installer is safe to rerun on an HTML workspace', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deedee-menu-'));
  try {
    await writeFile(path.join(directory, 'index.html'), '<html><head></head></html>');

    const first = await installMobileMenuStylesheets(directory);
    const second = await installMobileMenuStylesheets(directory);

    assert.deepEqual(first, { scanned: 1, updated: 1 });
    assert.deepEqual(second, { scanned: 1, updated: 0 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('homepage loads the responsive mobile menu parity stylesheet', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');

  assert.ok(html.includes('data-deedee-mobile-menu-parity'));
  assert.ok(html.includes('assets/mobile-menu-parity.css'));
});

test('mobile menu styles match the source panel and six evenly spaced rows', async () => {
  const css = await readFile(new URL('assets/mobile-menu-parity.css', root), 'utf8');

  assert.match(css, /@media\s*\(max-width:\s*750px\)/);
  assert.match(css, /#comp-m7hggz5t1/);
  assert.match(css, /width:\s*149px/);
  assert.match(css, /top:\s*62px/);
  assert.match(css, /height:\s*58\.2px/);
  assert.match(css, /font-size:\s*17\.65px/);
  assert.match(css, /line-height:\s*25\.2px/);
  assert.match(css, /padding:\s*16px 24px/);
  assert.match(css, /top:\s*-3\.15px/);
  assert.match(css, /text-decoration:\s*none\s*!important/);
});
