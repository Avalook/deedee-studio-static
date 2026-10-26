import { parse } from 'parse5';

/**
 * Re-language a mirrored page without recapturing it.
 *
 * Wix serves VI and EN versions of a page from the same template (same component ids), so the English page is the
 * Vietnamese page with different words. collectTextNodes() lists the visible text of a document in order, tagged with
 * its nearest component id; alignTexts() pairs the two lists (longest common subsequence on that tag) and
 * transplantText() splices the new words into the original HTML, leaving every other byte as it was.
 */
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head', 'title', 'textarea']);

function attr(node, name) { return node.attrs?.find(item => item.name === name)?.value; }

function walk(node, anchor, out, html) {
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') {
      if (child.value.trim() && child.sourceCodeLocation) {
        out.push({ anchor, tag: node.tagName ?? '', value: child.value, start: child.sourceCodeLocation.startOffset, end: child.sourceCodeLocation.endOffset });
      }
    } else if (child.tagName && !SKIP.has(child.tagName)) {
      walk(child, attr(child, 'id') && /^(comp-|SITE_|viewer-)/.test(attr(child, 'id')) ? attr(child, 'id') : anchor, out, html);
    }
  }
}

/** Visible text nodes of an HTML document, in document order, each tagged with its nearest component id. */
export function collectTextNodes(html) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const body = (function find(node) {
    for (const child of node.childNodes ?? []) {
      if (child.tagName === 'body') return child;
      const hit = find(child);
      if (hit) return hit;
    }
    return null;
  })(document);
  const out = [];
  if (body) walk(body, '', out, html);
  return out;
}

const key = node => `${node.anchor}|${node.tag}`;

/** Pair base[i] with live[j] using the longest common subsequence of (anchor id, tag). */
export function alignTexts(base, live) {
  const n = base.length;
  const m = live.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = key(base[i]) === key(live[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(base[i]) === key(live[j])) { pairs.push([i, j]); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return pairs.concat(pairByAnchor(base, live, pairs)).sort((a, b) => a[0] - b[0]);
}

// Hydration can move text from a styled <span> up into its <h2>/<p>, so the tag no longer agrees. For a component whose
// leftover text nodes are equally many on both sides, pair them in order and trust the component id alone.
function pairByAnchor(base, live, pairs) {
  const usedBase = new Set(pairs.map(pair => pair[0]));
  const usedLive = new Set(pairs.map(pair => pair[1]));
  const group = (nodes, used) => {
    const map = new Map();
    nodes.forEach((node, index) => {
      if (used.has(index) || !node.anchor) return;
      map.set(node.anchor, [...(map.get(node.anchor) ?? []), index]);
    });
    return map;
  };
  const liveGroups = group(live, usedLive);
  const extra = [];
  for (const [anchor, baseIndexes] of group(base, usedBase)) {
    const liveIndexes = liveGroups.get(anchor);
    if (liveIndexes?.length === baseIndexes.length) baseIndexes.forEach((index, order) => extra.push([index, liveIndexes[order]]));
  }
  return extra;
}

const escapeText = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replace the text of `html` with the aligned text of `liveNodes`; returns the new HTML and what happened. */
export function transplantText(html, liveNodes) {
  const base = collectTextNodes(html);
  const pairs = alignTexts(base, liveNodes);
  const edits = pairs
    .filter(([i, j]) => base[i].value.trim() !== liveNodes[j].value.trim())
    .map(([i, j]) => {
      const lead = /^\s*/.exec(base[i].value)[0];
      const trail = /\s*$/.exec(base[i].value)[0];
      return { start: base[i].start, end: base[i].end, text: lead + escapeText(liveNodes[j].value.trim()) + trail };
    })
    .sort((a, b) => b.start - a.start);
  let result = html;
  for (const edit of edits) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return {
    html: result,
    stats: { baseNodes: base.length, liveNodes: liveNodes.length, matched: pairs.length, changed: edits.length, unmatchedBase: base.length - pairs.length, unmatchedLive: liveNodes.length - pairs.length },
  };
}
