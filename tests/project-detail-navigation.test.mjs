import assert from 'node:assert/strict';
import test from 'node:test';
import { installProjectDetailBack, navigateToProjectList, projectListHref } from '../scripts/project-detail-navigation.mjs';

test('project detail Back link returns to the matching local project list route', () => {
  assert.equal(projectListHref('/deedee-studio-static/all-project/example/'), '/deedee-studio-static/our-work/');
  assert.equal(projectListHref('/deedee-studio-static/en/all-project/example/'), '/deedee-studio-static/en/our-work/');
  assert.equal(projectListHref('/en/all-project/example/'), '/en/our-work/');
  assert.equal(projectListHref('/all-project/en/'), '/our-work/');
  assert.equal(projectListHref('/news/'), null);
});

test('project detail navigation safely assigns the requested local destination', () => {
  const locationRef = {};
  assert.equal(navigateToProjectList('/deedee-studio-static/our-work/', locationRef), true);
  assert.equal(locationRef.href, '/deedee-studio-static/our-work/');
  assert.equal(navigateToProjectList('/our-work/', null), false);
});

test('project detail Back control supports click and keyboard activation', () => {
  const attributes = {};
  const listeners = new Map();
  const back = {
    dataset: {},
    style: {},
    setAttribute: (name, value) => { attributes[name] = value; },
  };
  const root = {
    getElementById: id => id === 'comp-m7r7z9pm' ? back : null,
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  const destinations = [];

  assert.equal(installProjectDetailBack(root, '/deedee-studio-static/all-project/example/', href => destinations.push(href)), true);
  assert.deepEqual(attributes, { role: 'link', tabindex: '0', 'aria-label': 'Back to projects' });
  assert.equal(back.style.cursor, 'pointer');

  const target = { closest: selector => selector === '#comp-m7r7z9pm' ? back : null };
  let prevented = 0;
  listeners.get('click')({ type: 'click', target, preventDefault: () => { prevented += 1; } });
  listeners.get('keydown')({ type: 'keydown', target, key: 'Enter', preventDefault: () => { prevented += 1; } });
  listeners.get('keydown')({ type: 'keydown', target, key: ' ', preventDefault: () => { prevented += 1; } });
  listeners.get('keydown')({ type: 'keydown', target, key: 'Escape', preventDefault: () => { prevented += 1; } });

  assert.deepEqual(destinations, [
    '/deedee-studio-static/our-work/',
    '/deedee-studio-static/our-work/',
  ]);
  assert.equal(prevented, 2);
});

test('project detail Back setup does nothing outside detail routes or without the control', () => {
  let listeners = 0;
  const root = {
    getElementById: () => null,
    addEventListener: () => { listeners += 1; },
  };
  assert.equal(installProjectDetailBack(root, '/deedee-studio-static/our-work/'), false);
  assert.equal(installProjectDetailBack(root, '/deedee-studio-static/all-project/example/'), false);
  assert.equal(listeners, 0);
});
