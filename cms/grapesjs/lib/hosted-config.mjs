import path from 'node:path';
import { verifyPassword } from './auth.mjs';

/** Validate the small single-instance hosted rollout before opening a listener. */
export function validateHostedEnvironment(env = process.env) {
  if (env.POC_HOSTED !== '1') return;
  for (const name of ['POC_EDITOR_PASSWORD', 'POC_PUBLISHER_PASSWORD']) {
    const value = env[name] || '';
    if (value.length < 20 || /^(editor|publisher)-demo$/.test(value)) {
      throw new Error(`${name} must be a unique password of at least 20 characters`);
    }
  }
  if (env.POC_EDITOR_PASSWORD === env.POC_PUBLISHER_PASSWORD) {
    throw new Error('Editor and publisher passwords must differ');
  }
  const origin = new URL(env.POC_ORIGIN || 'http://invalid');
  if (origin.protocol !== 'https:' || origin.origin !== env.POC_ORIGIN) {
    throw new Error('POC_ORIGIN must be an HTTPS origin without a path or trailing slash');
  }
  for (const name of ['POC_DATA_DIR', 'CMS_EXPORT_DIR']) {
    if (!env[name] || !path.isAbsolute(env[name])) throw new Error(`${name} must be an absolute persistent path`);
  }
}

/** Old demo accounts must not become public just because env passwords changed. */
export function assertHostedUsers(users) {
  if (!Array.isArray(users) || !users.length) throw new Error('Hosted users are missing');
  for (const user of users) {
    if (['editor-demo', 'publisher-demo'].some((password) => verifyPassword(password, user.passwordHash))) {
      throw new Error('Persisted demo credentials detected; migrate users before hosting');
    }
  }
}
