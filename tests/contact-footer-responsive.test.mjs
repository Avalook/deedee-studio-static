import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { VIEWER_FEEDBACK_CSS } from '../scripts/viewer-feedback.mjs';

const descendants = node => [node, ...(node.childNodes || []).flatMap(descendants)];
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');

test('contact footer replacement is mobile-only and leaves its desktop counterpart intact', async () => {
  for (const route of ['contact-us', 'en/contact-us']) {
    const html = await readFile(new URL(`../${route}/index.html`, import.meta.url), 'utf8');
    const nodes = descendants(parse(html));
    const mobile = nodes.find(n => n.attrs?.some(a => a.name === 'id' && a.value === 'comp-mq7qhpf3'));
    const desktop = nodes.find(n => n.tagName === 'footer' && n.attrs?.some(a => a.name === 'id' && a.value === 'comp-m7j8oryh'));
    assert.equal(mobile?.tagName, 'section');
    assert.match(text(mobile), /© 2025/);
    assert.match(text(desktop), /© 2022/);
    assert.match(html, /scripts\/site-controls\.mjs/);
  }
  assert.match(VIEWER_FEEDBACK_CSS, /@media \(min-width: 751px\)\s*\{[^}]*#comp-mq7qhpf3\s*\{\s*display:\s*none\s*!important;/);
  assert.doesNotMatch(VIEWER_FEEDBACK_CSS, /#comp-m7j8oryh\s*\{\s*display:\s*none/);
});
