import assert from 'node:assert/strict';
import test from 'node:test';
import { alignTexts, collectTextNodes, transplantText } from '../scripts/transplant-text.mjs';

const vi = '<html lang="vi"><head><title>Về</title><script>var x = "Xin chào";</script></head><body><div id="comp-a"><h1>VỀ CHÚNG TÔI</h1><p>Xin chào <b>bạn</b> &amp; bạn bè</p></div><footer id="comp-f"><a href="/x">Liên hệ</a></footer></body></html>';

test('lists visible text in order with its component anchor, skipping scripts and the head', () => {
  const nodes = collectTextNodes(vi);
  assert.deepEqual(nodes.map(n => [n.anchor, n.tag, n.value]), [
    ['comp-a', 'h1', 'VỀ CHÚNG TÔI'], ['comp-a', 'p', 'Xin chào '], ['comp-a', 'b', 'bạn'], ['comp-a', 'p', ' & bạn bè'], ['comp-f', 'a', 'Liên hệ'],
  ]);
});

test('transplant swaps only the words and leaves every other byte alone', () => {
  const en = '<html lang="en"><body><div id="comp-a"><h1>ABOUT US</h1><p>Hello <b>you</b> &amp; friends</p></div><footer id="comp-f"><a>Contact</a></footer></body></html>';
  const { html, stats } = transplantText(vi, collectTextNodes(en));
  assert.equal(html, '<html lang="vi"><head><title>Về</title><script>var x = "Xin chào";</script></head><body><div id="comp-a"><h1>ABOUT US</h1><p>Hello <b>you</b> &amp; friends</p></div><footer id="comp-f"><a href="/x">Contact</a></footer></body></html>');
  assert.deepEqual(stats, { baseNodes: 5, liveNodes: 5, matched: 5, changed: 5, unmatchedBase: 0, unmatchedLive: 0 });
});

test('extra live-only nodes (cookie banners, widgets) do not shift the alignment', () => {
  const en = '<body><div id="comp-a"><h1>ABOUT US</h1><p>Hello <b>you</b> &amp; friends</p></div><div id="comp-banner">We use cookies</div><footer id="comp-f"><a>Contact</a></footer></body>';
  const { html, stats } = transplantText(vi, collectTextNodes(en));
  assert.match(html, /<a href="\/x">Contact<\/a>/);
  assert.equal(stats.unmatchedLive, 1);
  assert.equal(stats.unmatchedBase, 0);
});

test('base-only nodes keep their original text and special characters are escaped', () => {
  const en = '<body><div id="comp-a"><h1>A &lt; B</h1></div></body>';
  const { html, stats } = transplantText(vi, collectTextNodes(en));
  assert.match(html, /<h1>A &lt; B<\/h1>/);
  assert.match(html, /Xin chào /);
  assert.equal(stats.unmatchedBase, 4);
});

test('alignment pairs by anchor and tag', () => {
  const a = [{ anchor: 'x', tag: 'p' }, { anchor: 'y', tag: 'p' }];
  const b = [{ anchor: 'z', tag: 'p' }, { anchor: 'y', tag: 'p' }];
  assert.deepEqual(alignTexts(a, b), [[1, 1]]);
});

test('text that hydration moved from a <span> into its <h2>/<p> is still paired by component id', () => {
  const base = '<body><div id="comp-a"><h2><span>VỀ CHÚNG TÔI</span></h2></div><div id="comp-b"><span>Một</span><span>Hai</span></div></body>';
  const live = '<body><div id="comp-a"><h2>ABOUT US</h2></div><div id="comp-b"><p>One</p><p>Two</p></div></body>';
  const { html, stats } = transplantText(base, collectTextNodes(live));
  assert.equal(html, '<body><div id="comp-a"><h2><span>ABOUT US</span></h2></div><div id="comp-b"><span>One</span><span>Two</span></div></body>');
  assert.equal(stats.unmatchedBase, 0);
});

test('a component whose text counts differ is left alone rather than guessed', () => {
  const base = '<body><div id="comp-b"><span>Một</span><span>Hai</span></div></body>';
  const live = '<body><div id="comp-b"><p>One</p></div></body>';
  assert.equal(transplantText(base, collectTextNodes(live)).html, base);
});
