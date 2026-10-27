import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHostedEnvironment, assertHostedUsers } from '../lib/hosted-config.mjs';
import { hashPassword, serializeSessionCookie, serializePreviewCookie } from '../lib/auth.mjs';
import { resolveArchiveUrl } from '../lib/archive-proxy.mjs';

const env = { POC_HOSTED: '1', POC_ORIGIN: 'https://deedee-cms.onrender.com',
  POC_EDITOR_PASSWORD: 'editor-strong-password-123', POC_PUBLISHER_PASSWORD: 'publisher-strong-password-456',
  POC_DATA_DIR: '/var/data/cms', CMS_EXPORT_DIR: '/var/data/publish' };

test('hosted configuration refuses missing, demo and insecure configuration', () => {
  assert.doesNotThrow(() => validateHostedEnvironment(env));
  for (const changes of [ { POC_EDITOR_PASSWORD: '' }, { POC_PUBLISHER_PASSWORD: 'publisher-demo' },
    { POC_ORIGIN: 'http://example.com' }, { POC_DATA_DIR: '' }, { CMS_EXPORT_DIR: '' },
    { POC_ORIGIN: 'https://example.com/path' } ]) {
    assert.throws(() => validateHostedEnvironment({ ...env, ...changes }));
  }
  assert.doesNotThrow(() => validateHostedEnvironment({}));
});

test('persisted demo accounts are rejected even with strong environment passwords', () => {
  const users = [{ username: 'editor', passwordHash: hashPassword('editor-demo') }];
  assert.throws(() => assertHostedUsers(users), /demo/i);
  assert.doesNotThrow(() => assertHostedUsers([{ username: 'editor', passwordHash: hashPassword(env.POC_EDITOR_PASSWORD) }]));
});

test('HTTPS cookies include Secure without changing local development cookies', () => {
  assert.match(serializeSessionCookie('token', 60, true), /; Secure/);
  assert.match(serializePreviewCookie('token', 60, true), /; Secure/);
  assert.doesNotMatch(serializeSessionCookie('token', 60), /; Secure/);
});

test('archive upstream subpath is preserved without doubling existing paths', () => {
  const origin = 'https://avalook.github.io/deedee-studio-static/';
  assert.equal(resolveArchiveUrl('/aboutus/?x=1', origin).href, `${origin}aboutus/?x=1`);
  assert.equal(resolveArchiveUrl('/deedee-studio-static/assets/a.jpg', origin).href, `${origin}assets/a.jpg`);
  assert.equal(resolveArchiveUrl('/', origin).href, origin);
});
