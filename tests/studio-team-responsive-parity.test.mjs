import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Studio page links its responsive profile-gallery parity rules', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /data-deedee-studio-team-parity[^>]+studio-team-responsive-parity\.css/);
});

test('Studio profile cards scale to four columns across mobile, tablet, and desktop', async () => {
  const styles = await readFile(new URL('../assets/studio-team-responsive-parity.css', import.meta.url), 'utf8');

  assert.match(styles, /@media\s+screen\s+and\s*\(min-width:\s*320px\)\s+and\s*\(max-width:\s*750px\)/);
  assert.match(styles, /--deedee-studio-gallery-zoom:\s*calc\(\s*100vw\s*\/\s*1425px\s*\)/);
  assert.match(styles, /zoom:\s*var\(--deedee-studio-gallery-zoom\)\s*!important/);
  assert.match(styles, /height:\s*calc\(\s*100vw\s*\/\s*2\s*\)\s*!important/);
  assert.match(styles, /--deedee-studio-gallery-zoom:\s*calc\(\s*\(100vw\s*-\s*15px\)\s*\/\s*1425px\s*\)/);
  assert.match(styles, /height:\s*calc\(\s*\(100vw\s*-\s*15px\)\s*\/\s*2\s*-\s*0\.5px\s*\)\s*!important/);
});

test('Studio tablet team section retains Wix height without changing mobile section sizing', async () => {
  const styles = await readFile(new URL('../assets/studio-team-responsive-parity.css', import.meta.url), 'utf8');

  assert.match(styles, /@media\s+screen\s+and\s*\(min-width:\s*751px\)\s+and\s*\(max-width:\s*1000px\)[\s\S]*?#comp-l9pnod66\s*\{\s*min-height:\s*534px\s*!important;/);
  assert.doesNotMatch(styles, /@media[^{}]*max-width:\s*750px\s*\{[^{}]*#comp-l9pnod66\s*\{/s);
  assert.doesNotMatch(styles, /#comp-l9pnod66\s*\{[^}]*display:\s*none\s*!important/s);
});

test('Studio profile text keeps the Wix source size while gallery cells zoom responsively', async () => {
  const styles = await readFile(new URL('../assets/studio-team-responsive-parity.css', import.meta.url), 'utf8');

  assert.match(styles, /--deedee-studio-gallery-zoom:\s*calc\(\s*100vw\s*\/\s*1425px\s*\)/);
  assert.match(styles, /--deedee-studio-gallery-zoom:\s*calc\(\s*\(100vw\s*-\s*15px\)\s*\/\s*1425px\s*\)/);
  assert.match(styles, /#pro-gallery-comp-l9pnpcoc\s+\.info-element-title\s*\{[^}]*font-size:\s*calc\(\s*20px\s*\/\s*var\(--deedee-studio-gallery-zoom\)\s*\)[^}]*line-height:\s*calc\(\s*25px\s*\/\s*var\(--deedee-studio-gallery-zoom\)\s*\)/s);
  assert.match(styles, /#pro-gallery-comp-l9pnpcoc\s+\.info-element-description\s*\{[^}]*font-size:\s*calc\(\s*12px\s*\/\s*var\(--deedee-studio-gallery-zoom\)\s*\)[^}]*line-height:\s*calc\(\s*15px\s*\/\s*var\(--deedee-studio-gallery-zoom\)\s*\)/s);
});

test('Studio mobile profile labels use Wix-matched text gutters', async () => {
  const styles = await readFile(new URL('../assets/studio-team-responsive-parity.css', import.meta.url), 'utf8');

  assert.match(styles, /@media\s+screen\s+and\s*\(min-width:\s*320px\)\s+and\s*\(max-width:\s*750px\)[\s\S]*?#pro-gallery-comp-l9pnpcoc\s+\.info-element-text\s*\{\s*padding:\s*30px\s+0px\s+55px\s*!important;/);
});

test('Studio narrow-phone profiles use Wix one-line ellipsis labels and hide descriptions', async () => {
  const styles = await readFile(new URL('../assets/studio-team-responsive-parity.css', import.meta.url), 'utf8');

  assert.match(styles, /@media\s+screen\s+and\s+\(min-width:\s*320px\)\s+and\s+\(max-width:\s*600px\)[\s\S]*?#pro-gallery-comp-l9pnpcoc\s+\.info-element-text\s*\{\s*padding:\s*30px\s+18px\s+calc\(\s*46px\s*\/\s*var\(--deedee-studio-gallery-zoom\)\s*\)\s*!important;/);
  assert.match(styles, /#pro-gallery-comp-l9pnpcoc\s+\.info-element-title\s*\{[^}]*white-space:\s*nowrap\s*!important;[^}]*text-overflow:\s*ellipsis\s*!important;/s);
  assert.match(styles, /#pro-gallery-comp-l9pnpcoc\s+\.info-element-description\s*\{[^}]*display:\s*none\s*!important;/s);
});