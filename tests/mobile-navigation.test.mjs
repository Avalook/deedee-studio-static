import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  addMobileNavigationModule,
  installMobileNavigationScripts,
} from '../scripts/mobile-menu-parity.mjs';
import { matchingMenuPortalId } from '../scripts/mobile-navigation.mjs';

test('injects the mobile navigation module only when a menu needs it', () => {
  const html = '<html><body><button aria-label="Menu"></button></body></html>';
  const updated = addMobileNavigationModule(html);

  assert.ok(updated.indexOf('scripts/mobile-navigation.mjs') < updated.indexOf('</body>'));
  assert.equal(addMobileNavigationModule(updated), updated);
  assert.equal(
    addMobileNavigationModule('<script type="module" src="/scripts/site-controls.mjs"></script>'),
    '<script type="module" src="/scripts/site-controls.mjs"></script>',
  );
  assert.equal(addMobileNavigationModule('<html><body>No mobile menu</body></html>'), '<html><body>No mobile menu</body></html>');
});

test('matches a hamburger button to its portal through the nearest shared component id', () => {
  const ancestorIds = [
    'comp-mq7qhfjr_r_comp-mq7qezum3',
    'comp-mq7qhfjr_r_comp-mq7qezul',
    'comp-mq7qhfjr_r_comp-mq7qezue3',
  ];
  const portalIds = [
    'portal-comp-m71zow4h',
    'portal-comp-mq7qhfjr_r_comp-mq7qezue3',
    'portal-comp-m7vkqda21',
  ];

  assert.equal(
    matchingMenuPortalId(ancestorIds, portalIds),
    'portal-comp-mq7qhfjr_r_comp-mq7qezue3',
  );
  assert.equal(matchingMenuPortalId(['unrelated-trigger'], portalIds), null);
});

test('installs the menu module on live HTML pages and skips archived snapshots', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'deedee-mobile-nav-'));
  try {
    await writeFile(
      path.join(directory, 'index.html'),
      '<html><body><button aria-label="Menu"></button></body></html>',
    );
    await mkdir(path.join(directory, 'original'));
    await writeFile(
      path.join(directory, 'original', 'source.html'),
      '<html><body><button aria-label="Menu"></button></body></html>',
    );

    assert.deepEqual(await installMobileNavigationScripts(directory), { scanned: 1, updated: 1 });
    assert.deepEqual(await installMobileNavigationScripts(directory), { scanned: 1, updated: 0 });
    assert.match(await readFile(path.join(directory, 'index.html'), 'utf8'), /data-deedee-mobile-navigation/);
    assert.doesNotMatch(await readFile(path.join(directory, 'original', 'source.html'), 'utf8'), /mobile-navigation\.mjs/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
