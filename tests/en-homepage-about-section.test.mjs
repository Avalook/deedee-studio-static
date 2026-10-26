import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../en/index.html', import.meta.url), 'utf8');
const aboutSection = html.match(/<section id="comp-m7st7as9"[\s\S]*?<\/section>/)?.[0] ?? '';

const parityCss = await readFile(new URL('../assets/en-homepage-parity.css', import.meta.url), 'utf8');

test('English homepage preserves the Wix-sized About Us section without the broken 1px gallery fixer', () => {
  assert.doesNotMatch(html, /id="layout-fixer-style-comp-m8e63qxx"/);
  assert.match(aboutSection, /id="comp-m8e63qxx"/);
  assert.match(html, /href="\/deedee-studio-static\/assets\/en-homepage-parity\.css"/);
  assert.match(parityCss, /@media screen and \(min-width:\s*1101px\)/);
  assert.match(parityCss, /#comp-m6xtk73u #pro-gallery-comp-m8h9etbq \[data-hook="item-container"\]/);
  assert.match(parityCss, /display:\s*none\s*!important/);
  assert.match(parityCss, /height:\s*267px\s*!important/);
  assert.match(parityCss, /gap:\s*10px 12px\s*!important/);
  assert.match(parityCss, /flex-wrap:\s*wrap\s*!important/);
  assert.match(parityCss, /flex:\s*0 0 100%\s*!important/);
  assert.match(parityCss, /min-height:\s*32px\s*!important/);

  assert.match(parityCss, /@media screen and \(max-width:\s*750px\)/);
  assert.match(parityCss, /#pro-gallery-comp-m8e63qxx/);
  assert.match(parityCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(parityCss, /row-gap:\s*20px\s*!important/);
  assert.match(parityCss, /width:\s*calc\(100vw\s*-\s*33\.25px\)\s*!important/);
  assert.match(parityCss, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(parityCss, /height:\s*112px\s*!important/);
  assert.match(parityCss, /opacity:\s*1\s*!important/);

  for (const idx of ['0', '1', '2']) {
    assert.match(aboutSection, new RegExp(`data-idx="${idx}"`));
  }

  for (const title of [
    'DeeDee and',
    'When DeeDee Is Featured in English-Language Media',
    'Internal training program Storyboard 101',
  ]) {
    assert.ok(aboutSection.includes(title), `missing About Us card content: ${title}`);
  }
});
