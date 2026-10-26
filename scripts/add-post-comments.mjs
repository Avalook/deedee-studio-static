// Live shows a "Bình luận" / "Comments" section under every article; the mirror only captured it on two of them.
// Copy the reference block into the other article pages. Idempotent.
//   node scripts/add-post-comments.mjs
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCE = 'post/chia-khoa-cho-mot-quy-trinh-hop-tac-quoc-te/index.html';
// The English section uses the Vietnamese block's markup with live's English wording.
const ENGLISH = [
  ['Bình luận', 'Comments'], ['Viết bình luận...', 'Write a comment...'], ['Viết bình luận', 'Write a comment'],
  ['Tệp đính kèm', 'Attachments'], ['Thêm emoji', 'Add emoji'], ['Thêm ảnh', 'Add image'], ['Thêm GIF', 'Add GIF'],
  ['Thêm video', 'Add video'], ['để đăng bình luận', 'to post a comment'], ['>Đăng nhập<', '>Log in<'],
  ['>Hủy<', '>Cancel<'], ['>Đăng<', '>Post<'],
];
const OLD_SECTION = /<section class="deedee-local-comments"[\s\S]*?<\/section>/;
const MARKER = 'data-deedee-local-comments';
const RELATED_END = '</article></div></section></section></div></div>';
const SCRIPT = '<script type="module" src="/deedee-studio-static/scripts/local-comment-composer.mjs"></script>';
const HEAD_LINK = /<link[^>]*(?:data-chunk="post-page-wix-comments"|blog-comments-local\.css)[^>]*>/g;

/** The comments section and head links of a reference article. */
export function extractCommentParts(html) {
  const marker = html.indexOf(MARKER);
  if (marker < 0) throw new Error('reference has no local comments block');
  const start = html.lastIndexOf('<div><section class="prZ8Wc">', marker);
  const end = html.indexOf('</section></div>', marker) + '</section></div>'.length;
  const block = html.slice(start, end);
  const id = /wc-root ([0-9a-f]{24})/.exec(block)?.[1];
  if (!id) throw new Error('reference comments block has no root id');
  return { block, id, links: html.match(HEAD_LINK) ?? [] };
}

/** Insert the section after the related-posts block; returns the html unchanged when it is already there. */
const SHELL_START = '<div><section class="prZ8Wc">';

/** The `<div><section class="prZ8Wc">…</section></div>` span of an empty Wix comments shell, or null. */
function findCommentsShell(html) {
  const start = html.indexOf(SHELL_START);
  if (start < 0) return null;
  let depth = 0;
  for (const match of html.slice(start + 5).matchAll(/<(\/?)section\b[^>]*>/g)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) {
      const end = start + 5 + match.index + match[0].length;
      return html.startsWith('</div>', end) ? { start, end: end + '</div>'.length } : null;
    }
  }
  return null;
}

export function addPostComments(html, parts, slug, language = 'vi') {
  if (html.includes(MARKER)) return html;
  html = html.replace(OLD_SECTION, '');
  const shell = html.includes('data-hook="wc-root') ? findCommentsShell(html) : null;
  const mainEnd = html.indexOf('</main>');
  const at = html.lastIndexOf(RELATED_END, mainEnd);
  if (mainEnd < 0 || (!shell && at < 0)) return null;
  const id = createHash('sha1').update(slug).digest('hex').slice(0, 24);
  let block = parts.block.split(parts.id).join(id);
  if (language === 'en') for (const [from, to] of ENGLISH) block = block.split(from).join(to);
  // An empty shell is replaced in place; otherwise the section goes right after the related posts.
  let out = shell
    ? html.slice(0, shell.start) + block + html.slice(shell.end)
    : html.slice(0, at + RELATED_END.length) + block + html.slice(at + RELATED_END.length);
  const main = out.indexOf('</main>');
  if (!out.includes(SCRIPT)) out = out.slice(0, main) + SCRIPT + out.slice(main);
  const head = out.indexOf('</head>');
  const missing = parts.links.filter(link => !out.includes(link));
  return out.slice(0, head) + missing.join('') + out.slice(head);
}

function* articlePages(dir) {
  const base = path.join(ROOT, dir);
  if (!existsSync(base)) return;
  for (const name of readdirSync(base)) {
    const file = path.join(base, name, 'index.html');
    if (existsSync(file)) yield { file, slug: `${dir}/${name}` };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [language, dir] of [['vi', 'post'], ['en', 'en/post']]) {
    const parts = extractCommentParts(readFileSync(path.join(ROOT, REFERENCE), 'utf8'));
    let added = 0;
    const skipped = [];
    for (const { file, slug } of articlePages(dir)) {
      const html = readFileSync(file, 'utf8');
      const next = addPostComments(html, parts, slug, language);
      if (next === null) skipped.push(slug);
      else if (next !== html) { writeFileSync(file, next); added += 1; }
    }
    console.log(JSON.stringify({ language, added, skipped }));
  }
}
