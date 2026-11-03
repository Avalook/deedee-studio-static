import assert from 'node:assert/strict';
import test from 'node:test';
import { counterpartPath, fallbackPath, isEnglishPath } from '../scripts/language-switch.mjs';
import { loadProjectData } from '../scripts/site-controls.mjs';
import { STATIC_BASE_PATH } from '../cms/grapesjs/lib/export.mjs';
import { localisePublishedMedia } from '../cms/grapesjs/lib/shared-overrides.mjs';

test('language switching works from custom-domain root routes', () => {
  assert.equal(isEnglishPath('/en/contact-us/'), true);
  assert.equal(isEnglishPath('/enrollment/'), false);
  assert.equal(counterpartPath('/'), '/en');
  assert.equal(counterpartPath('/en/'), '/');
  assert.equal(counterpartPath('/aboutus/'), '/en/studio');
  assert.equal(counterpartPath('/en/studio/'), '/aboutus');
  assert.equal(counterpartPath('/contact-us/'), '/en/contact-us');
  assert.equal(fallbackPath('/post/missing/', true), '/en/news');
  assert.equal(fallbackPath('/en/post/missing/', false), '/news');
});

test('project data and future CMS exports default to the custom-domain root', async () => {
  let requested;
  await assert.rejects(loadProjectData(async url => {
    requested = url;
    return { ok: false, status: 503 };
  }), /503/);
  assert.equal(requested, '/project-pages.json');
  assert.equal(STATIC_BASE_PATH, '');
});

test('CMS adopts published media from both root and previous project paths', () => {
  const file = '22222222-2222-2222-2222-222222222222.mp4';
  const result = localisePublishedMedia([
    { video: `/assets/cms/${file}` },
    { video: `/deedee-studio-static/assets/cms/${file}` },
  ]);
  assert.deepEqual(result.pages, [{ video: `/media/${file}` }, { video: `/media/${file}` }]);
  assert.deepEqual(result.files, [file]);
});
