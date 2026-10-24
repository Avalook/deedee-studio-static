import { parse } from 'parse5';

/** Escape a value when emitting a double-quoted HTML attribute. */
function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

/** Read an attribute from a parse5 element. */
function attribute(node, name) {
  return node.attrs?.find(item => item.name === name)?.value;
}

/** Preserve the authored focal position, replacing captured pixel dimensions. */
function responsiveStyle(style = '') {
  const properties = style.split(';').map(value => value.trim()).filter(Boolean);
  const retained = properties.filter(value => !/^(?:width|height|object-fit)\s*:/i.test(value));
  return ['width:100%', 'height:100%', 'object-fit:cover', ...retained].join(';');
}

/** Replace only an image start tag, leaving the surrounding document untouched. */
function imageTag(image, src, info) {
  const attrs = image.attrs.filter(item => !['src', 'style', 'srcset', 'data-deedee-background'].includes(item.name));
  const data = info.imageData;
  const focal = data.focalPoint;
  const metadata = data.width > 0 && data.height > 0 && focal
    ? [{ name: 'data-deedee-background', value: JSON.stringify({ width: data.width, height: data.height, x: focal.x, y: focal.y }) }]
    : [];
  const updated = [
    ...attrs,
    ...metadata,
    { name: 'src', value: src },
    { name: 'style', value: responsiveStyle(attribute(image, 'style')) },
  ];
  return `<img ${updated.map(item => `${item.name}="${escapeAttribute(item.value)}"`).join(' ')}>`;
}

/**
 * Restore known Wix section backgrounds to uncropped assets and fluid dimensions.
 * HTML source offsets keep unrelated markup, scripts and responsive rules intact.
 * This deliberately excludes card images and unknown background/effect types.
 *
 * @param {string} html Rendered document to repair.
 * @param {Readonly<Record<string, string>>} sources Wix media URI to local asset.
 * @param {string} basePath Optional GitHub Pages project prefix.
 * @returns {string} Repaired document, deterministic on repeated applications.
 */
export function repairBackgrounds(html, sources, basePath = '') {
  if (!/^(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)) throw new Error('Invalid base path');
  const document = parse(html, { sourceCodeLocationInfo: true });
  const edits = [];
  const pending = [document];
  while (pending.length) {
    const node = pending.pop();
    pending.push(...(node.childNodes || []));
    if (node.tagName !== 'wow-image' || !attribute(node, 'class')?.split(/\s+/).includes('bgImage')) continue;
    let info;
    try {
      info = JSON.parse(attribute(node, 'data-image-info') || '{}');
    } catch (cause) {
      throw new Error('Invalid Wix background metadata', { cause });
    }
    const asset = sources[info?.imageData?.uri];
    if (!asset) continue;
    if (!/^\/assets\/[a-zA-Z0-9._-]+$/.test(asset)) throw new Error('Invalid background asset');
    const image = node.childNodes.find(child => child.tagName === 'img');
    if (!image) continue;
    const location = image.sourceCodeLocation;
    edits.push({ start: location.startOffset, end: location.endOffset, value: imageTag(image, basePath + asset, info) });
  }
  const result = edits.sort((a, b) => b.start - a.start).reduce(
    (result, edit) => result.slice(0, edit.start) + edit.value + result.slice(edit.end), html,
  );
  if (!edits.length || result.includes('data-deedee-background-runtime')) return result;
  const script = `<script type="module" data-deedee-background-runtime src="${basePath}/scripts/background-layout.mjs"></script>`;
  return result.includes('</body>') ? result.replace('</body>', `${script}</body>`) : result + script;
}
