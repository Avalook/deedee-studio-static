import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('/en/service exposes English header and selector state', async () => {
  const html = await readFile(path.join(ROOT, 'en/service/index.html'), 'utf8');

  assert.match(html, /<html lang="en"/i);

  const skipButton = html.match(/<button[^>]*id="SKIP_TO_CONTENT_BTN"[^>]*>([\s\S]*?)<\/button>/i);
  assert.ok(skipButton, 'the keyboard skip control exists');
  assert.equal(skipButton[1].replace(/<[^>]*>/g, '').trim(), 'Skip to Main Content');

  const handles = [...html.matchAll(/<button\b(?=[^>]*data-testid="languages-dropdown-handle")[^>]*>[\s\S]*?<\/button>/gi)];
  assert.equal(handles.length, 2, 'header and pinned header selectors are present');
  for (const [markup] of handles) {
    assert.match(markup, /aria-label="Language Selector: English"/);
    assert.match(markup, /data-testid="languages-dropdown-option-text">EN<\/div>/);
  }

  const selectedEnglish = [...html.matchAll(/<div\b(?=[^>]*data-testid="dropdown-option-en")[^>]*class="([^"]*)"/gi)];
  const selectedVietnamese = [...html.matchAll(/<div\b(?=[^>]*data-testid="dropdown-option-vi")[^>]*class="([^"]*)"/gi)];
  assert.equal(selectedEnglish.length, 2);
  assert.ok(selectedEnglish.every(([, className]) => /\btJr0E9\b/.test(className) && /\bnOw6jW\b/.test(className)));
  assert.equal(selectedVietnamese.length, 2);
  assert.ok(selectedVietnamese.every(([, className]) => !/\btJr0E9\b|\bnOw6jW\b/.test(className)));

  const localRuntime = html.match(/<script[^>]*data-deedee-local-runtime[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(localRuntime, 'the localized route handler is available');
  assert.match(localRuntime[1], /"\/deedee-studio-static\/en\/service":"\/deedee-studio-static\/service"/);
  assert.match(localRuntime[1], /"\/deedee-studio-static\/service":"\/deedee-studio-static\/en\/service"/);
});
