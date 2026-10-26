import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stylesheet = 'project-detail-route-geometry.css';
const affectedRoutes = [
  'all-project/green-sm',
  'en/all-project/green-sm',
  'en/all-project/an-unexpected-guest',
];

function readRoute(route) {
  return fs.readFileSync(path.join(root, route, 'index.html'), 'utf8');
}

test('the three measured project pages opt into their own geometry repair', () => {
  for (const route of affectedRoutes) {
    const html = readRoute(route);
    assert.ok(new RegExp(`<link[^>]+${stylesheet}`).test(html), `${route} must load the focused stylesheet`);
    assert.ok(/<body[^>]*data-deedee-project-route-geometry="true"/.test(html));
  }
});

test('project geometry repair is isolated from unrelated detail galleries', () => {
  for (const route of [
    'all-project/susu-card',
    'en/all-project/susu-card',
    'all-project/the-naugh-nice-business',
  ]) {
    const html = readRoute(route);
    assert.doesNotMatch(html, new RegExp(stylesheet), `${route} must keep the existing shared gallery behavior`);
    assert.doesNotMatch(html, /data-deedee-project-route-geometry="true"/);
  }
});

test('tablet/mobile scaling uses the source no-scrollbar width', () => {
  const css = fs.readFileSync(path.join(root, 'assets', stylesheet), 'utf8');
  const scope = 'body[data-deedee-project-route-geometry="true"]';

  assert.match(css, /@media\s*\(min-width:\s*320px\)\s*and\s*\(max-width:\s*1000px\)/);
  assert.match(css, /body\[data-deedee-project-route-geometry="true"\] #masterPage\s*\{[^}]*--scrollbar-width:\s*0px\s*!important/s);
});

test('focused stylesheet scopes the measured description and gallery components', () => {
  const css = fs.readFileSync(path.join(root, 'assets', stylesheet), 'utf8');
  const scope = 'body[data-deedee-project-route-geometry="true"]';

  assert.ok(css.includes(scope));
  assert.ok(css.includes(`${scope} #comp-m7r8hs8o .comp-m7r8hs8o-container`));
  assert.match(css, /@media\s*\(min-width:\s*320px\)\s*and\s*\(max-width:\s*430px\)/);
  assert.match(css, /grid-template-rows:\s*minmax\(\s*max\(0\.5px,\s*0\.7207614\s*\*\s*\(var\(--scaling-factor\)\s*-\s*var\(--scrollbar-width\)\)\),\s*auto\s*\)/);
  assert.match(css, /@media\s*\(min-width:\s*320px\)\s*and\s*\(max-width:\s*600px\)/);
  assert.match(css, /#comp-m7q89cml \.pro-gallery-margin-container\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(css, /#comp-m7q89cml \.pro-gallery-margin-container\s*\{[^}]*gap:\s*12px/s);
  assert.match(css, /#comp-m7dloa7s\s*\{[^}]*height:\s*auto/s);
  assert.match(css, /#comp-m73m1h5l \.comp-m73m1h5l-container\s*\{[^}]*grid-template-rows:\s*67px auto/s);
});
