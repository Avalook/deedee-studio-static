import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectMedia, limitFor, mediaSettings, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../lib/media.mjs';
import { exportStaticSite, rewriteUploadedMedia } from '../lib/export.mjs';
import { validateSiteDocument } from '../lib/site-document.mjs';

const IMG = '0f6f6e9a-1b0e-4f1e-9f45-6f4b8c1d2e3a.png';
const VID = '1a2b3c4d-1b0e-4f1e-9f45-6f4b8c1d2e3a.mp4';
const BASE = 'https://avalook.github.io/deedee-studio-media';
const tmp = (prefix) => fs.mkdtemp(path.join(os.tmpdir(), prefix));

test('media type is decided from the bytes, with a limit per kind', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(8)]);
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);
  assert.equal(detectMedia(png).kind, 'image');
  assert.deepEqual([detectMedia(mp4).ext, detectMedia(mp4).kind], ['mp4', 'video']);
  assert.deepEqual([detectMedia(webm).ext, detectMedia(webm).mime], ['webm', 'video/webm']);
  assert.equal(detectMedia(Buffer.from('<svg onload=alert(1)></svg>')), null);
  assert.equal(detectMedia(Buffer.from('MZ\u0090\u0000executable')), null);
  assert.equal(limitFor('image'), MAX_IMAGE_BYTES);
  assert.equal(limitFor('video'), MAX_VIDEO_BYTES);
  assert.ok(MAX_VIDEO_BYTES > MAX_IMAGE_BYTES);
});

test('media repository settings are validated', () => {
  assert.equal(mediaSettings({}), null);
  assert.deepEqual(mediaSettings({ CMS_MEDIA_REPO_DIR: '/data/media', CMS_MEDIA_BASE_URL: `${BASE}/` }), { dir: '/data/media', baseUrl: BASE });
  assert.throws(() => mediaSettings({ CMS_MEDIA_REPO_DIR: 'relative', CMS_MEDIA_BASE_URL: BASE }), /absolute/);
  assert.throws(() => mediaSettings({ CMS_MEDIA_REPO_DIR: '/data/media', CMS_MEDIA_BASE_URL: 'http://example.com' }), /https/);
  assert.throws(() => mediaSettings({ CMS_MEDIA_REPO_DIR: '/data/media' }), /https/);
});

test('video insertions are validated and rewritten like images', () => {
  const doc = { schemaVersion: 1, pageId: '/x', operations: [], insertions: [{ id: 'add_12345678-1234-1234-1234-123456789abc', type: 'video', video: `/media/${VID}` }] };
  assert.equal(validateSiteDocument(doc).insertions[0].video, `/media/${VID}`);
  for (const video of ['/media/x.mp4', 'https://evil.test/a.mp4', `/media/${IMG}`, undefined]) {
    assert.throws(() => validateSiteDocument({ ...doc, insertions: [{ ...doc.insertions[0], video }] }), /video/i);
  }
  const { pages, files } = rewriteUploadedMedia({ '/x': doc }, '/deedee-studio-static', (file) => `${BASE}/media/${file}`);
  assert.deepEqual(files, [VID]);
  assert.equal(pages['/x'].insertions[0].video, `${BASE}/media/${VID}`);
});

test('export puts media in the media repository, not in the website repository', async () => {
  const out = await tmp('cms-site-'); const mediaDir = await tmp('cms-media-'); const uploads = await tmp('cms-up-');
  const runtime = path.join(await tmp('cms-rt-'), 'cms-runtime.js'); await fs.writeFile(runtime, '/* runtime */');
  await fs.writeFile(path.join(uploads, IMG), Buffer.from([1])); await fs.writeFile(path.join(uploads, VID), Buffer.from([2, 3]));
  const document = { schemaVersion: 1, pageId: '/x', operations: [{ selector: '#img', image: `/media/${IMG}` }],
    insertions: [{ id: 'add_12345678-1234-1234-1234-123456789abc', type: 'video', video: `/media/${VID}` }] };
  const result = await exportStaticSite({ release: { revisionId: 'rev_x', publishedAt: 'now', publishedBy: 'p', siteDocument: document },
    outDir: out, uploadsDir: uploads, runtimeFile: runtime, mediaRepo: { dir: mediaDir, baseUrl: BASE } });
  assert.deepEqual(result.mediaFiles.sort(), [`media/${IMG}`, `media/${VID}`].sort());
  assert.ok(result.files.every((file) => !file.startsWith('assets/cms/')), 'website repository stages no media');
  assert.deepEqual([...(await fs.readFile(path.join(mediaDir, 'media', VID)))], [2, 3]);
  await assert.rejects(fs.stat(path.join(out, 'assets', 'cms', IMG)));
  const overrides = JSON.parse(await fs.readFile(path.join(out, 'site-overrides.json'), 'utf8'));
  assert.equal(overrides.pages['/x'].operations[0].image, `${BASE}/media/${IMG}`);
  assert.equal(overrides.pages['/x'].insertions[0].video, `${BASE}/media/${VID}`);
  // A second publish still finds media that only exists in the media repository.
  await fs.rm(uploads, { recursive: true });
  await exportStaticSite({ release: { revisionId: 'rev_y', publishedAt: 'now', publishedBy: 'p', siteDocument: document },
    outDir: out, uploadsDir: path.join(uploads, 'gone'), runtimeFile: runtime, mediaRepo: { dir: mediaDir, baseUrl: BASE } });
});
