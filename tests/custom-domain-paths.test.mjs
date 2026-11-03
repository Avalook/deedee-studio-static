import assert from 'node:assert/strict';
import test from 'node:test';
import { counterpartPath, fallbackPath, isEnglishPath } from '../scripts/language-switch.mjs';
import { loadProjectData } from '../scripts/site-controls.mjs';

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

test('project data defaults to the custom-domain root', async () => {
  let requested;
  await assert.rejects(loadProjectData(async url => {
    requested = url;
    return { ok: false, status: 503 };
  }), /503/);
  assert.equal(requested, '/project-pages.json');
});
