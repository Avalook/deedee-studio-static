import assert from 'node:assert/strict';
import test from 'node:test';
import { contactHref, projectPage, toggleTestimonial, validateProjectData, loadProjectData, installSiteControls } from '../scripts/site-controls.mjs';

test('contact destinations preserve locale and Pages base path', () => {
  assert.equal(contactHref('/en/our-work/'), '/en/contact-us/');
  assert.equal(contactHref('/our-work'), '/contact-us/');
  assert.equal(contactHref('/deedee-studio-static/en/our-work/'), '/deedee-studio-static/en/contact-us/');
  assert.equal(contactHref('/deedee-studio-static/our-work/'), '/deedee-studio-static/contact-us/');
});

test('pagination follows the source six/nine-card batches without mutating data', () => {
  const items = Object.freeze(Array.from({ length: 13 }, (_, index) => String(index)));
  assert.deepEqual(projectPage(items, 6, 6), { items: items.slice(0, 12), count: 12, hasMore: true });
  assert.deepEqual(projectPage(items, 12, 6), { items: [...items], count: 13, hasMore: false });
  assert.equal(projectPage(items, 13, 9).count, 13);
  assert.throws(() => projectPage(items, -1, 6), /pagination/i);
});

test('testimonial expansion preserves text and restores the source clamp', () => {
  const classes = new Set(['iwXk2R']);
  const text = { classList: { toggle(name, enable) { if (enable) classes.add(name); else classes.delete(name); } } };
  const attrs = { 'aria-expanded': 'false' };
  const button = { textContent: 'Show More', dataset: {}, getAttribute: name => attrs[name], setAttribute: (name, value) => { attrs[name] = value; }, closest: () => ({ querySelector: () => text }) };
  assert.equal(toggleTestimonial(button), true);
  assert.equal(attrs['aria-expanded'], 'true');
  assert.equal(button.textContent, 'Show Less');
  assert.ok(!classes.has('iwXk2R'));
  toggleTestimonial(button);
  assert.equal(button.textContent, 'Show More');
  assert.ok(classes.has('iwXk2R'));
  assert.equal(toggleTestimonial({ closest: () => null }), false);
});

test('project data rejects executable markup and invalid shapes', () => {
  const page = { route: '/our-work', panel: 'panel', repeatId: 'repeat', buttonId: 'button', pageSize: 6, items: ['<div role="listitem"><a href="/deedee-studio-static/all-project/test">Test</a></div>'] };
  assert.deepEqual(validateProjectData({ pages: [page] }), [page]);
  for (const markup of ['<script>alert(1)</script>', '<img src="x" onerror="alert(1)">', '<a href="javascript:alert(1)">x</a>', '<iframe src="x"></iframe>']) {
    assert.throws(() => validateProjectData({ pages: [{ ...page, items: [markup] }] }), /project data/i);
  }
  assert.throws(() => validateProjectData({}), /project data/i);
  assert.throws(() => validateProjectData({ pages: [{ ...page, pageSize: 0 }] }), /project data/i);
});

test('project fetch reports unavailable data rather than pretending loading succeeded', async () => {
  await assert.rejects(loadProjectData(async () => ({ ok: false, status: 404 })), /404/);
  assert.deepEqual(await loadProjectData(async () => ({ ok: true, json: async () => ({ pages: [] }) })), []);
});

test('runtime corrects CTA links and delegates native testimonial clicks', async () => {
  const attrs = {};
  const anchor = { setAttribute: (key, value) => { attrs[key] = value; }, removeAttribute: key => { delete attrs[key]; } };
  let click;
  const root = { querySelectorAll: () => [anchor], addEventListener: (name, fn) => { click = fn; } };
  installSiteControls(root, '/deedee-studio-static/en/our-work');
  assert.equal(attrs.href, '/deedee-studio-static/en/contact-us/');
  let prevented = false;
  const button = { dataset: {}, textContent: 'Show More', getAttribute: () => 'false', setAttribute() {}, closest: () => ({ querySelector: () => ({ classList: { toggle() {} } }) }) };
  await click({ target: { closest: selector => selector.includes('ellipsis') ? button : null }, preventDefault: () => { prevented = true; } });
  assert.equal(button.textContent, 'Show Less');
  assert.ok(prevented);
  await click({ target: {} });
});
